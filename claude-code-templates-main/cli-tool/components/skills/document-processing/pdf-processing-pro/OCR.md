# PDF OCR Processing Guide

Extract text from scanned PDFs and image-based documents.

## Quick start

```python
import pytesseract
from pdf2image import convert_from_path
from PIL import Image

# Convert PDF to images
images = convert_from_path("scanned.pdf")

# Extract text from each page
for i, image in enumerate(images):
    text = pytesseract.image_to_string(image)
    print(f"Page {i+1}:\n{text}\n")
```

## Installation

### Install Tesseract

**macOS:**
```bash
brew install tesseract
```

**Ubuntu/Debian:**
```bash
sudo apt-get install tesseract-ocr
```

**Windows:**
Download from: https://github.com/UB-Mannheim/tesseract/wiki

### Install Python packages

```bash
pip install pytesseract pdf2image pillow
```

## Language support

```python
# English (default)
text = pytesseract.image_to_string(image, lang="eng")

# Spanish
text = pytesseract.image_to_string(image, lang="spa")

# Multiple languages
text = pytesseract.image_to_string(image, lang="eng+spa+fra")
```

Install additional languages:
```bash
# macOS
brew install tesseract-lang

# Ubuntu
sudo apt-get install tesseract-ocr-spa tesseract-ocr-fra
```

## Image preprocessing

```python
from PIL import Image, ImageEnhance, ImageFilter

def preprocess_for_ocr(image):
    """Optimize image for better OCR accuracy."""

    # Convert to grayscale
    image = image.convert("L")

    # Increase contrast
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(2.0)

    # Denoise
    image = image.filter(ImageFilter.MedianFilter())

    # Sharpen
    image = image.filter(ImageFilter.SHARPEN)

    return image

# Usage
image = Image.open("scanned_page.png")
processed = preprocess_for_ocr(image)
text = pytesseract.image_to_string(processed)
```

## Best practices

1. **Preprocess images** for better accuracy
2. **Use appropriate language** models
3. **Batch process** large documents
4. **Cache results** to avoid re-processing
5. **Validate output** - OCR is not 100% accurate
6. **Consider confidence scores** for quality checks

## Production example

```python
import pytesseract
from pdf2image import convert_from_path
from PIL import Image

def ocr_pdf(pdf_path, output_path):
    """OCR PDF and save to text file."""

    # Convert to images
    images = convert_from_path(pdf_path, dpi=300)

    full_text = []

    for i, image in enumerate(images, 1):
        print(f"Processing page {i}/{len(images)}")

        # Preprocess
        processed = preprocess_for_ocr(image)

        # OCR
        text = pytesseract.image_to_string(processed, lang="eng")
        full_text.append(f"--- Page {i} ---\n{text}\n")

    # Save
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(full_text))

    print(f"Saved to {output_path}")

# Usage
ocr_pdf("scanned_document.pdf", "extracted_text.txt")
```
