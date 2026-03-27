# Algorithm Optimization Rules

## Time Complexity Analysis

### O(1) - Constant Time (Best)
**Use for**: Hash table lookups, array access by index
```javascript
// ✅ O(1) - Optimal
const user = usersMap.get(userId);
const item = array[index];
```

### O(log n) - Logarithmic (Excellent)
**Use for**: Binary search, balanced tree operations
```javascript
// ✅ O(log n) - Binary search
function binarySearch(arr, target) {
  let left = 0, right = arr.length - 1;
  
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (arr[mid] === target) return mid;
    if (arr[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}
```

### O(n) - Linear (Good)
**Use for**: Single pass through data, hash map creation
```javascript
// ✅ O(n) - Single pass
function findDuplicates(items) {
  const seen = new Set();
  const duplicates = new Set();
  
  for (const item of items) {
    if (seen.has(item)) duplicates.add(item);
    seen.add(item);
  }
  
  return Array.from(duplicates);
}
```

### O(n log n) - Linearithmic (Acceptable)
**Use for**: Efficient sorting, merge operations
```javascript
// ✅ O(n log n) - Optimal sorting
const sorted = items.sort((a, b) => a - b);

// ✅ O(n log n) - Merge sort for large datasets
function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  
  return merge(left, right);
}
```

### O(n²) - Quadratic (Avoid)
**Avoid**: Nested loops, bubble sort
```javascript
// ❌ O(n²) - Inefficient
function findDuplicates(items) {
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (items[i] === items[j]) return true;
    }
  }
}

// ✅ O(n) - Optimized with Set
function findDuplicates(items) {
  return items.length !== new Set(items).size;
}
```

### O(2ⁿ) - Exponential (Never Use)
**Avoid**: Naive recursive solutions without memoization
```javascript
// ❌ O(2ⁿ) - Exponential
function fibonacci(n) {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}

// ✅ O(n) - With memoization
function fibonacci(n, memo = {}) {
  if (n <= 1) return n;
  if (memo[n]) return memo[n];
  memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo);
  return memo[n];
}
```

## Space Complexity Optimization

### In-Place Algorithms (O(1) space)
```javascript
// ✅ In-place reversal
function reverseArray(arr) {
  let left = 0, right = arr.length - 1;
  while (left < right) {
    [arr[left], arr[right]] = [arr[right], arr[left]];
    left++;
    right--;
  }
  return arr;
}
```

### Avoid Unnecessary Copies
```javascript
// ❌ Creates new array each iteration
let result = [];
for (const item of items) {
  result = [...result, item]; // O(n) per iteration = O(n²) total
}

// ✅ Mutates existing array
const result = [];
for (const item of items) {
  result.push(item); // O(1) per iteration = O(n) total
}
```

## Data Structure Selection

### Hash Map/Set - O(1) Lookup
**Use for**: Fast lookups, deduplication, counting
```javascript
// ✅ O(n) with hash map
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i];
    if (map.has(complement)) {
      return [map.get(complement), i];
    }
    map.set(nums[i], i);
  }
}
```

### Array - O(1) Access, O(n) Search
**Use for**: Ordered data, index-based access
```javascript
// ✅ Direct access
const item = array[5]; // O(1)

// ❌ Linear search
const found = array.find(x => x.id === targetId); // O(n)

// ✅ Binary search if sorted
const index = binarySearch(sortedArray, target); // O(log n)
```

### Linked List - O(1) Insert/Delete at ends
**Use for**: Frequent insertions/deletions, queue/stack
```javascript
// ✅ O(1) operations at ends
class Queue {
  constructor() {
    this.head = null;
    this.tail = null;
  }
  
  enqueue(value) { // O(1)
    const node = { value, next: null };
    if (!this.tail) {
      this.head = this.tail = node;
    } else {
      this.tail.next = node;
      this.tail = node;
    }
  }
  
  dequeue() { // O(1)
    if (!this.head) return null;
    const value = this.head.value;
    this.head = this.head.next;
    if (!this.head) this.tail = null;
    return value;
  }
}
```

### Tree - O(log n) Operations (if balanced)
**Use for**: Hierarchical data, range queries
```javascript
// ✅ Binary search tree
class BST {
  insert(value) { // O(log n) average
    // Implementation
  }
  
  search(value) { // O(log n) average
    // Implementation
  }
}
```

## Algorithm Patterns

### Two Pointers
**Use for**: Array problems, palindromes, pairs
```javascript
// ✅ O(n) - Two pointers
function isPalindrome(s) {
  let left = 0, right = s.length - 1;
  while (left < right) {
    if (s[left] !== s[right]) return false;
    left++;
    right--;
  }
  return true;
}
```

### Sliding Window
**Use for**: Subarray problems, substring problems
```javascript
// ✅ O(n) - Sliding window
function maxSubarraySum(arr, k) {
  let maxSum = 0, windowSum = 0;
  
  // Initial window
  for (let i = 0; i < k; i++) {
    windowSum += arr[i];
  }
  maxSum = windowSum;
  
  // Slide window
  for (let i = k; i < arr.length; i++) {
    windowSum = windowSum - arr[i - k] + arr[i];
    maxSum = Math.max(maxSum, windowSum);
  }
  
  return maxSum;
}
```

### Dynamic Programming
**Use for**: Optimization problems, overlapping subproblems
```javascript
// ✅ O(n) - DP with memoization
function climbStairs(n, memo = {}) {
  if (n <= 2) return n;
  if (memo[n]) return memo[n];
  memo[n] = climbStairs(n - 1, memo) + climbStairs(n - 2, memo);
  return memo[n];
}
```

### Divide and Conquer
**Use for**: Sorting, searching, tree problems
```javascript
// ✅ O(n log n) - Merge sort
function mergeSort(arr) {
  if (arr.length <= 1) return arr;
  
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid));
  const right = mergeSort(arr.slice(mid));
  
  return merge(left, right);
}

function merge(left, right) {
  const result = [];
  let i = 0, j = 0;
  
  while (i < left.length && j < right.length) {
    if (left[i] <= right[j]) {
      result.push(left[i++]);
    } else {
      result.push(right[j++]);
    }
  }
  
  return result.concat(left.slice(i)).concat(right.slice(j));
}
```

### Greedy Algorithms
**Use for**: Optimization when local optimum = global optimum
```javascript
// ✅ O(n log n) - Activity selection
function maxActivities(activities) {
  // Sort by end time
  activities.sort((a, b) => a.end - b.end);
  
  const selected = [activities[0]];
  let lastEnd = activities[0].end;
  
  for (let i = 1; i < activities.length; i++) {
    if (activities[i].start >= lastEnd) {
      selected.push(activities[i]);
      lastEnd = activities[i].end;
    }
  }
  
  return selected;
}
```

## Database Query Optimization

### Use Indexes
```sql
-- ❌ Full table scan
SELECT * FROM users WHERE email = 'user@example.com';

-- ✅ Index scan
CREATE INDEX idx_users_email ON users(email);
SELECT * FROM users WHERE email = 'user@example.com';
```

### Avoid N+1 Queries
```javascript
// ❌ N+1 queries
const users = await User.findAll();
for (const user of users) {
  user.posts = await Post.findAll({ where: { userId: user.id } });
}

// ✅ 2 queries with JOIN
const users = await User.findAll({
  include: [{ model: Post }]
});
```

### Use Pagination
```sql
-- ❌ Load everything
SELECT * FROM posts ORDER BY created_at DESC;

-- ✅ Paginate
SELECT * FROM posts 
ORDER BY created_at DESC 
LIMIT 20 OFFSET 0;
```

### Batch Operations
```javascript
// ❌ Individual inserts
for (const user of users) {
  await db.query('INSERT INTO users VALUES (?)', [user]);
}

// ✅ Batch insert
await db.query('INSERT INTO users VALUES ?', [users]);
```

## Caching Strategies

### Memoization (Function-level)
```javascript
// ✅ Cache expensive computations
const memoize = (fn) => {
  const cache = new Map();
  return (...args) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) return cache.get(key);
    const result = fn(...args);
    cache.set(key, result);
    return result;
  };
};

const expensiveFunction = memoize((n) => {
  // Expensive computation
  return result;
});
```

### LRU Cache (Memory-efficient)
```javascript
// ✅ O(1) get/put with size limit
class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map();
  }
  
  get(key) {
    if (!this.cache.has(key)) return -1;
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value); // Move to end
    return value;
  }
  
  put(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    this.cache.set(key, value);
  }
}
```

## Async Optimization

### Parallel Execution
```javascript
// ❌ Sequential - 3 seconds total
const user = await fetchUser(); // 1s
const posts = await fetchPosts(); // 1s
const comments = await fetchComments(); // 1s

// ✅ Parallel - 1 second total
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
]);
```

### Debouncing
```javascript
// ✅ Limit function calls
function debounce(fn, delay) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
}

const search = debounce(async (query) => {
  const results = await api.search(query);
  displayResults(results);
}, 300);
```

### Throttling
```javascript
// ✅ Rate limit function calls
function throttle(fn, limit) {
  let inThrottle;
  return (...args) => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

const handleScroll = throttle(() => {
  // Handle scroll
}, 100);
```

## Detection Rules

**Flag as inefficient if**:
- Nested loops (O(n²) or worse)
- Array methods in loops (map/filter/reduce inside for)
- Repeated database queries in loops
- No indexes on queried columns
- Full table scans
- Unnecessary data copying
- Missing memoization for recursive functions
- Sequential async operations that could be parallel

**Suggest optimization if**:
- Time complexity > O(n log n)
- Space complexity > O(n)
- Database queries > 10 per request
- No caching for expensive operations
- No pagination for large datasets
- No debouncing/throttling for frequent events

## Quick Reference

| Operation | Bad | Good | Complexity |
|-----------|-----|------|------------|
| Find duplicates | Nested loops | Set | O(n²) → O(n) |
| Search sorted | Linear search | Binary search | O(n) → O(log n) |
| Fibonacci | Naive recursion | Memoization | O(2ⁿ) → O(n) |
| Array reversal | Create new array | In-place swap | O(n) space → O(1) |
| Database queries | N+1 queries | JOIN/IN clause | N+1 → 2 queries |
| Async operations | Sequential | Parallel | 3x time → 1x time |
| Frequent events | Every call | Debounce/throttle | 100 calls → 1 call |
`