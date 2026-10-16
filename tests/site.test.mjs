import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const content = path.join(root, 'content');
const origin = 'https://www.bluexiii.com';
const base = '/hive/';
const mainRoutes = ['/', '/product/', '/architecture/', '/handbooks/', '/developers/', '/library/', '/docs/'];
let documents;
let publicFiles;
let htmlPages;
let searchEntries;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.sort((a, b) => a.name.localeCompare(b.name)).map((entry) => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  }));
  return nested.flat();
}

function decodeEntities(value) {
  const named = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
  return value.replace(/&(#x[\da-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (match, entity) => {
    if (entity[0] !== '#') return named[entity.toLowerCase()] ?? match;
    const number = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    return Number.isFinite(number) && number <= 0x10ffff ? String.fromCodePoint(number) : match;
  });
}

function attributes(source) {
  const result = {};
  for (const match of source.matchAll(/([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
    result[match[1].toLowerCase()] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return result;
}

function tags(html) {
  // 保留script的src属性，但不把JavaScript字符串里的HTML当成页面标签。
  const markup = html.replace(/<!--[\s\S]*?-->/g, '').replace(/(<script\b[^>]*>)[\s\S]*?(<\/script\s*>)/gi, '$1$2');
  return [...markup.matchAll(/<([a-z][\w:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi)]
    .map((match) => ({ name: match[1].toLowerCase(), attrs: attributes(match[2]) }));
}

function visibleText(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function scalar(frontmatter, key, source) {
  const raw = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))?.[1]?.trim();
  assert.ok(raw, `${source}缺少${key}`);
  if (raw.startsWith('"')) {
    try { return JSON.parse(raw); } catch { assert.fail(`${source}的${key}不是有效字符串`); }
  }
  if (raw.startsWith("'")) return raw.slice(1, -1).replace(/''/g, "'");
  return raw;
}

async function readDocument(file) {
  const source = await readFile(file, 'utf8');
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/);
  const slug = path.relative(content, file).replaceAll(path.sep, '/').replace(/\.md$/, '');
  assert.ok(match, `${slug}缺少frontmatter`);
  const title = scalar(match[1], 'title', slug);
  const description = scalar(match[1], 'description', slug);
  const section = scalar(match[1], 'section', slug);
  const order = Number(scalar(match[1], 'order', slug));
  assert.ok(Number.isFinite(order), `${slug}的顺序无效`);
  assert.match(scalar(match[1], 'updated', slug), /^\d{4}-\d{2}-\d{2}$/, `${slug}的更新日期无效`);
  assert.match(match[1], /^sources:[ \t]*(?:\[[^\n]*\]|\n(?:[ \t]+- .+\n?)+)/m, `${slug}缺少来源数组`);
  assert.equal(slug.split('/')[0], section, `${slug}的section与目录不符`);
  return { slug, title, description, section, order, body: match[2], route: `${base}docs/${slug}/` };
}

function routeForHtml(file) {
  const relative = path.relative(dist, file).replaceAll(path.sep, '/');
  if (relative === 'index.html') return base;
  if (relative === '404.html') return base + '404.html';
  if (relative.endsWith('/index.html')) return base + relative.slice(0, -'index.html'.length);
  return base + relative.replace(/\.html$/, '') + '/';
}

function routeFile(route) {
  assert.ok(route.startsWith(base), `站内地址缺少${base}基础路径`);
  const pathname = decodeURIComponent(route.slice(base.length));
  const file = path.resolve(dist, pathname);
  assert.ok(file === dist || file.startsWith(dist + path.sep), '站内地址越过站点目录');
  return file;
}

async function resolvePublicFile(url) {
  let file = routeFile(url.pathname);
  let info;
  try { info = await stat(file); } catch { return undefined; }
  if (info.isDirectory()) {
    file = path.join(file, 'index.html');
    try { info = await stat(file); } catch { return undefined; }
  }
  return info.isFile() ? file : undefined;
}

function internalUrl(target, pageRoute) {
  if (/^(?:data:|blob:|mailto:|tel:|about:)/i.test(target)) return undefined;
  assert.ok(!/^javascript:/i.test(target), '公开页面不能包含javascript链接');
  const url = new URL(target, origin + pageRoute);
  if (url.origin !== origin) return undefined;
  // 完整博客或ACDL网址是外部站点入口；站内相对地址则必须留在/hive/下。
  if (/^https?:\/\//i.test(target) && !url.pathname.startsWith(base)) return undefined;
  assert.ok(url.pathname.startsWith(base), `站内地址缺少${base}基础路径：${url.pathname}`);
  return url;
}

function searchableText(markdown) {
  let fence;
  const lines = markdown.split(/\r?\n/).map((line) => {
    const delimiter = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (delimiter && !fence) { fence = { marker: delimiter[1][0], length: delimiter[1].length }; return ''; }
    if (delimiter && delimiter[1][0] === fence.marker && delimiter[1].length >= fence.length && !delimiter[2].trim()) { fence = undefined; return ''; }
    // 示例代码中的链接样式是代码本身，不能把其中的地址当成Markdown格式删掉。
    return fence ? line : line.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1');
  });
  return lines.join('\n');
}

function normalizeSearchText(value) {
  return decodeEntities(value).normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

function pagination(html) {
  for (const match of html.matchAll(/<nav\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/nav>/gi)) {
    const attrs = attributes(match[1]);
    if (attrs['aria-label'] === '前后章节' || /(?:^|\s)(?:doc-pagination|page-nav|chapter-nav|prev-next)(?:\s|$)/.test(attrs.class ?? '')) return match[2];
  }
  return undefined;
}

before(async () => {
  try { await stat(dist); } catch { assert.fail('缺少dist/，请先运行npm run build'); }
  documents = await Promise.all((await walk(content)).filter((file) => file.endsWith('.md')).map(readDocument));
  publicFiles = await walk(dist);
  htmlPages = new Map(await Promise.all(publicFiles.filter((file) => file.endsWith('.html')).map(async (file) => [file, await readFile(file, 'utf8')])));
  searchEntries = JSON.parse(await readFile(path.join(dist, 'search-index.json'), 'utf8'));
});

test('内容完整，首页和各主入口已生成', async () => {
  assert.ok(documents.length >= 42, `当前只有${documents.length}篇正文，本期至少应有42篇`);
  assert.equal(new Set(documents.map((doc) => doc.slug)).size, documents.length, '正文slug重复');
  for (const route of mainRoutes) {
    const url = new URL(base + route.replace(/^\//, ''), origin);
    const file = await resolvePublicFile(url);
    assert.ok(file && htmlPages.has(file), `主入口未生成：${url.pathname}`);
  }
  for (const doc of documents) {
    assert.ok(await resolvePublicFile(new URL(doc.route, origin)), `正文页面未生成：${doc.slug}`);
  }
});

test('所有HTML的站内href和src均能解析，页面片段和图片存在', async () => {
  const ids = new Map();
  const fragmentChecks = [];
  let checkedLinks = 0;
  let checkedImages = 0;
  for (const [file, html] of htmlPages) {
    const route = routeForHtml(file);
    for (const tag of tags(html)) {
      for (const attribute of ['href', 'src']) {
        if (!(attribute in tag.attrs)) continue;
        const target = tag.attrs[attribute];
        assert.ok(target, `${route}的${tag.name}.${attribute}为空`);
        const url = internalUrl(target, route);
        if (!url) continue;
        const destination = await resolvePublicFile(url);
        assert.ok(destination, `${route}中的${tag.name}.${attribute}目标不存在：${url.pathname}`);
        checkedLinks += 1;
        if (tag.name === 'img' && attribute === 'src') {
          checkedImages += 1;
          assert.match(destination, /\.(?:png|jpe?g|gif|webp|avif|svg)$/i, `${route}的图片没有指向图片文件`);
          assert.ok(tag.attrs.alt?.trim(), `${route}有图片缺少说明文字`);
        }
        if (url.hash && /\.(?:html|svg)$/i.test(destination)) fragmentChecks.push({ route, url, destination });
      }
    }
  }
  for (const check of fragmentChecks) {
    if (!ids.has(check.destination)) {
      const text = htmlPages.get(check.destination) ?? await readFile(check.destination, 'utf8');
      ids.set(check.destination, new Set(tags(text).map((tag) => tag.attrs.id).filter(Boolean)));
    }
    const fragment = decodeURIComponent(check.url.hash.slice(1));
    assert.ok(ids.get(check.destination).has(fragment), `${check.route}指向不存在的片段：${check.url.pathname}#${fragment}`);
  }
  assert.ok(checkedLinks > documents.length, '没有检查到足够的站内链接');
  assert.ok(checkedImages > 0, '没有检查到任何图片');
});

test('公开页面使用唯一的HTTPS规范URL和正确的/hive/基础路径', () => {
  for (const [file, html] of htmlPages) {
    const elements = tags(html);
    const canonicals = elements.filter((tag) => tag.name === 'link' && tag.attrs.rel?.split(/\s+/).includes('canonical'));
    const route = routeForHtml(file);
    assert.equal(canonicals.length, 1, `${route}应有且只有一个canonical`);
    const canonical = new URL(canonicals[0].attrs.href);
    assert.equal(canonical.origin, origin, `${route}的canonical域名或协议错误`);
    assert.equal(canonical.pathname, route, `${route}的canonical路径错误`);
    assert.equal(canonical.search + canonical.hash, '', `${route}的canonical不能包含查询或片段`);
    assert.ok(!canonical.pathname.includes('/hive/hive/'), `${route}重复添加了基础路径`);
    const ogUrl = elements.find((tag) => tag.name === 'meta' && tag.attrs.property === 'og:url');
    assert.equal(ogUrl?.attrs.content, canonical.href, `${route}的分享URL与canonical不一致`);
  }
});

test('搜索索引覆盖每篇Markdown的标题、摘要和完整正文，包括代码示例', () => {
  assert.ok(Array.isArray(searchEntries), '搜索索引应是数组');
  assert.equal(searchEntries.length, documents.length, '搜索索引条数与Markdown数量不一致');
  assert.equal(new Set(searchEntries.map((entry) => entry.url)).size, documents.length, '搜索索引URL重复');
  for (const doc of documents) {
    const entry = searchEntries.find((item) => item.url === doc.route);
    assert.ok(entry, `${doc.slug}没有搜索索引`);
    assert.equal(entry.title, doc.title, `${doc.slug}搜索标题错误`);
    assert.equal(entry.description, doc.description, `${doc.slug}搜索摘要错误`);
    assert.equal(typeof entry.content, 'string', `${doc.slug}搜索正文无效`);
    assert.ok(entry.section?.trim(), `${doc.slug}缺少搜索分区`);
    const expected = normalizeSearchText(searchableText(doc.body));
    const actual = normalizeSearchText(entry.content);
    assert.ok(expected.length > 0, `${doc.slug}正文为空`);
    // 只报告路径，不将整段正文或可能存在的凭据打印到测试日志。
    assert.ok(actual === expected, `${doc.slug}的搜索索引缺失或改变了正文；不能只收录摘要，也不能丢弃代码段`);
  }
});

test('各文档页标题正确，前后章节按同一分区的顺序连接', async () => {
  const sections = Map.groupBy(documents, (doc) => doc.section);
  for (const docs of sections.values()) docs.sort((a, b) => a.order - b.order || a.slug.localeCompare(b.slug));
  for (const doc of documents) {
    const file = await resolvePublicFile(new URL(doc.route, origin));
    const html = htmlPages.get(file);
    assert.ok(html, `${doc.slug}没有HTML`);
    const title = visibleText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
    assert.ok(title.includes(doc.title), `${doc.slug}的浏览器标题与正文不一致`);
    const headings = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((match) => visibleText(match[1]));
    assert.deepEqual(headings, [doc.title], `${doc.slug}应有一个与frontmatter一致的一级标题`);
    const peers = sections.get(doc.section);
    if (peers.length < 2) continue;
    const nav = pagination(html);
    assert.ok(nav, `${doc.slug}缺少前后章节导航`);
    const links = tags(nav).filter((tag) => tag.name === 'a').map((tag) => internalUrl(tag.attrs.href, doc.route)?.pathname).filter(Boolean);
    const current = peers.findIndex((peer) => peer.slug === doc.slug);
    const previous = peers[current - 1];
    const next = peers[current + 1];
    if (previous) assert.ok(links.includes(previous.route), `${doc.slug}没有连接上一章${previous.slug}`);
    if (next) assert.ok(links.includes(next.route), `${doc.slug}没有连接下一章${next.slug}`);
    for (const peerLink of links.filter((link) => link.startsWith(base + 'docs/'))) {
      assert.ok([previous?.route, next?.route].includes(peerLink), `${doc.slug}的前后导航连接了错误章节`);
    }
  }
});

test('公开HTML、JSON和SVG不含本机路径、内网IPv4、可用凭据格式或私有源码链接', async () => {
  const patterns = [
    ['本机用户路径', /\/Users\/[^\s/]+|[A-Z]:\\Users\\|\/(?:private\/)?var\/folders\/|\/home\/(?!employee(?:[\s`/"'<]|$))[^\s/"'<]+/i],
    ['内网或回环IPv4', /(?<![\d.])(?:10\.(?:\d{1,3}\.){2}\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|127\.(?:\d{1,3}\.){2}\d{1,3}|0\.0\.0\.0)(?![\d.])/],
    ['GitHub凭据格式', /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
    ['API或云平台凭据格式', /\b(?:sk-[A-Za-z0-9_-]{20,}|(?:AKIA|ASIA)[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{20,})\b/],
    ['JWT凭据格式', /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/],
    ['私钥', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
    ['私有hive-os源码链接', /(?:https?:\/\/[^\s"'<>]+\/hive-os(?:[/?#]|\b)|(?:href|src)\s*=\s*["'][^"']*hive-os(?:[/?#]|\b))/i],
  ];
  function stringValues(value) {
    if (typeof value === 'string') return [value];
    if (Array.isArray(value)) return value.flatMap(stringValues);
    if (value && typeof value === 'object') return Object.values(value).flatMap(stringValues);
    return [];
  }
  const scanned = publicFiles.filter((file) => /\.(?:html|json|svg)$/i.test(file));
  assert.ok(scanned.length > documents.length, '公开内容扫描范围不完整');
  for (const file of scanned) {
    const relative = path.relative(dist, file).replaceAll(path.sep, '/');
    const source = await readFile(file, 'utf8');
    // JSON解码后再检查，覆盖转义斜杠；不扫描压缩JavaScript或二进制图片。
    const texts = file.endsWith('.json') ? [source, ...stringValues(JSON.parse(source))] : [decodeEntities(source)];
    for (const [name, pattern] of patterns) {
      assert.ok(!texts.some((text) => pattern.test(text)), `${relative}含${name}，请在本机检查；日志不输出匹配内容`);
    }
  }
});
