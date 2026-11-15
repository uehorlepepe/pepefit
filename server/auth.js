import jwt from 'jsonwebtoken';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { get, run } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const secretFile = path.join(__dirname, '..', 'data', '.jwt-secret');

function loadSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  try {
    return fs.readFileSync(secretFile, 'utf8').trim();
  } catch {
    const secret = crypto.randomUUID() + crypto.randomUUID();
    fs.writeFileSync(secretFile, secret, { mode: 0o600 });
    return secret;
  }
}
const SECRET = loadSecret();

export const signToken = (userId) => jwt.sign({ uid: userId }, SECRET, { expiresIn: '30d' });

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in' });
  try {
    const payload = jwt.verify(token, SECRET);
    const user = get('SELECT id, email, name, avatar_color, onboarded, created_at FROM users WHERE id = ?', payload.uid);
    if (!user) return res.status(401).json({ error: 'Account not found' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

export function publicUser(user) {
  const profile = get('SELECT * FROM profiles WHERE user_id = ?', user.id);
  const targets = get('SELECT * FROM targets WHERE user_id = ?', user.id);
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarColor: user.avatar_color,
    onboarded: !!user.onboarded,
    createdAt: user.created_at,
    profile: profile ? {
      age: profile.age,
      sex: profile.sex,
      heightCm: profile.height_cm,
      weightKg: profile.weight_kg,
      experience: profile.experience,
      goal: profile.goal,
      weeklyFrequency: profile.weekly_frequency,
      diet: profile.diet ? JSON.parse(profile.diet) : [],
      restrictions: profile.restrictions ? JSON.parse(profile.restrictions) : [],
      activityLevel: profile.activity_level,
      unitSystem: profile.unit_system,
    } : null,
    targets: targets ? {
      calories: targets.calories,
      protein: targets.protein,
      carbs: targets.carbs,
      fat: targets.fat,
      fiber: targets.fiber,
      sodium: targets.sodium,
    } : null,
  };
}

export const todayISO = () => new Date().toISOString().slice(0, 10);

export function dateRange(days, endDate = new Date()) {
  const end = new Date(endDate);
  const dates = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

export function ensureUserDefaults(userId) {
  const targets = get('SELECT user_id FROM targets WHERE user_id = ?', userId);
  if (!targets) {
    run('INSERT INTO targets (user_id, calories, protein, carbs, fat, fiber, sodium) VALUES (?, ?, ?, ?, ?, ?, ?)',
      userId, 2400, 160, 260, 70, 30, 2300);
  }
}