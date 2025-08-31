---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [role-type] | --developer | --designer | --devops | --comprehensive | --interactive
description: Create comprehensive developer onboarding guide with environment setup, workflows, and interactive tutorials
model: sonnet
---

# Developer Onboarding Guide Generator

Create developer onboarding guide: $ARGUMENTS

## Current Team Context

- Project setup: @package.json or @requirements.txt or @Cargo.toml (detect tech stack)
- Existing docs: @docs/ or @README.md (if exists)
- Development tools: !`find . -name ".env*" -o -name "docker-compose.yml" -o -name "Makefile" | head -3`
- Team structure: @CODEOWNERS or @.github/ (if exists)
- CI/CD setup: !`find .github/workflows -name "*.yml" 2>/dev/null | head -3`

## Task

Create comprehensive onboarding experience tailored to role and project needs:

1. **Onboarding Requirements Analysis**
   - Analyze current team structure and skill requirements
   - Identify key knowledge areas and learning objectives
   - Assess current onboarding challenges and pain points
   - Define onboarding timeline and milestone expectations
   - Document role-specific requirements and responsibilities

2. **Development Environment Setup Guide**
   - Create comprehensive development environment setup instructions
   - Document required tools, software, and system requirements
   - Provide step-by-step installation and configuration guides
   - Create environment validation and troubleshooting procedures
   - Set up automated environment setup scripts and tools

3. **Project and Codebase Overview**
   - Create high-level project overview and business context
   - Document system architecture and technology stack
   - Provide codebase structure and organization guide
   - Create code navigation and exploration guidelines
   - Document key modules, libraries, and frameworks used

4. **Development Workflow Documentation**
   - Document version control workflows and branching strategies
   - Create code review process and quality standards guide
   - Document testing practices and requirements
   - Provide deployment and release process overview
   - Create issue tracking and project management workflow guide

5. **Team Communication and Collaboration**
   - Document team communication channels and protocols
   - Create meeting schedules and participation guidelines
   - Provide team contact information and org chart
   - Document collaboration tools and access procedures
   - Create escalation procedures and support contacts

6. **Learning Resources and Training Materials**
   - Curate learning resources for project-specific technologies
   - Create hands-on tutorials and coding exercises
   - Provide links to documentation, wikis, and knowledge bases
   - Create video tutorials and screen recordings
   - Set up mentoring and buddy system procedures

7. **First Tasks and Milestones**
   - Create progressive difficulty task assignments
   - Define learning milestones and checkpoints
   - Provide "good first issues" and starter projects
   - Create hands-on coding challenges and exercises
   - Set up pair programming and shadowing opportunities

8. **Security and Compliance Training**
   - Document security policies and access controls
   - Create data handling and privacy guidelines
   - Provide compliance training and certification requirements
   - Document incident response and security procedures
   - Create security best practices and guidelines

9. **Tools and Resources Access**
   - Document required accounts and access requests
   - Create tool-specific setup and usage guides
   - Provide license and subscription information
   - Document VPN and network access procedures
   - Create troubleshooting guides for common access issues

10. **Feedback and Continuous Improvement**
    - Create onboarding feedback collection process
    - Set up regular check-ins and progress reviews
    - Document common questions and FAQ section
    - Create onboarding metrics and success tracking
    - Establish onboarding guide maintenance and update procedures
    - Set up new hire success monitoring and support systems