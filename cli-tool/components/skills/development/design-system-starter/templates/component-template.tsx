/**
 * Component Name
 *
 * Brief description of what this component does and when to use it.
 *
 * @example
 * ```tsx
 * <ComponentName variant="primary" size="md">
 *   Content
 * </ComponentName>
 * ```
 */

import React from 'react';
import { cn } from '../utils/cn'; // Utility for className merging

// ============================================================================
// Types & Interfaces
// ============================================================================

/**
 * Variants define the visual style of the component
 */
export type ComponentVariant = 'primary' | 'secondary' | 'outline' | 'ghost';

/**
 * Sizes define the dimensions of the component
 */
export type ComponentSize = 'sm' | 'md' | 'lg';

/**
 * Props for the Component
 */
export interface ComponentProps {
  /**
   * Visual variant of the component
   * @default 'primary'
   */
  variant?: ComponentVariant;

  /**
   * Size of the component
   * @default 'md'
   */
  size?: ComponentSize;

  /**
   * Whether the component is disabled
   * @default false
   */
  disabled?: boolean;

  /**
   * Additional CSS classes to apply
   */
  className?: string;

  /**
   * Content to be rendered inside the component
   */
  children: React.ReactNode;

  /**
   * Optional click handler
   */
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;

  /**
   * ARIA label for accessibility
   */
  'aria-label'?: string;
}

// ============================================================================
// Component Styles (if using CSS-in-JS or className-based styling)
// ============================================================================

const componentStyles = {
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

// ============================================================================
// Component Implementation
// ============================================================================

export const Component = React.forwardRef<HTMLDivElement, ComponentProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      disabled = false,
      className,
      children,
      onClick,
      'aria-label': ariaLabel,
    },
    ref
  ) => {
    // =========================================================================
    // State & Hooks
    // =========================================================================

    // Example: Track internal state if needed
    // const [isActive, setIsActive] = React.useState(false);

    // =========================================================================
    // Event Handlers
    // =========================================================================

    const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;
      onClick?.(event);
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      // Handle Enter and Space for keyboard accessibility
      if (disabled) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onClick?.(event as any);
      }
    };

    // =========================================================================
    // Render
    // =========================================================================

    return (
      <div
        ref={ref}
        className={cn(
          componentStyles.base,
          componentStyles.variants[variant],
          componentStyles.sizes[size],
          className
        )}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled}
        aria-label={ariaLabel}
      >
        {children}
      </div>
    );
  }
);

Component.displayName = 'Component';

// ============================================================================
// Compound Components (if applicable)
// ============================================================================

/**
 * Example of a compound component pattern
 */
export const ComponentHeader = ({ children }: { children: React.ReactNode }) => {
  return <div className="component-header">{children}</div>;
};

/**
 * Compound component for body content
 */
export const ComponentBody = ({ children }: { children: React.ReactNode }) => {
  return <div className="component-body">{children}</div>;
};

// Attach compound components
Component.Header = ComponentHeader;
Component.Body = ComponentBody;

// ============================================================================
// Usage Examples (for documentation/Storybook)
// ============================================================================

/**
 * Example 1: Basic usage
 */
export const BasicExample = () => (
  <Component variant="primary" size="md">
    Click me
  </Component>
);

/**
 * Example 2: With different variants
 */
export const VariantsExample = () => (
  <div className="flex gap-4">
    <Component variant="primary">Primary</Component>
    <Component variant="secondary">Secondary</Component>
    <Component variant="outline">Outline</Component>
    <Component variant="ghost">Ghost</Component>
  </div>
);

/**
 * Example 3: With different sizes
 */
export const SizesExample = () => (
  <div className="flex items-center gap-4">
    <Component variant="primary" size="sm">
      Small
    </Component>
    <Component variant="primary" size="md">
      Medium
    </Component>
    <Component variant="primary" size="lg">
      Large
    </Component>
  </div>
);

/**
 * Example 4: Disabled state
 */
export const DisabledExample = () => (
  <Component variant="primary" disabled>
    Disabled
  </Component>
);

/**
 * Example 5: Compound component usage
 */
export const CompoundExample = () => (
  <Component variant="primary">
    <Component.Header>Header</Component.Header>
    <Component.Body>Body content</Component.Body>
  </Component>
);

// ============================================================================
// Exports
// ============================================================================

export default Component;
