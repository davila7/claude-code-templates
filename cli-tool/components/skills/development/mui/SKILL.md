---
name: mui
description: Material-UI v7 component library patterns including sx prop styling, theme integration, responsive design, and MUI-specific hooks. Use when working with MUI components, styling with sx prop, theme customization, or MUI utilities.
---

# MUI v7 Patterns

## Purpose

Material-UI v7 (released March 2025) patterns for component usage, styling with sx prop, theme integration, and responsive design.

**Note**: MUI v7 breaking changes from v6:
- Deep imports no longer work - use package exports field
- `onBackdropClick` removed from Modal - use `onClose` instead
- All components now use standardized `slots` and `slotProps` pattern
- CSS layers support via `enableCssLayer` config (works with Tailwind v4)

## When to Use This Skill

- Styling components with MUI sx prop
- Using MUI components (Box, Grid, Paper, Typography, etc.)
- Theme customization and usage
- Responsive design with MUI breakpoints
- MUI-specific utilities and hooks

---

## Quick Start

### Basic MUI Component

```typescript
import { Box, Typography, Button, Paper } from '@mui/material';
import type { SxProps, Theme } from '@mui/material';

const styles: Record<string, SxProps<Theme>> = {
  container: {
    p: 2,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  header: {
    mb: 3,
    fontSize: '1.5rem',
    fontWeight: 600,
  },
};

function MyComponent() {
  return (
    <Paper sx={styles.container}>
      <Typography sx={styles.header}>
        Title
      </Typography>
      <Button variant="contained">
        Action
      </Button>
    </Paper>
  );
}
```

---

## Styling Patterns

### Inline Styles (< 100 lines)

For components with simple styling, define styles at the top:

```typescript
import type { SxProps, Theme } from '@mui/material';

const componentStyles: Record<string, SxProps<Theme>> = {
  container: {
    p: 2,
    display: 'flex',
    flexDirection: 'column',
  },
  header: {
    mb: 2,
    color: 'primary.main',
  },
  button: {
    mt: 'auto',
    alignSelf: 'flex-end',
  },
};

function Component() {
  return (
    <Box sx={componentStyles.container}>
      <Typography sx={componentStyles.header}>Header</Typography>
      <Button sx={componentStyles.button}>Action</Button>
    </Box>
  );
}
```

### Separate Styles File (>= 100 lines)

For complex components, create separate style file:

```typescript
// UserProfile.styles.ts
import type { SxProps, Theme } from '@mui/material';

export const userProfileStyles: Record<string, SxProps<Theme>> = {
  container: {
    p: 3,
    maxWidth: 800,
    mx: 'auto',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    mb: 3,
  },
  // ... many more styles
};

// UserProfile.tsx
import { userProfileStyles as styles } from './UserProfile.styles';

function UserProfile() {
  return <Box sx={styles.container}>...</Box>;
}
```

---

## Common Components

### Layout Components

```typescript
// Box - Generic container
<Box sx={{ p: 2, bgcolor: 'background.paper' }}>
  Content
</Box>

// Paper - Elevated surface
<Paper elevation={2} sx={{ p: 3 }}>
  Content
</Paper>

// Container - Centered content with max-width
<Container maxWidth="lg">
  Content
</Container>

// Stack - Flex container with spacing
<Stack spacing={2} direction="row">
  <Item />
  <Item />
</Stack>
```

### Grid System

```typescript
import { Grid } from '@mui/material';

// 12-column grid
<Grid container spacing={2}>
  <Grid item xs={12} md={6}>
    Left half
  </Grid>
  <Grid item xs={12} md={6}>
    Right half
  </Grid>
</Grid>

// Responsive grid
<Grid container spacing={3}>
  <Grid item xs={12} sm={6} md={4} lg={3}>
    Card
  </Grid>
  {/* Repeat for more cards */}
</Grid>
```

### Typography

```typescript
<Typography variant="h1">Heading 1</Typography>
<Typography variant="h2">Heading 2</Typography>
<Typography variant="body1">Body text</Typography>
<Typography variant="caption">Small text</Typography>

// With custom styling
<Typography
  variant="h4"
  sx={{
    color: 'primary.main',
    fontWeight: 600,
    mb: 2,
  }}
>
  Custom Heading
</Typography>
```

### Buttons

```typescript
// Variants
<Button variant="contained">Contained</Button>
<Button variant="outlined">Outlined</Button>
<Button variant="text">Text</Button>

// Colors
<Button variant="contained" color="primary">Primary</Button>
<Button variant="contained" color="secondary">Secondary</Button>
<Button variant="contained" color="error">Error</Button>

// With icons
import { Add as AddIcon } from '@mui/icons-material';

<Button startIcon={<AddIcon />}>Add Item</Button>
```

---

## Theme Integration

### Using Theme Values

```typescript
import { useTheme } from '@mui/material';

function Component() {
  const theme = useTheme();

  return (
    <Box
      sx={{
        p: 2,
        bgcolor: theme.palette.primary.main,
        color: theme.palette.primary.contrastText,
        borderRadius: theme.shape.borderRadius,
      }}
    >
      Themed box
    </Box>
  );
}
```

### Theme in sx Prop

```typescript
<Box
  sx={{
    // Access theme in sx
    color: 'primary.main',          // theme.palette.primary.main
    bgcolor: 'background.paper',     // theme.palette.background.paper
    p: 2,                            // theme.spacing(2)
    borderRadius: 1,                 // theme.shape.borderRadius
  }}
>
  Content
</Box>

// Callback for advanced usage
<Box
  sx={(theme) => ({
    color: theme.palette.primary.main,
    '&:hover': {
      color: theme.palette.primary.dark,
    },
  })}
>
  Hover me
</Box>
```

---

## Responsive Design

### Breakpoints

```typescript
// Mobile-first responsive values
<Box
  sx={{
    width: {
      xs: '100%',    // 0-600px
      sm: '80%',     // 600-900px
      md: '60%',     // 900-1200px
      lg: '40%',     // 1200-1536px
      xl: '30%',     // 1536px+
    },
  }}
>
  Responsive width
</Box>

// Responsive display
<Box
  sx={{
    display: {
      xs: 'none',    // Hidden on mobile
      md: 'block',   // Visible on desktop
    },
  }}
>
  Desktop only
</Box>
```

### Responsive Typography

```typescript
<Typography
  sx={{
    fontSize: {
      xs: '1rem',
      md: '1.5rem',
      lg: '2rem',
    },
    lineHeight: {
      xs: 1.5,
      md: 1.75,
    },
  }}
>
  Responsive text
</Typography>
```

---

## Forms

```typescript
import { TextField, Stack, Button } from '@mui/material';

<Box component="form" onSubmit={handleSubmit}>
  <Stack spacing={2}>
    <TextField
      label="Email"
      type="email"
      value={email}
      onChange={(e) => setEmail(e.target.value)}
      fullWidth
      required
      error={!!errors.email}
      helperText={errors.email}
    />
    <Button type="submit" variant="contained">Submit</Button>
  </Stack>
</Box>
```

---

## Common Patterns

### Card Component

```typescript
import { Card, CardContent, CardActions, Typography, Button } from '@mui/material';

<Card>
  <CardContent>
    <Typography variant="h5" component="div">
      Title
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Description
    </Typography>
  </CardContent>
  <CardActions>
    <Button size="small">Learn More</Button>
  </CardActions>
</Card>
```

### Dialog/Modal

```typescript
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';

<Dialog open={open} onClose={handleClose}>
  <DialogTitle>Confirm Action</DialogTitle>
  <DialogContent>
    Are you sure you want to proceed?
  </DialogContent>
  <DialogActions>
    <Button onClick={handleClose}>Cancel</Button>
    <Button onClick={handleConfirm} variant="contained">
      Confirm
    </Button>
  </DialogActions>
</Dialog>
```

### Loading States

```typescript
import { CircularProgress, Skeleton } from '@mui/material';

// Spinner
<Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
  <CircularProgress />
</Box>

// Skeleton
<Stack spacing={1}>
  <Skeleton variant="text" width="60%" />
  <Skeleton variant="rectangular" height={200} />
  <Skeleton variant="text" width="40%" />
</Stack>
```

---

## MUI-Specific Hooks

### useMuiSnackbar

```typescript
import { useMuiSnackbar } from '@/hooks/useMuiSnackbar';

function Component() {
  const { showSuccess, showError, showInfo } = useMuiSnackbar();

  const handleSave = async () => {
    try {
      await saveData();
      showSuccess('Saved successfully');
    } catch (error) {
      showError('Failed to save');
    }
  };

  return <Button onClick={handleSave}>Save</Button>;
}
```

---

## Icons

```typescript
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { Button, IconButton } from '@mui/material';

<Button startIcon={<AddIcon />}>Add</Button>
<IconButton onClick={handleDelete}><DeleteIcon /></IconButton>
```

---

## Best Practices

### 1. Type Your sx Props

```typescript
import type { SxProps, Theme } from '@mui/material';

// ✅ Good
const styles: Record<string, SxProps<Theme>> = {
  container: { p: 2 },
};

// ❌ Avoid
const styles = {
  container: { p: 2 }, // No type safety
};
```

### 2. Use Theme Tokens

```typescript
// ✅ Good: Use theme tokens
<Box sx={{ color: 'primary.main', p: 2 }} />

// ❌ Avoid: Hardcoded values
<Box sx={{ color: '#1976d2', padding: '16px' }} />
```

### 3. Consistent Spacing

```typescript
// ✅ Good: Use spacing scale
<Box sx={{ p: 2, mb: 3, mt: 1 }} />

// ❌ Avoid: Random pixel values
<Box sx={{ padding: '17px', marginBottom: '25px' }} />
```

---

## Additional Resources

For more detailed patterns, see:
- [styling-guide.md](resources/styling-guide.md) - Advanced styling patterns
- [component-library.md](resources/component-library.md) - Component examples
- [theme-customization.md](resources/theme-customization.md) - Theme setup
