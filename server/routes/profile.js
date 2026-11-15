import { Router } from 'express';
import { get, run } from '../db.js';
import { authMiddleware, publicUser } from '../auth.js';

export const profileRouter = Router();
profileRouter.use(authMiddleware);

profileRouter.put('/profile', (req, res) => {
  const b = req.body || {};
  const current = get('SELECT * FROM profiles WHERE user_id = ?', req.user.id);
  const merged = {
    age: b.age ?? current?.age ?? null,
    sex: b.sex ?? current?.sex ?? null,
    height_cm: b.heightCm ?? current?.height_cm ?? null,
    weight_kg: b.weightKg ?? current?.weight_kg ?? null,
    experience: b.experience ?? current?.experience ?? null,
    goal: b.goal ?? current?.goal ?? null,
    weekly_frequency: b.weeklyFrequency ?? current?.weekly_frequency ?? null,
    diet: b.diet !== undefined ? JSON.stringify(b.diet) : (current?.diet ?? '[]'),
    restrictions: b.restrictions !== undefined ? JSON.stringify(b.restrictions) : (current?.restrictions ?? '[]'),
    activity_level: b.activityLevel ?? current?.activity_level ?? 'moderate',
    unit_system: b.unitSystem ?? current?.unit_system ?? 'metric',
  };

  if (merged.age !== null && (merged.age < 13 || merged.age > 100)) return res.status(400).json({ error: 'Age must be between 13 and 100.' });
  if (merged.height_cm !== null && (merged.height_cm < 100 || merged.height_cm > 250)) return res.status(400).json({ error: 'Enter a height between 100 and 250 cm.' });
  if (merged.weight_kg !== null && (merged.weight_kg < 30 || merged.weight_kg > 350)) return res.status(400).json({ error: 'Enter a weight between 30 and 350 kg.' });

  run(`INSERT INTO profiles (user_id, age, sex, height_cm, weight_kg, experience, goal, weekly_frequency, diet, restrictions, activity_level, unit_system)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         age=excluded.age, sex=excluded.sex, height_cm=excluded.height_cm, weight_kg=excluded.weight_kg,
         experience=excluded.experience, goal=excluded.goal, weekly_frequency=excluded.weekly_frequency,
         diet=excluded.diet, restrictions=excluded.restrictions, activity_level=excluded.activity_level, unit_system=excluded.unit_system`,
    req.user.id, merged.age, merged.sex, merged.height_cm, merged.weight_kg, merged.experience, merged.goal,
    merged.weekly_frequency, merged.diet, merged.restrictions, merged.activity_level, merged.unit_system);

  if (b.weightKg) {
    const today = new Date().toISOString().slice(0, 10);
    run(`INSERT INTO weight_logs (user_id, log_date, weight_kg) VALUES (?, ?, ?)
         ON CONFLICT(user_id, log_date) DO UPDATE SET weight_kg = excluded.weight_kg`, req.user.id, today, b.weightKg);
  }

  const user = get('SELECT * FROM users WHERE id = ?', req.user.id);
  res.json({ user: publicUser(user), message: 'Profile saved.' });
});

profileRouter.post('/onboarding-complete', (req, res) => {
  run('UPDATE users SET onboarded = 1 WHERE id = ?', req.user.id);
  const user = get('SELECT * FROM users WHERE id = ?', req.user.id);
  res.json({ user: publicUser(user) });
});

profileRouter.put('/targets', (req, res) => {
  const b = req.body || {};
  const keys = ['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium'];
  const current = get('SELECT * FROM targets WHERE user_id = ?', req.user.id);
  const val = (k) => (b[k] !== undefined && b[k] !== null && b[k] !== '' ? Math.round(Number(b[k])) : current?.[k]);
  const next = Object.fromEntries(keys.map(k => [k, val(k)]));
  for (const k of keys) {
    if (!Number.isFinite(next[k]) || next[k] < 0) return res.status(400).json({ error: 'Targets must be positive numbers.' });
  }
  if (next.calories < 1000 || next.calories > 8000) return res.status(400).json({ error: 'Calories should be between 1,000 and 8,000.' });
  if (next.protein > 500 || next.carbs > 900 || next.fat > 300) return res.status(400).json({ error: 'One of those macro targets looks too high.' });
  run(`INSERT INTO targets (user_id, calories, protein, carbs, fat, fiber, sodium) VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET calories=excluded.calories, protein=excluded.protein, carbs=excluded.carbs,
         fat=excluded.fat, fiber=excluded.fiber, sodium=excluded.sodium`,
    req.user.id, next.calories, next.protein, next.carbs, next.fat, next.fiber, next.sodium);
  const user = get('SELECT * FROM users WHERE id = ?', req.user.id);
  res.json({ user: publicUser(user), message: 'Targets updated.' });
});

profileRouter.get('/suggestion', (req, res) => {
  const p = get('SELECT * FROM profiles WHERE user_id = ?', req.user.id);
  if (!p || !p.weight_kg || !p.height_cm || !p.age) return res.json({ suggestion: null });
  const sex = p.sex === 'male' ? 5 : p.sex === 'female' ? -161 : -78;
  const bmr = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * p.age + sex;
  const activity = { sedentary: 1.2, light: 1.375, moderate: 1.55, high: 1.725, athlete: 1.9 }[p.activity_level || 'moderate'] || 1.55;
  let calories = bmr * activity;
  if (p.goal === 'fat_loss') calories -= 400;
  if (p.goal === 'muscle_gain') calories += 250;
  if (p.goal === 'strength') calories += 150;
  calories = Math.round(calories / 10) * 10;
  const protein = Math.round(p.weight_kg * (p.goal === 'muscle_gain' || p.goal === 'strength' ? 2 : 1.8));
  const fat = Math.round((calories * 0.27) / 9);
  const carbs = Math.max(50, Math.round((calories - protein * 4 - fat * 9) / 4));
  res.json({ suggestion: { calories, protein, carbs, fat, fiber: 30, sodium: 2300 } });
});