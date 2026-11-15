import { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { all, get, run } from '../db.js';
import { authMiddleware } from '../auth.js';
import { INGREDIENTS, SUBSTITUTES, PANTRY_STAPLES, RECIPES } from '../data/kitchen.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, '..', '..', 'data', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(file.mimetype)) return cb(new Error('Please upload a JPG, PNG or WEBP image.'));
    cb(null, true);
  },
});

export const kitchenRouter = Router();
kitchenRouter.use(authMiddleware);

const canon = (name) => String(name).toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim();
const SYNONYMS = {
  'chicken': 'chicken_breast', 'chicken breast': 'chicken_breast', 'chicken breasts': 'chicken_breast', 'chicken thigh': 'chicken_breast',
  'egg': 'eggs', 'eggs': 'eggs', 'salmon': 'salmon', 'salmon fillet': 'salmon', 'tuna': 'tuna', 'canned tuna': 'tuna',
  'shrimp': 'prawns', 'prawns': 'prawns', 'beef': 'beef', 'steak': 'beef', 'mince': 'beef', 'ground beef': 'beef',
  'turkey': 'turkey', 'tofu': 'tofu', 'lentils': 'lentils', 'chickpeas': 'chickpeas', 'black beans': 'black_beans',
  'edamame': 'edamame', 'yogurt': 'greek_yogurt', 'greek yogurt': 'greek_yogurt', 'yoghurt': 'greek_yogurt',
  'cottage cheese': 'cottage_cheese', 'milk': 'milk', 'cheese': 'cheddar', 'cheddar': 'cheddar', 'mozzarella': 'mozzarella',
  'feta': 'feta', 'feta cheese': 'feta', 'butter': 'butter', 'spinach': 'spinach', 'broccoli': 'broccoli',
  'bell pepper': 'bell_pepper', 'pepper': 'bell_pepper', 'capsicum': 'bell_pepper', 'tomato': 'tomato', 'tomatoes': 'tomato',
  'cucumber': 'cucumber', 'carrot': 'carrot', 'carrots': 'carrot', 'kale': 'kale', 'mushroom': 'mushrooms', 'mushrooms': 'mushrooms',
  'zucchini': 'zucchini', 'courgette': 'zucchini', 'green beans': 'green_beans', 'asparagus': 'asparagus', 'onion': 'onion',
  'garlic': 'garlic', 'avocado': 'avocado', 'banana': 'banana', 'bananas': 'banana', 'apple': 'apple', 'apples': 'apple',
  'blueberries': 'blueberries', 'blueberry': 'blueberries', 'strawberries': 'strawberries', 'strawberry': 'strawberries',
  'orange': 'orange', 'lemon': 'lemon', 'potato': 'potato', 'potatoes': 'potato', 'sweet potato': 'sweet_potato',
  'cauliflower': 'cauliflower', 'corn': 'corn', 'rice': 'rice', 'pasta': 'pasta', 'oats': 'oats', 'oatmeal': 'oats',
  'bread': 'bread', 'tortilla': 'tortilla', 'wrap': 'tortilla', 'quinoa': 'quinoa', 'olive oil': 'olive_oil',
  'peanut butter': 'peanut_butter', 'almonds': 'almonds', 'soy sauce': 'soy_sauce', 'honey': 'honey', 'hummus': 'hummus',
};
function toKey(name) {
  const n = canon(name);
  if (INGREDIENTS[n.replace(/ /g, '_')]) return n.replace(/ /g, '_');
  if (SYNONYMS[n]) return SYNONYMS[n];
  for (const [syn, key] of Object.entries(SYNONYMS)) {
    if (n.includes(syn)) return key;
  }
  return null;
}

const FRIDGE_PROFILES = [
  { id: 'meal-prep', keys: ['chicken_breast', 'eggs', 'greek_yogurt', 'rice', 'broccoli', 'spinach', 'bell_pepper', 'tomato', 'cheddar', 'milk', 'garlic', 'olive_oil'] },
  { id: 'veggie', keys: ['broccoli', 'spinach', 'bell_pepper', 'tomato', 'cucumber', 'carrot', 'mushrooms', 'zucchini', 'feta', 'eggs', 'greek_yogurt', 'tofu', 'lemon'] },
  { id: 'breakfast', keys: ['eggs', 'milk', 'greek_yogurt', 'oats', 'banana', 'blueberries', 'bread', 'peanut_butter', 'honey', 'butter', 'apple'] },
  { id: 'asian', keys: ['tofu', 'prawns', 'rice', 'broccoli', 'bell_pepper', 'carrot', 'soy_sauce', 'garlic', 'edamame', 'eggs', 'mushrooms'] },
  { id: 'protein', keys: ['chicken_breast', 'beef', 'salmon', 'eggs', 'greek_yogurt', 'cottage_cheese', 'rice', 'sweet_potato', 'spinach', 'avocado', 'broccoli', 'garlic'] },
  { id: 'mediterranean', keys: ['salmon', 'prawns', 'feta', 'tomato', 'cucumber', 'spinach', 'lemon', 'chickpeas', 'olive_oil', 'greek_yogurt', 'bread', 'zucchini', 'garlic'] },
  { id: 'student', keys: ['eggs', 'milk', 'bread', 'cheddar', 'tomato', 'cucumber', 'hummus', 'apple', 'banana', 'peanut_butter', 'rice', 'broccoli'] },
  { id: 'plant', keys: ['tofu', 'chickpeas', 'lentils', 'black_beans', 'spinach', 'kale', 'tomato', 'avocado', 'sweet_potato', 'rice', 'quinoa', 'edamame', 'lemon'] },
];

function heuristicAnalyze(buffer, colors = []) {
  const hash = crypto.createHash('sha256').update(buffer).digest();
  const greens = colors.filter(c => /^#?[0-9a-f]{6}$/i.test(c) && parseInt(c.slice(-4, -2), 16) > parseInt(c.slice(1, 3), 16) * 1.15).length;
  const reds = colors.filter(c => /^#?[0-9a-f]{6}$/i.test(c) && parseInt(c.slice(1, 3), 16) > parseInt(c.slice(-4, -2), 16) * 1.3).length;
  let pool = FRIDGE_PROFILES[hash[0] % FRIDGE_PROFILES.length];
  if (greens >= 2) pool = hash[1] % 2 ? FRIDGE_PROFILES[1] : FRIDGE_PROFILES[7];
  else if (reds >= 2) pool = hash[1] % 2 ? FRIDGE_PROFILES[5] : FRIDGE_PROFILES[0];
  else if (hash[2] % 3 === 0) pool = FRIDGE_PROFILES[2];

  const keys = [...new Set([...pool.keys, ...PANTRY_STAPLES])];
  return keys.map((key, i) => ({
    key,
    confidence: Math.round((0.72 + ((hash[(i + 3) % hash.length] % 24) / 100)) * 100) / 100,
  }));
}

async function visionAnalyze(buffer, mimetype) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.OPENAI_VISION_MODEL || 'gpt-4o-mini';
  const dataUrl = `data:${mimetype};base64,${buffer.toString('base64')}`;
  const prompt = `You are a food-vision assistant for a fitness app. Look at this photo of a fridge or pantry.
Identify only food ingredients that are clearly visible or strongly implied. Do not guess brands.
Respond with JSON only, no markdown, in this exact shape:
{"ingredients":[{"name":"chicken breast","confidence":0.92}],"note":"one short sentence about what you see"}
List 4-14 ingredients. Use simple English ingredient names (e.g. eggs, spinach, Greek yogurt, chicken breast, rice, bell pepper).`;
  try {
    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: dataUrl } }] }],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!resp.ok) return null;
    const json = await resp.json();
    const text = json.choices?.[0]?.message?.content;
    if (!text) return null;
    const parsed = JSON.parse(text);
    const seen = new Set();
    const ingredients = [];
    for (const item of parsed.ingredients || []) {
      const key = toKey(item.name);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      ingredients.push({ key, confidence: Math.min(0.99, Math.max(0.4, Number(item.confidence) || 0.75)) });
    }
    if (ingredients.length < 2) return null;
    return { ingredients, note: parsed.note || '' };
  } catch {
    return null;
  }
}

function decorateRecipes(keys, goal, remaining) {
  const fridge = new Set([...keys, ...PANTRY_STAPLES]);
  const scored = RECIPES.map(r => {
    const ingredients = JSON.parse(r.ingredients);
    const required = ingredients.filter(i => !i.optional);
    const available = required.filter(i => fridge.has(i.key));
    const missing = required.filter(i => !fridge.has(i.key)).map(i => ({
      key: i.key, name: INGREDIENTS[i.key]?.name || i.key, emoji: INGREDIENTS[i.key]?.emoji || '•',
      substitutes: (SUBSTITUTES[i.key] || []).map(k => ({ key: k, name: INGREDIENTS[k]?.name || k, emoji: INGREDIENTS[k]?.emoji || '•' })),
    }));
    const coverage = available.length / Math.max(1, required.length);
    if (coverage < 0.55) return null;
    let fit = 0;
    const density = r.protein / Math.max(1, r.calories);
    if (goal === 'muscle_gain' || goal === 'strength') fit = density * 130;
    else if (goal === 'fat_loss') fit = density * 170 - r.calories / 100;
    else if (goal === 'endurance') fit = r.carbs * 0.35 + density * 40;
    else fit = density * 90;
    if (remaining?.protein > 0) fit += Math.min(r.protein, remaining.protein) * 0.28;
    if (remaining?.calories > 0) fit -= Math.max(0, r.calories - remaining.calories) * 0.045;
    if (remaining?.calories <= 0) fit -= 20;
    return { r, ingredients, missing, coverage, fit };
  }).filter(Boolean).sort((a, b) => (b.coverage - a.coverage) || (b.fit - a.fit));

  const idBySlug = new Map(all('SELECT id, slug FROM recipes').map(r => [r.slug, r.id]));
  return scored.slice(0, 10).map(({ r, ingredients, missing, coverage, fit }) => ({
    id: idBySlug.get(r.slug) ?? r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    emoji: r.emoji,
    gradient: r.gradient,
    cuisine: r.cuisine,
    prepMin: r.prep_min,
    cookMin: r.cook_min,
    totalMin: r.prep_min + r.cook_min,
    servings: r.servings,
    calories: r.calories,
    protein: r.protein,
    carbs: r.carbs,
    fat: r.fat,
    fiber: r.fiber,
    tags: JSON.parse(r.tags),
    goalAffinity: JSON.parse(r.goal_affinity),
    matchPercent: Math.round(coverage * 100),
    canMakeNow: missing.length === 0,
    missing,
    ingredients: ingredients.map(i => ({
      key: i.key, name: INGREDIENTS[i.key]?.name || i.key, emoji: INGREDIENTS[i.key]?.emoji || '•',
      amount: i.amount, unit: i.unit, optional: i.optional,
      substitutes: (SUBSTITUTES[i.key] || []).map(k => ({ key: k, name: INGREDIENTS[k]?.name || k, emoji: INGREDIENTS[k]?.emoji || '•' })),
    })),
    steps: JSON.parse(r.steps),
    highProtein: r.protein >= 30,
    fitsCalories: remaining?.calories > 0 ? r.calories <= remaining.calories + 100 : false,
  }));
}

kitchenRouter.get('/kitchen/status', (_req, res) => {
  res.json({ visionEnabled: !!process.env.OPENAI_API_KEY, mode: process.env.OPENAI_API_KEY ? 'ai' : 'demo' });
});

kitchenRouter.post('/kitchen/analyze', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Add a fridge or pantry photo to scan.' });
  if (!req.file.size) return res.status(400).json({ error: 'That image looks empty. Try another photo.' });

  let colors = [];
  try {
    colors = JSON.parse(req.body.colors || '[]').slice(0, 8);
  } catch { colors = []; }

  const goal = get('SELECT goal FROM profiles WHERE user_id = ?', req.user.id)?.goal || 'general_fitness';
  const ai = await visionAnalyze(req.file.buffer, req.file.mimetype);
  const source = ai ? 'ai' : 'demo';
  const detected = ai ? ai.ingredients : heuristicAnalyze(req.file.buffer, colors);
  const note = ai?.note || '';

  const ext = req.file.mimetype.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
  const filename = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}.${ext}`;
  fs.writeFileSync(path.join(uploadDir, filename), req.file.buffer);

  const keys = detected.map(d => d.key).filter(k => INGREDIENTS[k]);
  const ingredients = keys.map(k => ({
    key: k, name: INGREDIENTS[k].name, emoji: INGREDIENTS[k].emoji, category: INGREDIENTS[k].category,
    confidence: detected.find(d => d.key === k)?.confidence || 0.8,
  }));

  const remaining = {
    protein: Number(req.body.remainingProtein) || 0,
    calories: Number(req.body.remainingCalories) || 0,
    carbs: Number(req.body.remainingCarbs) || 0,
  };
  const recipes = decorateRecipes(keys, goal, remaining);
  const scan = run('INSERT INTO kitchen_scans (user_id, ingredients, image_path, source) VALUES (?, ?, ?, ?)',
    req.user.id, JSON.stringify(keys), filename, source);

  res.json({
    scanId: Number(scan.lastInsertRowid),
    source,
    note,
    imageUrl: `/uploads/${filename}`,
    ingredients,
    recipes,
    goal,
    remaining,
  });
});

kitchenRouter.post('/kitchen/recommend', (req, res) => {
  const { ingredients = [], remaining } = req.body || {};
  const valid = [...new Set(ingredients.map(toKey).filter(Boolean))];
  const goal = get('SELECT goal FROM profiles WHERE user_id = ?', req.user.id)?.goal || 'general_fitness';
  res.json({ ingredients: valid, recipes: decorateRecipes(valid, goal, remaining || {}) });
});

kitchenRouter.get('/kitchen/ingredients', (_req, res) => {
  res.json({ ingredients: Object.entries(INGREDIENTS).map(([key, v]) => ({ key, ...v })) });
});

function recipeDetail(row, userId) {
  const saved = get('SELECT 1 AS s FROM saved_recipes WHERE user_id = ? AND recipe_id = ?', userId, row.id);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    emoji: row.emoji,
    gradient: row.gradient,
    cuisine: row.cuisine,
    prepMin: row.prep_min,
    cookMin: row.cook_min,
    totalMin: row.prep_min + row.cook_min,
    servings: row.servings,
    calories: row.calories,
    protein: row.protein,
    carbs: row.carbs,
    fat: row.fat,
    fiber: row.fiber,
    tags: JSON.parse(row.tags),
    goalAffinity: JSON.parse(row.goal_affinity),
    saved: !!saved,
    ingredients: JSON.parse(row.ingredients).map(i => ({
      key: i.key, name: INGREDIENTS[i.key]?.name || i.key, emoji: INGREDIENTS[i.key]?.emoji || '•',
      amount: i.amount, unit: i.unit, optional: i.optional,
      substitutes: (SUBSTITUTES[i.key] || []).map(k => ({ key: k, name: INGREDIENTS[k]?.name || k, emoji: INGREDIENTS[k]?.emoji || '•' })),
    })),
    steps: JSON.parse(row.steps),
  };
}

kitchenRouter.get('/kitchen/recipes', (req, res) => {
  const rows = all('SELECT * FROM recipes ORDER BY id');
  let items = rows.map(r => recipeDetail(r, req.user.id));
  if (req.query.saved === '1') items = items.filter(r => r.saved);
  if (req.query.q) {
    const q = String(req.query.q).toLowerCase();
    items = items.filter(r => r.name.toLowerCase().includes(q) || r.tags.some(t => t.includes(q)));
  }
  res.json({ recipes: items });
});

kitchenRouter.get('/kitchen/recipes/:id', (req, res) => {
  const row = get('SELECT * FROM recipes WHERE id = ?', req.params.id);
  if (!row) return res.status(404).json({ error: 'Recipe not found.' });
  res.json({ recipe: recipeDetail(row, req.user.id) });
});

kitchenRouter.post('/kitchen/recipes/:id/save', (req, res) => {
  const row = get('SELECT * FROM recipes WHERE id = ?', req.params.id);
  if (!row) return res.status(404).json({ error: 'Recipe not found.' });
  const existing = get('SELECT 1 AS s FROM saved_recipes WHERE user_id = ? AND recipe_id = ?', req.user.id, row.id);
  if (existing) run('DELETE FROM saved_recipes WHERE user_id = ? AND recipe_id = ?', req.user.id, row.id);
  else run('INSERT INTO saved_recipes (user_id, recipe_id) VALUES (?, ?)', req.user.id, row.id);
  res.json({ saved: !existing });
});

kitchenRouter.post('/kitchen/recipes/:id/log', (req, res) => {
  const row = get('SELECT * FROM recipes WHERE id = ?', req.params.id);
  if (!row) return res.status(404).json({ error: 'Recipe not found.' });
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.body?.date) ? req.body.date : new Date().toISOString().slice(0, 10);
  const mealType = ['breakfast', 'lunch', 'dinner', 'snacks'].includes(req.body?.mealType) ? req.body.mealType : 'lunch';
  const servings = Math.max(0.25, Math.min(Number(req.body?.servings) || 1, 10));
  run(`INSERT INTO meal_logs (user_id, log_date, meal_type, name, servings, serving_label, calories, protein, carbs, fat, fiber, sodium)
    VALUES (?, ?, ?, ?, ?, '1 serving', ?, ?, ?, ?, ?, 0)`,
    req.user.id, date, mealType, row.name, servings, row.calories * servings, row.protein * servings,
    row.carbs * servings, row.fat * servings, (row.fiber || 0) * servings);
  res.status(201).json({ ok: true, name: row.name, servings, calories: Math.round(row.calories * servings), date, mealType });
});

kitchenRouter.get('/kitchen/scans', (req, res) => {
  const rows = all('SELECT * FROM kitchen_scans WHERE user_id = ? ORDER BY id DESC LIMIT 6', req.user.id);
  res.json({
    scans: rows.map(s => ({
      id: s.id, createdAt: s.created_at, source: s.source,
      ingredients: (JSON.parse(s.ingredients) || []).map(k => ({ key: k, name: INGREDIENTS[k]?.name || k, emoji: INGREDIENTS[k]?.emoji || '•' })),
      imageUrl: s.image_path ? `/uploads/${s.image_path}` : null,
    })),
  });
});