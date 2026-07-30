# QueryNinja

A SQL practice app with interactive challenges, real SQLite execution in the browser, and per-user progress tracking.

**Try it:** [queryninja.vercel.app](https://queryninja.vercel.app/)

## Running locally

```bash
npm run dev        # Vite dev server (port 5173) + Express API (port 3001)
npm run build      # production build
npm start          # serve production build locally
```

## Features

- **Split-pane IDE** — problem description + example tables on the left, CodeMirror editor + output/results on the right
- **Run & Submit** — queries run against a real SQLite engine compiled to WebAssembly (sql.js) in the browser
- **10 test cases per problem** — graded against expected output with pass/fail pills per case
- **Per-user progress** — names are self-assigned, progress synced to Redis (Upstash)
- **Email/OTP login** — link an email to your name to recover progress across devices
- **~220 problems** — Easy/Medium/Hard, tagged by topic, filterable and searchable
- **Streak tracking** — consecutive days of solving

## Stack

- **Frontend:** React + Vite + CodeMirror 6
- **Backend:** Express (Node.js)
- **Database:** SQLite via sql.js (in-browser), Redis via Upstash (progress)
- **Hosting:** Vercel

## Layout

```
problems/
  *.json              self-contained problems (own schema + tests)
  families/*.json     shared schema + 10 datasets
  specs/*.json        problems that use a family
server/
  index.js            API + static file serving
  load-problems.js    expands specs against families
web/src/
  lib/db.js           sql.js setup, execution, grading
  components/         React components
scripts/              problem validator, seed script for Redis
Dockerfile            production Docker image (no longer used — Vercel)
```

## Adding problems

A spec in `problems/specs/*.json` references a family and only needs an id, title, difficulty, description, and solution. Each inherits 10 test cases from the family. Add `extraTests` for problem-specific cases. Validate with:

```bash
node scripts/validate-problems.mjs
```

The SQL dialect is **SQLite** (window functions, CTEs, `WITH RECURSIVE`, `strftime` all work).
