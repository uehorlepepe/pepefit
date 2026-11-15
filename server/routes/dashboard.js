import { Router } from 'express';
import { all, get } from '../db.js';
import { authMiddleware, publicUser } from '../auth.js';
import { MUSCLE_LABELS } from '../data/exercises.js';

export const dashboardRouter = Router();
dashboardRouter.use(authMiddleware);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const iso = (d) => d.toISOString().slice(0, 10);

function shift(date, delta) {
  const d = new Date(date + 'T12:00:00');
  d.setDate(d.getDate() + delta);
  return iso(d);
}

function weekStart(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

dashboardRouter.get('/dashboard', (req, res) => {
  const date = DATE_RE.test(req.query.date) ? req.query.date : new Date().toISOString().slice(0, 10);
  const user = get('SELECT * FROM users WHERE id = ?', req.user.id);
  const targets = get('SELECT * FROM targets WHERE user_id = ?', req.user.id);
  const profile = get('SELECT * FROM profiles WHERE user_id = ?', req.user.id);

  const totals = get(`SELECT COALESCE(SUM(calories),0) AS calories, COALESCE(SUM(protein),0) AS protein,
    COALESCE(SUM(carbs),0) AS carbs, COALESCE(SUM(fat),0) AS fat, COALESCE(SUM(fiber),0) AS fiber
    FROM meal_logs WHERE user_id = ? AND log_date = ?`, req.user.id, date);

  const todaySessions = all(`SELECT * FROM workout_sessions WHERE user_id = ? AND substr(started_at,1,10) = ? ORDER BY started_at DESC`, req.user.id, date)
    .map(s => {
      const sets = get('SELECT COUNT(*) AS n, COALESCE(SUM(weight*reps),0) AS v FROM workout_sets WHERE session_id = ?', s.id);
      return { id: s.id, name: s.name, completedAt: s.completed_at, durationSec: s.duration_sec, sets: sets.n, volume: Math.round(sets.v) };
    });
  const activeSession = get('SELECT * FROM workout_sessions WHERE user_id = ? AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1', req.user.id);

  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = shift(date, -i);
    const m = get('SELECT COALESCE(SUM(calories),0) AS calories, COALESCE(SUM(protein),0) AS protein FROM meal_logs WHERE user_id = ? AND log_date = ?', req.user.id, d);
    const workouts = get(`SELECT COUNT(*) AS n, COALESCE(SUM(duration_sec),0) AS sec FROM workout_sessions
      WHERE user_id = ? AND completed_at IS NOT NULL AND substr(started_at,1,10) = ?`, req.user.id, d);
    week.push({ date: d, calories: Math.round(m.calories), protein: Math.round(m.protein), workouts: workouts.n, minutes: Math.round(workouts.sec / 60) });
  }

  const ws = weekStart(date);
  const weeklyWorkouts = get(`SELECT COUNT(*) AS n FROM workout_sessions WHERE user_id = ?
    AND completed_at IS NOT NULL AND substr(started_at,1,10) BETWEEN ? AND ?`, req.user.id, ws, shift(ws, 6)).n;
  const weeklyGoal = profile?.weekly_frequency || 4;

  // Activity streak: consecutive days with a meal or workout logged.
  const dates = all(`SELECT DISTINCT d FROM (
      SELECT log_date AS d FROM meal_logs WHERE user_id = ?
      UNION SELECT substr(started_at,1,10) AS d FROM workout_sessions WHERE user_id = ? AND completed_at IS NOT NULL
    ) ORDER BY d DESC LIMIT 400`, req.user.id, req.user.id).map(r => r.d);
  const dateSet = new Set(dates);
  let streak = 0;
  let cursor = dateSet.has(date) ? date : shift(date, -1);
  while (dateSet.has(cursor)) { streak++; cursor = shift(cursor, -1); }

  const weightNow = get('SELECT weight_kg, log_date FROM weight_logs WHERE user_id = ? ORDER BY log_date DESC LIMIT 1', req.user.id);
  const weightBefore = get('SELECT weight_kg FROM weight_logs WHERE user_id = ? AND log_date <= ? ORDER BY log_date DESC LIMIT 1', req.user.id, shift(date, -30));
  const weightChange = weightNow && weightBefore ? Math.round((weightNow.weight_kg - weightBefore.weight_kg) * 10) / 10 : 0;

  // Muscle focus — least-trained group over the last 7 days
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const muscleRows = all(`SELECT e.primary_muscles, e.secondary_muscles FROM workout_sets st
    JOIN workout_sessions ws ON ws.id = st.session_id JOIN exercises e ON e.id = st.exercise_id
    WHERE ws.user_id = ? AND ws.started_at >= ? AND st.completed = 1`, req.user.id, since);
  const muscleSets = Object.fromEntries(Object.keys(MUSCLE_LABELS).map(k => [k, 0]));
  for (const r of muscleRows) {
    for (const m of JSON.parse(r.primary_muscles)) if (m in muscleSets) muscleSets[m] += 1;
    for (const m of JSON.parse(r.secondary_muscles)) if (m in muscleSets) muscleSets[m] += 0.5;
  }
  const priorityOrder = ['chest', 'lats', 'quads', 'hamstrings', 'glutes', 'front_delts', 'side_delts', 'rear_delts', 'biceps', 'triceps', 'upper_back', 'abs', 'traps', 'calves'];
  const muscleFocus = priorityOrder
    .map(k => ({ key: k, label: MUSCLE_LABELS[k], sets: muscleSets[k] || 0 }))
    .sort((a, b) => a.sets - b.sets)[0];

  const lastSession = get(`SELECT * FROM workout_sessions WHERE user_id = ? AND completed_at IS NOT NULL ORDER BY started_at DESC LIMIT 1`, req.user.id);
  const daysSinceWorkout = lastSession ? Math.floor((new Date(date + 'T12:00:00') - new Date(lastSession.started_at.slice(0, 10) + 'T12:00:00')) / 86400000) : null;

  const routines = all('SELECT * FROM routines WHERE user_id = ?', req.user.id);
  const routineSuggestion = routines.map(r => {
    const last = get('SELECT started_at FROM workout_sessions WHERE routine_id = ? AND completed_at IS NOT NULL ORDER BY started_at DESC LIMIT 1', r.id);
    const exerciseCount = get('SELECT COUNT(*) AS n FROM routine_exercises WHERE routine_id = ?', r.id)?.n || 0;
    return {
      id: r.id, name: r.name, last: last?.started_at || null,
      exerciseCount, estimatedMin: Math.max(20, Math.round(exerciseCount * 8 + 5)),
    };
  }).sort((a, b) => (a.last || '').localeCompare(b.last || ''))[0] || null;

  const remaining = {
    calories: Math.round(targets.calories - totals.calories),
    protein: Math.round(targets.protein - totals.protein),
    carbs: Math.round(targets.carbs - totals.carbs),
    fat: Math.round(targets.fat - totals.fat),
  };

  const insights = [];
  if (activeSession) {
    insights.push({ kind: 'workout', title: `${activeSession.name} is live`, body: 'Pick up where you left off — your sets are saved.' });
  } else if (todaySessions.some(s => s.completedAt)) {
    insights.push({ kind: 'done', title: 'Training is banked for today', body: `Nice work. ${Math.round(todaySessions.reduce((s, x) => s + x.volume, 0)).toLocaleString()} kg moved. Refuel with protein.` });
  } else if (daysSinceWorkout !== null && daysSinceWorkout >= 3) {
    insights.push({ kind: 'nudge', title: `It's been ${daysSinceWorkout} days since your last session`, body: 'You don\'t need a perfect workout. Fifteen focused minutes keeps the habit alive.' });
  } else if (routineSuggestion) {
    insights.push({ kind: 'plan', title: `${routineSuggestion.name} is up next`, body: 'Your plan is ready whenever you are. Start it from the Workout tab.' });
  }
  if (remaining.protein > 25 && totals.calories > 300) {
    insights.push({ kind: 'protein', title: `${remaining.protein} g of protein to go`, body: 'A Greek yogurt bowl or a shake would close most of that gap without much effort.' });
  }
  if (muscleFocus && muscleFocus.sets === 0) {
    const suggestion = { chest: 'push movements', lats: 'a few pull sets', quads: 'squats or leg press', hamstrings: 'Romanian deadlifts', glutes: 'hip thrusts', side_delts: 'lateral raises', rear_delts: 'face pulls', biceps: 'curls', triceps: 'pushdowns', abs: 'core work', calves: 'calf raises', upper_back: 'rows' }[muscleFocus.key] || 'a little extra work';
    insights.push({ kind: 'muscle', title: `${muscleFocus.label} haven't had attention`, body: `Add ${suggestion} this week to keep your training balanced.` });
  }
  if (streak >= 3) {
    insights.push({ kind: 'streak', title: `${streak}-day streak`, body: 'Consistency is compounding. Keep the bar low and keep showing up.' });
  }
  const headline = insights[0]?.title || 'A fresh day, a clean slate';
  const subline = insights[0]?.body || 'Log your first meal or workout to get today moving.';

  res.json({
    date,
    user: publicUser(user),
    profile,
    targets,
    totals: {
      calories: Math.round(totals.calories), protein: Math.round(totals.protein), carbs: Math.round(totals.carbs),
      fat: Math.round(totals.fat), fiber: Math.round(totals.fiber),
    },
    remaining,
    todaySessions,
    activeSession: activeSession ? { id: activeSession.id, name: activeSession.name, startedAt: activeSession.started_at } : null,
    week,
    weeklyWorkouts,
    weeklyGoal,
    streak,
    weightChange,
    muscleFocus,
    daysSinceWorkout,
    routineSuggestion,
    headline,
    subline,
    insights: insights.slice(0, 4),
  });
});