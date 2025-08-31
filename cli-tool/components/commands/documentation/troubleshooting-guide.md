---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [system-component] | --application | --database | --network | --deployment | --comprehensive
description: Generate systematic troubleshooting documentation with diagnostic procedures, common issues, and automated solutions
model: sonnet
---

# Troubleshooting Guide Generator

Generate troubleshooting documentation: $ARGUMENTS

## Current System Context

- System architecture: @docker-compose.yml or @k8s/ or detect deployment type
- Log locations: !`find . -name "*log*" -type d | head -3`
- Monitoring setup: !`grep -r "prometheus\|grafana\|datadog" . 2>/dev/null | wc -l` monitoring references
- Error patterns: !`find . -name "*.log" | head -3` recent logs
- Health endpoints: !`grep -r "health\|status" src/ 2>/dev/null | head -3`

## Task

Create comprehensive troubleshooting guide with systematic diagnostic procedures: $ARGUMENTS

1. **System Overview and Architecture**
   - Document the system architecture and components
   - Map out dependencies and integrations
   - Identify critical paths and failure points
   - Create system topology diagrams
   - Document data flow and communication patterns

2. **Common Issues Identification**
   - Collect historical support tickets and issues
   - Interview team members about frequent problems
   - Analyze error logs and monitoring data
   - Review user feedback and complaints
   - Identify patterns in system failures

3. **Troubleshooting Framework**
   - Establish systematic diagnostic procedures
   - Create problem isolation methodologies
   - Document escalation paths and procedures
   - Set up logging and monitoring checkpoints
   - Define severity levels and response times

4. **Diagnostic Tools and Commands**
   
   ```markdown
   ## Essential Diagnostic Commands
   
   ### System Health
   ```bash
   # Check system resources
   top                    # CPU and memory usage
   df -h                 # Disk space
   free -m               # Memory usage
   netstat -tuln         # Network connections
   
   # Application logs
   tail -f /var/log/app.log
   journalctl -u service-name -f
   
   # Database connectivity
   mysql -u user -p -e "SELECT 1"
   psql -h host -U user -d db -c "SELECT 1"
   ```
   ```

5. **Issue Categories and Solutions**

   **Performance Issues:**
   ```markdown
   ### Slow Response Times
   
   **Symptoms:**
   - API responses > 5 seconds
   - User interface freezing
   - Database timeouts
   
   **Diagnostic Steps:**
   1. Check system resources (CPU, memory, disk)
   2. Review application logs for errors
   3. Analyze database query performance
   4. Check network connectivity and latency
   
   **Common Causes:**
   - Database connection pool exhaustion
   - Inefficient database queries
   - Memory leaks in application
   - Network bandwidth limitations
   
   **Solutions:**
   - Restart application services
   - Optimize database queries
   - Increase connection pool size
   - Scale infrastructure resources
   ```

6. **Error Code Documentation**
   
   ```markdown
   ## Error Code Reference
   
   ### HTTP Status Codes
   - **500 Internal Server Error**
     - Check application logs for stack traces
     - Verify database connectivity
     - Check environment variables
   
   - **404 Not Found**
     - Verify URL routing configuration
     - Check if resources exist
     - Review API endpoint documentation
   
   - **503 Service Unavailable**
     - Check service health status
     - Verify load balancer configuration
     - Check for maintenance mode
   ```

7. **Environment-Specific Issues**
   - Document development environment problems
   - Address staging/testing environment issues
   - Cover production-specific troubleshooting
   - Include local development setup problems

8. **Database Troubleshooting**
   
   ```markdown
   ### Database Connection Issues
   
   **Symptoms:**
   - "Connection refused" errors
   - "Too many connections" errors
   - Slow query performance
   
   **Diagnostic Commands:**
   ```sql
   -- Check active connections
   SHOW PROCESSLIST;
   
   -- Check database size
   SELECT table_schema, 
          ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS 'DB Size in MB' 
   FROM information_schema.tables 
   GROUP BY table_schema;
   
   -- Check slow queries
   SHOW VARIABLES LIKE 'slow_query_log';
   ```
   ```

9. **Network and Connectivity Issues**
   
   ```markdown
   ### Network Troubleshooting
   
   **Basic Connectivity:**
   ```bash
   # Test basic connectivity
   ping example.com
   telnet host port
   curl -v https://api.example.com/health
   
   # DNS resolution
   nslookup example.com
   dig example.com
   
   # Network routing
   traceroute example.com
   ```
   
   **SSL/TLS Issues:**
   ```bash
   # Check SSL certificate
   openssl s_client -connect example.com:443
   curl -vI https://example.com
   ```
   ```

10. **Application-Specific Troubleshooting**
    
    **Memory Issues:**
    ```markdown
    ### Out of Memory Errors
    
    **Java Applications:**
    ```bash
    # Check heap usage
    jstat -gc [PID]
    jmap -dump:format=b,file=heapdump.hprof [PID]
    
    # Analyze heap dump
    jhat heapdump.hprof
    ```
    
    **Node.js Applications:**
    ```bash
    # Monitor memory usage
    node --inspect app.js
    # Use Chrome DevTools for memory profiling
    ```
    ```

11. **Security and Authentication Issues**
    
    ```markdown
    ### Authentication Failures
    
    **Symptoms:**
    - 401 Unauthorized responses
    - Token validation errors
    - Session timeout issues
    
    **Diagnostic Steps:**
    1. Verify credentials and tokens
    2. Check token expiration
    3. Validate authentication service
    4. Review CORS configuration
    
    **Common Solutions:**
    - Refresh authentication tokens
    - Clear browser cookies/cache
    - Verify CORS headers
    - Check API key permissions
    ```

12. **Deployment and Configuration Issues**
    
    ```markdown
    ### Deployment Failures
    
    **Container Issues:**
    ```bash
    # Check container status
    docker ps -a
    docker logs container-name
    
    # Check resource limits
    docker stats
    
    # Debug container
    docker exec -it container-name /bin/bash
    ```
    
    **Kubernetes Issues:**
    ```bash
    # Check pod status
    kubectl get pods
    kubectl describe pod pod-name
    kubectl logs pod-name
    
    # Check service connectivity
    kubectl get svc
    kubectl port-forward pod-name 8080:8080
    ```
    ```

13. **Monitoring and Alerting Setup**
    - Configure health checks and monitoring
    - Set up log aggregation and analysis
    - Implement alerting for critical issues
    - Create dashboards for system metrics
    - Document monitoring thresholds

14. **Escalation Procedures**
    
    ```markdown
    ## Escalation Matrix
    
    ### Severity Levels
    
    **Critical (P1):** System down, data loss
    - Immediate response required
    - Escalate to on-call engineer
    - Notify management within 30 minutes
    
    **High (P2):** Major functionality impaired
    - Response within 2 hours
    - Escalate to senior engineer
    - Provide hourly updates
    
    **Medium (P3):** Minor functionality issues
    - Response within 8 hours
    - Assign to appropriate team member
    - Provide daily updates
    ```

15. **Recovery Procedures**
    - Document system recovery steps
    - Create data backup and restore procedures
    - Establish rollback procedures for deployments
    - Document disaster recovery processes
    - Test recovery procedures regularly

16. **Preventive Measures**
    - Implement monitoring and alerting
    - Set up automated health checks
    - Create deployment validation procedures
    - Establish code review processes
    - Document maintenance procedures

17. **Knowledge Base Integration**
    - Link to relevant documentation
    - Reference API documentation
    - Include links to monitoring dashboards
    - Connect to team communication channels
    - Integrate with ticketing systems

18. **Team Communication**
    
    ```markdown
    ## Communication Channels
    
    ### Immediate Response
    - Slack: #incidents channel
    - Phone: On-call rotation
    - Email: alerts@company.com
    
    ### Status Updates
    - Status page: status.company.com
    - Twitter: @company_status
    - Internal wiki: troubleshooting section
    ```

19. **Documentation Maintenance**
    - Regular review and updates
    - Version control for troubleshooting guides
    - Feedback collection from users
    - Integration with incident post-mortems
    - Continuous improvement processes

20. **Self-Service Tools**
    - Create diagnostic scripts and tools
    - Build automated recovery procedures
    - Implement self-healing systems
    - Provide user-friendly diagnostic interfaces
    - Create chatbot integration for common issues

**Advanced Troubleshooting Techniques:**

**Log Analysis:**
```bash
# Search for specific errors
grep -i "error" /var/log/app.log | tail -50

# Analyze log patterns
awk '{print $1}' access.log | sort | uniq -c | sort -nr

# Monitor logs in real-time
tail -f /var/log/app.log | grep -i "exception"
```

**Performance Profiling:**
```bash
# System performance
iostat -x 1
sar -u 1 10
vmstat 1 10

# Application profiling
strace -p [PID]
perf record -p [PID]
```

Remember to:
- Keep troubleshooting guides up-to-date
- Test all documented procedures regularly
- Collect feedback from users and improve guides
- Include screenshots and visual aids where helpful
- Make guides searchable and well-organized