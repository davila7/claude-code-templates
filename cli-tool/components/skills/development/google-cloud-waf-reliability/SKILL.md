---
name: google-cloud-waf-reliability
description: Generates reliability-focused guidance for Google Cloud workloads based on the Google Cloud Well-Architected Framework. Use to evaluate a workload, identify reliability requirements, and provide actionable recommendations for building resilient, highly available systems.
source: google/skills (Apache 2.0)
---

# Google Cloud Well-Architected Framework skill for the Reliability pillar

## Overview

The Reliability pillar of the Google Cloud Well-Architected Framework provides
principles and recommendations to help you design, deploy, and manage reliable,
resilient, and highly available workloads in Google Cloud. A reliable system
consistently performs its intended functions under defined conditions, is
resilient to failures, and recovers gracefully from disruptions, thereby
minimizing downtime, enhancing user experience, and ensuring data integrity.

## Core principles

The recommendations in the reliability pillar of the Well-Architected Framework
are aligned with the following core principles:

-  **Define reliability based on user-experience goals**: Measurement of
   reliability should reflect the actual experience of the system's users rather
   than merely relying on infrastructure metrics. Focus on outcomes that matter
   most to users. Grounding document:
   https://docs.cloud.google.com/architecture/framework/reliability/define-reliability-based-on-user-experience-goals

-  **Set realistic targets for reliability**: Determine appropriate Service
   Level Objectives (SLOs) that balance the cost and complexity of maximizing
   availability against business requirements. Utilize error budgets to manage
   feature velocity. Grounding document:
   https://docs.cloud.google.com/architecture/framework/reliability/set-targets

-  **Build highly available systems through resource redundancy**: Eliminate
   single points of failure by duplicating critical components across zones and
   regions to maintain operations during localized outages. Grounding document:
   https://docs.cloud.google.com/architecture/framework/reliability/build-highly-available-systems

-  **Take advantage of horizontal scalability**: Design system architectures to
   scale horizontally (adding more instances) to seamlessly accommodate load
   fluctuations and improve overall fault tolerance. Grounding document:
   https://docs.cloud.google.com/architecture/framework/reliability/horizontal-scalability

-  **Detect potential failures by using observability**: Implement thorough
   monitoring, logging, and alerting systems to proactively detect, diagnose,
   and address anomalies before they cause user-facing issues. Grounding
   document:
   https://docs.cloud.google.com/architecture/framework/reliability/observability

-  **Design for graceful degradation**: Architect systems to maintain critical
   functionality, even if at reduced performance or with limited features, when
   dependencies fail or the system experiences extreme stress. Grounding
   document:
   https://docs.cloud.google.com/architecture/framework/reliability/graceful-degradation

-  **Perform testing for recovery from failures**: Build confidence in system
   resilience by continuously simulating failures and verifying the
   effectiveness of automated and manual recovery procedures. Grounding
   document:
   https://docs.cloud.google.com/architecture/framework/reliability/perform-testing-for-recovery-from-failures

-  **Perform testing for recovery from data loss**: Regularly test backup and
   restore protocols to ensure rapid recovery from data corruption or loss,
   remaining within the defined Recovery Time Objective (RTO) and Recovery Point
   Objective (RPO). Grounding document:
   https://docs.cloud.google.com/architecture/framework/reliability/perform-testing-for-recovery-from-data-loss

-  **Conduct thorough postmortems**: Foster a blameless culture by investigating
   outages comprehensively to understand root causes, followed by implementing
   measures that prevent recurrence. Grounding document:
   https://docs.cloud.google.com/architecture/framework/reliability/conduct-postmortems

## Relevant Google Cloud products

The following are _examples_ of Google Cloud products and features that are
relevant to reliability:

- **Compute**: Compute Engine Managed Instance Groups (MIGs), Google Kubernetes
  Engine (GKE), Cloud Run
- **Networking**: Cloud Load Balancing, Cloud CDN, Cloud DNS
- **Storage and databases**: Cloud Storage (multi-region), Cloud SQL High
  Availability, Spanner, Filestore, Firestore
- **Operations**: Cloud Monitoring, Cloud Logging, Google Cloud Managed Service
  for Prometheus
- **Disaster recovery**: Backup and DR Service, Filestore backups

## Workload assessment questions

Ask appropriate questions to understand the reliability-related requirements and
constraints of the workload and the user's organization. Choose questions from
the following list:

- How does your organization define and measure the reliability of your systems
  in relation to user experience?
- How does your organization approach setting reliability targets for your
  services?
- What is your organization's strategy for ensuring high availability through
  resource redundancy?
- How does your organization leverage horizontal scalability to maintain
  performance and reliability?
- How does your organization utilize observability (metrics, logs, traces) to
  gain insights and detect potential failures?
- How does your organization manage alerting based on observability data to
  ensure timely responses to significant issues without causing alert fatigue?
- What measures does your organization take to ensure systems can gracefully
  degrade during high load or partial failures?
- How frequently and comprehensively does your organization test for recovery
  from system failures (e.g., regional failovers, release rollbacks)?
- What is your organization's approach to testing for recovery from data loss?
- How does your organization conduct and utilize postmortems after incidents?

## Validation checklist

Use the following checklist to evaluate the architecture's alignment with
reliability recommendations:

- User-focused SLIs and SLOs are explicitly defined and actively monitored.
- The architecture avoids single points of failure through cross-zone or
  cross-region redundancy.
- Autoscaling is enabled to handle variable demand without manual intervention.
- Application and infrastructure health checks are configured to trigger
  automated failovers.
- Regular backup schedules are in place, and restoration processes are routinely
  tested.
- The system architecture incorporates patterns like circuit breakers, retries
  with exponential backoff, and rate limiting to support graceful degradation.
- Game days or chaos engineering practices are regularly held to validate
  failure recovery.
- A formalized, blameless postmortem process exists to ensure organizational
  learning from operational incidents.
