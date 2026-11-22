import 'dotenv/config';
import { createApp } from './app.js';
import { initializeDatabase, pool } from './db.js';

const port = Number(process.env.PORT ?? 3001);
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) {
  throw new Error('JWT_SECRET must be set to a secret of at least 32 characters.');
}

await initializeDatabase();
const app = createApp({
  pool,
  jwtSecret,
  cookieSecure: process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true',
  staticDir: process.env.STATIC_DIR,
});

app.listen(port, () => {
  console.log(`Application Tracker API listening on port ${port}`);
});
