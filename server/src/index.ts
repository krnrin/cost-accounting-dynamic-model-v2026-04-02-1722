import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config.js';
import { errorHandler } from './middleware/errorHandler.js';

// Routes
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import scenarioRoutes, { compareRouter as scenarioCompareRoutes } from './routes/scenarios.js';
import harnessRoutes from './routes/harnesses.js';
import scenarioBomRoutes, { bomRowRouter } from './routes/bom.js';
import quoteRoutes from './routes/quotes.js';
import scenarioAllocationRoutes, { allocationRouter } from './routes/allocations.js';
import versionRoutes from './routes/versions.js';
import recoveryRoutes from './routes/recoveries.js';
import syncRoutes from './routes/sync.js';
import feishuRoutes from './routes/feishu.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
  origin: config.CORS_ORIGIN,
  credentials: true,
}));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/projects/:id/scenarios', scenarioRoutes);
app.use('/api/scenarios', scenarioCompareRoutes);
app.use('/api/scenarios/:sid/bom', scenarioBomRoutes);
app.use('/api/bom', bomRowRouter);
app.use('/api/scenarios/:sid/allocations', scenarioAllocationRoutes);
app.use('/api/allocations', allocationRouter);
app.use('/api/allocations', recoveryRoutes);
app.use('/api/projects/:pid/harnesses', harnessRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/versions', versionRoutes);
app.use('/api/sync', syncRoutes);
app.use('/api/feishu', feishuRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Global Error Handler
app.use(errorHandler);

// Start server
const server = app.listen(config.PORT, () => {
  console.log(`\n  🚀 Server running on http://localhost:${config.PORT}`);
  console.log(`  📦 Database: SQLite`);
  console.log(`  🌐 CORS: ${config.CORS_ORIGIN}`);
  console.log(`  🔧 Mode: ${config.NODE_ENV}\n`);
});

process.on('unhandledRejection', (err: any) => {
  console.error('Unhandled Rejection:', err?.message || err);
  server.close(() => process.exit(1));
});
