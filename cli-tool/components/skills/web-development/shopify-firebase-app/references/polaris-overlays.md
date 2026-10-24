# Polaris web components: Overlays

_From [Nitrogen](https://github.com/mksd0398/nitrogen), where it is generated from `tools/reference/`._

### Modal: `<s-modal>`

Content over the page, for a confirmation or a short form. Any button opens it with commandFor, and closes it with command="--hide".

```html
<s-button commandFor="demo-modal">Delete product</s-button>

<s-modal id="demo-modal" heading="Delete this product?">
  <s-paragraph>This cannot be undone.</s-paragraph>

  <s-button slot="secondary-actions" commandFor="demo-modal" command="--hide">Cancel</s-button>
  <s-button slot="primary-action" variant="primary" tone="critical" commandFor="demo-modal" command="--hide">
    Delete
  </s-button>
</s-modal>
```

From JavaScript, open it with `document.getElementById("demo-modal").showOverlay()`.

### Popover: `<s-popover>`

A small panel anchored to the button that opens it.

```html
<s-button commandFor="demo-popover">Filter</s-button>

<s-popover id="demo-popover">
  <s-box padding="base">
    <s-choice-list label="Status" name="status">
      <s-choice value="active" selected>Active</s-choice>
      <s-choice value="draft">Draft</s-choice>
    </s-choice-list>
  </s-box>
</s-popover>
```
