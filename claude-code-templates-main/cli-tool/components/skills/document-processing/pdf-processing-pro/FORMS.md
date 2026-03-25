# PDF Form Processing Guide

Complete guide for processing PDF forms in production environments.

## Table of contents

- Form analysis and field detection
- Form filling workflows
- Validation strategies
- Field types and handling
- Multi-page forms
- Flattening and finalization
- Error handling patterns
- Production examples

## Form analysis

### Analyze form structure

Use `analyze_form.py` to extract complete form information:

```bash
python scripts/analyze_form.py application.pdf --output schema.json
```

Output format:

```json
{
  "full_name": {
    "type": "text",
    "required": true,
    "max_length": 100,
    "x": 120.5,
    "y": 450.2,
    "width": 300,
    "height": 20
  },
  "date_of_birth": {
    "type": "text",
    "required": true,
    "format": "MM/DD/YYYY",
    "x": 120.5,
    "y": 400.8,
    "width": 150,
    "height": 20
  },
  "email_newsletter": {
    "type": "checkbox",
    "required": false,
    "x": 120.5,
    "y": 350.4,
    "width": 15,
    "height": 15
  },
  "preferred_contact": {
    "type": "radio",
    "required": true,
    "options": ["email", "phone", "mail"],
    "x": 120.5,
    "y": 300.0,
    "width": 200,
    "height": 60
  }
}
```

### Programmatic analysis

```python
from pypdf import PdfReader

reader = PdfReader("form.pdf")
fields = reader.get_fields()

for field_name, field_info in fields.items():
    print(f"Field: {field_name}")
    print(f"  Type: {field_info.get('/FT')}")
    print(f"  Value: {field_info.get('/V')}")
    print(f"  Flags: {field_info.get('/Ff', 0)}")
    print()
```

## Form filling workflows

### Basic workflow

```bash
# 1. Analyze form
python scripts/analyze_form.py template.pdf --output schema.json

# 2. Prepare data
cat > data.json << EOF
{
  "full_name": "John Doe",
  "date_of_birth": "01/15/1990",
  "email": "john@example.com",
  "email_newsletter": true,
  "preferred_contact": "email"
}
EOF

# 3. Validate data
python scripts/validate_form.py data.json schema.json

# 4. Fill form
python scripts/fill_form.py template.pdf data.json filled.pdf

# 5. Flatten (optional - makes fields non-editable)
python scripts/flatten_form.py filled.pdf final.pdf
```

### Programmatic filling

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("template.pdf")
writer = PdfWriter()

# Clone all pages
for page in reader.pages:
    writer.add_page(page)

# Fill form fields
writer.update_page_form_field_values(
    writer.pages[0],
    {
        "full_name": "John Doe",
        "date_of_birth": "01/15/1990",
        "email": "john@example.com",
        "email_newsletter": "/Yes",  # Checkbox value
        "preferred_contact": "/email"  # Radio value
    }
)

# Save filled form
with open("filled.pdf", "wb") as output:
    writer.write(output)
```

## Field types and handling

### Text fields

```python
# Simple text
field_values["customer_name"] = "Jane Smith"

# Formatted text (dates)
field_values["date"] = "12/25/2024"

# Numbers
field_values["amount"] = "1234.56"

# Multi-line text
field_values["comments"] = "Line 1\nLine 2\nLine 3"
```

### Checkboxes

Checkboxes typically use `/Yes` for checked, `/Off` for unchecked:

```python
# Check checkbox
field_values["agree_to_terms"] = "/Yes"

# Uncheck checkbox
field_values["newsletter_opt_out"] = "/Off"
```

**Note**: Some PDFs use different values. Check with `analyze_form.py`:

```json
{
  "some_checkbox": {
    "type": "checkbox",
    "on_value": "/On",   # ← Check this
    "off_value": "/Off"
  }
}
```

### Radio buttons

Radio buttons are mutually exclusive options:

```python
# Select one option from radio group
field_values["preferred_contact"] = "/email"

# Other options in same group
# field_values["preferred_contact"] = "/phone"
# field_values["preferred_contact"] = "/mail"
```

### Dropdown/List boxes

```python
# Single selection
field_values["country"] = "United States"

# List of available options in schema
"country": {
  "type": "dropdown",
  "options": ["United States", "Canada", "Mexico", ...]
}
```

## Validation strategies

### Schema-based validation

```python
import json
from jsonschema import validate, ValidationError

# Load schema from analyze_form.py output
with open("schema.json") as f:
    schema = json.load(f)

# Load form data
with open("data.json") as f:
    data = json.load(f)

# Validate all fields
errors = []

for field_name, field_schema in schema.items():
    value = data.get(field_name)

    # Check required fields
    if field_schema.get("required") and not value:
        errors.append(f"Missing required field: {field_name}")

    # Check field type
    if value and field_schema.get("type") == "text":
        if not isinstance(value, str):
            errors.append(f"Field {field_name} must be string")

    # Check max length
    max_length = field_schema.get("max_length")
    if value and max_length and len(str(value)) > max_length:
        errors.append(f"Field {field_name} exceeds max length {max_length}")

    # Check format (dates, emails, etc)
    format_type = field_schema.get("format")
    if value and format_type:
        if not validate_format(value, format_type):
            errors.append(f"Field {field_name} has invalid format")

if errors:
    print("Validation errors:")
    for error in errors:
        print(f"  - {error}")
    exit(1)

print("Validation passed")
```

### Format validation

```python
import re
from datetime import datetime

def validate_format(value, format_type):
    """Validate field format."""

    if format_type == "email":
        pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return re.match(pattern, value) is not None

    elif format_type == "phone":
        # US phone: (555) 123-4567 or 555-123-4567
        pattern = r'^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$'
        return re.match(pattern, value) is not None

    elif format_type == "MM/DD/YYYY":
        try:
            datetime.strptime(value, "%m/%d/%Y")
            return True
        except ValueError:
            return False

    elif format_type == "SSN":
        # XXX-XX-XXXX
        pattern = r'^\d{3}-\d{2}-\d{4}$'
        return re.match(pattern, value) is not None

    elif format_type == "ZIP":
        # XXXXX or XXXXX-XXXX
        pattern = r'^\d{5}(-\d{4})?$'
        return re.match(pattern, value) is not None

    return True  # Unknown format, skip validation
```

## Multi-page forms

### Handling multi-page forms

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("multi_page_form.pdf")
writer = PdfWriter()

# Clone all pages
for page in reader.pages:
    writer.add_page(page)

# Fill fields on page 1
writer.update_page_form_field_values(
    writer.pages[0],
    {
        "name_page1": "John Doe",
        "email_page1": "john@example.com"
    }
)

# Fill fields on page 2
writer.update_page_form_field_values(
    writer.pages[1],
    {
        "address_page2": "123 Main St",
        "city_page2": "Springfield"
    }
)

# Fill fields on page 3
writer.update_page_form_field_values(
    writer.pages[2],
    {
        "signature_page3": "John Doe",
        "date_page3": "12/25/2024"
    }
)

with open("filled_multi_page.pdf", "wb") as output:
    writer.write(output)
```

### Identifying page-specific fields

```python
# Analyze which fields are on which pages
for page_num, page in enumerate(reader.pages, 1):
    fields = page.get("/Annots", [])

    if fields:
        print(f"\nPage {page_num} fields:")
        for field_ref in fields:
            field = field_ref.get_object()
            field_name = field.get("/T", "Unknown")
            print(f"  - {field_name}")
```

## Flattening forms

### Why flatten

Flattening makes form fields non-editable, embedding values permanently:

- **Security**: Prevent modifications
- **Distribution**: Share read-only forms
- **Printing**: Ensure correct appearance
- **Archival**: Long-term storage

### Flatten with pypdf

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("filled.pdf")
writer = PdfWriter()

# Add all pages
for page in reader.pages:
    writer.add_page(page)

# Flatten all form fields
writer.flatten_fields()

# Save flattened PDF
with open("flattened.pdf", "wb") as output:
    writer.write(output)
```

### Using included script

```bash
python scripts/flatten_form.py filled.pdf flattened.pdf
```

## Error handling patterns

### Robust form filling

```python
import logging
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def fill_form_safe(template_path, data, output_path):
    """Fill form with comprehensive error handling."""

    try:
        # Validate inputs
        template = Path(template_path)
        if not template.exists():
            raise FileNotFoundError(f"Template not found: {template_path}")

        # Read template
        logger.info(f"Reading template: {template_path}")
        reader = PdfReader(template_path)

        if not reader.pages:
            raise ValueError("PDF has no pages")

        # Check if form has fields
        fields = reader.get_fields()
        if not fields:
            logger.warning("PDF has no form fields")
            return False

        # Create writer
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)

        # Validate data against schema
        missing_required = []
        invalid_fields = []

        for field_name, field_info in fields.items():
            # Check required fields
            is_required = field_info.get("/Ff", 0) & 2 == 2
            if is_required and field_name not in data:
                missing_required.append(field_name)

            # Check invalid field names in data
            if field_name in data:
                value = data[field_name]
                # Add type validation here if needed

        if missing_required:
            raise ValueError(f"Missing required fields: {missing_required}")

        # Fill fields
        logger.info("Filling form fields")
        writer.update_page_form_field_values(
            writer.pages[0],
            data
        )

        # Write output
        logger.info(f"Writing output: {output_path}")
        with open(output_path, "wb") as output:
            writer.write(output)

        logger.info("Form filled successfully")
        return True

    except PdfReadError as e:
        logger.error(f"PDF read error: {e}")
        return False

    except FileNotFoundError as e:
        logger.error(f"File error: {e}")
        return False

    except ValueError as e:
        logger.error(f"Validation error: {e}")
        return False

    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return False

# Usage
success = fill_form_safe(
    "template.pdf",
    {"name": "John", "email": "john@example.com"},
    "filled.pdf"
)

if not success:
    exit(1)
```

## Production examples

### Example 1: Batch form processing

```python
import json
import glob
from pathlib import Path
from fill_form_safe import fill_form_safe

# Process multiple submissions
submissions_dir = Path("submissions")
template = "application_template.pdf"
output_dir = Path("completed")
output_dir.mkdir(exist_ok=True)

for submission_file in submissions_dir.glob("*.json"):
    print(f"Processing: {submission_file.name}")

    # Load submission data
    with open(submission_file) as f:
        data = json.load(f)

    # Fill form
    applicant_id = data.get("id", "unknown")
    output_file = output_dir / f"application_{applicant_id}.pdf"

    success = fill_form_safe(template, data, output_file)

    if success:
        print(f"  ✓ Completed: {output_file}")
    else:
        print(f"  ✗ Failed: {submission_file.name}")
```

### Example 2: Form with conditional logic

```python
def prepare_form_data(raw_data):
    """Prepare form data with conditional logic."""

    form_data = {}

    # Basic fields
    form_data["full_name"] = raw_data["name"]
    form_data["email"] = raw_data["email"]

    # Conditional fields
    if raw_data.get("is_student"):
        form_data["student_id"] = raw_data["student_id"]
        form_data["school_name"] = raw_data["school"]
    else:
        form_data["employer"] = raw_data.get("employer", "")

    # Checkbox logic
    form_data["newsletter"] = "/Yes" if raw_data.get("opt_in") else "/Off"

    # Calculated fields
    total = sum(raw_data.get("items", []))
    form_data["total_amount"] = f"${total:.2f}"

    return form_data

# Usage
raw_input = {
    "name": "Jane Smith",
    "email": "jane@example.com",
    "is_student": True,
    "student_id": "12345",
    "school": "State University",
    "opt_in": True,
    "items": [10.00, 25.50, 15.75]
}

form_data = prepare_form_data(raw_input)
fill_form_safe("template.pdf", form_data, "output.pdf")
```

## Best practices

1. **Always analyze before filling**: Use `analyze_form.py` to understand structure
2. **Validate early**: Check data before attempting to fill
3. **Use logging**: Track operations for debugging
4. **Handle errors gracefully**: Don't crash on invalid data
5. **Test with samples**: Verify with small datasets first
6. **Flatten when distributing**: Make read-only for recipients
7. **Keep templates versioned**: Track form template changes
8. **Document field mappings**: Maintain data-to-field documentation

## Troubleshooting

### Fields not filling

1. Check field names match exactly (case-sensitive)
2. Verify checkbox/radio values (`/Yes`, `/On`, etc.)
3. Ensure PDF is not encrypted or protected
4. Check if form uses XFA format (not supported by pypdf)

### Encoding issues

```python
# Handle special characters
field_values["name"] = "José García"  # UTF-8 encoded
```

### Large batch processing

```python
# Process in chunks to avoid memory issues
chunk_size = 100

for i in range(0, len(submissions), chunk_size):
    chunk = submissions[i:i + chunk_size]
    process_batch(chunk)
```
