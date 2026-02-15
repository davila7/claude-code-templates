# Basic troubleshooting (deploy-time and startup)

Use this when a deploy fails, the service crashes on start, or health checks time out.
Keep fixes minimal and redeploy after each change.

## 1) Classify the failure

- **Build failure**: errors in build logs, missing dependencies, build command issues.
- **Startup failure**: app exits quickly, crashes, or cannot bind to `$PORT`.
- **Runtime/health failure**: service is live but health checks fail or 5xx errors.

## 2) Quick checks by class

**Build failure**
- Confirm the build command is correct for the runtime.
- Ensure required dependencies are present in `package.json`, `requirements.txt`, etc.
- Check for missing build-time env vars.

**Startup failure**
- Confirm the start command and working directory.
- Ensure port binding is `0.0.0.0:$PORT`.
- Check for missing runtime env vars (secrets, DB URLs).

**Runtime/health failure**
- Verify the health endpoint path and response.
- Confirm the app is actually listening on `$PORT`.
- Check database connectivity and migrations.

## 3) Map error signatures to fixes

Use [error-patterns.md](error-patterns.md) for a compact catalog of common log messages.

## 4) If still blocked

Gather the latest build logs and runtime error logs, then consider the optional
`render-debug` skill for deeper diagnostics (metrics, DB checks, expanded patterns).
