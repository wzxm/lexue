---
stepsCompleted: ["step-01-init", "step-02-discovery", "step-02b-vision", "step-02c-executive-summary"]
inputDocuments:
  - "docs/index.md"
  - "docs/project-overview.md"
  - "docs/source-tree-analysis.md"
  - "docs/integration-architecture.md"
  - "docs/architecture-taro-app.md"
  - "docs/component-inventory-taro-app.md"
  - "docs/architecture-cloudfunctions.md"
  - "docs/api-contracts-cloudfunctions.md"
  - "docs/data-models.md"
  - "docs/development-guide.md"
workflowType: 'prd'
classification:
  projectType: mobile_app
  domain: edtech
  complexity: medium
  projectContext: brownfield
documentCounts:
  briefCount: 0
  researchCount: 0
  brainstormingCount: 0
  projectDocsCount: 10
---

# Product Requirements Document - lexue

**Author:** 王哲
**Date:** 2026-03-28

## Executive Summary

乐学课表是一款面向学生家长的微信小程序，解决多孩家庭课表管理分散、上课提醒缺失、家庭成员信息不同步的核心痛点。当前项目已完成基础技术架构（Taro 4.x + 微信云开发），核心目标是将现有骨架补全为家长真正可用的完整产品——所有管理功能按 Figma 设计稿逐一落地，覆盖课表、学生、家人、通知、课程等模块。

**目标用户：** 有中小学生子女的家长，尤其是多孩家庭；需要与配偶或祖父母共享课程信息的场景。

**当前阶段目标：** 完善现有缺失功能，优先实现课表管理页面，后续依次覆盖学生管理、家人管理、通知设置、添加课程、复制课表等。

### What Makes This Special

- **家庭共享机制**：课表可跨家庭成员共享，区分 owner/edit/view 三级权限，共享课表明确标注来源，只读不可改——这是区别于普通日历工具的核心差异点
- **多孩支持**：课表按学生维度组织，一个家庭可管理多个孩子的课表，数据互不干扰
- **微信生态原生**：无需注册账号，基于微信登录和云开发，家长上手零门槛

## Project Classification

| 项目 | 值 |
|------|-----|
| 项目类型 | 微信小程序（mobile_app，Taro 跨平台） |
| 领域 | 教育科技（edtech） |
| 复杂度 | 中等（多用户权限、家庭共享、分组展示） |
| 项目背景 | Brownfield（现有系统功能补全） |
