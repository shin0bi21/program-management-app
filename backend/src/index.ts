import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import authRoutes from './routes/authRoutes';
import staffRoutes from './routes/staffRoutes';
import youthRoutes from './routes/youthRoutes';
import schoolRoutes from './routes/schoolRoutes';
import { errorHandler, requestId } from './middleware/errorHandler';
import { sendError } from './errors/AppError';

const app = express();
const PORT = process.env.PORT || 5001;

// Assign a unique ID to every request — first middleware so all subsequent
// handlers can access res.locals.requestId for logging and error responses
app.use(requestId);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for now (configure later for frontend)
  crossOriginEmbedderPolicy: false, // Allow embedding for dev
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

// Health check endpoint for monitoring
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// --- Routes ---
app.use('/api/auth', authRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/youth', youthRoutes);
app.use('/api/schools', schoolRoutes);

// 404 handler — catches all unmatched routes before the error handler
app.use((req, res) => {
  sendError(res, 404, 'Not found');
});

// Global error handler — must be registered after all routes
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Catch synchronous crashes and unhandled rejections that escape Express entirely.
// These should never happen in normal flow — log and exit so the process manager restarts cleanly.
// Guarded from test environments: process.exit(1) would terminate the Jest runner mid-run.
if (process.env.NODE_ENV !== 'test') {
  process.on('uncaughtException', (err) => {
    console.error('[uncaughtException]', err);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[unhandledRejection]', reason);
    process.exit(1);
  });
}