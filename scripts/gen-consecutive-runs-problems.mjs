/**
 * Generate original SQL problems numbered 185–190 that use the same
 * "consecutive ids where every row meets a condition" pattern as LeetCode 601
 * (gaps-and-islands via `id - ROW_NUMBER()`), but with brand-new domains/data.
 *
 * The script:
 *   - builds a fresh sql.js DB per test case (schema + seed)
 *   - runs the reference solution to compute the expectedOutput rows
 *   - HMAC-hashes each expectedOutput with the repo's EXPECTED_HASH_SECRET
 *   - writes problems/NNN-slug.json
 *
 *   node scripts/gen-consecutive-runs-problems.mjs
 */
import initSqlJs from 'sql.js';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalizeObjects, hmacHex } from '../server/canon.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROBLEMS_DIR = join(ROOT, 'problems');

const envPath = join(ROOT, '.env');
if (!existsSync(envPath)) process.exit(console.error('.env not found'));
const secret = (readFileSync(envPath, 'utf8').match(/^EXPECTED_HASH_SECRET=(.+)$/m) || [])[1]?.trim();
if (!secret || secret.length < 16) process.exit(console.error('EXPECTED_HASH_SECRET missing/short in .env'));

const SQL = await initSqlJs();

/**
 * Run the reference solution against schema+seed, return the resulting
 * array-of-objects rows (exact column names and values from the query).
 */
function expectedOutputOf({ schemaSql, solutionSql, seedSql }) {
  const db = new SQL.Database();
  if (schemaSql) db.run(schemaSql);
  if (seedSql) db.run(seedSql);
  const dbResult = db.exec(solutionSql);
  let cols = [];
  let rows = [];
  if (dbResult.length) {
    cols = dbResult[dbResult.length - 1].columns;
    rows = dbResult[dbResult.length - 1].values;
  } else {
    const stmt = db.prepare(solutionSql);
    cols = stmt.getColumnNames();
    stmt.free();
  }
  const objects = rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
  db.close();
  return objects;
}

/**
 * Build a full problem object from its pieces.
 * @param {object} p definition (id, number, title, difficulty, tags, description, schemaSql, solutionSql, hint, outputExplanation, tests)
 */
function buildProblem(p) {
  const tests = p.tests.map((t) => {
    const expectedOutput = expectedOutputOf({
      schemaSql: p.schemaSql,
      solutionSql: p.solutionSql,
      seedSql: t.seedSql,
    });
    return {
      name: t.name,
      seedSql: t.seedSql,
      expectedOutput,
      expectedHash: hmacHex(canonicalizeObjects(expectedOutput), secret),
    };
  });
  return { ...p, tests };
}

const insert = (table, rows) =>
  `INSERT INTO ${table} VALUES ${rows.map((r) => `(${r})`).join(',')};`;

/* ------------------------------------------------------------------ */
/* Problem 185 — Heatwave Three-Day Window                             */
/* Group of 3+ consecutive readings where temperature >= 100           */
/* ------------------------------------------------------------------ */
const p185 = {
  id: 'heatwave-three-day-window',
  number: 185,
  title: 'Heatwave Three-Day Window',
  difficulty: 'Hard',
  tags: ['Window Function', 'Consecutive ids', 'Gaps & Islands'],
  description: `Table \`temperature_readings\`:

| Column Name  | Type    |
| ------------ | ------- |
| id           | int     |
| reading_date | date    |
| temperature  | int     |

reading_date is a column with unique values for this table. Each row contains the date and the temperature (in Fahrenheit) recorded at a weather station. As the id increases, the reading_date increases as well.

Write a solution to display the records with **three or more rows with consecutive id's**, and the temperature is **greater than or equal to 100** for each of those rows.

Return the result table ordered by \`reading_date\` in ascending order.

Example:

\`\`\`
Input:
temperature_readings:
+----+------------+-------------+
| id | reading_date | temperature |
+----+------------+-------------+
| 1  | 2017-01-01 | 10          |
| 2  | 2017-01-02 | 109         |
| 3  | 2017-01-03 | 150         |
| 4  | 2017-01-04 | 99          |
| 5  | 2017-01-05 | 145         |
| 6  | 2017-01-06 | 1455        |
| 7  | 2017-01-07 | 199         |
| 8  | 2017-01-09 | 188         |
+----+------------+-------------+

Output:
+----+------------+-------------+
| id | reading_date | temperature |
+----+------------+-------------+
| 5  | 2017-01-05 | 145         |
| 6  | 2017-01-06 | 1455        |
| 7  | 2017-01-07 | 199         |
| 8  | 2017-01-09 | 188         |
+----+------------+-------------+
\`\`\`

The four rows with ids 5, 6, 7 and 8 have consecutive ids and each has temperature >= 100. Row 8 is included even though its reading_date is not the day after row 7. Rows 2 and 3 are excluded because we need at least three consecutive ids, and 4 breaks the chain.`,
  schemaSql: `CREATE TABLE temperature_readings (
  id INTEGER PRIMARY KEY,
  reading_date TEXT,
  temperature INTEGER
);`,
  solutionSql: `WITH qualifying AS (
  SELECT id, reading_date, temperature,
         id - ROW_NUMBER() OVER (ORDER BY id) AS grp
  FROM temperature_readings
  WHERE temperature >= 100
)
SELECT id, reading_date, temperature
FROM qualifying
WHERE grp IN (
  SELECT grp FROM qualifying GROUP BY grp HAVING COUNT(*) >= 3
)
ORDER BY reading_date;`,
  hint: 'Keep only rows where temperature >= 100, then group consecutive id\'s into islands with id - ROW_NUMBER() OVER (ORDER BY id). Every row in an island of size 3+ qualifies.',
  outputExplanation: 'Only rows whose id belongs to a run of at least three consecutive qualifying readings are returned. Date gaps do not break a run — only gaps in id do.',
  tests: [
    {
      name: 'Example',
      seedSql: insert('temperature_readings', [
        "1,'2017-01-01',10", "2,'2017-01-02',109", "3,'2017-01-03',150",
        "4,'2017-01-04',99", "5,'2017-01-05',145", "6,'2017-01-06',1455",
        "7,'2017-01-07',199", "8,'2017-01-09',188",
      ]),
    },
    {
      name: 'Exactly three consecutive',
      seedSql: insert('temperature_readings', [
        "1,'2020-06-01',120", "2,'2020-06-02',130", "3,'2020-06-03',140", "4,'2020-06-04',50",
      ]),
    },
    {
      name: 'Four consecutive - two in row 2-3 do not cut it',
      seedSql: insert('temperature_readings', [
        "1,'2021-09-01',220", "2,'2021-09-02',97", "3,'2021-09-03',80", "4,'2021-09-04',250", "5,'2021-09-05',260", "6,'2021-09-06',270",
      ]),
    },
    {
      name: 'Non-contiguous ids must not count as a run',
      seedSql: insert('temperature_readings', [
        "1,'2022-02-01',150", "3,'2022-02-03',160", "5,'2022-02-05',170", "7,'2022-02-07',180",
      ]),
    },
    {
      name: 'Exactly at threshold (100) counts',
      seedSql: insert('temperature_readings', [
        "1,'2023-05-01',100", "2,'2023-05-02',100", "3,'2023-05-03',100", "4,'2023-05-04',90",
      ]),
    },
    {
      name: 'Two disjoint runs',
      seedSql: insert('temperature_readings', [
        "1,'2024-07-01',111", "2,'2024-07-02',112", "3,'2024-07-03',113",
        "4,'2024-07-04',40", "5,'2024-07-05',160", "6,'2024-07-06',161", "7,'2024-07-07',162",
      ]),
    },
    {
      name: 'Long run of exactly three at the very end',
      seedSql: insert('temperature_readings', [
        "1,'2020-01-01',30", "2,'2020-01-02',40", "3,'2020-01-03',101", "4,'2020-01-04',102", "5,'2020-01-05',103",
      ]),
    },
    {
      name: 'Empty table',
      seedSql: '',
    },
    {
      name: 'All rows qualify - single big run',
      seedSql: insert('temperature_readings', [
        "1,'2019-08-10',200", "2,'2019-08-11',201", "3,'2019-08-12',202", "4,'2019-08-13',203", "5,'2019-08-14',204",
      ]),
    },
    {
      name: 'Only a pair and singles - nothing qualifies',
      seedSql: insert('temperature_readings', [
        "1,'2020-03-01',150", "2,'2020-03-02',160", "3,'2020-03-03',10", "4,'2020-03-04',170",
      ]),
    },
    {
      name: 'Run of three where a date is duplicated elsewhere (unique dates still hold)',
      seedSql: insert('temperature_readings', [
        "1,'2018-01-01',110", "2,'2018-01-03',115", "3,'2018-01-05',120",
        "4,'2018-01-06',10", "5,'2018-01-07',111", "6,'2018-01-09',112", "7,'2018-01-10',113",
      ]),
    },
    {
      name: 'Windowing over ORDER BY id not insertion order',
      seedSql: insert('temperature_readings', [
        "5,'2017-09-05',101", "6,'2017-09-06',102", "7,'2017-09-07',103",
        "1,'2017-09-01',9", "2,'2017-09-02',8", "3,'2017-09-03',7",
      ]),
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Problem 186 — Consecutive Discount Rockets                          */
/* 4+ consecutive ids where sales_discount >= 20 percent               */
/* ------------------------------------------------------------------ */
const p186 = {
  id: 'consecutive-discount-rockets',
  number: 186,
  title: 'Consecutive Discount Rockets',
  difficulty: 'Hard',
  tags: ['Window Function', 'Consecutive ids', 'Filtering'],
  description: `Table \`discount_campaigns\`:

| Column Name    | Type    |
| -------------- | ------- |
| id             | int     |
| campaign_date  | date    |
| discount_pct   | int     |
| revenue        | int     |

campaign_date is unique for this table. As the id increases, the campaign_date increases as well.

A "discount rocket" is a day where \`discount_pct >= 20\` AND \`revenue >= 5000\`. Marketing wants to study stretches where at least **four consecutive days** (consecutive id's) were all discount rockets.

Write a solution to display the records with **four or more rows with consecutive id's** where **every** row in the stretch qualifies as a discount rocket.

Return the result table ordered by \`campaign_date\` in ascending order.

Example:

\`\`\`
Input:
discount_campaigns:
+----+---------------+--------------+---------+
| id | campaign_date | discount_pct | revenue |
+----+---------------+--------------+---------+
| 1  | 2023-03-01    | 30           | 12000   |
| 2  | 2023-03-02    | 25           | 9000    |
| 3  | 2023-03-03    | 40           | 15000   |
| 4  | 2023-03-04    | 10           | 20000   |
| 5  | 2023-03-05    | 22           | 6000    |
| 6  | 2023-03-06    | 21           | 5800    |
| 7  | 2023-03-07    | 35           | 7000    |
| 8  | 2023-03-08    | 30           | 6500    |
+----+---------------+--------------+---------+

Output:
+----+---------------+--------------+---------+
| id | campaign_date | discount_pct | revenue |
+----+---------------+--------------+---------+
| 5  | 2023-03-05    | 22           | 6000    |
| 6  | 2023-03-06    | 21           | 5800    |
| 7  | 2023-03-07    | 35           | 7000    |
| 8  | 2023-03-08    | 30           | 6500    |
+----+---------------+--------------+---------+
\`\`\`

Rows 1-3 are a run of three discount rockets, but four are required. Rows 5-8 are four consecutive discount rockets, so all four are returned.`,
  schemaSql: `CREATE TABLE discount_campaigns (
  id INTEGER PRIMARY KEY,
  campaign_date TEXT,
  discount_pct INTEGER,
  revenue INTEGER
);`,
  solutionSql: `WITH rockets AS (
  SELECT id, campaign_date, discount_pct, revenue,
         id - ROW_NUMBER() OVER (ORDER BY id) AS grp
  FROM discount_campaigns
  WHERE discount_pct >= 20 AND revenue >= 5000
)
SELECT id, campaign_date, discount_pct, revenue
FROM rockets
WHERE grp IN (
  SELECT grp FROM rockets GROUP BY grp HAVING COUNT(*) >= 4
)
ORDER BY campaign_date;`,
  hint: 'A discount rocket satisfies discount_pct >= 20 AND revenue >= 5000. Filter first, then use id - ROW_NUMBER() to find islands of consecutive ids. The run length must be four or more.',
  outputExplanation: 'The query returns only ids that are part of a consecutive-id run of length 4+ where every row is a discount rocket. Row 4 breaks the first candidate run (discount_pct 10), so rows 1-3 are excluded.',
  tests: [
    {
      name: 'Example',
      seedSql: insert('discount_campaigns', [
        "1,'2023-03-01',30,12000", "2,'2023-03-02',25,9000", "3,'2023-03-03',40,15000",
        "4,'2023-03-04',10,20000", "5,'2023-03-05',22,6000", "6,'2023-03-06',21,5800",
        "7,'2023-03-07',35,7000", "8,'2023-03-08',30,6500",
      ]),
    },
    {
      name: 'Exactly four consecutive rockets',
      seedSql: insert('discount_campaigns', [
        "1,'2022-01-10',25,6000", "2,'2022-01-11',26,6100", "3,'2022-01-12',27,6200", "4,'2022-01-13',28,6300", "5,'2022-01-14',5,100000",
      ]),
    },
    {
      name: 'Three rockets then a gap then one - fails 4-run',
      seedSql: insert('discount_campaigns', [
        "1,'2020-05-01',20,5000", "2,'2020-05-02',21,5100", "3,'2020-05-03',22,5200",
        "5,'2020-05-05',23,5300",
      ]),
    },
    {
      name: 'Two rocket runs of four separated by a bad day',
      seedSql: insert('discount_campaigns', [
        "1,'2019-06-01',30,8000", "2,'2019-06-02',31,8100", "3,'2019-06-03',32,8200", "4,'2019-06-04',33,8300",
        "5,'2019-06-05',10,9000",
        "6,'2019-06-06',24,5400", "7,'2019-06-07',25,5500", "8,'2019-06-08',26,5600", "9,'2019-06-09',27,5700",
      ]),
    },
    {
      name: 'Big revenue but no discount - does not qualify',
      seedSql: insert('discount_campaigns', [
        "1,'2021-07-01',5,999999", "2,'2021-07-02',6,888888", "3,'2021-07-03',7,777777",
        "4,'2021-07-04',22,9000", "5,'2021-07-05',23,9100", "6,'2021-07-06',24,9200", "7,'2021-07-07',25,9300",
      ]),
    },
    {
      name: 'Big discount but tiny revenue - does not qualify',
      seedSql: insert('discount_campaigns', [
        "1,'2018-03-01',90,10", "2,'2018-03-02',85,10", "3,'2018-03-03',80,10",
        "4,'2018-03-04',70,10", "5,'2018-03-05',60,10", "6,'2018-03-06',21,7000", "7,'2018-03-07',22,7100", "8,'2018-03-08',23,7200", "9,'2018-03-09',24,7300",
      ]),
    },
    {
      name: 'Boundary: discount exactly 20 and revenue exactly 5000 both count',
      seedSql: insert('discount_campaigns', [
        "1,'2024-02-01',20,5000", "2,'2024-02-02',20,5000", "3,'2024-02-03',20,5000", "4,'2024-02-04',20,5000",
      ]),
    },
    {
      name: 'Long running streak of six rockets',
      seedSql: insert('discount_campaigns', [
        "1,'2023-11-01',21,6000", "2,'2023-11-02',22,6000", "3,'2023-11-03',23,6000",
        "4,'2023-11-04',24,6000", "5,'2023-11-05',25,6000", "6,'2023-11-06',26,6000",
      ]),
    },
    {
      name: 'Empty table',
      seedSql: '',
    },
    {
      name: 'Non-contiguous ids not treated as consecutive',
      seedSql: insert('discount_campaigns', [
        "1,'2020-08-01',25,7000", "2,'2020-08-02',25,7000", "4,'2020-08-04',25,7000", "5,'2020-08-05',25,7000",
      ]),
    },
    {
      name: 'Insert order scrambled - must order by id',
      seedSql: insert('discount_campaigns', [
        "4,'2023-01-04',20,7000", "5,'2023-01-05',20,7000", "1,'2023-01-01',20,7000", "2,'2023-01-02',20,7000", "3,'2023-01-03',20,7000",
      ]),
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Problem 187 — Solar Surge Streak                                    */
/* 3+ consecutive ids where output_kwh >= 3000                         */
/* ------------------------------------------------------------------ */
const p187 = {
  id: 'solar-surge-streak',
  number: 187,
  title: 'Solar Surge Streak',
  difficulty: 'Hard',
  tags: ['Window Function', 'Consecutive ids', 'Temporal Sequences'],
  description: `Table \`solar_output\`:

| Column Name | Type    |
| ----------- | ------- |
| id          | int     |
| report_date | date    |
| output_kwh  | int     |

report_date is unique for this table. As the id increases, the report_date increases as well.

Engineers define a "surge day" as a day where \`output_kwh >= 3000\`.

Write a solution to display the records where the day is part of a stretch of **three or more consecutive id's**, and every day in that stretch is a surge day.

Return the result table ordered by \`report_date\` in ascending order.

Example:

\`\`\`
Input:
solar_output:
+----+-------------+------------+
| id | report_date | output_kwh |
+----+-------------+------------+
| 1  | 2019-04-01  | 4100       |
| 2  | 2019-04-02  | 4200       |
| 3  | 2019-04-03  | 4300       |
| 4  | 2019-04-04  | 2500       |
| 5  | 2019-04-05  | 5000       |
| 6  | 2019-04-06  | 5100       |
| 7  | 2019-04-07  | 5200       |
+----+-------------+------------+

Output:
+----+-------------+------------+
| id | report_date | output_kwh |
+----+-------------+------------+
| 1  | 2019-04-01  | 4100       |
| 2  | 2019-04-02  | 4200       |
| 3  | 2019-04-03  | 4300       |
| 5  | 2019-04-05  | 5000       |
| 6  | 2019-04-06  | 5100       |
| 7  | 2019-04-07  | 5200       |
+----+-------------+------------+
\`\`\`

Both runs (1-3 and 5-7) have at least three consecutive surge days, so every row in each run is returned.`,
  schemaSql: `CREATE TABLE solar_output (
  id INTEGER PRIMARY KEY,
  report_date TEXT,
  output_kwh INTEGER
);`,
  solutionSql: `WITH surges AS (
  SELECT id, report_date, output_kwh,
         id - ROW_NUMBER() OVER (ORDER BY id) AS grp
  FROM solar_output
  WHERE output_kwh >= 3000
)
SELECT id, report_date, output_kwh
FROM surges
WHERE grp IN (
  SELECT grp FROM surges GROUP BY grp HAVING COUNT(*) >= 3
)
ORDER BY report_date;`,
  hint: 'Filter to surge days first (output_kwh >= 3000), then group by the island id id - ROW_NUMBER() OVER (ORDER BY id). Rows in islands of size 3+ all qualify.',
  outputExplanation: 'Rows 1-3 form one surge-day run and rows 5-7 form another; both runs are of length 3, so every row in both runs is selected. Row 4 is not a surge day and is never a candidate.',
  tests: [
    {
      name: 'Example',
      seedSql: insert('solar_output', [
        "1,'2019-04-01',4100", "2,'2019-04-02',4200", "3,'2019-04-03',4300",
        "4,'2019-04-04',2500", "5,'2019-04-05',5000", "6,'2019-04-06',5100", "7,'2019-04-07',5200",
      ]),
    },
    {
      name: 'Run of three where the middle date is far later',
      seedSql: insert('solar_output', [
        "1,'2018-04-01',3100", "2,'2018-04-01',3200", "3,'2018-04-02',3300", "9,'2018-04-09',900",
      ]),
    },
    {
      name: 'Exactly three splashy days',
      seedSql: insert('solar_output', [
        "1,'2021-07-20',3000", "2,'2021-07-21',3000", "3,'2021-07-22',3000", "4,'2021-07-23',100",
      ]),
    },
    {
      name: 'A lone surge and a pair - nothing qualifies',
      seedSql: insert('solar_output', [
        "1,'2017-02-01',3500", "2,'2017-02-02',600", "3,'2017-02-03',700", "4,'2017-02-04',3600", "5,'2017-02-05',3700",
      ]),
    },
    {
      name: 'All days surge - single run spanning the table',
      seedSql: insert('solar_output', [
        "1,'2022-09-01',5000", "2,'2022-09-02',4900", "3,'2022-09-03',4800", "4,'2022-09-04',4700", "5,'2022-09-05',4600",
      ]),
    },
    {
      name: 'Longest run in the middle of the data',
      seedSql: insert('solar_output', [
        "1,'2020-01-01',50", "2,'2020-01-02',60", "3,'2020-01-03',4000", "4,'2020-01-04',4100", "5,'2020-01-05',4200", "6,'2020-01-06',90", "7,'2020-01-07',100",
      ]),
    },
    {
      name: 'Run wrapped by sub-threshold days on both sides',
      seedSql: insert('solar_output', [
        "1,'2016-05-01',100", "2,'2016-05-02',3100", "3,'2016-05-03',3200", "4,'2016-05-04',3300", "5,'2016-05-05',100",
      ]),
    },
    {
      name: 'Gap in ids splits what would otherwise be one run by date',
      seedSql: insert('solar_output', [
        "1,'2015-06-01',5000", "2,'2015-06-02',5000", "4,'2015-06-04',5000", "5,'2015-06-05',5000",
      ]),
    },
    {
      name: 'Empty table',
      seedSql: '',
    },
    {
      name: 'Long run of 6 with alternating values still >= 3000',
      seedSql: insert('solar_output', [
        "1,'2023-12-01',3000", "2,'2023-12-02',9000", "3,'2023-12-03',3000", "4,'2023-12-04',9000", "5,'2023-12-05',3000", "6,'2023-12-06',9000",
      ]),
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Problem 188 — Warehouse Stock Surge                                 */
/* 3+ consecutive ids where stock_in >= 5000                           */
/* ------------------------------------------------------------------ */
const p188 = {
  id: 'warehouse-stock-surge',
  number: 188,
  title: 'Warehouse Stock Surge',
  difficulty: 'Medium',
  tags: ['Window Function', 'Consecutive ids', 'Inventory'],
  description: `Table \`warehouse_deliveries\`:

| Column Name | Type    |
| ----------- | ------- |
| id          | int     |
| delivery_date | date  |
| stock_in    | int     |

delivery_date is unique for this table. As the id increases, the delivery_date increases as well. Each row records how many units arrived at a warehouse on that date.

A "big restock" is a delivery where \`stock_in >= 5000\`.

Write a solution to display the records with **three or more rows with consecutive id's** where every row in the run is a big restock.

Return the result table ordered by \`delivery_date\` in ascending order.

Example:

\`\`\`
Input:
warehouse_deliveries:
+----+--------------+----------+
| id | delivery_date | stock_in |
+----+--------------+----------+
| 1  | 2023-08-01   | 7000     |
| 2  | 2023-08-02   | 6000     |
| 3  | 2023-08-03   | 8000     |
| 4  | 2023-08-04   | 2000     |
| 5  | 2023-08-05   | 9000     |
| 6  | 2023-08-06   | 9500     |
+----+--------------+----------+

Output:
+----+--------------+----------+
| id | delivery_date | stock_in |
+----+--------------+----------+
| 1  | 2023-08-01   | 7000     |
| 2  | 2023-08-02   | 6000     |
| 3  | 2023-08-03   | 8000     |
+----+--------------+----------+
\`\`\`

Ids 1, 2, 3 are three consecutive big restocks, so all three are returned. The run of ids 5-6 is only a pair — not enough to qualify.`,
  schemaSql: `CREATE TABLE warehouse_deliveries (
  id INTEGER PRIMARY KEY,
  delivery_date TEXT,
  stock_in INTEGER
);`,
  solutionSql: `WITH restocks AS (
  SELECT id, delivery_date, stock_in,
         id - ROW_NUMBER() OVER (ORDER BY id) AS grp
  FROM warehouse_deliveries
  WHERE stock_in >= 5000
)
SELECT id, delivery_date, stock_in
FROM restocks
WHERE grp IN (
  SELECT grp FROM restocks GROUP BY grp HAVING COUNT(*) >= 3
)
ORDER BY delivery_date;`,
  hint: 'Filter to big restocks (stock_in >= 5000), find islands via id - ROW_NUMBER() OVER (ORDER BY id), and keep every row from islands of size 3+. Pairs never qualify.',
  outputExplanation: 'In the example, ids 1-3 form a run of three consecutive big restocks so all three are returned; ids 5-6 are only a pair, so they are excluded.',
  tests: [
    {
      name: 'Example',
      seedSql: insert('warehouse_deliveries', [
        "1,'2023-08-01',7000", "2,'2023-08-02',6000", "3,'2023-08-03',8000",
        "4,'2023-08-04',2000", "5,'2023-08-05',9000", "6,'2023-08-06',9500",
      ]),
    },
    {
      name: 'Three consecutive big restocks',
      seedSql: insert('warehouse_deliveries', [
        "1,'2022-03-10',5100", "2,'2022-03-11',5200", "3,'2022-03-12',5300", "4,'2022-03-13',400",
      ]),
    },
    {
      name: 'A big run of five plus a small dip',
      seedSql: insert('warehouse_deliveries', [
        "1,'2019-07-01',6000", "2,'2019-07-02',7000", "3,'2019-07-03',8000", "4,'2019-07-04',9000", "5,'2019-07-05',10000", "6,'2019-07-06',100",
      ]),
    },
    {
      name: 'Exact threshold 5000 counts as big',
      seedSql: insert('warehouse_deliveries', [
        "1,'2020-10-01',5000", "2,'2020-10-02',5000", "3,'2020-10-03',5000", "4,'2020-10-04',4999",
      ]),
    },
    {
      name: 'Two runs each of three, separated by a poor day',
      seedSql: insert('warehouse_deliveries', [
        "1,'2018-01-01',8000", "2,'2018-01-02',8000", "3,'2018-01-03',8000",
        "4,'2018-01-04',45",
        "5,'2018-01-05',9000", "6,'2018-01-06',9000", "7,'2018-01-07',9000",
      ]),
    },
    {
      name: 'One giant delivery cannot form a run alone',
      seedSql: insert('warehouse_deliveries', [
        "1,'2017-04-01',99999", "2,'2017-04-02',50", "3,'2017-04-03',99999",
      ]),
    },
    {
      name: 'Empty table',
      seedSql: '',
    },
    {
      name: 'Non-monotonic delivery quantities across a run of three',
      seedSql: insert('warehouse_deliveries', [
        "1,'2024-05-01',5500", "2,'2024-05-02',5100", "3,'2024-05-03',5900", "4,'2024-05-04',5500",
      ]),
    },
    {
      name: 'Id gaps reset a run even if stock_in stays high',
      seedSql: insert('warehouse_deliveries', [
        "1,'2016-09-01',7000", "2,'2016-09-02',7000", "4,'2016-09-04',7000", "5,'2016-09-05',7000", "6,'2016-09-06',7000",
      ]),
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Problem 189 — Hospital Busy-Stretch Report                          */
/* 3+ consecutive ids where patients_seen >= 150                       */
/* ------------------------------------------------------------------ */
const p189 = {
  id: 'hospital-busy-stretch',
  number: 189,
  title: 'Hospital Busy-Stretch Report',
  difficulty: 'Medium',
  tags: ['Window Function', 'Consecutive ids', 'Operations'],
  description: `Table \`clinic_days\`:

| Column Name   | Type    |
| ------------- | ------- |
| id            | int     |
| clinic_date   | date    |
| patients_seen | int     |

clinic_date is unique for this table. As the id increases, the clinic_date increases as well.

A "busy day" is a day where \`patients_seen >= 150\`.

Write a solution to display the records with **three or more rows with consecutive id's** where each of those rows is a busy day.

Return the result table ordered by \`clinic_date\` in ascending order.

Example:

\`\`\`
Input:
clinic_days:
+----+-------------+---------------+
| id | clinic_date | patients_seen |
+----+-------------+---------------+
| 1  | 2021-01-05  | 200           |
| 2  | 2021-01-06  | 180           |
| 3  | 2021-01-07  | 40            |
| 4  | 2021-01-08  | 190           |
| 5  | 2021-01-09  | 160           |
| 6  | 2021-01-10  | 230           |
+----+-------------+---------------+

Output:
+----+-------------+---------------+
| id | clinic_date | patients_seen |
+----+-------------+---------------+
| 4  | 2021-01-08  | 190           |
| 5  | 2021-01-09  | 160           |
| 6  | 2021-01-10  | 230           |
+----+-------------+---------------+
\`\`\`

Ids 4, 5, 6 form three consecutive busy days. Ids 1-2 are only a pair, so they are excluded.`,
  schemaSql: `CREATE TABLE clinic_days (
  id INTEGER PRIMARY KEY,
  clinic_date TEXT,
  patients_seen INTEGER
);`,
  solutionSql: `WITH busy AS (
  SELECT id, clinic_date, patients_seen,
         id - ROW_NUMBER() OVER (ORDER BY id) AS grp
  FROM clinic_days
  WHERE patients_seen >= 150
)
SELECT id, clinic_date, patients_seen
FROM busy
WHERE grp IN (
  SELECT grp FROM busy GROUP BY grp HAVING COUNT(*) >= 3
)
ORDER BY clinic_date;`,
  hint: 'Busy days are patients_seen >= 150. Filter, build islands with id - ROW_NUMBER() OVER (ORDER BY id), and keep islands of size 3+.',
  outputExplanation: 'Rows with patients_seen >= 150 are kept, grouped into consecutive-id islands. Only islands of length 3 or more are fully returned.',
  tests: [
    {
      name: 'Example',
      seedSql: insert('clinic_days', [
        "1,'2021-01-05',200", "2,'2021-01-06',180", "3,'2021-01-07',40",
        "4,'2021-01-08',190", "5,'2021-01-09',160", "6,'2021-01-10',230",
      ]),
    },
    {
      name: 'Busy run of exactly three in the middle',
      seedSql: insert('clinic_days', [
        "1,'2019-02-01',10", "2,'2019-02-02',160", "3,'2019-02-03',170", "4,'2019-02-04',180", "5,'2019-02-05',20",
      ]),
    },
    {
      name: 'Six consecutive busy days all qualify',
      seedSql: insert('clinic_days', [
        "1,'2018-11-01',200", "2,'2018-11-02',210", "3,'2018-11-03',220", "4,'2018-11-04',230", "5,'2018-11-05',240", "6,'2018-11-06',250",
      ]),
    },
    {
      name: 'Busy days interleaved with slow days never form a run of 3',
      seedSql: insert('clinic_days', [
        "1,'2022-06-01',160", "2,'2022-06-02',10", "3,'2022-06-03',170", "4,'2022-06-04',10", "5,'2022-06-05',180",
      ]),
    },
    {
      name: 'Threshold: exactly 150 patients is busy',
      seedSql: insert('clinic_days', [
        "1,'2020-08-01',150", "2,'2020-08-02',150", "3,'2020-08-03',150", "4,'2020-08-04',149",
      ]),
    },
    {
      name: 'Two adjacent runs with one slow day between them',
      seedSql: insert('clinic_days', [
        "1,'2017-10-01',300", "2,'2017-10-02',310", "3,'2017-10-03',320",
        "4,'2017-10-04',20",
        "5,'2017-10-05',330", "6,'2017-10-06',340", "7,'2017-10-07',350",
      ]),
    },
    {
      name: 'Non-contiguous ids never chain across the gap',
      seedSql: insert('clinic_days', [
        "1,'2016-12-01',200", "2,'2016-12-02',200", "3,'2016-12-03',200", "5,'2016-12-05',200",
      ]),
    },
    {
      name: 'Empty table',
      seedSql: '',
    },
    {
      name: 'Exactly one busy day - obviously nothing qualifies',
      seedSql: insert('clinic_days', [
        "1,'2023-09-01',151", "2,'2023-09-02',100",
      ]),
    },
    {
      name: 'Run at the very start and very end of the table',
      seedSql: insert('clinic_days', [
        "1,'2015-01-01',160", "2,'2015-01-02',161", "3,'2015-01-03',162",
        "4,'2015-01-04',149",
        "5,'2015-01-05',170", "6,'2015-01-06',171", "7,'2015-01-07',172",
      ]),
    },
  ],
};

/* ------------------------------------------------------------------ */
/* Problem 190 — Streaming Marathon Streak                             */
/* 4+ consecutive ids where hours_watched >= 5                          */
/* ------------------------------------------------------------------ */
const p190 = {
  id: 'streaming-marathon-streak',
  number: 190,
  title: 'Streaming Marathon Streak',
  difficulty: 'Medium',
  tags: ['Window Function', 'Consecutive ids', 'User Behaviour'],
  description: `Table \`watch_days\`:

| Column Name | Type    |
| ----------- | ------- |
| id          | int     |
| watch_date  | date    |
| hours_watched | int   |

watch_date is unique for this table. As the id increases, the watch_date increases as well.

A watch_day with "binge status" has \`hours_watched >= 5\`.

Write a solution to display the records with **four or more rows with consecutive id's** where every row in the run has binge status.

Return the result table ordered by \`watch_date\` in ascending order.

Example:

\`\`\`
Input:
watch_days:
+----+------------+---------------+
| id | watch_date | hours_watched |
+----+------------+---------------+
| 1  | 2024-01-01 | 6            |
| 2  | 2024-01-02 | 7            |
| 3  | 2024-01-03 | 8            |
| 4  | 2024-01-04 | 2            |
| 5  | 2024-01-05 | 6            |
| 6  | 2024-01-06 | 6            |
| 7  | 2024-01-07 | 6            |
+----+------------+---------------+

Output:
+----+------------+---------------+
| id | watch_date | hours_watched |
+----+------------+---------------+
| 5  | 2024-01-05 | 6            |
| 6  | 2024-01-06 | 6            |
| 7  | 2024-01-07 | 6            |
| 8  | 2024-01-08 | 7            |
+----+------------+---------------+
\`\`\`

Ids 1-3 form a binge run of three — but three is NOT enough, so they are excluded. Ids 5-8 form a run of **four** consecutive binge days, so all four are returned.

Re-read the requirement: **four or more** consecutive id's.`,
  schemaSql: `CREATE TABLE watch_days (
  id INTEGER PRIMARY KEY,
  watch_date TEXT,
  hours_watched INTEGER
);`,
  solutionSql: `WITH binge AS (
  SELECT id, watch_date, hours_watched,
         id - ROW_NUMBER() OVER (ORDER BY id) AS grp
  FROM watch_days
  WHERE hours_watched >= 5
)
SELECT id, watch_date, hours_watched
FROM binge
WHERE grp IN (
  SELECT grp FROM binge GROUP BY grp HAVING COUNT(*) >= 4
)
ORDER BY watch_date;`,
  hint: 'This one requires FOUR consecutive binge days. Filter to hours_watched >= 5, then keep only islands (id - ROW_NUMBER()) of size 4 or more.',
  outputExplanation: 'In the example the run of ids 1-3 has only three binge days (too short), while ids 5-8 form four — so only ids 5-8 are returned.',
  tests: [
    {
      name: 'Example',
      seedSql: insert('watch_days', [
        "1,'2024-01-01',6", "2,'2024-01-02',7", "3,'2024-01-03',8",
        "4,'2024-01-04',2", "5,'2024-01-05',6", "6,'2024-01-06',6",
        "7,'2024-01-07',6", "8,'2024-01-08',7",
      ]),
    },
    {
      name: 'Exactly four consecutive binge days',
      seedSql: insert('watch_days', [
        "1,'2023-02-01',5", "2,'2023-02-02',5", "3,'2023-02-03',5", "4,'2023-02-04',5", "5,'2023-02-05',1",
      ]),
    },
    {
      name: 'Six binge days - every row qualifies',
      seedSql: insert('watch_days', [
        "1,'2022-05-01',8", "2,'2022-05-02',9", "3,'2022-05-03',10", "4,'2022-05-04',11", "5,'2022-05-05',12", "6,'2022-05-06',13",
      ]),
    },
    {
      name: 'Binge run of four at the very start',
      seedSql: insert('watch_days', [
        "1,'2021-08-01',6", "2,'2021-08-02',6", "3,'2021-08-03',6", "4,'2021-08-04',6", "5,'2021-08-05',1", "6,'2021-08-06',2",
      ]),
    },
    {
      name: 'Binge run of four in the middle only',
      seedSql: insert('watch_days', [
        "1,'2020-03-01',1", "2,'2020-03-02',2", "3,'2020-03-03',6", "4,'2020-03-04',7", "5,'2020-03-05',8", "6,'2020-03-06',9", "7,'2020-03-07',1",
      ]),
    },
    {
      name: 'Exactly on threshold: 5 hours counts as binge',
      seedSql: insert('watch_days', [
        "1,'2019-04-01',5", "2,'2019-04-02',5", "3,'2019-04-03',5", "4,'2019-04-04',5", "5,'2019-04-05',4",
      ]),
    },
    {
      name: 'Empty table',
      seedSql: '',
    },
    {
      name: 'Non-contiguous ids across an id gap',
      seedSql: insert('watch_days', [
        "1,'2018-01-01',8", "2,'2018-01-02',8", "3,'2018-01-03',8", "6,'2018-01-06',8",
      ]),
    },
    {
      name: 'Total binge content: 8 straight binge days',
      seedSql: insert('watch_days', [
        "1,'2017-07-01',6", "2,'2017-07-02',6", "3,'2017-07-03',6", "4,'2017-07-04',6", "5,'2017-07-05',6", "6,'2017-07-06',6", "7,'2017-07-07',6", "8,'2017-07-08',6",
      ]),
    },
  ],
};

for (const def of [p185, p186, p187, p188, p189, p190]) {
  const result = buildProblem(def);
  const file = join(PROBLEMS_DIR, `${String(result.number).padStart(3, '0')}-${result.id}.json`);
  writeFileSync(file, JSON.stringify(result, null, 2) + '\n', 'utf8');
  const sizes = result.tests.map((t) => t.expectedOutput.length);
  console.log(`Wrote ${result.number} ${result.id} — ${result.tests.length} cases, expected row counts: [${sizes.join(', ')}]`);
}
console.log('Done.');