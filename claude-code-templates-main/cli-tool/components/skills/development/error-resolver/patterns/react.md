# React Error Patterns

Common React/Next.js errors with diagnosis and solutions.

## Hydration Errors

### Hydration Mismatch

```
Hydration failed because the initial UI does not match what was rendered on the server.
```

**Causes**:
1. Server and client render different content
2. Using browser-only APIs during render
3. Date/time formatting differences
4. Random values in render

**Common Culprits**:
```jsx
// These cause hydration mismatch
{new Date().toLocaleString()}     // Time differs
{Math.random()}                    // Random differs
{typeof window !== 'undefined'}   // Condition differs
{localStorage.getItem('key')}     // No localStorage on server
```

**Solutions**:
```jsx
// Use useEffect for client-only code
const [mounted, setMounted] = useState(false)

useEffect(() => {
  setMounted(true)
}, [])

if (!mounted) return null  // Or return skeleton

return <div>{localStorage.getItem('theme')}</div>
```

```jsx
// Suppress hydration warning (last resort)
<time suppressHydrationWarning>
  {new Date().toLocaleString()}
</time>
```

```jsx
// Use 'use client' directive in Next.js App Router
'use client'

export default function ClientComponent() {
  // Client-only code here
}
```

---

### Text content does not match server-rendered HTML

```
Text content does not match server-rendered HTML.
```

**Same as hydration mismatch** - content differs between server and client.

**Quick Check**:
1. Are you using `Date`, `Math.random()`?
2. Are you accessing `window`, `document`, `localStorage`?
3. Are you using browser-specific formatting?

---

## Hooks Errors

### Invalid hook call

```
Error: Invalid hook call. Hooks can only be called inside of the body of a function component.
```

**Causes**:
1. Hook called outside component
2. Hook called in class component
3. Hook called in regular function
4. Multiple React versions
5. Breaking rules of hooks

**Diagnosis**:
```bash
# Check for multiple React versions
npm ls react
npm ls react-dom
```

**Solutions**:
```jsx
// Wrong - hook in regular function
function getData() {
  const [data, setData] = useState(null)  // Error!
}

// Correct - hook in component
function MyComponent() {
  const [data, setData] = useState(null)  // OK
}

// Correct - custom hook
function useData() {
  const [data, setData] = useState(null)
  return data
}
```

```bash
# Fix multiple React versions
npm dedupe
# Or check and align versions in package.json
```

---

### Rendered more hooks than during previous render

```
Rendered more hooks than during the previous render.
```

**Causes**:
1. Conditional hook calls
2. Hook inside loop
3. Early return before all hooks

**Solutions**:
```jsx
// Wrong - conditional hook
function MyComponent({ condition }) {
  if (condition) {
    const [state, setState] = useState()  // Error!
  }
}

// Correct - always call hooks
function MyComponent({ condition }) {
  const [state, setState] = useState()

  if (!condition) {
    return null
  }

  return <div>{state}</div>
}
```

```jsx
// Wrong - hook in loop
items.forEach(item => {
  const [value, setValue] = useState()  // Error!
})

// Correct - use single state for all items
const [values, setValues] = useState({})
```

---

### Cannot update state on unmounted component

```
Warning: Can't perform a React state update on an unmounted component.
```

**Causes**:
1. Async operation completes after unmount
2. Missing cleanup in useEffect
3. Event listener not removed

**Solutions**:
```jsx
// Use cleanup with flag
useEffect(() => {
  let mounted = true

  fetchData().then(data => {
    if (mounted) {
      setData(data)
    }
  })

  return () => {
    mounted = false
  }
}, [])
```

```jsx
// With AbortController
useEffect(() => {
  const controller = new AbortController()

  fetch(url, { signal: controller.signal })
    .then(res => res.json())
    .then(setData)
    .catch(err => {
      if (err.name !== 'AbortError') {
        setError(err)
      }
    })

  return () => controller.abort()
}, [url])
```

---

## Key Errors

### Each child in a list should have a unique "key" prop

```
Warning: Each child in a list should have a unique "key" prop.
```

**Causes**:
1. Missing key prop in map()
2. Using index as key (not always wrong but can cause issues)
3. Duplicate keys

**Solutions**:
```jsx
// Wrong - no key
{items.map(item => <Item {...item} />)}

// Wrong - index as key (problematic if list reorders)
{items.map((item, index) => <Item key={index} {...item} />)}

// Correct - unique identifier
{items.map(item => <Item key={item.id} {...item} />)}

// If no ID, create stable key
{items.map(item => <Item key={`${item.name}-${item.date}`} {...item} />)}
```

**When index is OK**:
- List is static (never reorders)
- Items have no unique ID
- List never re-renders

---

### Encountered two children with the same key

```
Warning: Encountered two children with the same key "123".
```

**Causes**:
1. Duplicate IDs in data
2. Wrong key property used
3. Key generation produces duplicates

**Solutions**:
```jsx
// Debug - find duplicates
const keys = items.map(i => i.id)
const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i)
console.log('Duplicates:', duplicates)

// Fix - combine fields for uniqueness
{items.map((item, index) => (
  <Item key={`${item.id}-${index}`} {...item} />
))}
```

---

## Props Errors

### Cannot read properties of undefined (reading 'map')

```
TypeError: Cannot read properties of undefined (reading 'map')
```

**Causes**:
1. Data not loaded yet
2. API returned undefined
3. Wrong prop passed

**Solutions**:
```jsx
// Guard with optional chaining
{items?.map(item => <Item key={item.id} {...item} />)}

// With default value
{(items || []).map(item => <Item key={item.id} {...item} />)}

// Loading state
if (!items) return <Loading />
return items.map(item => <Item key={item.id} {...item} />)
```

---

### Objects are not valid as a React child

```
Objects are not valid as a React child (found: object with keys {x, y}).
```

**Causes**:
1. Rendering object directly instead of its properties
2. Rendering Date object
3. Rendering JSON object

**Solutions**:
```jsx
// Wrong
<div>{user}</div>          // user is object
<div>{new Date()}</div>    // Date is object

// Correct
<div>{user.name}</div>
<div>{new Date().toLocaleDateString()}</div>
<div>{JSON.stringify(data)}</div>  // For debugging
```

---

## useEffect Errors

### Maximum update depth exceeded

```
Maximum update depth exceeded. This can happen when a component calls setState inside useEffect.
```

**Causes**:
1. Missing or wrong dependency array
2. State update triggers re-render that triggers effect
3. Object/array in dependency array creates infinite loop

**Solutions**:
```jsx
// Wrong - missing dependency array
useEffect(() => {
  setState(value)  // Runs every render = infinite loop
})

// Wrong - object in deps always "changes"
useEffect(() => {
  // ...
}, [{ id: 1 }])  // New object every render!

// Correct - stable dependency
useEffect(() => {
  setState(value)
}, [])  // Empty = only on mount

// Correct - primitive dependency
const { id } = props
useEffect(() => {
  // ...
}, [id])  // Primitive, stable comparison
```

```jsx
// For objects, use specific properties directly
const { id, name } = config
useEffect(() => {
  // use id, name
}, [id, name])

// Or stringify (use sparingly, can be expensive)
const configStr = JSON.stringify(config)
useEffect(() => {
  // ...
}, [configStr])
```

---

### Missing dependency warning

```
React Hook useEffect has a missing dependency: 'value'.
```

**Solutions**:
```jsx
// Option 1: Add the dependency
useEffect(() => {
  doSomething(value)
}, [value])

// Option 2: Move value inside effect
useEffect(() => {
  const value = calculateValue()
  doSomething(value)
}, [])

// Option 3: Use functional update (for setState)
useEffect(() => {
  setCount(prev => prev + 1)  // No dependency on count
}, [])

// Option 4: Intentionally exclude (with comment)
useEffect(() => {
  // Only run on mount, intentionally ignoring value changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [])
```

---

## Next.js Specific Errors

### Error: Invariant: headers() expects to have requestAsyncStorage

```
Error: Invariant: headers() expects to have requestAsyncStorage
```

**Causes**:
1. Using server-only function in client component
2. headers(), cookies() called outside request context

**Solutions**:
```jsx
// Mark as server component (default in app directory)
// Remove 'use client' if present

// Or fetch data in server component, pass to client
// Server Component
async function Page() {
  const data = await getData()
  return <ClientComponent data={data} />
}
```

---

### Error: Cannot access 'X' before initialization

```
Error: Cannot access 'Component' before initialization
```

**Causes**:
1. Circular imports
2. Component used before defined
3. Import order issues

**Diagnosis**:
```bash
# Check import chain
grep -r "import.*Component" src/
```

**Solutions**:
```jsx
// Lazy load to break circular dependency
const Component = dynamic(() => import('./Component'), { ssr: false })

// Or restructure imports
// Move shared code to separate file
```

---

### Module not found: Can't resolve 'X'

```
Module not found: Can't resolve 'fs'
```

**Causes**:
1. Node.js module used in client code
2. Missing package
3. Wrong import path

**Solutions**:
```jsx
// For Node.js modules in Next.js
// next.config.js
module.exports = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        fs: false,
        path: false,
      }
    }
    return config
  }
}
```

```jsx
// Use dynamic import with ssr: false
const Component = dynamic(() => import('./ServerComponent'), { ssr: false })

// Or check environment
if (typeof window === 'undefined') {
  // Server-only code
}
```

---

## Build Errors

### Failed to compile

```
Failed to compile
./src/Component.jsx
Module parse failed: Unexpected token
```

**Common Causes**:
1. Syntax error in code
2. Missing babel/typescript config
3. Unsupported syntax

**Check**:
1. Look at the line number mentioned
2. Check for unclosed brackets/quotes
3. Verify file extension matches content

---

### Build error occurred - Cannot read property 'X' of undefined

```
Build error occurred
TypeError: Cannot read property 'map' of undefined
```

**Causes**:
1. Missing data during static generation
2. API call failed during build
3. Environment variable not set

**Solutions**:
```jsx
// Add fallback for missing data
export async function getStaticProps() {
  try {
    const data = await fetchData()
    return { props: { data: data || [] } }
  } catch (error) {
    return { props: { data: [] } }
  }
}
```

---

## Quick Reference Table

| Error | Category | Quick Fix |
|-------|----------|-----------|
| Hydration mismatch | SSR | Use `useEffect` for client-only code |
| Invalid hook call | Hooks | Check hook is in component body |
| More hooks than previous render | Hooks | Don't use conditional hooks |
| Unmounted component update | Async | Add cleanup/mounted flag |
| Missing key prop | List | Add unique `key` to map items |
| Objects not valid as child | Render | Render `obj.property` not `obj` |
| Maximum update depth | useEffect | Check dependency array |
| Cannot access before init | Import | Check for circular imports |
| Module not found: fs | Build | Add webpack fallback |
