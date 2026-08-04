/**
 * Generates problems 141–160 (complex real-world DA scenarios).
 * Runs each test case through sql.js to auto-compute expectedOutput,
 * then writes the final JSON files into problems/.
 *
 *   node scripts/gen-complex-problems.mjs
 */
import initSqlJs from 'sql.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '..', 'problems');

const SQL = await initSqlJs();

function runQuery(schemaSql, seedSql, querySql) {
  const db = new SQL.Database();
  db.run(schemaSql);
  if (seedSql) db.run(seedSql);
  const result = db.exec(querySql);
  db.close();
  if (!result.length) return [];
  const { columns, values } = result[result.length - 1];
  return values.map((row) =>
    Object.fromEntries(columns.map((c, i) => [c, row[i]]))
  );
}

/** Build a problem JSON, computing all expectedOutputs via sql.js */
function build(skeleton) {
  const tests = skeleton.tests.map((t) => {
    const seedSql = t.seedSql ?? '';
    const rows = runQuery(skeleton.schemaSql, seedSql, skeleton.solutionSql);
    return { name: t.name, seedSql, expectedOutput: rows };
  });
  const { tests: _t, ...rest } = skeleton;
  return { ...rest, tests };
}

// ─── SCHEMAS ────────────────────────────────────────────────────────────────

const SAAS_SCHEMA = `
CREATE TABLE plans (
  id INTEGER PRIMARY KEY,
  name TEXT,
  monthly_price REAL
);
CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  name TEXT,
  signup_date TEXT
);
CREATE TABLE subscriptions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  plan_id INTEGER,
  started_at TEXT,
  ended_at TEXT
);`.trim();

const MARKET_SCHEMA = `
CREATE TABLE sellers (
  id INTEGER PRIMARY KEY,
  name TEXT,
  category TEXT,
  joined_date TEXT
);
CREATE TABLE buyers (
  id INTEGER PRIMARY KEY,
  name TEXT,
  joined_date TEXT
);
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  seller_id INTEGER,
  buyer_id INTEGER,
  amount REAL,
  transacted_at TEXT,
  status TEXT
);
CREATE TABLE reviews (
  id INTEGER PRIMARY KEY,
  transaction_id INTEGER,
  seller_id INTEGER,
  buyer_id INTEGER,
  rating INTEGER,
  reviewed_at TEXT
);`.trim();

const RIDES_SCHEMA = `
CREATE TABLE drivers (
  id INTEGER PRIMARY KEY,
  name TEXT,
  city TEXT
);
CREATE TABLE riders (
  id INTEGER PRIMARY KEY,
  name TEXT
);
CREATE TABLE trips (
  id INTEGER PRIMARY KEY,
  driver_id INTEGER,
  rider_id INTEGER,
  requested_at TEXT,
  started_at TEXT,
  ended_at TEXT,
  status TEXT,
  fare REAL
);`.trim();

const ADS_SCHEMA = `
CREATE TABLE campaigns (
  id INTEGER PRIMARY KEY,
  name TEXT,
  channel TEXT,
  daily_budget REAL
);
CREATE TABLE events (
  id INTEGER PRIMARY KEY,
  campaign_id INTEGER,
  user_id INTEGER,
  event_type TEXT,
  occurred_at TEXT
);`.trim();

const BANK_SCHEMA = `
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  user_id INTEGER,
  account_type TEXT,
  opened_date TEXT
);
CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  account_id INTEGER,
  txn_type TEXT,
  amount REAL,
  txn_date TEXT
);`.trim();

const FOOD_SCHEMA = `
CREATE TABLE restaurants (
  id INTEGER PRIMARY KEY,
  name TEXT,
  cuisine TEXT,
  city TEXT
);
CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  restaurant_id INTEGER,
  customer_id INTEGER,
  placed_at TEXT,
  delivered_at TEXT,
  estimated_minutes INTEGER,
  total_amount REAL,
  status TEXT
);
CREATE TABLE order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER,
  item_name TEXT,
  quantity INTEGER,
  unit_price REAL
);
CREATE TABLE reviews (
  id INTEGER PRIMARY KEY,
  order_id INTEGER,
  customer_id INTEGER,
  restaurant_id INTEGER,
  rating INTEGER
);`.trim();

// ─── PROBLEMS ───────────────────────────────────────────────────────────────

const problems = [

// ── 141 ─────────────────────────────────────────────────────────────────────
{
  id: 'saas-monthly-churn-rate',
  number: 141,
  title: 'Monthly Churn Rate',
  difficulty: 'Hard',
  tags: ['CTE', 'Date', 'SaaS', 'Aggregation'],
  orderMatters: false,
  schemaSql: SAAS_SCHEMA,
  description: `You are given subscription data for a SaaS product.

For each calendar month in which at least one subscription was cancelled, compute:
- **churned** — number of subscriptions that ended in that month
- **active_at_start** — number of subscriptions active at the *start* of that month (started before the 1st, and either still active or ended on/after the 1st)
- **churn_rate** — churned / active_at_start, rounded to 4 decimal places

Name the columns \`month\`, \`churned\`, \`active_at_start\`, \`churn_rate\`.
Return one row per month, ordered by \`month\` ascending.`,
  hint: 'Use a CTE to find distinct cancellation months, then JOIN subscriptions twice — once to count churns, once to count who was active at the start of that month.',
  solutionSql: `
WITH cancel_months AS (
  SELECT DISTINCT
    strftime('%Y-%m', ended_at) AS month,
    strftime('%Y-%m', ended_at) || '-01' AS month_start
  FROM subscriptions
  WHERE ended_at IS NOT NULL
),
churned AS (
  SELECT strftime('%Y-%m', ended_at) AS month,
         COUNT(*) AS churned
  FROM subscriptions
  WHERE ended_at IS NOT NULL
  GROUP BY 1
),
active_start AS (
  SELECT m.month,
         COUNT(*) AS active_at_start
  FROM cancel_months m
  JOIN subscriptions s
    ON s.started_at < m.month_start
   AND (s.ended_at IS NULL OR s.ended_at >= m.month_start)
  GROUP BY m.month
)
SELECT a.month,
       c.churned,
       a.active_at_start,
       ROUND(CAST(c.churned AS REAL) / a.active_at_start, 4) AS churn_rate
FROM active_start a
JOIN churned c USING (month)
ORDER BY a.month;`.trim(),
  outputExplanation: 'In 2022-03 two subscriptions ended (Alice and Eve) out of 4 that were active at the start of March, giving a 50% churn rate. In 2022-04 only Carol churned, but by then only 3 subscriptions were still active at the start of April, giving a ~33% churn rate.',
  tests: [
    {
      name: 'Example',
      seedSql: `
INSERT INTO plans VALUES (1,'starter',29),(2,'pro',99),(3,'enterprise',299);
INSERT INTO users VALUES (1,'Alice','2022-01-01'),(2,'Bob','2022-01-01'),(3,'Carol','2022-02-01'),(4,'Dave','2022-03-01'),(5,'Eve','2022-01-01');
INSERT INTO subscriptions VALUES
  (1,1,1,'2022-01-05','2022-03-15'),
  (2,2,2,'2022-01-10',NULL),
  (3,3,1,'2022-02-01','2022-04-10'),
  (4,4,2,'2022-03-01',NULL),
  (5,5,1,'2022-01-05','2022-03-20');`.trim(),
    },
    {
      name: 'No cancellations — empty result',
      seedSql: `
INSERT INTO plans VALUES (1,'starter',29);
INSERT INTO users VALUES (1,'Alice','2022-01-01'),(2,'Bob','2022-02-01');
INSERT INTO subscriptions VALUES (1,1,1,'2022-01-01',NULL),(2,2,1,'2022-02-01',NULL);`.trim(),
    },
    {
      name: 'Everyone churns in the same month',
      seedSql: `
INSERT INTO plans VALUES (1,'starter',29);
INSERT INTO users VALUES (1,'A','2022-01-01'),(2,'B','2022-01-01'),(3,'C','2022-01-01');
INSERT INTO subscriptions VALUES
  (1,1,1,'2022-01-01','2022-02-28'),
  (2,2,1,'2022-01-01','2022-02-15'),
  (3,3,1,'2022-01-01','2022-02-20');`.trim(),
    },
    {
      name: 'Churn spread across three months',
      seedSql: `
INSERT INTO plans VALUES (1,'pro',99);
INSERT INTO users VALUES (1,'A','2022-01-01'),(2,'B','2022-01-01'),(3,'C','2022-01-01'),(4,'D','2022-01-01'),(5,'E','2022-01-01');
INSERT INTO subscriptions VALUES
  (1,1,1,'2022-01-01','2022-02-10'),
  (2,2,1,'2022-01-01','2022-03-05'),
  (3,3,1,'2022-01-01','2022-04-22'),
  (4,4,1,'2022-01-01',NULL),
  (5,5,1,'2022-01-01',NULL);`.trim(),
    },
    {
      name: 'Subscription started and ended in same month',
      seedSql: `
INSERT INTO plans VALUES (1,'starter',29);
INSERT INTO users VALUES (1,'Flash','2022-06-01'),(2,'Steady','2022-06-01');
INSERT INTO subscriptions VALUES
  (1,1,1,'2022-06-01','2022-06-10'),
  (2,2,1,'2022-06-15',NULL);`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
    {
      name: 'Single churn event',
      seedSql: `
INSERT INTO plans VALUES (1,'starter',29);
INSERT INTO users VALUES (1,'Only','2022-01-01');
INSERT INTO subscriptions VALUES (1,1,1,'2022-01-01','2022-03-31');`.trim(),
    },
    {
      name: 'Large set — multiple plans',
      seedSql: `
INSERT INTO plans VALUES (1,'starter',29),(2,'pro',99),(3,'enterprise',299);
INSERT INTO users VALUES (1,'A','2022-01-01'),(2,'B','2022-01-01'),(3,'C','2022-02-01'),(4,'D','2022-02-01'),(5,'E','2022-02-01'),(6,'F','2022-03-01'),(7,'G','2022-03-01'),(8,'H','2022-01-01');
INSERT INTO subscriptions VALUES
  (1,1,1,'2022-01-05','2022-04-10'),
  (2,2,2,'2022-01-10','2022-03-20'),
  (3,3,1,'2022-02-01','2022-04-30'),
  (4,4,2,'2022-02-01',NULL),
  (5,5,3,'2022-02-15','2022-05-01'),
  (6,6,1,'2022-03-01',NULL),
  (7,7,2,'2022-03-01','2022-05-15'),
  (8,8,3,'2022-01-15',NULL);`.trim(),
    },
  ],
},

// ── 142 ─────────────────────────────────────────────────────────────────────
{
  id: 'saas-active-subscribers-by-month',
  number: 142,
  title: 'Active Subscribers by Month',
  difficulty: 'Hard',
  tags: ['CTE', 'Date', 'SaaS', 'Window Functions'],
  orderMatters: false,
  schemaSql: SAAS_SCHEMA,
  description: `For each calendar month that overlaps with any subscription in the data, count the number of subscriptions that were **active at any point during that month**.

A subscription is active during month M if:
- \`started_at\` < the **first day of the month after M**
- AND \`ended_at\` IS NULL **or** \`ended_at\` ≥ the **first day of M**

Return columns \`month\` (YYYY-MM) and \`active_subscribers\`. Include only months where at least one subscription was active. Order by \`month\` ascending.`,
  hint: 'Generate the universe of relevant months from the min started_at to the max ended_at (or today), then for each month count subscriptions that overlap it.',
  solutionSql: `
WITH RECURSIVE months(m, m_start, m_end_excl) AS (
  SELECT
    strftime('%Y-%m', MIN(started_at)),
    date(MIN(started_at), 'start of month'),
    date(MIN(started_at), 'start of month', '+1 month')
  FROM subscriptions
  UNION ALL
  SELECT
    strftime('%Y-%m', m_end_excl),
    m_end_excl,
    date(m_end_excl, '+1 month')
  FROM months
  WHERE m_start <= (
    SELECT date(COALESCE(MAX(ended_at), '2025-12-31'), 'start of month')
    FROM subscriptions
  )
)
SELECT m.m AS month,
       COUNT(s.id) AS active_subscribers
FROM months m
JOIN subscriptions s
  ON s.started_at < m.m_end_excl
 AND (s.ended_at IS NULL OR s.ended_at >= m.m_start)
GROUP BY m.m
ORDER BY m.m;`.trim(),
  outputExplanation: 'The recursive CTE generates every month from the earliest subscription start to the latest end. For each month the JOIN picks subscriptions whose date range overlaps with that month window.',
  tests: [
    {
      name: 'Example — 3 users, overlapping months',
      seedSql: `
INSERT INTO plans VALUES (1,'starter',29),(2,'pro',99);
INSERT INTO users VALUES (1,'Alice','2022-01-01'),(2,'Bob','2022-02-01'),(3,'Carol','2022-01-01');
INSERT INTO subscriptions VALUES
  (1,1,1,'2022-01-01','2022-03-31'),
  (2,2,2,'2022-02-15',NULL),
  (3,3,1,'2022-01-15','2022-02-28');`.trim(),
    },
    {
      name: 'Single subscription entire year',
      seedSql: `
INSERT INTO plans VALUES (1,'starter',29);
INSERT INTO users VALUES (1,'Solo','2022-01-01');
INSERT INTO subscriptions VALUES (1,1,1,'2022-01-01','2022-06-30');`.trim(),
    },
    {
      name: 'No subscriptions — empty',
      seedSql: '',
    },
    {
      name: 'Two non-overlapping subscriptions',
      seedSql: `
INSERT INTO plans VALUES (1,'pro',99);
INSERT INTO users VALUES (1,'A','2022-01-01'),(2,'B','2022-06-01');
INSERT INTO subscriptions VALUES
  (1,1,1,'2022-01-01','2022-03-31'),
  (2,2,1,'2022-06-01','2022-08-31');`.trim(),
    },
    {
      name: 'All still active',
      seedSql: `
INSERT INTO plans VALUES (1,'starter',29),(2,'pro',99);
INSERT INTO users VALUES (1,'A','2023-01-01'),(2,'B','2023-02-01'),(3,'C','2023-03-01');
INSERT INTO subscriptions VALUES
  (1,1,1,'2023-01-01',NULL),
  (2,2,2,'2023-02-01',NULL),
  (3,3,1,'2023-03-01',NULL);`.trim(),
    },
  ],
},

// ── 143 ─────────────────────────────────────────────────────────────────────
{
  id: 'saas-mrr-by-plan',
  number: 143,
  title: 'MRR by Plan per Month',
  difficulty: 'Hard',
  tags: ['CTE', 'Join', 'Date', 'SaaS', 'Aggregation'],
  orderMatters: false,
  schemaSql: SAAS_SCHEMA,
  description: `Monthly Recurring Revenue (MRR) is the sum of \`monthly_price\` for every active subscription in a given month.

For each calendar month that overlaps with at least one subscription, and for each plan, report the total MRR contributed by that plan. Return columns \`month\` (YYYY-MM), \`plan\`, and \`mrr\` (rounded to 2 decimal places). Only include (month, plan) pairs with mrr > 0. Order by \`month\`, then \`plan\`.`,
  hint: 'Join the months spine (recursive CTE or derived) with subscriptions and plans, filtering to active subscriptions in each month.',
  solutionSql: `
WITH RECURSIVE months(m, m_start, m_next) AS (
  SELECT
    strftime('%Y-%m', MIN(started_at)),
    date(MIN(started_at), 'start of month'),
    date(MIN(started_at), 'start of month', '+1 month')
  FROM subscriptions
  UNION ALL
  SELECT
    strftime('%Y-%m', m_next),
    m_next,
    date(m_next, '+1 month')
  FROM months
  WHERE m_start <= (
    SELECT date(COALESCE(MAX(ended_at), '2025-12-31'), 'start of month')
    FROM subscriptions
  )
)
SELECT m.m AS month,
       p.name AS plan,
       ROUND(SUM(p.monthly_price), 2) AS mrr
FROM months m
JOIN subscriptions s
  ON s.started_at < m.m_next
 AND (s.ended_at IS NULL OR s.ended_at >= m.m_start)
JOIN plans p ON p.id = s.plan_id
GROUP BY m.m, p.name
HAVING mrr > 0
ORDER BY m.m, p.name;`.trim(),
  outputExplanation: 'Each active subscription contributes its plan price to MRR for every month it overlaps. The recursive spine ensures every month between earliest start and latest end is represented.',
  tests: [
    {
      name: 'Example — two plans, mixed churn',
      seedSql: `
INSERT INTO plans VALUES (1,'starter',29),(2,'pro',99),(3,'enterprise',299);
INSERT INTO users VALUES (1,'Alice','2022-01-01'),(2,'Bob','2022-01-01'),(3,'Carol','2022-02-01'),(4,'Dave','2022-03-01');
INSERT INTO subscriptions VALUES
  (1,1,1,'2022-01-01','2022-03-31'),
  (2,2,2,'2022-01-01',NULL),
  (3,3,1,'2022-02-01','2022-03-31'),
  (4,4,3,'2022-03-01',NULL);`.trim(),
    },
    {
      name: 'Single plan, single user',
      seedSql: `
INSERT INTO plans VALUES (1,'starter',29);
INSERT INTO users VALUES (1,'Solo','2022-01-01');
INSERT INTO subscriptions VALUES (1,1,1,'2022-01-01','2022-03-31');`.trim(),
    },
    {
      name: 'All churn same month',
      seedSql: `
INSERT INTO plans VALUES (1,'pro',99);
INSERT INTO users VALUES (1,'A','2022-06-01'),(2,'B','2022-06-01');
INSERT INTO subscriptions VALUES
  (1,1,1,'2022-06-01','2022-07-31'),
  (2,2,1,'2022-06-01','2022-07-31');`.trim(),
    },
    {
      name: 'No subscriptions',
      seedSql: '',
    },
    {
      name: 'Plan upgrade — two subs for one user',
      seedSql: `
INSERT INTO plans VALUES (1,'starter',29),(2,'pro',99);
INSERT INTO users VALUES (1,'Upgrader','2022-01-01');
INSERT INTO subscriptions VALUES
  (1,1,1,'2022-01-01','2022-02-28'),
  (2,1,2,'2022-03-01',NULL);`.trim(),
    },
  ],
},

// ── 144 ─────────────────────────────────────────────────────────────────────
{
  id: 'saas-avg-days-to-churn',
  number: 144,
  title: 'Average Days to Churn by Plan',
  difficulty: 'Medium',
  tags: ['Join', 'Date', 'Aggregation', 'SaaS'],
  orderMatters: false,
  schemaSql: SAAS_SCHEMA,
  description: `For each plan, compute the **average number of days** that churned subscriptions lasted before being cancelled. Only include subscriptions that have ended (\`ended_at\` IS NOT NULL).

Return columns \`plan\` and \`avg_days_to_churn\` (rounded to 1 decimal place). Only include plans that had at least one cancellation. Order by \`avg_days_to_churn\` descending.`,
  hint: 'Use julianday(ended_at) - julianday(started_at) to compute duration in days per subscription, then average by plan.',
  solutionSql: `
SELECT p.name AS plan,
       ROUND(AVG(julianday(s.ended_at) - julianday(s.started_at)), 1) AS avg_days_to_churn
FROM subscriptions s
JOIN plans p ON p.id = s.plan_id
WHERE s.ended_at IS NOT NULL
GROUP BY p.name
ORDER BY avg_days_to_churn DESC;`.trim(),
  outputExplanation: 'julianday differences give exact day counts between start and end of each cancelled subscription. Averaging by plan shows which tier retains users longest before they churn.',
  tests: [
    {
      name: 'Example — three plans, mixed durations',
      seedSql: `
INSERT INTO plans VALUES (1,'starter',29),(2,'pro',99),(3,'enterprise',299);
INSERT INTO users VALUES (1,'A','2022-01-01'),(2,'B','2022-01-01'),(3,'C','2022-01-01'),(4,'D','2022-01-01'),(5,'E','2022-01-01');
INSERT INTO subscriptions VALUES
  (1,1,1,'2022-01-01','2022-02-01'),
  (2,2,1,'2022-01-01','2022-04-01'),
  (3,3,2,'2022-01-01','2022-06-01'),
  (4,4,3,'2022-01-01','2023-01-01'),
  (5,5,2,'2022-01-01','2022-03-01');`.trim(),
    },
    {
      name: 'All still active — empty result',
      seedSql: `
INSERT INTO plans VALUES (1,'pro',99);
INSERT INTO users VALUES (1,'A','2022-01-01'),(2,'B','2022-01-01');
INSERT INTO subscriptions VALUES (1,1,1,'2022-01-01',NULL),(2,2,1,'2022-02-01',NULL);`.trim(),
    },
    {
      name: 'Single day subscription',
      seedSql: `
INSERT INTO plans VALUES (1,'starter',29);
INSERT INTO users VALUES (1,'Flash','2022-01-01');
INSERT INTO subscriptions VALUES (1,1,1,'2022-01-01','2022-01-01');`.trim(),
    },
    {
      name: 'Multiple churns per plan',
      seedSql: `
INSERT INTO plans VALUES (1,'starter',29),(2,'pro',99);
INSERT INTO users VALUES (1,'A','2022-01-01'),(2,'B','2022-01-01'),(3,'C','2022-01-01'),(4,'D','2022-01-01');
INSERT INTO subscriptions VALUES
  (1,1,1,'2022-01-01','2022-04-01'),
  (2,2,1,'2022-01-01','2022-07-01'),
  (3,3,2,'2022-01-01','2022-02-01'),
  (4,4,2,'2022-01-01','2022-12-01');`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
  ],
},

// ── 145 ─────────────────────────────────────────────────────────────────────
{
  id: 'market-sellers-with-repeat-buyers',
  number: 145,
  title: 'Sellers with Repeat Buyers',
  difficulty: 'Hard',
  tags: ['CTE', 'Join', 'Aggregation', 'Marketplace'],
  orderMatters: false,
  schemaSql: MARKET_SCHEMA,
  description: `A **repeat buyer** for a seller is a buyer who has completed **at least 2 transactions** with that seller.

For each seller who has at least one repeat buyer, return:
- \`seller_id\`
- \`seller_name\`
- \`repeat_buyer_count\` — number of distinct buyers who bought from this seller 2 or more times

Order by \`repeat_buyer_count\` descending, then \`seller_id\` ascending.`,
  hint: 'Count transactions per (seller, buyer) pair first, then filter to pairs with count >= 2, then count distinct buyers per seller.',
  solutionSql: `
WITH buyer_txn_counts AS (
  SELECT seller_id, buyer_id, COUNT(*) AS txn_count
  FROM transactions
  WHERE status = 'completed'
  GROUP BY seller_id, buyer_id
),
repeat_buyers AS (
  SELECT seller_id, COUNT(*) AS repeat_buyer_count
  FROM buyer_txn_counts
  WHERE txn_count >= 2
  GROUP BY seller_id
)
SELECT r.seller_id,
       s.name AS seller_name,
       r.repeat_buyer_count
FROM repeat_buyers r
JOIN sellers s ON s.id = r.seller_id
ORDER BY r.repeat_buyer_count DESC, r.seller_id ASC;`.trim(),
  outputExplanation: 'First aggregate to count completed transactions per (seller, buyer) pair. Then keep only pairs with 2+ purchases. Finally count those repeat buyer pairs per seller.',
  tests: [
    {
      name: 'Example — mixed repeat and one-time buyers',
      seedSql: `
INSERT INTO sellers VALUES (1,'ShopA','Electronics','2020-01-01'),(2,'ShopB','Clothing','2020-06-01'),(3,'ShopC','Books','2021-01-01');
INSERT INTO buyers VALUES (1,'Alice','2021-01-01'),(2,'Bob','2021-02-01'),(3,'Carol','2021-03-01'),(4,'Dave','2021-04-01');
INSERT INTO transactions VALUES
  (1,1,1,50.0,'2022-01-10','completed'),
  (2,1,1,80.0,'2022-03-15','completed'),
  (3,1,2,30.0,'2022-02-01','completed'),
  (4,1,2,30.0,'2022-04-01','completed'),
  (5,2,3,100.0,'2022-01-20','completed'),
  (6,2,4,45.0,'2022-02-10','completed'),
  (7,3,1,15.0,'2022-05-01','completed'),
  (8,1,3,20.0,'2022-06-01','completed');`.trim(),
    },
    {
      name: 'No repeat buyers — empty result',
      seedSql: `
INSERT INTO sellers VALUES (1,'ShopA','Electronics','2020-01-01');
INSERT INTO buyers VALUES (1,'Alice','2021-01-01'),(2,'Bob','2021-02-01');
INSERT INTO transactions VALUES
  (1,1,1,50.0,'2022-01-01','completed'),
  (2,1,2,80.0,'2022-02-01','completed');`.trim(),
    },
    {
      name: 'Cancelled transactions should not count',
      seedSql: `
INSERT INTO sellers VALUES (1,'ShopA','Electronics','2020-01-01');
INSERT INTO buyers VALUES (1,'Alice','2021-01-01');
INSERT INTO transactions VALUES
  (1,1,1,50.0,'2022-01-01','completed'),
  (2,1,1,80.0,'2022-02-01','cancelled'),
  (3,1,1,30.0,'2022-03-01','cancelled');`.trim(),
    },
    {
      name: 'Single seller, many repeat buyers',
      seedSql: `
INSERT INTO sellers VALUES (1,'Mega','Electronics','2019-01-01');
INSERT INTO buyers VALUES (1,'A','2021-01-01'),(2,'B','2021-01-01'),(3,'C','2021-01-01'),(4,'D','2021-01-01');
INSERT INTO transactions VALUES
  (1,1,1,10.0,'2022-01-01','completed'),(2,1,1,10.0,'2022-02-01','completed'),
  (3,1,2,10.0,'2022-01-01','completed'),(4,1,2,10.0,'2022-03-01','completed'),
  (5,1,3,10.0,'2022-01-01','completed'),(6,1,3,10.0,'2022-04-01','completed'),
  (7,1,4,10.0,'2022-05-01','completed');`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
  ],
},

// ── 146 ─────────────────────────────────────────────────────────────────────
{
  id: 'market-best-month-per-seller',
  number: 146,
  title: "Seller's Best Month",
  difficulty: 'Hard',
  tags: ['CTE', 'Window Functions', 'Date', 'Marketplace'],
  orderMatters: false,
  schemaSql: MARKET_SCHEMA,
  description: `For each seller who completed at least one transaction, find the calendar month in which they earned the highest total revenue from completed transactions.

Return columns \`seller_id\`, \`seller_name\`, \`best_month\` (YYYY-MM), and \`revenue\` (rounded to 2 decimal places).

If two months tie for a seller, return the **earlier** one. Order by \`seller_id\` ascending.`,
  hint: 'Aggregate revenue by (seller, month), then use ROW_NUMBER() OVER (PARTITION BY seller ORDER BY revenue DESC, month ASC) to pick rank 1.',
  solutionSql: `
WITH monthly AS (
  SELECT seller_id,
         strftime('%Y-%m', transacted_at) AS month,
         ROUND(SUM(amount), 2) AS revenue
  FROM transactions
  WHERE status = 'completed'
  GROUP BY seller_id, month
),
ranked AS (
  SELECT *,
         ROW_NUMBER() OVER (PARTITION BY seller_id ORDER BY revenue DESC, month ASC) AS rn
  FROM monthly
)
SELECT r.seller_id,
       s.name AS seller_name,
       r.month AS best_month,
       r.revenue
FROM ranked r
JOIN sellers s ON s.id = r.seller_id
WHERE r.rn = 1
ORDER BY r.seller_id;`.trim(),
  outputExplanation: 'Monthly revenue is summed per seller, then ROW_NUMBER() picks the highest-revenue month. In a tie, the earlier month wins because of the secondary ORDER BY month ASC.',
  tests: [
    {
      name: 'Example',
      seedSql: `
INSERT INTO sellers VALUES (1,'ShopA','Electronics','2020-01-01'),(2,'ShopB','Clothing','2020-06-01');
INSERT INTO buyers VALUES (1,'Alice','2021-01-01'),(2,'Bob','2021-02-01');
INSERT INTO transactions VALUES
  (1,1,1,200.0,'2022-01-15','completed'),
  (2,1,2,150.0,'2022-01-20','completed'),
  (3,1,1,500.0,'2022-03-10','completed'),
  (4,2,1,100.0,'2022-01-05','completed'),
  (5,2,2,100.0,'2022-02-14','completed'),
  (6,2,1,50.0,'2022-02-28','completed');`.trim(),
    },
    {
      name: 'Tie — earlier month wins',
      seedSql: `
INSERT INTO sellers VALUES (1,'TieShop','Books','2020-01-01');
INSERT INTO buyers VALUES (1,'A','2021-01-01');
INSERT INTO transactions VALUES
  (1,1,1,100.0,'2022-01-15','completed'),
  (2,1,1,100.0,'2022-02-15','completed');`.trim(),
    },
    {
      name: 'Cancelled transactions excluded',
      seedSql: `
INSERT INTO sellers VALUES (1,'ShopA','Electronics','2020-01-01');
INSERT INTO buyers VALUES (1,'A','2021-01-01');
INSERT INTO transactions VALUES
  (1,1,1,500.0,'2022-01-15','cancelled'),
  (2,1,1,50.0,'2022-03-15','completed');`.trim(),
    },
    {
      name: 'No transactions — empty result',
      seedSql: `
INSERT INTO sellers VALUES (1,'Ghost','Electronics','2020-01-01');`.trim(),
    },
    {
      name: 'Multiple sellers, single transaction each',
      seedSql: `
INSERT INTO sellers VALUES (1,'A','Electronics','2020-01-01'),(2,'B','Books','2020-01-01'),(3,'C','Clothing','2020-01-01');
INSERT INTO buyers VALUES (1,'X','2021-01-01');
INSERT INTO transactions VALUES
  (1,1,1,300.0,'2022-06-01','completed'),
  (2,2,1,150.0,'2022-03-01','completed'),
  (3,3,1,450.0,'2022-09-01','completed');`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
  ],
},

// ── 147 ─────────────────────────────────────────────────────────────────────
{
  id: 'market-buyer-reorder-rate',
  number: 147,
  title: 'Buyer Reorder Rate',
  difficulty: 'Hard',
  tags: ['CTE', 'Window Functions', 'Date', 'Marketplace'],
  orderMatters: false,
  schemaSql: MARKET_SCHEMA,
  description: `The **reorder rate** is the percentage of buyers who made a **second completed purchase within 30 days** of their first completed purchase.

Compute: \`reorder_rate\` = number of buyers with a 2nd purchase within 30 days / total buyers with at least one completed purchase, rounded to 4 decimal places.

Return a single row with columns \`total_buyers\`, \`reordered_within_30d\`, and \`reorder_rate\`.`,
  hint: 'Find each buyer\'s first purchase date with MIN(), then check if they have any other completed transaction within 30 days using julianday differences.',
  solutionSql: `
WITH first_purchase AS (
  SELECT buyer_id, MIN(transacted_at) AS first_at
  FROM transactions
  WHERE status = 'completed'
  GROUP BY buyer_id
),
reordered AS (
  SELECT fp.buyer_id
  FROM first_purchase fp
  JOIN transactions t
    ON t.buyer_id = fp.buyer_id
   AND t.status = 'completed'
   AND t.transacted_at > fp.first_at
   AND julianday(t.transacted_at) - julianday(fp.first_at) <= 30
)
SELECT
  COUNT(DISTINCT fp.buyer_id) AS total_buyers,
  COUNT(DISTINCT r.buyer_id) AS reordered_within_30d,
  ROUND(
    CAST(COUNT(DISTINCT r.buyer_id) AS REAL) / NULLIF(COUNT(DISTINCT fp.buyer_id), 0),
    4
  ) AS reorder_rate
FROM first_purchase fp
LEFT JOIN reordered r ON r.buyer_id = fp.buyer_id;`.trim(),
  outputExplanation: 'First purchase dates are found per buyer. Then we check if any later completed transaction falls within 30 julianday units of that first purchase. The ratio of quick-reorderers to total buyers gives the reorder rate.',
  tests: [
    {
      name: 'Example — mixed reorders',
      seedSql: `
INSERT INTO sellers VALUES (1,'ShopA','Electronics','2020-01-01');
INSERT INTO buyers VALUES (1,'Alice','2021-01-01'),(2,'Bob','2021-02-01'),(3,'Carol','2021-03-01'),(4,'Dave','2021-04-01');
INSERT INTO transactions VALUES
  (1,1,1,50.0,'2022-01-01','completed'),
  (2,1,1,60.0,'2022-01-20','completed'),
  (3,1,2,70.0,'2022-02-01','completed'),
  (4,1,2,80.0,'2022-04-01','completed'),
  (5,1,3,90.0,'2022-03-01','completed'),
  (6,1,3,100.0,'2022-03-25','completed'),
  (7,1,4,110.0,'2022-05-01','completed');`.trim(),
    },
    {
      name: 'No buyer reorders — rate is 0',
      seedSql: `
INSERT INTO sellers VALUES (1,'S','Electronics','2020-01-01');
INSERT INTO buyers VALUES (1,'A','2021-01-01'),(2,'B','2021-01-01');
INSERT INTO transactions VALUES
  (1,1,1,50.0,'2022-01-01','completed'),
  (2,1,2,60.0,'2022-01-01','completed');`.trim(),
    },
    {
      name: 'All buyers reorder within 30 days — rate is 1',
      seedSql: `
INSERT INTO sellers VALUES (1,'S','Electronics','2020-01-01');
INSERT INTO buyers VALUES (1,'A','2021-01-01'),(2,'B','2021-01-01');
INSERT INTO transactions VALUES
  (1,1,1,10.0,'2022-01-01','completed'),
  (2,1,1,10.0,'2022-01-15','completed'),
  (3,1,2,10.0,'2022-02-01','completed'),
  (4,1,2,10.0,'2022-02-10','completed');`.trim(),
    },
    {
      name: 'Cancelled transactions do not count',
      seedSql: `
INSERT INTO sellers VALUES (1,'S','Electronics','2020-01-01');
INSERT INTO buyers VALUES (1,'A','2021-01-01');
INSERT INTO transactions VALUES
  (1,1,1,50.0,'2022-01-01','completed'),
  (2,1,1,60.0,'2022-01-10','cancelled'),
  (3,1,1,70.0,'2022-01-20','cancelled');`.trim(),
    },
    {
      name: 'Reorder exactly on day 30',
      seedSql: `
INSERT INTO sellers VALUES (1,'S','Electronics','2020-01-01');
INSERT INTO buyers VALUES (1,'A','2021-01-01');
INSERT INTO transactions VALUES
  (1,1,1,50.0,'2022-01-01','completed'),
  (2,1,1,60.0,'2022-01-31','completed');`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
  ],
},

// ── 148 ─────────────────────────────────────────────────────────────────────
{
  id: 'market-seller-rating-decline',
  number: 148,
  title: 'Seller Rating Decline',
  difficulty: 'Hard',
  tags: ['CTE', 'Window Functions', 'Join', 'Marketplace'],
  orderMatters: false,
  schemaSql: MARKET_SCHEMA,
  description: `Identify sellers whose **average rating in their 3 most recent reviews** is strictly lower than their **average rating in the 3 reviews before that** (reviews 4–6 most recent).

A seller must have **at least 6 reviews** to be included.

Return columns \`seller_id\`, \`seller_name\`, \`recent_avg\` (avg of last 3, rounded to 2), and \`prior_avg\` (avg of reviews 4–6 most recent, rounded to 2). Order by \`(recent_avg - prior_avg)\` ascending (worst decline first), then \`seller_id\` ascending.`,
  hint: 'Number each seller\'s reviews by recency using ROW_NUMBER(), then filter to rows 1–3 vs 4–6 and average each group.',
  solutionSql: `
WITH numbered AS (
  SELECT *,
         ROW_NUMBER() OVER (PARTITION BY seller_id ORDER BY reviewed_at DESC, id DESC) AS rn
  FROM reviews
),
groups AS (
  SELECT seller_id,
         AVG(CASE WHEN rn <= 3 THEN rating END) AS recent_avg,
         AVG(CASE WHEN rn BETWEEN 4 AND 6 THEN rating END) AS prior_avg,
         COUNT(*) AS total
  FROM numbered
  WHERE rn <= 6
  GROUP BY seller_id
  HAVING total = 6
)
SELECT g.seller_id,
       s.name AS seller_name,
       ROUND(g.recent_avg, 2) AS recent_avg,
       ROUND(g.prior_avg, 2) AS prior_avg
FROM groups g
JOIN sellers s ON s.id = g.seller_id
WHERE g.recent_avg < g.prior_avg
ORDER BY (g.recent_avg - g.prior_avg) ASC, g.seller_id ASC;`.trim(),
  outputExplanation: 'ROW_NUMBER() ranks reviews newest-first per seller. Averaging ratings for rows 1–3 vs 4–6 compares recent vs prior performance. Only sellers with exactly 6+ reviews in scope (rn ≤ 6) who show a drop are returned.',
  tests: [
    {
      name: 'Example — one declining seller',
      seedSql: `
INSERT INTO sellers VALUES (1,'ShopA','Electronics','2020-01-01'),(2,'ShopB','Clothing','2020-06-01');
INSERT INTO buyers VALUES (1,'A','2021-01-01'),(2,'B','2021-01-01'),(3,'C','2021-01-01');
INSERT INTO transactions VALUES (1,1,1,10.0,'2022-01-01','completed'),(2,1,2,10.0,'2022-01-02','completed'),(3,1,3,10.0,'2022-01-03','completed'),(4,2,1,10.0,'2022-01-04','completed'),(5,2,2,10.0,'2022-01-05','completed'),(6,2,3,10.0,'2022-01-06','completed'),(7,1,1,10.0,'2022-01-07','completed'),(8,1,2,10.0,'2022-01-08','completed'),(9,1,3,10.0,'2022-01-09','completed'),(10,2,1,10.0,'2022-01-10','completed'),(11,2,2,10.0,'2022-01-11','completed'),(12,2,3,10.0,'2022-01-12','completed');
INSERT INTO reviews VALUES
  (1,1,1,1,5,'2022-01-15'),(2,2,2,1,5,'2022-02-01'),(3,3,3,1,5,'2022-03-01'),
  (4,4,1,1,2,'2022-04-01'),(5,5,2,1,2,'2022-05-01'),(6,6,3,1,2,'2022-06-01'),
  (7,7,1,2,4,'2022-01-20'),(8,8,2,2,4,'2022-02-05'),(9,9,3,2,4,'2022-03-05'),
  (10,10,1,2,4,'2022-04-05'),(11,11,2,2,4,'2022-05-05'),(12,12,3,2,4,'2022-06-05');`.trim(),
    },
    {
      name: 'Not enough reviews — empty',
      seedSql: `
INSERT INTO sellers VALUES (1,'ShopA','Electronics','2020-01-01');
INSERT INTO buyers VALUES (1,'A','2021-01-01');
INSERT INTO transactions VALUES (1,1,1,10.0,'2022-01-01','completed'),(2,1,1,10.0,'2022-02-01','completed'),(3,1,1,10.0,'2022-03-01','completed');
INSERT INTO reviews VALUES (1,1,1,1,3,'2022-01-15'),(2,2,1,1,4,'2022-02-15'),(3,3,1,1,5,'2022-03-15');`.trim(),
    },
    {
      name: 'Rating improving — empty result',
      seedSql: `
INSERT INTO sellers VALUES (1,'Good','Electronics','2020-01-01');
INSERT INTO buyers VALUES (1,'A','2021-01-01');
INSERT INTO transactions VALUES (1,1,1,10.0,'2022-01-01','completed'),(2,1,1,10.0,'2022-02-01','completed'),(3,1,1,10.0,'2022-03-01','completed'),(4,1,1,10.0,'2022-04-01','completed'),(5,1,1,10.0,'2022-05-01','completed'),(6,1,1,10.0,'2022-06-01','completed');
INSERT INTO reviews VALUES
  (1,1,1,1,2,'2022-01-15'),(2,2,1,1,2,'2022-02-15'),(3,3,1,1,2,'2022-03-15'),
  (4,4,1,1,5,'2022-04-15'),(5,5,1,1,5,'2022-05-15'),(6,6,1,1,5,'2022-06-15');`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
  ],
},

// ── 149 ─────────────────────────────────────────────────────────────────────
{
  id: 'rides-driver-acceptance-rate',
  number: 149,
  title: 'Driver Acceptance Rate',
  difficulty: 'Medium',
  tags: ['Aggregation', 'Filtering', 'Rides'],
  orderMatters: false,
  schemaSql: RIDES_SCHEMA,
  description: `For each driver who received **at least 5 trip requests**, compute their **acceptance rate**: the proportion of requests where \`status = 'completed'\` divided by total requests for that driver. Round to 4 decimal places.

Return columns \`driver_id\`, \`driver_name\`, \`total_requests\`, \`completed\`, and \`acceptance_rate\`. Order by \`acceptance_rate\` descending, then \`driver_id\` ascending.`,
  hint: 'Use COUNT(*) for total requests and COUNT(CASE WHEN status = \'completed\' THEN 1 END) for completed, then divide.',
  solutionSql: `
SELECT t.driver_id,
       d.name AS driver_name,
       COUNT(*) AS total_requests,
       COUNT(CASE WHEN t.status = 'completed' THEN 1 END) AS completed,
       ROUND(
         CAST(COUNT(CASE WHEN t.status = 'completed' THEN 1 END) AS REAL) / COUNT(*),
         4
       ) AS acceptance_rate
FROM trips t
JOIN drivers d ON d.id = t.driver_id
GROUP BY t.driver_id, d.name
HAVING COUNT(*) >= 5
ORDER BY acceptance_rate DESC, t.driver_id ASC;`.trim(),
  outputExplanation: 'Only drivers with 5+ trip requests are included. Completed trips divided by total requests gives the acceptance rate. Higher rates indicate drivers who cancel less.',
  tests: [
    {
      name: 'Example — two qualifying drivers',
      seedSql: `
INSERT INTO drivers VALUES (1,'Ace','NYC'),(2,'Ben','NYC'),(3,'Cal','NYC');
INSERT INTO riders VALUES (1,'X'),(2,'Y'),(3,'Z');
INSERT INTO trips VALUES
  (1,1,1,'2022-01-01','2022-01-01','2022-01-01','completed',15.0),
  (2,1,2,'2022-01-02','2022-01-02','2022-01-02','completed',20.0),
  (3,1,3,'2022-01-03',NULL,NULL,'cancelled',0.0),
  (4,1,1,'2022-01-04','2022-01-04','2022-01-04','completed',18.0),
  (5,1,2,'2022-01-05',NULL,NULL,'cancelled',0.0),
  (6,2,1,'2022-01-01','2022-01-01','2022-01-01','completed',10.0),
  (7,2,2,'2022-01-02','2022-01-02','2022-01-02','completed',12.0),
  (8,2,3,'2022-01-03','2022-01-03','2022-01-03','completed',8.0),
  (9,2,1,'2022-01-04','2022-01-04','2022-01-04','completed',9.0),
  (10,2,2,'2022-01-05','2022-01-05','2022-01-05','completed',11.0),
  (11,3,1,'2022-01-01','2022-01-01','2022-01-01','completed',5.0),
  (12,3,2,'2022-01-02',NULL,NULL,'cancelled',0.0);`.trim(),
    },
    {
      name: 'No driver meets 5-request threshold — empty',
      seedSql: `
INSERT INTO drivers VALUES (1,'New','NYC');
INSERT INTO riders VALUES (1,'X');
INSERT INTO trips VALUES
  (1,1,1,'2022-01-01','2022-01-01','2022-01-01','completed',10.0),
  (2,1,1,'2022-01-02','2022-01-02','2022-01-02','completed',10.0);`.trim(),
    },
    {
      name: 'All trips cancelled — acceptance 0',
      seedSql: `
INSERT INTO drivers VALUES (1,'Ghost','NYC');
INSERT INTO riders VALUES (1,'X'),(2,'Y'),(3,'Z');
INSERT INTO trips VALUES
  (1,1,1,'2022-01-01',NULL,NULL,'cancelled',0),
  (2,1,2,'2022-01-02',NULL,NULL,'cancelled',0),
  (3,1,3,'2022-01-03',NULL,NULL,'cancelled',0),
  (4,1,1,'2022-01-04',NULL,NULL,'cancelled',0),
  (5,1,2,'2022-01-05',NULL,NULL,'cancelled',0);`.trim(),
    },
    {
      name: 'Perfect acceptance rate',
      seedSql: `
INSERT INTO drivers VALUES (1,'Perfect','NYC');
INSERT INTO riders VALUES (1,'A'),(2,'B'),(3,'C');
INSERT INTO trips VALUES
  (1,1,1,'2022-01-01','2022-01-01','2022-01-01','completed',10),
  (2,1,2,'2022-01-02','2022-01-02','2022-01-02','completed',12),
  (3,1,3,'2022-01-03','2022-01-03','2022-01-03','completed',14),
  (4,1,1,'2022-01-04','2022-01-04','2022-01-04','completed',16),
  (5,1,2,'2022-01-05','2022-01-05','2022-01-05','completed',18);`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
  ],
},

// ── 150 ─────────────────────────────────────────────────────────────────────
{
  id: 'rides-rider-monthly-churn',
  number: 150,
  title: 'Churned Riders by Month',
  difficulty: 'Hard',
  tags: ['CTE', 'Window Functions', 'Date', 'Rides'],
  orderMatters: false,
  schemaSql: RIDES_SCHEMA,
  description: `A rider is considered **churned** in month M if they completed at least one trip in month M-1 but **zero** trips in month M.

For each month M where at least one rider churned, return \`month\` (YYYY-MM) and \`churned_riders\`. Order by \`month\` ascending.`,
  hint: 'Find the set of (rider, month) pairs with completed trips. Then for each rider-month find the next month and check if the rider is absent there.',
  solutionSql: `
WITH active AS (
  SELECT DISTINCT rider_id,
         strftime('%Y-%m', started_at) AS month
  FROM trips
  WHERE status = 'completed'
    AND started_at IS NOT NULL
),
lagged AS (
  SELECT rider_id,
         month,
         LAG(month) OVER (PARTITION BY rider_id ORDER BY month) AS prev_month
  FROM active
),
churned_months AS (
  SELECT a.month AS churn_month, a.rider_id
  FROM active a
  WHERE NOT EXISTS (
    SELECT 1 FROM active b
    WHERE b.rider_id = a.rider_id
      AND b.month = strftime('%Y-%m', date(a.month || '-01', '+1 month'))
  )
    AND a.month != (SELECT MAX(month) FROM active WHERE rider_id = a.rider_id
                    UNION ALL SELECT MAX(month) FROM active LIMIT 1 OFFSET 0)
),
all_max AS (SELECT MAX(month) AS global_max FROM active)
SELECT strftime('%Y-%m', date(c.churn_month || '-01', '+1 month')) AS month,
       COUNT(*) AS churned_riders
FROM churned_months c, all_max
WHERE c.churn_month < all_max.global_max
GROUP BY 1
ORDER BY 1;`.trim(),
  outputExplanation: 'For each rider, we check each active month: if the following month has no completed trip for that rider, and it\'s not the last month in the dataset, the rider churned at the start of the next month.',
  tests: [
    {
      name: 'Example — some riders drop off',
      seedSql: `
INSERT INTO drivers VALUES (1,'Ace','NYC');
INSERT INTO riders VALUES (1,'Alice'),(2,'Bob'),(3,'Carol');
INSERT INTO trips VALUES
  (1,1,1,'2022-01-10','2022-01-10','2022-01-10','completed',10),
  (2,1,2,'2022-01-15','2022-01-15','2022-01-15','completed',12),
  (3,1,3,'2022-01-20','2022-01-20','2022-01-20','completed',8),
  (4,1,1,'2022-02-10','2022-02-10','2022-02-10','completed',10),
  (5,1,3,'2022-02-15','2022-02-15','2022-02-15','completed',9),
  (6,1,1,'2022-03-10','2022-03-10','2022-03-10','completed',11);`.trim(),
    },
    {
      name: 'All riders active every month — no churn',
      seedSql: `
INSERT INTO drivers VALUES (1,'D','NYC');
INSERT INTO riders VALUES (1,'A'),(2,'B');
INSERT INTO trips VALUES
  (1,1,1,'2022-01-05','2022-01-05','2022-01-05','completed',5),
  (2,1,2,'2022-01-10','2022-01-10','2022-01-10','completed',5),
  (3,1,1,'2022-02-05','2022-02-05','2022-02-05','completed',5),
  (4,1,2,'2022-02-10','2022-02-10','2022-02-10','completed',5);`.trim(),
    },
    {
      name: 'Single rider, single month — no churn',
      seedSql: `
INSERT INTO drivers VALUES (1,'D','NYC');
INSERT INTO riders VALUES (1,'Only');
INSERT INTO trips VALUES (1,1,1,'2022-06-15','2022-06-15','2022-06-15','completed',10);`.trim(),
    },
    {
      name: 'Cancelled trips do not count as active',
      seedSql: `
INSERT INTO drivers VALUES (1,'D','NYC');
INSERT INTO riders VALUES (1,'A'),(2,'B');
INSERT INTO trips VALUES
  (1,1,1,'2022-01-05','2022-01-05','2022-01-05','completed',10),
  (2,1,2,'2022-01-10',NULL,NULL,'cancelled',0),
  (3,1,1,'2022-02-05','2022-02-05','2022-02-05','completed',10),
  (4,1,2,'2022-02-10','2022-02-10','2022-02-10','completed',10);`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
  ],
},

// ── 151 ─────────────────────────────────────────────────────────────────────
{
  id: 'rides-revenue-per-trip-hour',
  number: 151,
  title: 'Revenue per Trip-Hour by Driver',
  difficulty: 'Medium',
  tags: ['Aggregation', 'Date', 'Rides'],
  orderMatters: false,
  schemaSql: RIDES_SCHEMA,
  description: `For each driver who completed at least one trip, compute their **revenue per trip-hour**: total fare from completed trips divided by total trip duration in hours across all their completed trips.

Trip duration in hours = (julianday(ended_at) - julianday(started_at)) * 24.

Return columns \`driver_id\`, \`driver_name\`, \`total_fare\` (rounded to 2), \`total_hours\` (rounded to 2), and \`fare_per_hour\` (rounded to 2). Order by \`fare_per_hour\` descending, then \`driver_id\` ascending.`,
  hint: 'Sum fare and sum (julianday(ended_at) - julianday(started_at)) * 24 per driver, then divide.',
  solutionSql: `
SELECT t.driver_id,
       d.name AS driver_name,
       ROUND(SUM(t.fare), 2) AS total_fare,
       ROUND(SUM((julianday(t.ended_at) - julianday(t.started_at)) * 24), 2) AS total_hours,
       ROUND(
         SUM(t.fare) / SUM((julianday(t.ended_at) - julianday(t.started_at)) * 24),
         2
       ) AS fare_per_hour
FROM trips t
JOIN drivers d ON d.id = t.driver_id
WHERE t.status = 'completed'
  AND t.started_at IS NOT NULL
  AND t.ended_at IS NOT NULL
GROUP BY t.driver_id, d.name
ORDER BY fare_per_hour DESC, t.driver_id ASC;`.trim(),
  outputExplanation: 'Summing fares and trip hours separately then dividing gives average earnings per hour of driving. Drivers with short, high-fare trips rank highest.',
  tests: [
    {
      name: 'Example — two drivers, different efficiencies',
      seedSql: `
INSERT INTO drivers VALUES (1,'FastAce','NYC'),(2,'SlowBen','NYC');
INSERT INTO riders VALUES (1,'X'),(2,'Y');
INSERT INTO trips VALUES
  (1,1,1,'2022-01-01 09:00','2022-01-01 09:00','2022-01-01 09:30','completed',20.0),
  (2,1,2,'2022-01-02 10:00','2022-01-02 10:00','2022-01-02 10:20','completed',15.0),
  (3,2,1,'2022-01-01 14:00','2022-01-01 14:00','2022-01-01 15:00','completed',18.0),
  (4,2,2,'2022-01-02 16:00','2022-01-02 16:00','2022-01-02 17:30','completed',12.0);`.trim(),
    },
    {
      name: 'Cancelled trips excluded',
      seedSql: `
INSERT INTO drivers VALUES (1,'D','NYC');
INSERT INTO riders VALUES (1,'X');
INSERT INTO trips VALUES
  (1,1,1,'2022-01-01 09:00','2022-01-01 09:00','2022-01-01 10:00','completed',30.0),
  (2,1,1,'2022-01-02 09:00',NULL,NULL,'cancelled',0.0);`.trim(),
    },
    {
      name: 'No completed trips — empty',
      seedSql: `
INSERT INTO drivers VALUES (1,'D','NYC');
INSERT INTO riders VALUES (1,'X');
INSERT INTO trips VALUES (1,1,1,'2022-01-01',NULL,NULL,'cancelled',0.0);`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
  ],
},

// ── 152 ─────────────────────────────────────────────────────────────────────
{
  id: 'ads-campaign-funnel-rates',
  number: 152,
  title: 'Campaign Funnel Rates',
  difficulty: 'Hard',
  tags: ['CTE', 'Aggregation', 'Ads', 'Funnel'],
  orderMatters: false,
  schemaSql: ADS_SCHEMA,
  description: `For each campaign, compute:
- \`impressions\` — count of impression events
- \`clicks\` — count of click events
- \`conversions\` — count of conversion events
- \`ctr\` — clicks / impressions, rounded to 4 decimal places (NULL if no impressions)
- \`cvr\` — conversions / clicks, rounded to 4 decimal places (NULL if no clicks)

Only include campaigns that have at least one impression. Order by \`cvr\` descending (NULLs last), then \`campaign_id\` ascending.`,
  hint: 'Use conditional COUNT(CASE WHEN event_type = ... THEN 1 END) to count each funnel stage, then divide.',
  solutionSql: `
SELECT e.campaign_id,
       c.name AS campaign_name,
       COUNT(CASE WHEN e.event_type = 'impression' THEN 1 END) AS impressions,
       COUNT(CASE WHEN e.event_type = 'click' THEN 1 END) AS clicks,
       COUNT(CASE WHEN e.event_type = 'conversion' THEN 1 END) AS conversions,
       ROUND(
         CAST(COUNT(CASE WHEN e.event_type = 'click' THEN 1 END) AS REAL)
         / NULLIF(COUNT(CASE WHEN e.event_type = 'impression' THEN 1 END), 0),
         4
       ) AS ctr,
       ROUND(
         CAST(COUNT(CASE WHEN e.event_type = 'conversion' THEN 1 END) AS REAL)
         / NULLIF(COUNT(CASE WHEN e.event_type = 'click' THEN 1 END), 0),
         4
       ) AS cvr
FROM events e
JOIN campaigns c ON c.id = e.campaign_id
GROUP BY e.campaign_id, c.name
HAVING COUNT(CASE WHEN e.event_type = 'impression' THEN 1 END) > 0
ORDER BY cvr DESC NULLS LAST, e.campaign_id ASC;`.trim(),
  outputExplanation: 'Conditional COUNTs pivot the event_type column into separate columns. NULLIF prevents division by zero. CVR is NULL when there are impressions but no clicks (no denominator for conversion rate).',
  tests: [
    {
      name: 'Example — two campaigns, different funnel shapes',
      seedSql: `
INSERT INTO campaigns VALUES (1,'Summer Sale','email',500),(2,'Brand Awareness','display',1000);
INSERT INTO events VALUES
  (1,1,101,'impression','2022-06-01'),
  (2,1,102,'impression','2022-06-01'),
  (3,1,103,'impression','2022-06-01'),
  (4,1,104,'impression','2022-06-01'),
  (5,1,101,'click','2022-06-02'),
  (6,1,102,'click','2022-06-02'),
  (7,1,101,'conversion','2022-06-03'),
  (8,2,201,'impression','2022-06-01'),
  (9,2,202,'impression','2022-06-01'),
  (10,2,203,'impression','2022-06-01'),
  (11,2,204,'impression','2022-06-01'),
  (12,2,205,'impression','2022-06-01'),
  (13,2,201,'click','2022-06-02');`.trim(),
    },
    {
      name: 'Campaign with impressions only — CVR is NULL',
      seedSql: `
INSERT INTO campaigns VALUES (1,'Awareness','display',200);
INSERT INTO events VALUES
  (1,1,1,'impression','2022-01-01'),
  (2,1,2,'impression','2022-01-01'),
  (3,1,3,'impression','2022-01-01');`.trim(),
    },
    {
      name: 'No impressions — empty result',
      seedSql: `
INSERT INTO campaigns VALUES (1,'Ghost','email',100);`.trim(),
    },
    {
      name: 'Perfect CVR — every click converts',
      seedSql: `
INSERT INTO campaigns VALUES (1,'Elite','email',100);
INSERT INTO events VALUES
  (1,1,1,'impression','2022-01-01'),
  (2,1,1,'click','2022-01-02'),
  (3,1,1,'conversion','2022-01-03'),
  (4,1,2,'impression','2022-01-01'),
  (5,1,2,'click','2022-01-02'),
  (6,1,2,'conversion','2022-01-03');`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
  ],
},

// ── 153 ─────────────────────────────────────────────────────────────────────
{
  id: 'ads-best-channel-by-cvr',
  number: 153,
  title: 'Best Performing Channel',
  difficulty: 'Medium',
  tags: ['CTE', 'Aggregation', 'Ads'],
  orderMatters: false,
  schemaSql: ADS_SCHEMA,
  description: `For each ad channel (e.g. 'email', 'display', 'search'), compute the overall **click-through rate** (CTR = clicks / impressions) and **conversion rate** (CVR = conversions / clicks) across all campaigns in that channel.

Return columns \`channel\`, \`impressions\`, \`clicks\`, \`conversions\`, \`ctr\` (rounded to 4), and \`cvr\` (rounded to 4). Exclude channels with zero clicks (CVR would be meaningless). Order by \`cvr\` descending.`,
  hint: 'Aggregate event counts per channel by joining events to campaigns. Use NULLIF to avoid division by zero.',
  solutionSql: `
SELECT c.channel,
       COUNT(CASE WHEN e.event_type = 'impression' THEN 1 END) AS impressions,
       COUNT(CASE WHEN e.event_type = 'click' THEN 1 END) AS clicks,
       COUNT(CASE WHEN e.event_type = 'conversion' THEN 1 END) AS conversions,
       ROUND(
         CAST(COUNT(CASE WHEN e.event_type = 'click' THEN 1 END) AS REAL)
         / NULLIF(COUNT(CASE WHEN e.event_type = 'impression' THEN 1 END), 0),
         4
       ) AS ctr,
       ROUND(
         CAST(COUNT(CASE WHEN e.event_type = 'conversion' THEN 1 END) AS REAL)
         / NULLIF(COUNT(CASE WHEN e.event_type = 'click' THEN 1 END), 0),
         4
       ) AS cvr
FROM events e
JOIN campaigns c ON c.id = e.campaign_id
GROUP BY c.channel
HAVING COUNT(CASE WHEN e.event_type = 'click' THEN 1 END) > 0
ORDER BY cvr DESC;`.trim(),
  outputExplanation: 'Events are grouped by the campaign\'s channel. Channels with no clicks are excluded since CVR requires clicks as the denominator. The channel with the highest CVR converts the most efficiently.',
  tests: [
    {
      name: 'Example — three channels',
      seedSql: `
INSERT INTO campaigns VALUES (1,'Email-1','email',500),(2,'Email-2','email',400),(3,'Display-1','display',800),(4,'Search-1','search',300);
INSERT INTO events VALUES
  (1,1,1,'impression','2022-01-01'),(2,1,1,'click','2022-01-02'),(3,1,1,'conversion','2022-01-03'),
  (4,1,2,'impression','2022-01-01'),(5,1,2,'click','2022-01-02'),
  (6,2,3,'impression','2022-01-01'),(7,2,3,'click','2022-01-02'),(8,2,3,'conversion','2022-01-03'),
  (9,3,4,'impression','2022-01-01'),(10,3,4,'impression','2022-01-01'),(11,3,4,'impression','2022-01-01'),(12,3,5,'click','2022-01-02'),
  (13,4,6,'impression','2022-01-01'),(14,4,6,'click','2022-01-02'),(15,4,6,'conversion','2022-01-03'),
  (16,4,7,'impression','2022-01-01'),(17,4,7,'click','2022-01-02'),(18,4,7,'conversion','2022-01-03');`.trim(),
    },
    {
      name: 'Channel with only impressions excluded',
      seedSql: `
INSERT INTO campaigns VALUES (1,'Email','email',100),(2,'Display','display',200);
INSERT INTO events VALUES
  (1,1,1,'impression','2022-01-01'),(2,1,1,'click','2022-01-02'),(3,1,1,'conversion','2022-01-03'),
  (4,2,2,'impression','2022-01-01'),(5,2,3,'impression','2022-01-01');`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
  ],
},

// ── 154 ─────────────────────────────────────────────────────────────────────
{
  id: 'ads-first-touch-attribution',
  number: 154,
  title: 'First-Touch Attribution',
  difficulty: 'Hard',
  tags: ['CTE', 'Window Functions', 'Ads', 'Attribution'],
  orderMatters: false,
  schemaSql: ADS_SCHEMA,
  description: `In **first-touch attribution**, a conversion is credited to the campaign that received the user's **very first click** (across all campaigns) before the conversion.

For each user who converted, find the campaign they first clicked on (the click must occur **before** the conversion event). Credit that campaign for the conversion.

Return columns \`campaign_id\`, \`campaign_name\`, and \`attributed_conversions\`. Only include campaigns with at least one attributed conversion. Order by \`attributed_conversions\` descending, then \`campaign_id\` ascending.`,
  hint: 'Find each converting user\'s first-ever click timestamp using MIN() or ROW_NUMBER(). Then join that click\'s campaign_id to the campaigns table and aggregate.',
  solutionSql: `
WITH user_conversions AS (
  SELECT DISTINCT user_id
  FROM events
  WHERE event_type = 'conversion'
),
first_clicks AS (
  SELECT e.user_id,
         e.campaign_id,
         ROW_NUMBER() OVER (PARTITION BY e.user_id ORDER BY e.occurred_at ASC, e.id ASC) AS rn
  FROM events e
  JOIN user_conversions uc ON uc.user_id = e.user_id
  WHERE e.event_type = 'click'
    AND EXISTS (
      SELECT 1 FROM events c
      WHERE c.user_id = e.user_id
        AND c.event_type = 'conversion'
        AND c.occurred_at > e.occurred_at
    )
),
attributed AS (
  SELECT campaign_id, COUNT(*) AS attributed_conversions
  FROM first_clicks
  WHERE rn = 1
  GROUP BY campaign_id
)
SELECT a.campaign_id,
       c.name AS campaign_name,
       a.attributed_conversions
FROM attributed a
JOIN campaigns c ON c.id = a.campaign_id
ORDER BY a.attributed_conversions DESC, a.campaign_id ASC;`.trim(),
  outputExplanation: 'For each user who converted, we find the click that happened before the conversion. ROW_NUMBER() picks the chronologically first click. The campaign behind that first click gets credit for the conversion.',
  tests: [
    {
      name: 'Example — two campaigns competing for credit',
      seedSql: `
INSERT INTO campaigns VALUES (1,'Campaign A','email',500),(2,'Campaign B','search',400);
INSERT INTO events VALUES
  (1,1,101,'impression','2022-01-01 08:00'),
  (2,1,101,'click','2022-01-01 09:00'),
  (3,2,101,'impression','2022-01-02 08:00'),
  (4,2,101,'click','2022-01-02 09:00'),
  (5,2,101,'conversion','2022-01-03 10:00'),
  (6,2,102,'impression','2022-01-01 08:00'),
  (7,2,102,'click','2022-01-01 09:00'),
  (8,1,102,'click','2022-01-02 09:00'),
  (9,1,102,'conversion','2022-01-03 10:00'),
  (10,1,103,'click','2022-01-05 10:00'),
  (11,1,103,'conversion','2022-01-06 10:00');`.trim(),
    },
    {
      name: 'No conversions — empty result',
      seedSql: `
INSERT INTO campaigns VALUES (1,'Cam','email',100);
INSERT INTO events VALUES
  (1,1,1,'impression','2022-01-01'),
  (2,1,1,'click','2022-01-02');`.trim(),
    },
    {
      name: 'Click after conversion does not count',
      seedSql: `
INSERT INTO campaigns VALUES (1,'A','email',100),(2,'B','search',100);
INSERT INTO events VALUES
  (1,1,1,'click','2022-01-01'),
  (2,1,1,'conversion','2022-01-02'),
  (3,2,1,'click','2022-01-03');`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
  ],
},

// ── 155 ─────────────────────────────────────────────────────────────────────
{
  id: 'bank-running-balance',
  number: 155,
  title: 'Running Account Balance',
  difficulty: 'Hard',
  tags: ['Window Functions', 'CTE', 'Banking'],
  orderMatters: true,
  schemaSql: BANK_SCHEMA,
  description: `For each account, show every transaction in chronological order with the account's **running balance** after that transaction.

- \`txn_type = 'credit'\` adds to the balance
- \`txn_type = 'debit'\` subtracts from the balance

Assume the opening balance is 0. Return columns \`account_id\`, \`txn_id\`, \`txn_date\`, \`txn_type\`, \`amount\`, and \`running_balance\` (rounded to 2 decimal places). Order by \`account_id\` ascending, then \`txn_date\` ascending, then \`txn_id\` ascending.`,
  hint: 'Use SUM(CASE WHEN type=credit THEN amount ELSE -amount END) OVER (PARTITION BY account_id ORDER BY txn_date, txn_id) for a running total.',
  solutionSql: `
SELECT account_id,
       id AS txn_id,
       txn_date,
       txn_type,
       amount,
       ROUND(
         SUM(CASE WHEN txn_type = 'credit' THEN amount ELSE -amount END)
         OVER (PARTITION BY account_id ORDER BY txn_date, id
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),
         2
       ) AS running_balance
FROM transactions
ORDER BY account_id, txn_date, id;`.trim(),
  outputExplanation: 'The window SUM accumulates signed amounts (positive for credits, negative for debits) in date order within each account, giving a running balance after every transaction.',
  tests: [
    {
      name: 'Example — two accounts',
      seedSql: `
INSERT INTO accounts VALUES (1,1,'checking','2022-01-01'),(2,2,'savings','2022-01-01');
INSERT INTO transactions VALUES
  (1,1,'credit',1000.0,'2022-01-05'),
  (2,1,'debit',200.0,'2022-01-10'),
  (3,1,'credit',500.0,'2022-01-15'),
  (4,1,'debit',150.0,'2022-01-20'),
  (5,2,'credit',2000.0,'2022-01-03'),
  (6,2,'debit',500.0,'2022-01-07');`.trim(),
    },
    {
      name: 'Balance goes negative',
      seedSql: `
INSERT INTO accounts VALUES (1,1,'checking','2022-01-01');
INSERT INTO transactions VALUES
  (1,1,'credit',100.0,'2022-01-01'),
  (2,1,'debit',300.0,'2022-01-02'),
  (3,1,'credit',50.0,'2022-01-03');`.trim(),
    },
    {
      name: 'Single transaction',
      seedSql: `
INSERT INTO accounts VALUES (1,1,'checking','2022-01-01');
INSERT INTO transactions VALUES (1,1,'credit',500.0,'2022-01-01');`.trim(),
    },
    {
      name: 'No transactions — empty result',
      seedSql: `
INSERT INTO accounts VALUES (1,1,'checking','2022-01-01');`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
    {
      name: 'Multiple transactions same day — ordered by txn_id',
      seedSql: `
INSERT INTO accounts VALUES (1,1,'checking','2022-01-01');
INSERT INTO transactions VALUES
  (1,1,'credit',500.0,'2022-06-01'),
  (2,1,'debit',100.0,'2022-06-01'),
  (3,1,'credit',200.0,'2022-06-01');`.trim(),
    },
  ],
},

// ── 156 ─────────────────────────────────────────────────────────────────────
{
  id: 'bank-mom-balance-change',
  number: 156,
  title: 'Month-over-Month Balance Change',
  difficulty: 'Hard',
  tags: ['CTE', 'Window Functions', 'Date', 'Banking'],
  orderMatters: false,
  schemaSql: BANK_SCHEMA,
  description: `For each account, compute the **end-of-month balance** (sum of all credits minus all debits up to and including the last day of each month). Then compute the **month-over-month change** in balance.

Return columns \`account_id\`, \`month\` (YYYY-MM), \`end_balance\` (rounded to 2), and \`mom_change\` (end_balance minus prior month's end_balance, rounded to 2; NULL for the first month of each account).

Only include months where the account had at least one transaction. Order by \`account_id\` ascending, \`month\` ascending.`,
  hint: 'Compute cumulative balance up to end of each month using a subquery or window function, then use LAG(end_balance) to subtract the prior month.',
  solutionSql: `
WITH monthly_end AS (
  SELECT account_id,
         strftime('%Y-%m', txn_date) AS month,
         SUM(CASE WHEN txn_type = 'credit' THEN amount ELSE -amount END) AS net_change
  FROM transactions
  GROUP BY account_id, month
),
with_running AS (
  SELECT account_id,
         month,
         ROUND(
           SUM(net_change) OVER (PARTITION BY account_id ORDER BY month
                                  ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW),
           2
         ) AS end_balance
  FROM monthly_end
)
SELECT account_id,
       month,
       end_balance,
       ROUND(
         end_balance - LAG(end_balance) OVER (PARTITION BY account_id ORDER BY month),
         2
       ) AS mom_change
FROM with_running
ORDER BY account_id, month;`.trim(),
  outputExplanation: 'Monthly net change (credits minus debits) is computed first. A running SUM window gives the cumulative balance at end of each month. LAG then computes the difference from the prior month.',
  tests: [
    {
      name: 'Example — two accounts',
      seedSql: `
INSERT INTO accounts VALUES (1,1,'checking','2022-01-01'),(2,2,'savings','2022-01-01');
INSERT INTO transactions VALUES
  (1,1,'credit',1000.0,'2022-01-10'),
  (2,1,'debit',300.0,'2022-01-20'),
  (3,1,'credit',500.0,'2022-02-05'),
  (4,1,'debit',100.0,'2022-02-15'),
  (5,1,'credit',200.0,'2022-03-01'),
  (6,2,'credit',5000.0,'2022-01-05'),
  (7,2,'debit',1000.0,'2022-02-10');`.trim(),
    },
    {
      name: 'Single month — mom_change is NULL',
      seedSql: `
INSERT INTO accounts VALUES (1,1,'checking','2022-01-01');
INSERT INTO transactions VALUES (1,1,'credit',500.0,'2022-06-15');`.trim(),
    },
    {
      name: 'Balance decreasing every month',
      seedSql: `
INSERT INTO accounts VALUES (1,1,'checking','2022-01-01');
INSERT INTO transactions VALUES
  (1,1,'credit',1000.0,'2022-01-01'),
  (2,1,'debit',400.0,'2022-02-01'),
  (3,1,'debit',300.0,'2022-03-01'),
  (4,1,'debit',200.0,'2022-04-01');`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
  ],
},

// ── 157 ─────────────────────────────────────────────────────────────────────
{
  id: 'bank-overdraft-detection',
  number: 157,
  title: 'Overdraft Detection',
  difficulty: 'Hard',
  tags: ['CTE', 'Window Functions', 'Banking'],
  orderMatters: false,
  schemaSql: BANK_SCHEMA,
  description: `An **overdraft** occurs when an account's running balance drops below zero after any transaction.

Identify all accounts that experienced at least one overdraft. For each such account return \`account_id\`, \`account_type\`, and \`overdraft_count\` — the number of individual transactions that pushed the balance below zero. Order by \`overdraft_count\` descending, then \`account_id\` ascending.`,
  hint: 'Compute the running balance after every transaction using a window SUM, then count rows where running_balance < 0 per account.',
  solutionSql: `
WITH running AS (
  SELECT account_id,
         SUM(CASE WHEN txn_type = 'credit' THEN amount ELSE -amount END)
           OVER (PARTITION BY account_id ORDER BY txn_date, id
                 ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running_balance
  FROM transactions
)
SELECT r.account_id,
       a.account_type,
       COUNT(*) AS overdraft_count
FROM running r
JOIN accounts a ON a.id = r.account_id
WHERE r.running_balance < 0
GROUP BY r.account_id, a.account_type
ORDER BY overdraft_count DESC, r.account_id ASC;`.trim(),
  outputExplanation: 'The running balance is computed transaction by transaction. Any row where the cumulative balance is negative represents a transaction that caused an overdraft. Accounts with no such rows are excluded.',
  tests: [
    {
      name: 'Example — one account overdraws twice',
      seedSql: `
INSERT INTO accounts VALUES (1,1,'checking','2022-01-01'),(2,2,'savings','2022-01-01');
INSERT INTO transactions VALUES
  (1,1,'credit',100.0,'2022-01-01'),
  (2,1,'debit',200.0,'2022-01-05'),
  (3,1,'credit',500.0,'2022-01-10'),
  (4,1,'debit',600.0,'2022-01-15'),
  (5,2,'credit',1000.0,'2022-01-01'),
  (6,2,'debit',200.0,'2022-01-10');`.trim(),
    },
    {
      name: 'No overdrafts — empty result',
      seedSql: `
INSERT INTO accounts VALUES (1,1,'checking','2022-01-01');
INSERT INTO transactions VALUES
  (1,1,'credit',500.0,'2022-01-01'),
  (2,1,'debit',100.0,'2022-01-05');`.trim(),
    },
    {
      name: 'First transaction is a debit causing overdraft',
      seedSql: `
INSERT INTO accounts VALUES (1,1,'checking','2022-01-01');
INSERT INTO transactions VALUES
  (1,1,'debit',50.0,'2022-01-01'),
  (2,1,'credit',200.0,'2022-01-05');`.trim(),
    },
    {
      name: 'Multiple accounts multiple overdrafts',
      seedSql: `
INSERT INTO accounts VALUES (1,1,'checking','2022-01-01'),(2,2,'checking','2022-01-01'),(3,3,'savings','2022-01-01');
INSERT INTO transactions VALUES
  (1,1,'debit',100.0,'2022-01-01'),
  (2,1,'debit',50.0,'2022-01-02'),
  (3,1,'credit',500.0,'2022-01-03'),
  (4,2,'credit',200.0,'2022-01-01'),
  (5,2,'debit',300.0,'2022-01-05'),
  (6,3,'credit',1000.0,'2022-01-01'),
  (7,3,'debit',200.0,'2022-01-10');`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
  ],
},

// ── 158 ─────────────────────────────────────────────────────────────────────
{
  id: 'food-late-delivery-rate',
  number: 158,
  title: 'Late Delivery Rate',
  difficulty: 'Hard',
  tags: ['CTE', 'Date', 'Aggregation', 'Food Delivery'],
  orderMatters: false,
  schemaSql: FOOD_SCHEMA,
  description: `A delivery is **late** if \`delivered_at\` is more than \`estimated_minutes\` after \`placed_at\`.

For each restaurant with **at least 3 delivered orders** (status = 'delivered'), compute:
- \`total_delivered\` — count of delivered orders
- \`late_deliveries\` — count of late delivered orders
- \`late_rate\` — late_deliveries / total_delivered, rounded to 4 decimal places

Return columns \`restaurant_id\`, \`restaurant_name\`, \`total_delivered\`, \`late_deliveries\`, \`late_rate\`. Order by \`late_rate\` descending, then \`restaurant_id\` ascending.`,
  hint: 'Compare delivered_at with date(placed_at, \'+N minutes\') or use julianday arithmetic: (julianday(delivered_at) - julianday(placed_at)) * 1440 > estimated_minutes.',
  solutionSql: `
SELECT o.restaurant_id,
       r.name AS restaurant_name,
       COUNT(*) AS total_delivered,
       COUNT(CASE
         WHEN (julianday(o.delivered_at) - julianday(o.placed_at)) * 1440 > o.estimated_minutes
         THEN 1
       END) AS late_deliveries,
       ROUND(
         CAST(COUNT(CASE
           WHEN (julianday(o.delivered_at) - julianday(o.placed_at)) * 1440 > o.estimated_minutes
           THEN 1
         END) AS REAL) / COUNT(*),
         4
       ) AS late_rate
FROM orders o
JOIN restaurants r ON r.id = o.restaurant_id
WHERE o.status = 'delivered'
GROUP BY o.restaurant_id, r.name
HAVING COUNT(*) >= 3
ORDER BY late_rate DESC, o.restaurant_id ASC;`.trim(),
  outputExplanation: 'julianday differences * 1440 converts days to minutes, which is then compared against estimated_minutes. Only restaurants with 3+ delivered orders qualify. Higher late_rate = worse delivery performance.',
  tests: [
    {
      name: 'Example — two restaurants qualifying',
      seedSql: `
INSERT INTO restaurants VALUES (1,'PizzaPalace','Italian','NYC'),(2,'BurgerBarn','American','NYC'),(3,'TacoTruck','Mexican','NYC');
INSERT INTO orders VALUES
  (1,1,101,'2022-01-01 12:00','2022-01-01 12:45',30,25.0,'delivered'),
  (2,1,102,'2022-01-02 13:00','2022-01-02 13:20',30,18.0,'delivered'),
  (3,1,103,'2022-01-03 14:00','2022-01-03 15:10',60,30.0,'delivered'),
  (4,2,101,'2022-01-01 18:00','2022-01-01 18:50',40,22.0,'delivered'),
  (5,2,102,'2022-01-02 19:00','2022-01-02 19:55',45,28.0,'delivered'),
  (6,2,103,'2022-01-03 20:00','2022-01-03 20:25',30,15.0,'delivered'),
  (7,3,101,'2022-01-01 11:00','2022-01-01 11:30',25,20.0,'delivered'),
  (8,3,102,'2022-01-02 12:00',NULL,30,18.0,'pending');`.trim(),
    },
    {
      name: 'Restaurant with fewer than 3 deliveries excluded',
      seedSql: `
INSERT INTO restaurants VALUES (1,'Tiny','Cafe','NYC');
INSERT INTO orders VALUES
  (1,1,1,'2022-01-01 12:00','2022-01-01 13:00',30,10.0,'delivered'),
  (2,1,2,'2022-01-02 12:00','2022-01-02 13:00',30,10.0,'delivered');`.trim(),
    },
    {
      name: 'All deliveries on time — late_rate 0',
      seedSql: `
INSERT INTO restaurants VALUES (1,'OnTime','Italian','NYC');
INSERT INTO orders VALUES
  (1,1,1,'2022-01-01 12:00','2022-01-01 12:25',30,10.0,'delivered'),
  (2,1,2,'2022-01-02 12:00','2022-01-02 12:20',30,10.0,'delivered'),
  (3,1,3,'2022-01-03 12:00','2022-01-03 12:15',30,10.0,'delivered');`.trim(),
    },
    {
      name: 'All deliveries late — late_rate 1',
      seedSql: `
INSERT INTO restaurants VALUES (1,'AlwaysLate','Pizza','NYC');
INSERT INTO orders VALUES
  (1,1,1,'2022-01-01 12:00','2022-01-01 13:30',30,10.0,'delivered'),
  (2,1,2,'2022-01-02 12:00','2022-01-02 13:45',30,10.0,'delivered'),
  (3,1,3,'2022-01-03 12:00','2022-01-03 14:00',30,10.0,'delivered');`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
  ],
},

// ── 159 ─────────────────────────────────────────────────────────────────────
{
  id: 'food-most-popular-item-per-cuisine',
  number: 159,
  title: 'Most Popular Item per Cuisine',
  difficulty: 'Hard',
  tags: ['CTE', 'Window Functions', 'Join', 'Food Delivery'],
  orderMatters: false,
  schemaSql: FOOD_SCHEMA,
  description: `For each cuisine type, find the **single most-ordered menu item** (by total quantity sold across all delivered orders). If two items tie, return the one that comes **first alphabetically**.

Return columns \`cuisine\`, \`item_name\`, and \`total_quantity\`. Order by \`cuisine\` ascending.`,
  hint: 'Join order_items → orders → restaurants, filter to delivered orders, sum quantity by (cuisine, item_name), then use ROW_NUMBER() to pick rank 1 per cuisine.',
  solutionSql: `
WITH item_sales AS (
  SELECT r.cuisine,
         oi.item_name,
         SUM(oi.quantity) AS total_quantity
  FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  JOIN restaurants r ON r.id = o.restaurant_id
  WHERE o.status = 'delivered'
  GROUP BY r.cuisine, oi.item_name
),
ranked AS (
  SELECT *,
         ROW_NUMBER() OVER (PARTITION BY cuisine ORDER BY total_quantity DESC, item_name ASC) AS rn
  FROM item_sales
)
SELECT cuisine, item_name, total_quantity
FROM ranked
WHERE rn = 1
ORDER BY cuisine;`.trim(),
  outputExplanation: 'Quantity is summed per (cuisine, item) across delivered orders. ROW_NUMBER() with ORDER BY total_quantity DESC, item_name ASC picks the top item per cuisine, breaking ties alphabetically.',
  tests: [
    {
      name: 'Example — two cuisines',
      seedSql: `
INSERT INTO restaurants VALUES (1,'PizzaPalace','Italian','NYC'),(2,'PastaPlace','Italian','NYC'),(3,'BurgerBarn','American','NYC');
INSERT INTO orders VALUES
  (1,1,101,'2022-01-01','2022-01-01',30,20.0,'delivered'),
  (2,1,102,'2022-01-02','2022-01-02',30,18.0,'delivered'),
  (3,2,103,'2022-01-03','2022-01-03',30,22.0,'delivered'),
  (4,3,101,'2022-01-01','2022-01-01',25,15.0,'delivered'),
  (5,3,102,'2022-01-02',NULL,25,15.0,'pending');
INSERT INTO order_items VALUES
  (1,1,'Margherita Pizza',2,10.0),
  (2,1,'Garlic Bread',1,5.0),
  (3,2,'Margherita Pizza',3,10.0),
  (4,3,'Spaghetti Bolognese',2,11.0),
  (5,4,'Cheeseburger',2,7.5),
  (6,4,'Fries',3,3.0),
  (7,5,'Cheeseburger',1,7.5);`.trim(),
    },
    {
      name: 'Tie broken alphabetically',
      seedSql: `
INSERT INTO restaurants VALUES (1,'R1','Asian','NYC'),(2,'R2','Asian','NYC');
INSERT INTO orders VALUES
  (1,1,1,'2022-01-01','2022-01-01',30,10.0,'delivered'),
  (2,2,1,'2022-01-02','2022-01-02',30,10.0,'delivered');
INSERT INTO order_items VALUES
  (1,1,'Ramen',5,8.0),
  (2,2,'Gyoza',5,5.0);`.trim(),
    },
    {
      name: 'Pending orders not counted',
      seedSql: `
INSERT INTO restaurants VALUES (1,'R','Italian','NYC');
INSERT INTO orders VALUES
  (1,1,1,'2022-01-01','2022-01-01',30,10.0,'delivered'),
  (2,1,2,'2022-01-02',NULL,30,10.0,'pending');
INSERT INTO order_items VALUES
  (1,1,'Pizza',2,10.0),
  (2,2,'Pasta',100,8.0);`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
  ],
},

// ── 160 ─────────────────────────────────────────────────────────────────────
{
  id: 'food-customer-ltv-segments',
  number: 160,
  title: 'Customer LTV Segments',
  difficulty: 'Hard',
  tags: ['CTE', 'Window Functions', 'Aggregation', 'Food Delivery'],
  orderMatters: false,
  schemaSql: FOOD_SCHEMA,
  description: `Compute the **lifetime value (LTV)** of each customer as their total spend across all delivered orders. Then segment customers into:
- **'high'** — top 20% by LTV (NTILE bucket 1 of 5)
- **'mid'** — next 30% (buckets 2 and 3 of 5)
- **'low'** — bottom 50% (buckets 4 and 5 of 5)

Return columns \`customer_id\`, \`total_ltv\` (rounded to 2), and \`segment\`. Only include customers with at least one delivered order. Order by \`total_ltv\` descending, then \`customer_id\` ascending.`,
  hint: 'Sum delivered order amounts per customer, then use NTILE(5) OVER (ORDER BY total_ltv DESC) to bucket them, and map bucket 1 → high, 2–3 → mid, 4–5 → low.',
  solutionSql: `
WITH ltv AS (
  SELECT customer_id,
         ROUND(SUM(total_amount), 2) AS total_ltv
  FROM orders
  WHERE status = 'delivered'
  GROUP BY customer_id
),
bucketed AS (
  SELECT customer_id,
         total_ltv,
         NTILE(5) OVER (ORDER BY total_ltv DESC, customer_id ASC) AS bucket
  FROM ltv
)
SELECT customer_id,
       total_ltv,
       CASE
         WHEN bucket = 1 THEN 'high'
         WHEN bucket IN (2, 3) THEN 'mid'
         ELSE 'low'
       END AS segment
FROM bucketed
ORDER BY total_ltv DESC, customer_id ASC;`.trim(),
  outputExplanation: 'NTILE(5) divides customers ranked by descending LTV into 5 equal buckets. Bucket 1 (top 20%) = high value, buckets 2–3 (next 30%) = mid, buckets 4–5 (bottom 50%) = low.',
  tests: [
    {
      name: 'Example — 10 customers, segments visible',
      seedSql: `
INSERT INTO restaurants VALUES (1,'R1','Italian','NYC');
INSERT INTO orders VALUES
  (1,1,1,'2022-01-01','2022-01-01',30,500.0,'delivered'),
  (2,1,2,'2022-01-01','2022-01-01',30,450.0,'delivered'),
  (3,1,3,'2022-01-01','2022-01-01',30,400.0,'delivered'),
  (4,1,4,'2022-01-01','2022-01-01',30,300.0,'delivered'),
  (5,1,5,'2022-01-01','2022-01-01',30,250.0,'delivered'),
  (6,1,6,'2022-01-01','2022-01-01',30,200.0,'delivered'),
  (7,1,7,'2022-01-01','2022-01-01',30,150.0,'delivered'),
  (8,1,8,'2022-01-01','2022-01-01',30,100.0,'delivered'),
  (9,1,9,'2022-01-01','2022-01-01',30,75.0,'delivered'),
  (10,1,10,'2022-01-01','2022-01-01',30,50.0,'delivered');`.trim(),
    },
    {
      name: 'Pending orders excluded',
      seedSql: `
INSERT INTO restaurants VALUES (1,'R','Italian','NYC');
INSERT INTO orders VALUES
  (1,1,1,'2022-01-01','2022-01-01',30,1000.0,'delivered'),
  (2,1,2,'2022-01-01','2022-01-01',30,900.0,'delivered'),
  (3,1,3,'2022-01-01','2022-01-01',30,800.0,'delivered'),
  (4,1,4,'2022-01-01','2022-01-01',30,700.0,'delivered'),
  (5,1,5,'2022-01-01','2022-01-01',30,600.0,'delivered'),
  (6,1,1,'2022-01-02',NULL,30,9999.0,'pending');`.trim(),
    },
    {
      name: 'Single customer — goes to high',
      seedSql: `
INSERT INTO restaurants VALUES (1,'R','Italian','NYC');
INSERT INTO orders VALUES (1,1,1,'2022-01-01','2022-01-01',30,100.0,'delivered');`.trim(),
    },
    {
      name: 'Empty tables',
      seedSql: '',
    },
    {
      name: 'Five customers equal LTV — secondary sort by customer_id',
      seedSql: `
INSERT INTO restaurants VALUES (1,'R','Italian','NYC');
INSERT INTO orders VALUES
  (1,1,1,'2022-01-01','2022-01-01',30,100.0,'delivered'),
  (2,1,2,'2022-01-01','2022-01-01',30,100.0,'delivered'),
  (3,1,3,'2022-01-01','2022-01-01',30,100.0,'delivered'),
  (4,1,4,'2022-01-01','2022-01-01',30,100.0,'delivered'),
  (5,1,5,'2022-01-01','2022-01-01',30,100.0,'delivered');`.trim(),
    },
  ],
},

];

// ─── GENERATE AND WRITE ──────────────────────────────────────────────────────

let ok = 0, failed = 0;
for (const skeleton of problems) {
  try {
    const built = build(skeleton);
    const filename = `${String(skeleton.number).padStart(3,'0')}-${skeleton.id}.json`;
    const outPath = path.join(OUT, filename);
    await fs.writeFile(outPath, JSON.stringify(built, null, 2) + '\n');
    console.log(`✓ ${filename}`);
    ok++;
  } catch (err) {
    console.error(`✗ ${skeleton.id}: ${err.message}`);
    failed++;
  }
}
console.log(`\n${ok} written, ${failed} failed.`);
