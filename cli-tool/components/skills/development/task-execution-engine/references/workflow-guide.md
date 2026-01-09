# Workflow Guide

从需求分析到自动化实现的完整流程。

## 流程概览

```
┌─────────────────────────────────────────────────────┐
│  /feature-analyzer 实现用户登录功能                   │
│  → 对话设计 → 生成 docs/designs/xxx.md               │
│  → "设计已完成，要开始实现吗？"                        │
└─────────────────────────────────────────────────────┘
                         ↓
              用户: "开始实现" / "Yes"
                         ↓
┌─────────────────────────────────────────────────────┐
│  /feature-pipeline docs/designs/xxx.md              │
│  → 读取任务列表 → 循环执行 → 更新 checkbox           │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│  完成！"要提交到 Git 吗？"                           │
└─────────────────────────────────────────────────────┘
```

## 使用示例

### 完整流程

```
用户: /feature-analyzer 实现用户登录功能

Claude: [逐步对话理解需求...]
        [设计方案...]

        设计已保存到 docs/designs/2026-01-02-user-auth.md

        任务列表：
        1. Create User model (priority: 1)
        2. Implement JWT utils (priority: 2)
        3. Create auth API (priority: 3)

        设计已完成，要开始实现吗？

用户: 开始实现

Claude: 开始执行任务...

        ---TASK RESULT---
        task: Create User model
        status: completed
        files: [src/models/user.py]
        ---END TASK RESULT---

        ---TASK RESULT---
        task: Implement JWT utils
        status: completed
        files: [src/utils/jwt.py]
        ---END TASK RESULT---

        [继续执行...]

        所有任务完成！
        ✅ 3/3 tasks completed

        要提交到 Git 吗？
```

### 直接执行已有设计

```
用户: /feature-pipeline docs/designs/2026-01-02-user-auth.md

Claude: [读取文件，开始执行任务...]
```

### 恢复中断的工作

```
用户: /feature-pipeline docs/designs/2026-01-02-user-auth.md

Claude: 正在恢复...
        已完成: 2/5 任务
        从 "Create auth API" 继续...

        [继续执行剩余任务...]
```

## 设计文档格式

设计文档中的任务列表使用 markdown checkbox：

```markdown
# User Auth Design

## Overview
...

## Implementation Tasks

- [ ] **Create User model** `priority:1` `phase:model`
  - files: src/models/user.py
  - [ ] User model has email field
  - [ ] Password hashing implemented

- [ ] **Implement JWT utils** `priority:2` `phase:model`
  - files: src/utils/jwt.py
  - [ ] generate_token() works
  - [ ] verify_token() works

- [ ] **Create auth API** `priority:3` `phase:api` `deps:Create User model,Implement JWT utils`
  - files: src/api/auth.py
  - [ ] POST /login endpoint
  - [ ] POST /register endpoint
```

执行后：

```markdown
- [x] **Create User model** `priority:1` `phase:model` ✅
  - files: src/models/user.py
  - [x] User model has email field
  - [x] Password hashing implemented

- [x] **Implement JWT utils** `priority:2` `phase:model` ✅
  ...
```

## 优势

1. **可读性**: 设计文档直接可读
2. **Git 友好**: markdown diff 清晰
3. **简单**: 无需额外的 session 文件
4. **中断恢复**: 重新读取文件即可继续
