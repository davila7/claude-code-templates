# Generic Component Patterns

Generic components provide type safety while maintaining reusability. TypeScript infers generic type parameters from prop values — no manual type annotations needed at call site.

## Generic Table Component

Full-featured table with typed columns, custom rendering, sorting.

```typescript
type Column<T> = {
  key: keyof T;
  header: string;
  render?: (value: T[keyof T], item: T) => React.ReactNode;
  sortable?: boolean;
};

type TableProps<T> = {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T) => string | number;
  onSort?: (key: keyof T, direction: 'asc' | 'desc') => void;
  className?: string;
};

function Table<T>({
  data,
  columns,
  keyExtractor,
  onSort,
  className,
}: TableProps<T>) {
  const [sortKey, setSortKey] = React.useState<keyof T | null>(null);
  const [sortDir, setSortDir] = React.useState<'asc' | 'desc'>('asc');

  const handleSort = (key: keyof T) => {
    const newDir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    setSortKey(key);
    setSortDir(newDir);
    onSort?.(key, newDir);
  };

  return (
    <table className={className}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th key={String(col.key)}>
              {col.sortable ? (
                <button onClick={() => handleSort(col.key)}>
                  {col.header}
                  {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                </button>
              ) : (
                col.header
              )}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map((item) => (
          <tr key={keyExtractor(item)}>
            {columns.map((col) => (
              <td key={String(col.key)}>
                {col.render
                  ? col.render(item[col.key], item)
                  : String(item[col.key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Usage:

```typescript
type User = {
  id: number;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: Date;
};

function UserTable({ users }: { users: User[] }) {
  const [sortedUsers, setSortedUsers] = React.useState(users);

  const handleSort = (key: keyof User, direction: 'asc' | 'desc') => {
    const sorted = [...users].sort((a, b) => {
      if (a[key] < b[key]) return direction === 'asc' ? -1 : 1;
      if (a[key] > b[key]) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    setSortedUsers(sorted);
  };

  return (
    <Table
      data={sortedUsers}
      columns={[
        { key: 'name', header: 'Name', sortable: true },
        {
          key: 'email',
          header: 'Email',
          render: (email) => <a href={`mailto:${email}`}>{email}</a>,
        },
        {
          key: 'role',
          header: 'Role',
          render: (role) => (
            <span className={role === 'admin' ? 'badge-admin' : 'badge-user'}>
              {role}
            </span>
          ),
        },
        {
          key: 'createdAt',
          header: 'Created',
          render: (date) => new Date(date).toLocaleDateString(),
          sortable: true,
        },
      ]}
      keyExtractor={(user) => user.id}
      onSort={handleSort}
    />
  );
}
```

## Generic Select/Dropdown

Type-safe select with custom option rendering, searching.

```typescript
type SelectProps<T> = {
  options: T[];
  value: T | null;
  onChange: (value: T) => void;
  getLabel: (option: T) => string;
  getValue: (option: T) => string | number;
  placeholder?: string;
  disabled?: boolean;
  searchable?: boolean;
};

function Select<T>({
  options,
  value,
  onChange,
  getLabel,
  getValue,
  placeholder = 'Select...',
  disabled = false,
  searchable = false,
}: SelectProps<T>) {
  const [search, setSearch] = React.useState('');
  const [isOpen, setIsOpen] = React.useState(false);

  const filtered = searchable
    ? options.filter((opt) =>
        getLabel(opt).toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const handleSelect = (option: T) => {
    onChange(option);
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div className="select-wrapper">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="select-trigger"
      >
        {value ? getLabel(value) : placeholder}
      </button>

      {isOpen && (
        <div className="select-dropdown">
          {searchable && (
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              autoFocus
            />
          )}
          <ul>
            {filtered.map((option) => (
              <li
                key={getValue(option)}
                onClick={() => handleSelect(option)}
                className={value === option ? 'selected' : ''}
              >
                {getLabel(option)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
```

Usage:

```typescript
type Country = {
  code: string;
  name: string;
  flag: string;
};

const countries: Country[] = [
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽' },
];

function CountrySelector() {
  const [country, setCountry] = React.useState<Country | null>(null);

  return (
    <Select
      options={countries}
      value={country}
      onChange={setCountry}
      getLabel={(c) => `${c.flag} ${c.name}`}
      getValue={(c) => c.code}
      searchable
      placeholder="Select country"
    />
  );
}
```

## Generic List with Render Props

Flexible list rendering with type-safe render props.

```typescript
type ListProps<T> = {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  renderEmpty?: () => React.ReactNode;
  keyExtractor: (item: T, index: number) => string | number;
  className?: string;
  as?: 'ul' | 'ol' | 'div';
};

function List<T>({
  items,
  renderItem,
  renderEmpty,
  keyExtractor,
  className,
  as: Component = 'ul',
}: ListProps<T>) {
  if (items.length === 0 && renderEmpty) {
    return <>{renderEmpty()}</>;
  }

  return (
    <Component className={className}>
      {items.map((item, index) => {
        const key = keyExtractor(item, index);
        const element = renderItem(item, index);

        return Component === 'div' ? (
          <div key={key}>{element}</div>
        ) : (
          <li key={key}>{element}</li>
        );
      })}
    </Component>
  );
}
```

Usage:

```typescript
type Task = {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
};

function TaskList({ tasks }: { tasks: Task[] }) {
  return (
    <List
      items={tasks}
      keyExtractor={(task) => task.id}
      renderItem={(task) => (
        <div className={`task priority-${task.priority}`}>
          <input type="checkbox" checked={task.completed} readOnly />
          <span className={task.completed ? 'completed' : ''}>{task.title}</span>
        </div>
      )}
      renderEmpty={() => (
        <div className="empty-state">No tasks yet. Add one to get started!</div>
      )}
      as="div"
    />
  );
}
```

## Constrained Generic Components

Use constraints to ensure required properties or methods.

```typescript
// Constraint: items must have `id` property
type HasId = { id: string | number };

type GridProps<T extends HasId> = {
  items: T[];
  renderCard: (item: T) => React.ReactNode;
  columns?: 2 | 3 | 4;
};

function Grid<T extends HasId>({
  items,
  renderCard,
  columns = 3,
}: GridProps<T>) {
  return (
    <div className={`grid grid-cols-${columns}`}>
      {items.map((item) => (
        <div key={item.id} className="grid-item">
          {renderCard(item)}
        </div>
      ))}
    </div>
  );
}

// Usage - type must have `id` property
type Product = {
  id: number;
  name: string;
  price: number;
  image: string;
};

<Grid
  items={products}
  renderCard={(product) => (
    <div>
      <img src={product.image} alt={product.name} />
      <h3>{product.name}</h3>
      <p>${product.price}</p>
    </div>
  )}
  columns={3}
/>;
```

## Multiple Generic Parameters

Components with multiple type parameters.

```typescript
type PairProps<K, V> = {
  pairs: Array<[K, V]>;
  renderKey: (key: K) => React.ReactNode;
  renderValue: (value: V) => React.ReactNode;
};

function KeyValueList<K, V>({ pairs, renderKey, renderValue }: PairProps<K, V>) {
  return (
    <dl>
      {pairs.map(([key, value], index) => (
        <React.Fragment key={index}>
          <dt>{renderKey(key)}</dt>
          <dd>{renderValue(value)}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

// Usage
type MetricKey = 'cpu' | 'memory' | 'disk';
type MetricValue = { current: number; max: number };

const metrics: Array<[MetricKey, MetricValue]> = [
  ['cpu', { current: 45, max: 100 }],
  ['memory', { current: 8, max: 16 }],
  ['disk', { current: 250, max: 500 }],
];

<KeyValueList
  pairs={metrics}
  renderKey={(key) => <strong>{key.toUpperCase()}</strong>}
  renderValue={(val) => (
    <span>
      {val.current}/{val.max}
    </span>
  )}
/>;
```

## Generic Form Field Component

Reusable form field with type-safe value handling.

```typescript
type FieldProps<T> = {
  name: string;
  label: string;
  value: T;
  onChange: (value: T) => void;
  type: 'text' | 'number' | 'email' | 'password';
  error?: string;
  required?: boolean;
};

function FormField<T extends string | number>({
  name,
  label,
  value,
  onChange,
  type,
  error,
  required = false,
}: FieldProps<T>) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue =
      type === 'number' ? (Number(e.target.value) as T) : (e.target.value as T);
    onChange(newValue);
  };

  return (
    <div className="form-field">
      <label htmlFor={name}>
        {label}
        {required && <span className="required">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={handleChange}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${name}-error` : undefined}
      />
      {error && (
        <span id={`${name}-error`} className="error">
          {error}
        </span>
      )}
    </div>
  );
}

// Usage
function UserForm() {
  const [name, setName] = React.useState('');
  const [age, setAge] = React.useState(0);

  return (
    <form>
      <FormField
        name="name"
        label="Name"
        value={name}
        onChange={setName}
        type="text"
        required
      />
      <FormField
        name="age"
        label="Age"
        value={age}
        onChange={setAge}
        type="number"
      />
    </form>
  );
}
```

## Generic Modal/Dialog

Type-safe modal with generic result type.

```typescript
type ModalProps<T> = {
  isOpen: boolean;
  onClose: (result?: T) => void;
  title: string;
  children: (submit: (result: T) => void) => React.ReactNode;
};

function Modal<T>({ isOpen, onClose, title, children }: ModalProps<T>) {
  if (!isOpen) return null;

  const handleSubmit = (result: T) => {
    onClose(result);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <header>
          <h2>{title}</h2>
          <button onClick={() => onClose()}>×</button>
        </header>
        <div className="modal-body">{children(handleSubmit)}</div>
      </div>
    </div>
  );
}

// Usage
type UserFormData = { name: string; email: string };

function App() {
  const [showModal, setShowModal] = React.useState(false);
  const [formData, setFormData] = React.useState<UserFormData>({
    name: '',
    email: '',
  });

  const handleModalClose = (result?: UserFormData) => {
    if (result) {
      console.log('User submitted:', result);
    }
    setShowModal(false);
  };

  return (
    <>
      <button onClick={() => setShowModal(true)}>Add User</button>

      <Modal<UserFormData>
        isOpen={showModal}
        onClose={handleModalClose}
        title="Add New User"
      >
        {(submit) => (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(formData);
            }}
          >
            <input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Name"
            />
            <input
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Email"
            />
            <button type="submit">Submit</button>
          </form>
        )}
      </Modal>
    </>
  );
}
```
