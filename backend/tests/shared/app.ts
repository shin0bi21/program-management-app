/**
 * Shared Express app factory for all test suites.
 * Each suite imports this to get a fresh app with routes mounted.
 */
import express from 'express';
import cookieParser from 'cookie-parser';
import authRoutes from '../../src/routes/authRoutes';
import accountRoutes from '../../src/routes/accountRoutes';
import youthRoutes from '../../src/routes/youthRoutes';
import schoolRoutes from '../../src/routes/schoolRoutes';
import leadRoutes from '../../src/routes/leadRoutes';
import programRoutes from '../../src/routes/programRoutes';
import cycleRoutes from '../../src/routes/cycleRoutes';
import sessionRoutes from '../../src/routes/sessionRoutes';
import enrollmentRoutes from '../../src/routes/enrollmentRoutes';
import cohortRoutes from '../../src/routes/cohortRoutes';
import homepageRoutes, { publicHomepageRoutes } from '../../src/routes/homepageRoutes';
import preferenceRoutes from '../../src/routes/preferenceRoutes';
import hoursRoutes from '../../src/routes/hoursRoutes';
import taskRoutes from '../../src/routes/taskRoutes';
import { handleError } from '../../src/middleware/errorMiddleware';
import { requestId } from '../../src/middleware/routeMiddleware';

export function createApp() {
  const app = express();
  app.use(requestId);
  app.use(express.json({ limit: '20kb', type: 'application/json' }));
  app.use(cookieParser());
  app.use('/api/auth', authRoutes);
  app.use('/api/public', publicHomepageRoutes);
  app.use('/api/accounts', accountRoutes);
  app.use('/api/youth', youthRoutes);
  app.use('/api/schools', schoolRoutes);
  app.use('/api/leads', leadRoutes);
  app.use('/api/programs', programRoutes);
  app.use('/api/cohorts/cycles', cycleRoutes);
  app.use('/api/cohorts', sessionRoutes);
  app.use('/api/cohorts', enrollmentRoutes);
  app.use('/api/cohorts', cohortRoutes);
  app.use('/api/homepage', homepageRoutes);
  app.use('/api/preferences', preferenceRoutes);
  app.use('/api/hours', hoursRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use(handleError);
  return app;
}
