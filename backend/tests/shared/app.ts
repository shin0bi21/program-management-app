/**
 * Shared Express app factory for all test suites.
 * Each suite imports this to get a fresh app with routes mounted.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../../src/routes/authRoutes';
import expressionOfInterestRoutes from '../../src/routes/expressionOfInterestRoutes';
import publicRoutes from '../../src/routes/publicRoutes';
import accountRoutes from '../../src/routes/accountRoutes';
import youthRoutes from '../../src/routes/youthRoutes';
import schoolRoutes from '../../src/routes/schoolRoutes';
import leadRoutes from '../../src/routes/leadRoutes';
import programRoutes from '../../src/routes/programRoutes';
import cohortRoutes from '../../src/routes/cohortRoutes';
import { handleError } from '../../src/middleware/errorMiddleware';
import { requestId } from '../../src/middleware/routeMiddleware';

export function createApp() {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/expressions-of-interest', expressionOfInterestRoutes);
  app.use('/api/public', publicRoutes);
  app.use('/api/accounts', accountRoutes);
  app.use('/api/youth', youthRoutes);
  app.use('/api/schools', schoolRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api/programs', programRoutes);
  app.use('/api/cohorts', cohortRoutes);
  app.use(handleError);
  return app;
}
