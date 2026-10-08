import { env } from './config/env.js';
import { connectDb } from './config/db.js';
import { createApp } from './app.js';

const app = await createApp();
await connectDb();

app.listen(env.PORT, () => {
  console.log(`[server] listening on http://localhost:${env.PORT}  (health: /api/health)`);
});
