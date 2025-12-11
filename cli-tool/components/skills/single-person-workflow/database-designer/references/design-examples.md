# 数据库设计示例

## 示例1：电商系统核心表

### 需求描述
设计一个电商系统的核心数据库，包括用户、商品、订单等基础功能。

### 表结构设计

#### 1. 用户表 (user_info)
```sql
CREATE TABLE `user_info` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '用户ID',
  `username` VARCHAR(50) NOT NULL COMMENT '用户名',
  `password` VARCHAR(255) NOT NULL COMMENT '密码（加密存储）',
  `email` VARCHAR(100) NOT NULL COMMENT '邮箱地址',
  `phone` VARCHAR(20) NOT NULL COMMENT '手机号码',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '账号状态：0-禁用，1-正常，2-冻结',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否删除：0-否，1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email` (`email`),
  UNIQUE KEY `uk_phone` (`phone`),
  KEY `idx_username` (`username`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户信息表';
```

#### 2. 商品表 (product_info)
```sql
CREATE TABLE `product_info` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '商品ID',
  `product_code` VARCHAR(50) NOT NULL COMMENT '商品编号',
  `product_name` VARCHAR(200) NOT NULL COMMENT '商品名称',
  `category_id` BIGINT NOT NULL COMMENT '分类ID',
  `price` DECIMAL(10,2) NOT NULL COMMENT '商品价格',
  `stock` INT NOT NULL DEFAULT 0 COMMENT '库存数量',
  `description` TEXT COMMENT '商品描述',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '商品状态：0-下架，1-上架，2-售罄',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否删除：0-否，1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_product_code` (`product_code`),
  KEY `idx_category_id` (`category_id`),
  KEY `idx_product_name` (`product_name`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品信息表';
```

#### 3. 订单表 (order_info)
```sql
CREATE TABLE `order_info` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '订单ID',
  `order_no` VARCHAR(50) NOT NULL COMMENT '订单编号',
  `user_id` BIGINT NOT NULL COMMENT '用户ID',
  `total_amount` DECIMAL(10,2) NOT NULL COMMENT '订单总金额',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '订单状态：0-待支付，1-已支付，2-已发货，3-已完成，4-已取消',
  `pay_time` DATETIME COMMENT '支付时间',
  `ship_time` DATETIME COMMENT '发货时间',
  `complete_time` DATETIME COMMENT '完成时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否删除：0-否，1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单信息表';
```

#### 4. 订单明细表 (order_detail)
```sql
CREATE TABLE `order_detail` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '明细ID',
  `order_id` BIGINT NOT NULL COMMENT '订单ID',
  `product_id` BIGINT NOT NULL COMMENT '商品ID',
  `product_name` VARCHAR(200) NOT NULL COMMENT '商品名称（快照）',
  `price` DECIMAL(10,2) NOT NULL COMMENT '商品单价（快照）',
  `quantity` INT NOT NULL COMMENT '购买数量',
  `subtotal` DECIMAL(10,2) NOT NULL COMMENT '小计金额',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否删除：0-否，1-是',
  PRIMARY KEY (`id`),
  KEY `idx_order_id` (`order_id`),
  KEY `idx_product_id` (`product_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='订单明细表';
```

### 表关系说明
- user_info (1) → order_info (N)：一个用户可以有多个订单
- order_info (1) → order_detail (N)：一个订单包含多个商品明细
- product_info (1) → order_detail (N)：一个商品可以在多个订单中出现

---

## 示例2：博客系统

### 需求描述
设计一个简单的博客系统，支持用户发表文章、评论和标签功能。

### 表结构设计

#### 1. 文章表 (article)
```sql
CREATE TABLE `article` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '文章ID',
  `user_id` BIGINT NOT NULL COMMENT '作者ID',
  `title` VARCHAR(200) NOT NULL COMMENT '文章标题',
  `summary` VARCHAR(500) COMMENT '文章摘要',
  `content` LONGTEXT NOT NULL COMMENT '文章内容',
  `view_count` INT NOT NULL DEFAULT 0 COMMENT '浏览次数',
  `like_count` INT NOT NULL DEFAULT 0 COMMENT '点赞次数',
  `comment_count` INT NOT NULL DEFAULT 0 COMMENT '评论次数',
  `status` TINYINT NOT NULL DEFAULT 0 COMMENT '发布状态：0-草稿，1-已发布，2-已下线',
  `publish_time` DATETIME COMMENT '发布时间',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否删除：0-否，1-是',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_publish_time` (`publish_time`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章表';
```

#### 2. 评论表 (comment)
```sql
CREATE TABLE `comment` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '评论ID',
  `article_id` BIGINT NOT NULL COMMENT '文章ID',
  `user_id` BIGINT NOT NULL COMMENT '评论用户ID',
  `parent_id` BIGINT DEFAULT 0 COMMENT '父评论ID：0表示顶级评论',
  `content` TEXT NOT NULL COMMENT '评论内容',
  `like_count` INT NOT NULL DEFAULT 0 COMMENT '点赞次数',
  `status` TINYINT NOT NULL DEFAULT 1 COMMENT '评论状态：0-已删除，1-正常，2-已屏蔽',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否删除：0-否，1-是',
  PRIMARY KEY (`id`),
  KEY `idx_article_id` (`article_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_parent_id` (`parent_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='评论表';
```

#### 3. 标签表 (tag)
```sql
CREATE TABLE `tag` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '标签ID',
  `tag_name` VARCHAR(50) NOT NULL COMMENT '标签名称',
  `use_count` INT NOT NULL DEFAULT 0 COMMENT '使用次数',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `is_deleted` TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否删除：0-否，1-是',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_tag_name` (`tag_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='标签表';
```

#### 4. 文章标签关联表 (article_tag)
```sql
CREATE TABLE `article_tag` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '关联ID',
  `article_id` BIGINT NOT NULL COMMENT '文章ID',
  `tag_id` BIGINT NOT NULL COMMENT '标签ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  KEY `idx_article_id` (`article_id`),
  KEY `idx_tag_id` (`tag_id`),
  UNIQUE KEY `uk_article_tag` (`article_id`, `tag_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='文章标签关联表';
```

### 表关系说明
- user_info (1) → article (N)：一个用户可以写多篇文章
- article (1) → comment (N)：一篇文章可以有多条评论
- user_info (1) → comment (N)：一个用户可以发表多条评论
- article (N) ←→ tag (N)：文章和标签是多对多关系，通过 article_tag 中间表关联

---

## 索引设计说明

### 何时需要索引

1. **WHERE 条件字段**
   - 示例：`WHERE user_id = ?` → 需要 `idx_user_id`
   - 示例：`WHERE status = ? AND created_at > ?` → 需要联合索引 `idx_status_created_at`

2. **JOIN 关联字段**
   - 示例：`JOIN order_info ON order_detail.order_id = order_info.id` → 需要 `idx_order_id`

3. **ORDER BY / GROUP BY 字段**
   - 示例：`ORDER BY created_at DESC` → 需要 `idx_created_at`
   - 示例：`GROUP BY category_id` → 需要 `idx_category_id`

4. **唯一性约束字段**
   - 示例：email, phone, order_no 等 → 使用 UNIQUE 索引

### 何时不需要索引

1. **低区分度字段**
   - 性别（只有2-3个值）
   - 简单的状态码（只有0/1两个值）
   - 布尔类型字段（is_deleted等）

2. **频繁更新的字段**
   - view_count（浏览次数）
   - like_count（点赞次数）
   - 这些字段频繁更新会降低索引效率

3. **小表**
   - 数据量很小（几百条以内）的表不需要太多索引
   - 全表扫描可能比索引查询更快

### 联合索引设计

遵循**最左前缀原则**：
```sql
-- 创建联合索引
KEY `idx_status_created_at` (`status`, `created_at`)

-- 可以使用的查询
WHERE status = ? AND created_at > ?  -- ✅ 使用完整索引
WHERE status = ?                      -- ✅ 使用索引的最左列

-- 无法使用的查询
WHERE created_at > ?                  -- ❌ 不满足最左前缀
```

---

## 字段设计注意事项

### 1. 快照字段
订单、交易等业务中，需要保存当时的快照数据：
```sql
-- order_detail 表中
product_name VARCHAR(200)  -- 商品名称快照（商品可能改名）
price DECIMAL(10,2)        -- 价格快照（商品可能调价）
```

### 2. 计数字段
为了性能，某些计数可以冗余存储：
```sql
-- article 表中
view_count INT DEFAULT 0      -- 浏览次数
like_count INT DEFAULT 0      -- 点赞次数
comment_count INT DEFAULT 0   -- 评论次数
```

### 3. 层级结构
使用 parent_id 实现树形结构：
```sql
-- comment 表中
parent_id BIGINT DEFAULT 0  -- 0表示顶级评论，非0表示回复某条评论
```

### 4. 软删除
使用 is_deleted 实现软删除：
```sql
is_deleted TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否删除：0-否，1-是'
-- 查询时需要加条件：WHERE is_deleted = 0
```

### 5. 状态流转
设计合理的状态码：
```sql
-- 订单状态
status TINYINT COMMENT '0-待支付，1-已支付，2-已发货，3-已完成，4-已取消'
-- 状态之间的流转：0 → 1 → 2 → 3 或 0 → 4
```
