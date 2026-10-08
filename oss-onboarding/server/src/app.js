import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { loadRoutes } from './routes/index.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

export async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.use('/api', await loadRoutes());

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
