# Legacy Setup Instructions (Snapshot v1.0.0 - STALE)

> [!WARNING] STALE SETUP DOCUMENTATION
> These instructions are outdated and reflect an obsolete development environment. Use snapshot v1.4.0 for active development.

## Outdated Prerequisites
- Node.js: v14.18.0 (Deprecated)
- npm: v6.14.0
- Docker Compose: v1.29 (Obsolete schema v2)

## Legacy Steps
1. Run `npm install --legacy-peer-deps`
2. Start containers: `docker-compose -f docker-compose.legacy.yml up -d`
3. Launch server with global nodemon: `nodemon index.js`
