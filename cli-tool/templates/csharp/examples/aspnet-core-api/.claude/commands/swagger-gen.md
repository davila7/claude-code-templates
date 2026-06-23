# Swagger Documentation Generation

Comprehensive API documentation generation using Swagger/OpenAPI for ASP.NET Core Web APIs.

## Purpose

This command sets up and configures Swagger/OpenAPI documentation for your API, including authentication, versioning, and custom documentation features.

## Usage

```
/swagger-gen
```

## What this command does

1. **Configures Swagger/OpenAPI** with comprehensive documentation
2. **Sets up authentication** integration with JWT Bearer tokens
3. **Implements API versioning** support in documentation
4. **Generates interactive API explorer** with try-it-out functionality
5. **Customizes documentation** with examples, descriptions, and schemas

## Example Commands

### Basic Swagger Setup
```bash
# Add Swagger packages
dotnet add package Swashbuckle.AspNetCore
dotnet add package Swashbuckle.AspNetCore.Annotations

# Generate XML documentation
dotnet build -p:GenerateDocumentationFile=true

# Run application and view Swagger UI
dotnet run
# Navigate to https://localhost:5001/swagger
```

### Advanced Swagger Configuration
```csharp
// Program.cs - Comprehensive Swagger setup
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    // API Information
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Version = "v1",
        Title = "My API",
        Description = "A comprehensive ASP.NET Core Web API for managing users and products",
        TermsOfService = new Uri("https://myapi.com/terms"),
        Contact = new OpenApiContact
        {
            Name = "API Support Team",
            Email = "support@myapi.com",
            Url = new Uri("https://myapi.com/contact")
        },
        License = new OpenApiLicense
        {
            Name = "MIT License",
            Url = new Uri("https://opensource.org/licenses/MIT")
        }
    });

    // Multiple API versions
    options.SwaggerDoc("v2", new OpenApiInfo
    {
        Version = "v2",
        Title = "My API v2",
        Description = "Version 2 of the API with enhanced features"
    });

    // JWT Authentication
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = @"JWT Authorization header using the Bearer scheme. 
                      Enter 'Bearer' [space] and then your token in the text input below.
                      Example: 'Bearer 12345abcdef'",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                },
                Scheme = "oauth2",
                Name = "Bearer",
                In = ParameterLocation.Header
            },
            new List<string>()
        }
    });

    // XML Comments
    var xmlFile = $"{Assembly.GetExecutingSchemaName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath);
    }

    // Enable annotations
    options.EnableAnnotations();

    // Custom schema IDs
    options.CustomSchemaIds(type => type.FullName?.Replace("+", "."));

    // Add examples
    options.SchemaFilter<ExampleSchemaFilter>();
    options.OperationFilter<ExampleOperationFilter>();

    // Group endpoints by tags
    options.TagActionsBy(api => new[] { api.GroupName ?? api.ActionDescriptor.RouteValues["controller"] });
    options.DocInclusionPredicate((name, api) => true);
});

// Configure Swagger UI
if (app.Environment.IsDevelopment() || app.Environment.IsStaging())
{
    app.UseSwagger(options =>
    {
        options.RouteTemplate = "api-docs/{documentName}/swagger.json";
    });

    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/api-docs/v1/swagger.json", "My API V1");
        options.SwaggerEndpoint("/api-docs/v2/swagger.json", "My API V2");
        
        options.RoutePrefix = "api-docs"; // Serve at /api-docs
        options.DocumentTitle = "My API Documentation";
        
        // UI Customization
        options.DefaultModelsExpandDepth(2);
        options.DefaultModelExpandDepth(2);
        options.DocExpansion(DocExpansion.None);
        options.EnableDeepLinking();
        options.DisplayOperationId();
        options.DisplayRequestDuration();
        
        // Try it out functionality
        options.EnableTryItOutByDefault();
        
        // Custom CSS and JavaScript
        options.InjectStylesheet("/swagger-ui/custom.css");
        options.InjectJavaScript("/swagger-ui/custom.js");
    });
}
```

## Controller Documentation

### Comprehensive Controller Documentation
```csharp
/// <summary>
/// User management endpoints
/// </summary>
/// <remarks>
/// This controller provides CRUD operations for user management.
/// All endpoints require authentication except for user registration.
/// </remarks>
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[ApiVersion("1.0")]
[Produces("application/json")]
[Consumes("application/json")]
[Tags("Users")]
public class UsersController : ControllerBase
{
    /// <summary>
    /// Retrieves a paginated list of users
    /// </summary>
    /// <param name="pageNumber">The page number to retrieve (default: 1)</param>
    /// <param name="pageSize">The number of items per page (default: 10, max: 100)</param>
    /// <param name="searchTerm">Optional search term to filter users by name or email</param>
    /// <returns>A paginated list of users</returns>
    /// <response code="200">Returns the paginated list of users</response>
    /// <response code="400">Invalid pagination parameters</response>
    /// <response code="401">Unauthorized - valid JWT token required</response>
    /// <response code="403">Forbidden - insufficient permissions</response>
    /// <remarks>
    /// Sample request:
    /// 
    ///     GET /api/v1/users?pageNumber=1&amp;pageSize=10&amp;searchTerm=john
    /// 
    /// This endpoint supports pagination and search functionality.
    /// The search term will match against first name, last name, and email fields.
    /// </remarks>
    [HttpGet]
    [Authorize]
    [SwaggerOperation(
        Summary = "Get paginated users",
        Description = "Retrieves a paginated list of users with optional search functionality",
        OperationId = "GetUsers",
        Tags = new[] { "Users" }
    )]
    [ProducesResponseType(typeof(PagedResponse<UserDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public async Task<ActionResult<PagedResponse<UserDto>>> GetUsers(
        [FromQuery, Range(1, int.MaxValue)] int pageNumber = 1,
        [FromQuery, Range(1, 100)] int pageSize = 10,
        [FromQuery] string? searchTerm = null)
    {
        var users = await _userService.GetUsersAsync(pageNumber, pageSize, searchTerm);
        return Ok(users);
    }

    /// <summary>
    /// Retrieves a specific user by ID
    /// </summary>
    /// <param name="id">The unique identifier of the user</param>
    /// <returns>The user details</returns>
    /// <response code="200">Returns the user details</response>
    /// <response code="404">User not found</response>
    /// <response code="401">Unauthorized - valid JWT token required</response>
    [HttpGet("{id:int}")]
    [Authorize]
    [SwaggerOperation(
        Summary = "Get user by ID",
        Description = "Retrieves detailed information about a specific user",
        OperationId = "GetUserById"
    )]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ApiResponse<UserDto>>> GetUser(
        [FromRoute] int id)
    {
        var user = await _userService.GetUserByIdAsync(id);
        if (user == null)
        {
            return NotFound(new ApiResponse<object>
            {
                Success = false,
                Message = $"User with ID {id} not found"
            });
        }

        return Ok(new ApiResponse<UserDto>
        {
            Success = true,
            Data = user,
            Message = "User retrieved successfully"
        });
    }

    /// <summary>
    /// Creates a new user
    /// </summary>
    /// <param name="request">The user creation request</param>
    /// <returns>The created user</returns>
    /// <response code="201">User created successfully</response>
    /// <response code="400">Invalid request data or validation errors</response>
    /// <response code="409">User with the same email already exists</response>
    /// <response code="401">Unauthorized - valid JWT token required</response>
    /// <remarks>
    /// Sample request:
    /// 
    ///     POST /api/v1/users
    ///     {
    ///         "firstName": "John",
    ///         "lastName": "Doe",
    ///         "email": "john.doe@example.com",
    ///         "password": "SecurePassword123!",
    ///         "dateOfBirth": "1990-01-01",
    ///         "phoneNumber": "+1234567890"
    ///     }
    /// 
    /// Password requirements:
    /// - Minimum 8 characters
    /// - At least one uppercase letter
    /// - At least one lowercase letter
    /// - At least one digit
    /// - At least one special character
    /// </remarks>
    [HttpPost]
    [Authorize]
    [SwaggerOperation(
        Summary = "Create new user",
        Description = "Creates a new user account with the provided information",
        OperationId = "CreateUser"
    )]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiResponse<object>), StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<ApiResponse<UserDto>>> CreateUser(
        [FromBody] CreateUserRequest request)
    {
        try
        {
            var user = await _userService.CreateUserAsync(request);
            return CreatedAtAction(
                nameof(GetUser),
                new { id = user.Id },
                new ApiResponse<UserDto>
                {
                    Success = true,
                    Data = user,
                    Message = "User created successfully"
                });
        }
        catch (EmailAlreadyExistsException)
        {
            return Conflict(new ApiResponse<object>
            {
                Success = false,
                Message = "A user with this email address already exists"
            });
        }
    }
}
```

## Data Models Documentation

### Request/Response Models with Examples
```csharp
/// <summary>
/// Request model for creating a new user
/// </summary>
/// <example>
/// {
///   "firstName": "John",
///   "lastName": "Doe",
///   "email": "john.doe@example.com",
///   "password": "SecurePassword123!",
///   "dateOfBirth": "1990-01-01",
///   "phoneNumber": "+1234567890"
/// }
/// </example>
[SwaggerSchema(
    Description = "Request model for creating a new user account",
    Example = typeof(CreateUserRequestExample)
)]
public class CreateUserRequest
{
    /// <summary>
    /// User's first name
    /// </summary>
    /// <example>John</example>
    [Required(ErrorMessage = "First name is required")]
    [StringLength(50, MinimumLength = 2, ErrorMessage = "First name must be between 2 and 50 characters")]
    [SwaggerSchema(Description = "The user's first name", Format = "string")]
    public string FirstName { get; set; } = string.Empty;

    /// <summary>
    /// User's last name
    /// </summary>
    /// <example>Doe</example>
    [Required(ErrorMessage = "Last name is required")]
    [StringLength(50, MinimumLength = 2, ErrorMessage = "Last name must be between 2 and 50 characters")]
    public string LastName { get; set; } = string.Empty;

    /// <summary>
    /// User's email address (must be unique)
    /// </summary>
    /// <example>john.doe@example.com</example>
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email format")]
    [StringLength(100, ErrorMessage = "Email cannot exceed 100 characters")]
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// User's password
    /// </summary>
    /// <example>SecurePassword123!</example>
    [Required(ErrorMessage = "Password is required")]
    [StringLength(100, MinimumLength = 8, ErrorMessage = "Password must be between 8 and 100 characters")]
    [RegularExpression(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]",
        ErrorMessage = "Password must contain at least one uppercase letter, one lowercase letter, one digit, and one special character")]
    public string Password { get; set; } = string.Empty;

    /// <summary>
    /// User's date of birth
    /// </summary>
    /// <example>1990-01-01</example>
    [Required(ErrorMessage = "Date of birth is required")]
    [DataType(DataType.Date)]
    public DateTime DateOfBirth { get; set; }

    /// <summary>
    /// User's phone number (optional)
    /// </summary>
    /// <example>+1234567890</example>
    [Phone(ErrorMessage = "Invalid phone number format")]
    [StringLength(20, ErrorMessage = "Phone number cannot exceed 20 characters")]
    public string? PhoneNumber { get; set; }
}

/// <summary>
/// User data transfer object
/// </summary>
[SwaggerSchema(Description = "User information returned by the API")]
public class UserDto
{
    /// <summary>
    /// Unique identifier for the user
    /// </summary>
    /// <example>123</example>
    public int Id { get; set; }

    /// <summary>
    /// User's first name
    /// </summary>
    /// <example>John</example>
    public string FirstName { get; set; } = string.Empty;

    /// <summary>
    /// User's last name
    /// </summary>
    /// <example>Doe</example>
    public string LastName { get; set; } = string.Empty;

    /// <summary>
    /// User's full name
    /// </summary>
    /// <example>John Doe</example>
    public string FullName => $"{FirstName} {LastName}";

    /// <summary>
    /// User's email address
    /// </summary>
    /// <example>john.doe@example.com</example>
    public string Email { get; set; } = string.Empty;

    /// <summary>
    /// User's date of birth
    /// </summary>
    /// <example>1990-01-01</example>
    public DateTime DateOfBirth { get; set; }

    /// <summary>
    /// User's phone number
    /// </summary>
    /// <example>+1234567890</example>
    public string? PhoneNumber { get; set; }

    /// <summary>
    /// Date when the user account was created
    /// </summary>
    /// <example>2023-01-01T10:00:00Z</example>
    public DateTime CreatedAt { get; set; }

    /// <summary>
    /// Date when the user account was last updated
    /// </summary>
    /// <example>2023-06-01T15:30:00Z</example>
    public DateTime UpdatedAt { get; set; }
}
```

## Custom Schema Filters

### Example Schema Filter
```csharp
public class ExampleSchemaFilter : ISchemaFilter
{
    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        if (context.Type == typeof(CreateUserRequest))
        {
            schema.Example = new OpenApiObject
            {
                ["firstName"] = new OpenApiString("John"),
                ["lastName"] = new OpenApiString("Doe"),
                ["email"] = new OpenApiString("john.doe@example.com"),
                ["password"] = new OpenApiString("SecurePassword123!"),
                ["dateOfBirth"] = new OpenApiString("1990-01-01"),
                ["phoneNumber"] = new OpenApiString("+1234567890")
            };
        }
        else if (context.Type == typeof(UserDto))
        {
            schema.Example = new OpenApiObject
            {
                ["id"] = new OpenApiInteger(123),
                ["firstName"] = new OpenApiString("John"),
                ["lastName"] = new OpenApiString("Doe"),
                ["fullName"] = new OpenApiString("John Doe"),
                ["email"] = new OpenApiString("john.doe@example.com"),
                ["dateOfBirth"] = new OpenApiString("1990-01-01"),
                ["phoneNumber"] = new OpenApiString("+1234567890"),
                ["createdAt"] = new OpenApiString("2023-01-01T10:00:00Z"),
                ["updatedAt"] = new OpenApiString("2023-06-01T15:30:00Z")
            };
        }
    }
}
```

### Operation Filter for Headers
```csharp
public class ExampleOperationFilter : IOperationFilter
{
    public void Apply(OpenApiOperation operation, OperationFilterContext context)
    {
        // Add common response headers
        foreach (var response in operation.Responses.Values)
        {
            response.Headers ??= new Dictionary<string, OpenApiHeader>();
            
            if (!response.Headers.ContainsKey("X-Request-ID"))
            {
                response.Headers.Add("X-Request-ID", new OpenApiHeader
                {
                    Description = "Unique request identifier for tracking",
                    Schema = new OpenApiSchema { Type = "string" },
                    Example = new OpenApiString("550e8400-e29b-41d4-a716-446655440000")
                });
            }

            if (!response.Headers.ContainsKey("X-Response-Time"))
            {
                response.Headers.Add("X-Response-Time", new OpenApiHeader
                {
                    Description = "Response time in milliseconds",
                    Schema = new OpenApiSchema { Type = "string" },
                    Example = new OpenApiString("123ms")
                });
            }
        }

        // Add examples for POST/PUT operations
        if (operation.RequestBody?.Content != null)
        {
            foreach (var content in operation.RequestBody.Content.Values)
            {
                if (content.Schema?.Reference?.Id == "CreateUserRequest")
                {
                    content.Examples = new Dictionary<string, OpenApiExample>
                    {
                        ["example1"] = new OpenApiExample
                        {
                            Summary = "Standard user creation",
                            Description = "Example of creating a regular user account",
                            Value = new OpenApiObject
                            {
                                ["firstName"] = new OpenApiString("John"),
                                ["lastName"] = new OpenApiString("Doe"),
                                ["email"] = new OpenApiString("john.doe@example.com"),
                                ["password"] = new OpenApiString("SecurePassword123!"),
                                ["dateOfBirth"] = new OpenApiString("1990-01-01"),
                                ["phoneNumber"] = new OpenApiString("+1234567890")
                            }
                        },
                        ["example2"] = new OpenApiExample
                        {
                            Summary = "Minimal user creation",
                            Description = "Creating a user with only required fields",
                            Value = new OpenApiObject
                            {
                                ["firstName"] = new OpenApiString("Jane"),
                                ["lastName"] = new OpenApiString("Smith"),
                                ["email"] = new OpenApiString("jane.smith@example.com"),
                                ["password"] = new OpenApiString("AnotherSecure123!"),
                                ["dateOfBirth"] = new OpenApiString("1985-05-15")
                            }
                        }
                    };
                }
            }
        }
    }
}
```

## API Versioning Documentation

### Version-Specific Documentation
```csharp
// Program.cs - Multiple API versions
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ApiVersionReader = ApiVersionReader.Combine(
        new UrlSegmentApiVersionReader(),
        new HeaderApiVersionReader("X-Api-Version"),
        new QueryStringApiVersionReader("version")
    );
});

builder.Services.AddVersionedApiExplorer(options =>
{
    options.GroupNameFormat = "'v'VVV";
    options.SubstituteApiVersionInUrl = true;
});

// Configure Swagger for multiple versions
builder.Services.ConfigureOptions<ConfigureSwaggerOptions>();

public class ConfigureSwaggerOptions : IConfigureOptions<SwaggerGenOptions>
{
    private readonly IApiVersionDescriptionProvider _provider;

    public ConfigureSwaggerOptions(IApiVersionDescriptionProvider provider)
    {
        _provider = provider;
    }

    public void Configure(SwaggerGenOptions options)
    {
        foreach (var description in _provider.ApiVersionDescriptions)
        {
            options.SwaggerDoc(description.GroupName, new OpenApiInfo
            {
                Title = "My API",
                Version = description.ApiVersion.ToString(),
                Description = description.IsDeprecated ? " - DEPRECATED" : string.Empty
            });
        }
    }
}
```

## Custom UI Styling

### Custom CSS
```css
/* wwwroot/swagger-ui/custom.css */
.swagger-ui .topbar {
    background-color: #2c3e50;
}

.swagger-ui .topbar .download-url-wrapper {
    display: none;
}

.swagger-ui .info {
    margin: 50px 0;
}

.swagger-ui .info .title {
    color: #2c3e50;
}

.swagger-ui .scheme-container {
    background: #f8f9fa;
    border: 1px solid #dee2e6;
}

.swagger-ui .opblock.opblock-post {
    border-color: #28a745;
    background: rgba(40, 167, 69, 0.1);
}

.swagger-ui .opblock.opblock-get {
    border-color: #007bff;
    background: rgba(0, 123, 255, 0.1);
}

.swagger-ui .opblock.opblock-put {
    border-color: #ffc107;
    background: rgba(255, 193, 7, 0.1);
}

.swagger-ui .opblock.opblock-delete {
    border-color: #dc3545;
    background: rgba(220, 53, 69, 0.1);
}
```

### Custom JavaScript
```javascript
// wwwroot/swagger-ui/custom.js
window.onload = function() {
    // Add custom header
    const topbar = document.querySelector('.topbar');
    if (topbar) {
        topbar.innerHTML = '<div class="wrapper"><div class="topbar-wrapper"><span>My API Documentation</span></div></div>';
    }

    // Add authentication helper
    const authButton = document.createElement('button');
    authButton.textContent = 'Quick Auth';
    authButton.className = 'btn authorize';
    authButton.onclick = function() {
        // Pre-fill with demo token for development
        const authModal = document.querySelector('.auth-container');
        if (authModal) {
            const tokenInput = authModal.querySelector('input[type="text"]');
            if (tokenInput) {
                tokenInput.value = 'Bearer demo-jwt-token-for-testing';
            }
        }
    };

    const wrapper = document.querySelector('.wrapper');
    if (wrapper) {
        wrapper.appendChild(authButton);
    }
};
```

## Export and Generation Commands

### Generate OpenAPI Spec
```bash
# Install Swashbuckle CLI tool
dotnet tool install -g Swashbuckle.AspNetCore.Cli

# Generate OpenAPI specification
dotnet swagger tofile --output swagger.json MyApi.dll v1

# Generate for multiple versions
dotnet swagger tofile --output swagger-v1.json MyApi.dll v1
dotnet swagger tofile --output swagger-v2.json MyApi.dll v2

# Generate YAML format
dotnet swagger tofile --yaml --output swagger.yaml MyApi.dll v1
```

### Generate Client SDKs
```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate C# client
openapi-generator-cli generate -i swagger.json -g csharp -o ./clients/csharp

# Generate TypeScript client
openapi-generator-cli generate -i swagger.json -g typescript-fetch -o ./clients/typescript

# Generate Python client
openapi-generator-cli generate -i swagger.json -g python -o ./clients/python
```

## Best Practices

### Documentation Quality
- Write clear, comprehensive summaries and descriptions
- Include practical examples for all request/response models
- Document all possible response codes and scenarios
- Use consistent terminology and naming conventions
- Keep documentation up-to-date with code changes

### Security Documentation
- Document authentication requirements clearly
- Explain authorization levels and permissions
- Include security considerations in remarks
- Document rate limiting and usage restrictions
- Provide clear error messages and troubleshooting guides

### User Experience
- Organize endpoints logically with tags
- Provide realistic examples and test data
- Include troubleshooting information
- Make the documentation accessible and searchable
- Consider different user personas (developers, testers, business users)