import bcrypt from 'bcryptjs';
import { db, all, get, run, tx } from './db.js';
import { EXERCISES } from './data/exercises.js';
import { FOODS } from './data/foods.js';
import { RECIPES } from './data/kitchen.js';

const iso = (d) => d.toISOString().slice(0, 10);
function daysAgo(n) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return iso(d);
}

export function seedStaticData() {
  if (!get('SELECT COUNT(*) AS n FROM exercises').n) {
    for (const e of EXERCISES) {
      run(`INSERT INTO exercises (name, primary_muscles, secondary_muscles, equipment, category, instructions)
        VALUES (?, ?, ?, ?, ?, ?)`, e.name, e.primary_muscles, e.secondary_muscles, e.equipment, e.category, e.instructions);
    }
  }
  if (!get('SELECT COUNT(*) AS n FROM foods').n) {
    for (const f of FOODS) {
      run(`INSERT INTO foods (name, category, serving_label, serving_grams, calories, protein, carbs, fat, fiber, sodium, iron, calcium)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        f.name, f.category, f.serving_label, f.serving_grams, f.calories, f.protein, f.carbs, f.fat, f.fiber, f.sodium, f.iron, f.calcium);
    }
  }
  const recipeCount = get('SELECT COUNT(*) AS n FROM recipes').n;
  if (!recipeCount) {
    for (const r of RECIPES) {
      run(`INSERT INTO recipes (slug, name, description, cuisine, emoji, gradient, prep_min, cook_min, servings, calories, protein, carbs, fat, fiber, tags, ingredients, steps, goal_affinity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        r.slug, r.name, r.description, r.cuisine, r.emoji, r.gradient, r.prep_min, r.cook_min, r.servings,
        r.calories, r.protein, r.carbs, r.fat, r.fiber, r.tags, r.ingredients, r.steps, r.goal_affinity);
    }
  }
}

const MEAL_TEMPLATES = {
  breakfast: [
    [['Rolled Oats', 1], ['Banana', 1], ['Peanut Butter', 0.7], ['Greek Yogurt, 2%', 1]],
    [['Whole Egg', 3], ['Sourdough Bread', 2], ['Avocado', 0.7], ['Spinach, raw', 1]],
    [['Greek Yogurt, 2%', 1], ['Blueberries', 1], ['Chia Seeds', 1], ['Almonds', 0.7]],
    [['Whey Protein Isolate', 1], ['Banana', 1], ['Rolled Oats', 0.8], ['Skim Milk', 1]],
  ],
  lunch: [
    [['Chicken Breast, grilled', 1.4], ['White Rice, cooked', 1.2], ['Broccoli, steamed', 1], ['Extra Virgin Olive Oil', 0.7]],
    [['Tuna, canned in water', 1.5], ['Sourdough Bread', 2], ['Greek Yogurt, 2%', 0.4], ['Mixed Salad Leaves', 1]],
    [['Chicken Burrito Bowl', 1]],
    [['Turkey Breast, sliced', 1.3], ['Wholegrain Bread', 1.5], ['Avocado', 0.6], ['Tomato', 1]],
    [['Salmon Fillet', 1], ['Quinoa, cooked', 1], ['Asparagus', 1], ['Feta Cheese', 0.7]],
  ],
  dinner: [
    [['Lean Beef Mince (5%)', 1.2], ['Wholewheat Pasta, cooked', 1.3], ['Tomato', 2], ['Mozzarella, fresh', 0.5]],
    [['Salmon Fillet', 1.2], ['Sweet Potato, baked', 1.5], ['Green Beans', 1], ['Extra Virgin Olive Oil', 0.5]],
    [['Firm Tofu', 1.2], ['Brown Rice, cooked', 1], ['Broccoli, steamed', 1.2], ['Soy sauce', 0]],
    [['Chicken Breast, grilled', 1.3], ['Potato, boiled', 1.5], ['Mixed Salad Leaves', 1.5], ['Extra Virgin Olive Oil', 0.8]],
    [['Prawns', 1.2], ['Couscous, cooked', 1], ['Zucchini', 1], ['Feta Cheese', 0.6]],
  ],
  snacks: [
    [['Greek Yogurt, 2%', 1], ['Strawberries', 1]],
    [['Apple', 1], ['Almonds', 0.8]],
    [['Whey Protein Isolate', 1], ['Skim Milk', 1]],
    [['Protein Bar', 1]],
    [['Cottage Cheese', 1], ['Tomato', 0.5]],
    [['Banana', 1], ['Peanut Butter', 0.5]],
  ],
};

const PLAN = {
  'Push Day': [
    ['Barbell Bench Press', 68, 4, 8], ['Incline Dumbbell Press', 24, 3, 10], ['Overhead Press', 40, 3, 8],
    ['Dumbbell Lateral Raise', 10, 3, 14], ['Triceps Pushdown', 32, 3, 12], ['Cable Crossover', 15, 3, 12],
  ],
  'Pull Day': [
    ['Conventional Deadlift', 105, 3, 6], ['Lat Pulldown', 57, 4, 10], ['Barbell Row', 55, 3, 8],
    ['Face Pull', 20, 3, 15], ['Barbell Curl', 30, 3, 10], ['Dumbbell Hammer Curl', 12, 3, 12],
  ],
  'Leg Day': [
    ['Back Squat', 92, 4, 8], ['Romanian Deadlift', 72, 3, 10], ['Leg Press', 145, 3, 12],
    ['Lying Leg Curl', 40, 3, 12], ['Standing Calf Raise', 65, 4, 15], ['Hanging Leg Raise', 0, 3, 12],
  ],
  'Upper Body': [
    ['Incline Dumbbell Press', 26, 3, 10], ['Pull-Up', 0, 3, 8], ['Seated Cable Row', 52, 3, 10],
    ['Dumbbell Lateral Raise', 10, 3, 15], ['Incline Dumbbell Curl', 12, 3, 12], ['Overhead Triceps Extension', 20, 3, 12],
  ],
};

export function seedDemo() {
  const existing = get('SELECT id FROM users WHERE email = ?', 'demo@pepefit.app');
  if (existing) return;
  const password_hash = bcrypt.hashSync('demo1234', 10);
  const userId = Number(run('INSERT INTO users (email, password_hash, name, avatar_color, onboarded) VALUES (?, ?, ?, ?, 1)',
    'demo@pepefit.app', password_hash, 'Alex Rivera', 'volt').lastInsertRowid);

  run(`INSERT INTO profiles (user_id, age, sex, height_cm, weight_kg, experience, goal, weekly_frequency, diet, restrictions, activity_level, unit_system)
    VALUES (?, 29, 'male', 178, 76.6, 'intermediate', 'muscle_gain', 4, ?, ?, 'moderate', 'metric')`,
    userId, JSON.stringify(['High protein', 'Balanced']), JSON.stringify(['No shellfish']));
  run(`INSERT INTO targets (user_id, calories, protein, carbs, fat, fiber, sodium) VALUES (?, 2650, 170, 285, 78, 32, 2300)`, userId);

  const exerciseRows = all('SELECT id, name FROM exercises');
  const exId = Object.fromEntries(exerciseRows.map(e => [e.name, e.id]));
  const foodRows = all('SELECT * FROM foods');
  const foodByName = Object.fromEntries(foodRows.map(f => [f.name, f]));

  tx(() => {
    // Routines
    const routineIds = {};
    const routineMeta = {
      'Push Day': ['Chest, shoulders & triceps', 'volt'],
      'Pull Day': ['Back, rear delts & biceps', 'sky'],
      'Leg Day': ['Quads, hamstrings & glutes', 'rose'],
      'Upper Body': ['Balanced upper session', 'amber'],
    };
    for (const [name, moves] of Object.entries(PLAN)) {
      const rid = Number(run('INSERT INTO routines (user_id, name, description, color) VALUES (?, ?, ?, ?)',
        userId, name, routineMeta[name][0], routineMeta[name][1]).lastInsertRowid);
      routineIds[name] = rid;
      moves.forEach(([ex, , sets, reps], idx) => {
        run('INSERT INTO routine_exercises (routine_id, exercise_id, position, target_sets, target_reps) VALUES (?, ?, ?, ?, ?)',
          rid, exId[ex], idx, sets, String(reps));
      });
    }

    // Weight history — slow recomposition trend
    for (let i = 60; i >= 0; i -= 3) {
      const progress = (60 - i) / 60;
      const weight = Math.round((79.4 - progress * 2.6 + Math.sin(i * 1.7) * 0.25) * 10) / 10;
      run('INSERT INTO weight_logs (user_id, log_date, weight_kg) VALUES (?, ?, ?) ON CONFLICT(user_id, log_date) DO UPDATE SET weight_kg = excluded.weight_kg',
        userId, daysAgo(i), weight);
    }
    const latestWeight = get('SELECT weight_kg FROM weight_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT 1', userId);
    if (latestWeight) run('UPDATE profiles SET weight_kg = ? WHERE user_id = ?', latestWeight.weight_kg, userId);

    // Measurements every 14 days
    for (let i = 42; i >= 0; i -= 14) {
      const p = (42 - i) / 42;
      run(`INSERT INTO measurements (user_id, log_date, waist, chest, arms, thighs, hips, bodyfat) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        userId, daysAgo(i), 85 - p * 2.4, 101 + p * 1.2, 36.5 + p * 0.8, 58 + p * 0.6, 98 - p * 1.1, 18.5 - p * 1.0);
    }

    // Workout history: 6 weeks, Mon Push / Tue Pull / Thu Legs / Sat Upper
    const schedule = { 1: ['Push Day', 0], 2: ['Pull Day', 1], 4: ['Leg Day', 2], 6: ['Upper Body', 3] };
    const sessionsByDay = new Map();
    for (let i = 42; i >= 1; i--) {
      const day = new Date(daysAgo(i) + 'T12:00:00');
      const dow = day.getDay();
      if (!schedule[dow]) continue;
      if (i % 11 === 0) continue; // an occasional missed session — real life
      const [name, weekIdx] = schedule[dow];
      const d = daysAgo(i);
      const startHour = dow === 6 ? 10 : 18;
      const startedAt = `${d}T${String(startHour).padStart(2, '0')}:05:00.000Z`;
      const duration = 3300 + ((i * 137) % 1500);
      const sid = Number(run(`INSERT INTO workout_sessions (user_id, routine_id, name, started_at, completed_at, duration_sec, feeling)
        VALUES (?, ?, ?, ?, ?, ?, ?)`, userId, routineIds[name], name, startedAt,
        new Date(new Date(startedAt).getTime() + duration * 1000).toISOString(), duration, 3 + (i % 3)).lastInsertRowid);
      sessionsByDay.set(d, sid);
      const week = Math.floor((42 - i) / 7);
      for (const [exName, base, sets, reps] of PLAN[name]) {
        for (let s = 1; s <= sets; s++) {
          const weight = base === 0 ? 0 : Math.round((base * (1 + week * 0.022) + s * 1.25 + (i % 3) * 0.5) * 2) / 2;
          const r = Math.max(4, reps - (s > 2 ? 1 : 0) + ((i + s) % 2));
          run('INSERT INTO workout_sets (session_id, exercise_id, set_number, weight, reps, rpe) VALUES (?, ?, ?, ?, ?, ?)',
            sid, exId[exName], s, weight, r, 7 + ((s + i) % 3));
        }
      }
    }

    // Today's session — a completed Push Day earlier in the day
    const today = daysAgo(0);
    if (!sessionsByDay.has(today)) {
      const started = new Date(Date.now() - 3.2 * 3600 * 1000);
      const sid = Number(run(`INSERT INTO workout_sessions (user_id, routine_id, name, started_at, completed_at, duration_sec, feeling, notes)
        VALUES (?, ?, 'Push Day', ?, ?, 3720, 4, 'Bench felt strong today — added a rep on the top set.')`,
        userId, routineIds['Push Day'], started.toISOString(), new Date(started.getTime() + 3720000).toISOString()).lastInsertRowid);
      for (const [exName, base, sets, reps] of PLAN['Push Day']) {
        for (let s = 1; s <= sets; s++) {
          const weight = base === 0 ? 0 : base + (s === 1 ? 2.5 : 0);
          run('INSERT INTO workout_sets (session_id, exercise_id, set_number, weight, reps, rpe) VALUES (?, ?, ?, ?, ?, ?)',
            sid, exId[exName], s, weight, Math.max(5, reps - 1 + s), 7 + s);
        }
      }
    }

    // Meals for the last 30 days (today partially logged)
    const hour = new Date().getHours();
    for (let i = 29; i >= 0; i--) {
      const d = daysAgo(i);
      const mealTypes = i === 0 ? (hour >= 19 ? ['breakfast', 'lunch', 'snacks', 'dinner'] : ['breakfast', 'lunch', 'snacks']) : ['breakfast', 'lunch', 'dinner', 'snacks'];
      for (const [mi, type] of mealTypes.entries()) {
        const templates = MEAL_TEMPLATES[type];
        const items = templates[(i + mi * 3) % templates.length];
        for (const [foodName, qty] of items) {
          const f = foodByName[foodName];
          if (!f) continue;
          run(`INSERT INTO meal_logs (user_id, log_date, meal_type, food_id, name, servings, serving_label, calories, protein, carbs, fat, fiber, sodium, iron, calcium)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            userId, d, type, f.id, f.name, qty, f.serving_label, f.calories * qty, f.protein * qty, f.carbs * qty,
            f.fat * qty, f.fiber * qty, f.sodium * qty, f.iron * qty, f.calcium * qty);
        }
      }
    }

    // Saved recipes
    for (const slug of ['garlic-chicken-broccoli', 'berry-overnight-oats', 'teriyaki-salmon']) {
      const r = get('SELECT id FROM recipes WHERE slug = ?', slug);
      if (r) run('INSERT OR IGNORE INTO saved_recipes (user_id, recipe_id) VALUES (?, ?)', userId, r.id);
    }
  });
}

export function seedDatabase() {
  seedStaticData();
  seedDemo();
}

if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase();
  console.log('Seed complete. Demo account: demo@pepefit.app / demo1234');
  db.close();
}