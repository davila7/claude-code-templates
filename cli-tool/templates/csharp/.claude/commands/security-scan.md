# Security Scan

Comprehensive security analysis and vulnerability assessment for .NET Core applications.

## Purpose

This command performs thorough security analysis including dependency vulnerability scanning, code security analysis, configuration security checks, and penetration testing guidance.

## Usage

```
/security-scan
```

## What this command does

1. **Scans dependencies** for known security vulnerabilities
2. **Analyzes code** for security anti-patterns and vulnerabilities
3. **Checks configuration** for security misconfigurations
4. **Validates authentication** and authorization implementations
5. **Provides remediation guidance** for identified security issues

## Example Commands

### Dependency Vulnerability Scanning
```bash
# Scan for vulnerable NuGet packages
dotnet list package --vulnerable --include-transitive

# Check for deprecated packages
dotnet list package --deprecated

# Audit specific package
nuget audit <package-name>

# Generate security report
dotnet list package --vulnerable --include-transitive --format json > security-report.json
```

### Static Application Security Testing (SAST)
```bash
# Enable security analysis in build
dotnet build -p:EnableNETAnalyzers=true -p:AnalysisLevel=latest-all

# Run with security-focused analyzers
dotnet build -p:RunCodeAnalysis=true -p:CodeAnalysisRuleSet=security.ruleset

# Use security-specific analyzers
dotnet add package Microsoft.CodeAnalysis.BannedApiAnalyzers
dotnet add package SonarAnalyzer.CSharp
```

### Security Code Analysis Rules
```xml
<!-- security.ruleset -->
<?xml version="1.0" encoding="utf-8"?>
<RuleSet Name="Security Rules" ToolsVersion="16.0">
  <Rules AnalyzerId="Microsoft.CodeAnalysis.CSharp.Security" RuleNamespace="Microsoft.CodeAnalysis.CSharp.Security">
    <Rule Id="CA2100" Action="Error" />  <!-- Review SQL queries for security vulnerabilities -->
    <Rule Id="CA2109" Action="Error" />  <!-- Review visible event handlers -->
    <Rule Id="CA2119" Action="Error" />  <!-- Seal methods that satisfy private interfaces -->
    <Rule Id="CA2153" Action="Error" />  <!-- Do Not Catch Corrupted State Exceptions -->
    <Rule Id="CA2300" Action="Error" />  <!-- Do not use insecure deserializer BinaryFormatter -->
    <Rule Id="CA2301" Action="Error" />  <!-- Do not call BinaryFormatter.Deserialize without first setting BinaryFormatter.Binder -->
    <Rule Id="CA2302" Action="Error" />  <!-- Ensure BinaryFormatter.Binder is set before calling BinaryFormatter.Deserialize -->
    <Rule Id="CA2305" Action="Error" />  <!-- Do not use insecure deserializer LosFormatter -->
    <Rule Id="CA2310" Action="Error" />  <!-- Do not use insecure deserializer NetDataContractSerializer -->
    <Rule Id="CA2315" Action="Error" />  <!-- Do not use insecure deserializer ObjectStateFormatter -->
    <Rule Id="CA2321" Action="Error" />  <!-- Do not deserialize with JavaScriptSerializer using a SimpleTypeResolver -->
    <Rule Id="CA2322" Action="Error" />  <!-- Ensure JavaScriptSerializer is not initialized with SimpleTypeResolver before deserializing -->
    <Rule Id="CA3001" Action="Warning" /> <!-- Review code for SQL injection vulnerabilities -->
    <Rule Id="CA3002" Action="Warning" /> <!-- Review code for XSS vulnerabilities -->
    <Rule Id="CA3003" Action="Warning" /> <!-- Review code for file path injection vulnerabilities -->
    <Rule Id="CA3004" Action="Warning" /> <!-- Review code for information disclosure vulnerabilities -->
    <Rule Id="CA3006" Action="Warning" /> <!-- Review code for process command injection vulnerabilities -->
    <Rule Id="CA3007" Action="Warning" /> <!-- Review code for open redirect vulnerabilities -->
    <Rule Id="CA3008" Action="Warning" /> <!-- Review code for XPath injection vulnerabilities -->
    <Rule Id="CA3009" Action="Warning" /> <!-- Review code for XML injection vulnerabilities -->
    <Rule Id="CA3010" Action="Warning" /> <!-- Review code for XAML injection vulnerabilities -->
    <Rule Id="CA3011" Action="Warning" /> <!-- Review code for DLL injection vulnerabilities -->
    <Rule Id="CA3012" Action="Warning" /> <!-- Review code for regex injection vulnerabilities -->
    <Rule Id="CA5350" Action="Error" />   <!-- Do Not Use Weak Cryptographic Algorithms -->
    <Rule Id="CA5351" Action="Error" />   <!-- Do Not Use Broken Cryptographic Algorithms -->
    <Rule Id="CA5358" Action="Error" />   <!-- Do Not Use Unsafe Cipher Modes -->
    <Rule Id="CA5359" Action="Error" />   <!-- Do Not Disable Certificate Validation -->
    <Rule Id="CA5360" Action="Error" />   <!-- Do Not Call Dangerous Methods In Deserialization -->
    <Rule Id="CA5361" Action="Error" />   <!-- Do Not Disable SChannel Use of Strong Crypto -->
    <Rule Id="CA5362" Action="Error" />   <!-- Do Not Refer Self In Serializable Class -->
    <Rule Id="CA5363" Action="Error" />   <!-- Do Not Disable Request Validation -->
    <Rule Id="CA5364" Action="Error" />   <!-- Do Not Use Deprecated Security Protocols -->
    <Rule Id="CA5365" Action="Error" />   <!-- Do Not Disable HTTP Header Checking -->
    <Rule Id="CA5366" Action="Error" />   <!-- Use XmlReader For DataSet Read Xml -->
    <Rule Id="CA5367" Action="Error" />   <!-- Do Not Serialize Types With Pointer Fields -->
    <Rule Id="CA5368" Action="Error" />   <!-- Set ViewStateUserKey For Classes Derived From Page -->
    <Rule Id="CA5369" Action="Error" />   <!-- Use XmlReader For Deserialize -->
    <Rule Id="CA5370" Action="Error" />   <!-- Use XmlReader For Validating Reader -->
    <Rule Id="CA5371" Action="Error" />   <!-- Use XmlReader For Schema Read -->
    <Rule Id="CA5372" Action="Error" />   <!-- Use XmlReader For XPathDocument -->
    <Rule Id="CA5373" Action="Error" />   <!-- Do not use obsolete key derivation function -->
    <Rule Id="CA5374" Action="Error" />   <!-- Do Not Use XslTransform -->
    <Rule Id="CA5375" Action="Error" />   <!-- Do Not Use Account Shared Access Signature -->
    <Rule Id="CA5376" Action="Error" />   <!-- Use SharedAccessProtocol HttpsOnly -->
    <Rule Id="CA5377" Action="Error" />   <!-- Use Container Level Access Policy -->
    <Rule Id="CA5378" Action="Error" />   <!-- Do not disable ServicePointManagerSecurityProtocols -->
    <Rule Id="CA5379" Action="Error" />   <!-- Do Not Use Weak Key Derivation Function Algorithm -->
    <Rule Id="CA5380" Action="Error" />   <!-- Do Not Add Certificates To Root Store -->
    <Rule Id="CA5381" Action="Error" />   <!-- Ensure Certificates Are Not Added To Root Store -->
    <Rule Id="CA5382" Action="Error" />   <!-- Use Secure Cookies In ASP.Net Core -->
    <Rule Id="CA5383" Action="Error" />   <!-- Ensure Use Secure Cookies In ASP.Net Core -->
    <Rule Id="CA5384" Action="Error" />   <!-- Do Not Use Digital Signature Algorithm (DSA) -->
    <Rule Id="CA5385" Action="Error" />   <!-- Use Rivest–Shamir–Adleman (RSA) Algorithm With Sufficient Key Size -->
    <Rule Id="CA5386" Action="Error" />   <!-- Avoid hardcoding SecurityProtocolType value -->
    <Rule Id="CA5387" Action="Error" />   <!-- Do Not Use Weak Key Derivation Function With Insufficient Iteration Count -->
    <Rule Id="CA5388" Action="Error" />   <!-- Ensure Sufficient Iteration Count When Using Weak Key Derivation Function -->
    <Rule Id="CA5389" Action="Error" />   <!-- Do Not Add Archive Item's Path To The Target File System Path -->
    <Rule Id="CA5390" Action="Error" />   <!-- Do not hard-code encryption key -->
    <Rule Id="CA5391" Action="Error" />   <!-- Use antiforgery tokens in ASP.NET Core MVC controllers -->
    <Rule Id="CA5392" Action="Error" />   <!-- Use DefaultDllImportSearchPaths attribute for P/Invokes -->
    <Rule Id="CA5393" Action="Error" />   <!-- Do not use unsafe DllImportSearchPath value -->
    <Rule Id="CA5394" Action="Error" />   <!-- Do not use insecure randomness -->
    <Rule Id="CA5395" Action="Error" />   <!-- Miss HttpVerb attribute for action methods -->
    <Rule Id="CA5396" Action="Error" />   <!-- Set HttpOnly to true for HttpCookies -->
    <Rule Id="CA5397" Action="Error" />   <!-- Do not use deprecated SslProtocols values -->
    <Rule Id="CA5398" Action="Error" />   <!-- Avoid hardcoded SslProtocols values -->
    <Rule Id="CA5399" Action="Error" />   <!-- HttpClients should enable certificate revocation list checks -->
    <Rule Id="CA5400" Action="Error" />   <!-- Ensure HttpClient certificate revocation list check is not disabled -->
    <Rule Id="CA5401" Action="Error" />   <!-- Do not use CreateEncryptor with non-default IV -->
    <Rule Id="CA5402" Action="Error" />   <!-- Use CreateEncryptor with the default IV  -->
    <Rule Id="CA5403" Action="Error" />   <!-- Do not hard-code certificate -->
  </Rules>
</RuleSet>
```

## Authentication and Authorization Security

### JWT Security Analysis
```csharp
// Secure JWT configuration
public void ConfigureServices(IServiceCollection services)
{
    services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
        .AddJwtBearer(options =>
        {
            options.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = Configuration["Jwt:Issuer"],
                ValidAudience = Configuration["Jwt:Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(
                    Encoding.UTF8.GetBytes(Configuration["Jwt:SecretKey"])),
                ClockSkew = TimeSpan.Zero, // Reduce default 5-minute clock skew
                RequireExpirationTime = true,
                RequireSignedTokens = true
            };
            
            // Additional security headers
            options.Events = new JwtBearerEvents
            {
                OnAuthenticationFailed = context =>
                {
                    // Log authentication failures
                    return Task.CompletedTask;
                },
                OnTokenValidated = context =>
                {
                    // Additional token validation
                    return Task.CompletedTask;
                }
            };
        });
}
```

### Authorization Security Checks
```csharp
// Proper authorization implementation
[Authorize(Roles = "Admin")]
[ValidateAntiForgeryToken]
public class AdminController : ControllerBase
{
    [HttpPost]
    [Authorize(Policy = "RequireElevatedRights")]
    public async Task<IActionResult> DeleteUser(int userId)
    {
        // Additional authorization checks
        var currentUser = await GetCurrentUserAsync();
        if (!await CanDeleteUserAsync(currentUser, userId))
        {
            return Forbid();
        }
        
        // Implement operation
        return Ok();
    }
}
```

## Input Validation Security

### SQL Injection Prevention
```csharp
// Safe: Using parameterized queries with EF Core
public async Task<User> GetUserByEmailAsync(string email)
{
    return await _context.Users
        .Where(u => u.Email == email) // EF Core automatically parameterizes
        .FirstOrDefaultAsync();
}

// Safe: Using raw SQL with parameters
public async Task<List<User>> GetUsersByRoleAsync(string role)
{
    return await _context.Users
        .FromSqlRaw("SELECT * FROM Users WHERE Role = {0}", role)
        .ToListAsync();
}

// Unsafe: String concatenation (DON'T DO THIS)
// return await _context.Users
//     .FromSqlRaw($"SELECT * FROM Users WHERE Role = '{role}'")
//     .ToListAsync();
```

### Cross-Site Scripting (XSS) Prevention
```csharp
// Input validation and sanitization
public class CreateUserRequest
{
    [Required]
    [StringLength(100)]
    [RegularExpression(@"^[a-zA-Z0-9\s]+$", ErrorMessage = "Only alphanumeric characters allowed")]
    public string Name { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string Email { get; set; } = string.Empty;
}

// HTML encoding in views (automatic in Razor)
// @Model.UserInput is automatically HTML encoded

// Manual HTML encoding when needed
public string SafeHtmlOutput(string userInput)
{
    return HtmlEncoder.Default.Encode(userInput);
}
```

### Cross-Site Request Forgery (CSRF) Protection
```csharp
// Enable anti-forgery tokens
public void ConfigureServices(IServiceCollection services)
{
    services.AddAntiforgery(options =>
    {
        options.HeaderName = "X-CSRF-TOKEN";
        options.SameSite = SameSiteMode.Strict;
        options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    });
}

// Apply to controllers/actions
[HttpPost]
[ValidateAntiForgeryToken]
public IActionResult CreateUser(CreateUserRequest request)
{
    // Implementation
    return Ok();
}
```

## Cryptography Security

### Secure Password Hashing
```csharp
public class SecurePasswordService
{
    public string HashPassword(string password)
    {
        // Use BCrypt or Argon2
        return BCrypt.Net.BCrypt.HashPassword(password, 12);
    }

    public bool VerifyPassword(string password, string hash)
    {
        return BCrypt.Net.BCrypt.Verify(password, hash);
    }
}

// Alternative: Using ASP.NET Core Identity
public class UserService
{
    private readonly IPasswordHasher<User> _passwordHasher;

    public UserService(IPasswordHasher<User> passwordHasher)
    {
        _passwordHasher = passwordHasher;
    }

    public string HashPassword(User user, string password)
    {
        return _passwordHasher.HashPassword(user, password);
    }
}
```

### Secure Random Generation
```csharp
public class SecureRandomService
{
    public string GenerateSecureToken(int length = 32)
    {
        using var rng = RandomNumberGenerator.Create();
        var bytes = new byte[length];
        rng.GetBytes(bytes);
        return Convert.ToBase64String(bytes);
    }

    public int GenerateSecureRandomInt(int min, int max)
    {
        using var rng = RandomNumberGenerator.Create();
        var bytes = new byte[4];
        rng.GetBytes(bytes);
        var value = BitConverter.ToUInt32(bytes, 0);
        return (int)(min + (value % (max - min)));
    }
}
```

### Encryption Best Practices
```csharp
public class EncryptionService
{
    public string Encrypt(string plainText, string key)
    {
        using var aes = Aes.Create();
        aes.Key = Convert.FromBase64String(key);
        aes.GenerateIV();

        using var encryptor = aes.CreateEncryptor();
        using var msEncrypt = new MemoryStream();
        using var csEncrypt = new CryptoStream(msEncrypt, encryptor, CryptoStreamMode.Write);
        using var swEncrypt = new StreamWriter(csEncrypt);

        swEncrypt.Write(plainText);
        
        var iv = aes.IV;
        var encrypted = msEncrypt.ToArray();
        var result = new byte[iv.Length + encrypted.Length];
        Buffer.BlockCopy(iv, 0, result, 0, iv.Length);
        Buffer.BlockCopy(encrypted, 0, result, iv.Length, encrypted.Length);
        
        return Convert.ToBase64String(result);
    }
}
```

## Configuration Security

### Secure Configuration Management
```csharp
// Use Azure Key Vault for production secrets
public void ConfigureServices(IServiceCollection services)
{
    if (!Environment.IsDevelopment())
    {
        var keyVaultEndpoint = Configuration["KeyVault:Endpoint"];
        var credential = new DefaultAzureCredential();
        Configuration.AddAzureKeyVault(new Uri(keyVaultEndpoint), credential);
    }
}

// Secure cookie configuration
services.ConfigureApplicationCookie(options =>
{
    options.Cookie.SecurePolicy = CookieSecurePolicy.Always;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.HttpOnly = true;
    options.ExpireTimeSpan = TimeSpan.FromHours(1);
    options.SlidingExpiration = true;
});
```

### Security Headers Configuration
```csharp
public void Configure(IApplicationBuilder app, IWebHostEnvironment env)
{
    // Security headers middleware
    app.Use(async (context, next) =>
    {
        context.Response.Headers.Add("X-Content-Type-Options", "nosniff");
        context.Response.Headers.Add("X-Frame-Options", "DENY");
        context.Response.Headers.Add("X-XSS-Protection", "1; mode=block");
        context.Response.Headers.Add("Referrer-Policy", "strict-origin-when-cross-origin");
        context.Response.Headers.Add("Content-Security-Policy", 
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'");
        
        if (context.Request.IsHttps)
        {
            context.Response.Headers.Add("Strict-Transport-Security", 
                "max-age=31536000; includeSubDomains");
        }
        
        await next();
    });
}
```

## Security Testing

### Penetration Testing Checklist
```bash
# Authentication testing
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"password"}'

# Authorization bypass testing
curl -X GET http://localhost:5000/api/admin/users \
  -H "Authorization: Bearer invalid_token"

# Input validation testing
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"<script>alert(1)</script>","email":"test@test.com"}'

# SQL injection testing
curl -X GET "http://localhost:5000/api/users?search='; DROP TABLE Users; --"

# CSRF testing
curl -X POST http://localhost:5000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"test","email":"test@test.com"}' \
  --cookie "session=valid_session_cookie"
```

### Automated Security Testing
```bash
# OWASP ZAP security scan
docker run -v $(pwd):/zap/wrk/:rw -t owasp/zap2docker-stable zap-baseline.py \
  -t http://localhost:5000 -g gen.conf -r testreport.html

# Dependency check with OWASP Dependency Check
dependency-check --project "MyProject" --scan . --format ALL

# Static analysis with SonarQube
dotnet sonarscanner begin /k:"MyProject" /d:sonar.login="token"
dotnet build
dotnet sonarscanner end /d:sonar.login="token"
```

## Security Monitoring

### Security Event Logging
```csharp
public class SecurityAuditService
{
    private readonly ILogger<SecurityAuditService> _logger;

    public SecurityAuditService(ILogger<SecurityAuditService> logger)
    {
        _logger = logger;
    }

    public void LogSecurityEvent(string eventType, string userId, string details)
    {
        _logger.LogWarning("Security Event: {EventType} for User: {UserId}. Details: {Details}",
            eventType, userId, details);
    }

    public void LogFailedLogin(string username, string ipAddress)
    {
        _logger.LogWarning("Failed login attempt for username: {Username} from IP: {IPAddress}",
            username, ipAddress);
    }

    public void LogUnauthorizedAccess(string userId, string resource)
    {
        _logger.LogError("Unauthorized access attempt by User: {UserId} to Resource: {Resource}",
            userId, resource);
    }
}
```

### Security Metrics
```csharp
public class SecurityMetrics
{
    private readonly Counter<int> _failedLoginAttempts;
    private readonly Counter<int> _unauthorizedAccess;
    private readonly Histogram<double> _authenticationDuration;

    public SecurityMetrics(IMeterFactory meterFactory)
    {
        var meter = meterFactory.Create("MyApp.Security");
        _failedLoginAttempts = meter.CreateCounter<int>("failed_login_attempts_total");
        _unauthorizedAccess = meter.CreateCounter<int>("unauthorized_access_attempts_total");
        _authenticationDuration = meter.CreateHistogram<double>("authentication_duration_seconds");
    }

    public void RecordFailedLogin(string username)
    {
        _failedLoginAttempts.Add(1, new KeyValuePair<string, object?>("username", username));
    }
}
```

## Security Compliance

### GDPR Compliance
```csharp
public class GdprService
{
    public async Task<bool> DeleteUserDataAsync(string userId)
    {
        // Implementation for data deletion
        await DeletePersonalDataAsync(userId);
        await AnonymizeHistoricalDataAsync(userId);
        return true;
    }

    public async Task<UserDataExport> ExportUserDataAsync(string userId)
    {
        // Implementation for data export
        return new UserDataExport
        {
            PersonalData = await GetPersonalDataAsync(userId),
            ActivityHistory = await GetActivityHistoryAsync(userId)
        };
    }
}
```

### PCI DSS Compliance (if handling payments)
```csharp
public class PaymentService
{
    // Never store credit card data
    public async Task<PaymentResult> ProcessPaymentAsync(PaymentRequest request)
    {
        // Use tokenization for card data
        var token = await TokenizeCardDataAsync(request.CardData);
        
        // Process payment through PCI-compliant gateway
        return await ProcessTokenizedPaymentAsync(token, request.Amount);
    }
}
```

## Best Practices

### Security Development Lifecycle
- Perform security analysis during code reviews
- Use static analysis tools in CI/CD pipeline
- Regularly update dependencies to patch vulnerabilities
- Implement security testing in automated test suites
- Monitor security metrics and set up alerts

### Incident Response
- Have a security incident response plan
- Log security events for forensic analysis
- Implement automated blocking for suspicious activity
- Regular security assessments and penetration testing
- Staff training on security best practices

### Secure Coding Guidelines
- Never trust user input - validate and sanitize everything
- Use parameterized queries to prevent SQL injection
- Implement proper authentication and authorization
- Use HTTPS for all communication
- Store sensitive data securely with proper encryption
- Follow the principle of least privilege
- Keep security libraries and frameworks up to date