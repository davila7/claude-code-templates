---
name: pdf-fill-studio
description: Fill any PDF locally and place each value precisely in a visual editor. Use when the user wants to fill out a PDF form, enter data into a PDF, complete a tax/insurance/bank form, or position text on a flat/scanned PDF. Handles flat (field-less) PDFs, per-character (comb) fields, and native AcroForm fields; leaves the signature blank for the user to sign.
---

# pdf-fill-studio

Fill a PDF locally, place the values precisely, then export. Flat PDFs use a browser editor;
AcroForm PDFs fill natively; the signature is always left blank for the user to sign.

## When to use
The user gives you a PDF to fill (form, claim, tax/bank/insurance document).

## Setup (once)
`pip install pdf-fill-studio` (provides the `pdf-fill-studio` command).
From source instead: `python3 -m venv .venv && .venv/bin/pip install -e .`, then use
`.venv/bin/pdf-fill-studio`.

## Flow
(Replace `form.pdf` and `profile.json` with the user's actual file paths.)
1. Start: `pdf-fill-studio form.pdf -o out/form_filled.pdf`. It detects the form type.
2. **AcroForm (native fields):** re-run with a profile of known facts:
   `pdf-fill-studio form.pdf -o out/form_filled.pdf --profile profile.json`.
   Matched fields fill automatically; it prints "Needs manual input: [...]" for the rest. Ask the
   user for each listed field, add them to the profile, re-run, then render to verify.
3. **Flat (no fields):** a local browser editor opens. Tell the user to type values, drag boxes
   onto the lines, nudge with arrow keys, and click "Export PDF". Comb fields (one box per
   character, e.g. postal code) are detected and filled one character per cell automatically.
4. **XFA:** tell the user this form type is not supported yet (open it in free Adobe Reader).
5. The filled PDF is written to `out/`. The user signs it themselves.

## Self-check (before declaring done)
Render and look: `python -m pdf_fill_studio.render_page out/form_filled.pdf out/preview`.
Check each value sits on its line / inside its cell, not too low or spilling outside. Apply
minimal coordinate corrections and re-bake if needed.

## Rules
- Never fill a signature field.
- Never store or hard-code a SIN, bank account, or card number (the profile matcher skips them).
- Everything runs locally; no document is uploaded.
