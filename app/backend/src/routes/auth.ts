import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { requireAuth, signToken } from '../middleware/requireAuth';
import { sendPasswordResetEmail } from '../services/mailer';

const router = Router();
const BCRYPT_ROUNDS = 12;

router.post('/register', async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const { rows } = await pool.query<{ id: string; email: string }>(
      `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email`,
      [email.toLowerCase().trim(), passwordHash],
    );

    const user = rows[0];
    res.status(201).json({ token: signToken({ userId: user.id, email: user.email }), user });
  } catch (err: unknown) {
    if ((err as { code?: string }).code === '23505') {
      return res.status(409).json({ error: 'An account with that email already exists' });
    }
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { rows } = await pool.query<{ id: string; email: string; password_hash: string }>(
      `UPDATE users SET last_login = NOW() WHERE email = $1 RETURNING id, email, password_hash`,
      [email.toLowerCase().trim()],
    );

    const user = rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Incorrect email or password' });
    }

    const { password_hash: _, ...safeUser } = user;
    res.json({ token: signToken({ userId: safeUser.id, email: safeUser.email }), user: safeUser });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const { rows } = await pool.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE id = $1`,
      [req.auth!.userId],
    );
    if (!rows[0]) return res.status(401).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) return res.status(400).json({ error: 'Email is required.' });

    const { rows } = await pool.query<{ id: string }>(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()],
    );

    if (rows[0]) {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)`,
        [rows[0].id, token, expiresAt],
      );
      const appUrl = process.env.APP_URL || 'https://skybroe.com';
      // Fire-and-forget: don't await the SES round-trip. Awaiting would make
      // the response slower only when the email exists (a timing oracle for
      // account enumeration) and would surface send failures as a 500 — also
      // an enumeration signal. Log failures server-side instead.
      sendPasswordResetEmail(email.toLowerCase().trim(), `${appUrl}/reset-password?token=${token}`)
        .catch((err) => console.error('[forgot-password] email send failed:', err));
    }

    // Always respond the same way — don't leak whether the email exists
    res.json({ message: 'If that email is registered, a reset link has been sent.' });
  } catch (err) {
    next(err);
  }
});

router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body as { token?: string; password?: string };
    if (!token || !password) return res.status(400).json({ error: 'Token and password are required.' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const { rows } = await pool.query<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }>(
      `SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token = $1`,
      [token],
    );

    const row = rows[0];
    if (!row || row.used_at || new Date() > new Date(row.expires_at)) {
      return res.status(400).json({ error: 'This reset link is invalid or has expired.' });
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, row.user_id]);
    await pool.query('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1', [row.id]);

    res.json({ message: 'Password updated successfully.' });
  } catch (err) {
    next(err);
  }
});

export default router;
