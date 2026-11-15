import { Router } from 'express';
import { all, get, run } from '../db.js';
import { authMiddleware } from '../auth.js';

export const progressRouter = Router();
progressRouter.use(authMiddleware);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const today = () => new Date().toISOString().slice(0, 10);

function shift(date, delta) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

progressRouter.get('/progress/overview', (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 365);
  const start = shift(today(), -days);
  const weightRows = all('SELECT log_date, weight_kg FROM weight_logs WHERE user_id = ? AND log_date >= ? ORDER BY log_date', req.user.id, start);
  const allWeights = all('SELECT log_date, weight_kg FROM weight_logs WHERE user_id = ? ORDER BY log_date', req.user.id);
  const measurements = all('SELECT * FROM measurements WHERE user_id = ? ORDER BY log_date', req.user.id);
  const profile = get('SELECT * FROM profiles WHERE user_id = ?', req.user.id);
  const latestWeight = allWeights.length ? allWeights[allWeights.length - 1] : null;
  const firstInRange = weightRows[0] || null;
  const change = latestWeight && firstInRange ? Math.round((latestWeight.weight_kg - firstInRange.weight_kg) * 10) / 10 : 0;

  const workouts = all(`SELECT id, started_at, duration_sec, name FROM workout_sessions
    WHERE user_id = ? AND completed_at IS NOT NULL AND started_at >= ? ORDER BY started_at`, req.user.id, new Date(Date.now() - 56 * 86400000).toISOString());
  const prs = get(`SELECT COUNT(DISTINCT st.exercise_id) AS n FROM workout_sets st JOIN workout_sessions ws ON ws.id = st.session_id
    WHERE ws.user_id = ? AND st.completed = 1 AND st.weight > 0`, req.user.id);
  const totals30 = get(`SELECT COALESCE(AVG(calories),0) AS calories, COALESCE(AVG(protein),0) AS protein, COUNT(*) AS days
    FROM (SELECT log_date, SUM(calories) AS calories, SUM(protein) AS protein
      FROM meal_logs WHERE user_id = ? AND log_date >= ? GROUP BY log_date)`, req.user.id, start);

  // Weekly training consistency (last 8 weeks, Mon-start)
  const weeks = [];
  const now = new Date(today() + 'T12:00:00');
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  for (let w = 7; w >= 0; w--) {
    const ws = new Date(monday); ws.setDate(monday.getDate() - w * 7);
    const we = new Date(ws); we.setDate(ws.getDate() + 6);
    const count = workouts.filter(x => {
      const d = x.started_at.slice(0, 10);
      return d >= ws.toISOString().slice(0, 10) && d <= we.toISOString().slice(0, 10);
    }).length;
    weeks.push({ start: ws.toISOString().slice(0, 10), count });
  }

  res.json({
    weights: weightRows.map(w => ({ date: w.log_date, weight: w.weight_kg })),
    measurements: measurements.map(m => ({ id: m.id, date: m.log_date, waist: m.waist, chest: m.chest, arms: m.arms, thighs: m.thighs, hips: m.hips, bodyfat: m.bodyfat })),
    stats: {
      currentWeight: latestWeight?.weight_kg || profile?.weight_kg || null,
      startWeight: firstInRange?.weight_kg || latestWeight?.weight_kg || null,
      weightChange: change,
      totalWorkouts: workouts.length,
      avgDuration: workouts.length ? Math.round(workouts.reduce((s, w) => s + (w.duration_sec || 0), 0) / workouts.length / 60) : 0,
      personalRecords: prs.n,
      avgCalories: Math.round(totals30.calories),
      avgProtein: Math.round(totals30.protein),
      loggedDays: totals30.days,
      goal: profile?.goal || 'general_fitness',
      weeklyFrequency: profile?.weekly_frequency || 4,
      heightCm: profile?.height_cm || null,
    },
    weeks,
    rangeDays: days,
  });
});

progressRouter.get('/weight', (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 90, 7), 730);
  const rows = all('SELECT log_date, weight_kg FROM weight_logs WHERE user_id = ? AND log_date >= ? ORDER BY log_date',
    req.user.id, shift(today(), -days));
  res.json({ weights: rows.map(w => ({ date: w.log_date, weight: w.weight_kg })) });
});

progressRouter.post('/weight', (req, res) => {
  const b = req.body || {};
  const date = DATE_RE.test(b.date) ? b.date : today();
  const weight = Number(b.weightKg);
  if (!Number.isFinite(weight) || weight < 30 || weight > 350) return res.status(400).json({ error: 'Enter a weight between 30 and 350 kg.' });
  run(`INSERT INTO weight_logs (user_id, log_date, weight_kg) VALUES (?, ?, ?)
    ON CONFLICT(user_id, log_date) DO UPDATE SET weight_kg = excluded.weight_kg`, req.user.id, date, weight);
  run('UPDATE profiles SET weight_kg = ? WHERE user_id = ?', weight, req.user.id);
  res.json({ ok: true, date, weight });
});

progressRouter.delete('/weight/:date', (req, res) => {
  run('DELETE FROM weight_logs WHERE user_id = ? AND log_date = ?', req.user.id, req.params.date);
  res.json({ ok: true });
});

progressRouter.get('/measurements', (req, res) => {
  const rows = all('SELECT * FROM measurements WHERE user_id = ? ORDER BY log_date DESC LIMIT 60', req.user.id);
  res.json({ measurements: rows.map(m => ({ id: m.id, date: m.log_date, waist: m.waist, chest: m.chest, arms: m.arms, thighs: m.thighs, hips: m.hips, bodyfat: m.bodyfat })) });
});

progressRouter.post('/measurements', (req, res) => {
  const b = req.body || {};
  const date = DATE_RE.test(b.date) ? b.date : today();
  const fields = ['waist', 'chest', 'arms', 'thighs', 'hips', 'bodyfat'];
  const values = fields.map(f => (b[f] === '' || b[f] === undefined || b[f] === null ? null : Number(b[f])));
  for (const v of values) if (v !== null && (!Number.isFinite(v) || v < 0 || v > 300)) return res.status(400).json({ error: 'Measurements must be between 0 and 300.' });
  if (values.every(v => v === null)) return res.status(400).json({ error: 'Add at least one measurement.' });
  const result = run(`INSERT INTO measurements (user_id, log_date, waist, chest, arms, thighs, hips, bodyfat)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, req.user.id, date, ...values);
  res.status(201).json({ id: Number(result.lastInsertRowid), date, ...Object.fromEntries(fields.map((f, i) => [f, values[i]])) });
});

progressRouter.delete('/measurements/:id', (req, res) => {
  run('DELETE FROM measurements WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  res.json({ ok: true });
});

progressRouter.get('/progress/nutrition/history', (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 7), 180);
  const start = shift(today(), -days + 1);
  const rows = all(`SELECT log_date, SUM(calories) AS calories, SUM(protein) AS protein, SUM(carbs) AS carbs, SUM(fat) AS fat
    FROM meal_logs WHERE user_id = ? AND log_date >= ? GROUP BY log_date ORDER BY log_date`, req.user.id, start);
  res.json({
    days: rows.map(r => ({
      date: r.log_date, calories: Math.round(r.calories), protein: Math.round(r.protein),
      carbs: Math.round(r.carbs), fat: Math.round(r.fat),
    })),
  });
});