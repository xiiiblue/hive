#!/usr/bin/env node
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = process.env.HIVE_MANUAL_SOURCE
  ? path.resolve(process.env.HIVE_MANUAL_SOURCE)
  : path.resolve(websiteRoot, '../../telchina/hive-os');
const updated = '2026-11-22';
const diagramDirectory = 'docs/11-手册/01-产品技术手册';
const diagrams = [
  { source: '蜂巢功能架构与目录.html', file: 'capabilities.html', article: '/capabilities/' },
  { source: '蜂巢总体架构图.html', file: 'system-architecture.html', article: '/architecture/' },
  { source: '员工数字分身概念图.html', file: 'employee-digital-twin.html', article: '/product/' },
  { source: '员工工作空间与连续工作图.html', file: 'workspace-continuity.html', article: '/#workspace-continuity' },
  { source: 'diagram-atlas.css', file: 'diagram-atlas.css' },
];
const brandAssets = ['hive-logo.png', 'social-cover.svg', 'social-cover.png', 'favicon.svg'];

// 路由是公开链接的一部分。改标题或源文件名时保留已有slug。
const manuals = [
  {
    section: 'employee',
    directory: 'docs/11-手册/04-员工工作台操作手册',
    title: '员工工作台操作手册',
    description: '从第一次登录到对话、技能、业务面板和工作资料管理，了解员工工作台的用途和操作。',
    chapters: [
      ['01-入门与工作台导航.md', '01-start', '完成首次登录，找到业务范围和常用功能，了解电脑和手机工作台。'],
      ['02-发起与完成对话.md', '02-conversations', '选择模型，引用资料和工具，查看聊天文件、调试记录和任务结果。'],
      ['03-会话管理与自动化.md', '03-automation', '整理会话分组和归档，设置定时任务，查看每次执行的结果。'],
      ['04-技能广场与技能管理.md', '04-skills', '使用企业技能，管理个人副本、标签和版本，把已经验证的方法保存或共享。'],
      ['05-业务系统工具与消息渠道.md', '05-systems-and-channels', '使用获配的业务系统和工具，连接个人机器人，配置邮箱、来信规则和相关通知。'],
      ['06-业务面板.md', '06-panels', '打开和整理业务面板，建立个人副本，通过聊天修改、预览和诊断，并管理历史版本。'],
      ['07-工作空间文件与终端.md', '07-workspace', '理解运行环境、个人文件和团队目录，查看资源和文件，使用终端。'],
      ['08-备份导出与个人用量.md', '08-backups-and-usage', '查看恢复点、导出个人资产，了解哪些恢复操作需要管理员，并核对个人模型用量。'],
      ['09-个人设置记忆与规范.md', '09-settings-and-memory', '维护账号和个人偏好，使用记忆、学习、企业资料和工作规范。'],
      ['10-按场景完成工作与排查问题.md', '10-workflows-and-troubleshooting', '按首次工作、周报、技能复用、自动化和交接场景操作，遇到问题时按事实定位和求助。'],
    ],
  },
  {
    section: 'admin',
    directory: 'docs/11-手册/03-管理员控制台操作手册',
    title: '管理员控制台操作手册',
    description: '从人员与能力配置到模型、任务和恢复管理，理解控制台各项功能的用途、步骤和影响。',
    chapters: [
      ['01-入门与控制台导航.md', '01-start', '登录管理员控制台，找到人员、能力、执行和记录入口，查看企业展示设置。'],
      ['02-组织与人员.md', '02-people', '区分员工与管理员身份，创建和维护账号、调整部门，并处理停用、改密和登录失效。'],
      ['03-员工能力与工作规范.md', '03-capabilities-and-rules', '通过能力组为员工分配业务系统、技能、面板、工具和知识库，配置工作规范。'],
      ['04-业务系统与企业资源.md', '04-systems-and-resources', '登记业务系统，发布企业技能和业务面板，再将系统和资源加入对应岗位的能力组。'],
      ['05-Skill市场与MCP.md', '05-skills-and-mcp', '审核员工提交的技能，查看版本下架后谁还能使用，并配置和测试MCP工具。'],
      ['06-执行引擎模型与费用.md', '06-models-and-costs', '配置执行引擎与模型服务，测试模型，查看调用、费用和预算，并设置任务并行度与时限。'],
      ['07-统一身份与开放API.md', '07-identity-and-api', '区分统一身份与开放API的对接方向，配置客户端与Key，并核对任务调用结果。'],
      ['08-任务与工作空间.md', '08-tasks-and-workspaces', '查询任务和定时计划，管理员工工作空间、团队目录与资源配额。'],
      ['09-平台运行备份与排查.md', '09-operations-and-recovery', '通过监控、运营事件与审计排查问题，处理反馈、备份、恢复和导出。'],
      ['10-按场景完成管理工作.md', '10-admin-workflows', '按员工入职、能力变化、模型接入、异常排查与资料恢复场景，组织跨页面管理工作。'],
    ],
  },
];

const articleMapping = Object.fromEntries(manuals.flatMap((manual) => [
  [`${manual.directory}/README.md`, `/docs/${manual.section}/overview/`],
  ...manual.chapters.map(([file, slug]) => [`${manual.directory}/${file}`, `/docs/${manual.section}/${slug}/`]),
]));
const changes = { removedUnknownLinks: new Set(), metadataRemoved: 0, evidenceSectionsRemoved: 0 };

function removeSourceFraming(markdown) {
  let result = markdown.replace(/\r\n/g, '\n').replace(/^# .+\n/, '');
  // 只移除正文之前的治理元数据，保留正文中的引用与示例代码。
  if (/^\s*>\s*文档状态：/u.test(result)) {
    result = result.replace(/^\s*>[\s\S]*?(?=\n[^>\s])/u, '');
    changes.metadataRemoved += 1;
  }
  // 当前两册把源码核对依据放在正文最后，公开站点不镜像这些内部源码入口。
  result = result.replace(/^## 本章核对依据\s*\n[\s\S]*$/m, () => {
    changes.evidenceSectionsRemoved += 1;
    return '';
  });
  result = result.replace(/^本章依据当前[^\n]*(?:\n(?!\s*\n)[^\n]*)*\n?/gm, '');
  result = result.replace(/^\[(?:返回目录|返回手册目录)\]\([^\n]+$/gm, '');
  return result.trim();
}

function rewriteLinks(markdown, source, section) {
  let inFence = false;
  let marker = '';
  return markdown.split('\n').map((line) => {
    const fence = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (!inFence) { inFence = true; marker = fence[1][0]; }
      else if (fence[1][0] === marker) inFence = false;
      return line;
    }
    if (inFence) return line;
    return line.replace(/(!?)\[([^\]\n]*)\]\(([^)\n]+)\)/g, (match, image, label, destination) => {
      const target = destination.trim().replace(/^<|>$/g, '');
      if (/^(?:https?:|mailto:|tel:|#)/i.test(target)) {
        if (/github\.com\/[^/]+\/hive-os(?:[/?#]|$)/i.test(target)) {
          changes.removedUnknownLinks.add(`${source} → ${target}`);
          return label;
        }
        return match;
      }
      const [pathname, suffix = ''] = target.split(/(?=[?#])/u, 2);
      let decoded;
      try { decoded = decodeURIComponent(pathname); } catch { decoded = pathname; }
      const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(source), decoded));
      if (image) {
        if (!/^assets\/[^/]+\.(?:png|svg)$/i.test(decoded)) throw new Error(`未知图片路径：${source} → ${target}`);
        return `![${label}](/media/manuals/${section}/${path.posix.basename(decoded)}${suffix})`;
      }
      const route = articleMapping[resolved];
      if (route) return `[${label}](${route}${suffix})`;
      const diagram = diagrams.find((item) => resolved === `${diagramDirectory}/${item.source}`);
      if (diagram?.article) return `[${label}](${diagram.article}${suffix})`;
      if (target.startsWith('/docs/') || target.startsWith('/media/')) return match;
      changes.removedUnknownLinks.add(`${source} → ${target}`);
      return label;
    });
  }).join('\n');
}

function frontmatter({ title, description, section, order, source }) {
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\nsection: ${section}\norder: ${order}\nupdated: '${updated}'\nsources:\n  - ${JSON.stringify(source)}\n---\n\n`;
}

function makeOverview(markdown) {
  let body = removeSourceFraming(markdown);
  body = body.replace(/^\*\*推荐打开\[HTML阅读版\]\(index\.html\)\*\*[^。\n]*。\s*/m, '');
  body = body.replace(/也可以打开\[HTML阅读版\]\(index\.html\)[^。\n]*。/g, '');
  body = body.replace(/^\|[^\n]*\]\(11-界面覆盖与维护说明\.md\)[^\n]*\n?/m, '');
  body = body.replace(/截图来源、覆盖范围和重拍步骤见维护说明。/g, '');
  body = body.replace(/^## (?:维护与范围|本手册的范围)\s*\n[\s\S]*$/m, '');
  return body.trim();
}

function auditPublicText(markdown, source) {
  const checks = [
    ['内网或回环地址', /\b(?:10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0)\b|\blocalhost\b/i],
    ['本机用户路径', /\/Users\/|[A-Z]:\\Users\\|\/home\/(?!employee(?:[\s`/]|$))[^\s`/]+/],
    ['个人或单位标识', /bluexiii|telchina|@(?:[a-z0-9-]+\.)+(?:com|cn|net|org)\b/i],
    ['疑似凭据', /\b(?:gh[pousr]_[a-zA-Z0-9]{20,}|github_pat_[a-zA-Z0-9_]{20,}|sk-[a-zA-Z0-9]{20,}|-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----)\b/],
    ['内部源码链接或目录', /\]\([^)]*(?:apps\/|packages\/|docs\/00-|docs\/05-|hive-os\/|\.md(?:[#?][^)]*)?\))/],
  ];
  for (const [name, pattern] of checks) {
    if (pattern.test(markdown)) throw new Error(`公开正文检查未通过：${source}含${name}，请人工核对后调整导入规则。`);
  }
}

const digest = createHash('sha256');
const totals = [];
const generated = [];
const media = new Map();
for (const { source, file } of diagrams) {
  const origin = `${diagramDirectory}/${source}`;
  const target = `/media/diagrams/${file}`;
  const bytes = await readFile(path.join(sourceRoot, origin));
  const publicText = bytes.toString('utf8')
    .replaceAll(`https://www.bluexiii.com/hive${target}`, target)
    .replace(/href="https:\/\/www\.bluexiii\.com\/hive(\/docs\/[a-z0-9/-]+\/)"/g, 'href="$1"');
  auditPublicText(publicText, origin);
  digest.update(`${origin}\n`).update(bytes);
  media.set(target, bytes);
}

// 仅同步经过公开审阅的CLI截图，环境映射和分发包由各团队保管。
for (const file of ['select.png', 'confirm.png', 'result.png']) {
  const origin = `tools/panel-publisher/images/${file}`;
  const bytes = await readFile(path.join(sourceRoot, origin));
  digest.update(`${origin}\n`).update(bytes);
  media.set(`/media/panel-publisher/${file}`, bytes);
}

for (const file of brandAssets) {
  const origin = `${diagramDirectory}/官网素材/${file}`;
  const bytes = await readFile(path.join(sourceRoot, origin));
  if (file.endsWith('.svg')) {
    // 分享封面印有官网地址，只有这个完整的公开文字标签可以通过个人标识检查。
    auditPublicText(bytes.toString('utf8').replace('>www.bluexiii.com/hive</text>', '>蜂巢官网</text>'), origin);
  }
  digest.update(`${origin}\n`).update(bytes);
  media.set(file === 'favicon.svg' ? '/favicon.svg' : `/media/${file}`, bytes);
}

for (const manual of manuals) {
  const contentDirectory = path.join(websiteRoot, 'content', manual.section);
  const assetNames = (await readdir(path.join(sourceRoot, manual.directory, 'assets'))).filter((file) => /\.(?:png|svg)$/i.test(file)).sort();
  for (const asset of assetNames) {
    const from = path.join(sourceRoot, manual.directory, 'assets', asset);
    const bytes = await readFile(from);
    digest.update(`${manual.section}/${asset}\n`).update(bytes);
    if (asset.endsWith('.svg')) auditPublicText(bytes.toString('utf8'), asset);
    media.set(`/media/manuals/${manual.section}/${asset}`, bytes);
  }
  const entries = [
    ['README.md', 'overview', manual.description, 0],
    ...manual.chapters.map(([file, slug, description], index) => [file, slug, description, index + 1]),
  ];
  for (const [file, slug, description, order] of entries) {
    const source = `${manual.directory}/${file}`;
    const original = await readFile(path.join(sourceRoot, source), 'utf8');
    digest.update(`${source}\n`).update(original);
    const title = order === 0 ? manual.title : original.match(/^#\s+(.+)/m)[1].replace(/^\d{2}(?:[.．]\s*|\s+)/u, '').trim();
    let body = order === 0 ? makeOverview(original) : removeSourceFraming(original);
    body = rewriteLinks(body, source, manual.section);
    auditPublicText(body, source);
    const output = frontmatter({ title, description, section: manual.section, order, source }) + body + '\n';
    generated.push({ section: manual.section, source, body, output, file: path.join(contentDirectory, `${slug}.md`) });
  }
  totals.push({ section: manual.section, chapters: manual.chapters.length, images: assetNames.length });
}

// 检查生成正文的每一张配图，避免重写链接成功但漏复制图片。
for (const article of generated) {
  for (const match of article.body.matchAll(/!\[[^\]]*\]\((\/media\/[^)]+)\)/g)) {
    if (!media.has(match[1])) throw new Error(`章节配图缺失：${article.source} → ${match[1]}`);
  }
}

if (process.argv.includes('--check-media')) {
  const publicRoot = path.join(websiteRoot, 'public');
  const published = await readdir(publicRoot, { recursive: true, withFileTypes: true });
  for (const entry of published.filter((entry) => entry.isFile())) {
    const file = '/' + path.relative(publicRoot, path.join(entry.parentPath, entry.name)).split(path.sep).join('/');
    if ((file.startsWith('/media/') || /\.(png|svg|webp|jpe?g|ico|avif)$/i.test(file)) && !media.has(file)) {
      throw new Error(`官网素材没有登记产品docs来源：${file}`);
    }
  }
  for (const [target, sourceBytes] of media) {
    const copy = await readFile(path.join(publicRoot, target));
    if (!sourceBytes.equals(copy)) throw new Error(`官网副本与产品手册不一致：${target}`);
  }
  console.log(`${media.size}份官网素材均与产品docs原件逐字节一致。`);
  process.exit(0);
}

for (const [relative, bytes] of media) {
  const destination = path.join(websiteRoot, 'public', relative);
  await mkdir(path.dirname(destination), { recursive: true });
  await writeFile(destination, bytes);
}
for (const { output, file } of generated) {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, output);
}
for (const { section } of manuals) {
  const relative = `/media/manuals/${section}`;
  const directory = path.join(websiteRoot, 'public', relative);
  for (const file of await readdir(directory)) {
    if (/\.(?:png|svg)$/i.test(file) && !media.has(`${relative}/${file}`)) await unlink(path.join(directory, file));
  }
}
await writeFile(path.join(websiteRoot, 'content/article-mapping.json'), JSON.stringify(articleMapping, null, 2) + '\n');

const diagramRows = diagrams.map(({ source, file }) => `|${source}|[${file}](../public/media/diagrams/${file})|`).join('\n');
const snapshotDigest = digest.digest('hex');
await mkdir(path.join(websiteRoot, 'docs'), { recursive: true });
const maintenancePath = path.join(websiteRoot, 'docs/内容维护.md');
const existingMaintenance = await readFile(maintenancePath, 'utf8');
const maintenanceNotes = existingMaintenance.match(/^## 网站检查命令[\s\S]*$/m)?.[0] ?? '';
await writeFile(maintenancePath, `# 内容维护\n\n本网站公开蜂巢员工工作台、管理员控制台的操作手册、HTML图表及其配套样式。默认来源为相对路径\`../../telchina/hive-os\`的产品仓库，公开站点地址为https://www.bluexiii.com/hive/。\n\n## 当前范围与来源\n\n- 更新日期：${updated}。来源以导入时的产品仓库工作副本为准，不声称对应某个正式版本或已完成生产验收。\n- 员工手册：\`docs/11-手册/04-员工工作台操作手册/\`的第01—10章、经简化的README及${totals.find((item) => item.section === 'employee').images}张PNG/SVG配图。\n- 管理员手册：\`docs/11-手册/03-管理员控制台操作手册/\`的第01—10章、经简化的README及${totals.find((item) => item.section === 'admin').images}张PNG/SVG配图。\n- 两册均生成\`overview.md\`和10个章节，共22篇内容、${totals.reduce((sum, item) => sum + item.images, 0)}张图片。第11章和两册HTML离线阅读版留在来源仓库。\n- 架构图与样式来源于产品仓库的\`${diagramDirectory}/\`。官网原样复制以下文件，嵌入时复用原图正文。\n\n|产品手册原件|官网副本|\n|---|---|\n${diagramRows}\n\nLogo、标签页图标、分享封面的SVG图源与PNG也由同一命令从产品技术手册的“官网素材”目录原样导入。\n\n- 来源快照SHA-256：\`${snapshotDigest}\`。摘要覆盖按固定顺序读取的架构图、样式、Logo、图标、封面、来源Markdown与PNG/SVG原始字节，用于判断来源是否变化，不代表产品发布状态。\n\n## 更新操作\n\n1. 在hive-os先修订HTML原图、正文或配图，并核对产品事实，确认图片仍使用真实Vue页面与隔离合成数据。\n2. 在本网站根目录运行\`node scripts/import-manuals.mjs\`。可设置\`HIVE_MANUAL_SOURCE\`指定产品工作树。脚本只读产品仓库，更新已生成的文章和配图，清理两册图目录中已从来源移除的旧图。\n3. 检查\`content/employee/\`、\`content/admin/\`、\`public/media/manuals/\`和\`public/media/diagrams/\`的差异。运行\`npm run import:manuals -- --check-media\`核对架构图、样式、截图、Logo、图标与封面是否均与产品docs逐字节一致。原图和正文修订应回到来源手册；生成文件中的手工修改会在再次导入时覆盖。\n4. 运行\`npm run check\`，并在浏览器核对桌面与手机阅读、搜索、目录、跨章链接、图片放大和独立架构图。导入脚本的成功不能代替这些站点检查。\n5. 由负责人按本仓库发布流程处理提交和上线，保留检查结果。\n\n## 路由和内容处理\n\n- 各章的英文slug在导入脚本中明确指定。修改中文标题或源文件名时，保留原slug；不要根据标题自动重建公开URL。\n- \`content/article-mapping.json\`的键为hive-os仓库相对来源路径，值为\`/docs/{employee|admin}/{slug}/\`，不带网站基础路径\`/hive\`。README映射到对应的\`overview/\`。\n- frontmatter保存标题、摘要、所属手册、顺序、更新日期和来源路径。正文移除原一级标题、顶部治理元数据、内部源码核对依据和旧版前后章页脚，由网站统一提供导航。\n- 已知章节Markdown链接按完整来源映射改写，未知内部链接只保留可读标签，不生成通往私有源码或内部文档的地址。图片改写为\`/media/manuals/{employee|admin}/文件名\`；网站渲染时统一补\`/hive\`。不递归复制链接目标。\n- overview保留用途、十章目录、阅读建议、图片说明和适用边界，删除原离线HTML操作、内部维护步骤及内部文档入口。\n\n## 公开内容检查与图片边界\n\n本次导入检查了生成正文、HTML架构图、配套样式和SVG文本中的内网或回环IP、本机用户路径、个人及单位标识、常见凭据格式和内部源码链接；没有发现需要公开化替换的真实身份、地址或凭据。保留\`~\`和\`/shared/<目录ID>/\`等产品内工作目录；保留明确用于教学的example.invalid和api.example.com示例地址。\n\nPNG原图逐字节复制，导入脚本不做OCR，也不以文本扫描声称重新审查了图片中的每个字段。图片沿用来源手册制作与视觉复核时的合成数据范围：不包含真实业务记录、密码、二维码、绑定码或机器人凭据；截图中的成功、费用与时间只解释界面，不证明真实操作已完成。后续更新配图时仍须人工查看原图。\n\n本次共移除${changes.metadataRemoved}处顶部治理元数据和${changes.evidenceSectionsRemoved}节源码核对依据；未知内部链接处理${changes.removedUnknownLinks.size}处。导入范围见本页的正文、架构图和配图清单。\n\n${maintenanceNotes}`);

console.log(JSON.stringify({ articles: generated.length, manuals: totals, unknownInternalLinksRemoved: changes.removedUnknownLinks.size, snapshotDigest }, null, 2));
