# MUI Theme Customization

## Creating a Custom Theme

```typescript
import { createTheme, ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2',
      light: '#42a5f5',
      dark: '#1565c0',
      contrastText: '#fff'
    },
    secondary: {
      main: '#9c27b0',
      light: '#ba68c8',
      dark: '#7b1fa2',
      contrastText: '#fff'
    },
    error: {
      main: '#d32f2f'
    },
    warning: {
      main: '#ed6c02'
    },
    info: {
      main: '#0288d1'
    },
    success: {
      main: '#2e7d32'
    }
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontSize: '2.5rem',
      fontWeight: 600
    },
    h2: {
      fontSize: '2rem',
      fontWeight: 600
    },
    button: {
      textTransform: 'none',
      fontWeight: 600
    }
  },
  shape: {
    borderRadius: 8
  },
  spacing: 8
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Your app */}
    </ThemeProvider>
  );
}
```

## Dark Mode Support

```typescript
const getTheme = (mode: 'light' | 'dark') => createTheme({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          // Light mode colors
          primary: { main: '#1976d2' },
          background: {
            default: '#f5f5f5',
            paper: '#ffffff'
          }
        }
      : {
          // Dark mode colors
          primary: { main: '#90caf9' },
          background: {
            default: '#121212',
            paper: '#1e1e1e'
          }
        })
  }
});

function App() {
  const [mode, setMode] = useState<'light' | 'dark'>('light');
  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <IconButton onClick={() => setMode(m => m === 'light' ? 'dark' : 'light')}>
        {mode === 'light' ? <DarkModeIcon /> : <LightModeIcon />}
      </IconButton>
      {/* Your app */}
    </ThemeProvider>
  );
}
```

## Typography Customization

```typescript
const theme = createTheme({
  typography: {
    fontFamily: '"Inter", sans-serif',
    fontSize: 14,
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    h1: {
      fontSize: '3rem',
      fontWeight: 700,
      lineHeight: 1.2,
      letterSpacing: '-0.01562em'
    },
    h2: {
      fontSize: '2.5rem',
      fontWeight: 700,
      lineHeight: 1.3
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.5,
      letterSpacing: '0.00938em'
    },
    button: {
      fontSize: '0.875rem',
      fontWeight: 600,
      textTransform: 'none',
      letterSpacing: '0.02857em'
    }
  }
});
```

## Component Style Overrides

```typescript
const theme = createTheme({
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none'
          }
        },
        contained: {
          '&:hover': {
            transform: 'translateY(-2px)',
            transition: 'transform 0.2s'
          }
        }
      },
      defaultProps: {
        disableElevation: true
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined',
        size: 'medium'
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500
        }
      }
    }
  }
});
```

## Breakpoints

```typescript
const theme = createTheme({
  breakpoints: {
    values: {
      xs: 0,
      sm: 600,
      md: 960,
      lg: 1280,
      xl: 1920
    }
  }
});

// Usage
<Box
  sx={{
    width: {
      xs: '100%',  // 0-599px
      sm: '80%',   // 600-959px
      md: '60%',   // 960-1279px
      lg: '50%'    // 1280px+
    }
  }}
/>
```

## Spacing

```typescript
const theme = createTheme({
  spacing: 8  // Base unit: 8px
});

// Usage: theme.spacing(2) = 16px
<Box sx={{ p: 2, m: 3 }} />  // padding: 16px, margin: 24px
```

## Custom Palette Colors

```typescript
declare module '@mui/material/styles' {
  interface Palette {
    tertiary: Palette['primary'];
  }
  interface PaletteOptions {
    tertiary?: PaletteOptions['primary'];
  }
}

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2'
    },
    secondary: {
      main: '#9c27b0'
    },
    tertiary: {
      main: '#ff9800',
      light: '#ffb74d',
      dark: '#f57c00',
      contrastText: '#000'
    }
  }
});

// Usage
<Button color="tertiary">Tertiary Button</Button>
```

## Shadows

```typescript
const theme = createTheme({
  shadows: [
    'none',
    '0 2px 4px rgba(0,0,0,0.1)',
    '0 4px 8px rgba(0,0,0,0.12)',
    '0 8px 16px rgba(0,0,0,0.14)',
    // ... up to shadows[24]
  ]
});

// Usage
<Paper elevation={2} />  // Uses shadows[2]
```

## Z-Index Layers

```typescript
const theme = createTheme({
  zIndex: {
    mobileStepper: 1000,
    speedDial: 1050,
    appBar: 1100,
    drawer: 1200,
    modal: 1300,
    snackbar: 1400,
    tooltip: 1500
  }
});
```

## Transitions

```typescript
const theme = createTheme({
  transitions: {
    duration: {
      shortest: 150,
      shorter: 200,
      short: 250,
      standard: 300,
      complex: 375,
      enteringScreen: 225,
      leavingScreen: 195
    },
    easing: {
      easeInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      easeOut: 'cubic-bezier(0.0, 0, 0.2, 1)',
      easeIn: 'cubic-bezier(0.4, 0, 1, 1)',
      sharp: 'cubic-bezier(0.4, 0, 0.6, 1)'
    }
  }
});

// Usage
<Box
  sx={{
    transition: (theme) =>
      theme.transitions.create(['transform', 'background-color'], {
        duration: theme.transitions.duration.standard
      })
  }}
/>
```

## Complete Theme Example

```typescript
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#2563eb',
      light: '#60a5fa',
      dark: '#1e40af',
      contrastText: '#ffffff'
    },
    secondary: {
      main: '#7c3aed',
      light: '#a78bfa',
      dark: '#5b21b6',
      contrastText: '#ffffff'
    },
    error: {
      main: '#dc2626'
    },
    warning: {
      main: '#f59e0b'
    },
    info: {
      main: '#0ea5e9'
    },
    success: {
      main: '#10b981'
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff'
    },
    text: {
      primary: '#0f172a',
      secondary: '#64748b'
    }
  },
  typography: {
    fontFamily: '"Inter", "Segoe UI", "Roboto", sans-serif',
    fontSize: 14,
    h1: {
      fontSize: '3rem',
      fontWeight: 700,
      lineHeight: 1.2
    },
    h2: {
      fontSize: '2.25rem',
      fontWeight: 700,
      lineHeight: 1.3
    },
    h3: {
      fontSize: '1.875rem',
      fontWeight: 600,
      lineHeight: 1.4
    },
    h4: {
      fontSize: '1.5rem',
      fontWeight: 600,
      lineHeight: 1.5
    },
    h5: {
      fontSize: '1.25rem',
      fontWeight: 600,
      lineHeight: 1.6
    },
    h6: {
      fontSize: '1rem',
      fontWeight: 600,
      lineHeight: 1.6
    },
    button: {
      textTransform: 'none',
      fontWeight: 600,
      fontSize: '0.875rem'
    }
  },
  shape: {
    borderRadius: 10
  },
  spacing: 8,
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '10px 20px',
          fontWeight: 600,
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none'
          }
        },
        contained: {
          '&:hover': {
            transform: 'translateY(-1px)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
          }
        }
      },
      defaultProps: {
        disableElevation: true
      }
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)',
          '&:hover': {
            boxShadow: '0 3px 6px rgba(0,0,0,0.16), 0 3px 6px rgba(0,0,0,0.23)'
          }
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        variant: 'outlined'
      },
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-root': {
            borderRadius: 8,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: '#2563eb'
            }
          }
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontWeight: 500,
          height: 28
        }
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)'
        }
      }
    }
  }
});

export default theme;
```

## Theme Provider Setup

```typescript
// src/theme.ts - Export your theme
export { default as theme } from './theme';

// src/main.tsx or src/index.tsx
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';

root.render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>
);
```

## Accessing Theme in Components

```typescript
import { useTheme } from '@mui/material/styles';

function MyComponent() {
  const theme = useTheme();

  return (
    <Box
      sx={{
        color: theme.palette.primary.main,
        padding: theme.spacing(2),
        borderRadius: theme.shape.borderRadius
      }}
    />
  );
}
```

## Theme Nesting

```typescript
import { createTheme, ThemeProvider, useTheme } from '@mui/material/styles';

function NestedTheme() {
  const outerTheme = useTheme();

  const innerTheme = createTheme({
    ...outerTheme,
    palette: {
      ...outerTheme.palette,
      mode: 'dark'
    }
  });

  return (
    <ThemeProvider theme={innerTheme}>
      <Box sx={{ bgcolor: 'background.default', p: 2 }}>
        Dark section within light app
      </Box>
    </ThemeProvider>
  );
}
```
