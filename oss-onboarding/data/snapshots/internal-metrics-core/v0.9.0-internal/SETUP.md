# Internal Setup Guide - Metrics Core (Private)

## Security Prerequisites
- Internal Enterprise VPN connection active.
- Access token configured in local development environment.
- Node.js v20 LTS.

## Setup Instructions
1. Clone from internal enterprise repository:
   ```bash
   git clone git@internal-gitlab.corp:metrics/metrics-core.git
   cd metrics-core
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Load enterprise development credentials:
   ```bash
   npm run vault:auth
   ```
4. Start telemetry receiver in sandbox mode:
   ```bash
   npm run start:sandbox
   ```
