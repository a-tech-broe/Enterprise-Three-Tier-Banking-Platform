"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = requestLogger;
function requestLogger(req, res, next) {
    const start = Date.now();
    res.on('finish', () => {
        const ms = Date.now() - start;
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
        process.stdout.write(JSON.stringify({
            ts: new Date().toISOString(),
            level,
            method: req.method,
            path: req.path,
            status: res.statusCode,
            ms,
            userId: req.auth?.userId ?? null,
            ip: req.headers['x-forwarded-for']?.split(',')[0].trim()
                ?? req.socket.remoteAddress
                ?? null,
            ua: req.headers['user-agent'] ?? null,
        }) + '\n');
    });
    next();
}
