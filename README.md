# SQL Practice — a local LeetCode for SQL

A local, offline app for practicing SQL. Queries run against a real SQLite engine
compiled to WebAssembly **in your browser** — no database to install, nothing sent
anywhere. Every problem is graded against **10 test cases**, not one sample.

## Running it

```bash
npm run dev
```

Then open http://localhost:5173. That starts the Vite dev server on **5173** (the UI)
and a small Express API on **3001** (problems + your progress).

Restart it after adding a new **family** or **spec** file — the API reads problems
on every request, but only picks up new files on boot.

## The app

- **Sidebar** — search, filter by difficulty / solved state / topic, sort, and a
  per-difficulty progress breakdown.
- **Problem pane** — Description / Hint / Solution tabs, the example input tables,
  the expected output, and prev / next / random navigation.
- **Editor** — CodeMirror with SQL highlighting. `Ctrl+Enter` runs.
- **Run** shows your query's output. **Submit** grades it against all 10 test cases,
  shows a pass pill per case, and on failure shows that case's input, the expected
  rows and yours side by side.

## How grading works

Each Run/Submit builds a fresh in-memory database, so a stray `UPDATE` can never
leak into the next attempt. Your query and the problem's reference solution run
against identically seeded data and the result sets are compared:

- column names must match, case-insensitively
- row order is ignored unless the problem sets `"orderMatters": true`
- numeric strings compare equal to numbers
- grading stops at the first failing case, the way LeetCode reports one

Test cases deliberately include empty tables, ties, duplicates, orphan rows and
NULLs — the cases that separate a query that works from a query that is correct.
A `NOT IN` solution that passes the example will still fail the NULL case.

## Adding problems

**Most problems are specs on a shared family.** A family in `problems/families/`
defines one schema plus 10 datasets; every problem using it inherits all 10 as
test cases. Current families: `employees`, `sales`, `activity`.

A spec in `problems/specs/*.json` (an array) is then tiny:

```json
{
  "id": "unique-slug",
  "number": 91,
  "title": "Problem Title",
  "difficulty": "Easy | Medium | Hard",
  "tags": ["Window Function"],
  "family": "employees",
  "description": "Markdown-ish. `code` and **bold** work.",
  "solutionSql": "SELECT ...;",
  "orderMatters": false,
  "hint": "A nudge, shown behind a tab."
}
```

Add `"extraTests": [{ "name": "...", "seedSql": "..." }]` for cases specific to
one problem. For a problem needing its own schema entirely, drop a self-contained
file in `problems/` instead (see `001-combine-two-tables.json`) — it carries its
own `schemaSql` and `tests`.

There is no stored expected output anywhere: `solutionSql` defines it, so the
shown answer and the graded answer can never drift apart.

Always check new problems:

```bash
node scripts/validate-problems.mjs
```

It runs every solution against every case and fails on: SQL errors, duplicate ids
or numbers, and any problem whose cases all return zero rows (a suite that proves
nothing).

## Notes

- The dialect is **SQLite**, not MySQL. Window functions, CTEs, `WITH RECURSIVE`,
  `strftime`, `JULIANDAY` and `DATE(x, '+1 day')` all work; MySQL-only syntax does not.
- Progress lives in `progress.json`/`submissions.json`, keyed by name (see below).
  Delete either file to reset everyone.

## Multiple people, one deployment

There's no real login — click the name button top-right (shows **Set name**
until you do) and type any name. That name is sent with every request and
keys your own slice of `progress.json`/`submissions.json`. Anyone who knows a
name can see or edit that name's progress; there's no password. Good enough
for a small group who trust each other, not for a public tool.

## Deploying (Fly.io)

The app ships as one Docker image: Express serves both the built frontend
(`web/dist`) and the `/api/*` routes, so there's a single process and a single
URL — no separate frontend/backend hosts, no CORS to configure.

```bash
fly launch --no-deploy   # picks up fly.toml; rename the app if the name is taken
fly volumes create sql_practice_data --size 1 --region iad
fly deploy
```

The volume is mounted at `/data` and `DATA_DIR=/data` (set in `fly.toml`) points
`progress.json`/`submissions.json` there, so they survive restarts and redeploys.
Locally, `DATA_DIR` is unset and defaults to the project root — nothing changes
about `npm run dev`.

The free tier scales to zero when idle, so the first request after a quiet
period takes a few seconds to wake up — normal, not a bug.

To run the production build locally without Fly:

```bash
npm run build
npm start
```

## Layout

```
problems/
  *.json              self-contained problems (own schema + tests)
  families/*.json     shared schema + 10 datasets
  specs/*.json        problems that use a family
server/
  index.js            API: problems, per-user progress/submissions, static serving
  load-problems.js    expands specs against families
web/src/
  lib/db.js           sql.js setup, execution, grading
  components/         sidebar, problem pane, editor, results
scripts/              problem validator
Dockerfile            production image (build stage + slim runtime stage)
fly.toml              Fly.io app + persistent volume config
```
