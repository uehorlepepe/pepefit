# Pepefit

Train. Fuel. Evolve.

Pepefit is a mobile-first fitness app for training, nutrition and progress tracking. It combines workout logging, a food diary with macro targets, an AI-assisted kitchen, and long-term progress insights in one focused interface.

## Features

- **Training** — routines, live sessions, set logging, rest timer, muscle map and personal records
- **Nutrition** — food diary, custom foods, macro and micronutrient tracking
- **AI Kitchen** — scan ingredients and get recipe matches based on your remaining macros
- **Progress** — weight trends, body measurements, training consistency and nutrition averages
- **Profile** — fitness focus, daily targets, appearance and account settings

## Tech stack

- React 19 + TypeScript + Vite
- Express 5 + SQLite (`node:sqlite`)
- JWT auth with bcrypt password hashing
- Fraunces + DM Sans, a warm paper-and-ink design system with clay accents (light and dark themes)

## Getting started

```bash
npm install
npm run seed   # creates the database and demo account
npm run dev    # API on :4000, web on :5173
```

Open http://localhost:5173 and sign in with the demo account:

- **Email:** `demo@pepefit.app`
- **Password:** `demo1234`

## Scripts

| Script | Description |
| --- | --- |
| `npm run dev` | Run API and web together |
| `npm run dev:api` | Run the API only |
| `npm run dev:web` | Run the Vite dev server only |
| `npm run build` | Production build |
| `npm start` | Serve the built app from the API server |
| `npm run seed` | Seed static data and the demo account |

## Notes

- The SQLite database, uploads and JWT secret live in `data/` and are excluded from git.
- Set `JWT_SECRET` to override the generated secret.
- Set `OPENAI_API_KEY` to enable real image analysis in AI Kitchen; otherwise it runs in demo vision mode.
