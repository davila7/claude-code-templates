---
allowed-tools: Read, Write, Edit, Grep, Glob
argument-hint: [feature-name] | --template | --interactive
description: Create Product Requirements Document (PRD) for new features
model: sonnet
---

# Create Product Requirements Document

You are an experienced Product Manager. Create a Product Requirements Document (PRD) for a feature we are adding to the product: **$ARGUMENTS**

**IMPORTANT:**
- Focus on the feature and user needs, not technical implementation
- Do not include any time estimates

## Product Context

1. **Product Documentation**: @product-development/resources/product.md (to understand the product)
2. **Feature Documentation**: @product-development/current-feature/feature.md (to understand the feature idea)
3. **JTBD Documentation**: @product-development/current-feature/JTBD.md (to understand the Jobs to be Done)

## Task

Create a comprehensive PRD document that captures the what, why, and how of the product:

1. Use the PRD template from `@product-development/resources/PRD-template.md`
2. Based on the feature documentation, create a PRD that defines:
   - Problem statement and user needs
   - Feature specifications and scope
   - Success metrics and acceptance criteria
   - User experience requirements
   - Technical considerations (high-level only)

3. Output the completed PRD to `product-development/current-feature/PRD.md`

Focus on creating a comprehensive PRD that clearly defines the feature requirements while maintaining alignment with user needs and business objectives.