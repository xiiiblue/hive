---
title: 蜂巢功能架构与目录
description: 看懂任务如何执行、资料存在哪里，按员工、管理员或接入开发者筛选系统功能。
section: product
order: 15
updated: '2026-11-20'
sources:
  - docs/11-手册/01-产品技术手册/蜂巢功能架构与目录.html
  - docs/11-手册/03-管理员控制台操作手册/README.md
  - docs/11-手册/04-员工工作台操作手册/README.md
---

员工可以从电脑、手机或已连接的消息渠道开始一项工作。平台核对身份和授权后，由员工的工作空间执行任务。管理员负责准备能力和查看运行情况，企业业务系统负责自身的数据和操作权限。

## 按需要查找功能

上面的功能目录支持关键词和角色筛选。也可以[单独打开功能架构与目录](/media/diagrams/capabilities.html)。

|想做什么|从哪里开始|
|---|---|
|对话、上传资料、引用文件和工具、查看结果和调试记录|[发起与完成对话](/docs/employee/02-conversations/)|
|找回聊天记录、管理定时任务、跟踪执行|[会话管理与自动化](/docs/employee/03-automation/)|
|用技能保存做法，创建企业技能的个人版本|[技能广场与技能管理](/docs/employee/04-skills/)|
|连接业务系统、工具或消息渠道|[业务系统、工具与消息渠道](/docs/employee/05-systems-and-channels/)|
|连接邮箱或设置来信触发|[连接个人邮箱](/docs/employee/05-systems-and-channels/#连接个人邮箱)、[让新邮件触发任务](/docs/employee/05-systems-and-channels/#让新邮件触发任务)|
|阅读获配的企业资料|[查阅企业知识库](/docs/employee/05-systems-and-channels/#查阅企业知识库)|
|管理业务面板、文件、共享目录、终端、备份或导出|[员工工作台手册](/docs/employee/overview/)|
|为员工分配业务系统、Skill、工具、知识库和工作规范|[员工能力与工作规范](/docs/admin/03-capabilities-and-rules/)|
|管理模型、引擎、任务配额、用量和预算|[执行引擎、模型与费用](/docs/admin/06-models-and-costs/)|
|查看任务、运行环境、监控、审计或处理用户反馈|[管理员控制台手册](/docs/admin/overview/)|
|使用开放API、统一身份、MCP或业务面板对接业务系统|[开发者接入总览](/docs/developers/overview/)|

## 在自己的部署中核对

菜单随版本、账号授权和部署配置变化。机器人渠道需要部署启用和员工连接，知识库需要管理员分配，业务操作需要目标系统授权。截图使用合成数据，操作步骤仍应在你的部署中核对。
