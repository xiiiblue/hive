---
title: 用HiveBridge发布面板、Skill和知识库文档
description: HiveBridge 1.0的Windows和Mac图文指南，包含跨环境批量发布、Skill草稿、知识库文档替换和旧配置用法。
section: developers
order: 75
updated: '2026-11-24'
sources:
  - tools/panel-publisher/README.md
  - tools/hivebridge/README.md
  - tools/hivebridge/publisher/cli.go
  - docs/02-设计/02-能力设计/CAP-034-业务面板发布工具.md
---

# 用HiveBridge发布面板、Skill和知识库文档

HiveBridge 1.0（蜂桥）是蜂巢的桌面资源发布工具。在自己的电脑上选择目标环境，就能批量发布业务面板、保存或发布企业Skill，以及更新知识库文档。向团队维护者领取分发包及环境配置。图中所有环境、资源和版本都是教学示例。

## 打开桌面版

完整解压收到的压缩包，把随包配置`hivebridge.json`留在程序旁边。

|电脑|压缩包|解压后双击|
|---|---|---|
|Windows x64|`hivebridge-1.0-windows.zip`|`hivebridge.exe`|
|Mac（Apple Silicon或Intel）|`hivebridge-1.0-macos.zip`|`HiveBridge.app`|

从旧桌面版升级时，可以点左下角“打开配置文件”选择原来的`hive-panel.json`。启动时优先读取程序旁的`hivebridge.json`，缺失时读取同目录的旧文件名。已经选过的业务源码根目录会保留。Windows使用系统的Microsoft Edge WebView2运行时。

## 批量发布业务面板

1. 在左侧选“业务面板”。首次使用，点“选择文件夹”选业务仓库的根目录。打包会包含当前磁盘上尚未提交的改动。
2. 搜索面板名或资源键。勾一个格子，就选定一个面板和一个环境。勾列头只选择当前筛选结果中可发布的项。底栏始终显示整批数量。待配目录的面板可点“选择上传目录”，选择并校验仓库内的子目录。
3. 点“本地打包预览”可在登录前查文件。准备发布时，点“检查发布目标”，分别登录各环境。

![桌面工作台逐格选择运行概览和工单列表](/media/panel-publisher/desktop-selection.png)

确认窗口会列出每个目标的环境、实际资源键、源码目录和版本。下图里同一份“运行概览”在两个环境使用不同资源键。核对后点“确认发布”，逐项查看回执。“待核对”需要先去对应管理台查正式版本及草稿。返回重查可以重新打包修改过的源码。

![确认窗口列出三个就绪目标与各自版本](/media/panel-publisher/desktop-confirm.png)

## 上传企业Skill

在“企业Skill”中选`SKILL.md`（文件名区分大小写，上限2 MiB）或技能ZIP包（上限15 MiB），登录目标环境后点“检查文件与目标”。新建时选适用的业务系统、核对显示名称和示例提问。同标识的已有Skill会按当前修订更新，有待发布草稿时先到管理台核对。默认只保存草稿，也可选择“保存后立即发布”。发布结果会显示读回的正式版本。

![企业Skill默认保存草稿，新建前可核对适用范围](/media/panel-publisher/desktop-skill.png)

## 上传知识库文档

在“知识库文档”中选Markdown、DOCX或可提取文字的PDF（最大10 MiB），登录后选择这个环境中的知识库。库里已有同名文档时，核对修订号后点“确认替换同名文档”。“可检索”表示服务端已完成该版本的处理。“处理中”或“处理失败”时可到管理台查看对应文档。

![知识库同名文档的目标与替换提示](/media/panel-publisher/desktop-knowledge.png)

## 使用原有的hive-panel命令行工具

同一套业务代码要更新到两套蜂巢时，开发人员可以只选一次本地面板，由`hive-panel`打一次包，再分别上传、发布并核对版本。下面用“运行概览”和“工单列表”走一遍。三张图来自真实CLI连接本机演示服务的一次操作，环境、地址和版本号均为教学示例。

### 解压后从哪里开始

从团队的蜂巢维护者处领取对应系统的压缩包和已经配好的`hive-panel.json`，完整解压。把配置文件留在程序旁边。准备好业务面板的本地源码、目标管理台地址和本人在相应环境的管理员账号。

|电脑|启动方法|
|---|---|
|Windows x64|解压`hive-panel-windows.zip`，双击`hive-panel.exe`。|
|Mac（Apple Silicon或Intel）|解压`hive-panel-macos.zip`，在解压目录打开终端，运行`./hive-panel`。|

开发电脑无需安装Go或Node.js。工具读取当前磁盘上的文件，包括尚未提交到Git的修改。

### 第一步：选环境，再选面板

菜单先问“选择蜂巢环境”，再列出这些环境可用的面板。每次输入编号后按回车。可以输入`1`选一项、`1,3`选多项、`*`全选当前列表，或输入`q`退出。面板名右侧列出它在哪些环境里有配置。

![中文菜单中运行概览对应dev和test，工单列表仅对应dev](/media/panel-publisher/select.png)

图中两次都选了`*`。虽然选了两个环境和两个面板，最终只有**三个发布目标**。最后一行“跳过：test / tickets 未配置”表示工单列表没有绑定到测试环境，可以继续处理另外三项。

### 第二步：登录，看清每一份代码发到哪里

首次运行时，输入业务仓库在这台电脑上的根目录。比如配置中写着`panels/overview`，就选择能直接看到`panels`的那一层。工具记住的是这台电脑的路径。然后按提示登录每个目标环境的管理台，密码输入时没有回显，输完按回车。

![发布前显示三个就绪目标，同一源目录在两个环境中分别指向overview-dev和overview-test](/media/panel-publisher/confirm.png)

从左到右读第一行：环境是`dev`，本地源目录是`panels/overview`，要更新的资源是`ops/overview-dev`，**发布前**的版本是v4。第三行来自同一个本地目录，但在`test`对应`ops/overview-test`。确认环境、目标标识和项数都正确，再输入`y`并回车。需要调整时直接回车即可取消。

### 第三步：按行核对生效版本

![发布后，三个目标分别显示已发布、正式版本和员工打开链接](/media/panel-publisher/result.png)

“已发布”表示工具读回了本次生效的正式版本。示例中的运行概览在`dev`从v4更新到v5，在`test`从v7更新到v8。复制对应行的链接，使用有面板访问权限的员工身份打开页面，检查刚改的内容。Windows双击启动的窗口会保留结果。

|遇到的情况|接下来怎么做|
|---|---|
|有待发布草稿|先到该环境管理台查看草稿，与编辑人确认如何处理。工具会跳过这一项。|
|仅保存草稿|按提示的草稿编号核对内容，再决定是否在管理台发布。|
|待核对或超时|先查看该面板的正式版本和草稿记录。确认哪些项还需要处理，再单独选择它们重试。|
|面板缺失或停用|请维护者核对所选环境的系统键、面板键和启用状态。中文名相同的面板也可能是不同资源。|

### 只想预演或只发一个环境

在PowerShell中进入解压目录后，可以直接运行下列命令。Mac将开头的`.\hive-panel.exe`换成`./hive-panel`。示例别名取自上图，实际操作请使用团队配置中的别名。

```powershell
# 只在本地打包并列出目标
.\hive-panel.exe plan --env dev,test --panel overview,tickets

# 登录test，只核对面板、当前版本和草稿
.\hive-panel.exe check --env test --panel overview

# 只向dev发布两个面板
.\hive-panel.exe publish --env dev --panel overview,tickets
```

## 如何配置不同环境的面板标识

HiveBridge使用`hivebridge.json`，旧CLI使用`hive-panel.json`。两者格式相同。在`panels`里登记面板的别名、中文名和本地目录，在每个环境的`bindings`里填这个环境实际使用的“系统键/面板键”。可从员工端面板地址`/panels/系统键/面板键`核对这两个值。下面这份配置对应三张图里的三个目标：

```json
{
  "panels": {
    "overview": {"name": "运行概览", "source": "panels/overview"},
    "tickets": {"name": "工单列表", "source": "panels/tickets"}
  },
  "environments": {
    "dev": {"url": "http://dev.example.invalid", "bindings": {
      "overview": "ops/overview-dev", "tickets": "ops/tickets"
    }},
    "test": {"url": "http://test.example.invalid", "bindings": {
      "overview": "ops/overview-test"
    }}
  }
}
```

把示例域名换成团队的蜂巢入口，在各环境中先建立目标资源，再运行`check`核对绑定。公共配置只保存地址和映射，管理员密码在登录时输入。关于入口HTML、`PANEL.md`和`api.json`的要求，见[开发业务面板](/docs/developers/panels/)。
