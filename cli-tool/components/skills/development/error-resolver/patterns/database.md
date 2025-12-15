# Database Error Patterns

Common database errors across PostgreSQL, MySQL, MongoDB, Redis, and SQLite.

## Connection Errors

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
FATAL: connection refused
```

**Causes**:
1. Database server not running
2. Wrong host/port
3. Firewall blocking connection
4. Max connections reached

**Diagnosis**:
```bash
# Check if database is running
# PostgreSQL
pg_isready -h localhost -p 5432

# MySQL
mysqladmin ping -h localhost

# Check port
lsof -i :5432
netstat -an | grep 5432

# Check process
ps aux | grep postgres
ps aux | grep mysql
```

**Solutions**:
```bash
# Start database
# PostgreSQL
brew services start postgresql  # macOS
sudo systemctl start postgresql # Linux

# MySQL
brew services start mysql       # macOS
sudo systemctl start mysql      # Linux

# Docker
docker start postgres_container
```

---

### Authentication Failed

```
FATAL: password authentication failed for user "username"
Access denied for user 'root'@'localhost'
```

**Causes**:
1. Wrong password
2. User doesn't exist
3. Wrong authentication method
4. User lacks permissions

**Solutions**:
```bash
# PostgreSQL - reset password
sudo -u postgres psql
ALTER USER username PASSWORD 'newpassword';

# MySQL - reset password
mysql -u root
ALTER USER 'username'@'localhost' IDENTIFIED BY 'newpassword';
FLUSH PRIVILEGES;

# Check pg_hba.conf for auth method (PostgreSQL)
# Change 'peer' to 'md5' or 'scram-sha-256' for password auth
```

---

### Database Does Not Exist

```
FATAL: database "mydb" does not exist
Unknown database 'mydb'
```

**Solutions**:
```bash
# PostgreSQL
createdb mydb
# Or in psql:
CREATE DATABASE mydb;

# MySQL
mysql -u root -p -e "CREATE DATABASE mydb;"

# Check existing databases
psql -l                    # PostgreSQL
mysql -e "SHOW DATABASES;" # MySQL
```

---

### Connection Timeout

```
Error: Connection timed out
FATAL: connection timeout expired
```

**Causes**:
1. Network latency
2. Database overloaded
3. Firewall issues
4. DNS resolution slow

**Solutions**:
```javascript
// Increase connection timeout
// Node.js pg
const pool = new Pool({
  connectionTimeoutMillis: 10000,  // 10 seconds
})

// Prisma
datasource db {
  url = "postgresql://...?connect_timeout=10"
}
```

---

### Too Many Connections

```
FATAL: too many connections for role "postgres"
ERROR 1040 (HY000): Too many connections
```

**Causes**:
1. Connection leaks (not closing connections)
2. Pool size too large
3. Max connections too low

**Diagnosis**:
```sql
-- PostgreSQL
SELECT count(*) FROM pg_stat_activity;
SELECT * FROM pg_stat_activity WHERE state = 'idle';

-- MySQL
SHOW PROCESSLIST;
SHOW STATUS LIKE 'Threads_connected';
```

**Solutions**:
```sql
-- PostgreSQL - increase max connections
ALTER SYSTEM SET max_connections = 200;
-- Requires restart

-- MySQL
SET GLOBAL max_connections = 200;
```

```javascript
// Use connection pooling properly
const pool = new Pool({
  max: 20,              // Pool size
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

// Always release connections
const client = await pool.connect()
try {
  await client.query('...')
} finally {
  client.release()  // Important!
}
```

---

## Query Errors

### Syntax Error

```
ERROR: syntax error at or near "FROM"
You have an error in your SQL syntax
```

**Common Causes**:
1. Missing quotes around strings
2. Reserved word used as identifier
3. Missing comma in list
4. Wrong function name

**Solutions**:
```sql
-- Quote reserved words
SELECT "order", "user" FROM "table";  -- PostgreSQL
SELECT `order`, `user` FROM `table`;  -- MySQL

-- Check string quoting
WHERE name = 'John'   -- Correct
WHERE name = "John"   -- Wrong in PostgreSQL (double quotes = identifier)
```

---

### Column Does Not Exist

```
ERROR: column "username" does not exist
Unknown column 'username' in 'field list'
```

**Causes**:
1. Typo in column name
2. Case sensitivity issue
3. Column not in table
4. Wrong table alias

**Diagnosis**:
```sql
-- PostgreSQL
\d table_name

-- MySQL
DESCRIBE table_name;
SHOW COLUMNS FROM table_name;
```

**Solutions**:
```sql
-- PostgreSQL is case-sensitive with quoted identifiers
SELECT "Username" FROM users;  -- Looks for exact "Username"
SELECT username FROM users;    -- Looks for lowercase

-- Check actual columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'users';
```

---

### Relation/Table Does Not Exist

```
ERROR: relation "users" does not exist
Table 'database.users' doesn't exist
```

**Causes**:
1. Table not created
2. Wrong schema/database
3. Typo in table name
4. Migrations not run

**Solutions**:
```sql
-- Check existing tables
-- PostgreSQL
\dt
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- MySQL
SHOW TABLES;

-- Check current schema
SELECT current_schema();  -- PostgreSQL
SELECT DATABASE();        -- MySQL
```

```bash
# Run migrations
npx prisma migrate dev
npx sequelize-cli db:migrate
```

---

### Constraint Violation

#### Unique Constraint

```
ERROR: duplicate key value violates unique constraint
Duplicate entry 'value' for key 'PRIMARY'
```

**Solutions**:
```sql
-- Check for existing value
SELECT * FROM users WHERE email = 'test@example.com';

-- Upsert instead of insert
-- PostgreSQL
INSERT INTO users (email, name) VALUES ('test@example.com', 'Test')
ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name;

-- MySQL (8.0.20+)
INSERT INTO users (email, name) VALUES ('test@example.com', 'Test') AS new_values
ON DUPLICATE KEY UPDATE name = new_values.name;
```

#### Foreign Key Constraint

```
ERROR: insert or update violates foreign key constraint
Cannot add or update a child row: a foreign key constraint fails
```

**Solutions**:
```sql
-- Check if referenced record exists
SELECT * FROM parent_table WHERE id = 123;

-- Insert parent first, then child
INSERT INTO parent_table (id) VALUES (123);
INSERT INTO child_table (parent_id) VALUES (123);

-- Or use CASCADE
ALTER TABLE child_table
ADD CONSTRAINT fk_parent
FOREIGN KEY (parent_id) REFERENCES parent_table(id)
ON DELETE CASCADE;
```

#### Not Null Constraint

```
ERROR: null value in column "email" violates not-null constraint
Column 'email' cannot be null
```

**Solutions**:
```sql
-- Provide value
INSERT INTO users (name, email) VALUES ('Test', 'test@example.com');

-- Or add default
ALTER TABLE users ALTER COLUMN email SET DEFAULT 'default@example.com';

-- Or make nullable
ALTER TABLE users ALTER COLUMN email DROP NOT NULL;  -- PostgreSQL
ALTER TABLE users MODIFY email VARCHAR(255) NULL;    -- MySQL
```

---

### Deadlock

```
ERROR: deadlock detected
Deadlock found when trying to get lock
```

**Causes**:
1. Transactions waiting on each other
2. Lock ordering inconsistent
3. Long-running transactions

**Solutions**:
```sql
-- Always access tables in same order across transactions

-- Keep transactions short
BEGIN;
  -- Quick operations only
COMMIT;

-- Use appropriate isolation level
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;
```

```javascript
// Helper function
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// Retry on deadlock
async function withRetry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (error.code === '40P01' && i < maxRetries - 1) {  // Deadlock
        await sleep(100 * (i + 1))
        continue
      }
      throw error
    }
  }
}
```

---

## MongoDB Errors

### MongoServerSelectionError

```
MongoServerSelectionError: connect ECONNREFUSED 127.0.0.1:27017
```

**Solutions**:
```bash
# Start MongoDB
brew services start mongodb-community  # macOS
sudo systemctl start mongod            # Linux

# Check status
mongosh --eval "db.adminCommand('ping')"
```

---

### MongoError: E11000 duplicate key error

```
MongoError: E11000 duplicate key error collection: db.users index: email_1
```

**Solutions**:
```javascript
// Upsert
await User.findOneAndUpdate(
  { email: 'test@example.com' },
  { $set: { name: 'Test' } },
  { upsert: true }
)

// Or handle error
try {
  await user.save()
} catch (error) {
  if (error.code === 11000) {
    // Handle duplicate
  }
}
```

---

### MongooseError: Operation timed out

```
MongooseError: Operation `users.find()` buffering timed out after 10000ms
```

**Causes**:
1. Not connected to database
2. Connection dropped
3. Query too slow

**Solutions**:
```javascript
// Wait for connection
await mongoose.connect(uri)
console.log('Connected to MongoDB')

// Then start server
app.listen(3000)

// Add connection events
mongoose.connection.on('error', console.error)
mongoose.connection.on('disconnected', () => {
  console.log('MongoDB disconnected')
})
```

---

## Redis Errors

### ECONNREFUSED

```
Error: Redis connection to 127.0.0.1:6379 failed - connect ECONNREFUSED
```

**Solutions**:
```bash
# Start Redis
brew services start redis  # macOS
sudo systemctl start redis # Linux

# Test connection
redis-cli ping
```

---

### WRONGTYPE

```
WRONGTYPE Operation against a key holding the wrong kind of value
```

**Causes**:
1. Key exists with different type
2. Using wrong command for data type

**Solutions**:
```bash
# Check key type
TYPE mykey

# Delete and recreate with correct type
DEL mykey
```

---

### OOM command not allowed

```
OOM command not allowed when used memory > 'maxmemory'
```

**Solutions**:
```bash
# Increase max memory
redis-cli CONFIG SET maxmemory 2gb

# Set eviction policy
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# In redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
```

---

## Quick Reference Table

| Error | Database | Quick Fix |
|-------|----------|-----------|
| Connection refused | All | Start database service |
| Auth failed | All | Check credentials, reset password |
| DB doesn't exist | All | Create database |
| Too many connections | All | Use connection pooling |
| Unique constraint | All | Use upsert |
| Foreign key violation | All | Insert parent first |
| Deadlock | All | Retry with backoff |
| E11000 duplicate | MongoDB | Use findOneAndUpdate with upsert |
| WRONGTYPE | Redis | Check key type with TYPE |
