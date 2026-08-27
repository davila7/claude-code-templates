---
name: patentfig
description: Generate patent-office-compliant figures via the PatentFig AI API — patent line art from text (PNG or SVG), vectorize drawings to SVG/DXF/vector PDF, AI-upscale images, and convert to filing-ready TIFF/PDF/PNG. Use when the user asks for patent drawings, patent figures, invention diagrams, USPTO/EPO-compliant line art, vectorizing a drawing for CAD, or preparing figures for a patent filing. Requires a PATENTFIG_API_KEY environment variable.
version: 1.0.0
author: TopLocalAI
license: MIT
tags: [Patent, Patent Drawings, Line Art, SVG, Vectorize, DXF, USPTO, Image Generation, API]
metadata:
  homepage: https://patentfig.ai
  docs: https://patentfig.ai/docs
---

# PatentFig AI API

Generate and convert patent figures through the PatentFig AI REST API.

- **Base URL**: `https://patentfig.ai/api/v1`
- **Auth**: `Authorization: Bearer $PATENTFIG_API_KEY`
- **All endpoints are synchronous** and return JSON: `{ "success": true, "data": {...} }` on success, `{ "success": false, "error": { "code", "message" } }` on failure.
- Generated files are returned as URLs on `https://cdn.patentfig.ai` — pass them to the user or feed them into follow-up calls.

## Setup

The key comes from the `PATENTFIG_API_KEY` environment variable. Never hardcode it, print it, or write it into files or logs.

If the variable is not set, tell the user to create a key at https://patentfig.ai/settings/api-keys (requires a PatentFig AI account; keys start with `pfig_`) and export it:

```bash
export PATENTFIG_API_KEY="pfig_..."
```

Verify connectivity and credit balance (free call):

```bash
curl -s https://patentfig.ai/api/v1/credits \
  -H "Authorization: Bearer $PATENTFIG_API_KEY"
# → { "success": true, "data": { "balance": 500 } }
```

## Generate a patent figure (10 credits)

`POST /figures` — the core endpoint. One prompt → one figure. Views, diagram type, and composition are all controlled through the prompt; for a multi-view set (front/side/top), make one call per view.

```bash
curl -s -X POST https://patentfig.ai/api/v1/figures \
  -H "Authorization: Bearer $PATENTFIG_API_KEY" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  -d '{
    "prompt": "Exploded view of a wireless earbud charging case showing lid, hinge, charging coil, and battery",
    "output": "svg",
    "labeled": true
  }'
```

- `output`: `"png"` (raster figure) or `"svg"` (stroke-based line art, CAD-friendly). Default `"png"`.
- `labeled: true` adds patent-style numeric reference callouts (100, 102, …).
- `referenceImageUrls`: up to 4 public image URLs (sketch/photo/prior figure) used as the structural baseline.
- Response `data.url` is the figure; with `output: "svg"` the full SVG source is also in `data.svg`.

Prompting tips: name the parts to draw (names tell the model WHAT to draw, not what to label); for flowcharts/block diagrams, name every node explicitly.

## Convert an existing image

All three endpoints accept either JSON with `imageUrl` (public URL) or `multipart/form-data` with a `file` field (PNG/JPEG/WebP/TIFF, ≤10 MB).

**Vectorize (20 credits)** — raster → SVG / DXF / vector PDF:

```bash
curl -s -X POST https://patentfig.ai/api/v1/vectorize \
  -H "Authorization: Bearer $PATENTFIG_API_KEY" \
  -H "Content-Type: application/json" \
  --max-time 300 \
  -d '{ "imageUrl": "https://example.com/drawing.png", "format": "dxf", "engine": "lineart" }'
```

`engine: "lineart"` (default) redraws as clean single-stroke patent line art — use for CAD/DXF. `engine: "trace"` reproduces the input pixels faithfully, preserving fills — use when output must match the original.

**Enhance (20 credits)** — AI super-resolution: `POST /enhance` with `scale` (2 or 4, controls pixels) and `dpi` (300 or 600, metadata stamp only).

**Convert (20 credits)** — filing-ready raster: `POST /convert` with `format` (`png`/`tiff`/`pdf`) and `dpi` (300 or 600).

Full parameter tables for every endpoint: see [references/endpoints.md](references/endpoints.md). Machine-readable spec: https://patentfig.ai/api/openapi.yaml

## Operational rules

- **Set a client timeout of at least 300 seconds** — generation and vectorization take from ~20s up to a few minutes.
- Credits are charged **only on success**; retrying a failed call never double-bills.
- Rate limit: 60 requests/minute per key. On `429` back off (start at 5s) and retry.
- On `402 INSUFFICIENT_CREDITS`, stop and tell the user to top up at https://patentfig.ai/pricing.
- On `500 GENERATION_FAILED`, one retry is reasonable; persistent failures usually mean the input doesn't suit the pipeline (e.g., a photo sent for line-art vectorization — suggest `POST /figures` with the photo as `referenceImageUrls` instead).
- Before a batch of billable calls, check `GET /credits` and confirm the balance covers it.
