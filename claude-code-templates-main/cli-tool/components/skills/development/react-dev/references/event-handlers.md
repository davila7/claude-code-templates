# Event Handler TypeScript Patterns

Proper event typing ensures type-safe access to event properties and target elements.

## Mouse Events

```typescript
// Click events
function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
  event.preventDefault();
  event.stopPropagation();

  // Target element typed correctly
  event.currentTarget.disabled = true;
  event.currentTarget.textContent = 'Clicked';

  // Mouse position
  console.log(event.clientX, event.clientY);
  console.log(event.pageX, event.pageY);

  // Mouse buttons
  console.log(event.button); // 0 = left, 1 = middle, 2 = right
  console.log(event.buttons); // Bitmask of pressed buttons

  // Modifier keys
  if (event.ctrlKey || event.metaKey) {
    console.log('Ctrl/Cmd + Click');
  }
  if (event.shiftKey) {
    console.log('Shift + Click');
  }
  if (event.altKey) {
    console.log('Alt + Click');
  }
}

// Mouse movement
function handleMouseMove(event: React.MouseEvent<HTMLDivElement>) {
  const rect = event.currentTarget.getBoundingClientRect();
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  console.log(`Position in element: ${x}, ${y}`);
}

// Hover events
function handleMouseEnter(event: React.MouseEvent<HTMLDivElement>) {
  event.currentTarget.style.backgroundColor = 'lightblue';
}

function handleMouseLeave(event: React.MouseEvent<HTMLDivElement>) {
  event.currentTarget.style.backgroundColor = '';
}

// Double click
function handleDoubleClick(event: React.MouseEvent<HTMLElement>) {
  console.log('Double clicked');
}
```

## Form Events

```typescript
// Form submission
function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const form = event.currentTarget;
  const formData = new FormData(form);

  const data = {
    name: formData.get('name') as string,
    email: formData.get('email') as string,
  };

  console.log(data);
}

// Input change
function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
  const target = event.target;

  // For text inputs
  if (target.type === 'text' || target.type === 'email') {
    console.log(target.value); // string
  }

  // For checkboxes
  if (target.type === 'checkbox') {
    console.log(target.checked); // boolean
  }

  // For radio buttons
  if (target.type === 'radio') {
    console.log(target.value, target.checked);
  }

  // For number inputs
  if (target.type === 'number') {
    console.log(target.valueAsNumber); // number
  }

  // For file inputs
  if (target.type === 'file') {
    const files = target.files; // FileList | null
    if (files && files.length > 0) {
      console.log(files[0].name);
    }
  }
}

// Textarea change
function handleTextareaChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
  console.log(event.target.value);
  console.log(event.target.selectionStart); // Cursor position
}

// Select change
function handleSelectChange(event: React.ChangeEvent<HTMLSelectElement>) {
  const value = event.target.value;
  const selectedIndex = event.target.selectedIndex;
  const selectedOption = event.target.options[selectedIndex];
  console.log(value, selectedOption.text);
}

// Input events (fires on every keystroke)
function handleInput(event: React.FormEvent<HTMLInputElement>) {
  console.log(event.currentTarget.value);
}

// Reset event
function handleReset(event: React.FormEvent<HTMLFormElement>) {
  event.preventDefault();
  console.log('Form reset');
}
```

## Keyboard Events

```typescript
function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
  // Key identification
  console.log(event.key); // 'Enter', 'Escape', 'a', etc.
  console.log(event.code); // 'Enter', 'Escape', 'KeyA', etc.

  // Common patterns
  if (event.key === 'Enter') {
    event.preventDefault();
    console.log('Enter pressed');
  }

  if (event.key === 'Escape') {
    event.currentTarget.blur();
  }

  // Arrow keys
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    // Navigate up
  }

  // Modifier keys
  if (event.ctrlKey && event.key === 's') {
    event.preventDefault();
    console.log('Ctrl+S - Save');
  }

  if (event.metaKey && event.key === 'k') {
    event.preventDefault();
    console.log('Cmd+K - Search');
  }

  // Check multiple modifiers
  if (event.ctrlKey && event.shiftKey && event.key === 'P') {
    event.preventDefault();
    console.log('Ctrl+Shift+P - Command palette');
  }

  // Key combinations
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    console.log('Submit with Ctrl/Cmd+Enter');
  }
}

function handleKeyUp(event: React.KeyboardEvent<HTMLInputElement>) {
  console.log('Key released:', event.key);
}

function handleKeyPress(event: React.KeyboardEvent<HTMLInputElement>) {
  // Deprecated - use keyDown instead
  console.log('Key pressed:', event.key);
}
```

## Focus Events

```typescript
function handleFocus(event: React.FocusEvent<HTMLInputElement>) {
  // Select all text on focus
  event.target.select();

  // Add visual indicator
  event.currentTarget.classList.add('focused');
}

function handleBlur(event: React.FocusEvent<HTMLInputElement>) {
  // Validate on blur
  const value = event.target.value;
  if (value === '') {
    event.currentTarget.classList.add('error');
  }

  // Remove visual indicator
  event.currentTarget.classList.remove('focused');
}

// Focus within
function handleFocusWithin(event: React.FocusEvent<HTMLDivElement>) {
  // Related target - element receiving focus
  const relatedTarget = event.relatedTarget as HTMLElement | null;
  console.log('Focus moved from:', relatedTarget);
}
```

## Drag and Drop Events

```typescript
function handleDragStart(event: React.DragEvent<HTMLDivElement>) {
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', event.currentTarget.id);

  // Custom drag image
  const dragImage = document.createElement('div');
  dragImage.textContent = 'Dragging...';
  event.dataTransfer.setDragImage(dragImage, 0, 0);
}

function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
  event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
  event.currentTarget.classList.remove('drag-over');
}

function handleDrop(event: React.DragEvent<HTMLDivElement>) {
  event.preventDefault();
  event.currentTarget.classList.remove('drag-over');

  const data = event.dataTransfer.getData('text/plain');
  console.log('Dropped:', data);

  // Handle files
  const files = event.dataTransfer.files;
  if (files.length > 0) {
    Array.from(files).forEach((file) => {
      console.log(file.name, file.type, file.size);
    });
  }
}

function handleDragEnd(event: React.DragEvent<HTMLDivElement>) {
  console.log('Drag ended');
}
```

## Clipboard Events

```typescript
function handleCopy(event: React.ClipboardEvent<HTMLDivElement>) {
  event.preventDefault();

  // Custom copy behavior
  const selection = window.getSelection();
  if (selection) {
    const text = `Copied from app: ${selection.toString()}`;
    event.clipboardData.setData('text/plain', text);
  }
}

function handleCut(event: React.ClipboardEvent<HTMLInputElement>) {
  console.log('Cut:', event.currentTarget.value);
}

function handlePaste(event: React.ClipboardEvent<HTMLInputElement>) {
  event.preventDefault();

  const pastedText = event.clipboardData.getData('text/plain');
  console.log('Pasted:', pastedText);

  // Validate pasted content
  const sanitized = pastedText.replace(/[^a-zA-Z0-9]/g, '');
  event.currentTarget.value = sanitized;
}
```

## Composition Events (IME)

```typescript
// For international input methods (Chinese, Japanese, etc.)
function handleCompositionStart(event: React.CompositionEvent<HTMLInputElement>) {
  console.log('Composition started');
}

function handleCompositionUpdate(event: React.CompositionEvent<HTMLInputElement>) {
  console.log('Composing:', event.data);
}

function handleCompositionEnd(event: React.CompositionEvent<HTMLInputElement>) {
  console.log('Composition ended:', event.data);
}
```

## Touch Events

```typescript
function handleTouchStart(event: React.TouchEvent<HTMLDivElement>) {
  const touch = event.touches[0];
  console.log('Touch start:', touch.clientX, touch.clientY);
}

function handleTouchMove(event: React.TouchEvent<HTMLDivElement>) {
  event.preventDefault(); // Prevent scrolling

  const touch = event.touches[0];
  console.log('Touch move:', touch.clientX, touch.clientY);
}

function handleTouchEnd(event: React.TouchEvent<HTMLDivElement>) {
  console.log('Touch ended');
}

// Multi-touch
function handleMultiTouch(event: React.TouchEvent<HTMLDivElement>) {
  if (event.touches.length === 2) {
    const [touch1, touch2] = event.touches;

    const distance = Math.hypot(
      touch2.clientX - touch1.clientX,
      touch2.clientY - touch1.clientY
    );

    console.log('Pinch distance:', distance);
  }
}
```

## Wheel Events

```typescript
function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
  // Prevent default scroll
  event.preventDefault();

  // Scroll delta
  console.log('Delta X:', event.deltaX);
  console.log('Delta Y:', event.deltaY);
  console.log('Delta Z:', event.deltaZ);

  // Delta mode (0 = pixels, 1 = lines, 2 = pages)
  console.log('Delta mode:', event.deltaMode);

  // Zoom with Ctrl+Wheel
  if (event.ctrlKey) {
    const zoomDelta = event.deltaY > 0 ? -0.1 : 0.1;
    console.log('Zoom:', zoomDelta);
  }
}
```

## Generic Event Handlers

Reusable handlers with proper typing.

```typescript
// Generic change handler
function createChangeHandler<T extends HTMLElement>(
  callback: (value: string) => void
) {
  return (event: React.ChangeEvent<T>) => {
    if ('value' in event.target) {
      callback(event.target.value);
    }
  };
}

// Usage
const handleNameChange = createChangeHandler<HTMLInputElement>((value) => {
  setName(value);
});

const handleBioChange = createChangeHandler<HTMLTextAreaElement>((value) => {
  setBio(value);
});

// Generic click handler with target validation
function createClickHandler<T extends HTMLElement>(
  selector: string,
  callback: (element: T) => void
) {
  return (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement;
    const match = target.closest(selector);

    if (match) {
      callback(match as T);
    }
  };
}

// Usage
const handleItemClick = createClickHandler<HTMLLIElement>('li[data-id]', (item) => {
  const id = item.dataset.id;
  console.log('Clicked item:', id);
});
```

## Event Handler Type Aliases

```typescript
// Create reusable type aliases
type InputChangeHandler = React.ChangeEventHandler<HTMLInputElement>;
type ButtonClickHandler = React.MouseEventHandler<HTMLButtonElement>;
type FormSubmitHandler = React.FormEventHandler<HTMLFormElement>;

// Usage
const handleChange: InputChangeHandler = (event) => {
  console.log(event.target.value);
};

const handleClick: ButtonClickHandler = (event) => {
  event.currentTarget.disabled = true;
};

const handleSubmit: FormSubmitHandler = (event) => {
  event.preventDefault();
};

// Generic handler type
type EventHandler<E extends HTMLElement, Evt extends React.SyntheticEvent> = (
  event: Evt & { currentTarget: E }
) => void;

// Usage
const handleInput: EventHandler<HTMLInputElement, React.ChangeEvent<HTMLInputElement>> = (
  event
) => {
  console.log(event.currentTarget.value);
};
```

## Delegated Event Handlers

Type-safe event delegation.

```typescript
function ListContainer() {
  const handleListClick = (event: React.MouseEvent<HTMLUListElement>) => {
    const target = event.target as HTMLElement;

    // Find clicked list item
    const listItem = target.closest('li');
    if (!listItem) return;

    // Type guard for data attributes
    const itemId = listItem.getAttribute('data-id');
    if (itemId) {
      console.log('Clicked item:', itemId);
    }

    // Handle button within list item
    if (target.matches('button.delete')) {
      event.stopPropagation();
      console.log('Delete clicked');
    }
  };

  return (
    <ul onClick={handleListClick}>
      <li data-id="1">
        Item 1<button className="delete">Delete</button>
      </li>
      <li data-id="2">
        Item 2<button className="delete">Delete</button>
      </li>
    </ul>
  );
}
```

## Native vs Synthetic Events

```typescript
function Component() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    // Native event listener
    const handleNativeClick = (event: MouseEvent) => {
      console.log('Native click:', event.target);
    };

    element.addEventListener('click', handleNativeClick);

    return () => {
      element.removeEventListener('click', handleNativeClick);
    };
  }, []);

  // React synthetic event
  const handleReactClick = (event: React.MouseEvent<HTMLDivElement>) => {
    console.log('React click:', event.target);

    // Access native event
    const nativeEvent = event.nativeEvent;
    console.log('Native event:', nativeEvent);
  };

  return <div ref={ref} onClick={handleReactClick}>Click me</div>;
}
```

## Custom Events

```typescript
// Define custom event type
type CustomEventMap = {
  'user:login': CustomEvent<{ userId: string }>;
  'user:logout': CustomEvent;
};

// Typed custom event dispatcher
function dispatchCustomEvent<K extends keyof CustomEventMap>(
  element: HTMLElement,
  type: K,
  detail?: CustomEventMap[K]['detail']
) {
  const event = new CustomEvent(type, { detail, bubbles: true });
  element.dispatchEvent(event);
}

// Component using custom events
function UserButton() {
  const ref = useRef<HTMLButtonElement>(null);

  const handleLogin = () => {
    if (ref.current) {
      dispatchCustomEvent(ref.current, 'user:login', { userId: '123' });
    }
  };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const handleCustomLogin = (event: Event) => {
      const customEvent = event as CustomEvent<{ userId: string }>;
      console.log('User logged in:', customEvent.detail.userId);
    };

    element.addEventListener('user:login', handleCustomLogin);

    return () => {
      element.removeEventListener('user:login', handleCustomLogin);
    };
  }, []);

  return <button ref={ref} onClick={handleLogin}>Login</button>;
}
```
