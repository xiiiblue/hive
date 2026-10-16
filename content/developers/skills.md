---
title: 编写和分发Skill
description: 把工作说明、脚本和模板整理成Skill，并正确处理个人草稿、企业资源和市场版本。
section: developers
order: 50
updated: '2026-10-16'
sources:
  - docs/02-设计/02-能力设计/CAP-002-Skill与包治理.md
  - packages/provider-contracts/src/skill-display-metadata.ts
  - packages/provider-contracts/src/skill-business-scope.ts
  - deploy/images/runtime-lib/hive-system.mjs
  - docs/11-手册/04-员工工作台操作手册/04-技能广场与技能管理.md
  - docs/11-手册/03-管理员控制台操作手册/04-业务系统与企业资源.md
---

# 编写和分发Skill

Skill把一种工作方法保存为智能体可以读取的说明，也可以附带脚本、模板和参考资料。例如，员工先完成一次周报，再把输入、检查和输出步骤整理下来，下次换一份材料就能继续使用。

Skill本身不会授予业务权限，也不是独立安全容器。执行脚本使用员工当前工作空间和业务资格，编写时应明确输入、输出、副作用和失败处理。

## 1.准备一个最小目录

```text
workorder-summary/
├── SKILL.md
├── query.mjs
└── templates/
    └── report.md
```

`SKILL.md`示例：

```markdown
---
name: workorder-summary
description: 查询本人可访问的工单，按状态汇总并生成待核对清单。
metadata:
  display_name: 工单汇总助手
  example_prompt: 请汇总本周工单，按状态列出数量和待办，不修改工单。
  tags: [工单, 周报]
  business_system_keys: [workorders]
---

先确认查询时间范围，再运行本目录query.mjs。
只读取工单，不修改业务记录。缺失数据标为待核对，不猜测。
将结果另存为新的Markdown文件，并返回文件位置和统计口径。
账号未关联或权限不足时停止，说明需要用户处理的事项。
不读取、打印或保存身份Token，不要求用户在对话中提供业务密码。
```

`name`是稳定英文标识，使用小写字母、数字、点、下划线或连字符。`description`说明用途，正文说明什么时候使用、怎样做、依赖什么以及怎样核对结果。不要把具体客户资料或一次查询数据写成长期工作指令。

个人Skill启用前需要包含中文的名称、非空样例和至少一个标签。名称最多128字符，样例最多2000字符；标签1—20个，每个最多32字符。`business_system_keys`最多20项，缺省或空数组表示通用；声明范围不会自动授予系统资格。

不要让生成Skill的智能体自行写入`metadata.hive_ready: true`。个人Skill需要由员工检查资料后在页面确认启用。

## 2.在脚本内部获取业务身份

调用业务API前，先完成[业务系统身份接入](/docs/developers/identity/)。下面假定业务方提供`GET /api/workorders`并返回`{"items":[]}`；这是示例业务契约，需要替换为你的系统真实接口。

```javascript
import { getSystemContext } from '/opt/hive/lib/hive-system.mjs';

async function main() {
  const context = await getSystemContext('workorders');
  const base = context.properties.api_base_url;
  if (!base || !context.access_token) {
    throw new Error('系统属性或业务身份尚未准备好');
  }
  const response = await fetch(`${base.replace(/\/$/, '')}/api/workorders`, {
    headers: { Authorization: `Bearer ${context.access_token}` },
    redirect: 'error',
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('工单查询未完成');
  const result = await response.json();
  if (!Array.isArray(result.items)) throw new Error('业务返回格式不符合约定');
  console.log(JSON.stringify({ items: result.items }));
}

main().catch(() => {
  console.error('查询失败，请检查配置、账号关联、权限或服务状态');
  process.exitCode = 1;
});
```

该模块只在蜂巢Runtime内提供，通过受控身份通道确认当前员工。不能在外部机器上靠填写员工ID取得真实身份。示例只输出业务结果，不能改为打印整个`context`，再让智能体拼接带Token的命令。

业务Token5分钟有效。长脚本在下一批操作前按需重新取得上下文，使用同次返回的地址与Token，不持久化Token，也不回退旧业务密码或固定Key。写操作超时后先查实际结果，不能盲目重发。

## 3.导入个人Skill并试用

1. 将目录放入自己的`/workspace/skills`，然后在“个人设置→我的技能”点击“刷新工作空间技能”；也可把单个Skill打为ZIP，使用“上传Skill”。
2. ZIP包含一个明确Skill根目录或根目录的`SKILL.md`。个人上传只接受ZIP，上传文件最多15MiB；解压后单文件最多2MiB、总量10MiB、最多512项，不得包含越界路径或链接。
3. 在“我创建的”查看草稿，打开“完善资料”或“完善并启用”，核对中文名称、样例、标签与适用系统，再选择“保存并启用”。
4. 从技能广场或卡片“试用”打开预填的新对话，检查要求后自行发送。
5. 核对文件、统计口径和错误情况，再决定是否复用或共享。

上传、复制或对话创建后的个人Skill默认需要本人确认；“试用”只预填输入，不自动发送。停用目录位于`/workspace/disabled-skills`。业务范围决定可用目录，不阻止员工在自己的文件空间中主动阅读文件。

## 4.选择合适的分发方式

|方式|维护与使用规则|
|---|---|
|个人Skill|员工自己的普通目录，可继续修改，仅本人使用|
|企业Skill|管理员在“企业Skill”上传Markdown或ZIP，检查草稿后发布，并独立分配给员工|
|技能市场版本|员工从个人卡片“共享到市场”，形成不可变发布版本，其他员工选择精确版本安装|

市场版本不会自动升级。需要修改受管理安装时，使用“复制为个人Skill”，副本不再跟随市场版本变化；不要直接编辑受管理安装目录。发布者不能安装自己发布的市场版本，仍使用原个人Skill。

共享前核对包内所有文件、外部访问声明和业务数据。停止共享只阻止新安装，已经安装的副本仍可能继续使用；管理员紧急禁用具有不同影响，不能把停止共享当作已撤回所有副本。

## 5.怎样判断Skill可用

资料有效、本人已启用、文件解析正常、适用范围匹配，才满足个人Skill使用条件。企业Skill还要当前发布和员工分配；市场安装还要精确版本可用、完整性有效且没有阻塞操作。

找不到Skill时先检查这些条件与当前范围，不重复上传同名目录来掩盖错误。业务权限、模型和运行环境失败应分别处理，见[接入排查](/docs/developers/troubleshooting/)。
