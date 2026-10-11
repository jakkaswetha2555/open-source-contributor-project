# Security Policy - Internal Metrics Core

## Data Sensitivity
All telemetry collected by Metrics Core is categorized as Highly Confidential.
- No metrics containing IP addresses or bearer tokens may be persisted to unencrypted logs.
- Automated secret scanning is enforced on every commit hook.

## Access Revocation
Upon role reassignment, MaintainerGrants are immediately shifted to `status: 'revoked'`. The security middleware terminates active sessions within 60 seconds.
