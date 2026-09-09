/** Server entrypoint: opens the database, then binds the HTTP listener. */

import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabase, getDatabase } from './models/db.js';
import { closeBrowser } from './services/scraper/browserPool.js';

getDatabase();

const app = createApp();

if (!process.env.VERCEL) {
  const server = app.listen(env.port, () => {
    console.log('[bodha-ai] API listening on http://localhost:' + env.port);
    console.log('[bodha-ai] allowed origins: ' + env.corsOrigins.join(', '));
  });

  const shutdown = (signal: string): void => {
    console.log('[bodha-ai] ' + signal + ' received, shutting down');
    server.close(() => {
      closeDatabase();
      void closeBrowser().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

export default app;
