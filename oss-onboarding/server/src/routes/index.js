import { Router } from 'express';
import { readdirSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));

// Auto-mounts every `*.routes.js` file in this folder under /api.
// Each owner adds their own file (auth.routes.js, projects.routes.js, ...) with a default-exported
// express Router that uses FULL paths such as router.get('/projects', ...).
// Nobody edits this file, so there are no merge conflicts.
export async function loadRoutes() {
  const router = Router();
  const files = readdirSync(dir).filter((f) => f.endsWith('.routes.js')).sort();
  for (const file of files) {
    const mod = await import(pathToFileURL(path.join(dir, file)).href);
    router.use(mod.default);
    console.log(`[routes] mounted ${file}`);
  }
  return router;
}
