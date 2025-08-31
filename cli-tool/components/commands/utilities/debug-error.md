# Systematically Debug and Fix Errors

Systematically debug and fix errors

## Instructions

Follow this comprehensive debugging methodology to resolve: **$ARGUMENTS**

1. **Error Information Gathering**
   - Collect the complete error message, stack trace, and error code
   - Note when the error occurs (timing, conditions, frequency)
   - Identify the environment where the error happens (dev, staging, prod)
   - Gather relevant logs from before and after the error

2. **Reproduce the Error**
   - Create a minimal test case that reproduces the error consistently
   - Document the exact steps needed to trigger the error
   - Test in different environments if possible
   - Note any patterns or conditions that affect error occurrence

3. **Stack Trace Analysis**
   - Read the stack trace from bottom to top to understand the call chain
   - Identify the exact line where the error originates
   - Trace the execution path leading to the error
   - Look for any obvious issues in the failing code

4. **Code Context Investigation**
   - Examine the code around the error location
   - Check recent changes that might have introduced the bug
   - Review variable values and state at the time of error
   - Analyze function parameters and return values

5. **Hypothesis Formation**
   - Based on evidence, form hypotheses about the root cause
   - Consider common causes:
     - Null pointer/undefined reference
     - Type mismatches
     - Race conditions
     - Resource exhaustion
     - Logic errors
     - External dependency failures

6. **Debugging Tools Setup**
   - Set up appropriate debugging tools for the technology stack
   - Use debugger, profiler, or logging as needed
   - Configure breakpoints at strategic locations
   - Set up monitoring and alerting if not already present

7. **Systematic Investigation**
   - Test each hypothesis methodically
   - Use binary search approach to isolate the problem
   - Add strategic logging or print statements
   - Check data flow and transformations step by step

8. **Data Validation**
   - Verify input data format and validity
   - Check for edge cases and boundary conditions
   - Validate assumptions about data state
   - Test with different data sets to isolate patterns

9. **Dependency Analysis**
   - Check external dependencies and their versions
   - Verify network connectivity and API availability
   - Review configuration files and environment variables
   - Test database connections and query execution

10. **Memory and Resource Analysis**
    - Check for memory leaks or excessive memory usage
    - Monitor CPU and I/O resource consumption
    - Analyze garbage collection patterns if applicable
    - Check for resource deadlocks or contention

11. **Concurrency Issues Investigation**
    - Look for race conditions in multi-threaded code
    - Check synchronization mechanisms and locks
    - Analyze async operations and promise handling
    - Test under different load conditions

12. **Root Cause Identification**
    - Once the cause is identified, understand why it happened
    - Determine if it's a logic error, design flaw, or external issue
    - Assess the scope and impact of the problem
    - Consider if similar issues exist elsewhere

13. **Solution Implementation**
    - Design a fix that addresses the root cause
    - Consider multiple solution approaches and trade-offs
    - Implement the fix with appropriate error handling
    - Add validation and defensive programming where needed

14. **Testing the Fix**
    - Test the fix against the original error case
    - Test edge cases and related scenarios
    - Run regression tests to ensure no new issues
    - Test under various load and stress conditions

15. **Prevention Measures**
    - Add appropriate unit and integration tests
    - Improve error handling and logging
    - Add input validation and defensive checks
    - Update documentation and code comments

16. **Monitoring and Alerting**
    - Set up monitoring for similar issues
    - Add metrics and health checks
    - Configure alerts for error thresholds
    - Implement better observability

17. **Documentation**
    - Document the error, investigation process, and solution
    - Update troubleshooting guides
    - Share learnings with the team
    - Update code comments with context

18. **Post-Resolution Review**
    - Analyze why the error wasn't caught earlier
    - Review development and testing processes
    - Consider improvements to prevent similar issues
    - Update coding standards or guidelines if needed

Remember to maintain detailed notes throughout the debugging process and consider the wider implications of both the error and the fix.