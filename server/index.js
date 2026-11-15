import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seedDatabase } from './seed.js';
import { authRouter } from './routes/auth.js';
import { profileRouter } from './routes/profile.js';
import { workoutRouter } from './routes/workouts.js';
import { nutritionRouter } from './routes/nutrition.js';
import { progressRouter } from './routes/progress.js';
import { kitchenRouter } from './routes/kitchen.js';
import { dashboardRouter } from './routes/dashboard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

seedDatabase();

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '2mb' }));

app.use('/uploads', express.static(path.join(root, 'data', 'uploads'), { maxAge: '1d' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, name: 'Pepefit', time: new Date().toISOString() }));

app.use('/api/auth', authRouter);
app.use('/api', profileRouter);
app.use('/api/workouts', workoutRouter);
app.use('/api/nutrition', nutritionRouter);
app.use('/api', progressRouter);
app.use('/api', kitchenRouter);
app.use('/api', dashboardRouter);

app.use('/api', (_req, res) => res.status(404).json({ error: 'Endpoint not found.' }));

if (process.env.NODE_ENV === 'production' && fs.existsSync(path.join(root, 'dist'))) {
  app.use(express.static(path.join(root, 'dist')));
  app.use((req, res, next) => {
    if (req.method !== 'GET') return next();
    res.sendFile(path.join(root, 'dist', 'index.html'));
  });
}

// Central error handler
app.use((err, _req, res, _next) => {
  console.error('[api error]', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Image is too large. Keep it under 10 MB.' });
  if (err.message?.includes('Please upload')) return res.status(400).json({ error: err.message });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Malformed request.' });
  res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
});

const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => {
  console.log(`Pepefit API running on http://localhost:${PORT}`);
  console.log(process.env.OPENAI_API_KEY ? 'AI Kitchen: vision model enabled' : 'AI Kitchen: demo vision mode (set OPENAI_API_KEY for real image analysis)');
});