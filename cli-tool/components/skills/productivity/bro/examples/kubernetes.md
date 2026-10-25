# Example: Kubernetes / DevOps

## Before

> The CrashLoopBackOff stems from the liveness probe's failure threshold being exceeded due to the application's blocking initialization sequence, which starves the kubelet's health-check endpoint of a timely response within the configured `initialDelaySeconds` and `periodSeconds` window. Remediation involves either extending the probe's tolerance parameters or offloading initialization to an init container.

## `/bro`

## After

> Bro, your app takes too long to start up. Kubernetes keeps asking "you alive?" and your app is too busy booting to answer, so k8s kills it and restarts it — over and over. That's the CrashLoopBackOff. Two fixes: give it more time before k8s starts asking (bump `initialDelaySeconds` / the failure threshold), or move the slow startup work into an init container so the app itself boots fast.
