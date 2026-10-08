# ASP.NET Core Web API Project Configuration

This file provides specific guidance for ASP.NET Core Web API development using Claude Code.

## Project Overview

This is an ASP.NET Core Web API project optimized for building scalable REST APIs with automatic documentation, authentication, and cloud-ready deployment.

## ASP.NET Core API Specific Development Commands

### Project Management
- `dotnet new webapi -n MyApi` - Create new Web API project
- `dotnet run --launch-profile "Development"` - Start development server
- `dotnet watch run` - Start server with hot reload
- `dotnet run --urls "https://localhost:5001"` - Start on specific port

### API Development
- `dotnet add package Swashbuckle.AspNetCore` - Add Swagger/OpenAPI
- `dotnet add package Microsoft.AspNetCore.Authentication.JwtBearer` - Add JWT auth
- `dotnet add package Microsoft.AspNetCore.Mvc.Versioning` - Add API versioning
- `dotnet add package FluentValidation.AspNetCore` - Add input validation

### Database Integration
- `dotnet add package Microsoft.EntityFrameworkCore.SqlServer` - Add EF Core
- `dotnet add package Microsoft.EntityFrameworkCore.Tools` - Add EF tools
- `dotnet ef migrations add InitialApiSchema` - Create API migration
- `dotnet ef database update` - Apply migrations

### Testing
- `dotnet new xunit -n MyApi.Tests` - Create test project
- `dotnet add package Microsoft.AspNetCore.Mvc.Testing` - Add integration testing
- `dotnet test --collect:"XPlat Code Coverage"` - Run tests with coverage

## ASP.NET Core API Project Structure

```
MyApi/
├── Controllers/                # API controllers
│   ├── AuthController.cs      # Authentication endpoints
│   ├── UsersController.cs     # User management API
│   └── ProductsController.cs  # Product API endpoints
├── Models/                    # Data models and DTOs
│   ├── Entities/             # Database entities
│   │   ├── User.cs
│   │   └── Product.cs
│   ├── DTOs/                 # Data transfer objects
│   │   ├── UserDto.cs
│   │   ├── CreateUserRequest.cs
│   │   └── UpdateUserRequest.cs
│   └── Responses/            # API response models
│       ├── ApiResponse.cs
│       └── PagedResponse.cs
├── Services/                  # Business logic services
│   ├── Interfaces/           # Service interfaces
│   │   ├── IUserService.cs
│   │   └── IAuthService.cs
│   ├── UserService.cs
│   └── AuthService.cs
├── Repositories/             # Data access layer
│   ├── Interfaces/
│   │   └── IUserRepository.cs
│   └── UserRepository.cs
├── Data/                     # Database context and configuration
│   ├── ApiDbContext.cs
│   └── Configurations/
│       ├── UserConfiguration.cs
│       └── ProductConfiguration.cs
├── Middleware/               # Custom middleware
│   ├── ErrorHandlingMiddleware.cs
│   ├── RequestLoggingMiddleware.cs
│   └── RateLimitingMiddleware.cs
├── Authentication/           # Auth configuration
│   ├── JwtTokenService.cs
│   └── AuthPolicies.cs
├── Validators/              # Input validation
│   ├── CreateUserValidator.cs
│   └── UpdateUserValidator.cs
├── Extensions/              # Extension methods
│   ├── ServiceCollectionExtensions.cs
│   └── ApplicationBuilderExtensions.cs
├── Properties/
│   └── launchSettings.json
├── appsettings.json
├── appsettings.Development.json
├── appsettings.Production.json
├── Program.cs
└── MyApi.csproj
```

## API Controller Setup

```csharp
// Controllers/UsersController.cs
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[ApiVersion("1.0")]
[Authorize]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;
    private readonly ILogger<UsersController> _logger;

    public UsersController(IUserService userService, ILogger<UsersController> logger)
    {
        _userService = userService;
        _logger = logger;
    }

    /// <summary>
    /// Get all users with pagination
    /// </summary>
    /// <param name="pageNumber">Page number (default: 1)</param>
    /// <param name="pageSize">Page size (default: 10)</param>
    /// <returns>Paginated list of users</returns>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResponse<UserDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<PagedResponse<UserDto>>> GetUsers(
        [FromQuery] int pageNumber = 1, 
        [FromQuery] int pageSize = 10)
    {
        var users = await _userService.GetUsersAsync(pageNumber, pageSize);
        return Ok(users);
    }

    /// <summary>
    /// Get user by ID
    /// </summary>
    /// <param name="id">User ID</param>
    /// <returns>User details</returns>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ApiResponse<UserDto>>> GetUser(int id)
    {
        var user = await _userService.GetUserByIdAsync(id);
        if (user == null)
        {
            return NotFound(new ApiResponse<UserDto> 
            { 
                Success = false, 
                Message = "User not found" 
            });
        }

        return Ok(new ApiResponse<UserDto> 
        { 
            Success = true, 
            Data = user 
        });
    }

    /// <summary>
    /// Create a new user
    /// </summary>
    /// <param name="request">User creation request</param>
    /// <returns>Created user</returns>
    [HttpPost]
    [ProducesResponseType(typeof(ApiResponse<UserDto>), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ApiResponse<UserDto>>> CreateUser(
        [FromBody] CreateUserRequest request)
    {
        var user = await _userService.CreateUserAsync(request);
        return CreatedAtAction(nameof(GetUser), new { id = user.Id }, 
            new ApiResponse<UserDto> 
            { 
                Success = true, 
                Data = user 
            });
    }
}
```

## JWT Authentication Configuration

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

// Add JWT authentication
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(builder.Configuration["Jwt:SecretKey"])),
            ClockSkew = TimeSpan.Zero
        };
    });

// Add authorization policies
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminOnly", policy => 
        policy.RequireRole("Admin"));
    options.AddPolicy("UserOrAdmin", policy => 
        policy.RequireRole("User", "Admin"));
});

var app = builder.Build();

app.UseAuthentication();
app.UseAuthorization();
```

## API Documentation with Swagger

```csharp
// Program.cs - Swagger configuration
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Version = "v1",
        Title = "My API",
        Description = "An ASP.NET Core Web API for managing users and products",
        Contact = new OpenApiContact
        {
            Name = "API Support",
            Email = "support@myapi.com"
        }
    });

    // Add JWT authentication to Swagger
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
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
                }
            },
            Array.Empty<string>()
        }
    });

    // Include XML comments
    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    options.IncludeXmlComments(xmlPath);
});

// Configure Swagger UI
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "My API V1");
        options.RoutePrefix = string.Empty; // Serve at root
    });
}
```

## Input Validation with FluentValidation

```csharp
// Validators/CreateUserValidator.cs
public class CreateUserValidator : AbstractValidator<CreateUserRequest>
{
    public CreateUserValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("First name is required")
            .Length(2, 50).WithMessage("First name must be between 2 and 50 characters");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Last name is required")
            .Length(2, 50).WithMessage("Last name must be between 2 and 50 characters");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("Email is required")
            .EmailAddress().WithMessage("Invalid email format");

        RuleFor(x => x.Password)
            .NotEmpty().WithMessage("Password is required")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters")
            .Matches(@"^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]")
            .WithMessage("Password must contain uppercase, lowercase, number and special character");
    }
}

// Register FluentValidation
builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<CreateUserValidator>();
```

## Error Handling Middleware

```csharp
// Middleware/ErrorHandlingMiddleware.cs
public class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An unhandled exception occurred");
            await HandleExceptionAsync(context, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception exception)
    {
        context.Response.ContentType = "application/json";
        
        var response = new ApiResponse<object>
        {
            Success = false,
            Message = "An error occurred while processing your request"
        };

        switch (exception)
        {
            case ValidationException validationEx:
                context.Response.StatusCode = StatusCodes.Status400BadRequest;
                response.Message = "Validation failed";
                response.Errors = validationEx.Errors.Select(e => e.ErrorMessage).ToList();
                break;
            case UnauthorizedAccessException:
                context.Response.StatusCode = StatusCodes.Status401Unauthorized;
                response.Message = "Unauthorized access";
                break;
            case KeyNotFoundException:
                context.Response.StatusCode = StatusCodes.Status404NotFound;
                response.Message = "Resource not found";
                break;
            default:
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                break;
        }

        var jsonResponse = JsonSerializer.Serialize(response);
        await context.Response.WriteAsync(jsonResponse);
    }
}
```

## API Versioning

```csharp
// Program.cs - API Versioning
builder.Services.AddApiVersioning(options =>
{
    options.DefaultApiVersion = new ApiVersion(1, 0);
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ApiVersionReader = ApiVersionReader.Combine(
        new UrlSegmentApiVersionReader(),
        new HeaderApiVersionReader("X-Version"),
        new QueryStringApiVersionReader("version")
    );
});

builder.Services.AddVersionedApiExplorer(options =>
{
    options.GroupNameFormat = "'v'VVV";
    options.SubstituteApiVersionInUrl = true;
});
```

## Rate Limiting

```csharp
// Program.cs - Rate Limiting
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    
    options.AddFixedWindowLimiter("AuthPolicy", limiterOptions =>
    {
        limiterOptions.PermitLimit = 5;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
        limiterOptions.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        limiterOptions.QueueLimit = 2;
    });

    options.AddFixedWindowLimiter("GeneralPolicy", limiterOptions =>
    {
        limiterOptions.PermitLimit = 100;
        limiterOptions.Window = TimeSpan.FromMinutes(1);
    });
});

// Apply rate limiting
app.UseRateLimiter();

// In controllers
[EnableRateLimiting("AuthPolicy")]
[HttpPost("login")]
public async Task<IActionResult> Login([FromBody] LoginRequest request)
{
    // Implementation
}
```

## CORS Configuration

```csharp
// Program.cs - CORS
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowSpecificOrigins", policy =>
    {
        policy.WithOrigins("https://myapp.com", "https://admin.myapp.com")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });

    options.AddPolicy("DevelopmentPolicy", policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

// Apply CORS
if (app.Environment.IsDevelopment())
{
    app.UseCors("DevelopmentPolicy");
}
else
{
    app.UseCors("AllowSpecificOrigins");
}
```

## Health Checks

```csharp
// Program.cs - Health Checks
builder.Services.AddHealthChecks()
    .AddDbContext<ApiDbContext>()
    .AddUrlGroup(new Uri("https://external-api.com/health"), "external-api")
    .AddSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));

// Health check endpoints
app.MapHealthChecks("/health", new HealthCheckOptions
{
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false,
    ResponseWriter = UIResponseWriter.WriteHealthCheckUIResponse
});
```

## Testing Strategy

### Integration Testing Setup
```csharp
// Tests/IntegrationTests/UsersControllerTests.cs
public class UsersControllerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly HttpClient _client;

    public UsersControllerTests(WebApplicationFactory<Program> factory)
    {
        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // Replace database with in-memory database
                services.RemoveAll(typeof(DbContextOptions<ApiDbContext>));
                services.AddDbContext<ApiDbContext>(options =>
                {
                    options.UseInMemoryDatabase("TestDb");
                });
            });
        });
        
        _client = _factory.CreateClient();
    }

    [Fact]
    public async Task GetUsers_ReturnsSuccessStatusCode()
    {
        // Arrange
        var token = await GetValidJwtTokenAsync();
        _client.DefaultRequestHeaders.Authorization = 
            new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await _client.GetAsync("/api/v1/users");

        // Assert
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<PagedResponse<UserDto>>(content);
        
        Assert.NotNull(result);
        Assert.True(result.Success);
    }
}
```

### Unit Testing
```csharp
// Tests/UnitTests/UserServiceTests.cs
public class UserServiceTests
{
    private readonly Mock<IUserRepository> _mockRepository;
    private readonly Mock<ILogger<UserService>> _mockLogger;
    private readonly UserService _userService;

    public UserServiceTests()
    {
        _mockRepository = new Mock<IUserRepository>();
        _mockLogger = new Mock<ILogger<UserService>>();
        _userService = new UserService(_mockRepository.Object, _mockLogger.Object);
    }

    [Fact]
    public async Task GetUserByIdAsync_WithValidId_ReturnsUser()
    {
        // Arrange
        var userId = 1;
        var expectedUser = new User { Id = userId, FirstName = "John", LastName = "Doe" };
        _mockRepository.Setup(r => r.GetByIdAsync(userId))
                      .ReturnsAsync(expectedUser);

        // Act
        var result = await _userService.GetUserByIdAsync(userId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(expectedUser.Id, result.Id);
        Assert.Equal(expectedUser.FirstName, result.FirstName);
    }
}
```

## Deployment Considerations

### Production Configuration
```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Warning",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "myapi.com,*.myapi.com",
  "ConnectionStrings": {
    "DefaultConnection": "Server=prod-server;Database=MyApi;User Id=api_user;Password=secure_password;"
  },
  "Jwt": {
    "Issuer": "MyApi",
    "Audience": "MyApi-Users",
    "SecretKey": "production-secret-key-256-bits-long"
  },
  "Kestrel": {
    "Limits": {
      "MaxConcurrentConnections": 100,
      "MaxRequestBodySize": 10485760
    }
  }
}
```

### Docker Configuration
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["MyApi.csproj", "./"]
RUN dotnet restore "MyApi.csproj"
COPY . .
RUN dotnet build "MyApi.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "MyApi.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MyApi.dll"]
```

## Best Practices

### API Design
- Use RESTful conventions for endpoint naming
- Implement proper HTTP status codes
- Use consistent response formats
- Add comprehensive API documentation
- Implement proper error handling and validation

### Security
- Always use HTTPS in production
- Implement proper authentication and authorization
- Validate all inputs and sanitize outputs
- Use rate limiting to prevent abuse
- Implement CORS policies appropriately

### Performance
- Use async/await for all I/O operations
- Implement response caching where appropriate
- Use pagination for large data sets
- Optimize database queries
- Monitor performance metrics

### Monitoring
- Implement comprehensive logging
- Add health checks for dependencies
- Monitor API performance and usage
- Set up alerting for critical issues
- Use Application Performance Monitoring (APM) tools