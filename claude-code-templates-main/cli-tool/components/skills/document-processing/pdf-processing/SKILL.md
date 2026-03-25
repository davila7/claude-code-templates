---
name: PDF Processing
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
---

# PDF Processing

## Quick start

Use pdfplumber to extract text from PDFs:

```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    text = pdf.pages[0].extract_text()
    print(text)
```

## Extracting tables

Extract tables from PDFs with automatic detection:

```python
import pdfplumber

with pdfplumber.open("report.pdf") as pdf:
    page = pdf.pages[0]
    tables = page.extract_tables()

    for table in tables:
        for row in table:
            print(row)
```

## Extracting all pages

Process multi-page documents efficiently:

```python
import pdfplumber

with pdfplumber.open("document.pdf") as pdf:
    full_text = ""
    for page in pdf.pages:
        full_text += page.extract_text() + "\n\n"

    print(full_text)
```

## Form filling

For PDF form filling, see [FORMS.md](FORMS.md) for the complete guide including field analysis and validation.

## Merging PDFs

Combine multiple PDF files:

```python
from pypdf import PdfMerger

merger = PdfMerger()

for pdf in ["file1.pdf", "file2.pdf", "file3.pdf"]:
    merger.append(pdf)

merger.write("merged.pdf")
merger.close()
```

## Splitting PDFs

Extract specific pages or ranges:

```python
from pypdf import PdfReader, PdfWriter

reader = PdfReader("input.pdf")
writer = PdfWriter()

# Extract pages 2-5
for page_num in range(1, 5):
    writer.add_page(reader.pages[page_num])

with open("output.pdf", "wb") as output:
    writer.write(output)
```

## Available packages

- **pdfplumber** - Text and table extraction (recommended)
- **pypdf** - PDF manipulation, merging, splitting
- **pdf2image** - Convert PDFs to images (requires poppler)
- **pytesseract** - OCR for scanned PDFs (requires tesseract)

## Common patterns

**Extract and save text:**
```python
import pdfplumber

with pdfplumber.open("input.pdf") as pdf:
    text = "\n\n".join(page.extract_text() for page in pdf.pages)

with open("output.txt", "w") as f:
    f.write(text)
```

**Extract tables to CSV:**
```python
import pdfplumber
import csv

with pdfplumber.open("tables.pdf") as pdf:
    tables = pdf.pages[0].extract_tables()

    with open("output.csv", "w", newline="") as f:
        writer = csv.writer(f)
        for table in tables:
            writer.writerows(table)
```

## Error handling

Handle common PDF issues:

```python
import pdfplumber

try:
    with pdfplumber.open("document.pdf") as pdf:
        if len(pdf.pages) == 0:
            print("PDF has no pages")
        else:
            text = pdf.pages[0].extract_text()
            if text is None or text.strip() == "":
                print("Page contains no extractable text (might be scanned)")
            else:
                print(text)
except Exception as e:
    print(f"Error processing PDF: {e}")
```

## Performance tips

- Process pages in batches for large PDFs
- Use multiprocessing for multiple files
- Extract only needed pages rather than entire document
- Close PDF objects after use
