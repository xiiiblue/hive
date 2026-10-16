---
title: 提交和管理异步长任务
description: 提交后保存任务标识，通过轮询读取结果，并明确处理取消与HTTP等待超时。
section: developers
order: 30
updated: '2026-10-16'
sources:
  - apps/hive-core/src/mainline/server.ts
  - apps/hive-core/src/mainline/open-api/postgres-open-api.ts
  - docs/02-设计/02-能力设计/CAP-018-开放智能体API.md
---

# 提交和管理异步长任务

异步入口适合无法一直保持HTTP连接的后台任务。提交成功后保存任务ID，稍后用同一枚Key查询。关闭提交连接、停止轮询或刷新你的业务页面，都不会取消已创建的任务。

先按[开放API](/docs/developers/open-api/)准备普通员工、模型、能力分配和服务端Key。异步请求继续使用同一套员工容量、业务范围和持久截止时间，没有额外的后台执行权限。

## 1.提交任务并保存返回值

```bash
curl --silent --show-error --fail-with-body \
  'https://hive.example.invalid/api/open/v1/runs' \
  -H "Authorization: Bearer ${HIVE_API_KEY}" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: sample-async-report-20261016-001' \
  --data '{
    "model": "hive-agent",
    "messages": [{"role":"user","content":"请整理一份周报检查清单，不修改外部业务数据。"}]
  }'
```

该入口不接受`stream`字段，即使值为`false`也会拒绝。模型和单条用户文本规则与同步入口一致。

HTTP202表示提交已接受，结果包含`agent_run_id`、`conversation_id`、`run_status`、`deadline_at`和`status_url`，响应头也提供`Location`。它不表示智能体已经执行成功。调用程序应保存任务ID、原Key归属和本次幂等标识，再开始查询。

## 2.轮询同一任务

下面代码可在支持原生fetch的Node.js后端运行。`HIVE_API_KEY`和`HIVE_RUN_ID`由后端配置或提交结果提供。示例只展示最终回答，不输出请求头或身份信息。

```javascript
const apiKey = process.env.HIVE_API_KEY;
const runId = process.env.HIVE_RUN_ID;
if (!apiKey || !runId) throw new Error('缺少Key或任务ID');
const base = 'https://hive.example.invalid';
const terminal = new Set(['COMPLETED', 'FAILED', 'CANCELED']);

for (;;) {
  const response = await fetch(
    `${base}/api/open/v1/runs/${encodeURIComponent(runId)}`,
    {
      headers: { Authorization: `Bearer ${apiKey}` },
      redirect: 'error',
      signal: AbortSignal.timeout(35000),
    },
  );
  const run = await response.json();
  if (!response.ok) {
    throw new Error(`查询失败：${run.error?.code ?? response.status}`);
  }
  if (terminal.has(run.run_status)) {
    if (run.run_status !== 'COMPLETED') {
      throw new Error(`任务未成功：${run.terminal_reason ?? run.run_status}`);
    }
    console.log(run.output_text);
    break;
  }
  await new Promise(resolve => setTimeout(resolve, 2000));
}
```

服务端查询在任务等待、运行及各种终态都返回HTTP200。是否成功必须看`run_status`，不能只看HTTP状态。

|字段或状态|含义|
|---|---|
|`QUEUED`、`RUNNING`|尚未结束，可以继续轮询|
|`COMPLETED`|执行已完成，仍需按业务要求核对结果|
|`FAILED`、`CANCELED`|终态；读取`terminal_reason`决定下一步|
|`output_text`、`reasoning_text`、`tool_calls`|当前正文、思考和工具活动，运行中可能尚不完整|
|`deadline_at`|包含排队与执行的总截止时间|

示例采用2秒查询间隔。实际后端还应允许自己的用户停止等待，并按业务设置轮询次数或观察时长；停止观察后保留任务ID，之后仍可继续查询。

## 3.取消时仍要等待终态

```bash
curl --silent --show-error --fail-with-body \
  -X POST "https://hive.example.invalid/api/open/v1/runs/${HIVE_RUN_ID}/cancel" \
  -H "Authorization: Bearer ${HIVE_API_KEY}"
```

取消返回HTTP202和当前任务状态，只表示请求已登记。继续查询，直到进入`COMPLETED`、`FAILED`或`CANCELED`。取消与任务自然完成可能同时发生，不应把返回202直接显示为“已取消”。已经写入文件或发生的业务修改不会自动回滚。

## HTTP超时不等于任务超时

异步提交、查询和取消的HTTP等待最多30秒。504且错误码为`OPEN_API_REQUEST_TIMEOUT`时，只能确定本次HTTP等待结束；任务可能已经创建或仍在执行。

提交结果不明时，用同一Key、同一`Idempotency-Key`和原请求重试，取得同一任务。不要生成新标识盲目再次提交。拿到任务ID后可以继续查询；总期限到达导致的任务失败通过`run_status`和`terminal_reason`判断。

同步与异步入口分别处理幂等，不能把改用另一种入口当成原请求重试。

## Key与资产恢复的边界

查询和取消必须使用创建该任务的原Key。同一员工的另一枚Key、网页创建的任务、已删除会话或无权访问的任务都不能混入，通常返回404。Key撤销或员工停用后返回401；撤销Key不会替你取消原任务。

员工资产恢复可能使旧API请求返回409 `OPEN_API_REQUEST_INVALIDATED_BY_RESTORE`。此时不会自动重跑，调用方也不能自动换标识提交。先核对外部业务是否已执行，再明确决定是否发起新操作。

当前异步入口提供轮询，没有任务列表、Webhook或自动续跑接口。更多错误处理见[接入排查](/docs/developers/troubleshooting/)。
