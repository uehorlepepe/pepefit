import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { get, run } from '../db.js';
import { signToken, authMiddleware, publicUser, ensureUserDefaults } from '../auth.js';

export const authRouter = Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

authRouter.post('/signup', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || String(name).trim().length < 2) return res.status(400).json({ error: 'Please enter your name.' });
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  if (!password || String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const existing = get('SELECT id FROM users WHERE lower(email) = lower(?)', email.trim());
  if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

  const hash = await bcrypt.hash(String(password), 10);
  const result = run('INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
    email.trim().toLowerCase(), hash, String(name).trim());
  const userId = Number(result.lastInsertRowid);
  ensureUserDefaults(userId);
  const user = get('SELECT * FROM users WHERE id = ?', userId);
  res.status(201).json({ token: signToken(userId), user: publicUser(user) });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });
  const user = get('SELECT * FROM users WHERE lower(email) = lower(?)', String(email).trim());
  if (!user) return res.status(401).json({ error: 'Incorrect email or password.' });
  const ok = await bcrypt.compare(String(password), user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Incorrect email or password.' });
  ensureUserDefaults(user.id);
  res.json({ token: signToken(user.id), user: publicUser(user) });
});

authRouter.get('/me', authMiddleware, (req, res) => {
  ensureUserDefaults(req.user.id);
  const user = get('SELECT * FROM users WHERE id = ?', req.user.id);
  res.json({ user: publicUser(user) });
});

authRouter.post('/forgot-password', (req, res) => {
  const { email } = req.body || {};
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });
  const user = get('SELECT * FROM users WHERE lower(email) = lower(?)', String(email).trim());
  // Always respond the same way so accounts can't be enumerated.
  const payload = { message: 'If that email is registered, a reset link has been sent.' };
  if (user) {
    const token = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    run('INSERT INTO password_resets (token, user_id, expires_at) VALUES (?, ?, ?)', token, user.id, expires);
    // Email delivery is not configured in this demo — surface the secure link instead.
    payload.devResetUrl = `/reset-password?token=${token}`;
    payload.devNote = 'Demo mode: use this secure link to reset your password.';
  }
  res.json(payload);
});

authRouter.post('/reset-password', async (req, res) => {
  const { token, password } = req.body || {};
  if (!token) return res.status(400).json({ error: 'Reset token is missing.' });
  if (!password || String(password).length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  const record = get('SELECT * FROM password_resets WHERE token = ? AND used = 0', token);
  if (!record) return res.status(400).json({ error: 'This reset link is invalid or has already been used.' });
  if (new Date(record.expires_at) < new Date()) return res.status(400).json({ error: 'This reset link has expired. Request a new one.' });
  const hash = await bcrypt.hash(String(password), 10);
  run('UPDATE users SET password_hash = ? WHERE id = ?', hash, record.user_id);
  run('UPDATE password_resets SET used = 1 WHERE token = ?', token);
  res.json({ message: 'Password updated. You can sign in now.' });
});

authRouter.post('/logout', authMiddleware, (_req, res) => {
  res.json({ ok: true });
});

authRouter.patch('/account', authMiddleware, async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body || {};
  const user = get('SELECT * FROM users WHERE id = ?', req.user.id);
  if (newPassword) {
    if (!currentPassword) return res.status(400).json({ error: 'Enter your current password to set a new one.' });
    const ok = await bcrypt.compare(String(currentPassword), user.password_hash);
    if (!ok) return res.status(400).json({ error: 'Current password is incorrect.' });
    if (String(newPassword).length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters.' });
    run('UPDATE users SET password_hash = ? WHERE id = ?', await bcrypt.hash(String(newPassword), 10), user.id);
  }
  if (name && String(name).trim().length >= 2) run('UPDATE users SET name = ? WHERE id = ?', String(name).trim(), user.id);
  if (email && EMAIL_RE.test(email) && email.toLowerCase() !== user.email) {
    const clash = get('SELECT id FROM users WHERE lower(email) = lower(?) AND id != ?', email, user.id);
    if (clash) return res.status(409).json({ error: 'That email is already in use.' });
    run('UPDATE users SET email = ? WHERE id = ?', String(email).toLowerCase(), user.id);
  }
  const fresh = get('SELECT * FROM users WHERE id = ?', user.id);
  res.json({ user: publicUser(fresh), message: 'Account updated.' });
});

authRouter.delete('/account', authMiddleware, (req, res) => {
  run('DELETE FROM users WHERE id = ?', req.user.id);
  res.json({ ok: true });
});