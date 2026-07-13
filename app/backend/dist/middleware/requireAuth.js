"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.signToken = signToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
// Never ship a hardcoded secret to production — a known signing key lets
// anyone forge a valid token for any user. Require it in prod; fall back to
// an obviously-insecure value only for local dev.
const JWT_SECRET = process.env.JWT_SECRET || (() => {
    if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET environment variable is required in production');
    }
    console.warn('[auth] JWT_SECRET not set — using an insecure development fallback');
    return 'dev-only-insecure-secret';
})();
function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
    }
    const token = header.slice(7);
    try {
        req.auth = jsonwebtoken_1.default.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
        next();
    }
    catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}
function signToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, { expiresIn: '7d', algorithm: 'HS256' });
}
