# 蜂巢网站

蜂巢的产品展示与公开文档网站，目标地址为[www.bluexiii.com/hive](https://www.bluexiii.com/hive/)。源码独立于蜂巢产品，放在`code/public/hive-website/`，与博客和ACDL网站并列；GitHub仓库为[xiiiblue/hive](https://github.com/xiiiblue/hive)。

网站采用暖白、墨色和琥珀色的编辑式布局，首页以产品概念、真实界面和架构图解释蜂巢，文档页提供章节导航、本页目录、全文搜索、图片放大、打印及明暗主题。页面静态生成，阅读不依赖蜂巢后端或外部模型服务。

## 当前内容

|区域|内容|
|---|---|
|产品|认识蜂巢、员工数字分身、日常场景、首次使用，共4篇|
|架构|总体结构、任务生命周期、工作空间、模型网关、安全边界，共5篇|
|操作手册|员工与管理员各一册导读及10章，保留133张界面和概念配图|
|开发对接|快速开始、开放API、异步任务、统一身份、Skill、MCP、业务面板和排查，共8篇|
|交流与实践|设计取舍、工单教学例子与ACDL，共3篇|

首期共42篇文档、50个静态页面。操作图片使用真实Vue界面与合成数据；开放接口示例使用不可用域名与环境变量，不包含真实业务凭据或内部联调地址。产品仍按单企业内网、单节点与受控验证范围介绍，不宣称生产就绪。

## 本地运行

使用`.nvmrc`中的Node.js版本及npm，在网站目录执行：

```bash
npm ci
npm run dev
```

开发入口为`http://127.0.0.1:4327/hive/`。生成和检查：

```bash
npm run check
npm run preview -- --port 4328
```

构建输出在`dist/`。`npm run check`执行Astro类型检查、静态构建及6组站点测试，核对所有站内链接、图片、锚点、规范URL、章节导航、完整正文搜索索引和公开内容中的敏感信息形状。依赖检查使用`npm audit --omit=dev --registry=https://registry.npmjs.org`。

浏览器检查方法见[内容维护](docs/内容维护.md)。本地截图、失败日志和检查记录保存在`.verification/`，不进入Git。静态检查不代替浏览器或真实业务联调。

## 增补内容

- `content/`保存Markdown正文。新增文章会自动生成稳定的`/docs/{目录}/{文件名}/`路径，并进入文档目录、全文搜索、站点地图与前后篇导航。
- `src/pages/`保存产品展示页面，`src/components/`保存导航、概念图、架构图和阅读组件，`src/styles/global.css`定义通用样式，`src/styles/home.css`定义首页构图。新版视觉约定见[视觉设计](docs/视觉设计.md)。
- `public/media/`保存公开配图。原图与文案需要一起核对，不能仅靠文字扫描判定图片无敏感内容。
- `scripts/import-manuals.mjs`只读`../../telchina/hive-os`的两册手册，导入公开使用章节并改写链接；不自动镜像其它内部资料。运行`npm run import:manuals`前先核对来源。

新文章使用以下前置信息，正文从段落或二级标题开始：

```yaml
---
title: 文章标题
description: 说明文章为读者解决什么问题。
section: product
order: 50
updated: '2026-10-16'
sources:
  - docs/对应的来源材料.md
---
```

`section`使用`product`、`architecture`、`employee`、`admin`、`developers`或`insights`，与目录一致。`order`决定同组阅读顺序，预留数字间隔便于插入。站内正文链接使用`/docs/architecture/overview/`这种不带`/hive`的路径，渲染时统一加前缀；图片使用`/media/...`。已经公开的文件名即URL，不随标题改名而变化。

更多来源、公开化处理与更新规则见[内容维护](docs/内容维护.md)。

## GitHub Pages

`.github/workflows/pages.yml`在`main`推送后安装锁定依赖、检查并上传`dist/`，再发布GitHub Pages。仓库Pages来源使用GitHub Actions。

项目路径固定为`/hive`，继承账号用户站点的`www.bluexiii.com`域名，无需单独CNAME，不修改博客和ACDL仓库。后续迁移域名时，同时修改`astro.config.mjs`、`src/lib/content.ts`中的基础路径、规范URL、分享图地址、`public/robots.txt`与测试中的站点身份，再核对全部站内链接。

这项配置遵循[GitHub项目站点继承用户域名](https://docs.github.com/zh/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages)和[Astro的GitHub Pages发布说明](https://docs.astro.build/en/guides/deploy/github/)。发布结果与实际检查记录在[建设与上线记录](docs/建设与上线记录.md)。
