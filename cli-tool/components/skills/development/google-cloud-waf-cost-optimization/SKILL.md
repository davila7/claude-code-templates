---
name: google-cloud-waf-cost-optimization
description: Generates cost optimization guidance for Google Cloud workloads based on the Google Cloud Well-Architected Framework (WAF). Use to evaluate a workload, identify cost requirements and constraints, and provide actionable recommendations for building cost-efficient workloads on Google Cloud.
source: google/skills (Apache 2.0)
---

# Google Cloud Well-Architected Framework skill for the Cost Optimization pillar

## Overview

The Cost Optimization pillar of the Google Cloud Well-Architected Framework
provides a structured approach to optimize the costs of your cloud workloads
while maximizing business value. Cloud costs differ significantly from
on-premises capital expenditure (CapEx) models, requiring a shift to operational
expenditure (OpEx) management and a culture of accountability (FinOps).

## Core principles

The recommendations in the cost optimization pillar of the Well-Architected
Framework are aligned with the following core principles:

-  **Align cloud spending with business value**: Ensure that your cloud
   resources deliver measurable business value by aligning IT spending with
   business objectives. Prioritize investments that directly contribute to
   revenue, customer satisfaction, or operational efficiency. Grounding
   document:
   https://docs.cloud.google.com/architecture/framework/cost-optimization/align-cloud-spending-business-value

-  **Foster a culture of cost awareness**: Ensure that people across your
   organization consider the cost impact of their decisions and activities.
   Provide teams with the visibility and information they need to make informed,
   cost-conscious choices. Grounding document:
   https://docs.cloud.google.com/architecture/framework/cost-optimization/foster-culture-cost-awareness

-  **Optimize resource usage**: Provision only the resources that you need and
   pay only for what you consume. Select the most cost-effective resource types,
   sizes, and locations that meet your technical and business requirements.
   Grounding document:
   https://docs.cloud.google.com/architecture/framework/cost-optimization/optimize-resource-usage

-  **Optimize continuously**: Continuously monitor your cloud resource usage and
   costs, and proactively make adjustments as needed to optimize your spending.
   This iterative approach helps identify and address inefficiencies before they
   become significant. Grounding document:
   https://docs.cloud.google.com/architecture/framework/cost-optimization/optimize-continuously

## Relevant Google Cloud products

The following are _examples_ of Google Cloud products and features that are
relevant to cost optimization:

- **Visibility and monitoring**:

  - **Cloud Billing reports**: Native dashboards for visualizing spending and
    trends.
  - **BigQuery billing export**: Enables granular, custom analysis of billing
    data using SQL and BI tools.
  - **Looker Studio**: Used for creating detailed, shared cost dashboards and
    reports.
  - **Billing alerts and budgets**: Automated notifications when spending
    reaches predefined thresholds.

- **Automation and optimization tools**:

  - **Recommender / Active Assist**: Automatically identifies idle resources,
    rightsizing opportunities, and unused commitments.
  - **Cloud Hub Optimization**: Integrates billing and resource utilization data
    to help developers and application owners quickly identify their most
    expensive, fluctuating, or underutilized cloud resources.
  - **FinOps hub**: Presents active savings and optimization opportunities in
    one dashboard.
  - **Billing quotas**: Limits on resource consumption to prevent unexpected
    cost spikes.

- **Efficient infrastructure**:

  - **Managed services and serverless services**: Services like Cloud Run, Cloud
    Run functions, and GKE Autopilot reduce operational overhead and pay-per-use
    scaling.
  - **Compute Engine**: Use of Spot VMs for fault-tolerant workloads and
    Committed Use Discounts (CUDs) for stable workloads.
  - **Cloud Storage Lifecycle Policies**: Automatically moves data to lower-cost
    storage classes (Nearline, Coldline, Archive) based on age or access.

- **Organization and governance**:

  - **Resource Manager**: Logical structure (Organizations, Folders, Projects)
    for cost attribution.
  - **Labels**: Metadata tags for categorizing and filtering costs by
    environment, team, or application.
  - **Organization Policy Service**: Enforces constraints (e.g., restricted
    regions or machine types) to control costs.

## Workload assessment questions

Ask appropriate questions to understand the cost-related requirements and
constraints of the workload and the user's organization. Choose questions from
the following list:

- How do you incorporate cost considerations into your cloud architecture design
  process?
- How do you foster a culture of cost awareness among your development teams?
- How do you monitor and manage cloud costs across different projects or
  departments?
- What strategies do you use to optimize the cost of your compute resources?
- How do you balance cost optimization with the need for agility and innovation?
- How do you ensure that you are not over-provisioning cloud resources?
- How do you use data and analytics to drive cost optimization decisions?
- How do you optimize costs in different environments (e.g., development,
  testing, production)?
- How do you ensure that your cost optimization efforts are sustainable and
  ongoing?
- How do you measure the success of your cloud cost optimization initiatives?

## Validation checklist

Use the following checklist to evaluate the architecture's alignment with
cost-optimization recommendations:

- **Cost Attribution**: 100% of resources are labeled with key metadata
  (e.g., `env`, `team`, `app`).
- **Granular Visibility**: BigQuery billing export is enabled and used for
  regular cost reviews.
- **Budgets and Alerts**: Every project or business unit has defined budgets
  and active alerts.
- **Rightsizing**: Resources are regularly adjusted based on rightsizing
  suggestions provided by Active Assist Recommender.
- **Commitment Strategy**: Spend is reviewed monthly to optimize Committed
  Use Discount coverage.
- **Idle Resource Management**: Unused disks, IP addresses, and idle VMs are
  identified and removed monthly.
- **Managed Services**: Serverless options are preferred for new workloads
  unless specific technical constraints exist.
- **Storage Tiers**: Lifecycle policies are active for all major storage
  buckets to minimize archival costs.
