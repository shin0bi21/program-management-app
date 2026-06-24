/**
 * Shared Express app factory for all test suites.
 * Each suite imports this to get a fresh app with routes mounted.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../../src/routes/authRoutes';
import publicRoutes from '../../src/routes/publicRoutes';
import staffRoutes from '../../src/routes/staffRoutes';
import youthRoutes from '../../src/routes/youthRoutes';
import schoolRoutes from '../../src/routes/schoolRoutes';
import { handleError } from '../../src/middleware/errorMiddleware';
import { requestId } from '../../src/middleware/routeMiddleware';

export function createApp() {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/staff', staffRoutes);
  app.use('/api/youth', youthRoutes);
  app.use('/api/schools', schoolRoutes);
  app.use(handleError);
  return app;
}
