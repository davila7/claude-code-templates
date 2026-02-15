# MUI Styling Guide

## The sx Prop

The `sx` prop is the primary styling method in MUI v7+:

```typescript
<Box
  sx={{
    p: 2,                    // padding: theme.spacing(2)
    mb: 3,                   // marginBottom: theme.spacing(3)
    bgcolor: 'primary.main', // theme.palette.primary.main
    color: 'white',
    borderRadius: 1,         // theme.shape.borderRadius
    '&:hover': {
      bgcolor: 'primary.dark'
    }
  }}
/>
```

## Theme-Aware Values

```typescript
// Spacing (multiplied by theme.spacing, default 8px)
sx={{ p: 2 }}  // padding: 16px

// Colors from palette
sx={{ bgcolor: 'primary.main', color: 'text.secondary' }}

// Breakpoints
sx={{
  width: { xs: '100%', sm: '50%', md: '33%' }
}}

// Typography variants
sx={{ typography: 'h4' }}  // Applies theme.typography.h4
```

## Responsive Styles

```typescript
<Box
  sx={{
    display: { xs: 'block', md: 'flex' },
    flexDirection: { xs: 'column', md: 'row' },
    gap: { xs: 1, sm: 2, md: 3 },
    p: { xs: 2, sm: 3, md: 4 }
  }}
/>
```

## Pseudo-Selectors and Nested Styles

```typescript
<Button
  sx={{
    '&:hover': {
      bgcolor: 'primary.dark'
    },
    '&:disabled': {
      opacity: 0.5
    },
    '& .MuiButton-startIcon': {
      mr: 1
    }
  }}
/>
```

## Dynamic Styles

```typescript
interface CardProps {
  isActive: boolean;
  priority: 'low' | 'medium' | 'high';
}

function Card({ isActive, priority }: CardProps) {
  return (
    <Paper
      sx={{
        borderLeft: 4,
        borderColor: isActive ? 'success.main' : 'grey.300',
        bgcolor: priority === 'high' ? 'error.light' : 'background.paper',
        opacity: isActive ? 1 : 0.7
      }}
    />
  );
}
```

## Global Styles with GlobalStyles

```typescript
import { GlobalStyles } from '@mui/material';

<GlobalStyles
  styles={{
    body: {
      margin: 0,
      padding: 0
    },
    '*': {
      boxSizing: 'border-box'
    },
    '.custom-scrollbar::-webkit-scrollbar': {
      width: 8
    }
  }}
/>
```

## Styled Components API

For reusable styled components:

```typescript
import { styled } from '@mui/material/styles';

const StyledCard = styled(Card)(({ theme }) => ({
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius * 2,
  backgroundColor: theme.palette.background.paper,
  transition: theme.transitions.create(['transform', 'box-shadow']),
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: theme.shadows[8]
  }
}));

// With props
interface StyledButtonProps {
  variant: 'primary' | 'secondary';
}

const StyledButton = styled(Button)<StyledButtonProps>(({ theme, variant }) => ({
  backgroundColor: variant === 'primary'
    ? theme.palette.primary.main
    : theme.palette.secondary.main,
  color: theme.palette.primary.contrastText,
  '&:hover': {
    backgroundColor: variant === 'primary'
      ? theme.palette.primary.dark
      : theme.palette.secondary.dark
  }
}));
```

## Theme Overrides

```typescript
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600
        },
        containedPrimary: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none'
          }
        }
      },
      defaultProps: {
        disableRipple: true
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }
      }
    }
  }
});
```

## CSS Variables (MUI v7+)

```typescript
// In theme configuration
const theme = createTheme({
  cssVariables: true
});

// Use in sx prop
<Box sx={{ color: 'var(--mui-palette-primary-main)' }} />

// Use in CSS
.custom-element {
  background-color: var(--mui-palette-background-paper);
  padding: var(--mui-spacing-2);
}
```

## Common Patterns

### Card with Hover Effect
```typescript
<Card
  sx={{
    p: 3,
    transition: 'all 0.3s',
    '&:hover': {
      transform: 'scale(1.02)',
      boxShadow: 4
    }
  }}
/>
```

### Gradient Background
```typescript
<Box
  sx={{
    background: (theme) =>
      `linear-gradient(45deg, ${theme.palette.primary.main} 30%, ${theme.palette.secondary.main} 90%)`,
    color: 'white'
  }}
/>
```

### Sticky Header
```typescript
<AppBar
  sx={{
    position: 'sticky',
    top: 0,
    zIndex: (theme) => theme.zIndex.drawer + 1
  }}
/>
```

### Flexbox Layouts
```typescript
<Box
  sx={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2
  }}
/>
```

## Performance Tips

- **Use sx prop for dynamic styles** - Better tree-shaking
- **Use styled() for static reusable components** - Better performance
- **Avoid inline functions in sx** - Can cause re-renders
- **Leverage theme tokens** - Consistent and performant

```typescript
// ❌ Bad: Inline function in sx
<Box sx={() => ({ p: 2 })} />

// ✅ Good: Direct object
<Box sx={{ p: 2 }} />

// ✅ Good: Memoized function for complex logic
const getSx = useMemo(() => ({ p: 2, /* complex logic */ }), [deps]);
<Box sx={getSx} />
```

## Debugging Styles

```typescript
// Inspect theme in console
<Box sx={(theme) => {
  console.log('Theme:', theme);
  return { p: 2 };
}} />

// Use sx as array for conditional styles
<Box sx={[
  { p: 2 },
  isActive && { bgcolor: 'primary.main' },
  isDisabled && { opacity: 0.5 }
]} />
```
