import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';

const app = express();

// ==========================================
// 1. STEP ONE: Security & Headers
// ==========================================
app.use(helmet());

// ==========================================
// 2. STEP TWO: Body Parsing
// ==========================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ==========================================
// 3. STEP THREE: CORS Configuration
// ==========================================
const allowedOrigins = [
  'http://localhost:3000',
  process.env.CLIENT_ORIGIN // e.g., your Netlify or Render frontend
].filter(Boolean) as string[];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// ==========================================
// 4. STEP FOUR: Health Check & Routes
// ==========================================
// Render health check ping
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date() });
});

// Mount your API routes here (e.g., app.use('/api/v1', apiRouter))

// ==========================================
// 5. STEP FIVE: Error Handling
// ==========================================
// 404 Catch-all
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

export default app;
