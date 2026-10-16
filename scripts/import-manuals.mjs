#!/usr/bin/env node
import { copyFile, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const websiteRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = path.resolve(websiteRoot, '../hive-os');
const updated = '2026-10-16';

// 路由是公开链接的一部分。改标题或源文件名时保留已有slug。
const manuals = [
  {
    section: 'employee',
    directory: 'docs/11-手册/04-员工工作台操作手册',
    title: '员工工作台操作手册',
    description: '从第一次登录到对话、技能、业务面板和工作资料管理，了解员工工作台的用途和操作。',
    chapters: [
      ['01-入门与工作台导航.md', '01-start', '认识蜂巢、准备账号、完成首次登录，并找到业务范围和常用功能。'],
      ['02-发起与完成对话.md', '02-conversations', '选择智能体、模型、资料和工具，提出任务，检查执行过程与结果，并处理取消和失败。'],
      ['03-会话管理与自动化.md', '03-automation', '查找和整理会话，管理分组与归档，让重复工作定时执行，并查看和取消任务。'],
      ['04-技能广场与技能管理.md', '04-skills', '理解不同来源的技能，试用、安装和管理技能，把已经验证的方法整理后共享给同事。'],
      ['05-业务系统工具与消息渠道.md', '05-systems-and-channels', '使用已分配的业务系统与MCP工具，连接企业微信、微信或Telegram，并核对消息渠道是否可用。'],
      ['06-业务面板.md', '06-panels', '打开和整理业务面板，建立个人副本，通过聊天修改、预览和诊断，并管理历史版本。'],
      ['07-工作空间文件与终端.md', '07-workspace', '区分持久文件和运行环境，查看资源，管理工作文件，并在理解影响后使用终端。'],
      ['08-备份导出与个人用量.md', '08-backups-and-usage', '查看恢复点、导出个人资产，了解哪些恢复操作需要管理员，并核对个人模型用量。'],
      ['09-个人设置记忆与规范.md', '09-settings-and-memory', '维护账号密码和使用偏好，整理个人记忆，并了解企业工作规范怎样影响任务。'],
      ['10-按场景完成工作与排查问题.md', '10-workflows-and-troubleshooting', '按首次工作、周报、技能复用、自动化和交接场景操作，遇到问题时按事实定位和求助。'],
    ],
  },
  {
    section: 'admin',
    directory: 'docs/11-手册/03-管理员控制台操作手册',
    title: '管理员控制台操作手册',
    description: '从人员与能力配置到模型、任务和恢复管理，理解控制台各项功能的用途、步骤和影响。',
    chapters: [
      ['01-入门与控制台导航.md', '01-start', '从实际工作认识人员、能力、执行与记录，登录管理员控制台并找到常用管理入口。'],
      ['02-组织与人员.md', '02-people', '区分员工与管理员身份，创建和维护账号、调整部门，并处理停用、改密和登录失效。'],
      ['03-员工能力与工作规范.md', '03-capabilities-and-rules', '为员工分配业务系统、技能、面板和工具，配置工作规范，并判断保存与生效的区别。'],
      ['04-业务系统与企业资源.md', '04-systems-and-resources', '登记业务系统，维护企业Skill和业务面板，理解资源发布、系统资格和人员分配。'],
      ['05-Skill市场与MCP.md', '05-skills-and-mcp', '管理员工共享的Skill版本，理解下架和紧急禁用，并配置和测试MCP远程工具。'],
      ['06-执行引擎模型与费用.md', '06-models-and-costs', '配置执行引擎与模型服务，测试模型，查看调用、费用和预算，并设置任务并行度与时限。'],
      ['07-统一身份与开放API.md', '07-identity-and-api', '区分统一身份与开放API的对接方向，配置客户端与Key，并核对任务调用结果。'],
      ['08-任务与工作空间.md', '08-tasks-and-workspaces', '查询和取消员工任务，了解排队与运行环境，查看容量并调整工作空间资源配额。'],
      ['09-平台运行备份与排查.md', '09-operations-and-recovery', '巡检运营事件和平台状态，管理备份、恢复和导出，并通过审计记录追溯操作。'],
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
      if (target.startsWith('/docs/') || target.startsWith('/media/')) return match;
      changes.removedUnknownLinks.add(`${source} → ${target}`);
      return label;
    });
  }).join('\n');
}

function frontmatter({ title, description, section, order, source }) {
  return `---\ntitle: ${JSON.stringify(title)}\ndescription: ${JSON.stringify(description)}\nsection: ${section}\norder: ${order}\nupdated: '${updated}'\nsources:\n  - ${JSON.stringify(source)}\n---\n\n`;
}

function makeOverview(markdown, manual, imageCount) {
  let body = removeSourceFraming(markdown);
  body = body.replace(/^\*\*推荐打开[^\n]+\n?/m, '');
  body = body.replace(/^全册共11章[^\n]+\n?/m, `本册含10个操作章节和${imageCount}张配图。每章先解释用途，再说明操作、结果和常见问题。\n`);
  body = body.replace(/^\|\[11[^\n]+\n?/m, '');
  body = body.replace(/^## (?:维护与范围|本手册的范围)\s*\n[\s\S]*$/m, '');
  const applicability = `本手册根据${updated}核对的产品界面和接口整理，说明功能的用途、操作、结果判断与影响，不代表任何实际部署或外部业务连接已经完成验收。`;
  const scope = manual.section === 'employee'
    ? '本册说明员工可见的功能。账号创建、业务能力分配、模型接入、预算设置及管理员恢复操作见[管理员控制台操作手册](/docs/admin/overview/)。本册不提供宿主机安装、正式发布和全平台灾难恢复的操作说明。'
    : '本册说明控制台可见功能，不提供宿主机安装、正式发布、全平台灾难恢复或业务系统接口开发的操作说明。员工端的完整使用流程见[员工工作台操作手册](/docs/employee/overview/)。';
  return `${applicability}\n\n${body.trim()}\n\n## 本手册的范围\n\n${scope}`;
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
for (const manual of manuals) {
  const contentDirectory = path.join(websiteRoot, 'content', manual.section);
  const mediaDirectory = path.join(websiteRoot, 'public/media/manuals', manual.section);
  await mkdir(contentDirectory, { recursive: true });
  await mkdir(mediaDirectory, { recursive: true });
  const assetNames = (await readdir(path.join(sourceRoot, manual.directory, 'assets'))).filter((file) => /\.(?:png|svg)$/i.test(file)).sort();
  for (const asset of assetNames) {
    const from = path.join(sourceRoot, manual.directory, 'assets', asset);
    const bytes = await readFile(from);
    digest.update(`${manual.section}/${asset}\n`).update(bytes);
    if (asset.endsWith('.svg')) auditPublicText(bytes.toString('utf8'), asset);
    await copyFile(from, path.join(mediaDirectory, asset));
  }
  const entries = [
    ['README.md', 'overview', manual.description, 0],
    ...manual.chapters.map(([file, slug, description], index) => [file, slug, description, index + 1]),
  ];
  for (const [file, slug, description, order] of entries) {
    const source = `${manual.directory}/${file}`;
    const original = await readFile(path.join(sourceRoot, source), 'utf8');
    digest.update(`${source}\n`).update(original);
    const title = order === 0 ? manual.title : original.match(/^#\s+(.+)/m)[1].replace(/^\d{2}[\s　]+/u, '').trim();
    let body = order === 0 ? makeOverview(original, manual, assetNames.length) : removeSourceFraming(original);
    body = rewriteLinks(body, source, manual.section);
    auditPublicText(body, source);
    const output = frontmatter({ title, description, section: manual.section, order, source }) + body + '\n';
    await writeFile(path.join(contentDirectory, `${slug}.md`), output);
    generated.push({ section: manual.section, slug, source, body });
  }
  totals.push({ section: manual.section, chapters: manual.chapters.length, images: assetNames.length });
}

// 检查生成正文的每一张配图，避免重写链接成功但漏复制图片。
for (const article of generated) {
  for (const match of article.body.matchAll(/!\[[^\]]*\]\((\/media\/[^)]+)\)/g)) {
    await readFile(path.join(websiteRoot, 'public', match[1]));
  }
}
await writeFile(path.join(websiteRoot, 'content/article-mapping.json'), JSON.stringify(articleMapping, null, 2) + '\n');

const snapshotDigest = digest.digest('hex');
await mkdir(path.join(websiteRoot, 'docs'), { recursive: true });
await writeFile(path.join(websiteRoot, 'docs/内容维护.md'), `# 内容维护\n\n本网站公开蜂巢员工工作台和管理员控制台的操作手册。正文来源为同级产品仓库hive-os中的两册手册，公开站点地址为https://www.bluexiii.com/hive/。\n\n## 当前范围与来源\n\n- 更新日期：${updated}。来源以导入时的产品仓库工作副本为准，不声称对应某个正式版本或已完成生产验收。\n- 员工手册：\`docs/11-手册/04-员工工作台操作手册/\`的第01—10章、经简化的README及${totals.find((item) => item.section === 'employee').images}张PNG/SVG配图。\n- 管理员手册：\`docs/11-手册/03-管理员控制台操作手册/\`的第01—10章、经简化的README及${totals.find((item) => item.section === 'admin').images}张PNG/SVG配图。\n- 两册均生成\`overview.md\`和10个章节，共22篇内容、${totals.reduce((sum, item) => sum + item.images, 0)}张图片。第11章维护说明、源工具、截图清单、HTML离线阅读版和其它内部文档没有导入。\n- 来源快照SHA-256：\`${snapshotDigest}\`。摘要覆盖按固定顺序读取的来源Markdown与PNG/SVG原始字节，用于判断来源是否变化，不代表产品发布状态。\n\n## 更新操作\n\n1. 在hive-os完成正文和配图的产品事实核对，确认图片仍使用真实Vue页面与隔离合成数据。\n2. 在本网站根目录运行\`node scripts/import-manuals.mjs\`。脚本只读同级hive-os，覆盖本网站的已生成内容和配图，不调用业务接口。\n3. 检查\`content/employee/\`、\`content/admin/\`和\`public/media/manuals/\`的差异。正文修订应回到来源手册；生成文件中的手工修改会在再次导入时覆盖。\n4. 运行\`npm run check\`，并在浏览器核对桌面与手机阅读、搜索、目录、跨章链接、图片放大及暗色主题。导入脚本的成功不能代替这些站点检查。\n5. 由负责人按本仓库发布流程处理提交和上线，保留检查结果。\n\n## 路由和内容处理\n\n- 各章的英文slug在导入脚本中明确指定。修改中文标题或源文件名时，保留原slug；不要根据标题自动重建公开URL。\n- \`content/article-mapping.json\`的键为hive-os仓库相对来源路径，值为\`/docs/{employee|admin}/{slug}/\`，不带网站基础路径\`/hive\`。README映射到对应的\`overview/\`。\n- frontmatter保存标题、摘要、所属手册、顺序、更新日期和来源路径。正文移除原一级标题、顶部治理元数据、内部源码核对依据和旧版前后章页脚，由网站统一提供导航。\n- 已知章节Markdown链接按完整来源映射改写，未知内部链接只保留可读标签，不生成通往私有源码或内部文档的地址。图片改写为\`/media/manuals/{employee|admin}/文件名\`；网站渲染时统一补\`/hive\`。不递归复制链接目标。\n- overview保留用途、十章目录、阅读建议、图片说明和适用边界，删除原离线HTML操作、内部维护步骤及内部文档入口。\n\n## 公开内容检查与图片边界\n\n本次导入检查了生成正文和SVG文本中的内网或回环IP、本机用户路径、个人及单位标识、常见凭据格式和内部源码链接；没有发现需要公开化替换的真实身份、地址或凭据。保留\`/workspace\`、\`/home/employee\`等产品内工作目录，它们是操作概念，不是维护者本机路径；保留明确用于教学的example.invalid和api.example.com示例地址。\n\nPNG原图逐字节复制，导入脚本不做OCR，也不以文本扫描声称重新审查了图片中的每个字段。图片沿用来源手册制作与视觉复核时的合成数据范围：不包含真实业务记录、密码、二维码、绑定码或机器人凭据；截图中的成功、费用与时间只解释界面，不证明真实操作已完成。后续更新配图时仍须人工查看原图。\n\n本次共移除${changes.metadataRemoved}处顶部治理元数据和${changes.evidenceSectionsRemoved}节源码核对依据；未知内部链接处理${changes.removedUnknownLinks.size}处。公开站不引入来源仓库的部署记录、测试销毁步骤和其它内部文档。\n`);

console.log(JSON.stringify({ articles: generated.length, manuals: totals, unknownInternalLinksRemoved: changes.removedUnknownLinks.size, snapshotDigest }, null, 2));
