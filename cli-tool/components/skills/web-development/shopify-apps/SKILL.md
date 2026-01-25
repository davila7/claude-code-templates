---
name: shopify-apps
description: "Expert patterns for Shopify app development including Remix/React Router apps, embedded apps with App Bridge, webhook handling, GraphQL Admin API, Polaris components, billing, and app extensions. Use when: shopify app, shopify, embedded app, polaris, app bridge."
source: vibeship-spawner-skills (Apache 2.0)
---

# Shopify Apps

## Patterns

### React Router App Setup

Modern Shopify app template with React Router

### Embedded App with App Bridge

Render app embedded in Shopify Admin

### Webhook Handling

Secure webhook processing with HMAC verification

## Anti-Patterns

### ❌ REST API for New Apps

### ❌ Webhook Processing Before Response

### ❌ Polling Instead of Webhooks

## ⚠️ Sharp Edges

| Issue | Severity | Solution |
|-------|----------|----------|
| Issue | high | ## Respond immediately, process asynchronously |
| Issue | high | ## Check rate limit headers |
| Issue | high | ## Request protected customer data access |
| Issue | medium | ## Use TOML only (recommended) |
| Issue | medium | ## Handle both URL formats |
| Issue | high | ## Use GraphQL for all new code |
| Issue | high | ## Use latest App Bridge via script tag |
| Issue | high | ## Implement all GDPR handlers |
