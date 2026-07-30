# QueryNinja

A SQL practice app — interactive challenges, real SQLite execution in the browser, per-user progress.

**Try it:** [queryninja.vercel.app](https://queryninja.vercel.app/)

## Quick start

```bash
npm install
npm run dev        # Vite (port 5173) + Express API (port 3001)
npm run build      # production build
npm start          # serve production build locally
```

## How it works

- **Editor** — CodeMirror with SQL highlighting. `Ctrl+Enter` runs. Format button (`sql-formatter`) auto-formats your query.
- **Run** — executes your SQL against an in-memory SQLite database (sql.js WASM) and shows the result table.
- **Submit** — grades against 6–10 test cases (shared family datasets + optional per-problem extras). Pass/fail pill per case, and on failure the expected vs actual rows side by side.
- **Grading** — column names (case-insensitive), row order ignored unless `orderMatters`, numeric strings == numbers. Grading stops at the first failing case.

## Problems

~140 problems across Easy / Medium / Hard, tagged by topic:

| Source | Count | Numbers |
|--------|-------|---------|
| Standalone (LeetCode classics) | 8 | 1–7, 134 |
| `employees` family (easy / medium / hard) | 38 | 8–45 |
| `sales` family (easy / medium) | 28 | 46–73 |
| `activity` family | 17 | 74–90 |
| `set-operations` / `reconciliation` family | 10 | 91–100 |
| `correlated-subqueries` | 10 | 101–110 |
| `string-date-edge-cases` | 10 | 111–120 |
| `window-frame-edge-cases` | 10 | 121–130 |
| `debug-this-query` | 9 | 131–140 (with gap at 134) |

All solution queries are in the problem specs — the answer shown and the graded answer are the same source of truth.

## API

| Route | Purpose |
|-------|---------|
| `GET /api/problems` | All problems (specs merged with families) |
| `GET /api/progress?user=` | User's solved/attempted map |
| `POST /api/progress` | Save progress `{ user, id, status, code }` |
| `DELETE /api/progress/:id` | Reset a single problem |
| `GET /api/submissions?user=` | User's submission history |
| `POST /api/submissions` | Log a submission `{ user, problemId, code, status }` |
| `GET /api/auth/email?user=` | Get email linked to a username |
| `POST /api/auth/link-email` | Link email to username `{ user, email }` |
| `POST /api/auth/request-otp` | Send OTP code `{ email }` |
| `POST /api/auth/verify-otp` | Verify OTP, returns username `{ email, code }` |
| `GET /api/username-available` | Check name availability `?name=&current=` |
| `DELETE /api/user` | Wipe all progress `?user=` |

## Data store

Two backends, auto-selected by environment variables:

- **Local / Fly.io** — JSON files in `DATA_DIR` (defaults to project root). `progress.json`, `submissions.json`, `users-by-email.json`, `users-by-name.json`, `otps.json`.
- **Vercel / serverless** — Upstash Redis (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` or `KV_REST_API_URL` + `KV_REST_API_TOKEN`).

Users are identified by a self-chosen name (no real auth). Emails can be linked for OTP-based login across devices (Gmail SMTP via nodemailer).

## Adding a problem

Specs in `problems/specs/*.json` reference a shared `family` (schema + seed variants). Add `extraTests` for problem-specific test cases.

```json
{
  "id": "unique-slug",
  "number": 141,
  "title": "My Problem",
  "difficulty": "Easy",
  "tags": ["Join"],
  "family": "employees",
  "description": "Markdown-ish. `code` and **bold** work.",
  "solutionSql": "SELECT ...;",
  "orderMatters": false,
  "hint": "Optional nudge."
}
```

Validate with:

```bash
node scripts/validate-problems.mjs
```

The SQL dialect is **SQLite** — window functions, CTEs, `WITH RECURSIVE`, `strftime`, `JULIANDAY` all work.

## Tech

- **Frontend:** React 19, Vite 8, CodeMirror 6, sql-formatter
- **Backend:** Express 5 (Node 22, ESM)
- **Database:** SQLite via sql.js (in-browser WASM), Upstash Redis (progress)
- **Deployment:** Vercel (serverless via `api/index.js`)
