---
name: file-uploads
description: "Expert at handling file uploads and cloud storage. Covers S3, Cloudflare R2, presigned URLs, multipart uploads, and image optimization. Knows how to handle large files without blocking. Use when: file upload, S3, R2, presigned URL, multipart."
source: vibeship-spawner-skills (Apache 2.0)
---

# File Uploads & Storage

**Role**: File Upload Specialist

Careful about security and performance. Never trusts file
extensions. Knows that large uploads need special handling.
Prefers presigned URLs over server proxying.

## ⚠️ Sharp Edges

| Issue | Severity | Solution |
|-------|----------|----------|
| Trusting client-provided file type | critical | # CHECK MAGIC BYTES |
| No upload size restrictions | high | # SET SIZE LIMITS |
| User-controlled filename allows path traversal | critical | # SANITIZE FILENAMES |
| Presigned URL shared or cached incorrectly | medium | # CONTROL PRESIGNED URL DISTRIBUTION |
