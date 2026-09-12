/** Server entrypoint: opens the database, then binds the HTTP listener. */

import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabase, getDatabase } from './models/db.js';
import { closeMongo, connectMongo } from './models/mongo.js';
import { closeBrowser } from './services/scraper/browserPool.js';

getDatabase();
if (env.mongodbUri) {
  void connectMongo();
}

const app = createApp();

if (process.env.VERCEL && !env.razorpayKeySecret) {
  console.warn(
    '[bodha-ai] RAZORPAY_KEY_SECRET is not set on a deployed instance — ' +
      'billingRoutes treats every "order_dev_*" id as paid, so anyone signed in ' +
      'can upgrade to Pro for free until this is configured.',
  );
}

if (!process.env.VERCEL) {
  const server = app.listen(env.port, '0.0.0.0', () => {
    console.log('[bodha-ai] API listening on http://0.0.0.0:' + env.port);
    console.log('[bodha-ai] allowed origins: ' + env.corsOrigins.join(', '));
  });

  const shutdown = (signal: string): void => {
    console.log('[bodha-ai] ' + signal + ' received, shutting down');
    server.close(() => {
      closeDatabase();
      void closeMongo();
      void closeBrowser().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

export default app;
