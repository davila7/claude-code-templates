# Polaris web components: Typography and content

_From [Nitrogen](https://github.com/mksd0398/nitrogen), where it is generated from `tools/reference/`._

### Heading: `<s-heading>`

A title for a block of content. The level follows how deeply it is nested in sections; fontSize only changes how it looks.

```html
<s-stack gap="small-200">
  <s-heading fontSize="large-400">large-400</s-heading>
  <s-heading fontSize="large-300">large-300</s-heading>
  <s-heading fontSize="large-200">large-200</s-heading>
  <s-heading fontSize="large">large</s-heading>
  <s-heading>base</s-heading>
  <s-heading fontSize="small">small</s-heading>
</s-stack>
```

### Paragraph: `<s-paragraph>`

A block of text. `lineClamp` cuts it off after a number of lines.

```html
<s-stack gap="small-200">
  <s-paragraph>A paragraph sits on its own line and leaves space before the next.</s-paragraph>
  <s-paragraph color="subdued">Subdued, for supporting detail.</s-paragraph>
  <s-paragraph tone="critical">Critical, for an error.</s-paragraph>
  <s-paragraph lineClamp="1">
    Clamped to one line, so a long description is cut short with an ellipsis rather than pushing the layout around.
  </s-paragraph>
</s-stack>
```

### Text: `<s-text>`

Text inside a line. `color` is base or subdued; meaning such as success or critical is a `tone`.

```html
<s-stack gap="small-200">
  <s-text>Default</s-text>
  <s-text type="strong">Strong</s-text>
  <s-text fontWeight="semibold">Semibold</s-text>
  <s-text color="subdued">Subdued</s-text>
  <s-text tone="success">Success</s-text>
  <s-text tone="critical">Critical</s-text>
  <s-text fontSize="small">Small</s-text>
  <s-text fontSize="large">Large</s-text>
</s-stack>
```

### Number: `<s-number>`

A figure set in tabular numerals, so a column of them lines up.

```html
<s-stack gap="small-100">
  <s-number>1,204</s-number>
  <s-number>98</s-number>
  <s-number tone="success" fontWeight="semibold">17,660</s-number>
</s-stack>
```

### Chip: `<s-chip>`

A label for a tag or a category. Unlike a clickable chip, it does nothing when pressed.

```html
<s-stack direction="inline" gap="small-200">
  <s-chip>Summer</s-chip>
  <s-chip color="strong">Featured</s-chip>
  <s-chip><s-icon slot="graphic" type="product"></s-icon>Apparel</s-chip>
</s-stack>
```

### Tooltip: `<s-tooltip>`

A hint shown on hover or focus. The element it describes names it with interestFor.

```html
<s-tooltip id="demo-tooltip">Copy the key to your clipboard</s-tooltip>
<s-button interestFor="demo-tooltip" icon="clipboard" accessibilityLabel="Copy">Copy</s-button>
```
