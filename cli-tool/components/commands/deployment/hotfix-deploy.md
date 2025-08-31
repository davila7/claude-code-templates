---
allowed-tools: Read, Edit, Bash
argument-hint: [hotfix-type] | --security | --critical | --rollback-ready | --emergency
description: Deploy critical hotfixes with emergency procedures, validation, and rollback capabilities
model: sonnet
---

# Emergency Hotfix Deployment

Deploy critical hotfix: $ARGUMENTS

## Current Production State

- Current version: !`git describe --tags --abbrev=0 2>/dev/null || echo "No tags found"`
- Production branch: !`git branch --show-current`
- Recent commits: !`git log --oneline -5`
- Deployment status: !`curl -s https://api.example.com/health 2>/dev/null | jq -r '.version // "Unknown"' || echo "Health check failed"`
- Staging environment: Check for staging deployment capabilities

## Emergency Response Protocol

Execute emergency hotfix deployment: $ARGUMENTS

1. **Emergency Assessment and Triage**
   - Assess the severity and impact of the issue
   - Determine if a hotfix is necessary or if it can wait
   - Identify affected systems and user impact
   - Estimate time sensitivity and business impact
   - Document the incident and decision rationale

2. **Incident Response Setup**
   - Create incident tracking in your incident management system
   - Set up war room or communication channel
   - Notify stakeholders and on-call team members
   - Establish clear communication protocols
   - Document initial incident details and timeline

3. **Branch and Environment Setup**
   ```bash
   # Create hotfix branch from production tag
   git fetch --tags
   git checkout tags/v1.2.3  # Latest production version
   git checkout -b hotfix/critical-auth-fix
   
   # Alternative: Branch from main if using trunk-based development
   git checkout main
   git pull origin main
   git checkout -b hotfix/critical-auth-fix
   ```

4. **Rapid Development Process**
   - Keep changes minimal and focused on the critical issue only
   - Avoid refactoring, optimization, or unrelated improvements
   - Use well-tested patterns and established approaches
   - Add minimal logging for troubleshooting purposes
   - Follow existing code conventions and patterns

5. **Accelerated Testing**
   ```bash
   # Run focused tests related to the fix
   npm test -- --testPathPattern=auth
   npm run test:security
   
   # Manual testing checklist
   # [ ] Core functionality works correctly
   # [ ] Hotfix resolves the critical issue
   # [ ] No new issues introduced
   # [ ] Critical user flows remain functional
   ```

6. **Fast-Track Code Review**
   - Get expedited review from senior team member
   - Focus review on security and correctness
   - Use pair programming if available and time permits
   - Document review decisions and rationale quickly
   - Ensure proper approval process even under time pressure

7. **Version and Tagging**
   ```bash
   # Update version for hotfix
   # 1.2.3 -> 1.2.4 (patch version)
   # or 1.2.3 -> 1.2.3-hotfix.1 (hotfix identifier)
   
   # Commit with detailed message
   git add .
   git commit -m "hotfix: fix critical authentication vulnerability
   
   - Fix password validation logic
   - Resolve security issue allowing bypass
   - Minimal change to reduce deployment risk
   
   Fixes: #1234"
   
   # Tag the hotfix version
   git tag -a v1.2.4 -m "Hotfix v1.2.4: Critical auth security fix"
   git push origin hotfix/critical-auth-fix
   git push origin v1.2.4
   ```

8. **Staging Deployment and Validation**
   ```bash
   # Deploy to staging environment for final validation
   ./deploy-staging.sh v1.2.4
   
   # Critical path testing
   curl -X POST staging.example.com/api/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"test@example.com","password":"testpass"}'
   
   # Run smoke tests
   npm run test:smoke:staging
   ```

9. **Production Deployment Strategy**
   
   **Blue-Green Deployment:**
   ```bash
   # Deploy to blue environment
   ./deploy-blue.sh v1.2.4
   
   # Validate blue environment health
   ./health-check-blue.sh
   
   # Switch traffic to blue environment
   ./switch-to-blue.sh
   
   # Monitor deployment metrics
   ./monitor-deployment.sh
   ```
   
   **Rolling Deployment:**
   ```bash
   # Deploy to subset of servers first
   ./deploy-rolling.sh v1.2.4 --batch-size 1
   
   # Monitor each batch deployment
   ./monitor-batch.sh
   
   # Continue with next batch if healthy
   ./deploy-next-batch.sh
   ```

10. **Pre-Deployment Checklist**
    ```bash
    # Verify all prerequisites are met
    # [ ] Database backup completed successfully
    # [ ] Rollback plan documented and ready
    # [ ] Monitoring alerts configured and active
    # [ ] Team members standing by for support
    # [ ] Communication channels established
    
    # Execute production deployment
    ./deploy-production.sh v1.2.4
    
    # Run immediate post-deployment validation
    ./validate-hotfix.sh
    ```

11. **Real-Time Monitoring**
    ```bash
    # Monitor key application metrics
    watch -n 10 'curl -s https://api.example.com/health | jq .'
    
    # Monitor error rates and logs
    tail -f /var/log/app/error.log | grep -i "auth"
    
    # Track critical metrics:
    # - Response times and latency
    # - Error rates and exception counts
    # - User authentication success rates
    # - System resource usage (CPU, memory)
    ```

12. **Post-Deployment Validation**
    ```bash
    # Run comprehensive validation tests
    ./test-critical-paths.sh
    
    # Test user authentication functionality
    curl -X POST https://api.example.com/auth/login \
         -H "Content-Type: application/json" \
         -d '{"email":"test@example.com","password":"testpass"}'
    
    # Validate security fix effectiveness
    ./security-validation.sh
    
    # Check overall system performance
    ./performance-check.sh
    ```

13. **Communication and Status Updates**
    - Provide regular status updates to stakeholders
    - Use consistent communication channels
    - Document deployment progress and results
    - Update incident tracking systems
    - Notify relevant teams of deployment completion

14. **Rollback Procedures**
    ```bash
    # Automated rollback script
    #!/bin/bash
    PREVIOUS_VERSION="v1.2.3"
    
    if [ "$1" = "rollback" ]; then
        echo "Rolling back to $PREVIOUS_VERSION"
        ./deploy-production.sh $PREVIOUS_VERSION
        ./validate-rollback.sh
        echo "Rollback completed successfully"
    fi
    
    # Manual rollback steps if automation fails:
    # 1. Switch load balancer back to previous version
    # 2. Validate previous version health and functionality
    # 3. Monitor system stability after rollback
    # 4. Communicate rollback status to team
    ```

15. **Post-Deployment Monitoring Period**
    - Monitor system for 2-4 hours after deployment
    - Watch error rates and performance metrics closely
    - Check user feedback and support ticket volume
    - Validate that the hotfix resolves the original issue
    - Document any issues or unexpected behaviors

16. **Documentation and Incident Reporting**
    - Document the complete hotfix process and timeline
    - Record lessons learned and process improvements
    - Update incident management systems with resolution
    - Create post-incident review materials
    - Share knowledge with team for future reference

17. **Merge Back to Main Branch**
    ```bash
    # After successful hotfix deployment and validation
    git checkout main
    git pull origin main
    git merge hotfix/critical-auth-fix
    git push origin main
    
    # Clean up hotfix branch
    git branch -d hotfix/critical-auth-fix
    git push origin --delete hotfix/critical-auth-fix
    ```

18. **Post-Incident Activities**
    - Schedule and conduct post-incident review meeting
    - Update runbooks and emergency procedures
    - Identify and implement process improvements
    - Update monitoring and alerting configurations
    - Plan preventive measures to avoid similar issues

**Hotfix Best Practices:**

- **Keep It Simple:** Make minimal changes focused only on the critical issue
- **Test Thoroughly:** Maintain testing standards even under time pressure
- **Communicate Clearly:** Keep all stakeholders informed throughout the process
- **Monitor Closely:** Watch the fix carefully in production environment
- **Document Everything:** Record all decisions and actions for post-incident review
- **Plan for Rollback:** Always have a tested way to revert changes quickly
- **Learn and Improve:** Use each incident to strengthen processes and procedures

**Emergency Escalation Guidelines:**

```bash
# Emergency contact information
ON_CALL_ENGINEER="+1-555-0123"
SENIOR_ENGINEER="+1-555-0124"
ENGINEERING_MANAGER="+1-555-0125"
INCIDENT_COMMANDER="+1-555-0126"

# Escalation timeline thresholds:
# 15 minutes: Escalate to senior engineer
# 30 minutes: Escalate to engineering manager
# 60 minutes: Escalate to incident commander
```

**Important Reminders:**

- Hotfixes should only be used for genuine production emergencies
- When in doubt about severity, follow the normal release process
- Always prioritize system stability over speed of deployment
- Maintain clear audit trails for all emergency changes
- Regular drills help ensure team readiness for real emergencies