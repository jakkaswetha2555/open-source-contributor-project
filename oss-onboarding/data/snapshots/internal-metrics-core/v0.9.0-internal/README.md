# Internal Metrics Core (CONFIDENTIAL - RESTRICTED ACCESS)

> [!WARNING] PROPRIETARY AND CONFIDENTIAL
> This repository and documentation snapshot are private enterprise intellectual property.
> Unauthorized distribution, downloading, or access by contributors without approved MaintainerGrants is strictly prohibited.
> Security auditing and leakage tracking are active.

## Overview
Internal Metrics Core is a high-performance proprietary telemetry daemon designed for collecting infrastructure resource utilization, socket latency, and internal microservice health metrics across private cloud environments.

## Scope of Access
- **Public access:** FORBIDDEN. This repository must never appear in unauthenticated project listings or search queries.
- **Access Control:** Enforced strictly by `server/src/middleware/auth.js` and `visibility: 'private'` schema checks.
- **RAG Protection:** Unauthenticated contributors must never receive chunks, issues, or documents from this project.

## Internal Navigation
- [SETUP.md](SETUP.md) - Internal VPN and environment setup.
- [CONTRIBUTING.md](CONTRIBUTING.md) - Internal engineering guidelines and clearance protocols.
- [ARCHITECTURE.md](ARCHITECTURE.md) - Distributed daemon architecture and message queues.
- [SECURITY.md](SECURITY.md) - Zero-trust policy and confidential token rotation.
- [TELEMETRY.md](TELEMETRY.md) - Socket telemetry protocol and metric schema.
