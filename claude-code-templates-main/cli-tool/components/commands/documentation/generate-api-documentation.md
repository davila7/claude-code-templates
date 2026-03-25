---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [output-format] | --swagger-ui | --redoc | --postman | --insomnia | --multi-format
description: Auto-generate API reference documentation with multiple output formats and automated deployment
---

# Automated API Documentation Generator

Auto-generate API reference documentation: $ARGUMENTS

## Current API Infrastructure

- Code annotations: !`grep -r "@api\|@swagger\|@doc" src/ 2>/dev/null | wc -l` annotations found
- API framework: @package.json or detect from imports
- Existing specs: !`find . -name "*spec*.yaml" -o -name "*spec*.json" | head -3`
- Documentation tools: !`grep -E "swagger|redoc|postman" package.json 2>/dev/null || echo "None detected"`
- CI/CD pipeline: @.github/workflows/ (if exists)

## Task

Setup automated API documentation generation with modern tooling:

1. **API Documentation Strategy Analysis**
   - Analyze current API structure and endpoints
   - Identify documentation requirements (REST, GraphQL, gRPC, etc.)
   - Assess existing code annotations and documentation
   - Determine documentation output formats and hosting requirements
   - Plan documentation automation and maintenance strategy

2. **Documentation Tool Selection**
   - Choose appropriate API documentation tools:
     - **OpenAPI/Swagger**: REST API documentation with Swagger UI
     - **Redoc**: Modern OpenAPI documentation renderer
     - **GraphQL**: GraphiQL, Apollo Studio, GraphQL Playground
     - **Postman**: API documentation with collections
     - **Insomnia**: API documentation and testing
     - **API Blueprint**: Markdown-based API documentation
     - **JSDoc/TSDoc**: Code-first documentation generation
   - Consider factors: API type, team workflow, hosting, interactivity

3. **Code Annotation and Schema Definition**
   - Add comprehensive code annotations for API endpoints
   - Define request/response schemas and data models
   - Add parameter descriptions and validation rules
   - Document authentication and authorization requirements
   - Add example requests and responses

4. **API Specification Generation**
   - Set up automated API specification generation from code
   - Configure OpenAPI/Swagger specification generation
   - Set up schema validation and consistency checking
   - Configure API versioning and changelog generation
   - Set up specification file management and version control

5. **Interactive Documentation Setup**
   - Configure interactive API documentation with try-it-out functionality
   - Set up API testing and example execution
   - Configure authentication handling in documentation
   - Set up request/response validation and examples
   - Configure API endpoint categorization and organization

6. **Documentation Content Enhancement**
   - Add comprehensive API guides and tutorials
   - Create authentication and authorization documentation
   - Add error handling and status code documentation
   - Create SDK and client library documentation
   - Add rate limiting and usage guidelines

7. **Documentation Hosting and Deployment**
   - Set up documentation hosting and deployment
   - Configure documentation website generation and styling
   - Set up custom domain and SSL configuration
   - Configure documentation search and navigation
   - Set up documentation analytics and usage tracking

8. **Automation and CI/CD Integration**
   - Configure automated documentation generation in CI/CD pipeline
   - Set up documentation deployment automation
   - Configure documentation validation and quality checks
   - Set up documentation change detection and notifications
   - Configure documentation testing and link validation

9. **Multi-format Documentation Generation**
   - Generate documentation in multiple formats (HTML, PDF, Markdown)
   - Set up downloadable documentation packages
   - Configure offline documentation access
   - Set up documentation API for programmatic access
   - Configure documentation syndication and distribution

10. **Maintenance and Quality Assurance**
    - Set up documentation quality monitoring and validation
    - Configure documentation feedback and improvement workflows
    - Set up documentation analytics and usage metrics
    - Create documentation maintenance procedures and guidelines
    - Train team on documentation best practices and tools
    - Set up documentation review and approval processes