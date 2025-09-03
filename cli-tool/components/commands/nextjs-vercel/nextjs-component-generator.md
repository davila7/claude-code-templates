---
allowed-tools: Read, Write, Edit
argument-hint: [component-name] [--client] [--server] [--page] [--layout]
description: Generate optimized React components for Next.js with TypeScript and best practices
model: sonnet
---

## Next.js Component Generator

**Component Name**: $ARGUMENTS

## Project Context Analysis

### Framework Detection
- Next.js config: @next.config.js
- TypeScript config: @tsconfig.json (if exists)
- Tailwind config: @tailwind.config.js (if exists)
- Package.json: @package.json

### Existing Component Patterns
- Components directory: @components/
- App directory: @app/ (if App Router)
- Pages directory: @pages/ (if Pages Router)
- Styles directory: @styles/

## Component Generation Requirements

### 1. Component Type Detection
Based on arguments and context, determine component type:
- **Client Component**: Interactive UI with state/events (`--client` or default for interactive components)
- **Server Component**: Static rendering, data fetching (`--server` or default for Next.js 13+)
- **Page Component**: Route-level component (`--page`)
- **Layout Component**: Shared layout wrapper (`--layout`)

### 2. File Structure Creation
Generate comprehensive component structure:
```
components/[ComponentName]/
├── index.ts                    # Barrel export
├── [ComponentName].tsx         # Main component
├── [ComponentName].module.css  # Component styles
├── [ComponentName].test.tsx    # Unit tests
├── [ComponentName].stories.tsx # Storybook story (if detected)
└── types.ts                   # TypeScript types
```

### 3. Component Templates

#### Server Component Template
```typescript
import { FC } from 'react';
import styles from './ComponentName.module.css';

interface ComponentNameProps {
  /**
   * Component description
   */
  children?: React.ReactNode;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ComponentName - Server Component
 * 
 * @description Brief description of component purpose
 * @example
 * <ComponentName>Content</ComponentName>
 */
export const ComponentName: FC<ComponentNameProps> = ({
  children,
  className = '',
  ...props
}) => {
  return (
    <div className={`${styles.container} ${className}`} {...props}>
      {children}
    </div>
  );
};

export default ComponentName;
```

#### Client Component Template
```typescript
'use client';

import { FC, useState, useEffect } from 'react';
import styles from './ComponentName.module.css';

interface ComponentNameProps {
  /**
   * Component description
   */
  children?: React.ReactNode;
  /**
   * Click event handler
   */
  onClick?: () => void;
  /**
   * Additional CSS classes
   */
  className?: string;
}

/**
 * ComponentName - Client Component
 * 
 * @description Interactive component with client-side functionality
 * @example
 * <ComponentName onClick={() => console.log('clicked')}>
 *   Content
 * </ComponentName>
 */
export const ComponentName: FC<ComponentNameProps> = ({
  children,
  onClick,
  className = '',
  ...props
}) => {
  const [isActive, setIsActive] = useState(false);

  const handleClick = () => {
    setIsActive(!isActive);
    onClick?.();
  };

  return (
    <button
      className={`${styles.button} ${isActive ? styles.active : ''} ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
};

export default ComponentName;
```

#### Page Component Template
```typescript
import { Metadata } from 'next';
import ComponentName from '@/components/ComponentName';

export const metadata: Metadata = {
  title: 'Page Title',
  description: 'Page description',
};

interface PageProps {
  params: { id: string };
  searchParams: { [key: string]: string | string[] | undefined };
}

export default function Page({ params, searchParams }: PageProps) {
  return (
    <main>
      <h1>Page Title</h1>
      <ComponentName />
    </main>
  );
}
```

#### Layout Component Template
```typescript
import { FC } from 'react';
import styles from './Layout.module.css';

interface LayoutProps {
  children: React.ReactNode;
  /**
   * Page title
   */
  title?: string;
}

/**
 * Layout - Shared layout component
 * 
 * @description Provides consistent layout structure across pages
 */
export const Layout: FC<LayoutProps> = ({
  children,
  title,
}) => {
  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        {title && <h1 className={styles.title}>{title}</h1>}
      </header>
      
      <main className={styles.main}>
        {children}
      </main>
      
      <footer className={styles.footer}>
        <p>&copy; 2024 Your App</p>
      </footer>
    </div>
  );
};

export default Layout;
```

### 4. CSS Module Templates

#### Basic Component Styles
```css
/* ComponentName.module.css */
.container {
  display: flex;
  flex-direction: column;
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background-color: #ffffff;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  border: 1px solid transparent;
  background-color: #3b82f6;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.button:hover {
  background-color: #2563eb;
}

.button:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.button.active {
  background-color: #1d4ed8;
}

/* Responsive design */
@media (max-width: 768px) {
  .container {
    padding: 0.75rem;
  }
  
  .button {
    padding: 0.75rem 1rem;
  }
}
```

#### Layout Styles
```css
/* Layout.module.css */
.layout {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr auto;
}

.header {
  padding: 1rem 2rem;
  background-color: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.title {
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
  color: #1e293b;
}

.main {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.footer {
  padding: 1rem 2rem;
  background-color: #f1f5f9;
  border-top: 1px solid #e2e8f0;
  text-align: center;
  color: #64748b;
}
```

### 5. TypeScript Types
```typescript
// types.ts
export interface BaseComponentProps {
  children?: React.ReactNode;
  className?: string;
  'data-testid'?: string;
}

export interface ButtonProps extends BaseComponentProps {
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

export interface LayoutProps extends BaseComponentProps {
  title?: string;
  sidebar?: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
  current?: boolean;
}
```

### 6. Unit Tests
```typescript
// ComponentName.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import ComponentName from './ComponentName';

describe('ComponentName', () => {
  it('renders children correctly', () => {
    render(<ComponentName>Test Content</ComponentName>);
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<ComponentName className="custom-class">Test</ComponentName>);
    const element = screen.getByText('Test');
    expect(element).toHaveClass('custom-class');
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<ComponentName onClick={handleClick}>Click me</ComponentName>);
    
    const button = screen.getByText('Click me');
    fireEvent.click(button);
    
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('toggles active state on click', () => {
    render(<ComponentName>Toggle</ComponentName>);
    const button = screen.getByText('Toggle');
    
    expect(button).not.toHaveClass('active');
    
    fireEvent.click(button);
    expect(button).toHaveClass('active');
    
    fireEvent.click(button);
    expect(button).not.toHaveClass('active');
  });

  it('is accessible', () => {
    render(<ComponentName>Accessible Button</ComponentName>);
    const button = screen.getByRole('button');
    
    expect(button).toBeInTheDocument();
    expect(button).toHaveAccessibleName('Accessible Button');
  });
});
```

### 7. Storybook Stories (if detected)
```typescript
// ComponentName.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import ComponentName from './ComponentName';

const meta: Meta<typeof ComponentName> = {
  title: 'Components/ComponentName',
  component: ComponentName,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A reusable component built for Next.js applications.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    onClick: { action: 'clicked' },
    className: { control: 'text' },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: 'Default Component',
  },
};

export const WithCustomClass: Story = {
  args: {
    children: 'Custom Styled',
    className: 'custom-style',
  },
};

export const Interactive: Story = {
  args: {
    children: 'Click me',
    onClick: () => alert('Component clicked!'),
  },
};
```

### 8. Barrel Export
```typescript
// index.ts
export { default } from './ComponentName';
export type { ComponentNameProps } from './ComponentName';
```

## Framework-Specific Optimizations

### Tailwind CSS Integration (if detected)
Replace CSS modules with Tailwind classes:
```typescript
export const ComponentName: FC<ComponentNameProps> = ({
  children,
  className = '',
}) => {
  return (
    <div className={`flex flex-col p-4 rounded-lg border border-slate-200 bg-white ${className}`}>
      {children}
    </div>
  );
};
```

### Next.js App Router Optimizations
- **Server Components**: Default for non-interactive components
- **Client Components**: Explicit 'use client' directive
- **Metadata**: Include metadata for page components
- **Loading States**: Implement loading.tsx for async components

### Accessibility Features
- **ARIA Labels**: Proper labeling for screen readers
- **Keyboard Navigation**: Tab order and keyboard shortcuts
- **Focus Management**: Visible focus indicators
- **Semantic HTML**: Proper semantic elements

## Component Generation Process

1. **Analysis**: Analyze existing project structure and patterns
2. **Template Selection**: Choose appropriate template based on component type
3. **Customization**: Adapt template to project conventions
4. **File Creation**: Generate all component files
5. **Integration**: Update index files and exports
6. **Validation**: Verify component compiles and tests pass

## Quality Checklist

- [ ] Component follows project naming conventions
- [ ] TypeScript types are properly defined
- [ ] CSS follows established patterns (modules or Tailwind)
- [ ] Unit tests cover key functionality
- [ ] Component is accessible (ARIA, keyboard navigation)
- [ ] Documentation includes usage examples
- [ ] Storybook story created (if Storybook detected)
- [ ] Component compiles without errors
- [ ] Tests pass successfully

Provide the complete component implementation with all specified files and features.