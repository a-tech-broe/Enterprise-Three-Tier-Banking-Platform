import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import weatherRouter from './routes/weather';
import notamsRouter from './routes/notams';
import airportsRouter from './routes/airports';
import historyRouter from './routes/history';
import windsRouter from './routes/winds';
import mapRouter from './routes/map';
import voiceRouter from './routes/voice';
import obsRouter from './routes/obs';
import replayRouter from './routes/replay';
import { startSnapshotCollector } from './services/snapshotCollector';
import authRouter from './routes/auth';
import { requireAuth } from './middleware/requireAuth';
import { errorHandler } from './middleware/errorHandler';
import { initDb } from './db/pool';
import { requestLogger } from './middleware/logger';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(requestLogger);

app.get('/health', (_, res) => res.json({ status: 'ok', service: 'SkyBroe API' }));

// Auth routes — no token required
app.use('/api/auth', authRouter);

// All remaining API routes require a valid JWT
app.use('/api/weather',  requireAuth, weatherRouter);
app.use('/api/notams',   requireAuth, notamsRouter);
app.use('/api/airports', requireAuth, airportsRouter);
app.use('/api/history',  requireAuth, historyRouter);
app.use('/api/winds',    requireAuth, windsRouter);
app.use('/api/map',      requireAuth, mapRouter);
app.use('/api/voice',    requireAuth, voiceRouter);
app.use('/api/obs',      requireAuth, obsRouter);
app.use('/api/replay',   requireAuth, replayRouter);

app.use(errorHandler);

initDb()
  .then(() => {
    startSnapshotCollector();
    app.listen(PORT, () => console.log(`SkyBroe API running on port ${PORT}`));
  })
  .catch((err) => { console.error('DB init failed:', err); process.exit(1); });
