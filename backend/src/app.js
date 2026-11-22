import cookieParser from 'cookie-parser';
import express from 'express';
import { createAuthRouter, requireAuth } from './auth.js';
import { createApplicationsRouter } from './applications.js';
import { createStagesRouter } from './stages.js';

export function createApp({ pool, jwtSecret, cookieSecure = false }) {
  const app = express();

  app.use(express.json({ limit: '10kb' }));
  app.use(cookieParser());
  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', createAuthRouter({ pool, jwtSecret, cookieSecure }));

  app.use('/api/applications', requireAuth(jwtSecret), createApplicationsRouter({ pool }));
  app.use('/api/stages', requireAuth(jwtSecret), createStagesRouter({ pool }));

  app.use((error, _req, res, _next) => {
    console.error('Request failed:', error);
    return res.status(500).json({ error: 'An unexpected server error occurred.' });
  });

  return app;
}
