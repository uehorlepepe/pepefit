import { Router } from 'express';
import { all, get, run } from '../db.js';
import { authMiddleware } from '../auth.js';

export const nutritionRouter = Router();
nutritionRouter.use(authMiddleware);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MEALS = ['breakfast', 'lunch', 'dinner', 'snacks'];
const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

nutritionRouter.get('/foods', (req, res) => {
  const { q, category, limit } = req.query;
  let rows = all('SELECT * FROM foods WHERE is_custom = 0 OR user_id = ? ORDER BY name', req.user.id);
  if (q) {
    const needle = String(q).toLowerCase().trim();
    rows = rows.filter(f => f.name.toLowerCase().includes(needle) || (f.brand || '').toLowerCase().includes(needle));
  }
  if (category && category !== 'All') rows = rows.filter(f => f.category === category);
  const max = Math.min(Number(limit) || 60, 200);
  res.json({ foods: rows.slice(0, max), total: rows.length });
});

nutritionRouter.get('/foods/recent', (req, res) => {
  const rows = all(`SELECT food_id, name, COUNT(*) AS times, MAX(log_date) AS last
    FROM meal_logs WHERE user_id = ? AND food_id IS NOT NULL
    GROUP BY food_id ORDER BY last DESC, times DESC LIMIT 8`, req.user.id);
  const foods = rows.map(r => get('SELECT * FROM foods WHERE id = ?', r.food_id)).filter(Boolean);
  res.json({ foods, history: rows });
});

nutritionRouter.post('/foods', (req, res) => {
  const b = req.body || {};
  if (!b.name || !String(b.name).trim()) return res.status(400).json({ error: 'Food name is required.' });
  if (num(b.calories) < 0 || num(b.protein) < 0 || num(b.carbs) < 0 || num(b.fat) < 0) return res.status(400).json({ error: 'Nutrition values cannot be negative.' });
  if (num(b.calories) === 0 && num(b.protein) + num(b.carbs) + num(b.fat) === 0) return res.status(400).json({ error: 'Add at least some nutrition information.' });
  const result = run(`INSERT INTO foods (name, brand, category, serving_label, serving_grams, calories, protein, carbs, fat, fiber, sodium, iron, calcium, is_custom, user_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
    String(b.name).trim(), b.brand || null, b.category || 'Custom', b.servingLabel || '1 serving', num(b.servingGrams),
    num(b.calories), num(b.protein), num(b.carbs), num(b.fat), num(b.fiber), num(b.sodium), num(b.iron), num(b.calcium), req.user.id);
  const food = get('SELECT * FROM foods WHERE id = ?', Number(result.lastInsertRowid));
  res.status(201).json({ food });
});

function getTotals(userId, date) {
  const meals = all('SELECT * FROM meal_logs WHERE user_id = ? AND log_date = ? ORDER BY created_at, id', userId, date);
  const totals = meals.reduce((acc, m) => {
    acc.calories += m.calories; acc.protein += m.protein; acc.carbs += m.carbs; acc.fat += m.fat;
    acc.fiber += m.fiber; acc.sodium += m.sodium; acc.iron += m.iron; acc.calcium += m.calcium;
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, iron: 0, calcium: 0 });
  for (const k of Object.keys(totals)) totals[k] = Math.round(totals[k] * 10) / 10;
  return {
    date,
    totals,
    meals: MEALS.map(type => ({
      type,
      items: meals.filter(m => m.meal_type === type).map(m => ({
        id: m.id, name: m.name, servings: m.servings, servingLabel: m.serving_label,
        calories: Math.round(m.calories), protein: m.protein, carbs: m.carbs, fat: m.fat,
        fiber: m.fiber, sodium: m.sodium, iron: m.iron, calcium: m.calcium, foodId: m.food_id,
      })),
      calories: Math.round(meals.filter(m => m.meal_type === type).reduce((s, m) => s + m.calories, 0)),
    })),
  };
}

nutritionRouter.get('/meals', (req, res) => {
  const date = DATE_RE.test(req.query.date) ? req.query.date : new Date().toISOString().slice(0, 10);
  const targets = get('SELECT * FROM targets WHERE user_id = ?', req.user.id);
  res.json({ ...getTotals(req.user.id, date), targets });
});

nutritionRouter.post('/meals', (req, res) => {
  const b = req.body || {};
  const date = DATE_RE.test(b.date) ? b.date : new Date().toISOString().slice(0, 10);
  const mealType = MEALS.includes(b.mealType) ? b.mealType : 'snacks';
  let base;
  if (b.foodId) {
    const food = get('SELECT * FROM foods WHERE id = ? AND (is_custom = 0 OR user_id = ?)', b.foodId, req.user.id);
    if (!food) return res.status(404).json({ error: 'Food not found.' });
    base = {
      name: food.name, servingLabel: food.serving_label, calories: food.calories, protein: food.protein,
      carbs: food.carbs, fat: food.fat, fiber: food.fiber, sodium: food.sodium, iron: food.iron, calcium: food.calcium,
    };
  } else if (b.custom) {
    base = {
      name: b.custom.name || 'Custom food', servingLabel: b.custom.servingLabel || '1 serving',
      calories: num(b.custom.calories), protein: num(b.custom.protein), carbs: num(b.custom.carbs),
      fat: num(b.custom.fat), fiber: num(b.custom.fiber), sodium: num(b.custom.sodium),
      iron: num(b.custom.iron), calcium: num(b.custom.calcium),
    };
  } else {
    return res.status(400).json({ error: 'Choose a food or enter nutrition details.' });
  }
  if (!base.name || !String(base.name).trim()) return res.status(400).json({ error: 'Food name is required.' });
  const servings = Math.max(0.05, Math.min(num(b.servings, 1), 100));
  const scaled = Object.fromEntries(['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'iron', 'calcium']
    .map(k => [k, num(base[k]) * servings]));
  if (scaled.calories < 0) return res.status(400).json({ error: 'Nutrition values cannot be negative.' });
  const result = run(`INSERT INTO meal_logs (user_id, log_date, meal_type, food_id, name, servings, serving_label, calories, protein, carbs, fat, fiber, sodium, iron, calcium)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    req.user.id, date, mealType, b.foodId || null, String(base.name).trim(), servings, base.servingLabel,
    scaled.calories, scaled.protein, scaled.carbs, scaled.fat, scaled.fiber, scaled.sodium, scaled.iron, scaled.calcium);
  res.status(201).json({ meal: get('SELECT * FROM meal_logs WHERE id = ?', Number(result.lastInsertRowid)), ...getTotals(req.user.id, date) });
});

nutritionRouter.put('/meals/:id', (req, res) => {
  const meal = get('SELECT * FROM meal_logs WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!meal) return res.status(404).json({ error: 'Meal not found.' });
  const servings = Math.max(0.05, Math.min(num(req.body?.servings, meal.servings), 100));
  const factor = servings / (meal.servings || 1);
  run(`UPDATE meal_logs SET servings = ?, calories = calories * ?, protein = protein * ?, carbs = carbs * ?,
    fat = fat * ?, fiber = fiber * ?, sodium = sodium * ?, iron = iron * ?, calcium = calcium * ? WHERE id = ?`,
    servings, factor, factor, factor, factor, factor, factor, factor, factor, meal.id);
  res.json({ ...getTotals(req.user.id, meal.log_date) });
});

nutritionRouter.delete('/meals/:id', (req, res) => {
  const meal = get('SELECT * FROM meal_logs WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!meal) return res.status(404).json({ error: 'Meal not found.' });
  run('DELETE FROM meal_logs WHERE id = ?', meal.id);
  res.json(getTotals(req.user.id, meal.log_date));
});

nutritionRouter.get('/week', (req, res) => {
  const end = DATE_RE.test(req.query.end) ? req.query.end : new Date().toISOString().slice(0, 10);
  const endDate = new Date(end + 'T12:00:00');
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(endDate); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const targets = get('SELECT * FROM targets WHERE user_id = ?', req.user.id);
  const data = days.map(date => {
    const t = getTotals(req.user.id, date);
    return { date, ...t.totals };
  });
  const loggedDays = data.filter(d => d.calories > 0);
  const avg = loggedDays.length ? Object.fromEntries(['calories', 'protein', 'carbs', 'fat', 'fiber', 'sodium', 'iron', 'calcium'].map(k =>
    [k, Math.round(loggedDays.reduce((s, d) => s + d[k], 0) / loggedDays.length)])) : null;
  res.json({ days: data, targets, average: avg, loggedDays: loggedDays.length });
});

nutritionRouter.get('/insights', (req, res) => {
  const end = DATE_RE.test(req.query.end) ? req.query.end : new Date().toISOString().slice(0, 10);
  const targets = get('SELECT * FROM targets WHERE user_id = ?', req.user.id);
  const week = [];
  const endDate = new Date(end + 'T12:00:00');
  for (let i = 6; i >= 0; i--) {
    const d = new Date(endDate); d.setDate(d.getDate() - i);
    week.push(getTotals(req.user.id, d.toISOString().slice(0, 10)));
  }
  const avgProtein = Math.round(week.reduce((s, d) => s + d.totals.protein, 0) / 7);
  res.json({ avgProtein, proteinTarget: targets.protein, avgCalories: Math.round(week.reduce((s, d) => s + d.totals.calories, 0) / 7), calorieTarget: targets.calories });
});