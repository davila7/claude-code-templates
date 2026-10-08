# C#/.NET Core Project Configuration

This file provides specific guidance for C#/.NET Core development using Claude Code.

## Project Overview

This is a C#/.NET Core project optimized for modern .NET development with high-performance APIs, strong typing, and cloud-ready deployment.

## .NET Core Specific Development Commands

### Project Management
- `dotnet new webapi -n MyProject` - Create new Web API project
- `dotnet new console -n MyProject` - Create new console application
- `dotnet run` - Start development server
- `dotnet watch run` - Start server with hot reload
- `dotnet build` - Build the project
- `dotnet clean` - Clean build artifacts

### Package Management
- `dotnet restore` - Restore NuGet packages
- `dotnet add package <PackageName>` - Add NuGet package
- `dotnet list package --outdated` - Check for outdated packages
- `dotnet remove package <PackageName>` - Remove NuGet package

### Database Management (Entity Framework)
- `dotnet ef migrations add InitialCreate` - Create database migration
- `dotnet ef database update` - Apply migrations to database
- `dotnet ef database drop` - Drop database
- `dotnet ef migrations remove` - Remove last migration

### Testing & Quality
- `dotnet test` - Run all tests
- `dotnet test --collect:"XPlat Code Coverage"` - Run tests with coverage
- `dotnet format` - Format code according to .editorconfig
- `dotnet build --configuration Release` - Build in release mode

### Publishing
- `dotnet publish -c Release` - Publish application
- `dotnet publish -c Release -o ./publish` - Publish to specific directory
- `dotnet publish --self-contained -r win-x64` - Create self-contained executable

## .NET Core Project Structure

```
MyProject/
├── Controllers/                # API controllers
│   └── WeatherForecastController.cs
├── Models/                     # Data models and DTOs
│   ├── User.cs
│   └── CreateUserRequest.cs
├── Services/                   # Business logic services
│   ├── IUserService.cs
│   └── UserService.cs
├── Data/                       # Data access and DbContext
│   ├── AppDbContext.cs
│   └── Repositories/
│       ├── IUserRepository.cs
│       └── UserRepository.cs
├── Middleware/                 # Custom middleware
│   └── ExceptionMiddleware.cs
├── Configuration/              # Configuration extensions
│   └── ServiceCollectionExtensions.cs
├── Properties/
│   └── launchSettings.json    # Development settings
├── appsettings.json           # Application configuration
├── appsettings.Development.json
├── Program.cs                 # Application entry point
└── MyProject.csproj           # Project file
```

## ASP.NET Core Application Setup

```csharp
// Program.cs
var builder = WebApplication.CreateBuilder(args);

// Add services to the container
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Database configuration
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

// Dependency injection
builder.Services.AddScoped<IUserRepository, UserRepository>();
builder.Services.AddScoped<IUserService, UserService>();

var app = builder.Build();

// Configure the HTTP request pipeline
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();por 
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
```

## Configuration Management

```csharp
// appsettings.json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=localhost;Database=MyProjectDb;Trusted_Connection=true;TrustServerCertificate=true"
  },
  "JwtSettings": {
    "SecretKey": "your-secret-key-here",
    "Issuer": "MyProject",
    "Audience": "MyProject-Users",
    "ExpirationHours": 24
  },
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  }
}

// Access configuration in services
public class UserService
{
    private readonly IConfiguration _configuration;
    
    public UserService(IConfiguration configuration)
    {
        _configuration = configuration;
        var connectionString = _configuration.GetConnectionString("DefaultConnection");
    }
}
```

## .NET Core Best Practices

### API Design
- Use proper HTTP status codes (200, 201, 400, 404, 500)
- Implement consistent error handling with Problem Details
- Use Data Transfer Objects (DTOs) for API requests/responses
- Add comprehensive API documentation with Swagger/OpenAPI
- Implement proper input validation with Data Annotations

### Dependency Injection
- Register services with appropriate lifetimes (Scoped, Singleton, Transient)
- Use interface-based design for loose coupling
- Implement factory patterns for complex object creation
- Use configuration options pattern for settings

### Entity Framework Best Practices
- Use async/await for all database operations
- Implement repository pattern for data access abstraction
- Use migrations for database schema changes
- Add proper indexes for query optimization
- Implement soft delete patterns when needed

### Performance Optimization
- Use async/await for I/O operations
- Implement response caching for frequently accessed data
- Use connection pooling for database connections
- Leverage Span<T> and Memory<T> for high-performance scenarios
- Implement proper logging with structured logging

## Testing Strategy

### Test Organization
```csharp
// UserServiceTests.cs
public class UserServiceTests
{
    private readonly Mock<IUserRepository> _mockUserRepository;
    private readonly UserService _userService;

    public UserServiceTests()
    {
        _mockUserRepository = new Mock<IUserRepository>();
        _userService = new UserService(_mockUserRepository.Object);
    }

    [Fact]
    public async Task GetUserAsync_WithValidId_ReturnsUser()
    {
        // Arrange
        var userId = 1;
        var expectedUser = new User { Id = userId, Name = "John Doe" };
        _mockUserRepository.Setup(x => x.GetByIdAsync(userId))
                          .ReturnsAsync(expectedUser);

        // Act
        var result = await _userService.GetUserAsync(userId);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(expectedUser.Id, result.Id);
        Assert.Equal(expectedUser.Name, result.Name);
    }
}
```

### Test Types
- **Unit tests** for business logic and services
- **Integration tests** for API endpoints and database interactions
- **Performance tests** for API response times
- **Security tests** for authentication and authorization

## Deployment Considerations

### Production Setup
- Use appsettings.Production.json for production configuration
- Implement health checks for monitoring
- Set up proper logging with providers like Serilog
- Use environment variables for sensitive configuration
- Implement proper exception handling and logging

### Docker Configuration
```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["MyProject.csproj", "."]
RUN dotnet restore "./MyProject.csproj"
COPY . .
WORKDIR "/src/."
RUN dotnet build "MyProject.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "MyProject.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "MyProject.dll"]
```

### Environment Variables
```bash
# Development
ASPNETCORE_ENVIRONMENT=Development
ASPNETCORE_URLS=https://localhost:5001;http://localhost:5000

# Production
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__DefaultConnection=Server=prod-server;Database=MyProjectDb;User Id=user;Password=pass;
JwtSettings__SecretKey=your-production-secret-key
```

## Common .NET Core Patterns

### Repository Pattern
```csharp
public interface IUserRepository
{
    Task<User?> GetByIdAsync(int id);
    Task<IList<User>> GetAllAsync();
    Task<User> CreateAsync(User user);
    Task UpdateAsync(User user);
    Task DeleteAsync(int id);
}

public class UserRepository : IUserRepository
{
    private readonly AppDbContext _context;

    public UserRepository(AppDbContext context)
    {
        _context = context;
    }

    public async Task<User?> GetByIdAsync(int id)
    {
        return await _context.Users.FindAsync(id);
    }
}
```

### Service Layer Pattern
```csharp
public interface IUserService
{
    Task<User?> GetUserAsync(int id);
    Task<User> CreateUserAsync(CreateUserRequest request);
}

public class UserService : IUserService
{
    private readonly IUserRepository _userRepository;
    private readonly ILogger<UserService> _logger;

    public UserService(IUserRepository userRepository, ILogger<UserService> logger)
    {
        _userRepository = userRepository;
        _logger = logger;
    }

    public async Task<User?> GetUserAsync(int id)
    {
        _logger.LogInformation("Getting user with ID: {UserId}", id);
        return await _userRepository.GetByIdAsync(id);
    }
}
```

### Global Exception Handling
```csharp
public class ExceptionMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionMiddleware> _logger;

    public ExceptionMiddleware(RequestDelegate next, ILogger<ExceptionMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext httpContext)
    {
        try
        {
            await _next(httpContext);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Something went wrong");
            await HandleExceptionAsync(httpContext, ex);
        }
    }

    private static async Task HandleExceptionAsync(HttpContext context, Exception ex)
    {
        context.Response.ContentType = "application/json";
        context.Response.StatusCode = 500;

        await context.Response.WriteAsync(new
        {
            error = "An error occurred while processing your request.",
            message = ex.Message
        }.ToString());
    }
}
```

## Development Workflow

### Getting Started
1. Install .NET 8+ SDK
2. Clone repository
3. Run `dotnet restore` to restore packages
4. Set up database connection string in appsettings.json
5. Run `dotnet ef database update` to create database
6. Run `dotnet run` to start the application

### Code Quality
- **EditorConfig** - Consistent code formatting
- **dotnet format** - Automatic code formatting
- **StyleCop** - Code style analysis
- **SonarAnalyzer** - Code quality analysis
- **xUnit** - Unit testing framework
- **Moq** - Mocking framework for testing