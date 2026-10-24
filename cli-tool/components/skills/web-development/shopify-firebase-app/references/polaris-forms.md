# Polaris web components: Forms

_From [Nitrogen](https://github.com/mksd0398/nitrogen), where it is generated from `tools/reference/`._

### Text field: `<s-text-field>`

One line of text. `details` is the help text under the field; `error` replaces it when the value is wrong.

```html
<s-stack gap="base">
  <s-text-field
    label="Store name"
    name="storeName"
    placeholder="My store"
    details="Shown to customers at checkout."
  ></s-text-field>
  <s-text-field label="Discount code" value="SUMMER" prefix="#" suffix="active"></s-text-field>
  <s-text-field label="Handle" value="my store" error="A handle cannot contain spaces."></s-text-field>
  <s-text-field label="Search" labelAccessibilityVisibility="exclusive" placeholder="The label is hidden, but still read aloud"></s-text-field>
</s-stack>
```

### Text area: `<s-text-area>`

Several lines of text. `rows` sets the starting height.

```html
<s-text-area
  label="Description"
  name="description"
  rows="4"
  maxLength="500"
  details="Up to 500 characters."
></s-text-area>
```

### Email field: `<s-email-field>`

An email address, with the right keyboard on mobile and browser autofill.

```html
<s-email-field label="Contact email" name="email" placeholder="you@example.com" autocomplete="email"></s-email-field>
```

### Password field: `<s-password-field>`

A secret value, hidden as it is typed.

```html
<s-password-field label="API secret" name="secret" details="Stored encrypted."></s-password-field>
```

### Number field: `<s-number-field>`

A number with optional limits and step.

```html
<s-number-field label="Quantity" name="quantity" value="1" min="0" max="100" step="1" suffix="units"></s-number-field>
```

### Money field: `<s-money-field>`

An amount of money. The currency follows the shop unless you name one.

```html
<s-money-field label="Price" name="price" value="19.99" currencyCode="USD" min="0"></s-money-field>
```

### URL field: `<s-url-field>`

A web address.

```html
<s-url-field label="Website" name="website" placeholder="https://example.com"></s-url-field>
```

### Search field: `<s-search-field>`

A text field for searching, with a search icon and a clear button built in.

```html
<s-search-field label="Search products" labelAccessibilityVisibility="exclusive" placeholder="Search products"></s-search-field>
```

### Select: `<s-select>`

One choice from a list. Group long lists with s-option-group.

```html
<s-select label="Country" name="country" details="Used for tax calculation.">
  <s-option-group label="North America">
    <s-option value="ca">Canada</s-option>
    <s-option value="us" selected>United States</s-option>
  </s-option-group>
  <s-option-group label="Asia">
    <s-option value="in">India</s-option>
    <s-option value="jp">Japan</s-option>
  </s-option-group>
</s-select>
```

### Checkbox: `<s-checkbox>`

A choice that is saved with the rest of the form. For a setting that applies at once, use a switch.

```html
<s-stack gap="small-200">
  <s-checkbox label="Send order confirmations" name="confirmations" checked></s-checkbox>
  <s-checkbox label="Send marketing emails" name="marketing" details="At most once a week."></s-checkbox>
  <s-checkbox label="Accept the terms" name="terms" error="You must accept the terms."></s-checkbox>
</s-stack>
```

### Switch: `<s-switch>`

Turns a setting on or off, taking effect immediately.

```html
<s-stack gap="small-200">
  <s-switch label="Enable notifications" name="notifications" checked></s-switch>
  <s-switch label="Test mode" name="testMode" details="Orders placed in test mode are not charged."></s-switch>
</s-stack>
```

### Choice list: `<s-choice-list>`

Radio buttons by default; add `multiple` for checkboxes. Read the result from its `values`.

```html
<s-stack gap="base">
  <s-choice-list label="Shipping speed" name="speed">
    <s-choice value="standard" selected>Standard</s-choice>
    <s-choice value="express">Express</s-choice>
    <s-choice value="overnight">Overnight</s-choice>
  </s-choice-list>
  <s-choice-list label="Sales channels" name="channels" multiple>
    <s-choice value="online" selected>Online store</s-choice>
    <s-choice value="pos">Point of sale</s-choice>
  </s-choice-list>
</s-stack>
```

### Color field: `<s-color-field>`

A colour typed as a value, with a swatch that opens a picker.

```html
<s-color-field label="Brand colour" name="brand" value="#008060"></s-color-field>
```

### Color picker: `<s-color-picker>`

The picker on its own. Add `alpha` to allow transparency.

```html
<s-color-picker name="accent" value="#5C6AC4" alpha></s-color-picker>
```

### Date field: `<s-date-field>`

A date typed or picked from a calendar. Dates are YYYY-MM-DD; `disallowDays` blocks weekdays.

```html
<s-date-field
  label="Start date"
  name="startDate"
  value="2026-10-01"
  view="2026-10"
  disallowDays="saturday, sunday"
></s-date-field>
```

### Date picker: `<s-date-picker>`

An inline calendar for one date, several dates or a range. A range is written start--end.

```html
<s-date-picker name="range" type="range" view="2026-10" value="2026-10-05--2026-10-12"></s-date-picker>
```

### Drop zone: `<s-drop-zone>`

File upload by drag and drop or by browsing. The chosen files are on its `files` property.

```html
<s-drop-zone
  label="Product images"
  name="images"
  accept=".jpg,.png,.webp"
  accessibilityLabel="Upload product images as jpg, png or webp"
  multiple
></s-drop-zone>
```
