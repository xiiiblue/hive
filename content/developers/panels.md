---
title: 开发业务面板
description: 用HTML或ZIP交付业务页面，通过异步上下文接口和浏览器直连业务API。
section: developers
order: 70
updated: '2026-10-16'
sources:
  - docs/02-设计/02-能力设计/CAP-013-业务面板与个人定制.md
  - docs/02-设计/02-能力设计/CAP-022-业务系统公共属性与统一身份.md
  - packages/http-contracts/src/panel-resources.ts
  - packages/http-contracts/src/panel-frame-bridge.ts
  - docs/12-交流材料/20260921-业务面板对接/蜂巢业务面板对接手册.md
  - docs/11-手册/03-管理员控制台操作手册/04-业务系统与企业资源.md
---

# 开发业务面板

业务面板把经常查看的数据或操作入口做成员工可直接打开的页面。正常打开企业面板或已保存个人面板，不需要启动聊天、模型或员工Runtime；页面通过浏览器访问自己的业务API。

蜂巢负责页面版本、文件交付和当前员工的上下文；业务网关负责身份检查，业务系统负责数据与操作权限。面板不是一个能上传任意后端程序的应用托管环境。

## 1.准备页面包

```text
workorders-panel.zip
├── index.html
├── PANEL.md
├── api.json
├── js/
│   └── app.js
├── css/
│   └── style.css
└── images/
    └── workorders.svg
```

包内只有一个HTML入口，名称不一定是`index.html`。`PANEL.md`描述用途、操作步骤和影响；`api.json`是有效JSON对象，供工程师和智能体阅读，不是蜂巢替业务API执行的协议。也可以单独上传HTML，再在表单补齐两份说明。

可以去掉一个统一外层目录；不要把开发依赖、多份HTML或本机目录一起打包。上传最多15MiB，解压后单文件2MiB、总量10MiB、最多512项，不接受越界路径和链接。蜂巢不执行npm安装、构建或服务端代码，前端项目应先自行构建为静态文件。

包内资源使用相对引用：

```html
<link rel="stylesheet" href="./css/style.css">
<script src="./js/app.js" defer></script>
<img src="./images/workorders.svg" alt="工单示意">
```

CSS中的路径相对CSS文件，例如`url('../images/workorders.svg')`。以`/`开头的路径会指向蜂巢站点根目录，不是包内目录。文件名大小写必须一致，不拼接临时文件授权地址。

## 2.异步取得业务上下文

```javascript
const context = await window.hivePanel.getSystemContext('workorders');
```

|字段|用途|
|---|---|
|`system_key`|本次目标系统标识|
|`revision`|公共属性修订号|
|`properties`|字符串值组成的公共配置，如双方约定的`api_base_url`|
|`access_token`|短期业务Token，仅在内存中用于调用|
|`expires_at`|ISO格式过期时间；没有Token时为`null`|

缺少或停用身份客户端时，公共属性仍可读取，但`access_token`和`expires_at`为`null`。需要认证的面板应停止调用并提示检查配置，不能发送`Bearer null`。

旧的`window.hivePanel.apiBaseUrl`和`requestHeaders`不再使用。不要打印、展示或序列化整个`context`；需要调试时只选择不含身份的字段，并检查公共属性是否适合展示。

面板只能取得当前适用且员工获准系统的上下文。通用面板需要明确选择获准系统，不能静默选择目录第一项。系统资格和面板资源资格必须同时满足。

## 3.按按钮发起只读查询

以下假设业务方约定`GET /api/workorders`返回`{"items":[{"title":"..."}]}`；这不是蜂巢固定接口，应替换成实际业务契约。把按钮和脚本放入HTML，或移入随包的JavaScript。

```html
<button id="load">查询工单</button>
<p id="notice" role="status"></p>
<ul id="results"></ul>
<script>
const button = document.querySelector('#load');
const notice = document.querySelector('#notice');
const results = document.querySelector('#results');
button.addEventListener('click', async () => {
  button.disabled = true;
  results.replaceChildren();
  notice.textContent = '正在查询……';
  try {
    const context = await window.hivePanel.getSystemContext('workorders');
    const base = context.properties.api_base_url;
    if (!base || !context.access_token) throw new Error('系统尚未准备好');
    const response = await fetch(`${base.replace(/\/$/, '')}/api/workorders`, {
      credentials: 'omit',
      headers: { Authorization: `Bearer ${context.access_token}` },
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error('查询未完成');
    const result = await response.json();
    if (!Array.isArray(result.items)) throw new Error('格式不符合约定');
    for (const item of result.items) {
      const row = document.createElement('li');
      row.textContent = String(item.title ?? '未命名工单');
      results.append(row);
    }
    notice.textContent = `已读取${result.items.length}条工单`;
  } catch {
    notice.textContent = '查询未完成，请检查系统资格、账号关联、权限与跨域设置';
  } finally {
    button.disabled = false;
  }
});
</script>
```

使用同次上下文中的业务地址和Token，读取结果用`textContent`，不把业务文本拼成HTML。长时间打开的面板在后续操作前重新取得临近过期的上下文；Token不进入URL、文件、localStorage、sessionStorage或日志。

## 4.业务网关配置跨域

面板在单层`sandbox="allow-scripts"`的iframe中运行，没有`allow-same-origin`。浏览器业务请求通常带`Origin: null`，Authorization头触发OPTIONS预检。

以只读GET为例，业务网关需允许适用的预检：

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: null
Access-Control-Allow-Methods: GET, OPTIONS
Access-Control-Allow-Headers: Authorization, Content-Type
Vary: Origin
```

实际业务响应和错误响应也要带适用跨域头。OPTIONS不执行业务操作，随后真正的请求必须逐次核验Token和业务权限。`Origin:null`不是可信身份，其它页面也能构造；面板使用`credentials:'omit'`，不依赖业务Cookie。

面板代码以及它加载的远程脚本可以读取交给面板的短期Token。远程脚本不受面板包摘要保护，因此代码来源和外部依赖需要由面板提供方维护。iframe隔离不代表业务页面能安全执行任意不可信代码。

## 5.交付、更新与验证

1. 管理员上传业务面板，核对标识、名称、说明、适用系统与包内文件。
2. 保存后检查草稿，发布版本，并分别给测试员工分配系统资格和面板。
3. 从员工工作台打开，核对相对资源、上下文、真实查询、未关联、无权限、过期和撤权。
4. 业务方修改页面后上传完整新版并发布；员工重新打开或刷新读取当前版本。

管理端预览会执行脚本但不提供员工上下文；普通浏览器单独打开HTML也没有蜂巢身份桥接。界面可用合成数据单独调试，身份与CORS仍须在实际隔离面板中验证。

员工可保存个人副本后“聊天修改”。副本独立维护，企业更新不会覆盖；关闭编辑保留草稿，保存与历史恢复生成新版本。**员工预览使用真实身份，可能产生真实业务操作**，不要在页面加载时自动发出写请求。

只撤销面板资源不会收回员工已有系统资格，已交付Token最多仍可能有效5分钟；需要立即停止该系统业务身份，应撤销系统资格。出现错误时按[接入排查](/docs/developers/troubleshooting/)定位，不能把“预览已打开”当成业务成功。
