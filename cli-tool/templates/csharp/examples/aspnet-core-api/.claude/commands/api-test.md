# API Testing

Comprehensive testing workflow for ASP.NET Core Web API projects including unit, integration, and end-to-end testing.

## Purpose

This command provides testing strategies and tools specifically designed for ASP.NET Core Web API applications.

## Usage

```
/api-test
```

## What this command does

1. **Unit testing** for controllers, services, and business logic
2. **Integration testing** for complete API workflows
3. **End-to-end testing** with real HTTP requests
4. **Performance testing** for API endpoints
5. **Security testing** for authentication and authorization

## Example Commands

### Unit Testing
```bash
# Run all unit tests
dotnet test --filter "Category=Unit"

# Run controller tests
dotnet test --filter "FullyQualifiedName~ControllerTests"

# Run service tests with coverage
dotnet test --filter "Category=Unit" --collect:"XPlat Code Coverage"
```

### Integration Testing
```bash
# Run integration tests
dotnet test --filter "Category=Integration"

# Run with test database
dotnet test --filter "Category=Integration" --environment "Testing"

# Run specific API endpoint tests
dotnet test --filter "FullyQualifiedName~UsersControllerIntegrationTests"
```

### End-to-End Testing
```bash
# Run E2E tests against running API
dotnet test --filter "Category=E2E" --settings e2e.runsettings

# Run with custom base URL
dotnet test --filter "Category=E2E" -- TestRunParameters.Parameter(name=\"BaseUrl\", value=\"https://localhost:5001\")
```

## Unit Testing Examples

### Controller Unit Tests
```csharp
[Fact]
public async Task GetUsers_ReturnsOkResult_WithUserList()
{
    // Arrange
    var mockService = new Mock<IUserService>();
    var expectedUsers = new List<UserDto>
    {
        new UserDto { Id = 1, FirstName = "John", LastName = "Doe" }
    };
    mockService.Setup(s => s.GetUsersAsync(It.IsAny<int>(), It.IsAny<int>()))
               .ReturnsAsync(new PagedResponse<UserDto>
               {
                   Data = expectedUsers,
                   Success = true,
                   TotalRecords = 1
               });

    var controller = new UsersController(mockService.Object, Mock.Of<ILogger<UsersController>>());

    // Act
    var result = await controller.GetUsers();

    // Assert
    var okResult = Assert.IsType<OkObjectResult>(result.Result);
    var response = Assert.IsType<PagedResponse<UserDto>>(okResult.Value);
    Assert.True(response.Success);
    Assert.Single(response.Data);
}

[Fact]
public async Task CreateUser_WithValidRequest_ReturnsCreatedResult()
{
    // Arrange
    var mockService = new Mock<IUserService>();
    var request = new CreateUserRequest
    {
        FirstName = "Jane",
        LastName = "Doe",
        Email = "jane@example.com"
    };
    var expectedUser = new UserDto { Id = 1, FirstName = "Jane", LastName = "Doe" };
    
    mockService.Setup(s => s.CreateUserAsync(It.IsAny<CreateUserRequest>()))
               .ReturnsAsync(expectedUser);

    var controller = new UsersController(mockService.Object, Mock.Of<ILogger<UsersController>>());

    // Act
    var result = await controller.CreateUser(request);

    // Assert
    var createdResult = Assert.IsType<CreatedAtActionResult>(result.Result);
    Assert.Equal(nameof(controller.GetUser), createdResult.ActionName);
    
    var response = Assert.IsType<ApiResponse<UserDto>>(createdResult.Value);
    Assert.True(response.Success);
    Assert.Equal(expectedUser.Id, response.Data.Id);
}
```

### Service Unit Tests
```csharp
[Fact]
public async Task CreateUserAsync_WithValidRequest_ReturnsUserDto()
{
    // Arrange
    var mockRepository = new Mock<IUserRepository>();
    var mockMapper = new Mock<IMapper>();
    var request = new CreateUserRequest
    {
        FirstName = "John",
        LastName = "Doe",
        Email = "john@example.com"
    };
    
    var user = new User { Id = 1, FirstName = "John", LastName = "Doe" };
    var userDto = new UserDto { Id = 1, FirstName = "John", LastName = "Doe" };
    
    mockRepository.Setup(r => r.CreateAsync(It.IsAny<User>()))
                  .ReturnsAsync(user);
    mockMapper.Setup(m => m.Map<UserDto>(user))
              .Returns(userDto);

    var service = new UserService(mockRepository.Object, mockMapper.Object);

    // Act
    var result = await service.CreateUserAsync(request);

    // Assert
    Assert.NotNull(result);
    Assert.Equal(userDto.Id, result.Id);
    Assert.Equal(userDto.FirstName, result.FirstName);
}
```

## Integration Testing

### API Integration Test Setup
```csharp
public class ApiIntegrationTestBase : IClassFixture<WebApplicationFactory<Program>>
{
    protected readonly WebApplicationFactory<Program> Factory;
    protected readonly HttpClient Client;

    public ApiIntegrationTestBase(WebApplicationFactory<Program> factory)
    {
        Factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // Remove the real database
                services.RemoveAll(typeof(DbContextOptions<ApiDbContext>));
                
                // Add in-memory database
                services.AddDbContext<ApiDbContext>(options =>
                {
                    options.UseInMemoryDatabase($"TestDb_{Guid.NewGuid()}");
                });
                
                // Override other services as needed
                services.AddScoped<IEmailService, MockEmailService>();
            });
            
            builder.UseEnvironment("Testing");
        });
        
        Client = Factory.CreateClient();
    }

    protected async Task<string> GetValidJwtTokenAsync()
    {
        var loginRequest = new
        {
            Email = "test@example.com",
            Password = "TestPassword123!"
        };

        var response = await Client.PostAsJsonAsync("/api/v1/auth/login", loginRequest);
        response.EnsureSuccessStatusCode();
        
        var content = await response.Content.ReadAsStringAsync();
        var loginResponse = JsonSerializer.Deserialize<LoginResponse>(content);
        
        return loginResponse.Token;
    }

    protected async Task SeedDatabaseAsync()
    {
        using var scope = Factory.Services.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<ApiDbContext>();
        
        await context.Database.EnsureCreatedAsync();
        
        // Seed test data
        if (!context.Users.Any())
        {
            context.Users.AddRange(new[]
            {
                new User { FirstName = "John", LastName = "Doe", Email = "john@example.com" },
                new User { FirstName = "Jane", LastName = "Smith", Email = "jane@example.com" }
            });
            
            await context.SaveChangesAsync();
        }
    }
}
```

### Integration Test Examples
```csharp
public class UsersControllerIntegrationTests : ApiIntegrationTestBase
{
    public UsersControllerIntegrationTests(WebApplicationFactory<Program> factory) 
        : base(factory) { }

    [Fact]
    public async Task GetUsers_WithValidToken_ReturnsUsers()
    {
        // Arrange
        await SeedDatabaseAsync();
        var token = await GetValidJwtTokenAsync();
        Client.DefaultRequestHeaders.Authorization = 
            new AuthenticationHeaderValue("Bearer", token);

        // Act
        var response = await Client.GetAsync("/api/v1/users");

        // Assert
        response.EnsureSuccessStatusCode();
        var content = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<PagedResponse<UserDto>>(content);
        
        Assert.NotNull(result);
        Assert.True(result.Success);
        Assert.NotEmpty(result.Data);
    }

    [Fact]
    public async Task CreateUser_WithValidData_ReturnsCreatedUser()
    {
        // Arrange
        var token = await GetValidJwtTokenAsync();
        Client.DefaultRequestHeaders.Authorization = 
            new AuthenticationHeaderValue("Bearer", token);

        var request = new CreateUserRequest
        {
            FirstName = "Test",
            LastName = "User",
            Email = "testuser@example.com",
            Password = "TestPassword123!"
        };

        // Act
        var response = await Client.PostAsJsonAsync("/api/v1/users", request);

        // Assert
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        
        var content = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<ApiResponse<UserDto>>(content);
        
        Assert.NotNull(result);
        Assert.True(result.Success);
        Assert.Equal(request.FirstName, result.Data.FirstName);
        Assert.Equal(request.LastName, result.Data.LastName);
    }

    [Fact]
    public async Task CreateUser_WithInvalidData_ReturnsBadRequest()
    {
        // Arrange
        var token = await GetValidJwtTokenAsync();
        Client.DefaultRequestHeaders.Authorization = 
            new AuthenticationHeaderValue("Bearer", token);

        var request = new CreateUserRequest
        {
            FirstName = "", // Invalid: empty first name
            LastName = "User",
            Email = "invalid-email", // Invalid: bad email format
            Password = "123" // Invalid: too short
        };

        // Act
        var response = await Client.PostAsJsonAsync("/api/v1/users", request);

        // Assert
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        
        var content = await response.Content.ReadAsStringAsync();
        var result = JsonSerializer.Deserialize<ApiResponse<object>>(content);
        
        Assert.NotNull(result);
        Assert.False(result.Success);
        Assert.NotEmpty(result.Errors);
    }
}
```

## Performance Testing

### Load Testing with NBomber
```csharp
public class ApiPerformanceTests
{
    [Fact]
    public void GetUsers_LoadTest()
    {
        var scenario = Scenario.Create("get_users", async context =>
        {
            using var httpClient = new HttpClient();
            
            // Add authentication header
            var token = await GetAuthTokenAsync();
            httpClient.DefaultRequestHeaders.Authorization = 
                new AuthenticationHeaderValue("Bearer", token);

            var response = await httpClient.GetAsync("https://localhost:5001/api/v1/users");
            
            return response.IsSuccessStatusCode ? Response.Ok() : Response.Fail();
        })
        .WithLoadSimulations(
            Simulation.InjectPerSec(rate: 10, during: TimeSpan.FromMinutes(1))
        );

        NBomberRunner
            .RegisterScenarios(scenario)
            .Run();
    }

    [Fact]
    public void CreateUser_StressTest()
    {
        var scenario = Scenario.Create("create_user", async context =>
        {
            using var httpClient = new HttpClient();
            
            var token = await GetAuthTokenAsync();
            httpClient.DefaultRequestHeaders.Authorization = 
                new AuthenticationHeaderValue("Bearer", token);

            var request = new CreateUserRequest
            {
                FirstName = $"User{context.ScenarioInfo.ThreadId}",
                LastName = $"Test{context.InvocationNumber}",
                Email = $"user{context.InvocationNumber}_{context.ScenarioInfo.ThreadId}@example.com",
                Password = "TestPassword123!"
            };

            var response = await httpClient.PostAsJsonAsync(
                "https://localhost:5001/api/v1/users", request);
            
            return response.IsSuccessStatusCode ? Response.Ok() : Response.Fail();
        })
        .WithLoadSimulations(
            Simulation.InjectPerSec(rate: 5, during: TimeSpan.FromMinutes(2))
        );

        NBomberRunner
            .RegisterScenarios(scenario)
            .Run();
    }
}
```

### Benchmark Testing with BenchmarkDotNet
```csharp
[MemoryDiagnoser]
[SimpleJob(RuntimeMoniker.Net80)]
public class UserServiceBenchmarks
{
    private UserService _userService;
    private Mock<IUserRepository> _mockRepository;

    [GlobalSetup]
    public void Setup()
    {
        _mockRepository = new Mock<IUserRepository>();
        _userService = new UserService(_mockRepository.Object, Mock.Of<IMapper>());
    }

    [Benchmark]
    public async Task GetUserById_Benchmark()
    {
        _mockRepository.Setup(r => r.GetByIdAsync(It.IsAny<int>()))
                      .ReturnsAsync(new User { Id = 1, FirstName = "John" });

        await _userService.GetUserByIdAsync(1);
    }

    [Benchmark]
    [Arguments(10)]
    [Arguments(100)]
    [Arguments(1000)]
    public async Task GetUsers_Benchmark(int count)
    {
        var users = Enumerable.Range(1, count)
            .Select(i => new User { Id = i, FirstName = $"User{i}" })
            .ToList();

        _mockRepository.Setup(r => r.GetAllAsync())
                      .ReturnsAsync(users);

        await _userService.GetUsersAsync(1, count);
    }
}
```

## Security Testing

### Authentication Tests
```csharp
[Fact]
public async Task GetUsers_WithoutToken_ReturnsUnauthorized()
{
    // Act
    var response = await Client.GetAsync("/api/v1/users");

    // Assert
    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
}

[Fact]
public async Task GetUsers_WithInvalidToken_ReturnsUnauthorized()
{
    // Arrange
    Client.DefaultRequestHeaders.Authorization = 
        new AuthenticationHeaderValue("Bearer", "invalid-token");

    // Act
    var response = await Client.GetAsync("/api/v1/users");

    // Assert
    Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
}

[Fact]
public async Task GetAdminEndpoint_WithUserRole_ReturnsForbidden()
{
    // Arrange
    var userToken = await GetUserTokenAsync(); // Token with User role
    Client.DefaultRequestHeaders.Authorization = 
        new AuthenticationHeaderValue("Bearer", userToken);

    // Act
    var response = await Client.GetAsync("/api/v1/admin/users");

    // Assert
    Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
}
```

### Input Validation Tests
```csharp
[Theory]
[InlineData("", "User", "test@example.com", "Password123!")] // Empty first name
[InlineData("John", "", "test@example.com", "Password123!")] // Empty last name
[InlineData("John", "User", "invalid-email", "Password123!")] // Invalid email
[InlineData("John", "User", "test@example.com", "123")] // Weak password
public async Task CreateUser_WithInvalidInput_ReturnsBadRequest(
    string firstName, string lastName, string email, string password)
{
    // Arrange
    var token = await GetValidJwtTokenAsync();
    Client.DefaultRequestHeaders.Authorization = 
        new AuthenticationHeaderValue("Bearer", token);

    var request = new CreateUserRequest
    {
        FirstName = firstName,
        LastName = lastName,
        Email = email,
        Password = password
    };

    // Act
    var response = await Client.PostAsJsonAsync("/api/v1/users", request);

    // Assert
    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
}
```

## Test Configuration

### Test Settings File
```json
// appsettings.Testing.json
{
  "Logging": {
    "LogLevel": {
      "Default": "Warning",
      "Microsoft.EntityFrameworkCore": "Warning"
    }
  },
  "ConnectionStrings": {
    "DefaultConnection": "Server=(localdb)\\mssqllocaldb;Database=TestDb;Trusted_Connection=true"
  },
  "Jwt": {
    "SecretKey": "test-secret-key-for-testing-purposes-only",
    "Issuer": "TestApi",
    "Audience": "TestUsers",
    "ExpirationMinutes": 60
  }
}
```

### Test Project Configuration
```xml
<!-- MyApi.Tests.csproj -->
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <TargetFramework>net8.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <IsPackable>false</IsPackable>
  </PropertyGroup>

  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.8.0" />
    <PackageReference Include="xunit" Version="2.4.2" />
    <PackageReference Include="xunit.runner.visualstudio" Version="2.4.5" />
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="8.0.0" />
    <PackageReference Include="Microsoft.EntityFrameworkCore.InMemory" Version="8.0.0" />
    <PackageReference Include="Moq" Version="4.20.69" />
    <PackageReference Include="FluentAssertions" Version="6.12.0" />
    <PackageReference Include="NBomber" Version="5.0.0" />
    <PackageReference Include="BenchmarkDotNet" Version="0.13.12" />
  </ItemGroup>

  <ItemGroup>
    <ProjectReference Include="..\MyApi\MyApi.csproj" />
  </ItemGroup>
</Project>
```

## Best Practices

### Test Organization
- Group tests by feature or controller
- Use descriptive test names that explain the scenario
- Follow AAA pattern (Arrange, Act, Assert)
- Use test categories to organize test execution
- Keep tests independent and isolated

### Test Data Management
- Use test fixtures for common setup
- Create test data builders for complex objects
- Use in-memory databases for integration tests
- Clean up test data after each test
- Use realistic test data that reflects production scenarios

### Performance Considerations
- Run unit tests frequently during development
- Run integration tests in CI/CD pipeline
- Run performance tests on dedicated environments
- Monitor test execution time and optimize slow tests
- Use parallel test execution when possible