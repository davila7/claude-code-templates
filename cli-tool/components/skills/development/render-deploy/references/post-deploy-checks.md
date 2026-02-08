# Post-deploy checks

Use this after any deploy or service creation. Keep it short; stop when a check fails.

## 1) Confirm deploy status

```
list_deploys(serviceId: "<service-id>", limit: 1)
```

- Expect `status: "live"`.
- If status is failed, inspect build/runtime logs immediately.

## 2) Verify service health

- Hit the health endpoint (preferred) or `/` and confirm a 200 response.
- If there is no health endpoint, add one and redeploy.

## 3) Scan recent error logs

```
list_logs(resource: ["<service-id>"], level: ["error"], limit: 50)
```

- If you see a clear error signature, jump to the matching fix in
  [troubleshooting-basics.md](troubleshooting-basics.md) or
  [error-patterns.md](error-patterns.md).

## 4) Verify env vars and port binding

- Confirm all required env vars are set (especially secrets marked `sync: false`).
- Ensure the app binds to `0.0.0.0:$PORT` (not localhost).

## 5) Redeploy only after fixing the first failure

- Avoid repeated deploys without changes; fix one issue at a time.
