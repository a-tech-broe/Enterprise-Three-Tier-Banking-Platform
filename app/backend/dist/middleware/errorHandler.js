"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
function errorHandler(err, _req, res, _next) {
    // Always log the full error server-side (shipped to CloudWatch),
    // but never leak internal messages/stack traces to clients in production.
    console.error(err.stack);
    const isProd = process.env.NODE_ENV === 'production';
    res.status(500).json({ error: isProd ? 'Internal server error' : (err.message || 'Internal server error') });
}
