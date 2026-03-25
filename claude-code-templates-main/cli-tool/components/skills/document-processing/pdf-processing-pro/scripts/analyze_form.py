#!/usr/bin/env python3
"""
Analyze PDF form fields and structure.

Usage:
    python analyze_form.py input.pdf [--output fields.json] [--verbose]

Returns:
    JSON with all form fields, types, positions, and metadata

Exit codes:
    0 - Success
    1 - File not found
    2 - Invalid PDF
    3 - Processing error
"""

import sys
import json
import logging
import argparse
from pathlib import Path
from typing import Dict, List, Optional, Any

try:
    from pypdf import PdfReader
except ImportError:
    print("Error: pypdf not installed. Run: pip install pypdf", file=sys.stderr)
    sys.exit(3)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class FormField:
    """Represents a PDF form field."""

    def __init__(self, name: str, field_dict: Dict[str, Any]):
        self.name = name
        self.raw_data = field_dict

    @property
    def field_type(self) -> str:
        """Get field type."""
        ft = self.raw_data.get('/FT', '')
        type_map = {
            '/Tx': 'text',
            '/Btn': 'button',  # checkbox or radio
            '/Ch': 'choice',   # dropdown or list
            '/Sig': 'signature'
        }
        return type_map.get(ft, 'unknown')

    @property
    def value(self) -> Optional[str]:
        """Get current field value."""
        val = self.raw_data.get('/V')
        return str(val) if val else None

    @property
    def default_value(self) -> Optional[str]:
        """Get default field value."""
        dv = self.raw_data.get('/DV')
        return str(dv) if dv else None

    @property
    def is_required(self) -> bool:
        """Check if field is required."""
        flags = self.raw_data.get('/Ff', 0)
        # Bit 2 indicates required
        return bool(flags & 2)

    @property
    def is_readonly(self) -> bool:
        """Check if field is read-only."""
        flags = self.raw_data.get('/Ff', 0)
        # Bit 1 indicates read-only
        return bool(flags & 1)

    @property
    def options(self) -> List[str]:
        """Get options for choice fields."""
        if self.field_type != 'choice':
            return []

        opts = self.raw_data.get('/Opt', [])
        if isinstance(opts, list):
            return [str(opt) for opt in opts]
        return []

    @property
    def max_length(self) -> Optional[int]:
        """Get max length for text fields."""
        if self.field_type == 'text':
            return self.raw_data.get('/MaxLen')
        return None

    @property
    def rect(self) -> Optional[List[float]]:
        """Get field position and size [x0, y0, x1, y1]."""
        return self.raw_data.get('/Rect')

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        result = {
            'name': self.name,
            'type': self.field_type,
            'required': self.is_required,
            'readonly': self.is_readonly
        }

        if self.value is not None:
            result['value'] = self.value

        if self.default_value is not None:
            result['default_value'] = self.default_value

        if self.options:
            result['options'] = self.options

        if self.max_length is not None:
            result['max_length'] = self.max_length

        if self.rect:
            result['position'] = {
                'x0': float(self.rect[0]),
                'y0': float(self.rect[1]),
                'x1': float(self.rect[2]),
                'y1': float(self.rect[3]),
                'width': float(self.rect[2] - self.rect[0]),
                'height': float(self.rect[3] - self.rect[1])
            }

        return result


class PDFFormAnalyzer:
    """Analyzes PDF forms and extracts field information."""

    def __init__(self, pdf_path: str):
        self.pdf_path = Path(pdf_path)
        self.reader: Optional[PdfReader] = None
        self._validate_file()

    def _validate_file(self) -> None:
        """Validate PDF file exists and is readable."""
        if not self.pdf_path.exists():
            logger.error(f"PDF not found: {self.pdf_path}")
            raise FileNotFoundError(f"PDF not found: {self.pdf_path}")

        if not self.pdf_path.is_file():
            logger.error(f"Not a file: {self.pdf_path}")
            raise ValueError(f"Not a file: {self.pdf_path}")

        if self.pdf_path.suffix.lower() != '.pdf':
            logger.error(f"Not a PDF file: {self.pdf_path}")
            raise ValueError(f"Not a PDF file: {self.pdf_path}")

    def analyze(self) -> Dict[str, Dict[str, Any]]:
        """
        Analyze PDF and extract all form fields.

        Returns:
            Dictionary mapping field names to field information
        """
        try:
            self.reader = PdfReader(str(self.pdf_path))

            if not self.reader.pages:
                logger.warning("PDF has no pages")
                return {}

            logger.info(f"Analyzing PDF with {len(self.reader.pages)} pages")

            # Get form fields
            raw_fields = self.reader.get_fields()

            if not raw_fields:
                logger.warning("PDF has no form fields")
                return {}

            logger.info(f"Found {len(raw_fields)} form fields")

            # Process fields
            fields = {}
            for field_name, field_dict in raw_fields.items():
                try:
                    field = FormField(field_name, field_dict)
                    fields[field_name] = field.to_dict()
                except Exception as e:
                    logger.warning(f"Error processing field {field_name}: {e}")
                    continue

            return fields

        except Exception as e:
            logger.error(f"Error analyzing PDF: {e}")
            raise

    def get_summary(self) -> Dict[str, Any]:
        """Get summary statistics."""
        fields = self.analyze()

        summary = {
            'total_fields': len(fields),
            'field_types': {},
            'required_fields': [],
            'readonly_fields': [],
            'fields_with_values': []
        }

        for field_name, field_data in fields.items():
            # Count by type
            field_type = field_data['type']
            summary['field_types'][field_type] = summary['field_types'].get(field_type, 0) + 1

            # Required fields
            if field_data.get('required'):
                summary['required_fields'].append(field_name)

            # Read-only fields
            if field_data.get('readonly'):
                summary['readonly_fields'].append(field_name)

            # Fields with values
            if field_data.get('value'):
                summary['fields_with_values'].append(field_name)

        return summary


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description='Analyze PDF form fields',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  %(prog)s form.pdf
  %(prog)s form.pdf --output fields.json
  %(prog)s form.pdf --output fields.json --verbose
  %(prog)s form.pdf --summary

Exit codes:
  0 - Success
  1 - File not found
  2 - Invalid PDF
  3 - Processing error
        '''
    )

    parser.add_argument('input', help='Input PDF file')
    parser.add_argument('--output', '-o', help='Output JSON file (default: stdout)')
    parser.add_argument('--summary', '-s', action='store_true', help='Show summary only')
    parser.add_argument('--verbose', '-v', action='store_true', help='Verbose output')

    args = parser.parse_args()

    # Set log level
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    else:
        logger.setLevel(logging.WARNING)

    try:
        # Analyze form
        analyzer = PDFFormAnalyzer(args.input)

        if args.summary:
            result = analyzer.get_summary()
        else:
            result = analyzer.analyze()

        # Output
        json_output = json.dumps(result, indent=2)

        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(json_output)
            logger.info(f"Saved to {args.output}")
        else:
            print(json_output)

        return 0

    except FileNotFoundError:
        logger.error(f"File not found: {args.input}")
        return 1

    except ValueError as e:
        logger.error(f"Invalid input: {e}")
        return 2

    except Exception as e:
        logger.error(f"Error: {e}")
        if args.verbose:
            import traceback
            traceback.print_exc()
        return 3


if __name__ == '__main__':
    sys.exit(main())
