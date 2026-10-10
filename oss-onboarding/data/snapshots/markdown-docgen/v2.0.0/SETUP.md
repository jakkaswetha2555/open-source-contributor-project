# Local Setup & Installation - Markdown Docgen (v2.0.0)

## Prerequisites
- **Node.js**: v20.x or higher
- **npm**: v10.x or higher
- **Git**: v2.30 or higher

## Getting Started

1. **Clone the repository:**
   ```bash
   git clone https://github.com/oss-hub/markdown-docgen.git
   cd markdown-docgen
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Link CLI locally for testing:**
   ```bash
   npm link
   ```
   Now you can execute `docgen` directly in any project folder:
   ```bash
   docgen --help
   ```

4. **Run test suite:**
   ```bash
   npm test
   ```

## Development Workflow
- When modifying parsers or CLI commands, run `npm run build:watch` to continuously compile TypeScript and ES module bundles.
