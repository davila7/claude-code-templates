# Performance Analysis

Comprehensive performance analysis and optimization workflow for .NET Core applications.

## Purpose

This command performs detailed performance analysis including memory profiling, CPU analysis, database query optimization, and application bottleneck identification.

## Usage

```
/performance-check
```

## What this command does

1. **Analyzes memory usage** and garbage collection patterns
2. **Profiles CPU performance** and identifies bottlenecks
3. **Monitors database queries** and connection pooling
4. **Measures response times** and throughput
5. **Provides optimization recommendations** based on findings

## Example Commands

### Memory Analysis
```bash
# Install performance tools
dotnet tool install -g dotnet-counters
dotnet tool install -g dotnet-trace
dotnet tool install -g dotnet-dump
dotnet tool install -g dotnet-gcdump

# Monitor memory counters in real-time
dotnet-counters monitor --process-id <pid> --counters System.Runtime[gc-heap-size,gen-0-gc-count,gen-1-gc-count,gen-2-gc-count,exception-count]

# Collect memory dump
dotnet-dump collect --process-id <pid> --output memory-dump.dmp

# Analyze GC performance
dotnet-gcdump collect --process-id <pid> --output gc-analysis.gcdump
```

### CPU Profiling
```bash
# Collect CPU trace for 30 seconds
dotnet-trace collect --process-id <pid> --duration 00:00:30 --output cpu-trace.nettrace

# Collect trace with specific providers
dotnet-trace collect --process-id <pid> --providers Microsoft-AspNetCore-Server-Kestrel,Microsoft-Extensions-Logging

# Convert trace to speedscope format
dotnet-trace convert cpu-trace.nettrace --format speedscope
```

### Application Performance Monitoring
```bash
# Monitor key performance counters
dotnet-counters monitor --process-id <pid> --counters \
  System.Runtime[cpu-usage,working-set,gc-heap-size,exception-count] \
  Microsoft.AspNetCore.Hosting[requests-per-second,total-requests,current-requests] \
  Microsoft.AspNetCore.Http.Connections[connections-started,connections-stopped,connections-duration]
```

## Benchmark Testing

### BenchmarkDotNet Setup
```bash
# Add BenchmarkDotNet package
dotnet add package BenchmarkDotNet

# Create benchmark project structure
mkdir Benchmarks
cd Benchmarks
dotnet new console
dotnet add package BenchmarkDotNet
```

### Sample Benchmark Class
```csharp
using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Running;

[MemoryDiagnoser]
[SimpleJob(BenchmarkDotNet.Jobs.RuntimeMoniker.Net80)]
public class PerformanceBenchmarks
{
    private readonly List<int> _data;
    
    public PerformanceBenchmarks()
    {
        _data = Enumerable.Range(1, 10000).ToList();
    }

    [Benchmark]
    public int ForLoop()
    {
        var sum = 0;
        for (int i = 0; i < _data.Count; i++)
        {
            sum += _data[i];
        }
        return sum;
    }

    [Benchmark]
    public int LinqSum() => _data.Sum();

    [Benchmark]
    public int ParallelLinqSum() => _data.AsParallel().Sum();
}

// Program.cs
class Program
{
    static void Main(string[] args)
    {
        BenchmarkRunner.Run<PerformanceBenchmarks>();
    }
}
```

### Run Benchmarks
```bash
# Run benchmarks in Release mode
dotnet run -c Release

# Export results to different formats
dotnet run -c Release -- --exporters json html csv

# Run specific benchmark methods
dotnet run -c Release -- --filter "*ForLoop*"
```

## Database Performance Analysis

### Entity Framework Monitoring
```bash
# Enable sensitive data logging (development only)
dotnet run --environment Development --logging:loglevel:Microsoft.EntityFrameworkCore.Database.Command=Information

# Add performance counters for EF Core
dotnet-counters monitor --process-id <pid> --counters Microsoft.EntityFrameworkCore[active-db-contexts,total-queries,queries-per-second,total-save-changes,optimistic-concurrency-failures]
```

### SQL Query Analysis
```csharp
// Enable detailed query logging
public class AppDbContext : DbContext
{
    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        optionsBuilder
            .EnableSensitiveDataLogging() // Development only
            .EnableDetailedErrors()
            .LogTo(Console.WriteLine, LogLevel.Information);
    }
}
```

### Connection Pool Monitoring
```csharp
// Configure connection pool settings
services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlServer(connectionString, sqlOptions =>
    {
        sqlOptions.CommandTimeout(30);
    });
}, ServiceLifetime.Scoped);

// Monitor connection pool
dotnet-counters monitor --process-id <pid> --counters System.Data.SqlClient.SqlConnection[NumberOfActiveConnectionPools,NumberOfInactiveConnectionPools,NumberOfActiveConnections,NumberOfFreeConnections]
```

## Web Application Performance

### ASP.NET Core Metrics
```bash
# Monitor web application performance
dotnet-counters monitor --process-id <pid> --counters \
  Microsoft.AspNetCore.Hosting[requests-per-second,total-requests,failed-requests] \
  Microsoft.AspNetCore.Http.Connections[connections-started,connections-stopped] \
  Microsoft.AspNetCore.Server.Kestrel[connections-per-second,total-connections,current-connections]
```

### Response Time Analysis
```csharp
// Add response time middleware
public class ResponseTimeMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ResponseTimeMiddleware> _logger;

    public ResponseTimeMiddleware(RequestDelegate next, ILogger<ResponseTimeMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var stopwatch = Stopwatch.StartNew();
        
        await _next(context);
        
        stopwatch.Stop();
        var responseTime = stopwatch.ElapsedMilliseconds;
        
        _logger.LogInformation("Request {Method} {Path} took {ResponseTime}ms", 
            context.Request.Method, 
            context.Request.Path, 
            responseTime);
            
        context.Response.Headers.Add("X-Response-Time", $"{responseTime}ms");
    }
}
```

### Load Testing
```bash
# Install bombardier for load testing
go install github.com/codesenberg/bombardier@latest

# Basic load test
bombardier -c 125 -n 10000 http://localhost:5000/api/users

# Advanced load test with JSON payload
bombardier -c 50 -n 1000 -m POST -H "Content-Type: application/json" -f body.json http://localhost:5000/api/users

# Stress test with duration
bombardier -c 200 -d 60s http://localhost:5000/
```

## Memory Optimization

### Memory Leak Detection
```bash
# Collect baseline memory dump
dotnet-dump collect --process-id <pid> --output baseline.dmp

# Run application under load
# ... wait for some time ...

# Collect another memory dump
dotnet-dump collect --process-id <pid> --output after-load.dmp

# Analyze memory dumps for leaks
dotnet-dump analyze baseline.dmp
> dumpheap -stat
> dumpheap -mt <method_table_address>
```

### Garbage Collection Analysis
```bash
# Collect GC dump during high memory usage
dotnet-gcdump collect --process-id <pid> --output high-memory.gcdump

# Analyze GC dump with Visual Studio or PerfView
# Look for:
# - Large Object Heap (LOH) usage
# - Generation 2 collection frequency
# - Finalization queue length
```

### Memory Profiling Script
```bash
#!/bin/bash
# memory-profile.sh

PID=$1
DURATION=${2:-60}
OUTPUT_DIR="memory-analysis-$(date +%Y%m%d-%H%M%S)"

mkdir -p $OUTPUT_DIR

echo "Starting memory profiling for PID $PID for ${DURATION}s..."

# Collect baseline counters
dotnet-counters collect --process-id $PID --output "$OUTPUT_DIR/counters.csv" --format csv --counters System.Runtime &
COUNTERS_PID=$!

# Collect GC information
dotnet-gcdump collect --process-id $PID --output "$OUTPUT_DIR/gc-dump.gcdump" &

# Wait for specified duration
sleep $DURATION

# Stop counter collection
kill $COUNTERS_PID

# Collect final memory dump
dotnet-dump collect --process-id $PID --output "$OUTPUT_DIR/memory-dump.dmp"

echo "Memory profiling complete. Results in $OUTPUT_DIR/"
```

## Performance Optimization Techniques

### Async/Await Optimization
```csharp
// Good: Proper async usage
public async Task<User> GetUserAsync(int id)
{
    return await _dbContext.Users.FindAsync(id);
}

// Better: ConfigureAwait(false) in library code
public async Task<User> GetUserAsync(int id)
{
    return await _dbContext.Users.FindAsync(id).ConfigureAwait(false);
}

// Best: Avoid async overhead for synchronous operations
public User GetUser(int id)
{
    return _dbContext.Users.Find(id); // Synchronous when possible
}
```

### Memory Allocation Optimization
```csharp
// Use object pooling for frequently created objects
public class ObjectPoolService
{
    private readonly ObjectPool<StringBuilder> _stringBuilderPool;
    
    public ObjectPoolService(ObjectPool<StringBuilder> stringBuilderPool)
    {
        _stringBuilderPool = stringBuilderPool;
    }
    
    public string ProcessData(IEnumerable<string> data)
    {
        var sb = _stringBuilderPool.Get();
        try
        {
            foreach (var item in data)
            {
                sb.Append(item);
            }
            return sb.ToString();
        }
        finally
        {
            _stringBuilderPool.Return(sb);
        }
    }
}

// Use Span<T> and Memory<T> for high-performance scenarios
public void ProcessBytes(ReadOnlySpan<byte> data)
{
    // Process without allocating arrays
    for (int i = 0; i < data.Length; i++)
    {
        // Process data[i]
    }
}
```

### Database Query Optimization
```csharp
// Use projection to load only needed data
var users = await _dbContext.Users
    .Select(u => new UserDto { Id = u.Id, Name = u.Name })
    .ToListAsync();

// Use compiled queries for frequently executed queries
private static readonly Func<AppDbContext, int, Task<User>> GetUserById =
    EF.CompileAsyncQuery((AppDbContext context, int id) =>
        context.Users.First(u => u.Id == id));

// Use batch operations
_dbContext.Users.AddRange(newUsers);
await _dbContext.SaveChangesAsync();
```

## Performance Monitoring Dashboard

### Application Insights Integration
```csharp
// Program.cs
builder.Services.AddApplicationInsightsTelemetry();

// Custom performance tracking
public class PerformanceService
{
    private readonly TelemetryClient _telemetryClient;
    
    public async Task<T> TrackPerformance<T>(string operationName, Func<Task<T>> operation)
    {
        using var activity = _telemetryClient.StartOperation<DependencyTelemetry>(operationName);
        var stopwatch = Stopwatch.StartNew();
        
        try
        {
            var result = await operation();
            activity.Telemetry.Success = true;
            return result;
        }
        catch (Exception ex)
        {
            activity.Telemetry.Success = false;
            _telemetryClient.TrackException(ex);
            throw;
        }
        finally
        {
            activity.Telemetry.Duration = stopwatch.Elapsed;
        }
    }
}
```

### Custom Performance Counters
```csharp
public class CustomPerformanceCounters
{
    private readonly Counter<int> _requestCounter;
    private readonly Histogram<double> _requestDuration;
    
    public CustomPerformanceCounters(IMeterFactory meterFactory)
    {
        var meter = meterFactory.Create("MyApp.Performance");
        _requestCounter = meter.CreateCounter<int>("requests_total");
        _requestDuration = meter.CreateHistogram<double>("request_duration_seconds");
    }
    
    public void RecordRequest(string endpoint, double duration)
    {
        _requestCounter.Add(1, new KeyValuePair<string, object?>("endpoint", endpoint));
        _requestDuration.Record(duration, new KeyValuePair<string, object?>("endpoint", endpoint));
    }
}
```

## Performance Report Generation

### Automated Performance Report
```bash
#!/bin/bash
# performance-report.sh

APP_PID=$1
REPORT_DIR="performance-report-$(date +%Y%m%d-%H%M%S)"
mkdir -p $REPORT_DIR

echo "Generating performance report for PID $APP_PID..."

# Collect system metrics
echo "System Information:" > $REPORT_DIR/system-info.txt
uname -a >> $REPORT_DIR/system-info.txt
free -h >> $REPORT_DIR/system-info.txt
nproc >> $REPORT_DIR/system-info.txt

# Collect .NET runtime information
dotnet --info > $REPORT_DIR/dotnet-info.txt

# Collect performance counters for 60 seconds
dotnet-counters collect --process-id $APP_PID --output $REPORT_DIR/counters.csv --format csv --duration 60

# Collect CPU trace
dotnet-trace collect --process-id $APP_PID --output $REPORT_DIR/cpu-trace.nettrace --duration 30

# Collect memory dump
dotnet-dump collect --process-id $APP_PID --output $REPORT_DIR/memory-dump.dmp

# Generate summary
echo "Performance analysis completed at $(date)" > $REPORT_DIR/summary.txt
echo "Files generated:" >> $REPORT_DIR/summary.txt
ls -la $REPORT_DIR >> $REPORT_DIR/summary.txt

echo "Performance report generated in $REPORT_DIR/"
```

## Best Practices

### Monitoring Guidelines
- Establish performance baselines for key metrics
- Monitor both development and production environments
- Set up alerts for performance degradation
- Regularly review and analyze performance trends
- Use APM tools for comprehensive monitoring

### Optimization Strategies
- Profile before optimizing to identify real bottlenecks
- Focus on hot paths and frequently executed code
- Use appropriate data structures and algorithms
- Implement caching strategically
- Optimize database queries and connections
- Consider async patterns for I/O-bound operations

### Performance Testing
- Include performance tests in your CI/CD pipeline
- Test under realistic load conditions
- Monitor performance across different deployment environments
- Document performance requirements and SLAs
- Regularly update and maintain performance test suites