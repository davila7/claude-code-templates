# Polaris web components: Feedback and status

_From [Nitrogen](https://github.com/mksd0398/nitrogen), where it is generated from `tools/reference/`._

### Badge: `<s-badge>`

A short status label. The tone carries the meaning, so keep the text to a word or two.

```html
<s-stack direction="inline" gap="small-200">
  <s-badge>Draft</s-badge>
  <s-badge tone="info">Scheduled</s-badge>
  <s-badge tone="success">Active</s-badge>
  <s-badge tone="caution">Low stock</s-badge>
  <s-badge tone="warning">Expiring</s-badge>
  <s-badge tone="critical">Failed</s-badge>
  <s-badge tone="success" icon="check-circle">Paid</s-badge>
</s-stack>
```

### Banner: `<s-banner>`

An important message at the top of a page or section. Add dismissible when it can be closed.

```html
<s-stack gap="base">
  <s-banner heading="Settings saved" tone="success" dismissible>
    Your changes are live.
  </s-banner>
  <s-banner heading="Payment method expiring" tone="warning">
    Update your card before the end of the month.
    <s-button slot="secondary-actions">Update card</s-button>
  </s-banner>
  <s-banner heading="Sync failed" tone="critical">
    The last sync stopped after 120 products.
  </s-banner>
</s-stack>
```

### Empty state: `<s-empty-state>`

What a page shows before there is any data: what belongs here, and the one action that starts it.

```html
<s-empty-state heading="No campaigns yet">
  <s-icon slot="graphic" type="product"></s-icon>
  <s-text slot="subheading">Campaigns you create will be listed here.</s-text>
  <s-button slot="primary-action" variant="primary">Create campaign</s-button>
  <s-button slot="secondary-actions">Learn more</s-button>
</s-empty-state>
```

### Progress: `<s-progress>`

How far along a task is. Give it a value and a max.

```html
<s-stack gap="base">
  <s-progress accessibilityLabel="Import progress" value="30" max="100"></s-progress>
  <s-progress accessibilityLabel="Steps completed" value="4" max="5" tone="success"></s-progress>
</s-stack>
```

### Spinner: `<s-spinner>`

Shows that something is loading when you cannot say how long it will take.

```html
<s-stack direction="inline" gap="large" alignItems="center">
  <s-spinner accessibilityLabel="Loading"></s-spinner>
  <s-spinner accessibilityLabel="Loading" size="large"></s-spinner>
</s-stack>
```
