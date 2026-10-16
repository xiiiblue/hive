---
title: 接入业务系统与统一身份
description: 用OIDC确认网页登录身份，用短期业务Token和在线核验保护每次业务调用。
section: developers
order: 40
updated: '2026-10-16'
sources:
  - docs/02-设计/02-能力设计/CAP-022-业务系统公共属性与统一身份.md
  - docs/02-设计/02-能力设计/CAP-020-业务系统连接方案.md
  - apps/hive-core/src/mainline/business-identity/oidc-provider.ts
  - apps/hive-core/src/mainline/business-identity/postgres-authority.ts
  - deploy/images/runtime-lib/hive-system.mjs
---

# 接入业务系统与统一身份

业务系统接入包含两个过程：业务账号页面通过OIDC确认当前访问者是谁；业务API通过短期Token确认这次请求是谁发起、是否仍有系统资格。业务账号关联和数据权限始终由业务系统处理。

蜂巢不保存业务密码，也不替业务系统维护一份“已关联”状态。当前接入采用系统公共属性与直接系统分配，旧固定连接方案、员工Binding及业务凭据表单已退出。

## 先准备系统与客户端

1. 管理员登记业务系统，约定稳定的`system_key`，例如`workorders`；维护`api_base_url`等公共属性及可选账号管理地址。属性名称由业务方约定，不是平台固定业务接口。
2. 管理员给员工分配系统资格；Skill、MCP与面板分别分配。
3. 需要身份认证时，管理员创建并启用该系统的统一身份客户端，登记准确的OIDC回调地址。
4. 业务后端保管`client_id`和客户端Secret，并取得可信issuer、发现地址、在线查询地址与目标`system_id`。

每个系统当前最多一个保密客户端。Secret仅创建或重置时展示，重置立即使旧Secret和相关在线授权失效，没有双Secret宽限期。公共属性不能包含密码或长期Token；这些属性会提供给获准员工和调用程序。

## 账号管理页面使用OIDC

员工点击“管理业务账号”后，新标签打开业务方登记的页面。该URL不携带蜂巢员工ID或Token，不能仅凭页面被打开就认为访问者已经登录。

业务后端使用成熟OIDC客户端库完成以下过程：

1. 从可信issuer的发现文档读取端点；示例为`https://hive.example.invalid/.well-known/openid-configuration`。
2. 发起授权码流程，使用`response_type=code`、`scope=openid profile`、准确回调地址及PKCE S256。为本次浏览器会话生成并保存`state`、`nonce`与校验值。
3. 回调后校验`state`，后端以`client_secret_basic`和`code_verifier`兑换授权码。
4. 核验ID Token签名、`iss`、`aud`、`exp`、`nonce`及适用的`azp`。当前支持RS256，不能只解码JWT后就相信用户名。
5. 以`issuer + sub`确定蜂巢员工，建立业务方自己的短期网页会话。用户明确确认后，才关联或切换业务账号。

授权码60秒有效且只用一次；ID Token和OIDC access token均为5分钟，不提供refresh token。不要使用密码模式、client_credentials、implicit或动态客户端注册，这些不属于当前能力。

关联记录至少保存蜂巢issuer、稳定的`sub`和业务用户ID。登录名与显示名只用于展示，同名员工不能相互认领业务账号。关联、切换或解绑提交前，业务后端还须调用userinfo，确认当前身份有效且`sub`与原会话一致；失败时停止修改并重新登录。

账号页面使用自己的会话Cookie和CSRF防护。蜂巢退出不承诺同时注销业务网页会话，页面Cookie也不能代替后续的userinfo复查或业务Token检查。

## 业务API逐次在线检查Token

Skill和面板按需取得5分钟有效的不透明业务Token，通过`Authorization: Bearer`调用业务网关。该Token不能由业务方离线解码，也不能把OIDC access token或ID Token当作业务Token。

网关收到每次受保护业务请求后，调用`POST /identity/introspect`。下面是Node.js后端函数，输入是本次请求的Bearer Token；客户端配置从环境变量读取，不打印任何Token、Secret或完整响应。

```javascript
const issuer = 'https://hive.example.invalid';
const clientId = process.env.HIVE_IDENTITY_CLIENT_ID;
const clientSecret = process.env.HIVE_IDENTITY_CLIENT_SECRET;
const systemId = process.env.HIVE_SYSTEM_ID;
const formEncode = value => new URLSearchParams({ v: value }).toString().slice(2);

export async function verifyBusinessToken(accessToken) {
  if (!clientId || !clientSecret || !systemId || !accessToken) {
    throw new Error('业务身份配置或请求身份缺失');
  }
  const basic = Buffer.from(
    `${formEncode(clientId)}:${formEncode(clientSecret)}`,
  ).toString('base64');
  const response = await fetch(`${issuer}/identity/introspect`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ token: accessToken }),
    redirect: 'error',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('无法确认当前业务身份');
  const claims = await response.json();
  if (claims.active !== true || claims.iss !== issuer || claims.aud !== systemId
      || typeof claims.sub !== 'string' || typeof claims.exp !== 'number'
      || claims.exp <= Date.now() / 1000) {
    throw new Error('业务身份无效');
  }
  return { issuer: claims.iss, subject: claims.sub };
}
```

有效响应包含`active、iss、sub、aud、exp、username、name`；无效、跨系统或过期Token返回`active:false`。网关通过后，仍须按`issuer/sub`查业务账号关联并检查本次数据与操作权限。

不缓存`active:true`。401客户端认证失败、429限流、503依赖失败或超时都应拒绝受保护操作，不降级为匿名执行。在线核验只能确认当前时间点的资格，已经进入业务系统的长任务仍需由业务方管理权限与取消。

## Skill和面板怎样取得上下文

- [Skill](/docs/developers/skills/)使用Runtime内`/opt/hive/lib/hive-system.mjs`提供的`getSystemContext(system_key)`。
- [面板](/docs/developers/panels/)使用`window.hivePanel.getSystemContext(system_key)`，通过当前员工与面板权限检查取得上下文。
- [MCP蜂巢身份模式](/docs/developers/mcp/)由执行引擎复用同一取Token入口，业务网关继续在线核验。

上下文包含公共属性和短期Token，只在调用程序内使用。未配置或停用客户端时仍可取得公共属性，但`access_token`和`expires_at`为`null`；需要认证的调用此时应停止，不发送`Bearer null`。

## 完成接入前验证

至少验证正常访问、尚未关联、业务权限不足、Token过期、员工撤权、客户端停用和身份服务故障。撤权后重新授予不能让旧Token复活。业务错误可用`ACCOUNT_LINK_REQUIRED`提示去登记的账号管理页面，用`BUSINESS_PERMISSION_DENIED`表示业务权限不足；不要打开错误正文提供的任意URL。

面板还需完成真实浏览器跨域检查。所有Token和Secret均不能进入URL、浏览器持久存储、面板文件、模型对话或普通日志。
