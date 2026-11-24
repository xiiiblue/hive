---
title: 用HiveBridge发布面板、Skill和知识库文档
description: HiveBridge（HiveOS开发者工具）的Windows和Mac图文指南，涵盖前置登录加密存储、多环境切换排序、业务面板远端同步与发布、企业Skill目录自动打包上传及知识库文档批量管理。
section: developers
order: 75
updated: '2026-11-24'
sources:
  - hive-bridge/README.md
  - docs/02-设计/02-能力设计/CAP-034-业务面板发布工具.md
---

# 用HiveBridge发布面板、Skill和知识库文档

HiveBridge（蜂桥）是面向HiveOS的跨平台原生桌面开发者工具，支持Windows与Mac，基于Wails、Go和Vue 3构建，已作为独立开源项目发布在[GitHub：xiiiblue/hive-bridge](https://github.com/xiiiblue/hive-bridge)。

在自己的电脑上打开HiveBridge，就能在一个原生桌面窗口中完成多环境下的**业务面板发布**、**企业Skill双向管理（含选目录自动打包）**以及**知识库文档批量管理**，无需安装Go或Node.js，也不用手工打ZIP包或反复登录管理台。文中所有环境、资源和版本截图均来自合成教学数据。

## 下载与启动

从[HiveBridge Releases页面](https://github.com/xiiiblue/hive-bridge/releases)下载对应系统的压缩包并完整解压，无需配置运行环境，双击即可启动。

|电脑|压缩包|解压后双击|
|---|---|---|
|Mac（Apple Silicon或Intel通用）|`hive-bridge-1.0-macos.zip`|`HiveBridge.app`（可拖入“应用程序”目录）|
|Windows x64|`hive-bridge-1.0-windows.zip`|`hivebridge.exe`（使用系统自带Microsoft Edge WebView2）|

## 前置登录与本地加密凭据

首次打开且尚未登录任何环境时，应用会先展示**前置登录引导页**。可以直接点击「添加新环境」填写名称、服务地址与管理员账号密码，也可以点击「导入配置」载入团队分发的`hivebridge.json`。

![HiveBridge首次启动前置登录引导页](/media/hive-bridge/desktop-onboarding.png)

管理员账号和密码校验通过后，会通过**AES-256-GCM**加密保存在当前用户的应用配置目录中（文件权限`0600`），重启应用或切换环境都无需重复输入。每次校验或发布结束后，工具会自动注销短期会话，不在服务端残留长期会话。

## 多环境切换与自定义排序

进入工作区后，左侧上方切换资源类型，左侧下方为**独立可滚动的环境切换列表**（适配4至10套以上环境）。单击任意环境即可切换右侧工作上下文；未登录项旁可直接点「登录」，已登录项悬停可打开账号与环境设置。

点击「环境」标题栏右侧的管理图标进入**环境管理**视图，支持按登录状态筛选、搜索、通过上移/下移按钮自定义环境排序、编辑名称与地址、开启「发布前显示强确认提示」（建议用于客户现场或生产环境）、退出登录、删除环境，以及一键在浏览器打开对应管理台。

![多环境管理与自定义排序视图](/media/hive-bridge/desktop-environments.png)

## 业务面板同步与发布

切到左侧「业务面板」，表格聚焦展示当前选中环境的面板清单、本地上传目录、目标资源键与就绪状态，支持快捷键搜索（`⌘F`/`Ctrl+F`）和按目录状态筛选。

- **同步远端与配置目标资源键**：点击顶部「同步远端」，可从当前已登录环境自动拉取启用的业务面板及目标资源键；点击顶部「添加面板」或直接点击表格中的目标资源键，可下拉选择远端面板、手工修改，或勾选「同时应用到全部环境」一次配齐。
- **自由选择本机目录**：每个面板的上传目录既支持相对路径（位于顶部可选的「默认源码根目录」内，方便导出配置与团队共享），也支持选择本机**任意绝对路径**（散落在不同仓库或独立目录的面板可直接绑定并打包，无需凑到同一个根目录）。
- **离线预览与核对发布**：点击「本地打包预览」会在内存中执行脱敏打包（自动剥离成对标注的本地测试脚本与弹窗调试身份，拒绝软链接和隐藏文件）；点击「检查发布目标」会复用已记住的加密凭据核对线上版本与草稿状态。

![业务面板单环境发布列表](/media/hive-bridge/desktop-selection.png)

确认窗口会列出本次待发布目标的环境、资源键、源码目录、包体大小与线上版本（开启强确认保护的环境会额外显示醒目提示）。核对无误后点「确认发布」并逐项查看回执；若出现“待核对”，请先在对应管理台核对正式版本与草稿记录，切勿盲目重复上传。

![核对发布目标弹窗](/media/hive-bridge/desktop-confirm.png)

## 企业Skill双向管理与目录自动打包

切到左侧「企业Skill」，可直接查看当前环境下的Skill清单、正式版、待发布草稿与历史版本。顶部标签分为**有效 / 草稿 / 停用 / 全部**，默认只展示「有效」项，避免已停用的历史测试技能干扰视线。

- **查看与下载**：选中任意Skill可查看适用业务系统、示例提问、技能说明和版本记录，支持一键**下载原包**（ZIP或`SKILL.md`）到本地修改。
- **选目录自动打包上传**：点击顶部「上传目录」或详情区「目录更新」，直接选中包含`SKILL.md`的本地目录，工具会自动跳过`.DS_Store`、`Thumbs.db`、`__MACOSX`和`.git`，拒绝符号链接及`.env`等敏感隐藏文件，保留脚本可执行权限并在内存中安全打成ZIP包（上限15 MiB）进入核对。
- **单文件与拖放上传**：点击「上传文件」或直接将整个Skill文件夹、`SKILL.md`（上限2 MiB）或ZIP包（上限15 MiB）拖入窗口即可自动识别技能标识，区分新建或更新，支持仅保存草稿或保存后立即发布。
- **草稿发布与维护**：支持一键发布草稿、编辑显示名称/适用业务系统/示例提问，以及启用或停用Skill。

![企业Skill双向管理与目录自动打包上传](/media/hive-bridge/desktop-skill.png)

## 知识库与文档双栏管理

切到左侧「知识库文档」，左栏展示当前环境的全部知识库，右栏展示所选知识库下的文档清单、大小、修订号及处理状态（`可检索`、`处理中`、`处理失败`）。

- **知识库维护**：支持新建、编辑知识库以及删除空知识库。
- **多选与拖放批量上传**：点击「上传文档」多选文件，或直接将多个Markdown、DOCX或可提取文字的PDF（单文件上限10 MiB）拖入右侧区域；上传前会先汇总标出「新增文档」与「替换同名文档（含当前修订号）」，确认后批量提交。
- **原件下载与失败重试**：支持下载文档原件、对解析失败文档一键重试，以及删除文档。

![知识库双栏文档管理与批量上传](/media/hive-bridge/desktop-knowledge.png)

## 配置托管、导入与导出

普通用户完全可以通过界面完成环境与面板配置，无需手工编辑JSON。点击左侧底部「导入配置」可载入团队分发的`hivebridge.json`，「导出配置」可将当前环境和面板映射导出分享给团队（导出的配置文件**不包含任何账号或密码**）。

配置文件托管在本机用户目录中，不要求程序目录可写：macOS位于`~/Library/Application Support/hive-panel/`，Windows位于`%AppData%\hive-panel\`。示例配置格式如下（详见开源仓库的`hivebridge.example.json`）：

```json
{
  "panels": {
    "overview": {
      "name": "运行概览",
      "source": "panels/overview"
    },
    "tickets": {
      "name": "工单列表",
      "source": "panels/tickets"
    }
  },
  "environments": {
    "开发环境": {
      "url": "https://dev.hive.example.com",
      "order": 1,
      "bindings": {
        "overview": "ops/overview-dev",
        "tickets": "ops/tickets"
      }
    },
    "生产环境": {
      "url": "https://prod.hive.example.com",
      "tag": "prod",
      "order": 2,
      "bindings": {
        "overview": "ops/overview"
      }
    }
  }
}
```

关于业务面板入口HTML、`PANEL.md`和`api.json`的规范要求，见[开发业务面板](/docs/developers/panels/)。
