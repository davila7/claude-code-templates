# Design System Component Examples

Detailed implementation examples for common design system components.

## Button Component (Complete Implementation)

```typescript
/**
 * Button Component - Primary interactive element
 */

import React from 'react';
import { cn } from '../utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
}

const buttonStyles = {
  base: 'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',

  variants: {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus-visible:ring-blue-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus-visible:ring-gray-500',
    outline: 'border border-gray-300 bg-transparent hover:bg-gray-100 focus-visible:ring-gray-500',
    ghost: 'hover:bg-gray-100 focus-visible:ring-gray-500',
  },

  sizes: {
    sm: 'h-8 px-3 text-sm rounded-md',
    md: 'h-10 px-4 text-base rounded-md',
    lg: 'h-12 px-6 text-lg rounded-lg',
  },
};

export function Button({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  icon,
  children,
  onClick
}: ButtonProps) {
  return (
    <button
      className={cn(
        buttonStyles.base,
        buttonStyles.variants[variant],
        buttonStyles.sizes[size],
        { 'pointer-events-none opacity-50': loading }
      )}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading}
    >
      {icon && <span className="mr-2">{icon}</span>}
      <span>{children}</span>
      {loading && <span className="ml-2 animate-spin">⏳</span>}
    </button>
  );
}
```

## Form Field Component (Molecule)

```typescript
/**
 * FormField - Composition of Label + Input + Helper/Error
 */

interface FormFieldProps {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}

export function FormField({
  label,
  name,
  error,
  hint,
  required,
  children
}: FormFieldProps) {
  return (
    <div className="form-field space-y-2">
      <label
        htmlFor={name}
        className="block text-sm font-medium text-gray-700"
      >
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>

      {children}

      {hint && !error && (
        <p className="text-sm text-gray-500">{hint}</p>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
```

## Card Component (Compound Component Pattern)

```typescript
/**
 * Card - Composable container component
 */

interface CardProps {
  variant?: 'default' | 'outlined' | 'elevated';
  children: React.ReactNode;
  className?: string;
}

const cardStyles = {
  default: 'bg-white border border-gray-200',
  outlined: 'bg-white border-2 border-gray-300',
  elevated: 'bg-white shadow-lg',
};

export function Card({
  variant = 'default',
  children,
  className
}: CardProps) {
  return (
    <div
      className={cn(
        'rounded-lg p-6',
        cardStyles[variant],
        className
      )}
    >
      {children}
    </div>
  );
}

// Compound components
Card.Header = function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-4 border-b border-gray-200 pb-4">{children}</div>;
};

Card.Title = function CardTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="text-lg font-semibold text-gray-900">{children}</h3>;
};

Card.Body = function CardBody({ children }: { children: React.ReactNode }) {
  return <div className="space-y-4">{children}</div>;
};

Card.Footer = function CardFooter({ children }: { children: React.ReactNode }) {
  return <div className="mt-4 pt-4 border-t border-gray-200">{children}</div>;
};

// Usage Example:
/*
<Card variant="elevated">
  <Card.Header>
    <Card.Title>User Profile</Card.Title>
  </Card.Header>
  <Card.Body>
    <p>Profile content goes here</p>
  </Card.Body>
  <Card.Footer>
    <Button>Edit Profile</Button>
  </Card.Footer>
</Card>
*/
```

## Input Component with Variants

```typescript
/**
 * Input - Text input with validation states
 */

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: 'default' | 'error' | 'success';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const inputStyles = {
  base: 'w-full rounded-md px-3 py-2 text-sm border transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2',

  variants: {
    default: 'border-gray-300 focus:border-blue-500 focus:ring-blue-500',
    error: 'border-red-500 focus:border-red-500 focus:ring-red-500',
    success: 'border-green-500 focus:border-green-500 focus:ring-green-500',
  },
};

export function Input({
  variant = 'default',
  leftIcon,
  rightIcon,
  className,
  ...props
}: InputProps) {
  return (
    <div className="relative">
      {leftIcon && (
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
          {leftIcon}
        </div>
      )}

      <input
        className={cn(
          inputStyles.base,
          inputStyles.variants[variant],
          { 'pl-10': leftIcon },
          { 'pr-10': rightIcon },
          className
        )}
        {...props}
      />

      {rightIcon && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
          {rightIcon}
        </div>
      )}
    </div>
  );
}
```

## Modal Component (Organism)

```typescript
/**
 * Modal - Dialog with focus trap and overlay
 */

import { useEffect, useRef } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'full';
}

const modalSizes = {
  sm: 'max-w-md',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  full: 'max-w-full',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md'
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap
  useEffect(() => {
    if (isOpen) {
      modalRef.current?.focus();
    }
  }, [isOpen]);

  // ESC key handler
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden'; // Prevent background scroll
    }

    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={cn(
          'relative bg-white rounded-lg shadow-xl w-full mx-4',
          modalSizes[size]
        )}
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <h2 id="modal-title" className="text-xl font-semibold">
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
```

## Polymorphic Component Example

```typescript
/**
 * Polymorphic Button - Can render as button, link, etc.
 */

type AsProp<C extends React.ElementType> = {
  as?: C;
};

type PropsToOmit<C extends React.ElementType, P> = keyof (AsProp<C> & P);

type PolymorphicComponentProp<
  C extends React.ElementType,
  Props = {}
> = React.PropsWithChildren<Props & AsProp<C>> &
  Omit<React.ComponentPropsWithoutRef<C>, PropsToOmit<C, Props>>;

type PolymorphicRef<C extends React.ElementType> =
  React.ComponentPropsWithRef<C>['ref'];

type PolymorphicComponentPropWithRef<
  C extends React.ElementType,
  Props = {}
> = PolymorphicComponentProp<C, Props> & { ref?: PolymorphicRef<C> };

interface ButtonBaseProps {
  variant?: 'primary' | 'secondary';
}

export type ButtonProps<C extends React.ElementType = 'button'> =
  PolymorphicComponentPropWithRef<C, ButtonBaseProps>;

export const PolymorphicButton = <C extends React.ElementType = 'button'>({
  as,
  variant = 'primary',
  children,
  ...props
}: ButtonProps<C>) => {
  const Component = as || 'button';

  return (
    <Component
      className={cn('px-4 py-2 rounded', {
        'bg-blue-600 text-white': variant === 'primary',
        'bg-gray-600 text-white': variant === 'secondary',
      })}
      {...props}
    >
      {children}
    </Component>
  );
};

// Usage:
// <PolymorphicButton>Button</PolymorphicButton>
// <PolymorphicButton as="a" href="/login">Link</PolymorphicButton>
```

## Accessibility Example - Skip Link

```typescript
/**
 * Skip Link - Keyboard accessibility helper
 */

export function SkipLink() {
  return (
    <a
      href="#main-content"
      className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded"
    >
      Skip to main content
    </a>
  );
}

// CSS for sr-only (screen reader only):
/*
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

.focus\:not-sr-only:focus {
  position: static;
  width: auto;
  height: auto;
  padding: revert;
  margin: revert;
  overflow: visible;
  clip: auto;
  white-space: normal;
}
*/
```

## Theme Switching Example

```typescript
/**
 * Theme Toggle - Dark mode switcher
 */

import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check system preference on mount
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' || (isDark ? 'dark' : 'light');
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      {theme === 'light' ? '🌙' : '☀️'}
    </button>
  );
}
```

## Responsive Navigation Example

```typescript
/**
 * Navigation Bar - Responsive with mobile menu
 */

import { useState } from 'react';

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="bg-white border-b border-gray-200" aria-label="Main navigation">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <a href="/" className="text-xl font-bold">
              Logo
            </a>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:flex space-x-8">
            <a href="/features" className="text-gray-700 hover:text-gray-900">
              Features
            </a>
            <a href="/pricing" className="text-gray-700 hover:text-gray-900">
              Pricing
            </a>
            <a href="/about" className="text-gray-700 hover:text-gray-900">
              About
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle mobile menu"
            aria-expanded={mobileMenuOpen}
          >
            <span className="block w-6 h-0.5 bg-gray-900 mb-1"></span>
            <span className="block w-6 h-0.5 bg-gray-900 mb-1"></span>
            <span className="block w-6 h-0.5 bg-gray-900"></span>
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden py-4">
            <a
              href="/features"
              className="block py-2 text-gray-700 hover:bg-gray-100"
            >
              Features
            </a>
            <a
              href="/pricing"
              className="block py-2 text-gray-700 hover:bg-gray-100"
            >
              Pricing
            </a>
            <a
              href="/about"
              className="block py-2 text-gray-700 hover:bg-gray-100"
            >
              About
            </a>
          </div>
        )}
      </div>
    </nav>
  );
}
```
