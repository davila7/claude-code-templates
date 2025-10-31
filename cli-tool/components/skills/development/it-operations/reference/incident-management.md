# Incident Management

Comprehensive guide to incident response, root cause analysis, post-mortems, and building resilient incident management processes.

## Table of Contents
- [Incident Lifecycle](#incident-lifecycle)
- [Severity Classification](#severity-classification)
- [Incident Response Roles](#incident-response-roles)
- [Communication Protocols](#communication-protocols)
- [Root Cause Analysis](#root-cause-analysis)
- [Post-Incident Reviews](#post-incident-reviews)
- [On-Call Management](#on-call-management)
- [Incident Management Tools](#incident-management-tools)
- [Runbook Development](#runbook-development)
- [Metrics and Improvement](#metrics-and-improvement)

## Incident Lifecycle

### Incident States

```
DETECTED → ACKNOWLEDGED → INVESTIGATING → IDENTIFIED → RESOLVING → RESOLVED → CLOSED

Detection:
  - Automated alert fired
  - User report received
  - Proactive monitoring identified anomaly

Acknowledgment:
  - On-call engineer confirms receipt
  - Target: < 5 minutes for P1

Investigation:
  - Gather symptoms and evidence
  - Check recent changes
  - Review logs and metrics
  - Identify affected components

Identification:
  - Root cause hypothesis formed
  - Scope of impact determined
  - Fix or workaround identified

Resolution:
  - Implement fix or workaround
  - Validate service restoration
  - Monitor for recurrence

Closure:
  - Confirm no further impact
  - Document resolution
  - Schedule post-incident review
```

### Incident Response Workflow

```yaml
Phase 1: Detection & Triage (0-5 minutes)
  Actions:
    - Alert fires or user reports issue
    - On-call acknowledges within 5 minutes
    - Initial severity assessment
    - Create incident ticket
    - Page additional responders if needed

  Key Questions:
    - What is the user-facing impact?
    - How many users/customers affected?
    - Is data at risk?
    - Is this getting worse?

Phase 2: Investigation (5-30 minutes)
  Actions:
    - Join incident war room (Slack/Zoom)
    - Assign Incident Commander role
    - Review recent changes (deployments, configs)
    - Check monitoring dashboards
    - Query logs for errors
    - Trace affected requests
    - Form initial hypothesis

  Key Questions:
    - What changed recently?
    - What do logs show?
    - Are dependencies healthy?
    - Can we reproduce the issue?

Phase 3: Mitigation (30-60 minutes)
  Actions:
    - Implement fix or workaround
    - Roll back recent changes if needed
    - Scale resources if capacity issue
    - Enable feature flags to disable problematic code
    - Communicate status to stakeholders

  Decision Framework:
    - Fast workaround vs proper fix
    - Rollback vs roll forward
    - Partial restoration vs full fix

Phase 4: Recovery (60+ minutes)
  Actions:
    - Validate service metrics returned to normal
    - Confirm user-facing functionality restored
    - Monitor for recurrence (30-60 min)
    - Gradual rollback of workarounds if applied
    - Clear alerts

  Success Criteria:
    - Error rate < threshold
    - Latency within SLO
    - No new related alerts
    - User reports stopped

Phase 5: Post-Incident (24-72 hours)
  Actions:
    - Schedule post-incident review within 48 hours
    - Complete incident report
    - Create follow-up tickets for fixes
    - Update runbooks
    - Share learnings with team
```

## Severity Classification

### Priority Definitions

```yaml
Priority 1 (Critical):
  Description: Complete service outage or critical functionality unavailable
  User Impact: All or most users cannot use the service
  Business Impact: Revenue loss > $10K/hour, major SLA breach
  Data Risk: Active data loss or corruption

  Response:
    - Acknowledge: < 5 minutes
    - Initial Response: Immediate (24/7)
    - Communication: Every 30 minutes
    - Escalation: Immediate to leadership
    - All hands on deck: Yes

  Examples:
    - Website completely down (503 errors)
    - Database unavailable
    - Payment processing offline
    - Security breach in progress
    - Data corruption affecting production

Priority 2 (High):
  Description: Major functionality degraded or affecting many users
  User Impact: Significant portion of users impacted
  Business Impact: Revenue loss $1K-$10K/hour, SLA at risk
  Data Risk: Potential data issues if not resolved

  Response:
    - Acknowledge: < 15 minutes
    - Initial Response: < 30 minutes (during business hours)
    - Communication: Every 1-2 hours
    - Escalation: After 1 hour to team lead
    - All hands: If not resolved in 2 hours

  Examples:
    - Critical API endpoint timing out frequently
    - Significant performance degradation (5x normal latency)
    - Key feature unavailable (e.g., checkout flow broken)
    - Elevated error rates (> 5%)

Priority 3 (Medium):
  Description: Partial degradation or minor functionality impaired
  User Impact: Some users affected, workaround available
  Business Impact: Minimal revenue impact
  Data Risk: No data at risk

  Response:
    - Acknowledge: < 4 hours (business hours)
    - Initial Response: Same business day
    - Communication: Daily updates
    - Escalation: If not resolved in 1 business day
    - All hands: No

  Examples:
    - Non-critical feature broken
    - Performance degradation in secondary service
    - Intermittent errors affecting < 1% of requests
    - UI display issues

Priority 4 (Low):
  Description: Minor issues, cosmetic problems, or enhancement requests
  User Impact: Minimal or no user impact
  Business Impact: No business impact
  Data Risk: None

  Response:
    - Acknowledge: < 1 business day
    - Initial Response: Next sprint/cycle
    - Communication: Via regular channels
    - Escalation: No escalation needed
    - All hands: No

  Examples:
    - Typo in UI
    - Logging issues
    - Minor visual inconsistencies
    - Feature enhancement requests
```

### Severity Decision Tree

```
Start: Issue Detected
         |
         v
[Is service completely down?] → YES → P1
         |
         NO
         v
[Are multiple users unable to complete critical tasks?] → YES → P2
         |
         NO
         v
[Is there a workaround available?] → NO → P2
         |
         YES
         v
[Does it affect revenue or security?] → YES → P2
         |
         NO
         v
[Are only a few users affected?] → YES → P3
         |
         NO
         v
[Is it a cosmetic or minor issue?] → YES → P4
```

## Incident Response Roles

### Role Definitions

```yaml
Incident Commander (IC):
  Responsibilities:
    - Overall incident leadership
    - Coordinate all responders
    - Make key decisions (rollback, escalate, etc.)
    - Own communication to stakeholders
    - Ensure post-incident review happens

  Skills Required:
    - Calm under pressure
    - Strong communication
    - Technical breadth (not necessarily depth)
    - Decision-making ability

  Actions:
    - Declare severity and activate response
    - Delegate tasks to responders
    - Maintain incident timeline
    - Communicate status updates
    - Call for additional resources
    - Declare incident resolved

  Rotation: Senior engineers, on-call leads

Technical Lead (TL):
  Responsibilities:
    - Lead technical investigation
    - Propose fixes or workarounds
    - Coordinate debugging efforts
    - Make technical decisions

  Skills Required:
    - Deep technical knowledge of systems
    - Debugging expertise
    - System architecture understanding

  Actions:
    - Analyze logs, metrics, traces
    - Reproduce issues
    - Test hypotheses
    - Implement fixes
    - Validate resolution

  Rotation: Subject matter experts, senior engineers

Communications Lead (Comms):
  Responsibilities:
    - Internal stakeholder updates
    - External customer communication
    - Status page updates
    - Executive briefings

  Skills Required:
    - Clear written communication
    - Ability to translate technical to business impact
    - Stakeholder management

  Actions:
    - Post updates to status page
    - Send email updates to customers
    - Update internal stakeholders
    - Prepare executive summary
    - Manage support ticket responses

  Rotation: Product managers, customer success, tech leads

Scribe:
  Responsibilities:
    - Document all actions taken
    - Maintain incident timeline
    - Record decisions and rationale
    - Note important findings

  Skills Required:
    - Attention to detail
    - Fast typing
    - Ability to summarize technical discussions

  Actions:
    - Log every action in incident ticket
    - Timestamp all events
    - Record chat/call highlights
    - Capture relevant screenshots
    - Document who did what when

  Rotation: Junior engineers, on-call secondary

Subject Matter Expert (SME):
  Responsibilities:
    - Provide specialized knowledge
    - Answer specific technical questions
    - Assist with debugging

  Skills Required:
    - Deep expertise in specific system/component

  Actions:
    - Answer questions about their system
    - Review code/configs
    - Provide context on recent changes
    - Suggest diagnostic steps

  Rotation: Engineers owning specific services
```

### Role Assignment

```yaml
P1 Incident:
  Roles Required:
    - Incident Commander (required)
    - Technical Lead (required)
    - Scribe (required)
    - Communications Lead (required)
    - SMEs (2-3, as needed)

  Activation:
    - IC self-designates or is assigned by on-call manager
    - IC assigns other roles explicitly
    - Clear handoff if roles change

P2 Incident:
  Roles Required:
    - Incident Commander (required)
    - Technical Lead (same person as IC okay)
    - Scribe (optional but recommended)
    - SMEs (1-2, as needed)

  Activation:
    - On-call assumes IC role
    - Pulls in SMEs as needed

P3/P4 Incident:
  Roles Required:
    - Single responder handles all roles

  Activation:
    - Assigned to team member
    - No formal structure needed
```

## Communication Protocols

### Communication Channels

```yaml
War Room (Slack Channel):
  Purpose: Real-time coordination during active incident
  Naming: #incident-YYYY-MM-DD-description
  Participants: All responders
  Content:
    - Findings and hypotheses
    - Actions being taken
    - Requests for help
    - Decisions made
  Rules:
    - Stay on topic (incident only)
    - Use threads for side discussions
    - No blame or speculation about causes

  Example:
    #incident-2025-01-15-api-outage

Status Page (External):
  Purpose: Customer-facing incident communication
  URL: status.company.com
  Update Frequency:
    - P1: Every 15-30 minutes
    - P2: Every 1-2 hours
    - P3: Daily
  Content Template:
    - What is affected
    - Current status
    - Estimated resolution time (if known)
    - Workarounds (if available)
    - Next update time

Internal Stakeholder Updates:
  Purpose: Keep leadership and affected teams informed
  Channels:
    - Email to stakeholders@company.com
    - Slack to #incidents
    - Direct message to executives (P1 only)
  Update Frequency:
    - P1: Every 30 minutes
    - P2: Every 2 hours
    - P3: End of day
  Content Template:
    - Impact summary (users affected, revenue impact)
    - Current status
    - Actions being taken
    - Estimated resolution

Customer Support:
  Purpose: Equip support team to handle customer inquiries
  Channels:
    - Update internal wiki/knowledge base
    - Post in #support channel
    - Provide canned responses
  Update Frequency:
    - Immediately when incident declared
    - When status changes
    - When resolved
```

### Communication Templates

```markdown
# Initial Incident Notification (Internal)

Subject: [P1] API Service Outage - Investigating

SEVERITY: Priority 1 (Critical)
STATUS: Investigating
IMPACT: All API requests failing with 503 errors, affecting 100% of users
STARTED: 2025-01-15 14:32 UTC
INCIDENT COMMANDER: Jane Doe

CURRENT SITUATION:
- API gateway returning 503 errors
- All downstream services appear healthy
- Investigating gateway configuration

ACTIONS TAKEN:
- Incident declared at 14:35 UTC
- War room established: #incident-2025-01-15-api-outage
- Team paged and responding

NEXT STEPS:
- Reviewing recent deployments
- Checking gateway logs
- Preparing rollback plan

NEXT UPDATE: 15:00 UTC (in 30 minutes)

---

# Status Update (Internal)

Subject: [P1] API Service Outage - Root Cause Identified

SEVERITY: Priority 1 (Critical)
STATUS: Identified → Resolving
IMPACT: All API requests failing, affecting 100% of users
DURATION: 25 minutes
INCIDENT COMMANDER: Jane Doe

ROOT CAUSE:
- Deployment at 14:28 UTC introduced configuration error
- API gateway max connections set to 10 (should be 10000)

ACTIONS TAKEN:
- Root cause identified via gateway logs
- Rollback initiated at 14:52 UTC
- Rollback completed at 14:55 UTC
- Service returning to normal

CURRENT STATUS:
- Error rate dropping from 100% to 5%
- Monitoring for full recovery
- ETA to full resolution: 15:05 UTC

NEXT UPDATE: 15:10 UTC

---

# Resolution Notification (Internal)

Subject: [P1] API Service Outage - RESOLVED

SEVERITY: Priority 1 (Critical) → RESOLVED
STATUS: Resolved
IMPACT: All API requests were failing for 28 minutes
DURATION: 28 minutes (14:32 - 15:00 UTC)
INCIDENT COMMANDER: Jane Doe

RESOLUTION:
- Service fully restored at 15:00 UTC
- Root cause: Configuration error in deployment
- Fix: Rolled back to previous version

IMPACT SUMMARY:
- Duration: 28 minutes
- Users Affected: ~50,000 (100% of active users)
- Failed Requests: ~2.1 million
- Revenue Impact: ~$4,700 (estimated)

FOLLOW-UP ACTIONS:
- Post-incident review scheduled: 2025-01-16 10:00 UTC
- Ticket created to add validation to deployment pipeline
- Runbook updated with troubleshooting steps

Thank you to all responders: Jane Doe, John Smith, Alice Johnson

---

# Customer Status Page Update

Title: API Service Disruption

[Resolved] - Jan 15, 15:00 UTC
We have resolved the issue affecting API requests. All services are now operating normally. We apologize for the disruption and are conducting a thorough review to prevent similar issues.

[Update] - Jan 15, 14:55 UTC
We have identified the root cause and implemented a fix. Service is returning to normal. We expect full resolution within 5 minutes.

[Investigating] - Jan 15, 14:35 UTC
We are currently investigating an issue affecting API requests. Users may experience errors when accessing our service. Our team is actively working on a resolution. We will provide an update in 30 minutes.

WORKAROUND: None available at this time.

If you have questions, please contact support@company.com.
```

## Root Cause Analysis

### The 5 Whys Technique

```yaml
Example: Website Down

Symptom: Website returning 503 errors

Why 1: Why is the website down?
  → The load balancer is marking all backend servers as unhealthy

Why 2: Why is the load balancer marking servers as unhealthy?
  → Health check requests are timing out after 2 seconds

Why 3: Why are health checks timing out?
  → Application is taking 5+ seconds to respond to health checks

Why 4: Why is the application slow to respond?
  → Database connection pool is exhausted (all connections in use)

Why 5: Why is the connection pool exhausted?
  → Recent deployment increased default connection timeout from 5s to 60s,
     causing connections to be held longer

ROOT CAUSE: Configuration change in deployment increased connection timeout,
causing connection pool exhaustion and cascading failure.

CORRECTIVE ACTIONS:
- Immediate: Rollback deployment
- Short-term: Add connection pool monitoring and alerting
- Long-term: Review and test all timeout configurations, add capacity planning
```

### Fishbone (Ishikawa) Diagram

```
                                    Website Down (503 Errors)
                                            ↑
        ┌──────────────┬───────────────────┼───────────────────┬──────────────┐
        │              │                   │                   │              │
    METHODS         MACHINES           MATERIALS          MANPOWER       ENVIRONMENT
        │              │                   │                   │              │
    Deployment    Load Balancer      Configuration      On-call team    Traffic spike
    process          │                     │                   │              │
        │        Health checks        Timeout settings    Understaffed   Peak hours
    No staging   not tuned              │                  Inexperienced      │
    validation       │              Connection pool        │              Sudden load
        │        Timeout: 2s         size: 10           No runbook          │
    No rollback      │                     │                   │          DDoS attack?
    plan         Backend slow        Default settings    No training         │
        │              │              not reviewed            │          Geographic
    Auto-deploy  App response: 5s         │              Poor documentation  event
        │              │                   │                   │              │
        └──────────────┴───────────────────┴───────────────────┴──────────────┘
                                            ↓
                          Contributing Factors Analysis
```

### Fault Tree Analysis

```
                       Website Unavailable
                              ↑
                    ┌─────────┴─────────┐
                    │         OR        │
        ┌───────────┴───────┐       ┌───┴──────────┐
   Load Balancer        Backend Servers    DNS Failure
      Failure               Down               (rare)
        ↑                    ↑
        │          ┌─────────┴─────────┐
        │          │        AND        │
        │    ┌─────┴────┐         ┌────┴─────┐
        │   All Servers    Health Check
        │   Unhealthy        Failing
        │      ↑                 ↑
        │      │                 │
    Config  Database      Response Time
    Error   Overload         > Timeout
        ↑      ↑                 ↑
        │      │            ┌────┴────┐
   Deploy   Connection     │   OR    │
   Failed  Pool Full   ┌───┴───┐ ┌───┴───┐
              ↑        │       │ │       │
         Timeout   Slow    Database
         Too High  Query   Connection
                           Pool Size
                           Too Small

ROOT CAUSE PATH (highlighted):
Website Unavailable ← Backend Servers Down ← All Servers Unhealthy
← Health Check Failing ← Response Time > Timeout ← Connection Pool Full
← Timeout Too High ← Deploy Failed (config error)
```

### Timeline Analysis

```yaml
Incident Timeline: 2025-01-15 API Outage

14:28:00 - Deployment started (v2.3.1)
14:30:00 - Deployment completed successfully
14:32:00 - First spike in error rate (5% → 20%)
14:32:30 - Error rate continues climbing (20% → 50%)
14:33:00 - Complete outage (100% errors)
14:33:15 - Automated alert fired: "High error rate"
14:33:45 - PagerDuty page sent to on-call
14:35:00 - On-call acknowledged alert [MTTA: 1m 45s]
14:36:00 - Incident declared P1, war room created
14:37:00 - Dashboard review shows all backend servers marked unhealthy
14:38:00 - Health check logs show timeouts
14:40:00 - Application logs show slow responses on /health endpoint
14:42:00 - Database connection pool exhaustion identified
14:45:00 - Recent deployment suspected
14:48:00 - Config diff reveals timeout change: 5s → 60s
14:50:00 - Decision made to rollback
14:52:00 - Rollback initiated
14:55:00 - Rollback completed
14:56:00 - Error rate dropping (100% → 10%)
14:58:00 - Error rate normal (< 1%)
15:00:00 - Monitoring for 5 minutes, no new errors
15:05:00 - Incident declared resolved [MTTR: 30 minutes]

Key Insights:
- Detection delay: 3 minutes (first error to alert)
- Response time: 2 minutes (alert to war room)
- Investigation time: 15 minutes (war room to root cause)
- Resolution time: 8 minutes (decision to rollback complete)
- Recovery time: 5 minutes (rollback to normal)

Contributing Factors:
- ✓ Automated alerting worked
- ✓ On-call response was fast
- ✗ No pre-deployment config validation
- ✗ Timeout change not reviewed in code review
- ✗ Health check timeout not considered during testing
- ✗ No staging environment to catch issue
```

## Post-Incident Reviews

### Blameless Post-Mortem Principles

```yaml
Core Values:
  1. No Blame or Punishment:
     - Focus on systems and processes, not individuals
     - Assume everyone acted with best intentions
     - Create psychological safety for honest discussion

  2. Learning Over Judgment:
     - Goal is to improve, not to find fault
     - Celebrate what went well
     - Identify opportunities for improvement

  3. Systems Thinking:
     - Complex systems have complex failures
     - Multiple contributing factors, not single root cause
     - Focus on increasing system resilience

  4. Actionable Outcomes:
     - Every insight must lead to action item
     - Action items must have owners and due dates
     - Track action items to completion

  5. Shared Learning:
     - Share findings with entire organization
     - Build institutional knowledge
     - Prevent similar incidents elsewhere
```

### Post-Incident Review Template

```markdown
# Post-Incident Review: API Outage - 2025-01-15

## Metadata
- **Date**: 2025-01-15
- **Duration**: 28 minutes (14:32 - 15:00 UTC)
- **Severity**: P1 (Critical)
- **Incident Commander**: Jane Doe
- **Services Affected**: API Gateway, All API Endpoints
- **Users Impacted**: ~50,000 (100% of active users)

## Executive Summary
On January 15, 2025, our API service experienced a complete outage lasting 28 minutes. A configuration error in a routine deployment caused the database connection pool to exhaust, leading to health check failures and all backend servers being marked unhealthy by the load balancer. The issue was resolved by rolling back the deployment. No data was lost, but approximately $4,700 in revenue was impacted.

## What Happened (Timeline)
[Detailed timeline from Timeline Analysis section above]

## Impact Assessment

### User Impact
- **Affected Users**: 50,000 active users (100%)
- **User Experience**: Complete inability to access any API functionality
- **Customer Complaints**: 127 support tickets filed
- **Duration**: 28 minutes

### Business Impact
- **Revenue Loss**: ~$4,700 (estimated from transaction volume)
- **SLA Breach**: Monthly SLO of 99.9% consumed 67% of error budget
- **Reputation**: High-profile users tweeted about outage
- **Support Cost**: ~40 hours of support time responding to tickets

### Technical Impact
- **Failed Requests**: ~2.1 million
- **Data Loss**: None
- **Services Affected**: All API endpoints
- **Downstream Dependencies**: Mobile app, web app, third-party integrations

## Root Cause Analysis

### Immediate Cause
Load balancer marked all backend servers as unhealthy because health check requests exceeded the 2-second timeout.

### Contributing Factors
1. **Configuration Change**: Deployment v2.3.1 changed database connection timeout from 5s to 60s
2. **Connection Pool Exhaustion**: Longer timeouts caused connections to be held longer, exhausting the pool (max 10 connections)
3. **Slow Health Checks**: With no available connections, health check endpoint took 5+ seconds to respond
4. **Health Check Timeout**: Load balancer timeout (2s) was lower than application response time (5s)
5. **Lack of Validation**: Configuration change not flagged in code review or tested in staging

### Root Cause
A configuration change increasing database timeout was not properly reviewed or tested, leading to connection pool exhaustion and cascading failure when deployed to production.

## What Went Well

### Detection
✓ Automated monitoring detected issue within 3 minutes of complete outage
✓ Alert fired appropriately with correct severity
✓ On-call engineer acknowledged within 2 minutes

### Response
✓ Incident Commander immediately declared P1 and activated full response
✓ War room established quickly with all necessary responders
✓ Clear role assignments (IC, TL, Scribe, Comms)
✓ Excellent communication throughout incident
✓ Rollback decision made decisively once root cause identified

### Recovery
✓ Rollback executed cleanly without issues
✓ Service recovered fully within 5 minutes of rollback
✓ No data loss or corruption
✓ Post-incident review scheduled promptly

## What Could Be Improved

### Prevention
✗ Configuration changes should be validated automatically
✗ Code review didn't catch the impact of timeout change
✗ No staging environment to test configuration changes
✗ Connection pool size (10) too small for production load

### Detection
✗ 3-minute delay between first errors and alert (gradual degradation not caught)
✗ No alerting on connection pool saturation
✗ Health check failures not alerted separately

### Response
✗ Took 15 minutes to identify root cause (need better debugging tools)
✗ No runbook for "all servers unhealthy" scenario
✗ Rollback procedure not documented (relied on tribal knowledge)

### Systemic Issues
✗ No automated rollback on deployment failures
✗ Configuration changes deployed same as code changes (should have different process)
✗ No capacity planning for connection pools
✗ Health check timeout not aligned with application timeouts

## Action Items

### Immediate (1 week)
- [ ] **Add connection pool monitoring** [Owner: John Smith] [Due: 2025-01-22]
  - Alert at 70% utilization (warning)
  - Alert at 85% utilization (critical)

- [ ] **Increase connection pool size** [Owner: Alice Johnson] [Due: 2025-01-22]
  - Calculate appropriate size based on load testing
  - Implement in production (target: 50-100 connections)

- [ ] **Create runbook for "All servers unhealthy"** [Owner: Jane Doe] [Due: 2025-01-22]
  - Document diagnostic steps
  - Include rollback procedure
  - Add to on-call documentation

### Short-term (1 month)
- [ ] **Implement configuration validation** [Owner: Platform Team] [Due: 2025-02-15]
  - Add pre-deployment checks for timeout values
  - Validate connection pool size vs timeout settings
  - Block deployments that fail validation

- [ ] **Set up staging environment** [Owner: DevOps Team] [Due: 2025-02-15]
  - Production-like configuration
  - Automated deployment testing
  - Required step before production deployment

- [ ] **Align health check timeouts** [Owner: Infrastructure Team] [Due: 2025-02-15]
  - Load balancer timeout should be > app timeout
  - Document timeout hierarchy
  - Automate timeout configuration

- [ ] **Implement gradual rollout** [Owner: Platform Team] [Due: 2025-02-28]
  - Canary deployments (10% → 50% → 100%)
  - Automatic rollback on error rate increase
  - Deployment gates based on metrics

### Long-term (3 months)
- [ ] **Separate config deployment pipeline** [Owner: Architecture Team] [Due: 2025-04-15]
  - Configuration changes reviewed by ops team
  - Gradual rollout for config changes
  - Different approval process than code

- [ ] **Implement synthetic monitoring** [Owner: Observability Team] [Due: 2025-04-15]
  - Proactive health checks from external monitors
  - Alert before complete outage
  - Detect gradual degradation earlier

- [ ] **Capacity planning framework** [Owner: SRE Team] [Due: 2025-04-30]
  - Document sizing guidelines for connection pools
  - Load testing requirements
  - Automated capacity recommendations

## Lessons Learned

1. **Configuration is Code**: Configuration changes should be treated with the same rigor as code changes, including review, testing, and validation.

2. **Test in Staging**: A production-like staging environment would have caught this issue before it reached production.

3. **Cascading Failures**: Small changes (timeout adjustment) can have large, unexpected effects. Better understanding of system interactions is needed.

4. **Alerting Gaps**: We alerted on symptoms (errors) but not leading indicators (connection pool saturation). Adding more proactive monitoring would enable earlier intervention.

5. **Response Worked Well**: Despite the outage, our incident response process performed admirably. Clear roles, good communication, and decisive action led to fast resolution.

## Appendix

### Supporting Data
- [Link to Grafana Dashboard during incident]
- [Link to error logs]
- [Link to deployment change log]
- [Link to war room Slack thread]

### Glossary
- **MTTA**: Mean Time to Acknowledge
- **MTTR**: Mean Time to Recovery
- **SLO**: Service Level Objective

### Related Incidents
- 2024-11-03: Database connection pool exhaustion (different cause)
- 2024-09-12: Health check timeout issues on Redis

### Review Attendees
- Jane Doe (Incident Commander)
- John Smith (Technical Lead)
- Alice Johnson (Engineering Manager)
- Bob Wilson (Product Manager)
- Carol Martinez (Customer Success)
```

### Post-Incident Review Meeting Agenda

```yaml
Duration: 60 minutes

00:00-00:05 (5 min): Intro and Ground Rules
  - Reminder: Blameless, focus on learning
  - Goal: Improve systems and processes
  - Everyone encouraged to participate

00:05-00:15 (10 min): Timeline Walkthrough
  - Incident Commander presents timeline
  - Highlight key events
  - Clarifying questions only (no analysis yet)

00:15-00:25 (10 min): What Went Well
  - Celebrate successes
  - What should we keep doing?
  - What practices helped us respond effectively?

00:25-00:40 (15 min): What Could Be Improved
  - Open discussion
  - What could we have done differently?
  - What prevented faster detection/resolution?
  - Surface systemic issues

00:40-00:55 (15 min): Action Items
  - Brainstorm improvements
  - Prioritize by impact and effort
  - Assign owners and due dates
  - Ensure items are specific and actionable

00:55-01:00 (5 min): Wrap-up
  - Review action items
  - Schedule follow-ups
  - Thank participants
```

## On-Call Management

### On-Call Rotation Best Practices

```yaml
Rotation Schedule:
  Primary On-Call:
    Duration: 1 week (Monday-Monday)
    Responsibilities: First responder for all alerts
    Compensation: Stipend + time off

  Secondary On-Call:
    Duration: 1 week (Monday-Monday)
    Responsibilities: Backup for primary, escalation target
    Compensation: Stipend

  Rotation Size:
    Minimum: 4 engineers (2 weeks between shifts)
    Recommended: 6-8 engineers (4-6 weeks between shifts)
    Maximum: 12 engineers (risk of losing context)

On-Call Eligibility:
  Requirements:
    - Completed onboarding (30+ days)
    - Shadowed 2+ on-call shifts
    - Can access production systems
    - Familiar with monitoring and alerting
    - Completed incident response training

  Opt-out Reasons:
    - Vacation (blackout dates)
    - Personal circumstances
    - Heavy project deadlines (pre-approved)

Schedule Management:
  Tool: PagerDuty, OpsGenie, or similar
  Visibility: Published 6 weeks in advance
  Changes: Self-service swap with approval
  Coverage: 24/7 for P1/P2, business hours for P3/P4

Escalation Policy:
  Level 1: Primary On-Call (0-5 min)
  Level 2: Secondary On-Call (5-15 min)
  Level 3: Team Lead (15-30 min)
  Level 4: Engineering Manager (30-60 min)
  Level 5: VP Engineering (60+ min, P1 only)
```

### On-Call Runbook

```markdown
# On-Call Engineer Guide

## Before Your Shift

### 48 Hours Before
- [ ] Review the on-call schedule
- [ ] Identify your backup (secondary on-call)
- [ ] Block calendar for any potential incident response
- [ ] Review recent incidents and ongoing issues

### 24 Hours Before
- [ ] Test laptop and VPN access
- [ ] Test PagerDuty app notifications
- [ ] Ensure mobile phone is charged
- [ ] Review monitoring dashboards
- [ ] Check for scheduled deployments or maintenance

### Start of Shift
- [ ] Post in #on-call channel: "Starting on-call shift"
- [ ] Review open incidents and alerts
- [ ] Check upcoming changes in deployment calendar
- [ ] Skim through recent post-mortems
- [ ] Verify access to all critical systems

## During Your Shift

### When Alert Fires
1. **Acknowledge** (within 5 minutes for P1/P2)
   - Open PagerDuty alert
   - Click "Acknowledge"
   - Alert stops paging

2. **Initial Assessment** (first 5 minutes)
   - Read alert description
   - Check alert dashboard link
   - Assess severity (is P1 correct?)
   - Check recent changes (deployment, config)

3. **Decide Next Steps**
   - If **clear fix**: Implement and monitor
   - If **quick rollback**: Execute rollback
   - If **unclear**: Declare incident and get help

### When to Declare Incident
Declare incident (create war room) if:
- You're unsure how to fix (need help)
- User impact is significant
- Will take > 30 minutes to resolve
- Multiple systems affected

### When to Escalate
Escalate to secondary on-call if:
- You're overwhelmed (multiple alerts)
- You need specific expertise
- You're stuck (30+ min no progress)

Escalate to manager if:
- P1 incident lasting > 1 hour
- User data at risk
- Security incident
- Need executive decision

### Alert Hygiene
After each alert:
- [ ] Update incident ticket with resolution
- [ ] Mark alert as "resolved" in PagerDuty
- [ ] If false positive: Create ticket to tune alert
- [ ] If new issue: Create ticket to fix root cause
- [ ] Update runbook if you learned something new

## End of Shift

### Handoff Checklist
- [ ] Post in #on-call: "Ending on-call shift"
- [ ] List open incidents and their status
- [ ] Note any ongoing issues or concerns
- [ ] Mention scheduled changes in next 24 hours
- [ ] Thank the outgoing on-call

### Feedback and Improvement
- [ ] Log toil reduction opportunities
- [ ] Update runbooks based on what you learned
- [ ] File tickets for alert improvements
- [ ] Provide feedback on on-call process

## Common Scenarios

### Scenario: High Error Rate Alert
1. Check dashboard: Which service? Which endpoint?
2. Check recent deployments: Anything in last hour?
3. Check logs: What errors are users seeing?
4. If recent deployment: Consider rollback
5. If not recent: Investigate dependencies

### Scenario: High Latency Alert
1. Check dashboard: Which percentile? How high?
2. Check database: Slow queries? Connection pool full?
3. Check dependencies: External APIs slow?
4. Check traffic: Unusual spike in requests?
5. Consider scaling if capacity issue

### Scenario: Service Down Alert
1. Check monitoring: Complete outage or partial?
2. Check infrastructure: Servers running? Network okay?
3. Check recent changes: Deployment? Config change?
4. Restart if safe (stateless services)
5. Rollback if recent deployment

## Emergency Contacts

Primary Escalation:
- Secondary On-Call: [PagerDuty escalation]
- Team Lead: [Phone number]
- Engineering Manager: [Phone number]

SMEs (Subject Matter Experts):
- Database: [Name, phone]
- Networking: [Name, phone]
- Security: [Name, phone]
- Cloud Infrastructure: [Name, phone]

External:
- Cloud Provider Support: [Phone, ticket system]
- Third-party Vendor Support: [Phone, ticket system]

## Useful Links

Dashboards:
- [Overall System Health Dashboard]
- [Service-Specific Dashboards]
- [Infrastructure Dashboard]

Runbooks:
- [Runbook Index]
- [Common Incident Scenarios]
- [Rollback Procedures]

Tools:
- [PagerDuty Incidents]
- [Grafana Dashboards]
- [Log Aggregation (ELK/Splunk)]
- [Deployment Tool]
- [ChatOps (Slack)]
```

## Incident Management Tools

### Tool Comparison

| Feature | PagerDuty | Opsgenie | Splunk On-Call | Incident.io | FireHydrant |
|---------|-----------|----------|----------------|-------------|-------------|
| **Alerting** | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓ | ✓✓ |
| **On-Call Scheduling** | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓ | ✓✓ |
| **Incident Timeline** | ✓✓ | ✓✓ | ✓ | ✓✓✓ | ✓✓✓ |
| **Status Page Integration** | ✓✓✓ | ✓✓ | ✓✓ | ✓✓✓ | ✓✓✓ |
| **Post-Mortem Templates** | ✓ | ✓ | ✓ | ✓✓✓ | ✓✓✓ |
| **Slack Integration** | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓✓ | ✓✓✓ |
| **Pricing** | $$$$ | $$$ | $$$ | $$$$ | $$$ |
| **Best For** | Mature teams | Mid-size teams | Splunk users | Modern incident mgmt | Modern incident mgmt |

### PagerDuty Configuration Example

```python
# PagerDuty API - Create Incident
import requests
import json

PAGERDUTY_API_KEY = "YOUR_API_KEY"
PAGERDUTY_EMAIL = "your-email@company.com"

def create_incident(title, description, urgency="high", service_id="SERVICE_ID"):
    """Create a PagerDuty incident"""

    url = "https://api.pagerduty.com/incidents"
    headers = {
        "Authorization": f"Token token={PAGERDUTY_API_KEY}",
        "Content-Type": "application/json",
        "From": PAGERDUTY_EMAIL
    }

    payload = {
        "incident": {
            "type": "incident",
            "title": title,
            "service": {
                "id": service_id,
                "type": "service_reference"
            },
            "urgency": urgency,
            "body": {
                "type": "incident_body",
                "details": description
            }
        }
    }

    response = requests.post(url, headers=headers, json=payload)

    if response.status_code == 201:
        incident = response.json()["incident"]
        print(f"Incident created: {incident['html_url']}")
        return incident
    else:
        print(f"Error: {response.status_code}")
        print(response.text)
        return None

# Example: Create incident from monitoring alert
if __name__ == "__main__":
    create_incident(
        title="High Error Rate on API",
        description="Error rate exceeded 5% for 10 minutes. Dashboard: https://grafana.example.com/...",
        urgency="high"
    )
```

## Runbook Development

### Runbook Template

```markdown
# Runbook: [Service Name] - [Scenario]

## Service Overview
- **Service**: API Gateway
- **Team**: Backend Team
- **On-Call**: #backend-oncall
- **SME**: John Smith (john@company.com)

## Purpose
This runbook covers troubleshooting and recovery procedures for the API Gateway service.

## Architecture
```
[Include architecture diagram or ASCII art]

External Clients → API Gateway → Backend Services → Database
                         ↓
                   Rate Limiter
                   Auth Service
```

## SLIs/SLOs
- **Availability**: 99.9% (43 minutes downtime/month)
- **Latency (p95)**: < 500ms
- **Error Rate**: < 0.1%

## Common Issues

### Issue 1: High Error Rate (5xx Errors)

**Symptoms**:
- Alert: "HighErrorRate" firing
- Dashboard shows error rate > 5%
- Users reporting "Service Unavailable" errors

**Possible Causes**:
1. Backend services down or unhealthy
2. Database connection issues
3. Recent deployment issue
4. Upstream dependency failure

**Diagnostic Steps**:
```bash
# 1. Check backend service health
kubectl get pods -n backend
kubectl describe pod <pod-name> -n backend

# 2. Check API Gateway logs
kubectl logs -f deployment/api-gateway -n gateway --tail=100

# 3. Check recent deployments
kubectl rollout history deployment/api-gateway -n gateway

# 4. Check database connections
# (Connect to app pod and run)
kubectl exec -it <pod-name> -n backend -- /bin/sh
netstat -an | grep 5432 | grep ESTABLISHED | wc -l

# 5. Check upstream dependencies
curl https://auth-service/health
curl https://payment-service/health
```

**Resolution Steps**:

If recent deployment (last 30 minutes):
```bash
# Rollback deployment
kubectl rollout undo deployment/api-gateway -n gateway
kubectl rollout status deployment/api-gateway -n gateway

# Verify error rate dropping
# Check dashboard: https://grafana.example.com/d/api-gateway
```

If database connection issue:
```bash
# Restart API Gateway pods (will reset connection pools)
kubectl rollout restart deployment/api-gateway -n gateway

# Monitor for improvement
watch kubectl get pods -n gateway
```

If upstream dependency down:
```bash
# Check status pages of dependencies
# Escalate to owning team
# Consider enabling fallback mode if available
```

**Escalation**:
- If not resolved in 15 minutes: Page secondary on-call
- If backend services issue: Page backend team
- If database issue: Page database team

### Issue 2: High Latency

**Symptoms**:
- Alert: "HighLatency" firing
- Dashboard shows p95 latency > 1000ms
- Users reporting slow responses

**Possible Causes**:
1. Database slow queries
2. High traffic / insufficient capacity
3. Downstream service latency
4. Memory/CPU saturation

**Diagnostic Steps**:
```bash
# 1. Check pod resources
kubectl top pods -n gateway

# 2. Check HPA status (auto-scaling)
kubectl get hpa -n gateway

# 3. Check slow queries
# (Connect to database)
SELECT pid, query, query_start, state
FROM pg_stat_activity
WHERE state != 'idle'
AND (now() - query_start) > interval '5 seconds'
ORDER BY query_start;

# 4. Check downstream services
curl -w "@curl-format.txt" https://service-a/health
curl -w "@curl-format.txt" https://service-b/health
```

**Resolution Steps**:

If capacity issue (CPU/memory high):
```bash
# Scale up deployment
kubectl scale deployment/api-gateway -n gateway --replicas=10

# Or wait for HPA to scale (if configured)
kubectl get hpa -n gateway -w
```

If slow database queries:
```sql
-- Kill long-running query (use with caution)
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid = <problematic_pid>;
```

### Issue 3: Complete Service Outage

**Symptoms**:
- Alert: "ServiceDown" firing
- Dashboard shows 0 requests/sec
- All health checks failing

**Immediate Actions**:
1. Declare P1 incident
2. Create war room: #incident-YYYY-MM-DD-api-outage
3. Page backup on-call and team lead

**Diagnostic Steps**:
```bash
# 1. Check if pods are running
kubectl get pods -n gateway

# 2. Check deployment status
kubectl get deployment api-gateway -n gateway

# 3. Check recent changes
git log --since="1 hour ago" --oneline

# 4. Check infrastructure (nodes, network)
kubectl get nodes
kubectl describe node <node-name>
```

**Resolution Steps**:
[Detailed recovery steps based on cause]

## Related Runbooks
- [Database Troubleshooting Runbook](link)
- [Kubernetes Troubleshooting Runbook](link)
- [Rollback Procedures](link)

## Useful Dashboards
- [API Gateway Dashboard](https://grafana.example.com/d/api-gateway)
- [Backend Services Dashboard](https://grafana.example.com/d/backend)
- [Infrastructure Dashboard](https://grafana.example.com/d/infrastructure)

## Useful Commands

```bash
# Check logs
kubectl logs -f deployment/api-gateway -n gateway --tail=100

# Get shell in pod
kubectl exec -it <pod-name> -n gateway -- /bin/bash

# Port forward to local machine
kubectl port-forward deployment/api-gateway 8080:8080 -n gateway

# Describe resource
kubectl describe pod <pod-name> -n gateway

# Check events
kubectl get events -n gateway --sort-by='.lastTimestamp'
```

## Recent Changes
- 2025-01-10: Added HPA configuration (autoscaling)
- 2024-12-15: Increased connection pool size to 50
- 2024-11-20: Updated rollback procedure

## Document Info
- **Last Updated**: 2025-01-15
- **Owner**: Backend Team
- **Review Cycle**: Monthly
```

## Metrics and Improvement

### Key Metrics to Track

```yaml
Incident Metrics:
  MTTA (Mean Time to Acknowledge):
    Definition: Time from alert to acknowledgment
    Target: < 5 minutes for P1, < 15 minutes for P2
    Calculation: Sum(ack_time - alert_time) / Count(incidents)

  MTTI (Mean Time to Identify):
    Definition: Time from acknowledgment to root cause identified
    Target: < 30 minutes for P1, < 2 hours for P2
    Calculation: Sum(identified_time - ack_time) / Count(incidents)

  MTTR (Mean Time to Recovery):
    Definition: Time from alert to resolution
    Target: < 1 hour for P1, < 4 hours for P2
    Calculation: Sum(resolved_time - alert_time) / Count(incidents)

  MTBF (Mean Time Between Failures):
    Definition: Time between incidents
    Target: > 720 hours (30 days)
    Calculation: Total operational time / Count(incidents)

Quality Metrics:
  Incident Recurrence Rate:
    Definition: % of incidents that recur within 90 days
    Target: < 10%
    Calculation: Recurring incidents / Total incidents × 100

  Action Item Completion Rate:
    Definition: % of post-incident action items completed on time
    Target: > 90%
    Calculation: Completed on time / Total action items × 100

  Runbook Coverage:
    Definition: % of services with up-to-date runbooks
    Target: 100%
    Calculation: Services with runbooks / Total services × 100

On-Call Metrics:
  Alert Volume:
    Definition: Number of alerts per on-call shift
    Target: < 20 per week
    Measurement: Count by week

  False Positive Rate:
    Definition: % of alerts that don't require action
    Target: < 20%
    Calculation: False positives / Total alerts × 100

  After-Hours Pages:
    Definition: Pages outside business hours
    Target: < 5 per week
    Measurement: Count by time of day
```

### Continuous Improvement Process

```yaml
Weekly:
  Alert Hygiene Review:
    - Review all alerts from past week
    - Identify false positives (> 20% = tune or remove)
    - Update alert thresholds
    - Create tickets for recurring issues

  On-Call Feedback:
    - Collect feedback from outgoing on-call
    - Identify toil reduction opportunities
    - Update runbooks based on learnings

Monthly:
  Incident Retrospective:
    - Review all incidents from past month
    - Analyze trends (common causes, affected services)
    - Track MTTA, MTTI, MTTR trends
    - Review action item completion rate

  Runbook Audit:
    - Review and update all runbooks
    - Test procedures
    - Remove outdated information

  Training:
    - Onboard new on-call engineers
    - Incident response drills/simulations
    - Share learnings from recent incidents

Quarterly:
  Metrics Review:
    - Present incident metrics to leadership
    - Track progress on reduction targets
    - Identify systemic issues
    - Celebrate improvements

  Process Improvements:
    - Review incident management process
    - Gather team feedback
    - Implement process changes
    - Update documentation
```

This comprehensive incident management guide provides all the tools and processes needed for effective incident response and continuous improvement.
