import { Router } from 'express';
import { all, get, run, tx } from '../db.js';
import { authMiddleware } from '../auth.js';
import { MUSCLE_LABELS } from '../data/exercises.js';

export const workoutRouter = Router();
workoutRouter.use(authMiddleware);

const parseExercise = (e) => e && ({
  id: e.id,
  name: e.name,
  primaryMuscles: JSON.parse(e.primary_muscles),
  secondaryMuscles: JSON.parse(e.secondary_muscles),
  equipment: e.equipment,
  category: e.category,
  instructions: e.instructions,
  isCustom: !!e.is_custom,
});

workoutRouter.get('/exercises', (req, res) => {
  const { q, muscle } = req.query;
  let rows = all('SELECT * FROM exercises WHERE is_custom = 0 OR user_id = ? ORDER BY name', req.user.id);
  let items = rows.map(parseExercise);
  if (q) {
    const needle = String(q).toLowerCase();
    items = items.filter(e => e.name.toLowerCase().includes(needle) || e.equipment?.toLowerCase().includes(needle));
  }
  if (muscle) items = items.filter(e => e.primaryMuscles.includes(muscle) || e.secondaryMuscles.includes(muscle));
  res.json({ exercises: items });
});

workoutRouter.get('/exercises/:id', (req, res) => {
  const row = get('SELECT * FROM exercises WHERE id = ? AND (is_custom = 0 OR user_id = ?)', req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Exercise not found.' });
  const exercise = parseExercise(row);

  const history = all(`
    SELECT ws.started_at, st.weight, st.reps, st.created_at
    FROM workout_sets st JOIN workout_sessions ws ON ws.id = st.session_id
    WHERE ws.user_id = ? AND st.exercise_id = ? AND st.completed = 1
    ORDER BY ws.started_at ASC`, req.user.id, row.id);

  const byDay = new Map();
  for (const h of history) {
    const day = h.started_at.slice(0, 10);
    const entry = byDay.get(day) || { date: day, topWeight: 0, volume: 0, sets: 0, bestReps: 0 };
    entry.topWeight = Math.max(entry.topWeight, h.weight);
    entry.bestReps = Math.max(entry.bestReps, h.reps);
    entry.volume += h.weight * h.reps;
    entry.sets += 1;
    byDay.set(day, entry);
  }
  const sessions = [...byDay.values()].slice(-12);
  const pr = history.reduce((best, h) => {
    const e1rm = Math.round(h.weight * (1 + h.reps / 30));
    if (!best || e1rm > best.e1rm) return { weight: h.weight, reps: h.reps, e1rm, date: h.started_at.slice(0, 10) };
    return best;
  }, null);

  const lastSession = get(`
    SELECT ws.id, ws.started_at, ws.name FROM workout_sessions ws
    WHERE ws.user_id = ? AND EXISTS (SELECT 1 FROM workout_sets st WHERE st.session_id = ws.id AND st.exercise_id = ?)
    ORDER BY ws.started_at DESC LIMIT 1`, req.user.id, row.id);
  const lastSets = lastSession ? all('SELECT set_number, weight, reps FROM workout_sets WHERE session_id = ? AND exercise_id = ? ORDER BY set_number', lastSession.id, row.id) : [];

  res.json({ exercise, history: sessions, pr, last: lastSession ? { date: lastSession.started_at, name: lastSession.name, sets: lastSets } : null });
});

workoutRouter.post('/exercises', (req, res) => {
  const { name, primaryMuscles, secondaryMuscles, equipment, category, instructions } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Exercise name is required.' });
  if (!Array.isArray(primaryMuscles) || !primaryMuscles.length) return res.status(400).json({ error: 'Pick at least one primary muscle.' });
  const valid = Object.keys(MUSCLE_LABELS);
  if (primaryMuscles.some(m => !valid.includes(m))) return res.status(400).json({ error: 'Unknown muscle group.' });
  const result = run(`INSERT INTO exercises (name, primary_muscles, secondary_muscles, equipment, category, instructions, is_custom, user_id)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)`, String(name).trim(), JSON.stringify(primaryMuscles),
    JSON.stringify((secondaryMuscles || []).filter(m => valid.includes(m))), equipment || 'Other', category || 'Compound', instructions || '', req.user.id);
  const row = get('SELECT * FROM exercises WHERE id = ?', Number(result.lastInsertRowid));
  res.status(201).json({ exercise: parseExercise(row) });
});

function routineWithExercises(routine, userId) {
  const items = all(`SELECT re.*, e.name AS exercise_name, e.primary_muscles, e.secondary_muscles, e.equipment, e.category
    FROM routine_exercises re JOIN exercises e ON e.id = re.exercise_id
    WHERE re.routine_id = ? ORDER BY re.position`, routine.id);
  const last = get(`SELECT completed_at, started_at FROM workout_sessions WHERE routine_id = ? AND completed_at IS NOT NULL ORDER BY started_at DESC LIMIT 1`, routine.id);
  return {
    id: routine.id,
    name: routine.name,
    description: routine.description,
    color: routine.color,
    createdAt: routine.created_at,
    lastPerformed: last?.completed_at || last?.started_at || null,
    exercises: items.map(i => ({
      id: i.id,
      exerciseId: i.exercise_id,
      name: i.exercise_name,
      primaryMuscles: JSON.parse(i.primary_muscles),
      secondaryMuscles: JSON.parse(i.secondary_muscles),
      equipment: i.equipment,
      category: i.category,
      targetSets: i.target_sets,
      targetReps: i.target_reps,
    })),
  };
}

workoutRouter.get('/routines', (req, res) => {
  const routines = all('SELECT * FROM routines WHERE user_id = ? ORDER BY id', req.user.id);
  res.json({ routines: routines.map(r => routineWithExercises(r, req.user.id)) });
});

workoutRouter.post('/routines', (req, res) => {
  const { name, description, exercises = [], color } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Give your routine a name.' });
  if (!Array.isArray(exercises) || !exercises.length) return res.status(400).json({ error: 'Add at least one exercise.' });
  const id = tx(() => {
    const result = run('INSERT INTO routines (user_id, name, description, color) VALUES (?, ?, ?, ?)',
      req.user.id, String(name).trim(), description || '', color || 'volt');
    const routineId = Number(result.lastInsertRowid);
    exercises.forEach((ex, idx) => {
      run('INSERT INTO routine_exercises (routine_id, exercise_id, position, target_sets, target_reps) VALUES (?, ?, ?, ?, ?)',
        routineId, ex.exerciseId, idx, ex.targetSets || 3, ex.targetReps || '8-12');
    });
    return routineId;
  });
  const routine = get('SELECT * FROM routines WHERE id = ?', id);
  res.status(201).json({ routine: routineWithExercises(routine, req.user.id) });
});

workoutRouter.put('/routines/:id', (req, res) => {
  const routine = get('SELECT * FROM routines WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!routine) return res.status(404).json({ error: 'Routine not found.' });
  const { name, description, exercises = [] } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Give your routine a name.' });
  if (!Array.isArray(exercises) || !exercises.length) return res.status(400).json({ error: 'Add at least one exercise.' });
  tx(() => {
    run('UPDATE routines SET name = ?, description = ? WHERE id = ?', String(name).trim(), description || '', routine.id);
    run('DELETE FROM routine_exercises WHERE routine_id = ?', routine.id);
    exercises.forEach((ex, idx) => {
      run('INSERT INTO routine_exercises (routine_id, exercise_id, position, target_sets, target_reps) VALUES (?, ?, ?, ?, ?)',
        routine.id, ex.exerciseId, idx, ex.targetSets || 3, ex.targetReps || '8-12');
    });
  });
  res.json({ routine: routineWithExercises(get('SELECT * FROM routines WHERE id = ?', routine.id), req.user.id) });
});

workoutRouter.delete('/routines/:id', (req, res) => {
  run('DELETE FROM routines WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  res.json({ ok: true });
});

function sessionPayload(session, userId) {
  const sets = all(`SELECT st.*, e.name AS exercise_name FROM workout_sets st JOIN exercises e ON e.id = st.exercise_id
    WHERE st.session_id = ? ORDER BY st.id`, session.id);
  const planned = all(`SELECT se.*, e.name AS exercise_name, e.primary_muscles, e.equipment FROM session_exercises se
    JOIN exercises e ON e.id = se.exercise_id WHERE se.session_id = ? ORDER BY se.position, se.id`, session.id);
  const grouped = [];
  const map = new Map();

  for (const p of planned) {
    const group = {
      exerciseId: p.exercise_id, name: p.exercise_name, muscles: JSON.parse(p.primary_muscles),
      equipment: p.equipment, targetSets: p.target_sets, targetReps: p.target_reps, sets: [],
    };
    map.set(p.exercise_id, group);
    grouped.push(group);
  }

  for (const s of sets) {
    let group = map.get(s.exercise_id);
    if (!group) {
      const ex = get('SELECT * FROM exercises WHERE id = ?', s.exercise_id);
      group = {
        exerciseId: s.exercise_id, name: s.exercise_name, muscles: ex ? JSON.parse(ex.primary_muscles) : [],
        equipment: ex?.equipment, targetSets: 3, targetReps: '8-12', sets: [],
      };
      map.set(s.exercise_id, group);
      grouped.push(group);
    }
    group.sets.push({ id: s.id, setNumber: s.set_number, weight: s.weight, reps: s.reps, rpe: s.rpe, completed: !!s.completed });
  }

  for (const group of grouped) {
    const last = get(`SELECT ws.id, ws.started_at FROM workout_sessions ws
      WHERE ws.user_id = ? AND ws.completed_at IS NOT NULL AND ws.id != ?
      AND EXISTS (SELECT 1 FROM workout_sets st WHERE st.session_id = ws.id AND st.exercise_id = ?)
      ORDER BY ws.started_at DESC LIMIT 1`, userId, session.id, group.exerciseId);
    if (last) {
      group.last = {
        date: last.started_at,
        sets: all('SELECT weight, reps FROM workout_sets WHERE session_id = ? AND exercise_id = ? AND completed = 1 ORDER BY set_number', last.id, group.exerciseId),
      };
    } else group.last = null;
  }

  const volume = sets.reduce((sum, s) => sum + s.weight * s.reps, 0);
  return {
    id: session.id,
    name: session.name,
    routineId: session.routine_id,
    startedAt: session.started_at,
    completedAt: session.completed_at,
    durationSec: session.duration_sec,
    notes: session.notes,
    feeling: session.feeling,
    volume: Math.round(volume),
    totalSets: sets.length,
    exercises: grouped,
  };
}

workoutRouter.get('/sessions', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 100);
  const rows = all('SELECT * FROM workout_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT ?', req.user.id, limit);
  const items = rows.map(r => sessionPayload(r, req.user.id));
  const inProgress = items.find(s => !s.completedAt) || null;
  res.json({ sessions: items.filter(s => s.completedAt), inProgress });
});

workoutRouter.post('/sessions', (req, res) => {
  const { name, routineId } = req.body || {};
  const active = get('SELECT id FROM workout_sessions WHERE user_id = ? AND completed_at IS NULL ORDER BY started_at DESC LIMIT 1', req.user.id);
  if (active) return res.status(409).json({ error: 'You already have a workout in progress.', sessionId: active.id });
  const routine = routineId ? get('SELECT * FROM routines WHERE id = ? AND user_id = ?', routineId, req.user.id) : null;
  const sessionId = tx(() => {
    const result = run('INSERT INTO workout_sessions (user_id, routine_id, name, started_at) VALUES (?, ?, ?, ?)',
      req.user.id, routine?.id || null, String(name || routine?.name || 'Training session').trim(), new Date().toISOString());
    const sid = Number(result.lastInsertRowid);
    if (routine) {
      const items = all('SELECT * FROM routine_exercises WHERE routine_id = ? ORDER BY position', routine.id);
      items.forEach((item, idx) => {
        run('INSERT INTO session_exercises (session_id, exercise_id, position, target_sets, target_reps) VALUES (?, ?, ?, ?, ?)',
          sid, item.exercise_id, idx, item.target_sets, item.target_reps);
      });
    }
    return sid;
  });
  const session = get('SELECT * FROM workout_sessions WHERE id = ?', sessionId);
  res.status(201).json({ session: sessionPayload(session, req.user.id) });
});

workoutRouter.post('/sessions/:id/exercises', (req, res) => {
  const session = get('SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Workout not found.' });
  if (session.completed_at) return res.status(400).json({ error: 'This workout is already finished.' });
  const { exerciseId, targetSets, targetReps } = req.body || {};
  const exercise = get('SELECT * FROM exercises WHERE id = ?', exerciseId);
  if (!exercise) return res.status(400).json({ error: 'Exercise not found.' });
  const existing = get('SELECT id FROM session_exercises WHERE session_id = ? AND exercise_id = ?', session.id, exerciseId);
  if (existing) return res.json({ session: sessionPayload(session, req.user.id) });
  const pos = get('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM session_exercises WHERE session_id = ?', session.id).n;
  run('INSERT INTO session_exercises (session_id, exercise_id, position, target_sets, target_reps) VALUES (?, ?, ?, ?, ?)',
    session.id, exerciseId, pos, Number(targetSets) || 3, targetReps || '8-12');
  res.status(201).json({ session: sessionPayload(session, req.user.id) });
});

workoutRouter.delete('/sessions/:id/exercises/:exerciseId', (req, res) => {
  const session = get('SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Workout not found.' });
  const sets = get('SELECT COUNT(*) AS n FROM workout_sets WHERE session_id = ? AND exercise_id = ?', session.id, req.params.exerciseId);
  if (sets.n > 0) return res.status(400).json({ error: 'Remove the logged sets first.' });
  run('DELETE FROM session_exercises WHERE session_id = ? AND exercise_id = ?', session.id, req.params.exerciseId);
  res.json({ session: sessionPayload(session, req.user.id) });
});

workoutRouter.get('/sessions/:id', (req, res) => {
  const session = get('SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Workout not found.' });
  res.json({ session: sessionPayload(session, req.user.id) });
});

workoutRouter.patch('/sessions/:id', (req, res) => {
  const session = get('SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Workout not found.' });
  const { notes, feeling, finished, durationSec } = req.body || {};
  const duration = durationSec ?? Math.max(0, Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000));
  run(`UPDATE workout_sessions SET notes = COALESCE(?, notes), feeling = COALESCE(?, feeling),
    completed_at = ?, duration_sec = ? WHERE id = ?`,
    notes ?? null, feeling ?? null, finished ? new Date().toISOString() : session.completed_at, duration, session.id);
  const updated = get('SELECT * FROM workout_sessions WHERE id = ?', session.id);
  res.json({ session: sessionPayload(updated, req.user.id) });
});

workoutRouter.delete('/sessions/:id', (req, res) => {
  run('DELETE FROM workout_sessions WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  res.json({ ok: true });
});

workoutRouter.post('/sessions/:id/sets', (req, res) => {
  const session = get('SELECT * FROM workout_sessions WHERE id = ? AND user_id = ?', req.params.id, req.user.id);
  if (!session) return res.status(404).json({ error: 'Workout not found.' });
  const { exerciseId, weight, reps, rpe } = req.body || {};
  const exercise = get('SELECT * FROM exercises WHERE id = ?', exerciseId);
  if (!exercise) return res.status(400).json({ error: 'Pick an exercise first.' });
  if (!Number.isFinite(Number(reps)) || Number(reps) < 1) return res.status(400).json({ error: 'Reps must be at least 1.' });
  if (!Number.isFinite(Number(weight)) || Number(weight) < 0) return res.status(400).json({ error: 'Weight cannot be negative.' });
  const last = get('SELECT MAX(set_number) AS n FROM workout_sets WHERE session_id = ? AND exercise_id = ?', session.id, exerciseId);
  const setNumber = (last?.n || 0) + 1;
  const prevBest = get(`SELECT MAX(weight) AS w FROM workout_sets st JOIN workout_sessions ws ON ws.id = st.session_id
    WHERE ws.user_id = ? AND st.exercise_id = ? AND st.completed = 1 AND ws.completed_at IS NOT NULL AND ws.id != ?`,
    req.user.id, exerciseId, session.id);
  const result = run('INSERT INTO workout_sets (session_id, exercise_id, set_number, weight, reps, rpe) VALUES (?, ?, ?, ?, ?, ?)',
    session.id, exerciseId, setNumber, Number(weight), Number(reps), rpe ?? null);
  const isPR = Number(weight) > (prevBest?.w || 0) && Number(weight) > 0;
  res.status(201).json({ set: { id: Number(result.lastInsertRowid), setNumber, weight: Number(weight), reps: Number(reps), isPR }, isPR });
});

workoutRouter.put('/sets/:id', (req, res) => {
  const set = get(`SELECT st.* FROM workout_sets st JOIN workout_sessions ws ON ws.id = st.session_id
    WHERE st.id = ? AND ws.user_id = ?`, req.params.id, req.user.id);
  if (!set) return res.status(404).json({ error: 'Set not found.' });
  const { weight, reps, rpe, completed } = req.body || {};
  run('UPDATE workout_sets SET weight = COALESCE(?, weight), reps = COALESCE(?, reps), rpe = COALESCE(?, rpe), completed = COALESCE(?, completed) WHERE id = ?',
    weight ?? null, reps ?? null, rpe ?? null, completed === undefined ? null : (completed ? 1 : 0), set.id);
  res.json({ ok: true });
});

workoutRouter.delete('/sets/:id', (req, res) => {
  run(`DELETE FROM workout_sets WHERE id IN (
    SELECT st.id FROM workout_sets st JOIN workout_sessions ws ON ws.id = st.session_id WHERE st.id = ? AND ws.user_id = ?)`,
    req.params.id, req.user.id);
  res.json({ ok: true });
});

workoutRouter.get('/muscle-map', (req, res) => {
  const days = [1, 7, 30].includes(Number(req.query.days)) ? Number(req.query.days) : 7;
  const start = new Date(Date.now() - (days - 1) * 86400000);
  start.setHours(0, 0, 0, 0);
  const rows = all(`
    SELECT st.exercise_id, st.weight, st.reps, st.completed, ws.started_at, e.primary_muscles, e.secondary_muscles
    FROM workout_sets st
    JOIN workout_sessions ws ON ws.id = st.session_id
    JOIN exercises e ON e.id = st.exercise_id
    WHERE ws.user_id = ? AND ws.started_at >= ? AND st.completed = 1`,
    req.user.id, start.toISOString());

  const muscles = Object.fromEntries(Object.keys(MUSCLE_LABELS).map(k => [k, {
    key: k, label: MUSCLE_LABELS[k], sets: 0, volume: 0, lastTrained: null, exercises: new Set(),
  }]));
  const now = Date.now();
  for (const row of rows) {
    const primary = JSON.parse(row.primary_muscles);
    const secondary = JSON.parse(row.secondary_muscles);
    for (const m of primary) {
      if (!muscles[m]) continue;
      muscles[m].sets += 1;
      muscles[m].volume += row.weight * row.reps || row.reps * 20;
      muscles[m].exercises.add(row.exercise_id);
      if (!muscles[m].lastTrained || row.started_at > muscles[m].lastTrained) muscles[m].lastTrained = row.started_at;
    }
    for (const m of secondary) {
      if (!muscles[m]) continue;
      muscles[m].sets += 0.5;
      muscles[m].volume += (row.weight * row.reps || row.reps * 20) * 0.5;
    }
  }
  const allTime = all(`SELECT MAX(ws.started_at) AS last FROM workout_sets st
    JOIN workout_sessions ws ON ws.id = st.session_id
    WHERE ws.user_id = ? AND st.completed = 1`, req.user.id);
  const targetPerRange = days === 1 ? 6 : days === 7 ? 14 : 30;
  const list = Object.values(muscles).map(m => {
    const intensity = Math.min(1, m.sets / targetPerRange);
    const hoursSince = m.lastTrained ? (now - new Date(m.lastTrained).getTime()) / 3600000 : null;
    let status = 'untrained';
    if (m.sets > 0) status = intensity < 0.34 ? 'light' : intensity < 0.75 ? 'moderate' : 'high';
    let recovery = m.sets === 0 ? 'resting' : hoursSince !== null && hoursSince < 24 ? 'recovering' : 'ready';
    if (!m.lastTrained && days === 30) recovery = 'neglected';
    return {
      key: m.key, label: m.label, sets: Math.round(m.sets * 10) / 10, volume: Math.round(m.volume),
      intensity: Math.round(intensity * 100) / 100, status, recovery,
      lastTrained: m.lastTrained, exerciseCount: m.exercises.size,
    };
  });
  const trained = list.filter(m => m.sets > 0).sort((a, b) => b.sets - a.sets);
  const neglected = list.filter(m => m.sets === 0 && m.key !== 'forearms').sort((a, b) => a.label.localeCompare(b.label));
  res.json({
    days, daysLabel: days === 1 ? 'Today' : `Last ${days} days`,
    muscles: list,
    top: trained.slice(0, 4),
    neglected: neglected.map(m => m.label),
    totalSets: rows.length,
    lastWorkout: allTime[0]?.last || null,
  });
});

workoutRouter.get('/personal-records', (req, res) => {
  const rows = all(`
    SELECT e.id, e.name, e.primary_muscles, st.weight, st.reps, ws.started_at
    FROM workout_sets st JOIN workout_sessions ws ON ws.id = st.session_id JOIN exercises e ON e.id = st.exercise_id
    WHERE ws.user_id = ? AND st.completed = 1 AND st.weight > 0
    ORDER BY ws.started_at DESC`, req.user.id);
  const map = new Map();
  for (const r of rows) {
    const cur = map.get(r.id);
    if (!cur || r.weight > cur.weight || (r.weight === cur.weight && r.reps > cur.reps)) {
      map.set(r.id, { exerciseId: r.id, name: r.name, muscles: JSON.parse(r.primary_muscles), weight: r.weight, reps: r.reps, date: cur?.date || r.started_at });
    }
  }
  res.json({ records: [...map.values()].sort((a, b) => b.date.localeCompare(a.date)) });
});

workoutRouter.get('/summary', (req, res) => {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  startOfWeek.setHours(0, 0, 0, 0);
  const sessions = all('SELECT * FROM workout_sessions WHERE user_id = ? AND completed_at IS NOT NULL AND started_at >= ? ORDER BY started_at', req.user.id, startOfWeek.toISOString());
  const weekSessions = sessions.length;
  const allTime = get('SELECT COUNT(*) AS n FROM workout_sessions WHERE user_id = ? AND completed_at IS NOT NULL', req.user.id);
  const volume = all(`SELECT ws.id, SUM(st.weight * st.reps) AS v FROM workout_sessions ws
    LEFT JOIN workout_sets st ON st.session_id = ws.id WHERE ws.user_id = ? AND ws.completed_at IS NOT NULL GROUP BY ws.id`, req.user.id);
  res.json({
    weekSessions,
    thisWeek: sessions.map(s => s.started_at),
    totalWorkouts: allTime.n,
    totalVolume: Math.round(volume.reduce((sum, r) => sum + (r.v || 0), 0)),
    avgDuration: sessions.length ? Math.round(sessions.reduce((s, x) => s + (x.duration_sec || 0), 0) / sessions.length / 60) : 0,
  });
});