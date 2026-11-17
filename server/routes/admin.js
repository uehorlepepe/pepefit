import { Router } from 'express';
import { all, get } from '../db.js';
import { authMiddleware } from '../auth.js';

export const adminRouter = Router();

function requireAdmin(req, res, next) {
  const user = get('SELECT is_admin FROM users WHERE id = ?', req.user.id);
  if (!user || !user.is_admin) return res.status(403).json({ error: 'Admin access required.' });
  next();
}

adminRouter.use(authMiddleware, requireAdmin);

adminRouter.get('/overview', (_req, res) => {
  const rows = all(`
    SELECT u.id, u.name, u.email, u.created_at, u.is_admin,
      (SELECT COUNT(*) FROM workout_sessions s WHERE s.user_id = u.id AND s.completed_at IS NOT NULL) AS workouts,
      (SELECT COUNT(*) FROM workout_sets ws JOIN workout_sessions s2 ON s2.id = ws.session_id WHERE s2.user_id = u.id) AS sets_logged,
      (SELECT MAX(s3.started_at) FROM workout_sessions s3 WHERE s3.user_id = u.id) AS last_workout,
      (SELECT COUNT(*) FROM meal_logs m WHERE m.user_id = u.id) AS meals,
      (SELECT COUNT(DISTINCT m2.log_date) FROM meal_logs m2 WHERE m2.user_id = u.id) AS meal_days
    FROM users u
    ORDER BY u.created_at DESC, u.id DESC
  `);

  const users = rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    createdAt: u.created_at,
    isAdmin: !!u.is_admin,
    workouts: u.workouts,
    sets: u.sets_logged,
    meals: u.meals,
    mealDays: u.meal_days,
    lastWorkout: u.last_workout,
  }));

  res.json({
    totals: {
      users: users.length,
      admins: users.filter((u) => u.isAdmin).length,
      workouts: users.reduce((n, u) => n + u.workouts, 0),
      sets: users.reduce((n, u) => n + u.sets, 0),
      meals: users.reduce((n, u) => n + u.meals, 0),
    },
    library: {
      exercises: get('SELECT COUNT(*) AS n FROM exercises').n,
      foods: get('SELECT COUNT(*) AS n FROM foods').n,
      recipes: get('SELECT COUNT(*) AS n FROM recipes').n,
    },
    users,
  });
});