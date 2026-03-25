# PDF Table Extraction Guide

Advanced table extraction strategies for production environments.

## Table of contents

- Basic table extraction
- Multi-page tables
- Complex table structures
- Export formats
- Table detection algorithms
- Custom extraction rules
- Performance optimization
- Production examples

## Basic table extraction

### Using pdfplumber (recommended)

```python
import pdfplumber

with pdfplumber.open("report.pdf") as pdf:
    page = pdf.pages[0]
    tables = page.extract_tables()

    for i, table in enumerate(tables):
        print(f"\nTable {i + 1}:")
        for row in table:
            print(row)
```

### Using included script

```bash
python scripts/extract_tables.py report.pdf --output tables.csv
```

Output:
```csv
Name,Age,City
John Doe,30,New York
Jane Smith,25,Los Angeles
Bob Johnson,35,Chicago
```

## Table extraction strategies

### Strategy 1: Automatic detection

Let pdfplumber auto-detect tables:

```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    for page_num, page in enumerate(pdf.pages, 1):
        tables = page.extract_tables()

        if tables:
            print(f"Found {len(tables)} table(s) on page {page_num}")

            for table_num, table in enumerate(tables, 1):
                print(f"\nTable {table_num}:")
                # First row is usually headers
                headers = table[0]
                print(f"Columns: {headers}")

                # Data rows
                for row in table[1:]:
                    print(row)
```

### Strategy 2: Custom table settings

Fine-tune detection with custom settings:

```python
import pdfplumber

table_settings = {
    "vertical_strategy": "lines",  # or "text", "lines_strict"
    "horizontal_strategy": "lines",
    "explicit_vertical_lines": [],
    "explicit_horizontal_lines": [],
    "snap_tolerance": 3,
    "join_tolerance": 3,
    "edge_min_length": 3,
    "min_words_vertical": 3,
    "min_words_horizontal": 1,
    "keep_blank_chars": False,
    "text_tolerance": 3,
    "text_x_tolerance": 3,
    "text_y_tolerance": 3,
    "intersection_tolerance": 3
}

with pdfplumber.open("document.pdf") as pdf:
    page = pdf.pages[0]
    tables = page.extract_tables(table_settings=table_settings)
```

### Strategy 3: Explicit boundaries

Define table boundaries manually:

```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    page = pdf.pages[0]

    # Define bounding box (x0, top, x1, bottom)
    bbox = (50, 100, 550, 700)

    # Extract table within bounding box
    cropped = page.within_bbox(bbox)
    tables = cropped.extract_tables()
```

## Multi-page tables

### Detect and merge multi-page tables

```python
import pdfplumber

def extract_multipage_table(pdf_path, start_page=0, end_page=None):
    """Extract table that spans multiple pages."""

    all_rows = []
    headers = None

    with pdfplumber.open(pdf_path) as pdf:
        pages = pdf.pages[start_page:end_page]

        for page_num, page in enumerate(pages):
            tables = page.extract_tables()

            if not tables:
                continue

            # Assume first table on page
            table = tables[0]

            if page_num == 0:
                # First page: capture headers and data
                headers = table[0]
                all_rows.extend(table[1:])
            else:
                # Subsequent pages: skip headers if they repeat
                if table[0] == headers:
                    all_rows.extend(table[1:])
                else:
                    all_rows.extend(table)

    return [headers] + all_rows if headers else all_rows

# Usage
table = extract_multipage_table("report.pdf", start_page=2, end_page=5)

print(f"Extracted {len(table) - 1} rows")
print(f"Columns: {table[0]}")
```

## Complex table structures

### Handling merged cells

```python
import pdfplumber

def handle_merged_cells(table):
    """Process table with merged cells."""

    processed = []

    for row in table:
        new_row = []
        last_value = None

        for cell in row:
            if cell is None or cell == "":
                # Merged cell - use value from left
                new_row.append(last_value)
            else:
                new_row.append(cell)
                last_value = cell

        processed.append(new_row)

    return processed

# Usage
with pdfplumber.open("document.pdf") as pdf:
    table = pdf.pages[0].extract_tables()[0]
    clean_table = handle_merged_cells(table)
```

### Nested tables

```python
def extract_nested_tables(page, bbox):
    """Extract nested tables from a region."""

    cropped = page.within_bbox(bbox)

    # Try to detect sub-regions with tables
    tables = cropped.extract_tables()

    result = []
    for table in tables:
        # Process each nested table
        if table:
            result.append({
                "type": "nested",
                "data": table
            })

    return result
```

### Tables with varying column counts

```python
def normalize_table_columns(table):
    """Normalize table with inconsistent column counts."""

    if not table:
        return table

    # Find max column count
    max_cols = max(len(row) for row in table)

    # Pad short rows
    normalized = []
    for row in table:
        if len(row) < max_cols:
            # Pad with empty strings
            row = row + [""] * (max_cols - len(row))
        normalized.append(row)

    return normalized
```

## Export formats

### Export to CSV

```python
import csv

def export_to_csv(table, output_path):
    """Export table to CSV."""

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerows(table)

# Usage
table = extract_table("report.pdf")
export_to_csv(table, "output.csv")
```

### Export to Excel

```python
import pandas as pd

def export_to_excel(tables, output_path):
    """Export multiple tables to Excel with sheets."""

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        for i, table in enumerate(tables):
            if not table:
                continue

            # Convert to DataFrame
            headers = table[0]
            data = table[1:]
            df = pd.DataFrame(data, columns=headers)

            # Write to sheet
            sheet_name = f"Table_{i + 1}"
            df.to_excel(writer, sheet_name=sheet_name, index=False)

            # Auto-adjust column widths
            worksheet = writer.sheets[sheet_name]
            for column in worksheet.columns:
                max_length = 0
                column_letter = column[0].column_letter
                for cell in column:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                worksheet.column_dimensions[column_letter].width = max_length + 2

# Usage
tables = extract_all_tables("report.pdf")
export_to_excel(tables, "output.xlsx")
```

### Export to JSON

```python
import json

def export_to_json(table, output_path):
    """Export table to JSON."""

    if not table:
        return

    headers = table[0]
    data = table[1:]

    # Convert to list of dictionaries
    records = []
    for row in data:
        record = {}
        for i, header in enumerate(headers):
            value = row[i] if i < len(row) else None
            record[header] = value
        records.append(record)

    # Save to JSON
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(records, f, indent=2)

# Usage
table = extract_table("report.pdf")
export_to_json(table, "output.json")
```

## Table detection algorithms

### Visual debugging

```python
import pdfplumber

def visualize_table_detection(pdf_path, page_num=0, output_path="debug.png"):
    """Visualize detected table structure."""

    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_num]

        # Draw detected table lines
        im = page.to_image(resolution=150)
        im = im.debug_tablefinder()
        im.save(output_path)

        print(f"Saved debug image to {output_path}")

# Usage
visualize_table_detection("document.pdf", page_num=0)
```

### Algorithm: Line-based detection

Best for tables with visible borders:

```python
table_settings = {
    "vertical_strategy": "lines",
    "horizontal_strategy": "lines"
}

tables = page.extract_tables(table_settings=table_settings)
```

### Algorithm: Text-based detection

Best for tables without borders:

```python
table_settings = {
    "vertical_strategy": "text",
    "horizontal_strategy": "text"
}

tables = page.extract_tables(table_settings=table_settings)
```

### Algorithm: Explicit lines

For complex layouts, define lines manually:

```python
# Define vertical lines at x-coordinates
vertical_lines = [50, 150, 250, 350, 450, 550]

# Define horizontal lines at y-coordinates
horizontal_lines = [100, 130, 160, 190, 220, 250]

table_settings = {
    "explicit_vertical_lines": vertical_lines,
    "explicit_horizontal_lines": horizontal_lines
}

tables = page.extract_tables(table_settings=table_settings)
```

## Custom extraction rules

### Rule-based extraction

```python
def extract_with_rules(page, rules):
    """Extract table using custom rules."""

    # Rule: "Headers are bold"
    if rules.get("bold_headers"):
        chars = page.chars
        bold_chars = [c for c in chars if "Bold" in c.get("fontname", "")]
        # Use bold chars to identify header row
        pass

    # Rule: "First column is always left-aligned"
    if rules.get("left_align_first_col"):
        # Adjust extraction to respect alignment
        pass

    # Rule: "Currency values in last column"
    if rules.get("currency_last_col"):
        # Parse currency format
        pass

    # Extract with adjusted settings
    return page.extract_tables()
```

### Post-processing rules

```python
def apply_post_processing(table, rules):
    """Apply post-processing rules to extracted table."""

    processed = []

    for row in table:
        new_row = []

        for i, cell in enumerate(row):
            value = cell

            # Rule: Strip whitespace
            if rules.get("strip_whitespace"):
                value = value.strip() if value else value

            # Rule: Convert currency to float
            if rules.get("parse_currency") and i == len(row) - 1:
                if value and "$" in value:
                    value = float(value.replace("$", "").replace(",", ""))

            # Rule: Parse dates
            if rules.get("parse_dates") and i == 0:
                # Convert to datetime
                pass

            new_row.append(value)

        processed.append(new_row)

    return processed
```

## Performance optimization

### Process large PDFs efficiently

```python
def extract_tables_optimized(pdf_path):
    """Extract tables with memory optimization."""

    import gc

    results = []

    with pdfplumber.open(pdf_path) as pdf:
        for page_num, page in enumerate(pdf.pages):
            print(f"Processing page {page_num + 1}/{len(pdf.pages)}")

            # Extract tables from current page
            tables = page.extract_tables()
            results.extend(tables)

            # Force garbage collection
            gc.collect()

    return results
```

### Parallel processing

```python
from concurrent.futures import ProcessPoolExecutor
import pdfplumber

def extract_page_tables(args):
    """Extract tables from a single page."""
    pdf_path, page_num = args

    with pdfplumber.open(pdf_path) as pdf:
        page = pdf.pages[page_num]
        return page.extract_tables()

def extract_tables_parallel(pdf_path, max_workers=4):
    """Extract tables using multiple processes."""

    with pdfplumber.open(pdf_path) as pdf:
        page_count = len(pdf.pages)

    # Create tasks
    tasks = [(pdf_path, i) for i in range(page_count)]

    # Process in parallel
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        results = list(executor.map(extract_page_tables, tasks))

    # Flatten results
    all_tables = []
    for page_tables in results:
        all_tables.extend(page_tables)

    return all_tables
```

## Production examples

### Example 1: Financial report extraction

```python
import pdfplumber
import pandas as pd
from decimal import Decimal

def extract_financial_tables(pdf_path):
    """Extract financial data with proper number formatting."""

    tables = []

    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            page_tables = page.extract_tables()

            for table in page_tables:
                # Convert to DataFrame
                df = pd.DataFrame(table[1:], columns=table[0])

                # Parse currency columns
                for col in df.columns:
                    if df[col].str.contains("$", na=False).any():
                        df[col] = df[col].str.replace(r"[$,()]", "", regex=True)
                        df[col] = pd.to_numeric(df[col], errors="coerce")

                tables.append(df)

    return tables
```

### Example 2: Batch table extraction

```python
import glob
from pathlib import Path

def batch_extract_tables(input_dir, output_dir):
    """Extract tables from all PDFs in directory."""

    input_path = Path(input_dir)
    output_path = Path(output_dir)
    output_path.mkdir(exist_ok=True)

    for pdf_file in input_path.glob("*.pdf"):
        print(f"Processing: {pdf_file.name}")

        try:
            # Extract tables
            tables = extract_all_tables(str(pdf_file))

            # Export to Excel
            output_file = output_path / f"{pdf_file.stem}_tables.xlsx"
            export_to_excel(tables, str(output_file))

            print(f"  ✓ Extracted {len(tables)} table(s)")

        except Exception as e:
            print(f"  ✗ Error: {e}")

# Usage
batch_extract_tables("invoices/", "extracted/")
```

## Best practices

1. **Visualize first**: Use debug mode to understand table structure
2. **Test settings**: Try different strategies for best results
3. **Handle errors**: PDFs vary widely in quality
4. **Validate output**: Check extracted data makes sense
5. **Post-process**: Clean and normalize extracted data
6. **Use pandas**: Leverage DataFrame operations for analysis
7. **Cache results**: Avoid re-processing large files
8. **Monitor performance**: Profile for bottlenecks

## Troubleshooting

### Tables not detected

1. Try different detection strategies
2. Use visual debugging to see structure
3. Define explicit lines manually
4. Check if table is actually an image

### Incorrect cell values

1. Adjust snap/join tolerance
2. Check text extraction quality
3. Use post-processing to clean data
4. Verify PDF is not scanned image

### Performance issues

1. Process pages individually
2. Use parallel processing
3. Reduce image resolution
4. Extract only needed pages
