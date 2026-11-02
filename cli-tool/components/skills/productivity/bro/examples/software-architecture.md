# Example: software architecture

## Before

> The refactor introduces an idempotent reconciliation layer atop the event-sourced aggregate, thereby mitigating dual-write anomalies during the migration window while preserving backward compatibility with the legacy projection contract.

## `/bro`

## After

> Ok so basically: we added a safety layer that makes sure old and new data don't get out of sync while we're switching systems. Nothing breaks for anything still using the old system. That's it.
