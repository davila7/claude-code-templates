---
name: it-operations
description: Manages IT infrastructure, monitoring, incident response, and service reliability. Provides frameworks for ITIL service management, observability strategies, automation, backup/recovery, capacity planning, and operational excellence practices.
---

# IT Operations Expert

A comprehensive skill for managing IT infrastructure operations, ensuring service reliability, implementing monitoring and alerting strategies, managing incidents, and maintaining operational excellence through automation and best practices.

## Core Principles

### 1. Service Reliability First
- **Proactive Monitoring**: Implement comprehensive observability before incidents occur
- **Incident Management**: Structured response processes with clear escalation paths
- **SLA/SLO Management**: Define and maintain service level objectives aligned with business needs
- **Continuous Improvement**: Learn from incidents through blameless post-mortems

### 2. Automation Over Manual Processes
- **Infrastructure as Code**: Manage infrastructure configuration through version-controlled code
- **Runbook Automation**: Convert manual procedures into automated workflows
- **Self-Healing Systems**: Implement automated remediation for common issues
- **Configuration Management**: Maintain consistency across environments

### 3. ITIL Service Management
- **Service Strategy**: Align IT services with business objectives
- **Service Design**: Design resilient, scalable services
- **Service Transition**: Manage changes with minimal disruption
- **Service Operation**: Deliver and support services effectively
- **Continual Service Improvement**: Iteratively enhance service quality

### 4. Operational Excellence
- **Documentation**: Maintain current runbooks, procedures, and architecture diagrams
- **Knowledge Management**: Build searchable knowledge bases from incident resolutions
- **Capacity Planning**: Forecast and provision resources proactively
- **Cost Optimization**: Balance performance requirements with infrastructure costs

## Core Workflow

### Infrastructure Operations Workflow

```
1. MONITORING & OBSERVABILITY
   ├─ Define SLIs/SLOs/SLAs for critical services
   ├─ Implement metrics collection (infrastructure, application, business)
   ├─ Configure alerting with proper thresholds and escalation
   ├─ Build dashboards for different audiences (ops, devs, executives)
   └─ Establish on-call rotation and escalation procedures

2. INCIDENT MANAGEMENT
   ├─ Receive alert or user report
   ├─ Assess severity and impact (P1/P2/P3/P4)
   ├─ Engage appropriate responders
   ├─ Investigate and diagnose root cause
   ├─ Implement fix or workaround
   ├─ Communicate status to stakeholders
   ├─ Document resolution in knowledge base
   └─ Conduct post-incident review

3. CHANGE MANAGEMENT
   ├─ Submit change request with impact assessment
   ├─ Review and approve through CAB (Change Advisory Board)
   ├─ Schedule change window
   ├─ Execute change with rollback plan ready
   ├─ Validate success criteria
   ├─ Document actual vs planned results
   └─ Close change ticket

4. CAPACITY PLANNING
   ├─ Collect resource utilization trends
   ├─ Analyze growth patterns
   ├─ Forecast future requirements
   ├─ Plan procurement or provisioning
   ├─ Execute capacity additions
   └─ Monitor effectiveness

5. AUTOMATION & OPTIMIZATION
   ├─ Identify repetitive manual tasks
   ├─ Document current process
   ├─ Design automated solution
   ├─ Implement and test automation
   ├─ Deploy to production
   ├─ Measure time/cost savings
   └─ Iterate and improve
```

## Decision Frameworks

### Alert Configuration Decision Matrix

| Scenario | Alert Type | Threshold | Response Time | Escalation |
|----------|-----------|-----------|---------------|------------|
| Service completely down | Page | Immediate | < 5 min | Immediate to on-call |
| Service degraded | Page | 2-3 failures | < 15 min | After 15 min to on-call |
| High resource usage | Warning | > 80% sustained | < 1 hour | After 2 hours to team lead |
| Approaching capacity | Info | > 70% trend | < 24 hours | Weekly capacity review |
| Configuration drift | Ticket | Any deviation | < 7 days | Monthly review |

### Incident Severity Classification

**Priority 1 (Critical)**
- Complete service outage affecting all users
- Data loss or security breach
- Financial impact > $10K/hour
- Response: Immediate, 24/7, all hands on deck

**Priority 2 (High)**
- Partial service outage affecting many users
- Significant performance degradation
- Financial impact $1K-$10K/hour
- Response: < 30 minutes during business hours

**Priority 3 (Medium)**
- Service degradation affecting some users
- Non-critical functionality impaired
- Workaround available
- Response: < 4 hours during business hours

**Priority 4 (Low)**
- Minor issues with minimal impact
- Cosmetic problems
- Enhancement requests
- Response: Next business day

### Change Management Risk Assessment

```
Risk Level = Impact × Likelihood × Complexity

Impact (1-5):
1 = Single user
2 = Team
3 = Department
4 = Company-wide
5 = Customer-facing

Likelihood of Issues (1-5):
1 = Routine, tested
2 = Familiar, documented
3 = Some uncertainty
4 = New territory
5 = Never done before

Complexity (1-5):
1 = Single component
2 = Few components
3 = Multiple systems
4 = Cross-platform
5 = Enterprise-wide

Risk Score Interpretation:
1-20: Standard change (pre-approved)
21-50: Normal change (CAB review)
51-75: High-risk change (extensive testing, senior approval)
76-125: Emergency change only (executive approval)
```

### Monitoring Tool Selection

| Requirement | Prometheus + Grafana | Datadog | New Relic | ELK Stack | Splunk |
|-------------|---------------------|---------|-----------|-----------|---------|
| Cost | Free (self-hosted) | $$$$ | $$$$ | Free-$$ | $$$$$ |
| Metrics | Excellent | Excellent | Excellent | Good | Good |
| Logs | Via Loki | Excellent | Excellent | Excellent | Excellent |
| Traces | Via Tempo | Excellent | Excellent | Limited | Good |
| Learning Curve | Steep | Moderate | Moderate | Steep | Steep |
| Cloud-Native | Excellent | Excellent | Excellent | Good | Good |
| On-Premises | Excellent | Good | Good | Excellent | Excellent |
| APM | Via exporters | Excellent | Excellent | Limited | Good |

## Common Operational Challenges

### Challenge 1: Alert Fatigue
**Problem**: Too many false positive alerts causing team burnout

**Solution**:
```yaml
Alert Tuning Process:
1. Measure baseline alert volume and false positive rate
2. Categorize alerts by actionability:
   - Actionable + Urgent = Keep as page
   - Actionable + Not Urgent = Ticket
   - Not Actionable = Remove or convert to dashboard metric
3. Implement alert aggregation (group similar alerts)
4. Add context to alerts (runbook links, relevant metrics)
5. Regular review meetings (weekly) to tune thresholds
6. Track metrics:
   - MTTA (Mean Time to Acknowledge): < 5 min target
   - False Positive Rate: < 20% target
   - Alert Volume per Week: Trending down
```

### Challenge 2: Incident Documentation During Crisis
**Problem**: Teams skip documentation during high-pressure incidents

**Solution**:
- Assign dedicated scribe role (not the incident commander)
- Use incident management tools (PagerDuty, Opsgenie) with automatic timeline
- Template-based incident reports with required fields
- Post-incident review scheduled automatically (within 48 hours)
- Gamify documentation (track and recognize thorough documentation)

### Challenge 3: Knowledge Silos
**Problem**: Critical knowledge trapped in individual team members' heads

**Solution**:
```yaml
Knowledge Transfer Strategy:
- Pair Programming/Shadowing: 20% of sprint capacity
- Runbook Requirements: Every system must have runbook
- Lunch & Learn Sessions: Weekly 30-min knowledge sharing
- Cross-Training Matrix: Track who knows what, identify gaps
- On-Call Rotation: Everyone rotates to spread knowledge
- Post-Incident Reviews: Mandatory team sharing
- Documentation Sprints: Quarterly focus on doc completion
```

### Challenge 4: Balancing Stability vs Innovation
**Problem**: Operations team resists change to maintain stability

**Solution**:
- Implement change windows (planned maintenance periods)
- Use blue-green or canary deployments for lower risk
- Establish "innovation time" (Google 20% time model)
- Create sandbox environments for experimentation
- Measure and reward both stability AND improvement metrics
- Include "toil reduction" as OKR target

## Key Metrics & KPIs

### Service Reliability Metrics
```yaml
Availability:
  Formula: (Total Time - Downtime) / Total Time × 100
  Target: 99.9% (43.8 min/month downtime)
  Measurement: Per service, monthly

MTTR (Mean Time to Recovery):
  Formula: Sum of recovery times / Number of incidents
  Target: < 30 minutes for P1, < 4 hours for P2
  Measurement: Per severity level, monthly

MTBF (Mean Time Between Failures):
  Formula: Total operational time / Number of failures
  Target: > 720 hours (30 days)
  Measurement: Per service, quarterly

MTTA (Mean Time to Acknowledge):
  Formula: Sum of acknowledgment times / Number of alerts
  Target: < 5 minutes for pages
  Measurement: Per on-call engineer, weekly

Change Success Rate:
  Formula: Successful changes / Total changes × 100
  Target: > 95%
  Measurement: Monthly

Incident Recurrence Rate:
  Formula: Repeat incidents / Total incidents × 100
  Target: < 10%
  Measurement: Quarterly (same root cause within 90 days)
```

### Operational Efficiency Metrics
```yaml
Toil Percentage:
  Definition: Time spent on manual, repetitive tasks
  Target: < 30% of team capacity
  Measurement: Weekly time tracking

Automation Coverage:
  Formula: Automated tasks / Total repetitive tasks × 100
  Target: > 70%
  Measurement: Quarterly audit

On-Call Load:
  Formula: Alerts per on-call shift
  Target: < 5 actionable alerts per shift
  Measurement: Per engineer, weekly

Runbook Coverage:
  Formula: Services with runbooks / Total services × 100
  Target: 100%
  Measurement: Monthly audit

Knowledge Base Utilization:
  Formula: Incidents resolved via KB / Total incidents × 100
  Target: > 40%
  Measurement: Monthly
```

## Integration Points

### With Development Teams
- Participate in design reviews for operational requirements
- Provide deployment automation and CI/CD pipeline support
- Share monitoring and logging requirements
- Collaborate on incident response and post-mortems
- Joint ownership of SLOs and error budgets

### With Security Teams
- Implement security monitoring and alerting
- Manage access controls and authentication systems
- Coordinate vulnerability patching and remediation
- Conduct security incident response
- Maintain compliance with security policies

### With Business Stakeholders
- Report on service availability and performance
- Communicate planned maintenance windows
- Provide capacity planning forecasts
- Translate technical metrics to business impact
- Participate in business continuity planning

## Best Practices

### 1. Blameless Post-Mortems
```markdown
Post-Incident Review Template:
- Incident Summary (what happened, when, impact)
- Timeline of Events (detailed chronology)
- Root Cause Analysis (5 Whys or Fishbone)
- What Went Well (strengths during response)
- What Could Be Improved (opportunities)
- Action Items (with owners and due dates)
- Lessons Learned (shareable insights)

Rules:
- No blame or punishment
- Focus on systems and processes, not people
- Everyone can speak freely
- Action items must be tracked to completion
```

### 2. Runbook Standards
```yaml
Runbook Contents:
  - Service Overview: Purpose, dependencies, architecture
  - SLIs/SLOs/SLAs: Defined thresholds and targets
  - Common Issues: Symptoms, causes, solutions
  - Troubleshooting Steps: Step-by-step procedures
  - Escalation Paths: Who to contact and when
  - Useful Commands: Copy-paste ready commands
  - Dashboard Links: Direct links to relevant dashboards
  - Recent Changes: Link to change log
  - Contact Information: Team, product owner, SMEs

Maintenance:
  - Review quarterly or after major incidents
  - Test procedures during low-traffic periods
  - Update after every significant change
  - Track usage metrics (page views, helpfulness ratings)
```

### 3. On-Call Best Practices
```yaml
On-Call Preparation:
  - Laptop with VPN access
  - Mobile device with notification apps
  - Contact list (escalation paths)
  - Access to all critical systems
  - Runbooks bookmarked
  - Backup on-call identified

During On-Call:
  - Acknowledge alerts within 5 minutes
  - Update incident status regularly
  - Follow escalation procedures
  - Document all actions in incident ticket
  - Handoff clearly to next on-call

Post On-Call:
  - Complete incident reports
  - Submit toil reduction tickets
  - Provide feedback on runbooks
  - Update on-call documentation
```

### 4. Change Management Discipline
```yaml
Standard Change Process:
  1. Create change request (RFC)
  2. Document:
     - What: Specific changes being made
     - Why: Business justification
     - When: Proposed date/time
     - Who: Change implementer and approver
     - How: Step-by-step procedure
     - Risk: Assessment and mitigation
     - Rollback: Detailed rollback plan
     - Testing: Validation steps
  3. Submit for CAB review (7 days advance notice)
  4. Implement during approved window
  5. Validate success criteria
  6. Close change with actual results
  7. Post-implementation review if issues occurred

Emergency Change Process:
  - Executive approval required
  - Implement with heightened monitoring
  - Full team notification
  - Complete documentation within 24 hours
  - Mandatory post-change review
```

## Reference Files

For detailed technical guidance, see:
- [reference/monitoring.md](reference/monitoring.md) - Observability, metrics, alerting, and dashboard design
- [reference/incident-management.md](reference/incident-management.md) - Incident response, root cause analysis, post-mortems
- [reference/infrastructure.md](reference/infrastructure.md) - Server management, network operations, capacity planning
- [reference/automation.md](reference/automation.md) - Scripting, configuration management, orchestration tools
- [reference/backup-recovery.md](reference/backup-recovery.md) - Backup strategies, disaster recovery, business continuity

## Getting Started

1. **For New Infrastructure**: Start with [reference/infrastructure.md](reference/infrastructure.md) for setup guidance
2. **For Monitoring Setup**: Review [reference/monitoring.md](reference/monitoring.md) for observability strategy
3. **For Incident Response**: See [reference/incident-management.md](reference/incident-management.md) for procedures
4. **For Automation Projects**: Check [reference/automation.md](reference/automation.md) for tooling recommendations
5. **For DR Planning**: Consult [reference/backup-recovery.md](reference/backup-recovery.md) for recovery strategies
