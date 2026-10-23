# Polaris web components: Actions

_From [Nitrogen](https://github.com/mksd0398/nitrogen), where it is generated from `tools/reference/`._

### Button: `<s-button>`

Starts an action. One primary button per page; use tone="critical" for anything destructive.

```html
<s-stack direction="inline" gap="small-200">
  <s-button variant="primary">Save</s-button>
  <s-button>Cancel</s-button>
  <s-button variant="tertiary">Learn more</s-button>
  <s-button tone="critical">Delete</s-button>
  <s-button icon="plus">Add product</s-button>
  <s-button loading>Saving</s-button>
  <s-button disabled>Unavailable</s-button>
</s-stack>
```

### Button group: `<s-button-group>`

Lays out related buttons, with the primary action in its own slot.

```html
<s-button-group>
  <s-button slot="primary-action" variant="primary">Save</s-button>
  <s-button slot="secondary-actions">Duplicate</s-button>
  <s-button slot="secondary-actions">Archive</s-button>
</s-button-group>
```

### Clickable: `<s-clickable>`

Makes any content behave like a button or a link. It takes the same layout properties as a box.

```html
<s-clickable href="/products" border="base" borderRadius="base" padding="base">
  <s-stack gap="small-200">
    <s-heading>Products</s-heading>
    <s-text color="subdued">The whole card is the link.</s-text>
  </s-stack>
</s-clickable>
```

### Clickable chip: `<s-clickable-chip>`

A chip the merchant can press or remove, for filters and selected values.

```html
<s-stack direction="inline" gap="small-200">
  <s-clickable-chip>Active</s-clickable-chip>
  <s-clickable-chip color="strong">Draft</s-clickable-chip>
  <s-clickable-chip removable>Vendor: Acme</s-clickable-chip>
</s-stack>
```

### Link: `<s-link>`

Navigation inside text. App Bridge turns a relative href into in-app navigation.

```html
<s-paragraph>
  Open <s-link href="/settings">settings</s-link>, or read the
  <s-link href="https://shopify.dev" target="_blank">Shopify docs</s-link>.
</s-paragraph>
```

### Menu: `<s-menu>`

A list of actions that opens from a button. The button names the menu with commandFor.

```html
<s-button commandFor="demo-menu" icon="menu-horizontal">More actions</s-button>

<s-menu id="demo-menu" accessibilityLabel="Product actions">
  <s-button icon="edit">Edit</s-button>
  <s-button icon="duplicate">Duplicate</s-button>
  <s-button icon="delete" tone="critical">Delete</s-button>
</s-menu>
```
