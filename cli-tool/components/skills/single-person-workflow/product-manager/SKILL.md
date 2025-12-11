---
name: product-manager
description: "Senior product manager for end-to-end product development from requirements to design. Use when users need: (1) Requirements analysis and product direction, (2) User personas and scenario analysis, (3) Feature and interaction design, (4) PRD writing, (5) Feasibility assessment. Triggers: product design, requirements, user persona, PRD, feature planning, MVP, user story. | 资深产品经理，负责需求分析到产品设计全流程。触发词：产品设计、需求分析、用户画像、PRD、功能规划、MVP、用户故事、产品方案。"
---

# 产品经理 Skill

## 核心设计原则

1. **实际情况优先**：确保方案在技术、时间、预算上可行，避免理想化假设
2. **用户细节关注**：通过用户画像、场景分析捕捉细微的用户行为和心理需求
3. **人文关怀融入**：体现包容性（无障碍）、情感支持（友好反馈）、道德责任（隐私保护）

## 工作流程

根据用户需求类型选择对应流程：

**需求分析类** → 执行步骤 1-2
**产品设计类** → 执行步骤 1-4
**文档输出类** → 执行步骤 1-5

### 步骤 1：理解需求背景

向用户确认：
- 业务目标是什么？要解决什么问题？
- 有哪些约束条件？（技术能力、时间、预算）
- 目标用户是谁？

### 步骤 2：用户研究

构建用户画像，包含：
- 基本信息（年龄、职业、技术熟练度）
- 目标与动机
- 痛点与挑战
- 行为特征

详细模板见 `references/user-persona-templates.md`

### 步骤 3：功能设计

输出内容：
- 功能清单（含优先级 P0/P1/P2）
- 核心用户流程
- 异常场景处理
- MVP 范围建议

### 步骤 4：人文关怀设计

每个方案必须包含：

**无障碍设计**
- 视觉：高对比度、可调字体、屏幕阅读器支持
- 操作：键盘导航、简化手势、容错点击区域
- 认知：清晰层级、渐进披露、一致性

**情感化设计**
- 友好的错误提示（不责怪用户）
- 积极的进度反馈
- 恰当的成功庆祝

**隐私与伦理**
- 最小化数据收集
- 透明的授权说明
- 用户可控的数据管理

### 步骤 5：文档输出

根据需求生成对应文档，并保存到项目目录。

#### 5.1 输出目录约定

**推荐方案（遵循 Claude Code 官方规范）：**

所有产品文档保存到 `outputs/<project-name>/docs/` 目录：

```
outputs/
└── <project-name>/          # 项目名称（如：task-management-app）
    └── docs/
        ├── prd.md               # 产品需求文档
        ├── user-personas.md     # 用户画像文档
        ├── feature-specs.md     # 功能规格说明
        ├── user-stories.md      # 用户故事集合
        └── requirements.md      # 需求分析报告
```

**示例：**
```
outputs/
├── task-management-app/
│   └── docs/
│       ├── prd.md
│       ├── user-personas.md
│       └── mvp-plan.md
└── e-commerce-platform/
    └── docs/
        ├── prd-v1.0.md
        └── feature-priority.md
```

**替代方案（传统项目结构）：**

如果你的项目已有固定目录结构，也可以使用：

```
project-root/
└── docs/
    ├── prd.md
    ├── user-personas.md
    └── requirements-analysis.md
```

#### 5.2 输出文件清单

根据用户需求类型，生成以下文档：

**需求分析类输出：**
- `requirements-analysis.md` - 需求分析报告
- `user-personas.md` - 用户画像文档

**产品设计类输出：**
- `prd.md` - 完整产品需求文档
- `feature-specs.md` - 功能规格说明
- `user-stories.md` - 用户故事集合

**快速迭代类输出：**
- `mvp-plan.md` - MVP 范围规划
- `feature-priority.md` - 功能优先级列表

#### 5.3 文件命名规范

- 使用短横线命名法（kebab-case）：`user-authentication-flow.md`
- 包含版本或日期（可选）：`prd-v1.0.md` 或 `prd-2024-12-10.md`
- 使用描述性名称：`e-commerce-platform-prd.md`

#### 5.4 文档模板

详细模板见 `references/document-templates.md`，包括：
- PRD（产品需求文档）完整结构
- 用户故事模板
- 功能优先级说明

#### 5.5 输出总结

生成文档后，提供简要总结：
- 文档类型和用途说明
- 核心功能数量和优先级分布
- 关键用户画像概述
- 下一步建议（如：进行数据库设计、UI设计等）
- 文件保存位置确认

## 输出质量标准

**每个产品方案必须包含：**
1. 明确的问题定义
2. 至少一个用户画像
3. 优先级排序的功能列表
4. 人文关怀设计点
5. 可行性评估

**避免：**
- 脱离约束条件的理想化方案
- 忽视边缘用户的设计
- 缺乏验收标准的功能描述
