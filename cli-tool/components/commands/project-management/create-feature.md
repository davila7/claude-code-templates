---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [feature-name] | [feature-type] [name]
description: Scaffold new feature with boilerplate code, tests, and documentation
model: sonnet
---

# Create Feature

Scaffold new feature: $ARGUMENTS

## Current Project Context

- Project structure: !`find . -maxdepth 2 -type d -name src -o -name components -o -name features | head -5`
- Current branch: !`git branch --show-current`
- Package info: @package.json or @Cargo.toml or @requirements.txt (if exists)
- Architecture docs: @docs/architecture.md or @README.md (if exists)

## Task

Follow this systematic approach to create a new feature: $ARGUMENTS

1. **Feature Planning**
   - Define the feature requirements and acceptance criteria
   - Break down the feature into smaller, manageable tasks
   - Identify affected components and potential impact areas
   - Plan the API/interface design before implementation

2. **Research and Analysis**
   - Study existing codebase patterns and conventions
   - Identify similar features for consistency
   - Research external dependencies or libraries needed
   - Review any relevant documentation or specifications

3. **Architecture Design**
   - Design the feature architecture and data flow
   - Plan database schema changes if needed
   - Define API endpoints and contracts
   - Consider scalability and performance implications

4. **Environment Setup**
   - Create a new feature branch: `git checkout -b feature/$ARGUMENTS`
   - Ensure development environment is up to date
   - Install any new dependencies required
   - Set up feature flags if applicable

5. **Implementation Strategy**
   - Start with core functionality and build incrementally
   - Follow the project's coding standards and patterns
   - Implement proper error handling and validation
   - Use dependency injection and maintain loose coupling

6. **Database Changes (if applicable)**
   - Create migration scripts for schema changes
   - Ensure backward compatibility
   - Plan for rollback scenarios
   - Test migrations on sample data

7. **API Development**
   - Implement API endpoints with proper HTTP status codes
   - Add request/response validation
   - Implement proper authentication and authorization
   - Document API contracts and examples

8. **Frontend Implementation (if applicable)**
   - Create reusable components following project patterns
   - Implement responsive design and accessibility
   - Add proper state management
   - Handle loading and error states

9. **Testing Implementation**
   - Write unit tests for core business logic
   - Create integration tests for API endpoints
   - Add end-to-end tests for user workflows
   - Test error scenarios and edge cases

10. **Security Considerations**
    - Implement proper input validation and sanitization
    - Add authorization checks for sensitive operations
    - Review for common security vulnerabilities
    - Ensure data protection and privacy compliance

11. **Performance Optimization**
    - Optimize database queries and indexes
    - Implement caching where appropriate
    - Monitor memory usage and optimize algorithms
    - Consider lazy loading and pagination

12. **Documentation**
    - Add inline code documentation and comments
    - Update API documentation
    - Create user documentation if needed
    - Update project README if applicable

13. **Code Review Preparation**
    - Run all tests and ensure they pass
    - Run linting and formatting tools
    - Check for code coverage and quality metrics
    - Perform self-review of the changes

14. **Integration Testing**
    - Test feature integration with existing functionality
    - Verify feature flags work correctly
    - Test deployment and rollback procedures
    - Validate monitoring and logging

15. **Commit and Push**
    - Create atomic commits with descriptive messages
    - Follow conventional commit format if project uses it
    - Push feature branch: `git push origin feature/$ARGUMENTS`

16. **Pull Request Creation**
    - Create PR with comprehensive description
    - Include screenshots or demos if applicable
    - Add appropriate labels and reviewers
    - Link to any related issues or specifications

17. **Quality Assurance**
    - Coordinate with QA team for testing
    - Address any bugs or issues found
    - Verify accessibility and usability requirements
    - Test on different environments and browsers

18. **Deployment Planning**
    - Plan feature rollout strategy
    - Set up monitoring and alerting
    - Prepare rollback procedures
    - Schedule deployment and communication

Remember to maintain code quality, follow project conventions, and prioritize user experience throughout the development process.