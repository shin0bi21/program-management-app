import 'dotenv/config'; 
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import authRoutes from './routes/authRoutes';
import staffRoutes from './routes/staffRoutes';
import youthRoutes from './routes/youthRoutes';
import schoolRoutes from './routes/schoolRoutes';

const app = express();
const PORT = process.env.PORT || 5001;

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

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});