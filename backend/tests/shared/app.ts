/**
 * Shared Express app factory for all test suites.
 * Each suite imports this to get a fresh app with routes mounted.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../../src/routes/authRoutes';
import userRoutes from '../../src/routes/userRoutes';

export function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/users', userRoutes);
  return app;
}
