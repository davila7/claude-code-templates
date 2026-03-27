# 🎯 Mock Data Reviewer - Complete Example

## Scenario: E-commerce Application

You have an e-commerce app with mock data scattered across multiple files. Let's see how the Mock Data Reviewer handles it.

## Input: Mock Data Files

### File 1: src/data/users.js
```javascript
export const users = [
  { id: 1, name: 'John Doe', email: 'john@example.com', role: 'admin' },
  { id: 2, name: 'Jane Smith', email: 'jane@example.com', role: 'user' },
  { id: 3, name: 'Bob Wilson', email: 'bob@example.com', role: 'user' }
];
```

### File 2: src/data/products.json
```json
[
  { "id": 1, "name": "Laptop", "price": 999.99, "categoryId": 1 },
  { "id": 2, "name": "Mouse", "price": 29.99, "categoryId": 2 },
  { "id": 3, "name": "Keyboard", "price": 79.99, "categoryId": 2 }
]
```

### File 3: src/components/OrderList.jsx
```javascript
function OrderList() {
  const orders = [
    { id: 1, userId: 1, productId: 1, quantity: 2, status: 'shipped' },
    { id: 2, userId: 2, productId: 2, quantity: 1, status: 'pending' }
  ];
  
  return orders.map(order => <OrderCard order={order} />);
}
```

### File 4: src/utils/categories.ts
```typescript
const CATEGORIES = [
  { id: 1, name: 'Electronics', slug: 'electronics' },
  { id: 2, name: 'Accessories', slug: 'accessories' }
];

export function getCategories() {
  return CATEGORIES;
}
```

## Command

```bash
/review --reviewer=mockdata ./src
```

## Output: Generated Files

The reviewer generates 7 files with complete analysis and migration code.


### Output 1: MOCK_DATA_ANALYSIS.md (excerpt)

```markdown
# 📊 Mock Data Analysis Report

**Generated**: 2026-03-27T10:30:00Z
**Analyzed**: ./src
**Total Files Scanned**: 15
**Mock Data Locations Found**: 4

## 📋 Executive Summary

### Overview
- **Total Mock Data Locations**: 4
- **Total Data Records**: 10
- **Database Tables Needed**: 4
- **Junction Tables Needed**: 0
- **Complexity Level**: Moderate
- **Estimated Migration Time**: 2 hours

### Quick Stats
- Arrays/Objects: 3 locations
- JSON Files: 1 file
- Mock Functions: 1 function
- Hardcoded Data: 1 location

### Recommended Database
- **Primary Choice**: PostgreSQL (via Supabase)
- **Reason**: Relational data with foreign keys, perfect for PostgreSQL
- **Alternative**: N/A

## 🗂️ Mock Data Inventory

### 1. Users Mock Data

**📍 Location**: `src/data/users.js:1-5`
**📦 Type**: Array of objects
**📊 Records**: 3 users
**🔗 Relationships**: 
  - Has many: orders

**📐 Data Structure**:
```javascript
{
  id: number,
  name: string,
  email: string,
  role: 'admin' | 'user'
}
```

**🎯 Recommended Table**: `users`
**🔑 Primary Key**: `id` (UUID)
**🔗 Foreign Keys**: None

**📇 Indexes Needed**:
  - `email` (unique)
  - `role`

**🛡️ RLS Policies Needed**:
  - Users can read own data
  - Admins can read all data
  - Users cannot modify role

**⚠️ Data Quality Issues**: None

**🔄 Migration Priority**: HIGH (referenced by orders)

### 2. Products Mock Data

**📍 Location**: `src/data/products.json:1-5`
**📦 Type**: JSON array
**📊 Records**: 3 products
**🔗 Relationships**: 
  - Belongs to: categories
  - Has many: orders (through order_items)

**📐 Data Structure**:
```javascript
{
  id: number,
  name: string,
  price: number,
  categoryId: number
}
```

**🎯 Recommended Table**: `products`
**🔑 Primary Key**: `id` (UUID)
**🔗 Foreign Keys**:
  - `category_id` → categories(id)

**📇 Indexes Needed**:
  - `category_id`
  - `name`

**🛡️ RLS Policies Needed**:
  - All users can read products
  - Only admins can modify products

**⚠️ Data Quality Issues**: None

**🔄 Migration Priority**: MEDIUM

### 3. Orders Mock Data

**📍 Location**: `src/components/OrderList.jsx:3-6`
**📦 Type**: Hardcoded array in component
**📊 Records**: 2 orders
**🔗 Relationships**: 
  - Belongs to: users, products

**📐 Data Structure**:
```javascript
{
  id: number,
  userId: number,
  productId: number,
  quantity: number,
  status: 'pending' | 'shipped' | 'delivered'
}
```

**🎯 Recommended Table**: `orders`
**🔑 Primary Key**: `id` (UUID)
**🔗 Foreign Keys**:
  - `user_id` → users(id)
  - `product_id` → products(id)

**📇 Indexes Needed**:
  - `user_id`
  - `product_id`
  - `status`
  - `created_at`

**🛡️ RLS Policies Needed**:
  - Users can read own orders
  - Admins can read all orders
  - Users can create orders for themselves

**⚠️ Data Quality Issues**: None

**🔄 Migration Priority**: MEDIUM

### 4. Categories Mock Data

**📍 Location**: `src/utils/categories.ts:1-4`
**📦 Type**: Constant in function
**📊 Records**: 2 categories
**🔗 Relationships**: 
  - Has many: products

**📐 Data Structure**:
```javascript
{
  id: number,
  name: string,
  slug: string
}
```

**🎯 Recommended Table**: `categories`
**🔑 Primary Key**: `id` (UUID)
**🔗 Foreign Keys**: None

**📇 Indexes Needed**:
  - `slug` (unique)

**🛡️ RLS Policies Needed**:
  - All users can read categories
  - Only admins can modify categories

**⚠️ Data Quality Issues**: None

**🔄 Migration Priority**: HIGH (referenced by products)

## 🗺️ Entity Relationship Diagram

```
┌─────────────┐         ┌─────────────┐
│  categories │────────<│  products   │
│             │         │             │
│ id (PK)     │         │ id (PK)     │
│ name        │         │ category_id │
│ slug        │         │ name        │
└─────────────┘         │ price       │
                        └─────────────┘
                               │
                               │
┌─────────────┐                │
│    users    │                │
│             │                │
│ id (PK)     │                │
│ name        │                │
│ email       │                │
│ role        │                │
└─────────────┘                │
       │                       │
       │                       │
       └───────┬───────────────┘
               │
               ▼
        ┌─────────────┐
        │   orders    │
        │             │
        │ id (PK)     │
        │ user_id (FK)│
        │ product_id  │
        │ quantity    │
        │ status      │
        └─────────────┘
```

## 📈 Database Schema Recommendations

### Tables to Create (in dependency order)
1. **categories** (no dependencies)
2. **users** (no dependencies)
3. **products** (depends on: categories)
4. **orders** (depends on: users, products)

### Estimated Database Size
- Initial: ~50 KB
- With indexes: ~100 KB
- Expected growth: 10 MB/month

## 🔄 Migration Strategy

### Phase 1: Schema Creation (20 min)
1. Run `001_initial_schema.sql`
2. Verify tables created
3. Check constraints and indexes
4. Enable RLS policies

### Phase 2: Data Seeding (10 min)
1. Run `seed.sql`
2. Verify data imported
3. Check relationships
4. Validate constraints

### Phase 3: Code Integration (1 hour)
1. Install Supabase client
2. Replace mock data imports
3. Update API calls
4. Test CRUD operations

### Phase 4: Testing (30 min)
1. Test all queries
2. Verify RLS policies
3. Test relationships
4. Performance testing

### Total Estimated Time: 2 hours

## 🎯 Next Steps

1. ✅ Review this analysis
2. ✅ Run migrations in order
3. ✅ Update code to use Supabase
4. ✅ Test thoroughly
5. ✅ Deploy to production
```


### Output 2: database/migrations/001_initial_schema.sql (excerpt)

```sql
-- ============================================================================
-- Migration: Initial Schema
-- Created: 2026-03-27T10:30:00Z
-- Description: Convert mock data to production database schema
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLES (in dependency order)
-- ============================================================================

-- Table: categories
-- Description: Product categories
-- Source: src/utils/categories.ts
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE categories IS 'Product categories for e-commerce';

-- Table: users
-- Description: Application users
-- Source: src/data/users.js
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  role VARCHAR(50) NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE users IS 'Application users with role-based access';

-- Table: products
-- Description: Products for sale
-- Source: src/data/products.json
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  category_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE products IS 'Products available for purchase';

-- Table: orders
-- Description: Customer orders
-- Source: src/components/OrderList.jsx
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'shipped', 'delivered', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

COMMENT ON TABLE orders IS 'Customer orders with status tracking';

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Indexes for categories
CREATE UNIQUE INDEX idx_categories_slug ON categories(slug);
CREATE INDEX idx_categories_deleted_at ON categories(deleted_at) WHERE deleted_at IS NULL;

-- Indexes for users
CREATE UNIQUE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_deleted_at ON users(deleted_at) WHERE deleted_at IS NULL;

-- Indexes for products
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_deleted_at ON products(deleted_at) WHERE deleted_at IS NULL;

-- Indexes for orders
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_product_id ON orders(product_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_deleted_at ON orders(deleted_at) WHERE deleted_at IS NULL;

-- ============================================================================
-- FOREIGN KEYS
-- ============================================================================

ALTER TABLE products 
  ADD CONSTRAINT fk_products_category_id 
  FOREIGN KEY (category_id) 
  REFERENCES categories(id)
  ON DELETE RESTRICT;

ALTER TABLE orders 
  ADD CONSTRAINT fk_orders_user_id 
  FOREIGN KEY (user_id) 
  REFERENCES users(id)
  ON DELETE CASCADE;

ALTER TABLE orders 
  ADD CONSTRAINT fk_orders_product_id 
  FOREIGN KEY (product_id) 
  REFERENCES products(id)
  ON DELETE RESTRICT;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for all tables
CREATE TRIGGER update_categories_updated_at
  BEFORE UPDATE ON categories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Categories policies (public read, admin write)
CREATE POLICY "Anyone can read categories"
  ON categories FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY "Admins can manage categories"
  ON categories FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Users policies (own data + admin)
CREATE POLICY "Users can read own data"
  ON users FOR SELECT
  USING (auth.uid() = id OR EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

CREATE POLICY "Users can update own data"
  ON users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT role FROM users WHERE id = auth.uid()));

-- Products policies (public read, admin write)
CREATE POLICY "Anyone can read products"
  ON products FOR SELECT
  USING (deleted_at IS NULL);

CREATE POLICY "Admins can manage products"
  ON products FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Orders policies (own orders + admin)
CREATE POLICY "Users can read own orders"
  ON orders FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'admin'
  ));

CREATE POLICY "Users can create own orders"
  ON orders FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage all orders"
  ON orders FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- ============================================================================
-- GRANTS
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON users TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON orders TO authenticated;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
```


### Output 3: src/lib/supabase-client.ts

```typescript
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseKey);

// Type-safe query helpers
export const db = {
  categories: {
    async getAll() {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .is('deleted_at', null)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    },

    async getBySlug(slug: string) {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .is('deleted_at', null)
        .single();
      
      if (error) throw error;
      return data;
    }
  },

  users: {
    async getAll() {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },

    async getById(id: string) {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', id)
        .is('deleted_at', null)
        .single();
      
      if (error) throw error;
      return data;
    },

    async create(user: Database['public']['Tables']['users']['Insert']) {
      const { data, error } = await supabase
        .from('users')
        .insert(user)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    async update(id: string, updates: Database['public']['Tables']['users']['Update']) {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  },

  products: {
    async getAll() {
      const { data, error } = await supabase
        .from('products')
        .select('*, category:categories(*)')
        .is('deleted_at', null)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    },

    async getById(id: string) {
      const { data, error } = await supabase
        .from('products')
        .select('*, category:categories(*)')
        .eq('id', id)
        .is('deleted_at', null)
        .single();
      
      if (error) throw error;
      return data;
    },

    async getByCategory(categoryId: string) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('category_id', categoryId)
        .is('deleted_at', null)
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  },

  orders: {
    async getAll() {
      const { data, error } = await supabase
        .from('orders')
        .select('*, user:users(*), product:products(*)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },

    async getByUser(userId: string) {
      const { data, error } = await supabase
        .from('orders')
        .select('*, product:products(*)')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },

    async create(order: Database['public']['Tables']['orders']['Insert']) {
      const { data, error } = await supabase
        .from('orders')
        .insert(order)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },

    async updateStatus(id: string, status: string) {
      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    }
  }
};

// Real-time subscriptions
export const subscribeToOrders = (userId: string, callback: (payload: any) => void) => {
  return supabase
    .channel('order_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${userId}` },
      callback
    )
    .subscribe();
};
```

### Output 4: Code Migration Example

**Before (using mock data):**

```javascript
// src/components/OrderList.jsx
function OrderList() {
  const orders = [
    { id: 1, userId: 1, productId: 1, quantity: 2, status: 'shipped' },
    { id: 2, userId: 2, productId: 2, quantity: 1, status: 'pending' }
  ];
  
  return orders.map(order => <OrderCard order={order} />);
}
```

**After (using Supabase):**

```javascript
// src/components/OrderList.jsx
import { useEffect, useState } from 'react';
import { db } from '@/lib/supabase-client';

function OrderList() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    async function fetchOrders() {
      try {
        const data = await db.orders.getAll();
        setOrders(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchOrders();
  }, []);
  
  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  
  return orders.map(order => <OrderCard order={order} />);
}
```

## Results

### ✅ What Was Achieved

1. **100% Mock Data Detection**
   - Found all 4 mock data locations
   - Identified 10 total records
   - Detected all relationships

2. **Production-Ready SQL**
   - 4 tables with proper constraints
   - 12 indexes for performance
   - Complete RLS policies
   - Automatic timestamp triggers

3. **Type-Safe Integration**
   - Full TypeScript types
   - Query helpers for all tables
   - Error handling
   - Real-time subscriptions

4. **Clear Migration Path**
   - Step-by-step guide
   - Estimated time: 2 hours
   - Before/after code examples
   - Testing checklist

### 📊 Migration Impact

- **Development Time Saved**: 8-10 hours
- **Bugs Prevented**: Estimated 5-10 (type safety, RLS)
- **Performance**: Proper indexes from day 1
- **Security**: RLS policies protect data
- **Scalability**: Ready for production load

### 🎯 Key Features Demonstrated

1. **Comprehensive Detection** - Found mock data in JS, JSON, JSX, and TS files
2. **Relationship Analysis** - Correctly identified foreign keys
3. **Best Practices** - UUID keys, indexes, RLS, triggers
4. **Type Safety** - Full TypeScript support
5. **Developer Experience** - Clear migration guide

---

**This example shows how the Mock Data Reviewer transforms scattered mock data into a production-ready database in minutes, not hours!** 🚀
