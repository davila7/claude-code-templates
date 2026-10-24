# Polaris web components: Media and visuals

_From [Nitrogen](https://github.com/mksd0398/nitrogen), where it is generated from `tools/reference/`._

### Avatar: `<s-avatar>`

A person or a business, as a picture or as initials.

```html
<s-stack direction="inline" gap="base" alignItems="center">
  <s-avatar initials="JD" alt="Jane Doe" size="small"></s-avatar>
  <s-avatar initials="JD" alt="Jane Doe"></s-avatar>
  <s-avatar initials="JD" alt="Jane Doe" size="large"></s-avatar>
</s-stack>
```

### Icon: `<s-icon>`

An icon from the Polaris set, named with `type`. The same names work as `icon` on a button or badge.

```html
<s-stack direction="inline" gap="base">
  <s-icon type="home"></s-icon>
  <s-icon type="order"></s-icon>
  <s-icon type="product"></s-icon>
  <s-icon type="settings"></s-icon>
  <s-icon type="search"></s-icon>
  <s-icon type="check-circle" tone="success"></s-icon>
  <s-icon type="alert-triangle" tone="warning"></s-icon>
  <s-icon type="info" tone="info"></s-icon>
</s-stack>
```

### Image: `<s-image>`

A picture that keeps its shape while it loads. Always give it alt text.

```html
<s-box inlineSize="240px">
  <s-image
    src="https://cdn.shopify.com/static/sample-product/House-Plant1.png"
    alt="A house plant in a pot"
    aspectRatio="16/9"
    objectFit="cover"
    borderRadius="base"
    loading="lazy"
  ></s-image>
</s-box>
```

### Thumbnail: `<s-thumbnail>`

A small square image for a row in a list. Without a src it shows a placeholder.

```html
<s-stack direction="inline" gap="base" alignItems="center">
  <s-thumbnail alt="No image yet" size="small"></s-thumbnail>
  <s-thumbnail alt="Product" src="https://cdn.shopify.com/static/images/polaris/thumbnail-wc_src.jpg"></s-thumbnail>
  <s-thumbnail alt="Product" src="https://cdn.shopify.com/static/images/polaris/thumbnail-wc_src.jpg" size="large"></s-thumbnail>
</s-stack>
```
