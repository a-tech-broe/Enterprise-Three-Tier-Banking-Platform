"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const weather_1 = __importDefault(require("./routes/weather"));
const notams_1 = __importDefault(require("./routes/notams"));
const airports_1 = __importDefault(require("./routes/airports"));
const history_1 = __importDefault(require("./routes/history"));
const winds_1 = __importDefault(require("./routes/winds"));
const map_1 = __importDefault(require("./routes/map"));
const voice_1 = __importDefault(require("./routes/voice"));
const obs_1 = __importDefault(require("./routes/obs"));
const replay_1 = __importDefault(require("./routes/replay"));
const snapshotCollector_1 = require("./services/snapshotCollector");
const auth_1 = __importDefault(require("./routes/auth"));
const requireAuth_1 = require("./middleware/requireAuth");
const errorHandler_1 = require("./middleware/errorHandler");
const pool_1 = require("./db/pool");
const logger_1 = require("./middleware/logger");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(logger_1.requestLogger);
app.get('/health', (_, res) => res.json({ status: 'ok', service: 'SkyBroe API' }));
// Auth routes — no token required
app.use('/api/auth', auth_1.default);
// All remaining API routes require a valid JWT
app.use('/api/weather', requireAuth_1.requireAuth, weather_1.default);
app.use('/api/notams', requireAuth_1.requireAuth, notams_1.default);
app.use('/api/airports', requireAuth_1.requireAuth, airports_1.default);
app.use('/api/history', requireAuth_1.requireAuth, history_1.default);
app.use('/api/winds', requireAuth_1.requireAuth, winds_1.default);
app.use('/api/map', requireAuth_1.requireAuth, map_1.default);
app.use('/api/voice', requireAuth_1.requireAuth, voice_1.default);
app.use('/api/obs', requireAuth_1.requireAuth, obs_1.default);
app.use('/api/replay', requireAuth_1.requireAuth, replay_1.default);
app.use(errorHandler_1.errorHandler);
(0, pool_1.initDb)()
    .then(() => {
    (0, snapshotCollector_1.startSnapshotCollector)();
    app.listen(PORT, () => console.log(`SkyBroe API running on port ${PORT}`));
})
    .catch((err) => { console.error('DB init failed:', err); process.exit(1); });
