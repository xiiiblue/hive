# 蜂巢网站维护约定

- 本仓库是蜂巢公开网站的独立源码，目标地址为https://www.bluexiii.com/hive/，GitHub仓库为xiiiblue/hive。
- 蜂巢产品源码位于同级hive-os。默认只读，不修改、提交或部署产品仓库。
- 使用Astro静态生成、npm及package-lock.json。Node版本见.nvmrc；不混用其它锁文件。
- 正文放content/，一篇Markdown生成一个稳定/docs/路径。前置信息至少有title、description、section、order、updated、sources。
- 面向公开读者整理内容，不整库镜像内部文档，不包含真实地址、凭据、员工资料、部署记录或测试销毁步骤。保留当前产品适用限制，不把演示、设计和生产验收混为一谈。
- 操作手册图片使用真实Vue组件与合成数据，不表示真实业务已经执行。更新来源和范围记录在docs/内容维护.md。
- 中文与英文之间不加空格，保留品牌和代码原名。使用普通中文说明功能和限制。
- 修改前检查分支与差异，明确列路径暂存，保护无关工作，不强推或改写共享历史。
- 检查入口：npm run check。它完成类型检查、构建、链接/图片/敏感内容与静态站点测试。界面变化还需浏览器检查桌面、手机、搜索、目录和图片放大。
- dist/、node_modules/、.astro/及.verification/是生成或本地检查资料，不提交。
- main推送经GitHub Actions检查后发布Pages。项目继承账号的www.bluexiii.com域名，不另设CNAME，不修改博客与ACDL仓库。
