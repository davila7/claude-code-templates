---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [migration-type] | framework | database | cloud | architecture | --version-upgrade
description: Create comprehensive migration guides with step-by-step procedures, validation, and rollback strategies
model: sonnet
---

# Migration Guide Generator

Create comprehensive migration guide: $ARGUMENTS

## Current System Analysis

- Current versions: @package.json or @requirements.txt or detect from lock files
- Migration history: !`find . -name "*migration*" -o -name "*upgrade*" | head -5`
- Database schema: !`find . -name "*schema*" -o -name "*.sql" | head -3`
- Dependencies: !`grep -c "dependency\|require\|import" package.json requirements.txt 2>/dev/null || echo "0"`
- Infrastructure: @docker-compose.yml or @k8s/ or @terraform/ (if exists)

## Task

Generate systematic migration guide with comprehensive safety measures: $ARGUMENTS

1. **Migration Scope Analysis**
   - Identify what is being migrated (framework, library, architecture, etc.)
   - Determine source and target versions or technologies
   - Assess the scale and complexity of the migration
   - Identify affected systems and components

2. **Impact Assessment**
   - Analyze breaking changes between versions
   - Identify deprecated features and APIs
   - Review new features and capabilities
   - Assess compatibility requirements and constraints
   - Evaluate performance and security implications

3. **Prerequisites and Requirements**
   - Document system requirements for the target version
   - List required tools and dependencies
   - Specify minimum versions and compatibility requirements
   - Identify necessary skills and team preparation
   - Outline infrastructure and environment needs

4. **Pre-Migration Preparation**
   - Create comprehensive backup strategies
   - Set up development and testing environments
   - Document current system state and configurations
   - Establish rollback procedures and contingency plans
   - Create migration timeline and milestones

5. **Step-by-Step Migration Process**
   
   **Example for Framework Upgrade:**
   ```markdown
   ## Step 1: Environment Setup
   1. Update development environment
   2. Install new framework version
   3. Update build tools and dependencies
   4. Configure IDE and tooling
   
   ## Step 2: Dependencies Update
   1. Update package.json/requirements.txt
   2. Resolve dependency conflicts
   3. Update related libraries
   4. Test compatibility
   
   ## Step 3: Code Migration
   1. Update import statements
   2. Replace deprecated APIs
   3. Update configuration files
   4. Modify build scripts
   ```

6. **Breaking Changes Documentation**
   - List all breaking changes with examples
   - Provide before/after code comparisons
   - Explain the rationale behind changes
   - Offer alternative approaches for removed features

   **Example Breaking Change:**
   ```markdown
   ### Removed: `oldMethod()`
   **Before:**
   ```javascript
   const result = library.oldMethod(param1, param2);
   ```
   
   **After:**
   ```javascript
   const result = library.newMethod({ 
     param1: param1, 
     param2: param2 
   });
   ```
   
   **Rationale:** Improved type safety and extensibility
   ```

7. **Configuration Changes**
   - Document configuration file updates
   - Explain new configuration options
   - Provide configuration migration scripts
   - Show environment-specific configurations

8. **Database Migration (if applicable)**
   - Create database schema migration scripts
   - Document data transformation requirements
   - Provide backup and restore procedures
   - Test migration with sample data
   - Plan for zero-downtime migrations

9. **Testing Strategy**
   - Update existing tests for new APIs
   - Create migration-specific test cases
   - Implement integration and E2E tests
   - Set up performance and load testing
   - Document test scenarios and expected outcomes

10. **Performance Considerations**
    - Document performance changes and optimizations
    - Provide benchmarking guidelines
    - Identify potential performance regressions
    - Suggest monitoring and alerting updates
    - Include memory and resource usage changes

11. **Security Updates**
    - Document security improvements and changes
    - Update authentication and authorization code
    - Review and update security configurations
    - Update dependency security scanning
    - Document new security best practices

12. **Deployment Strategy**
    - Plan phased rollout approach
    - Create deployment scripts and automation
    - Set up monitoring and health checks
    - Plan for blue-green or canary deployments
    - Document rollback procedures

13. **Common Issues and Troubleshooting**
    
    ```markdown
    ## Common Migration Issues
    
    ### Issue: Import/Module Resolution Errors
    **Symptoms:** Cannot resolve module 'old-package'
    **Solution:** 
    1. Update import statements to new package names
    2. Check package.json for correct dependencies
    3. Clear node_modules and reinstall
    
    ### Issue: API Method Not Found
    **Symptoms:** TypeError: oldMethod is not a function
    **Solution:** Replace with new API as documented in step 3
    ```

14. **Team Communication and Training**
    - Create team training materials
    - Schedule knowledge sharing sessions
    - Document new development workflows
    - Update coding standards and guidelines
    - Create quick reference guides

15. **Tools and Automation**
    - Provide migration scripts and utilities
    - Create code transformation tools (codemods)
    - Set up automated compatibility checks
    - Implement CI/CD pipeline updates
    - Create validation and verification tools

16. **Timeline and Milestones**
    
    ```markdown
    ## Migration Timeline
    
    ### Phase 1: Preparation (Week 1-2)
    - [ ] Environment setup
    - [ ] Team training
    - [ ] Development environment migration
    
    ### Phase 2: Development (Week 3-6)
    - [ ] Core application migration
    - [ ] Testing and validation
    - [ ] Performance optimization
    
    ### Phase 3: Deployment (Week 7-8)
    - [ ] Staging deployment
    - [ ] Production deployment
    - [ ] Monitoring and support
    ```

17. **Risk Mitigation**
    - Identify potential migration risks
    - Create contingency plans for each risk
    - Document escalation procedures
    - Plan for extended timeline scenarios
    - Prepare communication for stakeholders

18. **Post-Migration Tasks**
    - Clean up deprecated code and configurations
    - Update documentation and README files
    - Review and optimize new implementation
    - Conduct post-migration retrospective
    - Plan for future maintenance and updates

19. **Validation and Testing**
    - Create comprehensive test plans
    - Document acceptance criteria
    - Set up automated regression testing
    - Plan user acceptance testing
    - Implement monitoring and alerting

20. **Documentation Updates**
    - Update API documentation
    - Revise development guides
    - Update deployment documentation
    - Create troubleshooting guides
    - Update team onboarding materials

**Migration Types and Specific Considerations:**

**Framework Migration (React 17 → 18):**
- Update React and ReactDOM imports
- Replace deprecated lifecycle methods
- Update testing library methods
- Handle concurrent features and Suspense

**Database Migration (MySQL → PostgreSQL):**
- Convert SQL syntax differences
- Update data types and constraints
- Migrate stored procedures to functions
- Update ORM configurations

**Cloud Migration (On-premise → AWS):**
- Containerize applications
- Update CI/CD pipelines
- Configure cloud services
- Implement infrastructure as code

**Architecture Migration (Monolith → Microservices):**
- Identify service boundaries
- Implement inter-service communication
- Set up service discovery
- Plan data consistency strategies

Remember to:
- Test thoroughly in non-production environments first
- Communicate progress and issues regularly
- Document lessons learned for future migrations
- Keep the migration guide updated based on real experiences