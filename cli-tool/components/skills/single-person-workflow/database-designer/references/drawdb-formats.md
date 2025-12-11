# DrawDB 格式模板

本文档定义了生成 DrawDB 兼容的 JSON 和 DBML 格式的模板和规范。

## JSON 格式规范

### 完整结构
```json
{
  "tables": [],
  "relationships": [],
  "notes": [],
  "subjectAreas": [],
  "database": "generic",
  "types": [],
  "title": "数据库名称"
}
```

### Tables 结构
```json
{
  "id": "random_string_id",   // 表的唯一ID,使用随机字符串(如 "_KV5MtPf2m4sI7Inu8pat")
  "name": "table_name",       // 表名
  "comment": "表注释",         // 表的COMMENT
  "color": "#6360f7",         // 表头颜色(可使用预定义颜色)
  "fields": [],               // 字段数组
  "indices": [],              // 索引数组
  "x": 100.5,                 // ER图中的X坐标(浮点数)
  "y": 200.5                  // ER图中的Y坐标(浮点数)
}
```

### Fields 结构
```json
{
  "id": "random_string_id",   // 字段ID,使用随机字符串(如 "B8rPRTDtOv9oD2Gp4bhWL")
  "name": "field_name",       // 字段名
  "type": "VARCHAR(100)",     // 完整数据类型定义(包含长度/精度)
  "default": "",              // 默认值(字符串类型,数字也用字符串)
  "check": "",                // CHECK约束(一般为空字符串)
  "primary": false,           // 是否主键
  "unique": false,            // 是否唯一
  "notNull": false,           // 是否NOT NULL
  "increment": false,         // 是否自增
  "comment": "字段注释"        // 字段的COMMENT
}
```

**重要说明:**
- `type` 字段包含完整类型定义,例如: `"VARCHAR(100)"`, `"DECIMAL(10,2)"`, `"BIGINT"`
- **没有独立的 `size` 字段**
- `default` 始终是字符串类型,数字默认值也用字符串表示(如 `"0"`, `"false"`)
- 布尔类型用 `"BOOLEAN"` 或 `"TINYINT(1)"`

### Indices 结构
```json
{
  "id": 0,                    // 索引ID,使用数字递增
  "fields": ["field_name"],   // 字段名称数组(注意:使用字段名而非字段ID!)
  "name": "idx_field_name",   // 索引名称
  "unique": false             // 是否唯一索引
}
```

**重要说明:**
- `fields` 数组使用**字段名称字符串**,而非字段 ID
- 联合索引示例: `["field1", "field2"]`

### Relationships 结构
```json
{
  "name": "",                           // 关系名称(可为空字符串)
  "startTableId": "table1_id",          // 起始表ID(随机字符串)
  "endTableId": "table2_id",            // 目标表ID(随机字符串)
  "endFieldId": "field_id",             // 目标表的字段ID(随机字符串,通常是主键)
  "startFieldId": "field_id",           // 起始表的字段ID(随机字符串)
  "id": "relationship_id",              // 关系ID(随机字符串)
  "updateConstraint": "No action",      // 更新约束
  "deleteConstraint": "No action",      // 删除约束
  "cardinality": "many_to_one"          // 关系类型
}
```

**重要说明:**
- 所有 ID 都使用随机字符串,不是数字
- 字段顺序与示例保持一致有助于兼容性
- `name` 可以为空字符串

#### Cardinality 类型
- `many_to_one`: 多对一关系(N:1) - 最常用
- `one_to_one`: 一对一关系(1:1)
- `one_to_many`: 一对多关系(1:N) - 很少用
- `many_to_many`: 多对多关系(N:N) - 需要通过中间表实现

### 数据类型映射

#### MySQL 到 DrawDB
- `BIGINT` → `"BIGINT"`
- `INT` → `"INT"`
- `TINYINT` → `"TINYINT"`
- `TINYINT(1)` → `"TINYINT(1)"` (布尔值)
- `VARCHAR(n)` → `"VARCHAR(n)"` (完整字符串,包含长度)
- `TEXT` → `"TEXT"`
- `LONGTEXT` → `"LONGTEXT"`
- `DATETIME` → `"DATETIME"`
- `TIMESTAMP` → `"TIMESTAMP"`
- `DATE` → `"DATE"`
- `DECIMAL(m,n)` → `"DECIMAL(m,n)"` (完整字符串)
- `BOOLEAN` → `"BOOLEAN"`
- `ENUM(...)` → `"ENUM(VALUE1,VALUE2)"` (完整定义)

### 颜色方案
使用预定义的颜色轮换:
```javascript
const colors = [
  "#6360f7",  // 紫色
  "#bc49c4",  // 粉紫色
  "#ffe159",  // 黄色
  "#89e667",  // 绿色
  "#ff9159",  // 橙色
  "#59d9ff",  // 蓝色
  "#ff5959",  // 红色
  "#a0a0a0"   // 灰色
];
// 按表的顺序循环使用
```

### 坐标布局策略
简单的网格布局:
```javascript
const GRID_WIDTH = 450;
const GRID_HEIGHT = 400;
const START_X = 50;
const START_Y = 50;

// 表的位置 = (列索引 * GRID_WIDTH + START_X, 行索引 * GRID_HEIGHT + START_Y)
// 每行放3个表
const x = (tableIndex % 3) * GRID_WIDTH + START_X;
const y = Math.floor(tableIndex / 3) * GRID_HEIGHT + START_Y;
```

### ID生成策略

#### 表ID和字段ID
使用随机字符串生成器,推荐以下格式:
- 长度: 21个字符
- 字符集: `A-Za-z0-9_-`
- 示例: `"_KV5MtPf2m4sI7Inu8pat"`, `"B8rPRTDtOv9oD2Gp4bhWL"`

```javascript
function generateId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let id = '';
  for (let i = 0; i < 21; i++) {
    id += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return id;
}
```

#### 索引ID
使用数字递增: 0, 1, 2, 3, ...

---

## DBML 格式规范

### 表定义
```dbml
Table table_name [headercolor: #6360f7] {
  id bigint [pk, increment, not null, unique, note: '主键ID']
  field_name varchar(100) [not null, default: '', note: '字段注释']
  
  Note: '表注释'
}
```

### 字段属性
- `pk` - 主键
- `increment` - 自增
- `not null` - 非空
- `unique` - 唯一
- `default: value` - 默认值
- `note: '注释'` - 字段注释

### 关系定义
```dbml
// 多对一关系(N:1)
Ref fk_name {
  table1.field > table2.id [delete: no action, update: no action]
}

// 一对一关系(1:1)
Ref fk_name {
  table1.field - table2.id [delete: no action, update: no action]
}

// 一对多关系(1:N) - 较少用
Ref fk_name {
  table1.id < table2.field [delete: no action, update: no action]
}
```

#### 关系符号
- `>` - many-to-one(多对一)
- `-` - one-to-one(一对一)
- `<` - one-to-many(一对多)

### 索引定义
DBML 中索引在表定义内部:
```dbml
Table table_name {
  id int [pk]
  email varchar(100)
  username varchar(50)
  
  indexes {
    email [unique, name: 'uk_email']
    (username, created_at) [name: 'idx_username_created_at']
  }
}
```

### 数据类型映射

#### MySQL 到 DBML
- `BIGINT` → `bigint`
- `INT` → `int`
- `TINYINT` → `tinyint`
- `VARCHAR(n)` → `varchar(n)`
- `TEXT` → `text`
- `DATETIME` → `datetime`
- `DATE` → `date`
- `DECIMAL(m,n)` → `decimal(m,n)`

### 完整示例
```dbml
Table user_info [headercolor: #6360f7] {
  id bigint [pk, increment, not null, unique, note: '用户ID']
  username varchar(50) [not null, note: '用户名']
  email varchar(100) [not null, note: '邮箱地址']
  phone varchar(20) [note: '手机号码']
  created_at datetime [not null, default: `CURRENT_TIMESTAMP`, note: '创建时间']
  updated_at datetime [not null, default: `CURRENT_TIMESTAMP`, note: '更新时间']
  is_deleted tinyint(1) [not null, default: 0, note: '是否删除']
  
  indexes {
    email [unique, name: 'uk_email']
    phone [unique, name: 'uk_phone']
    username [name: 'idx_username']
  }
  
  Note: '用户信息表'
}

Table user_profile [headercolor: #bc49c4] {
  id bigint [pk, increment, not null, unique, note: '档案ID']
  user_id bigint [not null, unique, note: '用户ID']
  avatar varchar(500) [note: '头像URL']
  gender tinyint [note: '性别:0-未知,1-男,2-女']
  birthday date [note: '生日']
  created_at datetime [not null, default: `CURRENT_TIMESTAMP`, note: '创建时间']
  updated_at datetime [not null, default: `CURRENT_TIMESTAMP`, note: '更新时间']
  is_deleted tinyint(1) [not null, default: 0, note: '是否删除']
  
  indexes {
    user_id [unique, name: 'uk_user_id']
  }
  
  Note: '用户档案表'
}

Ref user_profile_user_id_fk {
  user_profile.user_id - user_info.id [delete: no action, update: no action]
}
```

---

## 生成规范

### JSON 生成步骤

1. **生成表和字段的ID**
   - 为每个表生成唯一的随机字符串ID
   - 为每个字段生成唯一的随机字符串ID
   - 创建ID到表名和字段名的映射,以便后续查找

2. **构建表结构**
   - 按照Tables结构格式创建每个表
   - 设置正确的坐标(网格布局)
   - 轮换使用预定义颜色

3. **构建字段**
   - type字段包含完整类型定义(如 "VARCHAR(100)")
   - default值始终用字符串表示
   - 正确设置primary, unique, notNull, increment标志

4. **构建索引**
   - 使用数字ID递增(从0开始,跨所有表)
   - fields数组使用字段名称,不是字段ID

5. **构建关系**
   - 为每个关系生成唯一的随机字符串ID
   - 使用正确的表ID和字段ID(随机字符串)
   - 根据UNIQUE约束设置cardinality

### DBML 生成顺序
1. 逐个生成表定义
2. 在每个表内定义字段
3. 在表内定义索引(如有)
4. 添加表注释
5. 最后生成所有关系定义

### Comment处理
- JSON格式: 直接在 `comment` 字段中填入中文注释
- DBML格式: 在 `note: '注释'` 属性中填入中文注释
- 表注释: JSON用 `comment`,DBML用 `Note: '注释'`

### 关系推断规则
1. 识别所有 `xxx_id` 字段作为外键候选
2. 根据命名找到对应的目标表
3. 目标字段通常是目标表的主键(一般是第一个字段)
4. 根据字段是否有 UNIQUE 约束判断关系类型:
   - 有UNIQUE → one-to-one
   - 无UNIQUE → many_to_one

---

## 完整JSON生成示例

```json
{
  "tables": [
    {
      "id": "Abc123XyZ456pQrStUv78",
      "name": "user_info",
      "comment": "用户信息表",
      "color": "#6360f7",
      "fields": [
        {
          "id": "fld001Abc123XyZ456pQr",
          "name": "id",
          "type": "BIGINT",
          "default": "",
          "check": "",
          "primary": true,
          "unique": true,
          "notNull": true,
          "increment": true,
          "comment": "用户ID"
        },
        {
          "id": "fld002Def456UvW789xYz",
          "name": "username",
          "type": "VARCHAR(50)",
          "default": "",
          "check": "",
          "primary": false,
          "unique": false,
          "notNull": true,
          "increment": false,
          "comment": "用户名"
        },
        {
          "id": "fld003Ghi789AbC012dEf",
          "name": "email",
          "type": "VARCHAR(100)",
          "default": "",
          "check": "",
          "primary": false,
          "unique": true,
          "notNull": true,
          "increment": false,
          "comment": "邮箱地址"
        }
      ],
      "indices": [
        {
          "id": 0,
          "fields": ["email"],
          "name": "uk_email",
          "unique": true
        },
        {
          "id": 1,
          "fields": ["username"],
          "name": "idx_username",
          "unique": false
        }
      ],
      "x": 50.0,
      "y": 50.0
    },
    {
      "id": "Xyz789MnO012pQrStUv34",
      "name": "order_info",
      "comment": "订单信息表",
      "color": "#bc49c4",
      "fields": [
        {
          "id": "fld004Jkl345MnO678pQr",
          "name": "id",
          "type": "BIGINT",
          "default": "",
          "check": "",
          "primary": true,
          "unique": true,
          "notNull": true,
          "increment": true,
          "comment": "订单ID"
        },
        {
          "id": "fld005Stu901VwX234yZa",
          "name": "user_id",
          "type": "BIGINT",
          "default": "",
          "check": "",
          "primary": false,
          "unique": false,
          "notNull": true,
          "increment": false,
          "comment": "用户ID"
        },
        {
          "id": "fld006Bcd567EfG890hIj",
          "name": "order_no",
          "type": "VARCHAR(50)",
          "default": "",
          "check": "",
          "primary": false,
          "unique": true,
          "notNull": true,
          "increment": false,
          "comment": "订单编号"
        }
      ],
      "indices": [
        {
          "id": 2,
          "fields": ["order_no"],
          "name": "uk_order_no",
          "unique": true
        },
        {
          "id": 3,
          "fields": ["user_id"],
          "name": "idx_user_id",
          "unique": false
        }
      ],
      "x": 500.0,
      "y": 50.0
    }
  ],
  "relationships": [
    {
      "name": "",
      "startTableId": "Xyz789MnO012pQrStUv34",
      "endTableId": "Abc123XyZ456pQrStUv78",
      "endFieldId": "fld001Abc123XyZ456pQr",
      "startFieldId": "fld005Stu901VwX234yZa",
      "id": "rel001Klm678NoP901qRs",
      "updateConstraint": "No action",
      "deleteConstraint": "No action",
      "cardinality": "many_to_one"
    }
  ],
  "notes": [],
  "subjectAreas": [],
  "database": "generic",
  "types": [],
  "title": "电商系统数据库"
}
```
