---
allowed-tools: Read, Write, Edit, Bash
argument-hint: [api-type] | --openapi | --graphql | --rest | --grpc | --interactive
description: Generate comprehensive API documentation from code with interactive examples and testing capabilities
---

# API Documentation Generator

Generate API documentation from code: $ARGUMENTS

## Current API Context

- API endpoints: !`find . -name "*route*" -o -name "*controller*" -o -name "*api*" | head -5`
- API specs: !`find . -name "*openapi*" -o -name "*swagger*" -o -name "*.graphql" | head -3`
- Server framework: @package.json or detect from imports
- Existing docs: @docs/api/ or @api-docs/ (if exists)
- Test files: !`find . -name "*test*" -path "*/api/*" | head -3`

## Task

Generate comprehensive API documentation with interactive features: $ARGUMENTS

1. **Code Analysis and Discovery**
   - Scan the codebase for API endpoints, routes, and handlers
   - Identify REST APIs, GraphQL schemas, and RPC services
   - Map out controller classes, route definitions, and middleware
   - Discover request/response models and data structures

2. **Documentation Tool Selection**
   - Choose appropriate documentation tools based on stack:
     - **OpenAPI/Swagger**: REST APIs with interactive documentation
     - **GraphQL**: GraphiQL, GraphQL Playground, or Apollo Studio
     - **Postman**: API collections and documentation
     - **Insomnia**: API design and documentation
     - **Redoc**: Alternative OpenAPI renderer
     - **API Blueprint**: Markdown-based API documentation

3. **API Specification Generation**
   
   **For REST APIs with OpenAPI:**
   ```yaml
   openapi: 3.0.0
   info:
     title: $ARGUMENTS API
     version: 1.0.0
     description: Comprehensive API for $ARGUMENTS
   servers:
     - url: https://api.example.com/v1
   paths:
     /users:
       get:
         summary: List users
         parameters:
           - name: page
             in: query
             schema:
               type: integer
         responses:
           '200':
             description: Successful response
             content:
               application/json:
                 schema:
                   type: array
                   items:
                     $ref: '#/components/schemas/User'
   components:
     schemas:
       User:
         type: object
         properties:
           id:
             type: integer
           name:
             type: string
           email:
             type: string
   ```

4. **Endpoint Documentation**
   - Document all HTTP methods (GET, POST, PUT, DELETE, PATCH)
   - Specify request parameters (path, query, header, body)
   - Define response schemas and status codes
   - Include error responses and error codes
   - Document authentication and authorization requirements

5. **Request/Response Examples**
   - Provide realistic request examples for each endpoint
   - Include sample response data with proper formatting
   - Show different response scenarios (success, error, edge cases)
   - Document content types and encoding

6. **Authentication Documentation**
   - Document authentication methods (API keys, JWT, OAuth)
   - Explain authorization scopes and permissions
   - Provide authentication examples and token formats
   - Document session management and refresh token flows

7. **Data Model Documentation**
   - Define all data schemas and models
   - Document field types, constraints, and validation rules
   - Include relationships between entities
   - Provide example data structures

8. **Error Handling Documentation**
   - Document all possible error responses
   - Explain error codes and their meanings
   - Provide troubleshooting guidance
   - Include rate limiting and throttling information

9. **Interactive Documentation Setup**
   
   **Swagger UI Integration:**
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <title>API Documentation</title>
     <link rel="stylesheet" type="text/css" href="./swagger-ui-bundle.css" />
   </head>
   <body>
     <div id="swagger-ui"></div>
     <script src="./swagger-ui-bundle.js"></script>
     <script>
       SwaggerUIBundle({
         url: './api-spec.yaml',
         dom_id: '#swagger-ui'
       });
     </script>
   </body>
   </html>
   ```

10. **Code Annotation and Comments**
    - Add inline documentation to API handlers
    - Use framework-specific annotation tools:
      - **Java**: @ApiOperation, @ApiParam (Swagger annotations)
      - **Python**: Docstrings with FastAPI or Flask-RESTX
      - **Node.js**: JSDoc comments with swagger-jsdoc
      - **C#**: XML documentation comments

11. **Automated Documentation Generation**
    
    **For Node.js/Express:**
    ```javascript
    const swaggerJsdoc = require('swagger-jsdoc');
    const swaggerUi = require('swagger-ui-express');
    
    const options = {
      definition: {
        openapi: '3.0.0',
        info: {
          title: 'API Documentation',
          version: '1.0.0',
        },
      },
      apis: ['./routes/*.js'],
    };
    
    const specs = swaggerJsdoc(options);
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
    ```

12. **Testing Integration**
    - Generate API test collections from documentation
    - Include test scripts and validation rules
    - Set up automated API testing
    - Document test scenarios and expected outcomes

13. **Version Management**
    - Document API versioning strategy
    - Maintain documentation for multiple API versions
    - Document deprecation timelines and migration guides
    - Track breaking changes between versions

14. **Performance Documentation**
    - Document rate limits and throttling policies
    - Include performance benchmarks and SLAs
    - Document caching strategies and headers
    - Explain pagination and filtering options

15. **SDK and Client Library Documentation**
    - Generate client libraries from API specifications
    - Document SDK usage and examples
    - Provide quickstart guides for different languages
    - Include integration examples and best practices

16. **Environment-Specific Documentation**
    - Document different environments (dev, staging, prod)
    - Include environment-specific endpoints and configurations
    - Document deployment and configuration requirements
    - Provide environment setup instructions

17. **Security Documentation**
    - Document security best practices
    - Include CORS and CSP policies
    - Document input validation and sanitization
    - Explain security headers and their purposes

18. **Maintenance and Updates**
    - Set up automated documentation updates
    - Create processes for keeping documentation current
    - Review and validate documentation regularly
    - Integrate documentation reviews into development workflow

**Framework-Specific Examples:**

**FastAPI (Python):**
```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI(title="My API", version="1.0.0")

class User(BaseModel):
    id: int
    name: str
    email: str

@app.get("/users/{user_id}", response_model=User)
async def get_user(user_id: int):
    """Get a user by ID."""
    return {"id": user_id, "name": "John", "email": "john@example.com"}
```

**Spring Boot (Java):**
```java
@RestController
@Api(tags = "Users")
public class UserController {
    
    @GetMapping("/users/{id}")
    @ApiOperation(value = "Get user by ID")
    public ResponseEntity<User> getUser(
        @PathVariable @ApiParam("User ID") Long id) {
        // Implementation
    }
}
```

Remember to keep documentation up-to-date with code changes and make it easily accessible to both internal teams and external consumers.