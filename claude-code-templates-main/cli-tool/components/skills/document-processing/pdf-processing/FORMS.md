# PDF Form Filling Guide

## Overview

This guide covers filling PDF forms programmatically using PyPDF2 and pdfrw libraries.

## Analyzing form fields

First, identify all fillable fields in a PDF:

```python
from pypdf import PdfReader

reader = PdfReader("form.pdf")
fields = reader.get_fields()

for field_name, field_info in fields.items():
    print(f"Field: {field_name}")
    print(f"  Type: {field_info.get('/FT')}")
    print(f"  Value: {field_info.get('/V')}")
    print()
```

## Filling form fields

Fill fields with values:

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("form.pdf")
writer = PdfWriter()

writer.append_pages_from_reader(reader)

# Fill form fields
writer.update_page_form_field_values(
    writer.pages[0],
    {
        "name": "John Doe",
        "email": "john@example.com",
        "address": "123 Main St"
    }
)

with open("filled_form.pdf", "wb") as output:
    writer.write(output)
```

## Flattening forms

Remove form fields after filling (make non-editable):

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("filled_form.pdf")
writer = PdfWriter()

for page in reader.pages:
    writer.add_page(page)

# Flatten all form fields
writer.flatten_form_fields()

with open("flattened.pdf", "wb") as output:
    writer.write(output)
```

## Validation

Validate field values before filling:

```python
def validate_email(email):
    return "@" in email and "." in email

def validate_form_data(data, required_fields):
    errors = []

    for field in required_fields:
        if field not in data or not data[field]:
            errors.append(f"Missing required field: {field}")

    if "email" in data and not validate_email(data["email"]):
        errors.append("Invalid email format")

    return errors

# Usage
data = {"name": "John Doe", "email": "john@example.com"}
required = ["name", "email", "address"]

errors = validate_form_data(data, required)
if errors:
    print("Validation errors:")
    for error in errors:
        print(f"  - {error}")
else:
    # Proceed with filling
    pass
```

## Common field types

**Text fields:**
```python
writer.update_page_form_field_values(
    writer.pages[0],
    {"text_field": "Some text"}
)
```

**Checkboxes:**
```python
# Check a checkbox
writer.update_page_form_field_values(
    writer.pages[0],
    {"checkbox_field": "/Yes"}
)

# Uncheck a checkbox
writer.update_page_form_field_values(
    writer.pages[0],
    {"checkbox_field": "/Off"}
)
```

**Radio buttons:**
```python
writer.update_page_form_field_values(
    writer.pages[0],
    {"radio_group": "/Option1"}
)
```

## Best practices

1. **Always validate** input data before filling
2. **Check field names** match exactly (case-sensitive)
3. **Test with small files** first
4. **Keep originals** - work on copies
5. **Flatten after filling** for distribution
