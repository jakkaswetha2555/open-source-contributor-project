# Setup & Installation Guide - Express Query Kit (v1.4.0)

Follow these steps to set up your local development environment for Express Query Kit.

## System Prerequisites
- **Node.js**: v20.x or higher (LTS recommended).
- **npm**: v10.x or higher.
- **Git**: v2.30 or higher.
- **Docker**: Optional, for running local MongoDB test containers.

## Step-by-Step Local Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/oss-hub/express-query-kit.git
   cd express-query-kit
   ```

2. **Install project dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Copy the example environment configuration:
   ```bash
   cp .env.example .env
   ```
   Default development variables:
   - `PORT=5000`
   - `NODE_ENV=development`
   - `DEBUG=express-query-kit:*`

4. **Run Unit Tests:**
   Verify your setup works by running the test runner:
   ```bash
   npm test
   ```

5. **Start Development Watcher:**
   ```bash
   npm run dev
   ```

## Common Issues
- **Node.js version mismatch:** Ensure you are running Node 20 (`node -v`). If you have Node 14 or 16 installed, update with `nvm install 20 && nvm use 20`.
- **Module Resolution:** We use ES Modules (`"type": "module"`). Always use explicit `.js` extensions in local file imports.
