import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { env } from './config/env.js';
import { httpConfig } from './config/http.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { globalRateLimit } from './middleware/rate-limit.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.isProduction);

  app.use(requestIdMiddleware);
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsAllowedOrigins.length === 0 ? true : env.corsAllowedOrigins,
      credentials: false
    })
  );
  app.use(compression());
  app.use(express.json({ limit: httpConfig.jsonBodyLimit }));
  app.use(
    morgan(':method :url :status :response-time ms', {
      skip: (_req, res) => res.statusCode < 400
    })
  );
  app.use(globalRateLimit);

  app.use('/api/v1', apiRouter);
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
