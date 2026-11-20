# Polaris web components: Layout and structure

_From [Nitrogen](https://github.com/mksd0398/nitrogen), where it is generated from `tools/reference/`._

### Page: `<s-page>`

The frame of every page: the title bar, its actions, and the sections below. Keep sections as direct children, or the page cannot space them.

```html
<s-page heading="Products" inlineSize="base">
  <s-link slot="breadcrumb-actions" href="/">Dashboard</s-link>
  <s-button slot="primary-action" variant="primary">Add product</s-button>
  <s-button slot="secondary-actions">Import</s-button>

  <s-section heading="All products">...</s-section>

  <s-section slot="aside" heading="Summary">...</s-section>
</s-page>
```

`inlineSize` is `small` for forms, `base` by default and `large` for tables.

### Section: `<s-section>`

A card with an optional heading. Nested sections step the heading level down automatically.

```html
<s-section heading="Shipping">
  <s-paragraph>Where and how you deliver.</s-paragraph>

  <s-section heading="Zones">
    <s-paragraph>A nested section gets a smaller heading.</s-paragraph>
  </s-section>
</s-section>

<s-section padding="none">...</s-section>
```

`padding="none"` makes a section edge to edge, for a table or an image.

### Box: `<s-box>`

A container with padding, border and background. Spacing uses the Polaris scale, from small-500 to large-500.

```html
<s-stack gap="base">
  <s-box padding="base" border="base" borderRadius="base">
    Border, radius and base padding.
  </s-box>
  <s-box padding="large-200" background="subdued" borderRadius="large">
    Subdued background and more padding.
  </s-box>
  <s-box padding="base" background="strong" borderRadius="base">
    Strong background.
  </s-box>
</s-stack>
```

### Stack: `<s-stack>`

Children in a column, or a row with direction="inline". A row wraps when it runs out of room.

```html
<s-stack gap="base">
  <s-stack direction="inline" gap="small-200" alignItems="center">
    <s-badge tone="success">Active</s-badge>
    <s-text>In a row, centred vertically</s-text>
  </s-stack>
  <s-stack direction="inline" justifyContent="space-between" alignItems="center">
    <s-heading>Pushed apart</s-heading>
    <s-button>Edit</s-button>
  </s-stack>
</s-stack>
```

### Grid: `<s-grid>`

Columns. Make them respond to the width available with a container query in the value.

```html
<s-query-container>
  <s-grid gridTemplateColumns="@container (inline-size <= 500px) 1fr, 1fr 1fr 1fr" gap="base">
    <s-box padding="base" border="base" borderRadius="base">One</s-box>
    <s-box padding="base" border="base" borderRadius="base">Two</s-box>
    <s-box padding="base" border="base" borderRadius="base">Three</s-box>
  </s-grid>
</s-query-container>
```

### Query container: `<s-query-container>`

Marks the element that container queries measure. Values then change with its width, not the window's.

```html
<s-query-container>
  <s-box
    padding="@container (inline-size > 500px) large-300, base"
    background="subdued"
    borderRadius="base"
  >
    More padding once this box is wider than 500px.
  </s-box>
</s-query-container>
```

### Divider: `<s-divider>`

A line between groups of content.

```html
<s-stack gap="base">
  <s-text>Above</s-text>
  <s-divider></s-divider>
  <s-text>Below</s-text>
  <s-divider color="strong"></s-divider>
</s-stack>
```

### Table: `<s-table>`

Rows and columns of data. Put it in a section with padding="none". For paging, add `paginate` and listen for nextpage and previouspage.

```html
<s-table paginate hasNextPage>
  <s-table-header-row>
    <s-table-header>Product</s-table-header>
    <s-table-header>Status</s-table-header>
    <s-table-header format="numeric">Stock</s-table-header>
  </s-table-header-row>
  <s-table-body>
    <s-table-row>
      <s-table-cell>Cotton T-shirt</s-table-cell>
      <s-table-cell><s-badge tone="success">Active</s-badge></s-table-cell>
      <s-table-cell>128</s-table-cell>
    </s-table-row>
    <s-table-row>
      <s-table-cell>Canvas tote</s-table-cell>
      <s-table-cell><s-badge>Draft</s-badge></s-table-cell>
      <s-table-cell>0</s-table-cell>
    </s-table-row>
  </s-table-body>
</s-table>
```

### Ordered list: `<s-ordered-list>`

Numbered steps, where the order matters.

```html
<s-ordered-list>
  <s-list-item>Create the app</s-list-item>
  <s-list-item>Install it on a store</s-list-item>
  <s-list-item>Open it from the admin</s-list-item>
</s-ordered-list>
```

### Unordered list: `<s-unordered-list>`

Bullet points, where the order does not matter.

```html
<s-unordered-list>
  <s-list-item>Runs on Firebase</s-list-item>
  <s-list-item>No build step</s-list-item>
  <s-list-item>Scales to zero</s-list-item>
</s-unordered-list>
```
