# 数据库设计原则

## 核心设计原则

### 1. 不使用物理外键
- **只在逻辑层面维护关系**，不创建 FOREIGN KEY 约束
- 关系通过命名规范体现：`user_id`, `order_id` 等
- 在文档和ER图中明确标注表之间的逻辑关系
- 原因：避免锁表、提高灵活性、便于分库分表

### 2. 字段大小贴合现实
根据实际业务场景设计合理的字段大小，避免浪费存储空间。

#### 常见字段大小标准

**用户相关：**
- `username`: VARCHAR(50) - 用户名
- `real_name`: VARCHAR(50) - 真实姓名
- `nickname`: VARCHAR(50) - 昵称
- `email`: VARCHAR(100) - 邮箱地址
- `phone`: VARCHAR(20) - 手机号码（含国际区号）
- `password`: VARCHAR(255) - 密码hash值
- `id_card`: VARCHAR(18) - 身份证号

**业务数据：**
- `title`: VARCHAR(200) - 标题（文章、产品等）
- `subtitle`: VARCHAR(100) - 副标题
- `code/编号`: VARCHAR(50) - 订单号、商品编号等
- `url`: VARCHAR(500) - 网址
- `address`: VARCHAR(255) - 地址
- `description`: TEXT - 详细描述
- `content`: TEXT 或 LONGTEXT - 正文内容
- `remark/备注`: VARCHAR(500) - 备注信息

**金额和数值：**
- `price/amount`: DECIMAL(10,2) - 金额（最大99999999.99）
- `quantity`: INT - 数量
- `percentage`: DECIMAL(5,2) - 百分比（0.00-100.00）
- `rating`: DECIMAL(3,1) - 评分（0.0-10.0）

**状态和类型：**
- `status`: TINYINT - 状态码（0-255）
- `type`: TINYINT - 类型码
- `is_xxx`: TINYINT(1) - 布尔标志（0/1）
- `gender`: TINYINT - 性别（0/1/2）

**时间相关：**
- `created_at`: DATETIME - 创建时间
- `updated_at`: DATETIME - 更新时间
- `deleted_at`: DATETIME - 删除时间（软删除）
- `expire_at`: DATETIME - 过期时间

### 3. 精简索引策略
只创建业务必需的索引，避免过度索引占用存储和影响写入性能。

#### 索引创建规则

**必须创建索引的场景：**
1. WHERE 条件中频繁查询的字段
2. JOIN 操作的关联字段
3. ORDER BY / GROUP BY 使用的字段
4. 唯一性约束字段（email, phone等）使用 UNIQUE 索引

**索引命名规范：**
- 普通索引：`idx_表名_字段名` 或 `idx_字段名`
- 唯一索引：`uk_表名_字段名` 或 `uk_字段名`
- 联合索引：`idx_表名_字段1_字段2` 或 `idx_字段1_字段2`

**索引设计建议：**
- 单表索引数量一般不超过5个
- 联合索引遵循最左前缀原则
- 区分度低的字段（如性别、状态）一般不建索引
- VARCHAR字段索引时考虑使用前缀索引

### 4. 强制COMMENT
- 每个表必须有 COMMENT，简要说明表的用途
- 每个字段必须有 COMMENT，说明字段含义
- COMMENT使用中文，清晰准确

**示例：**
```sql
CREATE TABLE `user_info` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` VARCHAR(50) NOT NULL COMMENT '用户名',
  `email` VARCHAR(100) NOT NULL COMMENT '邮箱地址',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户信息表';
```

### 5. 基础表结构为主
- 默认只设计基础表结构和关键索引
- 除非明确要求，否则不涉及：
  - 分区策略（partition）
  - 读写分离
  - 缓存策略
  - 性能调优参数

## 默认系统字段

### 标准系统字段（默认添加）
除非明确指定不需要，否则每个表都应包含：

```sql
`id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键ID',
`created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
`updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
`is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否删除：0-否，1-是',
PRIMARY KEY (`id`)
```

### 可选系统字段
根据业务需求可能需要：
- `creator_id` BIGINT - 创建人ID
- `updater_id` BIGINT - 更新人ID
- `deleted_at` DATETIME - 删除时间
- `version` INT - 乐观锁版本号
- `tenant_id` BIGINT - 租户ID（多租户场景）

### 关闭系统字段
如果用户明确说明"不需要系统字段"或"只需要id"，则只创建最基本的结构。

## 命名规范

### 表命名
- 使用 `snake_case`
- 小写字母和下划线
- 名称要有业务含义
- 示例：`user_info`, `order_detail`, `product_category`

### 字段命名
- 使用 `snake_case`
- 小写字母和下划线
- 布尔类型使用 `is_xxx` 前缀
- 外键字段使用 `xxx_id` 后缀
- 示例：`user_name`, `is_active`, `order_id`

### 索引命名
- 普通索引：`idx_字段名` 或 `idx_表名_字段名`
- 唯一索引：`uk_字段名` 或 `uk_表名_字段名`
- 联合索引：`idx_字段1_字段2`
- 示例：`idx_username`, `uk_email`, `idx_user_id_created_at`

## 数据库方言

### 默认：MySQL 8.0
如果用户未指定数据库类型，默认使用 MySQL 8.0，包括：
- 引擎：InnoDB
- 字符集：utf8mb4
- 排序规则：utf8mb4_general_ci
- AUTO_INCREMENT 主键
- DATETIME 类型的时间字段

### 其他支持的数据库
根据用户指定生成对应语法：
- PostgreSQL：使用 SERIAL, TIMESTAMP, TEXT 等
- SQL Server：使用 IDENTITY, DATETIME2, NVARCHAR 等
- Oracle：使用 SEQUENCE, DATE, VARCHAR2 等

## 表关系处理

### 逻辑关系标注
虽然不创建物理外键，但需要明确标注表之间的逻辑关系：

**一对多关系 (1:N)：**
- 例：一个用户有多个订单
- 在"多"的一方添加外键字段：`user_id`
- ER图中标注为 many-to-one

**多对多关系 (N:N)：**
- 例：学生和课程的选课关系
- 创建中间表：`student_course`
- 中间表包含两个外键：`student_id`, `course_id`
- ER图中标注两个 many-to-one 关系

**一对一关系 (1:1)：**
- 例：用户和用户详情
- 在任意一方添加外键字段并加唯一索引
- ER图中标注为 one-to-one

## AI推断策略

### 推断业务细节
当用户提供的需求不够详细时，AI应该：
1. 根据常见业务场景推断合理的字段
2. 为字段选择适当的数据类型和大小
3. 添加必要的约束（NOT NULL, DEFAULT等）
4. 补充业务逻辑所需的辅助字段

**示例：**
用户说"设计一个用户表"，AI应推断包含：
- 基础字段：username, password, email, phone
- 状态字段：status（账号状态）
- 可选字段：avatar（头像URL）, gender（性别）

### 推断索引策略
根据业务场景推断索引：
1. 登录场景：username, email, phone 需要索引
2. 查询场景：status, type 等筛选字段需要索引
3. 关联场景：所有 xxx_id 外键字段需要索引
4. 唯一性：email, phone 等使用 UNIQUE 索引

### 推断表关系
根据字段命名和业务逻辑推断表关系：
- 字段名为 `xxx_id` 的，推断为外键关系
- 根据业务含义判断关系类型（1:1, 1:N, N:N）
- 多对多关系自动创建中间表

## 质量检查清单

设计完成后，验证：
- [ ] 所有表都有 COMMENT
- [ ] 所有字段都有 COMMENT
- [ ] 字段大小符合实际业务场景
- [ ] 索引数量合理（单表≤5个）
- [ ] 没有创建物理外键约束
- [ ] 系统字段正确添加（除非明确不需要）
- [ ] 命名符合 snake_case 规范
- [ ] 逻辑关系在文档中清晰标注
- [ ] SQL语法符合目标数据库方言
