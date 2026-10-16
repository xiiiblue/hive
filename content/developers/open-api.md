---
title: 调用蜂巢开放API
description: 用服务端Key提交智能体任务，正确读取普通回答和SSE流式结果。
section: developers
order: 20
updated: '2026-10-16'
sources:
  - apps/hive-core/src/mainline/server.ts
  - apps/hive-core/src/mainline/open-api/postgres-open-api.ts
  - docs/02-设计/02-能力设计/CAP-018-开放智能体API.md
  - docs/11-手册/03-管理员控制台操作手册/07-统一身份与开放API.md
---

# 调用蜂巢开放API

开放API让你的后端提交一个自然语言任务，由蜂巢在指定员工的工作空间中执行。它会创建对话和执行记录，沿用该员工当前的模型、工具资格、业务权限与容量限制。

任务可能需要几分钟甚至更久。不能长期保持HTTP连接时，优先使用[异步长任务](/docs/developers/async-runs/)；本篇讲保持连接等待完整JSON或逐步接收SSE的方式。

## 开始前准备

1. 管理员在“集成与接入→开放API”创建Key，选择普通员工、执行引擎、业务范围和可选任务时限。
2. 管理员分别为该员工配置所需模型、系统资格和资源。
3. 调用程序在后端安全配置中读取`HIVE_API_KEY`。完整Key只展示一次，不写入浏览器代码、公开仓库或日志。
4. 用只读且输出容易核对的任务完成首次调用。

Key固定员工、执行引擎和业务范围，请求不能改变这些绑定。每次新请求通常创建独立对话；同一员工的调用仍共享文件与依赖。需要连续对话、多轮历史或指定已有会话时，不能自行追加未支持的请求字段。

## 普通JSON调用

在已安全注入`HIVE_API_KEY`的后端环境执行。示例域名需替换为实际蜂巢地址。

```bash
curl --silent --show-error --fail-with-body \
  'https://hive.example.invalid/api/openai/v1/chat/completions' \
  -H "Authorization: Bearer ${HIVE_API_KEY}" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: sample-report-20261016-001' \
  --data '{
    "model": "hive-agent",
    "messages": [{"role":"user","content":"请列出整理一份周报需要核对的三项信息，不调用业务写入工具。"}],
    "stream": false
  }'
```

成功返回HTTP200。正文在`choices[0].message.content`；`reasoning_content`是引擎提供的原生思考文本，没有时为空字符串；`tool_activity`记录已执行工具的活动。响应头`X-Hive-Conversation-Id`和`X-Hive-Run-Id`可用于定位执行记录。

响应中的`model`是实际模型目录ID，不一定是请求中的`hive-agent`。`finish_reason`通常为`stop`；Hive Pi因输出上限结束时为`length`，应检查回答是否完整。成功响应不提供虚构的`usage`字段。

## 请求只支持这些字段

|字段|当前要求|
|---|---|
|`model`|`hive-agent`默认别名，或Key绑定引擎当前已发布的模型目录ID；后者是蜂巢目录ID，不是上游模型名称|
|`messages`|恰好一项，不能提交多轮历史|
|`messages[0].role`|必须为`user`|
|`messages[0].content`|字符串，不接受图片或内容数组|
|`stream`|可省略；默认`false`，`true`使用SSE|

不要传`temperature`、`tools`、`response_format`、自报员工或业务凭据等字段。未知字段会明确拒绝，接口不承诺完整OpenAI兼容，也没有供调用方执行的工具回调协议。

## SSE流式调用

将上例的`stream`改为`true`，并为curl增加`--no-buffer`，使用另一个业务请求标识。服务端返回`text/event-stream`，每个事件由空行分隔；不能把一次网络读取直接当成一个完整事件。

|事件内容|调用方怎样使用|
|---|---|
|`choices[0].delta.content`|追加回答正文|
|`choices[0].delta.reasoning_content`|按需要展示原生思考|
|`choices[0].delta.tool_activity`|按`call_id`更新工具当前快照，不要求客户端执行工具|
|`finish_reason`为`stop`或`length`的完成块|记录完成原因|
|`data: [DONE]`|成功流结束|

连接中可能有冒号开头的心跳注释。SSE已开始后仍可能收到包含`error`的错误块；此时不再发送成功完成块或`[DONE]`。应把流中错误或未完成就断开的连接当作需要核对的结果，不能因为HTTP最初返回200就显示任务成功。

## 幂等、时限与重试

`Idempotency-Key`可选，但建议始终提供。长度8—128字符，以字母或数字开头，其余可使用字母、数字、点、下划线、冒号和连字符。为每项业务操作生成唯一标识；同一操作的网络重试继续使用同一标识和原请求。

相同Key与相同幂等标识会复用原执行；输入变化返回409。示例中的固定标识仅用于说明，实际程序不能让不同用户操作一直共用它。切换另一枚API Key不属于原Key的幂等重放。

平台默认任务时限30分钟，可配置1—120分钟，Key也可覆盖。期限包含排队与执行，重试不会重置原期限。调用方或代理提前断开会请求取消同步任务，因此客户端超时应与任务目标一致。取消和超时都不会回滚已经发生的外部业务操作。

## 处理错误与更换Key

错误JSON包含`error.code`、`error.message`和`error.trace_id`。重点处理401身份失效、400请求不支持、409幂等冲突、429员工等待名额已满，以及504超时；完整处理见[接入排查](/docs/developers/troubleshooting/)。

Key丢失或需要变更绑定时，创建替代Key并更新后端配置，再由管理员撤销旧Key。撤销会阻止后续API访问，包括查询和取消异步任务，但不会停止已经创建的执行。
