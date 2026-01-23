# MUI Component Library

## Layout Components

### Box
The fundamental building block:

```typescript
<Box
  component="section"
  sx={{
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    p: 3,
    bgcolor: 'background.paper',
    borderRadius: 2
  }}
>
  <Typography variant="h5">Section Title</Typography>
  <Typography variant="body1">Content goes here</Typography>
</Box>
```

### Container
Centers content with max-width:

```typescript
<Container maxWidth="lg" sx={{ py: 4 }}>
  {/* Content automatically centered and constrained */}
</Container>
```

### Grid (v2)
Responsive grid layout:

```typescript
import Grid from '@mui/material/Grid2';

<Grid container spacing={2}>
  <Grid xs={12} sm={6} md={4}>
    <Card>Item 1</Card>
  </Grid>
  <Grid xs={12} sm={6} md={4}>
    <Card>Item 2</Card>
  </Grid>
  <Grid xs={12} sm={6} md={4}>
    <Card>Item 3</Card>
  </Grid>
</Grid>
```

### Stack
One-dimensional layout with spacing:

```typescript
<Stack direction="row" spacing={2} alignItems="center">
  <Avatar src={user.avatar} />
  <Typography>{user.name}</Typography>
  <Chip label={user.role} />
</Stack>
```

## Data Display

### Typography
Text with theme variants:

```typescript
<Typography variant="h1" component="h1" gutterBottom>
  Main Heading
</Typography>
<Typography variant="body1" color="text.secondary">
  Body text with secondary color
</Typography>
<Typography variant="caption" sx={{ fontWeight: 'bold' }}>
  Bold caption
</Typography>
```

### Card
Content container:

```typescript
<Card>
  <CardMedia
    component="img"
    height="200"
    image="/image.jpg"
    alt="Description"
  />
  <CardContent>
    <Typography variant="h5" component="h2">
      Card Title
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Card description text
    </Typography>
  </CardContent>
  <CardActions>
    <Button size="small">Learn More</Button>
    <Button size="small">Share</Button>
  </CardActions>
</Card>
```

### List
Structured content lists:

```typescript
<List>
  <ListItem disablePadding>
    <ListItemButton onClick={handleClick}>
      <ListItemIcon>
        <InboxIcon />
      </ListItemIcon>
      <ListItemText
        primary="Inbox"
        secondary="5 new messages"
      />
    </ListItemButton>
  </ListItem>
  <Divider />
  <ListItem>
    <ListItemAvatar>
      <Avatar src="/avatar.jpg" />
    </ListItemAvatar>
    <ListItemText
      primary="John Doe"
      secondary="Online"
    />
  </ListItem>
</List>
```

### Table
Data tables:

```typescript
<TableContainer component={Paper}>
  <Table>
    <TableHead>
      <TableRow>
        <TableCell>Name</TableCell>
        <TableCell>Email</TableCell>
        <TableCell align="right">Actions</TableCell>
      </TableRow>
    </TableHead>
    <TableBody>
      {rows.map((row) => (
        <TableRow key={row.id} hover>
          <TableCell>{row.name}</TableCell>
          <TableCell>{row.email}</TableCell>
          <TableCell align="right">
            <IconButton size="small">
              <EditIcon />
            </IconButton>
          </TableCell>
        </TableRow>
      ))}
    </TableBody>
  </Table>
</TableContainer>
```

## Input Components

### TextField
Text input with validation:

```typescript
<TextField
  label="Email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  error={!!emailError}
  helperText={emailError}
  fullWidth
  required
/>
```

### Select
Dropdown selection:

```typescript
<FormControl fullWidth>
  <InputLabel>Country</InputLabel>
  <Select
    value={country}
    onChange={(e) => setCountry(e.target.value)}
    label="Country"
  >
    <MenuItem value="us">United States</MenuItem>
    <MenuItem value="uk">United Kingdom</MenuItem>
    <MenuItem value="ca">Canada</MenuItem>
  </Select>
</FormControl>
```

### Checkbox & Switch
Boolean inputs:

```typescript
<FormControlLabel
  control={<Checkbox checked={agreed} onChange={handleChange} />}
  label="I agree to the terms"
/>

<FormControlLabel
  control={<Switch checked={enabled} onChange={handleToggle} />}
  label="Enable notifications"
/>
```

### Radio Group
Single selection:

```typescript
<FormControl>
  <FormLabel>Payment Method</FormLabel>
  <RadioGroup value={payment} onChange={(e) => setPayment(e.target.value)}>
    <FormControlLabel value="card" control={<Radio />} label="Credit Card" />
    <FormControlLabel value="paypal" control={<Radio />} label="PayPal" />
    <FormControlLabel value="crypto" control={<Radio />} label="Cryptocurrency" />
  </RadioGroup>
</FormControl>
```

### Autocomplete
Searchable select:

```typescript
<Autocomplete
  options={options}
  getOptionLabel={(option) => option.label}
  value={value}
  onChange={(event, newValue) => setValue(newValue)}
  renderInput={(params) => (
    <TextField {...params} label="Search" placeholder="Type to search..." />
  )}
/>
```

## Buttons

### Button Variants
```typescript
<Stack direction="row" spacing={2}>
  <Button variant="contained">Contained</Button>
  <Button variant="outlined">Outlined</Button>
  <Button variant="text">Text</Button>
</Stack>
```

### Button with Icons
```typescript
<Button
  variant="contained"
  startIcon={<SaveIcon />}
  onClick={handleSave}
>
  Save Changes
</Button>

<IconButton color="primary">
  <DeleteIcon />
</IconButton>

<Fab color="primary" sx={{ position: 'fixed', bottom: 16, right: 16 }}>
  <AddIcon />
</Fab>
```

## Feedback Components

### Alert
Status messages:

```typescript
<Alert severity="success" onClose={handleClose}>
  Operation completed successfully!
</Alert>

<Alert severity="error" icon={<ErrorIcon />}>
  An error occurred. Please try again.
</Alert>
```

### Snackbar
Toast notifications:

```typescript
<Snackbar
  open={open}
  autoHideDuration={6000}
  onClose={handleClose}
  anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
>
  <Alert onClose={handleClose} severity="success">
    Changes saved!
  </Alert>
</Snackbar>
```

### Dialog
Modal dialogs:

```typescript
<Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
  <DialogTitle>Confirm Delete</DialogTitle>
  <DialogContent>
    <DialogContentText>
      Are you sure you want to delete this item? This action cannot be undone.
    </DialogContentText>
  </DialogContent>
  <DialogActions>
    <Button onClick={handleClose}>Cancel</Button>
    <Button onClick={handleDelete} color="error" variant="contained">
      Delete
    </Button>
  </DialogActions>
</Dialog>
```

### CircularProgress & LinearProgress
Loading indicators:

```typescript
<CircularProgress />
<CircularProgress size={20} />
<CircularProgress variant="determinate" value={progress} />

<LinearProgress />
<LinearProgress variant="determinate" value={progress} />
<LinearProgress color="secondary" />
```

### Skeleton
Content placeholders:

```typescript
<Stack spacing={1}>
  <Skeleton variant="text" width="60%" height={40} />
  <Skeleton variant="rectangular" width="100%" height={200} />
  <Skeleton variant="circular" width={40} height={40} />
</Stack>
```

## Navigation

### AppBar & Toolbar
Application header:

```typescript
<AppBar position="static">
  <Toolbar>
    <IconButton edge="start" color="inherit">
      <MenuIcon />
    </IconButton>
    <Typography variant="h6" sx={{ flexGrow: 1 }}>
      App Title
    </Typography>
    <IconButton color="inherit">
      <AccountCircle />
    </IconButton>
  </Toolbar>
</AppBar>
```

### Drawer
Side navigation:

```typescript
<Drawer
  anchor="left"
  open={open}
  onClose={handleClose}
>
  <Box sx={{ width: 250 }} role="presentation">
    <List>
      <ListItem button onClick={() => navigate('/dashboard')}>
        <ListItemIcon><DashboardIcon /></ListItemIcon>
        <ListItemText primary="Dashboard" />
      </ListItem>
      <ListItem button onClick={() => navigate('/settings')}>
        <ListItemIcon><SettingsIcon /></ListItemIcon>
        <ListItemText primary="Settings" />
      </ListItem>
    </List>
  </Box>
</Drawer>
```

### Tabs
Tabbed navigation:

```typescript
<Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
  <Tabs value={tab} onChange={handleChange}>
    <Tab label="Overview" />
    <Tab label="Details" />
    <Tab label="Settings" />
  </Tabs>
</Box>
<TabPanel value={tab} index={0}>
  Overview content
</TabPanel>
```

### Breadcrumbs
Navigation trail:

```typescript
<Breadcrumbs>
  <Link underline="hover" color="inherit" href="/">
    Home
  </Link>
  <Link underline="hover" color="inherit" href="/products">
    Products
  </Link>
  <Typography color="text.primary">Electronics</Typography>
</Breadcrumbs>
```

## Utility Components

### Tooltip
Helpful hints:

```typescript
<Tooltip title="Delete item" arrow placement="top">
  <IconButton>
    <DeleteIcon />
  </IconButton>
</Tooltip>
```

### Popover
Floating content:

```typescript
<Popover
  open={open}
  anchorEl={anchorEl}
  onClose={handleClose}
  anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
>
  <Box sx={{ p: 2 }}>
    <Typography>Popover content</Typography>
  </Box>
</Popover>
```

### Menu
Context menus:

```typescript
<Menu
  anchorEl={anchorEl}
  open={open}
  onClose={handleClose}
>
  <MenuItem onClick={handleEdit}>
    <ListItemIcon><EditIcon /></ListItemIcon>
    <ListItemText>Edit</ListItemText>
  </MenuItem>
  <MenuItem onClick={handleDelete}>
    <ListItemIcon><DeleteIcon /></ListItemIcon>
    <ListItemText>Delete</ListItemText>
  </MenuItem>
</Menu>
```

### Chip
Compact information:

```typescript
<Stack direction="row" spacing={1}>
  <Chip label="Active" color="success" />
  <Chip label="Pending" color="warning" />
  <Chip
    label="Admin"
    onDelete={handleDelete}
    deleteIcon={<CloseIcon />}
  />
</Stack>
```

### Badge
Notification indicators:

```typescript
<Badge badgeContent={4} color="error">
  <MailIcon />
</Badge>

<Badge variant="dot" color="success">
  <Avatar src="/avatar.jpg" />
</Badge>
```

### Avatar
User images:

```typescript
<Stack direction="row" spacing={2}>
  <Avatar src="/avatar.jpg" />
  <Avatar sx={{ bgcolor: 'primary.main' }}>JD</Avatar>
  <Avatar variant="square" src="/logo.png" />
  <AvatarGroup max={3}>
    <Avatar src="/user1.jpg" />
    <Avatar src="/user2.jpg" />
    <Avatar src="/user3.jpg" />
    <Avatar src="/user4.jpg" />
  </AvatarGroup>
</Stack>
```

## Form Example

Complete form with validation:

```typescript
<Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 600 }}>
  <Stack spacing={3}>
    <TextField
      label="Full Name"
      required
      fullWidth
      error={!!errors.name}
      helperText={errors.name}
    />

    <TextField
      label="Email"
      type="email"
      required
      fullWidth
      error={!!errors.email}
      helperText={errors.email}
    />

    <FormControl fullWidth>
      <InputLabel>Role</InputLabel>
      <Select label="Role" value={role} onChange={(e) => setRole(e.target.value)}>
        <MenuItem value="user">User</MenuItem>
        <MenuItem value="admin">Admin</MenuItem>
      </Select>
    </FormControl>

    <FormControlLabel
      control={<Checkbox checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />}
      label="I agree to the terms and conditions"
    />

    <Stack direction="row" spacing={2} justifyContent="flex-end">
      <Button variant="outlined" onClick={handleCancel}>
        Cancel
      </Button>
      <Button type="submit" variant="contained" disabled={!agreed}>
        Submit
      </Button>
    </Stack>
  </Stack>
</Box>
```
