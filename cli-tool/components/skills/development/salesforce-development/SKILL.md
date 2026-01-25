---
name: salesforce-development
description: "Expert patterns for Salesforce platform development including Lightning Web Components (LWC), Apex triggers and classes, REST/Bulk APIs, Connected Apps, and Salesforce DX with scratch orgs and 2nd generation packages (2GP). Use when: salesforce, sfdc, apex, lwc, lightning web components."
source: vibeship-spawner-skills (Apache 2.0)
---

# Salesforce Development

## Patterns

### Lightning Web Component with Wire Service

Use @wire decorator for reactive data binding with Lightning Data Service
or Apex methods. @wire fits LWC's reactive architecture and enables
Salesforce performance optimizations.


### Bulkified Apex Trigger with Handler Pattern

Apex triggers must be bulkified to handle 200+ records per transaction.
Use handler pattern for separation of concerns, testability, and
recursion prevention.


### Queueable Apex for Async Processing

Use Queueable Apex for async processing with support for non-primitive
types, monitoring via AsyncApexJob, and job chaining. Limit: 50 jobs
per transaction, 1 child job when chaining.


## Anti-Patterns

### ❌ SOQL Inside Loops

### ❌ DML Inside Loops

### ❌ Hardcoding IDs

## ⚠️ Sharp Edges

| Issue | Severity | Solution |
|-------|----------|----------|
| Issue | critical | See docs |
| Issue | high | See docs |
| Issue | medium | See docs |
| Issue | high | See docs |
| Issue | critical | See docs |
| Issue | high | See docs |
| Issue | high | See docs |
| Issue | critical | See docs |
