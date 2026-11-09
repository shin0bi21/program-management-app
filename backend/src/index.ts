import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import authRoutes from './routes/authRoutes';
import accountRoutes from './routes/accountRoutes';
import youthRoutes from './routes/youthRoutes';
import schoolRoutes from './routes/schoolRoutes';
import programRoutes from './routes/programRoutes';
import leadRoutes from './routes/leadRoutes';
import cycleRoutes from './routes/cycleRoutes';
import sessionRoutes from './routes/sessionRoutes';
import homepageRoutes, { publicHomepageRoutes } from './routes/homepageRoutes';
import preferenceRoutes from './routes/preferenceRoutes';
import hoursRoutes from './routes/hoursRoutes';
import taskRoutes from './routes/taskRoutes';
import referenceDataRoutes from './routes/referenceDataRoutes';
import { asyncHandler, requestId } from './middleware/routeMiddleware';
import { handleError } from './middleware/errorMiddleware';
import { errorForLog, NotFoundError } from './errors';
import { checkConnection } from './db/client';

const app = express();
const PORT = process.env.PORT || 5001;
const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = new Set([frontendUrl, 'http://localhost:5173']);

// Assign a unique ID to every request — first middleware so all subsequent
// handlers can access res.locals.requestId for logging and error responses
app.use(requestId);
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now (configure later for frontend)
  crossOriginEmbedderPolicy: false, // Allow embedding for dev
}));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
// Full cycle attendance is larger than ordinary command payloads.
app.post('/api/programs/:programId/cycles/:cycleId/reports/youth.pdf', express.json({ limit: '5mb', type: 'application/json' }));
app.use(express.json({ limit: '20kb', type: 'application/json' }));
app.use(cookieParser());

// Health check endpoint — returns DB connectivity status for monitoring/diagnostics
app.get('/health', asyncHandler(async (_req, res) => {
  const dbOk = await checkConnection();
  const status = dbOk ? 200 : 503;
  res.status(status).json({
    status: dbOk ? 'ok' : 'degraded',
    db: dbOk ? 'connected' : 'unavailable',
  });
}));

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/public', publicHomepageRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/accounts', accountRoutes);
app.use('/api/youth', youthRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/cycles', cycleRoutes);
app.use('/api', sessionRoutes);
app.use('/api/homepage', homepageRoutes);
app.use('/api/preferences', preferenceRoutes);
app.use('/api/hours', hoursRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/reference-data', referenceDataRoutes);

// 404 handler — catches all unmatched routes; forwards to errorHandler
app.use((_req, _res, next) => {
  next(new NotFoundError('Not found'));
});

// Global error handler — must be registered after all routes
app.use(handleError);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Fatal runtime failures terminate the process so the process manager can restart it.
if (process.env.NODE_ENV !== 'test') {
  process.on('uncaughtException', (error: Error) => {
    console.error('[uncaughtException] Error terminating process', errorForLog(error));
    process.exit(1);
  });

  process.on('unhandledRejection', (error: Error) => {
    console.error('[unhandledRejection] Error terminating process', errorForLog(error));
    process.exit(1);
  });
}
