# PatentFig AI API — Endpoint Reference

Base URL: `https://patentfig.ai/api/v1` · Auth: `Authorization: Bearer $PATENTFIG_API_KEY` (or `x-api-key` header) · OpenAPI: https://patentfig.ai/api/openapi.yaml

Error envelope (all endpoints):

| HTTP | Code | Meaning | Retry? |
| --- | --- | --- | --- |
| 400 | `INVALID_INPUT` | Bad/missing parameter (message names the field) | No — fix request |
| 401 | `UNAUTHORIZED` | Missing/invalid/revoked key | No — check key |
| 402 | `INSUFFICIENT_CREDITS` | Balance too low | After top-up |
| 422 | `FETCH_FAILED` | `imageUrl` unreachable | Check URL is public |
| 429 | `RATE_LIMITED` | >60 req/min on this key | Yes — back off |
| 500 | `GENERATION_FAILED` | Model/processing failure | One retry |

## POST /figures — 10 credits

Generate a patent figure from a prompt. JSON body only.

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `prompt` | string ≤10000 | yes | — | What to draw; view/diagram type controlled via prompt |
| `output` | `"png"` \| `"svg"` | no | `"png"` | `svg` = stroke-based line art, `fill="none"` |
| `labeled` | boolean | no | `false` | Numeric reference callouts (100, 102, …) |
| `referenceImageUrls` | string[] ≤4 | no | `[]` | Public URLs; SVG references are rasterized automatically |

Response `data`: `url` (file URL), `format`, `svg` (source, only when `output: "svg"`), `creditsConsumed`.

## POST /vectorize — 20 credits

Raster image → vector file. JSON `imageUrl` or multipart `file`.

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `imageUrl` / `file` | string / file | yes | — | PNG/JPEG/WebP/TIFF, ≤10 MB |
| `format` | `"svg"` \| `"dxf"` \| `"pdf"` | no | `"svg"` | PDF embeds the SVG for extraction |
| `engine` | `"lineart"` \| `"trace"` | no | `"lineart"` | lineart = single-stroke redraw (CAD-safe); trace = faithful, filled outlines (double lines in DXF) |

Response `data`: `url`, `format`, `engine`, `creditsConsumed`.

## POST /enhance — 20 credits

AI super-resolution upscaling. Output is always PNG.

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `imageUrl` / `file` | string / file | yes | — | |
| `scale` | `2` \| `4` | no | `2` | Output pixels = input × scale |
| `dpi` | `300` \| `600` | no | `300` | Density metadata stamp only — does not change pixels |

Response `data`: `url`, `scale`, `dpi`, `width`, `height`, `creditsConsumed`.

## POST /convert — 20 credits

Filing-ready raster export.

| Field | Type | Required | Default | Notes |
| --- | --- | --- | --- | --- |
| `imageUrl` / `file` | string / file | yes | — | |
| `format` | `"png"` \| `"tiff"` \| `"pdf"` | no | `"png"` | TIFF is flattened, LZW-compressed |
| `dpi` | `300` \| `600` | no | `300` | 300 targets ~2K resolution, 600 targets ~4K; small inputs are AI-upscaled |

Response `data`: `url`, `previewUrl` (PNG preview, for TIFF/PDF), `format`, `dpi`, `creditsConsumed`.

## GET /credits — free

Returns `data.balance` (integer). Use as connectivity check and before batches.

## Multipart example

```bash
curl -s -X POST https://patentfig.ai/api/v1/enhance \
  -H "Authorization: Bearer $PATENTFIG_API_KEY" \
  --max-time 300 \
  -F "file=@drawing.png" -F "scale=4" -F "dpi=600"
```
