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
import scenarioChangeRoutes, { changeRouter } from './routes/changes.js';
import scenarioTrackingRoutes, { trackingRouter } from './routes/tracking.js';
import scenarioSimulationRoutes, { simulationRouter } from './routes/simulations.js';
import scenarioAnnualDropRoutes, { annualDropRouter } from './routes/annualDrops.js';
import syncRoutes from './routes/sync.js';
import settingsRoutes from './routes/settings.js';
import alertRuleRoutes from './routes/alertRules.js';
import projectAlertsRoutes, { alertsRouter } from './routes/alerts.js';
import managerDashboardRoutes from './routes/managerDashboard.js';
import feishuRoutes from './routes/feishu.js';
import profileRoutes from './routes/profile.js';
import userRoutes from './routes/users.js';
import exportRoutes from './routes/export.js';
import pricingRoutes, { scenarioPricingRouter } from './routes/pricing.js';

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
app.use('/api/scenarios/:sid/simulations', scenarioSimulationRoutes);
app.use('/api/simulations', simulationRouter);
app.use('/api/scenarios/:sid/annual-drops', scenarioAnnualDropRoutes);
app.use('/api/annual-drops', annualDropRouter);
app.use('/api/scenarios/:sid/allocations', scenarioAllocationRoutes);
app.use('/api/allocations', allocationRouter);
app.use('/api/allocations', recoveryRoutes);
app.use('/api/projects/:id/scenarios/:sid/changes', scenarioChangeRoutes);
app.use('/api/changes', changeRouter);
app.use('/api/projects/:id/scenarios/:sid/tracking', scenarioTrackingRoutes);
app.use('/api/tracking', trackingRouter);
app.use('/api/projects/:pid/harnesses', harnessRoutes);
app.use('/api/quotes', quoteRoutes);
app.use('/api/versions', versionRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/projects/:id/alerts', projectAlertsRoutes);
app.use('/api/alert-rules', alertRuleRoutes);
app.use('/api/alerts', alertsRouter);
app.use('/api/manager-dashboard', managerDashboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/users', userRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/projects/:id/pricing', pricingRoutes);
app.use('/api/projects/:id/scenarios/:sid/pricing', scenarioPricingRouter);
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
