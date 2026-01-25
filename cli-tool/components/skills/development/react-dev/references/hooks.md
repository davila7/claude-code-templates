# Hook TypeScript Patterns

Type-safe hook patterns for useState, useRef, useReducer, useContext, and custom hooks.

## useState

Type inference works for simple types; explicit typing needed for unions/null.

```typescript
// Inference works
const [count, setCount] = useState(0); // number
const [name, setName] = useState(''); // string
const [items, setItems] = useState<string[]>([]); // explicit for empty arrays

// Explicit for unions/null
const [user, setUser] = useState<User | null>(null);
const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

// Complex initial state
type FormData = { name: string; email: string };
const [formData, setFormData] = useState<FormData>({
  name: '',
  email: '',
});

// Lazy initialization
const [data, setData] = useState<Data>(() => {
  const cached = localStorage.getItem('data');
  return cached ? JSON.parse(cached) : defaultData;
});
```

## useRef

Distinguish DOM refs (null initial) from mutable value refs (value initial).

```typescript
// DOM element ref - null initial, readonly .current
const inputRef = useRef<HTMLInputElement>(null);
const buttonRef = useRef<HTMLButtonElement>(null);
const divRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  inputRef.current?.focus(); // Optional chaining for null
}, []);

// Mutable value ref - non-null initial, mutable .current
const countRef = useRef<number>(0);
countRef.current += 1; // No optional chaining

const previousValueRef = useRef<string | undefined>(undefined);
previousValueRef.current = currentValue;

// Interval/timeout ref
const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
const intervalRef = useRef<ReturnType<typeof setInterval>>();

useEffect(() => {
  timeoutRef.current = setTimeout(() => {}, 1000);
  return () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };
}, []);

// Callback ref for dynamic elements
const callbackRef = useCallback((node: HTMLDivElement | null) => {
  if (node) {
    node.scrollIntoView({ behavior: 'smooth' });
  }
}, []);
```

## useReducer

Typed actions with discriminated unions.

```typescript
type State = {
  count: number;
  status: 'idle' | 'loading' | 'success' | 'error';
  error?: string;
};

type Action =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'set'; payload: number }
  | { type: 'setStatus'; payload: State['status'] }
  | { type: 'setError'; payload: string };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment':
      return { ...state, count: state.count + 1 };
    case 'decrement':
      return { ...state, count: state.count - 1 };
    case 'set':
      return { ...state, count: action.payload };
    case 'setStatus':
      return { ...state, status: action.payload };
    case 'setError':
      return { ...state, status: 'error', error: action.payload };
    default:
      return state;
  }
}

function Component() {
  const [state, dispatch] = useReducer(reducer, {
    count: 0,
    status: 'idle',
  });

  dispatch({ type: 'set', payload: 10 }); // Type-safe
  dispatch({ type: 'set' }); // Error: payload required
  dispatch({ type: 'unknown' }); // Error: invalid action type
}
```

### Reducer with Context

```typescript
type AuthState = {
  user: User | null;
  isAuthenticated: boolean;
};

type AuthAction =
  | { type: 'login'; payload: User }
  | { type: 'logout' };

type AuthContextValue = {
  state: AuthState;
  dispatch: React.Dispatch<AuthAction>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'login':
      return { user: action.payload, isAuthenticated: true };
    case 'logout':
      return { user: null, isAuthenticated: false };
  }
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, {
    user: null,
    isAuthenticated: false,
  });

  return (
    <AuthContext.Provider value={{ state, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
}

function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
```

## useContext

Typed context with and without default values.

```typescript
// Context with default value
type Theme = 'light' | 'dark';
const ThemeContext = createContext<Theme>('light');

function useTheme() {
  return useContext(ThemeContext); // Always Theme, never null
}

// Context without default (must handle null)
type User = { id: string; name: string };
const UserContext = createContext<User | null>(null);

function useUser() {
  const user = useContext(UserContext);
  if (!user) throw new Error('useUser must be used within UserProvider');
  return user; // Type narrowed to User
}

// Context with complex value
type AppContextValue = {
  theme: Theme;
  user: User | null;
  setTheme: (theme: Theme) => void;
  login: (user: User) => void;
  logout: () => void;
};

const AppContext = createContext<AppContextValue | null>(null);

function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
```

## Custom Hooks

Return type patterns for simple and complex hooks.

```typescript
// Object return - properties accessed by name
function useCounter(initial: number) {
  const [count, setCount] = useState(initial);
  const increment = () => setCount((c) => c + 1);
  const decrement = () => setCount((c) => c - 1);
  const reset = () => setCount(initial);

  return { count, increment, decrement, reset };
}

// Usage
const { count, increment } = useCounter(0);

// Tuple return - positional destructuring
function useToggle(initial = false): [boolean, () => void, () => void, () => void] {
  const [value, setValue] = useState(initial);
  const toggle = () => setValue((v) => !v);
  const setTrue = () => setValue(true);
  const setFalse = () => setValue(false);

  return [value, toggle, setTrue, setFalse];
}

// Usage
const [isOpen, toggleOpen, open, close] = useToggle();

// as const for tuple inference
function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : initial;
  });

  useEffect(() => {
    localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const; // readonly tuple
}

// Generic custom hook
function useFetch<T>(url: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch(url)
      .then((res) => res.json())
      .then((json: T) => {
        if (!cancelled) {
          setData(json);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data, loading, error };
}

// Usage - T inferred from usage or explicit
const { data } = useFetch<User[]>('/api/users');
```

## useCallback and useMemo

Typed callbacks and memoized values.

```typescript
// useCallback with typed parameters
const handleClick = useCallback((id: string, event: React.MouseEvent) => {
  console.log(id, event.target);
}, []);

// useCallback returning value
const formatDate = useCallback((date: Date): string => {
  return date.toLocaleDateString();
}, []);

// useMemo with explicit return type
const sortedItems = useMemo((): Item[] => {
  return [...items].sort((a, b) => a.name.localeCompare(b.name));
}, [items]);

// useMemo with complex computation
const stats = useMemo(() => {
  return {
    total: items.length,
    average: items.reduce((a, b) => a + b.value, 0) / items.length,
    max: Math.max(...items.map((i) => i.value)),
  };
}, [items]);
```

## useImperativeHandle

Expose imperative methods from components.

```typescript
type InputHandle = {
  focus: () => void;
  clear: () => void;
  getValue: () => string;
};

type InputProps = {
  ref?: React.Ref<InputHandle>;
  label: string;
};

function CustomInput({ ref, label }: InputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => {
      if (inputRef.current) inputRef.current.value = '';
    },
    getValue: () => inputRef.current?.value ?? '',
  }));

  return (
    <div>
      <label>{label}</label>
      <input ref={inputRef} />
    </div>
  );
}

// Usage
function Form() {
  const inputRef = useRef<InputHandle>(null);

  const handleSubmit = () => {
    const value = inputRef.current?.getValue();
    inputRef.current?.clear();
  };

  return (
    <form>
      <CustomInput ref={inputRef} label="Name" />
      <button onClick={() => inputRef.current?.focus()}>Focus</button>
    </form>
  );
}
```

## useLayoutEffect

Same signature as useEffect, runs synchronously after DOM mutations.

```typescript
function Tooltip({ targetRef }: { targetRef: React.RefObject<HTMLElement> }) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (targetRef.current && tooltipRef.current) {
      const rect = targetRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + 8,
        left: rect.left,
      });
    }
  }, [targetRef]);

  return (
    <div
      ref={tooltipRef}
      style={{ position: 'fixed', top: position.top, left: position.left }}
    >
      Tooltip content
    </div>
  );
}
```

## useId

Generate unique IDs for accessibility.

```typescript
function FormField({ label }: { label: string }) {
  const id = useId();
  const errorId = useId();

  return (
    <div>
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-describedby={errorId} />
      <span id={errorId}>Error message</span>
    </div>
  );
}
```

## useSyncExternalStore

Subscribe to external stores with SSR support.

```typescript
type Store<T> = {
  getState: () => T;
  subscribe: (callback: () => void) => () => void;
};

function useStore<T>(store: Store<T>): T {
  return useSyncExternalStore(
    store.subscribe,
    store.getState,
    store.getState // Server snapshot
  );
}

// Example: window width store
const widthStore: Store<number> = {
  getState: () => (typeof window !== 'undefined' ? window.innerWidth : 0),
  subscribe: (callback) => {
    window.addEventListener('resize', callback);
    return () => window.removeEventListener('resize', callback);
  },
};

function useWindowWidth() {
  return useSyncExternalStore(
    widthStore.subscribe,
    widthStore.getState,
    () => 0 // Server fallback
  );
}
```
