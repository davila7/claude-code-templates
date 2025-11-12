# IT Operations Expert

A comprehensive Claude skill for IT operations professionals, covering infrastructure management, monitoring, incident response, automation, and disaster recovery.

## Overview

This skill provides expert guidance on all aspects of IT operations, from managing servers and networks to implementing robust monitoring, handling incidents effectively, automating repetitive tasks, and ensuring business continuity through proper backup and disaster recovery procedures.

## What This Skill Covers

### Core Operations
- **Monitoring & Observability**: Comprehensive monitoring strategies, alerting, dashboards, and SLI/SLO/SLA frameworks
- **Incident Management**: Structured incident response, root cause analysis, post-mortems, and on-call management
- **Infrastructure Management**: Server lifecycle, network operations, capacity planning, and cloud infrastructure
- **Automation**: Scripting, configuration management, orchestration, and toil reduction strategies
- **Backup & Recovery**: Backup strategies, disaster recovery planning, business continuity, and recovery testing

### Key Frameworks
- **ITIL Service Management**: Service strategy, design, transition, operation, and continual service improvement
- **Site Reliability Engineering (SRE)**: Error budgets, toil reduction, automation-first approach
- **Observability**: The three pillars (metrics, logs, traces), Golden Signals, RED/USE methods
- **Incident Response**: Severity classification, role assignments, communication protocols

## Quick Start

### For New Operations Teams

1. **Start with Monitoring** - [reference/monitoring.md](reference/monitoring.md)
   - Set up basic infrastructure monitoring (CPU, memory, disk, network)
   - Implement the Four Golden Signals (latency, traffic, errors, saturation)
   - Configure alerting with proper thresholds
   - Create operational dashboards

2. **Establish Incident Response** - [reference/incident-management.md](reference/incident-management.md)
   - Define severity levels (P1-P4)
   - Document escalation procedures
   - Create on-call rotation
   - Build incident response runbooks

3. **Document Infrastructure** - [reference/infrastructure.md](reference/infrastructure.md)
   - Inventory all servers and systems
   - Document network topology
   - Establish capacity planning baseline
   - Create server provisioning procedures

4. **Implement Backups** - [reference/backup-recovery.md](reference/backup-recovery.md)
   - Follow the 3-2-1 backup rule
   - Define RPO/RTO for each system
   - Automate backup processes
   - Test recovery procedures

5. **Automate Repetitive Tasks** - [reference/automation.md](reference/automation.md)
   - Identify high-ROI automation opportunities
   - Start with scripts for common tasks
   - Progress to configuration management
   - Measure toil reduction

### For Mature Operations Teams

Enhance your existing practices:
- **Advanced Observability**: Implement distributed tracing, anomaly detection, predictive alerting
- **Self-Healing Systems**: Build event-driven automation that responds to alerts automatically
- **Chaos Engineering**: Proactively test system resilience through controlled failure injection
- **GitOps**: Treat infrastructure as code with full CI/CD pipelines
- **Cost Optimization**: Implement cloud cost management and right-sizing strategies

## File Structure

```
it-operations/
├── SKILL.md                          # Main skill file with core principles and workflows
├── README.md                         # This file
└── reference/                        # Detailed technical references
    ├── monitoring.md                 # Observability, metrics, alerting, dashboards
    ├── incident-management.md        # Incident response, root cause analysis, post-mortems
    ├── infrastructure.md             # Server management, networking, capacity planning
    ├── automation.md                 # Scripting, configuration management, orchestration
    └── backup-recovery.md            # Backup strategies, disaster recovery, business continuity
```

## Common Scenarios

### Scenario 1: High CPU Alert
**Problem**: Alert fires indicating high CPU usage on production server

**Response**:
1. Check [monitoring.md](reference/monitoring.md) for diagnostic queries
2. Follow incident response workflow in [incident-management.md](reference/incident-management.md)
3. Investigate top CPU consumers
4. Decision:
   - If capacity issue: Scale up (see [infrastructure.md](reference/infrastructure.md))
   - If application issue: Engage development team
   - If attack: Engage security team
5. Document in post-incident review

### Scenario 2: Service Outage
**Problem**: Critical application is completely down

**Response**:
1. Declare P1 incident ([incident-management.md](reference/incident-management.md))
2. Activate incident response team
3. Check recent changes (deployments, configuration)
4. Review runbook for service (see SKILL.md)
5. Consider rollback if recent deployment
6. Restore from backup if data corruption ([backup-recovery.md](reference/backup-recovery.md))
7. Conduct blameless post-mortem

### Scenario 3: Capacity Planning
**Problem**: Need to forecast infrastructure needs for next quarter

**Response**:
1. Collect baseline metrics ([monitoring.md](reference/monitoring.md))
2. Analyze trends ([infrastructure.md](reference/infrastructure.md) - Capacity Planning section)
3. Calculate growth rate and forecast
4. Plan procurement or cloud scaling
5. Budget approval and execution

### Scenario 4: Disaster Recovery Test
**Problem**: Annual DR test is scheduled

**Response**:
1. Review DR plan ([backup-recovery.md](reference/backup-recovery.md))
2. Notify stakeholders of test window
3. Execute failover to DR site
4. Validate all systems functional
5. Run for 4-8 hours
6. Failback to primary site
7. Document results and improvements

### Scenario 5: Toil Reduction Initiative
**Problem**: Team spending too much time on manual tasks

**Response**:
1. Track time spent on tasks (weekly)
2. Calculate automation ROI ([automation.md](reference/automation.md))
3. Prioritize high-impact, high-ROI tasks
4. Develop automation (scripts, then configuration management)
5. Measure time saved
6. Iterate and expand automation

## Best Practices

### Operational Excellence

**Proactive Operations**:
- Monitor leading indicators, not just failures
- Implement capacity planning (don't wait for outages)
- Test disaster recovery regularly (quarterly minimum)
- Automate repetitive tasks (reduce toil below 50%)

**Blameless Culture**:
- Focus on systems, not people
- Post-mortems are learning opportunities
- Reward transparency and sharing failures
- Track action items to completion

**Documentation**:
- Runbooks for every service
- Up-to-date architecture diagrams
- Searchable knowledge base
- Regularly reviewed and updated

**Continuous Improvement**:
- Track operational metrics (MTTR, MTTA, toil percentage)
- Regular retrospectives
- Implement lessons learned from incidents
- Share knowledge across teams

### Key Metrics to Track

**Reliability**:
- Availability (uptime percentage)
- MTTR (Mean Time to Recovery)
- MTTA (Mean Time to Acknowledge)
- MTBF (Mean Time Between Failures)
- Incident count by severity

**Efficiency**:
- Toil percentage (target < 50%)
- Automation coverage (target > 70%)
- Alert volume (trending down)
- False positive rate (target < 20%)

**Capacity**:
- CPU utilization trends
- Memory utilization trends
- Storage growth rate
- Network bandwidth usage

**Change Management**:
- Change success rate (target > 95%)
- Deployment frequency
- Lead time for changes
- Failed change percentage

## Integration with Other Skills

This IT Operations skill complements:

- **DevOps/SRE**: Collaboration on deployment automation, observability, and incident response
- **Security**: Infrastructure security, access controls, patch management, compliance
- **Cloud Architecture**: Cloud infrastructure management, cost optimization, cloud-native operations
- **Database Administration**: Database monitoring, backups, performance tuning
- **Network Engineering**: Network operations, firewall management, load balancing

## Continuous Learning

Stay current with IT operations practices:

**Industry Resources**:
- Google SRE Book (free online)
- ITIL 4 Foundation
- AWS Well-Architected Framework
- Prometheus/Grafana documentation
- HashiCorp Learn (Terraform, Vault)

**Communities**:
- SRE Weekly newsletter
- DevOps subreddit
- USENIX LISA conference
- Local DevOps/SRE meetups

**Certifications**:
- ITIL 4 Foundation
- AWS Certified SysOps Administrator
- Certified Kubernetes Administrator (CKA)
- Red Hat Certified System Administrator (RHCSA)

## Getting Help

When working with this skill:

1. **Start with SKILL.md** for high-level guidance and decision frameworks
2. **Reference specific guides** for detailed technical procedures
3. **Follow established workflows** (monitoring → incident response → remediation → post-mortem)
4. **Document improvements** and update runbooks as you learn

## Contributing

This skill improves through real-world experience. Consider updating:
- Runbooks based on actual incidents
- Automation scripts that proved valuable
- Monitoring queries that caught issues early
- Disaster recovery procedures after testing

## Version History

- **v1.0** (2025-01-15): Initial release
  - Core IT operations workflows
  - Monitoring and observability
  - Incident management
  - Infrastructure operations
  - Automation and orchestration
  - Backup and disaster recovery

## License

This skill is designed for use with Claude and follows IT operations industry best practices.
