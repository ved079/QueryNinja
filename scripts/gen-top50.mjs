/**
 * Generates the 16 "Top 50 SQL" problems. For each spec it RUNS the solution
 * against each test's seed to derive expectedOutput (so the solution always
 * self-verifies), then writes problems/<NNN>-<slug>.json with top50: true.
 *
 *   node scripts/gen-top50.mjs
 *
 * SQLite only. No WITH RECURSIVE. expectedHash is left for the owner to fill
 * via hash-expected-outputs.mjs (needs the EXPECTED_HASH_SECRET).
 */
import initSqlJs from 'sql.js';
import { registerRegex } from '../web/src/lib/db.js';
import { readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const PROBLEMS_DIR = join(__dirname, '..', 'problems');
const SQL = await initSqlJs();

function run(schemaSql, seedSql, solutionSql) {
  const db = new SQL.Database();
  registerRegex(db);
  db.run(schemaSql);
  if (seedSql) db.run(seedSql);
  let columns = [];
  let rows = [];
  const out = db.exec(solutionSql);
  if (out.length) {
    const last = out[out.length - 1];
    columns = last.columns;
    rows = last.values;
  } else {
    const stmt = db.prepare(solutionSql);
    columns = stmt.getColumnNames();
    stmt.free();
    rows = [];
  }
  db.close();
  return { columns, rows };
}

function expectedFrom(columns, rows) {
  return rows.map((r) => Object.fromEntries(columns.map((c, i) => [c, r[i] === undefined ? null : r[i]])));
}

const existing = new Set((await readdir(PROBLEMS_DIR)).map((f) => f.endsWith('.json') ? f : null).filter(Boolean));

function nextNumber() { return 207; } // assigned manually below

// ---- problem specs ---------------------------------------------------------
const SPECS = [
  {
    number: 191, id: 'customer-referee', title: 'Find Customer Referee',
    difficulty: 'Easy', tags: ['Filtering', 'NULL Handling'],
    description: "Table `customer` lists people and the `referee_id` of whoever referred them.\n\nReturn the `name` of every customer who was **not** referred by the customer with `id = 2`. Customers with no referee (`referee_id IS NULL`) count as \"not referred by 2\" — include them.\n\nOrder does not matter.",
    schemaSql: 'CREATE TABLE customer (id INTEGER PRIMARY KEY, name TEXT, referee_id INTEGER);',
    solutionSql: 'SELECT name FROM customer WHERE referee_id IS NULL OR referee_id <> 2;',
    hint: "In SQL, `referee_id <> 2` is UNKNOWN (treated as false) when referee_id is NULL. You must handle NULL explicitly.",
    orderMatters: false,
    tests: [
      { name: 'mixed — null, 2, 0, others', seedSql: "INSERT INTO customer VALUES (1,'Ava',NULL),(2,'Bob',2),(3,'Cy',3),(4,'Dee',0);" },
      { name: 'all referred by 2 → empty', seedSql: "INSERT INTO customer VALUES (1,'A',2),(2,'B',2);" },
      { name: 'all null → all returned', seedSql: "INSERT INTO customer VALUES (1,'A',NULL),(2,'B',NULL);" },
      { name: 'referee 0 distinct from null', seedSql: "INSERT INTO customer VALUES (1,'A',0),(2,'B',NULL),(3,'C',2);" },
      { name: 'multiple nulls and multiple 2s', seedSql: "INSERT INTO customer VALUES (1,'A',NULL),(2,'B',2),(3,'C',NULL),(4,'D',2),(5,'E',5);" },
      { name: 'empty table → empty result' },
      { name: 'single null customer', seedSql: "INSERT INTO customer VALUES (7,'Solo',NULL);" },
      { name: 'various referees', seedSql: "INSERT INTO customer VALUES (1,'A',1),(2,'B',2),(3,'C',3),(4,'D',NULL),(5,'E',2),(6,'F',7);" },
    ],
  },
  {
    number: 192, id: 'trips-cancellation-rate', title: 'Trips and Users — Cancellation Rate',
    difficulty: 'Hard', tags: ['Join', 'Date', 'Conditional Aggregation'],
    description: "Tables `trips` and `users`. The cancellation rate of unbanned-client trips on a given day is `cancelled / total` (cancelled = status starts with 'cancelled').\n\nFor each day in **2013-10-01 .. 2013-10-03** that has at least one qualifying trip (both the client and the driver are **not banned**), report `day` and `cancellation_rate` rounded to 2 decimals. Days with only banned participants are absent from the result.",
    schemaSql: 'CREATE TABLE trips (id INTEGER, client_id INTEGER, driver_id INTEGER, status TEXT, request_at TEXT);\nCREATE TABLE users (users_id INTEGER, banned TEXT, role TEXT);',
    solutionSql: "SELECT request_at AS day, ROUND(SUM(CASE WHEN status LIKE 'cancelled%' THEN 1 ELSE 0 END) * 1.0 / COUNT(*), 2) AS cancellation_rate FROM trips WHERE request_at BETWEEN '2013-10-01' AND '2013-10-03' AND client_id IN (SELECT users_id FROM users WHERE banned = 'No' AND role = 'client') AND driver_id IN (SELECT users_id FROM users WHERE banned = 'No' AND role = 'driver') GROUP BY request_at;",
    hint: "Filter the date range AND the banned status of BOTH the client and the driver before grouping. Use LIKE 'cancelled%' to catch both cancellation causes.",
    orderMatters: false,
    tests: [
      { name: 'basic mix oct1-3', seedSql: "INSERT INTO users VALUES (1,'No','client'),(2,'No','client'),(3,'Yes','client'),(4,'No','driver'),(5,'No','driver'),(6,'Yes','driver');\nINSERT INTO trips VALUES (1,1,4,'completed','2013-10-01'),(2,1,4,'cancelled_by_client','2013-10-01'),(3,2,5,'completed','2013-10-02'),(4,1,4,'cancelled_by_driver','2013-10-03');" },
      { name: 'banned client excluded', seedSql: "INSERT INTO users VALUES (1,'No','client'),(3,'Yes','client'),(4,'No','driver');\nINSERT INTO trips VALUES (1,3,4,'cancelled_by_client','2013-10-01'),(2,1,4,'completed','2013-10-01');" },
      { name: 'banned driver excluded', seedSql: "INSERT INTO users VALUES (1,'No','client'),(6,'Yes','driver'),(4,'No','driver');\nINSERT INTO trips VALUES (1,1,6,'cancelled_by_client','2013-10-01'),(2,1,4,'completed','2013-10-01');" },
      { name: 'days out of range excluded', seedSql: "INSERT INTO users VALUES (1,'No','client'),(4,'No','driver');\nINSERT INTO trips VALUES (1,1,4,'completed','2013-09-30'),(2,1,4,'cancelled_by_client','2013-10-04');" },
      { name: 'boundary days included', seedSql: "INSERT INTO users VALUES (1,'No','client'),(4,'No','driver');\nINSERT INTO trips VALUES (1,1,4,'completed','2013-10-01'),(2,1,4,'cancelled_by_client','2013-10-03');" },
      { name: 'all cancelled one day', seedSql: "INSERT INTO users VALUES (1,'No','client'),(2,'No','client'),(4,'No','driver'),(5,'No','driver');\nINSERT INTO trips VALUES (1,1,4,'cancelled_by_client','2013-10-01'),(2,2,5,'cancelled_by_driver','2013-10-01');" },
      { name: 'all banned → day absent', seedSql: "INSERT INTO users VALUES (3,'Yes','client'),(6,'Yes','driver');\nINSERT INTO trips VALUES (1,3,6,'cancelled_by_client','2013-10-01');" },
      { name: 'empty trips → empty', seedSql: "INSERT INTO users VALUES (1,'No','client'),(4,'No','driver');" },
    ],
  },
  {
    number: 193, id: 'salesperson-no-red', title: 'Sales Person — No RED Order',
    difficulty: 'Medium', tags: ['Anti-Join', 'Subquery'],
    description: "Tables `salesperson`, `company`, `orders`. Return the `name` of every salesperson who has **zero** orders tied to a company named `'RED'`. A salesperson with some non-RED orders AND a RED order is excluded; one with no orders at all is included.",
    schemaSql: 'CREATE TABLE salesperson (sales_id INTEGER, name TEXT);\nCREATE TABLE company (com_id INTEGER, name TEXT);\nCREATE TABLE orders (order_id INTEGER, com_id INTEGER, sales_id INTEGER);',
    solutionSql: "SELECT name FROM salesperson WHERE sales_id NOT IN (SELECT o.sales_id FROM orders o JOIN company c ON o.com_id = c.com_id WHERE c.name = 'RED');",
    hint: "NOT IN against the set of sales_ids that have any RED order. NULL safety: sales_ids are not null here, so NOT IN is fine.",
    orderMatters: false,
    tests: [
      { name: 'basic — only BLUE salesperson passes', seedSql: "INSERT INTO salesperson VALUES (1,'Ava'),(2,'Bob'),(3,'Cy');\nINSERT INTO company VALUES (1,'RED'),(2,'BLUE');\nINSERT INTO orders VALUES (1,1,1),(2,2,2),(3,1,3);" },
      { name: 'no orders at all → all included', seedSql: "INSERT INTO salesperson VALUES (1,'Ava'),(2,'Bob');\nINSERT INTO company VALUES (1,'RED');" },
      { name: 'mixed red and non-red → excluded', seedSql: "INSERT INTO salesperson VALUES (1,'Ava'),(2,'Bob'),(3,'Cy');\nINSERT INTO company VALUES (1,'RED'),(2,'BLUE');\nINSERT INTO orders VALUES (1,2,1),(2,1,1),(3,2,2);" },
      { name: 'only red company → empty', seedSql: "INSERT INTO salesperson VALUES (1,'Ava');\nINSERT INTO company VALUES (1,'RED');\nINSERT INTO orders VALUES (1,1,1);" },
      { name: 'multiple non-red companies → all pass', seedSql: "INSERT INTO salesperson VALUES (1,'Ava'),(2,'Bob');\nINSERT INTO company VALUES (1,'BLUE'),(2,'GREEN');\nINSERT INTO orders VALUES (1,1,1),(2,2,2);" },
      { name: 'empty salesperson → empty', seedSql: "INSERT INTO company VALUES (1,'RED');" },
      { name: 'red order by another → only the clean one', seedSql: "INSERT INTO salesperson VALUES (1,'Ava'),(2,'Bob');\nINSERT INTO company VALUES (1,'RED');\nINSERT INTO orders VALUES (1,1,2);" },
      { name: 'same salesperson multiple red orders', seedSql: "INSERT INTO salesperson VALUES (1,'Ava'),(2,'Bob');\nINSERT INTO company VALUES (1,'RED');\nINSERT INTO orders VALUES (1,1,1),(2,1,1);" },
    ],
  },
  {
    number: 194, id: 'market-analysis', title: 'Market Analysis I',
    difficulty: 'Medium', tags: ['Left Join', 'Aggregation'],
    description: "Tables `users`, `orders`, `items`. For **every** user, report `user_id`, `join_date`, and the count of orders they placed in **2019** (`orders_in_2019`). Users with no 2019 orders still appear with a count of 0.",
    schemaSql: 'CREATE TABLE users (user_id INTEGER, join_date TEXT, favorite_brand TEXT);\nCREATE TABLE orders (order_id INTEGER, order_date TEXT, item_id INTEGER, buyer_id INTEGER);\nCREATE TABLE items (item_id INTEGER, item_brand TEXT);',
    solutionSql: "SELECT u.user_id AS user_id, u.join_date AS join_date, COUNT(o.order_id) AS orders_in_2019 FROM users u LEFT JOIN orders o ON o.buyer_id = u.user_id AND o.order_date LIKE '2019%' GROUP BY u.user_id, u.join_date;",
    hint: "Put the 2019 filter in the JOIN ON clause, not WHERE — otherwise LEFT JOIN drops users with no 2019 orders.",
    orderMatters: false,
    tests: [
      { name: 'basic 2019 vs 2020', seedSql: "INSERT INTO users VALUES (1,'2019-01-01','A'),(2,'2018-01-01','B');\nINSERT INTO orders VALUES (1,'2019-05-05',10,1),(2,'2020-01-01',10,2);" },
      { name: 'no orders → count 0', seedSql: "INSERT INTO users VALUES (1,'2019-01-01','A');" },
      { name: 'order in 2018 not 2019', seedSql: "INSERT INTO users VALUES (1,'2019-01-01','A');\nINSERT INTO orders VALUES (1,'2018-12-31',10,1);" },
      { name: 'multiple 2019 orders', seedSql: "INSERT INTO users VALUES (1,'2019-01-01','A');\nINSERT INTO orders VALUES (1,'2019-01-01',10,1),(2,'2019-12-31',10,1),(3,'2020-01-01',10,1);" },
      { name: '2019 boundary days', seedSql: "INSERT INTO users VALUES (1,'2019-01-01','A');\nINSERT INTO orders VALUES (1,'2019-01-01',10,1),(2,'2019-12-31',10,1),(3,'2018-12-31',10,1),(4,'2020-01-01',10,1);" },
      { name: 'multiple users mixed', seedSql: "INSERT INTO users VALUES (1,'2019-01-01','A'),(2,'2019-01-01','B'),(3,'2019-01-01','C');\nINSERT INTO orders VALUES (1,'2019-01-01',10,1),(2,'2019-01-01',10,2),(3,'2018-01-01',10,3);" },
      { name: 'empty users → empty' },
      { name: 'order with null date', seedSql: "INSERT INTO users VALUES (1,'2019-01-01','A');\nINSERT INTO orders VALUES (1,NULL,10,1);" },
    ],
  },
  {
    number: 195, id: 'classes-five-students', title: 'Classes More Than 5 Students',
    difficulty: 'Easy', tags: ['Group By', 'Having', 'Distinct'],
    description: "Table `courses` pairs a `student` with a `class`. A student may appear in the same class more than once (duplicate enrolment rows). List every `class` that has **at least 5 distinct** students.",
    schemaSql: 'CREATE TABLE courses (student TEXT, class TEXT);',
    solutionSql: 'SELECT class FROM courses GROUP BY class HAVING COUNT(DISTINCT student) >= 5;',
    hint: "COUNT(*) would be fooled by duplicate enrolment rows. Use COUNT(DISTINCT student).",
    orderMatters: false,
    tests: [
      { name: 'exactly 5 distinct', seedSql: "INSERT INTO courses VALUES ('a','Math'),('b','Math'),('c','Math'),('d','Math'),('e','Math');" },
      { name: '4 distinct + 1 duplicate → excluded', seedSql: "INSERT INTO courses VALUES ('a','Math'),('a','Math'),('b','Math'),('c','Math'),('d','Math');" },
      { name: '5 distinct + duplicates → included', seedSql: "INSERT INTO courses VALUES ('a','Math'),('a','Math'),('b','Math'),('b','Math'),('c','Math'),('d','Math'),('e','Math');" },
      { name: 'two classes, one qualifies', seedSql: "INSERT INTO courses VALUES ('a','Math'),('b','Math'),('c','Math'),('d','Math'),('e','Math'),('a','Sci'),('b','Sci'),('c','Sci'),('d','Sci');" },
      { name: 'tie — both qualify', seedSql: "INSERT INTO courses VALUES ('a','Math'),('b','Math'),('c','Math'),('d','Math'),('e','Math'),('f','Math'),('a','Sci'),('b','Sci'),('c','Sci'),('d','Sci'),('e','Sci'),('f','Sci'),('g','Sci');" },
      { name: 'empty table → empty' },
      { name: '5 rows all same student → excluded', seedSql: "INSERT INTO courses VALUES ('a','Math'),('a','Math'),('a','Math'),('a','Math'),('a','Math');" },
      { name: 'boundary — 5 vs 4 distinct', seedSql: "INSERT INTO courses VALUES ('a','Math'),('b','Math'),('c','Math'),('d','Math'),('e','Math'),('a','Sci'),('b','Sci'),('c','Sci'),('d','Sci');" },
    ],
  },
  {
    number: 196, id: 'customer-most-orders', title: 'Customer Placing the Largest Number of Orders',
    difficulty: 'Easy', tags: ['Aggregation', 'Argmax', 'Ties'],
    description: "Table `orders`. Return the `customer_number` of the customer(s) with the most orders. **If multiple customers tie at the maximum, return all of them.**",
    schemaSql: 'CREATE TABLE orders (order_number INTEGER, customer_number INTEGER);',
    solutionSql: 'SELECT customer_number FROM orders GROUP BY customer_number HAVING COUNT(*) = (SELECT COUNT(*) c FROM orders GROUP BY customer_number ORDER BY c DESC LIMIT 1);',
    hint: "A subquery finds the max order count; HAVING keeps every customer whose count equals that max (handles ties).",
    orderMatters: false,
    tests: [
      { name: 'clear winner', seedSql: "INSERT INTO orders VALUES (1,1),(2,1),(3,1),(4,2),(5,2),(6,3);" },
      { name: 'tie at top → both', seedSql: "INSERT INTO orders VALUES (1,1),(2,1),(3,1),(4,2),(5,2),(6,2);" },
      { name: 'single customer', seedSql: "INSERT INTO orders VALUES (1,1),(2,1),(3,1),(4,1),(5,1);" },
      { name: 'all tie at 1 → all', seedSql: "INSERT INTO orders VALUES (1,1),(2,2),(3,3);" },
      { name: 'empty table → empty' },
      { name: 'one with many, one with few', seedSql: "INSERT INTO orders VALUES (1,1),(2,1),(3,1),(4,1),(5,1),(6,1),(7,1),(8,1),(9,1),(10,1),(11,2);" },
      { name: 'two tie, one fewer', seedSql: "INSERT INTO orders VALUES (1,1),(2,1),(3,1),(4,1),(5,2),(6,2),(7,2),(8,2),(9,3),(10,3),(11,3);" },
      { name: 'all same count 2 → all', seedSql: "INSERT INTO orders VALUES (1,1),(2,1),(3,2),(4,2),(5,3),(6,3),(7,4),(8,4);" },
    ],
  },
  {
    number: 197, id: 'average-selling-price', title: 'Average Selling Price',
    difficulty: 'Easy', tags: ['Join', 'Weighted Average', 'Date'],
    description: "Tables `prices` (product_id, start_date, end_date, price) and `unitssold` (product_id, purchase_date, units). The average selling price of a product is `SUM(price * units) / SUM(units)` across all sales whose purchase_date falls inside a price window.\n\nReturn `product_id` and `average_price` rounded to 2 decimals. Products with no sales are excluded.",
    schemaSql: 'CREATE TABLE prices (product_id INTEGER, start_date TEXT, end_date TEXT, price REAL);\nCREATE TABLE unitssold (product_id INTEGER, purchase_date TEXT, units INTEGER);',
    solutionSql: "SELECT p.product_id AS product_id, ROUND(SUM(p.price * u.units) * 1.0 / SUM(u.units), 2) AS average_price FROM prices p JOIN unitssold u ON u.product_id = p.product_id AND u.purchase_date BETWEEN p.start_date AND p.end_date GROUP BY p.product_id;",
    hint: "Join on product AND the sale date within the price window. SUM(price*units)/SUM(units) is a weighted average — different from AVG(price).",
    orderMatters: false,
    tests: [
      { name: 'weighted ≠ simple avg', seedSql: "INSERT INTO prices VALUES (1,'2019-01-01','2019-06-30',10),(1,'2019-07-01','2019-12-31',20);\nINSERT INTO unitssold VALUES (1,'2019-02-01',100),(1,'2019-08-01',50);" },
      { name: 'no sales → excluded', seedSql: "INSERT INTO prices VALUES (1,'2019-01-01','2019-12-31',5);" },
      { name: 'single sale', seedSql: "INSERT INTO prices VALUES (1,'2019-01-01','2019-12-31',10);\nINSERT INTO unitssold VALUES (1,'2019-06-01',5);" },
      { name: 'date window boundaries', seedSql: "INSERT INTO prices VALUES (1,'2019-01-01','2019-01-31',10);\nINSERT INTO unitssold VALUES (1,'2019-01-01',5),(1,'2019-01-31',5);" },
      { name: 'sale outside any window → excluded', seedSql: "INSERT INTO prices VALUES (1,'2019-01-01','2019-01-31',10),(1,'2019-03-01','2019-03-31',20);\nINSERT INTO unitssold VALUES (1,'2019-02-15',5);" },
      { name: 'two products', seedSql: "INSERT INTO prices VALUES (1,'2019-01-01','2019-12-31',10),(2,'2019-01-01','2019-12-31',5);\nINSERT INTO unitssold VALUES (1,'2019-06-01',10),(2,'2019-06-01',20);" },
      { name: 'two windows same product', seedSql: "INSERT INTO prices VALUES (1,'2019-01-01','2019-06-30',10),(1,'2019-07-01','2019-12-31',20);\nINSERT INTO unitssold VALUES (1,'2019-03-01',5),(1,'2019-09-01',5);" },
      { name: 'all same price', seedSql: "INSERT INTO prices VALUES (1,'2019-01-01','2019-12-31',5);\nINSERT INTO unitssold VALUES (1,'2019-02-01',10),(1,'2019-05-01',20);" },
    ],
  },
  {
    number: 198, id: 'active-businesses', title: 'Active Businesses',
    difficulty: 'Medium', tags: ['Window Function', 'Rank', 'Aggregation'],
    description: "Table `events` (business_id, event_type, occurrences). For each `event_type`, the business(es) with the largest total occurrences are 'active' for that type.\n\nReturn the `business_id` of every business that is active for **at least one** event type (deduplicated). Ties for the top of a type mean every tied business is active.",
    schemaSql: 'CREATE TABLE events (business_id INTEGER, event_type TEXT, day INTEGER, occurrences INTEGER);',
    solutionSql: "WITH t AS (SELECT business_id, event_type, SUM(occurrences) AS total FROM events GROUP BY business_id, event_type) SELECT business_id FROM (SELECT business_id, RANK() OVER (PARTITION BY event_type ORDER BY total DESC) AS rnk FROM t) WHERE rnk = 1 GROUP BY business_id;",
    hint: "First sum occurrences per (business, type), then RANK() partitioned by event_type. RANK=1 keeps ties. DISTINCT business_id collapses multi-type actives.",
    orderMatters: false,
    tests: [
      { name: 'clear winner per type', seedSql: "INSERT INTO events VALUES (1,'A',1,10),(2,'A',1,5),(2,'B',1,8),(3,'B',1,3);" },
      { name: 'tie in one type → both active', seedSql: "INSERT INTO events VALUES (1,'A',1,10),(2,'A',1,10),(3,'A',1,5);" },
      { name: 'single business single type', seedSql: "INSERT INTO events VALUES (1,'A',1,5);" },
      { name: 'multiple events same business+type sum', seedSql: "INSERT INTO events VALUES (1,'A',1,5),(1,'A',2,5),(2,'A',1,8);" },
      { name: 'active in multiple types → distinct', seedSql: "INSERT INTO events VALUES (1,'A',1,10),(1,'B',1,8),(2,'A',1,5);" },
      { name: 'empty → empty' },
      { name: 'all tie at top', seedSql: "INSERT INTO events VALUES (1,'A',1,5),(2,'A',1,5);" },
      { name: 'partition boundary — A and Z', seedSql: "INSERT INTO events VALUES (1,'A',1,1),(1,'Z',1,9),(2,'A',1,9),(2,'Z',1,1);" },
    ],
  },
  {
    number: 199, id: 'nth-highest-salary', title: 'Nth Highest Salary',
    difficulty: 'Medium', tags: ['Window Function', 'Dense Rank', 'NULL Handling'],
    description: "Table `employee` (id, salary). Return a single row with the **3rd-highest distinct salary** (`nth_highest_salary`). If there are fewer than 3 distinct salaries, return `NULL`.\n\nThe same DENSE_RANK pattern works for any N — just change the rank filter.",
    schemaSql: 'CREATE TABLE employee (id INTEGER PRIMARY KEY, salary INTEGER);',
    solutionSql: "SELECT (SELECT salary FROM (SELECT DISTINCT salary, DENSE_RANK() OVER (ORDER BY salary DESC) AS rnk FROM employee) WHERE rnk = 3) AS nth_highest_salary;",
    hint: "DENSE_RANK over DISTINCT salaries ranks each distinct value 1, 2, 3, .... Filter rnk = 3. A scalar subquery returns NULL when no row matches.",
    orderMatters: false,
    tests: [
      { name: 'basic 3rd', seedSql: "INSERT INTO employee VALUES (1,100),(2,200),(3,300),(4,400);" },
      { name: 'ties at top', seedSql: "INSERT INTO employee VALUES (1,300),(2,300),(3,200),(4,100);" },
      { name: 'fewer than 3 distinct → null', seedSql: "INSERT INTO employee VALUES (1,100),(2,100),(3,100);" },
      { name: 'exactly 3 distinct', seedSql: "INSERT INTO employee VALUES (1,300),(2,200),(3,100);" },
      { name: 'empty table → null' },
      { name: '5 distinct', seedSql: "INSERT INTO employee VALUES (1,500),(2,400),(3,300),(4,200),(5,100);" },
      { name: 'ties at 3rd', seedSql: "INSERT INTO employee VALUES (1,400),(2,300),(3,300),(4,200),(5,100);" },
      { name: 'single salary → null', seedSql: "INSERT INTO employee VALUES (1,100);" },
    ],
  },
  {
    number: 200, id: 'students-geography', title: 'Students Report by Geography',
    difficulty: 'Hard', tags: ['Pivot', 'Window Function', 'Case'],
    description: "Table `student` (student_id, name, continent). Pivot students so each row holds one student per continent — columns `America`, `Asia`, `Europe` — in `student_id` order within each continent. Where a continent has fewer students than the current row, the cell is `NULL`.",
    schemaSql: 'CREATE TABLE student (student_id INTEGER, name TEXT, continent TEXT);',
    solutionSql: "SELECT MAX(CASE WHEN continent = 'America' THEN name END) AS America, MAX(CASE WHEN continent = 'Asia' THEN name END) AS Asia, MAX(CASE WHEN continent = 'Europe' THEN name END) AS Europe FROM (SELECT name, continent, ROW_NUMBER() OVER (PARTITION BY continent ORDER BY student_id) AS rn FROM student) t GROUP BY rn;",
    hint: "ROW_NUMBER partitioned by continent gives each student a per-continent row index. Then MAX(CASE ...) pivots: each group (rn) collapses one student per continent.",
    orderMatters: false,
    tests: [
      { name: 'basic balanced', seedSql: "INSERT INTO student VALUES (1,'Ava','America'),(2,'Bo','Asia'),(3,'Cy','Europe'),(4,'Dee','America'),(5,'Eli','Asia'),(6,'Fox','Europe');" },
      { name: 'uneven — america has more', seedSql: "INSERT INTO student VALUES (1,'Ava','America'),(2,'Bo','America'),(3,'Cy','Asia'),(4,'Dee','Europe');" },
      { name: 'missing continent — no Asia', seedSql: "INSERT INTO student VALUES (1,'Ava','America'),(2,'Bo','Europe');" },
      { name: 'single continent', seedSql: "INSERT INTO student VALUES (1,'Ava','America'),(2,'Bo','America');" },
      { name: 'empty → empty' },
      { name: 'one student each', seedSql: "INSERT INTO student VALUES (1,'Ava','America'),(2,'Bo','Asia'),(3,'Cy','Europe');" },
      { name: 'order by student_id within continent', seedSql: "INSERT INTO student VALUES (1,'Zed','America'),(2,'Amy','America');" },
      { name: 'all same continent', seedSql: "INSERT INTO student VALUES (1,'A','Asia'),(2,'B','Asia'),(3,'C','Asia');" },
    ],
  },
  {
    number: 201, id: 'year-month-revenue-matrix', title: 'Year × Month Revenue Matrix',
    difficulty: 'Medium', tags: ['Pivot', 'Conditional Aggregation', 'Date'],
    description: "Table `orders` (order_date, revenue). Pivot monthly revenue into one row per year with twelve columns `Jan` .. `Dec`. A month with no orders shows `0` (not NULL). NULL revenues are treated as 0.",
    schemaSql: 'CREATE TABLE orders (order_date TEXT, revenue REAL);',
    solutionSql: "SELECT strftime('%Y', order_date) AS year, COALESCE(SUM(CASE WHEN strftime('%m', order_date)='01' THEN revenue END),0) AS Jan, COALESCE(SUM(CASE WHEN strftime('%m', order_date)='02' THEN revenue END),0) AS Feb, COALESCE(SUM(CASE WHEN strftime('%m', order_date)='03' THEN revenue END),0) AS Mar, COALESCE(SUM(CASE WHEN strftime('%m', order_date)='04' THEN revenue END),0) AS Apr, COALESCE(SUM(CASE WHEN strftime('%m', order_date)='05' THEN revenue END),0) AS May, COALESCE(SUM(CASE WHEN strftime('%m', order_date)='06' THEN revenue END),0) AS Jun, COALESCE(SUM(CASE WHEN strftime('%m', order_date)='07' THEN revenue END),0) AS Jul, COALESCE(SUM(CASE WHEN strftime('%m', order_date)='08' THEN revenue END),0) AS Aug, COALESCE(SUM(CASE WHEN strftime('%m', order_date)='09' THEN revenue END),0) AS Sep, COALESCE(SUM(CASE WHEN strftime('%m', order_date)='10' THEN revenue END),0) AS Oct, COALESCE(SUM(CASE WHEN strftime('%m', order_date)='11' THEN revenue END),0) AS Nov, COALESCE(SUM(CASE WHEN strftime('%m', order_date)='12' THEN revenue END),0) AS Dec FROM orders GROUP BY strftime('%Y', order_date);",
    hint: "strftime('%m', date) extracts the month as 01..12. SUM(CASE WHEN month=... THEN revenue END) per column; COALESCE(...,0) turns a month with no rows (or all-NULL revenue) into 0.",
    orderMatters: false,
    tests: [
      { name: 'single year single month', seedSql: "INSERT INTO orders VALUES ('2023-01-15',100);" },
      { name: 'two years', seedSql: "INSERT INTO orders VALUES ('2023-01-15',100),('2024-02-15',200);" },
      { name: 'months with no data → 0', seedSql: "INSERT INTO orders VALUES ('2023-01-15',100),('2023-03-15',300),('2023-12-15',1200);" },
      { name: 'multiple months same year', seedSql: "INSERT INTO orders VALUES ('2023-01-15',100),('2023-03-15',300),('2023-12-15',1200);" },
      { name: 'empty → empty' },
      { name: 'NULL revenue → 0', seedSql: "INSERT INTO orders VALUES ('2023-01-15',NULL);" },
      { name: 'multiple orders same month sum', seedSql: "INSERT INTO orders VALUES ('2023-01-01',100),('2023-01-31',50);" },
      { name: 'december boundary across years', seedSql: "INSERT INTO orders VALUES ('2023-12-31',100),('2024-01-01',200);" },
    ],
  },
  {
    number: 202, id: 'consecutive-seats', title: 'Consecutive Available Seats',
    difficulty: 'Medium', tags: ['Gaps and Islands', 'Window Function'],
    description: "Table `cinema` (seat_id, free) where `free = 1` means available and seat_id values are consecutive integers. Return every available seat that is part of a run of **two or more** adjacent available seats, ordered by seat_id.\n\nIsland boundary cases: a lone available seat (no available neighbour) is excluded; a single-row gap between two runs keeps them as two islands.",
    schemaSql: 'CREATE TABLE cinema (seat_id INTEGER, free INTEGER);',
    solutionSql: "WITH g AS (SELECT seat_id, seat_id - ROW_NUMBER() OVER (ORDER BY seat_id) AS grp FROM cinema WHERE free = 1) SELECT seat_id FROM g WHERE grp IN (SELECT grp FROM g GROUP BY grp HAVING COUNT(*) > 1) ORDER BY seat_id;",
    hint: "For available seats, seat_id - ROW_NUMBER() is constant within a consecutive run (an island). Keep only seats whose island has more than one member.",
    orderMatters: true,
    tests: [
      { name: 'two consecutive free', seedSql: "INSERT INTO cinema VALUES (1,0),(2,1),(3,1),(4,0);" },
      { name: 'single free alone → excluded', seedSql: "INSERT INTO cinema VALUES (1,1),(2,0),(3,1);" },
      { name: 'three in a row', seedSql: "INSERT INTO cinema VALUES (1,1),(2,1),(3,1),(4,0);" },
      { name: 'gap of 1 between two islands', seedSql: "INSERT INTO cinema VALUES (1,1),(2,1),(3,0),(4,1),(5,1);" },
      { name: 'all free', seedSql: "INSERT INTO cinema VALUES (1,1),(2,1),(3,1);" },
      { name: 'none free → empty', seedSql: "INSERT INTO cinema VALUES (1,0),(2,0);" },
      { name: 'two separate pairs', seedSql: "INSERT INTO cinema VALUES (1,1),(2,1),(3,0),(4,1),(5,1),(6,0),(7,1),(8,1);" },
      { name: 'single free at end → excluded', seedSql: "INSERT INTO cinema VALUES (1,0),(2,0),(3,1);" },
    ],
  },
  {
    number: 203, id: 'island-ranges', title: 'Group Consecutive Rows into Islands',
    difficulty: 'Hard', tags: ['Gaps and Islands', 'Window Function'],
    description: "Table `events` (id, status) where id values are consecutive integers and status is 'active' or 'inactive'. For every maximal run of consecutive `active` rows, output `start_id` and `end_id`, ordered by start_id.\n\nBoundary cases: a single active row is an island of size one (start = end); a one-row gap splits two islands.",
    schemaSql: 'CREATE TABLE events (id INTEGER, status TEXT);',
    solutionSql: "WITH g AS (SELECT id, id - ROW_NUMBER() OVER (ORDER BY id) AS grp FROM events WHERE status = 'active') SELECT MIN(id) AS start_id, MAX(id) AS end_id FROM g GROUP BY grp ORDER BY start_id;",
    hint: "For active rows, id - ROW_NUMBER() is constant within a consecutive run. Group by it, take MIN/MAX(id).",
    orderMatters: true,
    tests: [
      { name: 'one island', seedSql: "INSERT INTO events VALUES (1,'active'),(2,'active'),(3,'active'),(4,'active'),(5,'active');" },
      { name: 'two islands', seedSql: "INSERT INTO events VALUES (1,'active'),(2,'active'),(3,'inactive'),(4,'active'),(5,'active');" },
      { name: 'single-element island', seedSql: "INSERT INTO events VALUES (1,'inactive'),(2,'active'),(3,'inactive');" },
      { name: 'gap of exactly 1', seedSql: "INSERT INTO events VALUES (1,'active'),(2,'active'),(3,'inactive'),(4,'active'),(5,'active');" },
      { name: 'all inactive → empty', seedSql: "INSERT INTO events VALUES (1,'inactive'),(2,'inactive');" },
      { name: 'all active', seedSql: "INSERT INTO events VALUES (1,'active'),(2,'active'),(3,'active'),(4,'active');" },
      { name: 'alternating — size-1 islands', seedSql: "INSERT INTO events VALUES (1,'active'),(2,'inactive'),(3,'active'),(4,'inactive'),(5,'active');" },
      { name: 'single active at start', seedSql: "INSERT INTO events VALUES (1,'active'),(2,'inactive'),(3,'inactive');" },
    ],
  },
  {
    number: 204, id: 'missing-numbers', title: 'Find Missing Numbers in a Sequence',
    difficulty: 'Medium', tags: ['Sequence', 'Anti-Join', 'Gaps and Islands'],
    description: "Table `seq` holds a subset of the integers 1..max(id). Return every integer in 1..max(id) that does **not** appear as an id, ordered ascending.\n\nNo `GENERATE_SERIES` and no `WITH RECURSIVE` — generate the candidate numbers with a non-recursive cross-join CTE over the digits 0..9.",
    schemaSql: 'CREATE TABLE seq (id INTEGER);',
    solutionSql: "WITH digits AS (SELECT 0 AS v UNION ALL SELECT 1 UNION ALL SELECT 2 UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6 UNION ALL SELECT 7 UNION ALL SELECT 8 UNION ALL SELECT 9), nums AS (SELECT a.v + b.v*10 + c.v*100 + 1 AS n FROM digits a, digits b, digits c) SELECT n AS missing_number FROM nums WHERE n <= (SELECT MAX(id) FROM seq) AND n NOT IN (SELECT id FROM seq) ORDER BY n;",
    hint: "Build a numbers CTE by cross-joining the digits 0..9 three times (covers 1..1000). Then anti-join: keep n not in seq, up to MAX(id).",
    orderMatters: true,
    tests: [
      { name: 'missing middle', seedSql: "INSERT INTO seq VALUES (1),(2),(4),(5);" },
      { name: 'no missing', seedSql: "INSERT INTO seq VALUES (1),(2),(3),(4),(5);" },
      { name: 'missing multiple', seedSql: "INSERT INTO seq VALUES (1),(3),(5),(7);" },
      { name: 'missing first', seedSql: "INSERT INTO seq VALUES (2),(3),(4);" },
      { name: 'missing last — none (max=3)', seedSql: "INSERT INTO seq VALUES (1),(2),(3);" },
      { name: 'single id → 1..4 missing', seedSql: "INSERT INTO seq VALUES (5);" },
      { name: 'empty table → empty', seedSql: "" },
      { name: 'consecutive gap then present', seedSql: "INSERT INTO seq VALUES (1),(2),(3),(7),(8);" },
    ],
  },
  {
    number: 205, id: 'second-degree-follower', title: 'Second Degree Follower',
    difficulty: 'Medium', tags: ['Self-Join', 'Anti-Join', 'Distinct'],
    description: "Table `follow` (follower, followee) means `follower` follows `followee`. A **second-degree followee** of user X is a user Z reachable in two hops (X → Y → Z) who is NOT X themself and NOT already directly followed by X.\n\nReturn each `(follower, second_degree)` pair, deduplicated, ordered by follower then second_degree.",
    schemaSql: 'CREATE TABLE follow (follower INTEGER, followee INTEGER);',
    solutionSql: "SELECT DISTINCT f1.follower AS follower, f2.followee AS second_degree FROM follow f1 JOIN follow f2 ON f1.followee = f2.follower WHERE f2.followee <> f1.follower AND f2.followee NOT IN (SELECT followee FROM follow WHERE follower = f1.follower) ORDER BY f1.follower, f2.followee;",
    hint: "Two-hop reachability: f1 (X→Y) JOIN f2 (Y→Z). Exclude Z=X and Z already directly followed by X (anti-join). DISTINCT collapses Z reachable via multiple Y.",
    orderMatters: true,
    tests: [
      { name: 'basic 2-hop', seedSql: "INSERT INTO follow VALUES (1,2),(2,3);" },
      { name: 'exclude self', seedSql: "INSERT INTO follow VALUES (1,2),(2,1);" },
      { name: 'exclude direct followee (anti-join)', seedSql: "INSERT INTO follow VALUES (1,2),(2,3),(1,3);" },
      { name: 'multiple paths → dedup', seedSql: "INSERT INTO follow VALUES (1,2),(2,3),(1,4),(4,3);" },
      { name: 'no 2-hop', seedSql: "INSERT INTO follow VALUES (1,2),(3,4);" },
      { name: 'empty → empty', seedSql: "" },
      { name: 'chain of 3', seedSql: "INSERT INTO follow VALUES (1,2),(2,3),(3,4);" },
      { name: 'one excluded, one kept', seedSql: "INSERT INTO follow VALUES (1,2),(2,3),(2,4),(1,4);" },
    ],
  },
  {
    number: 206, id: 'tree-node', title: 'Tree Node Classification',
    difficulty: 'Medium', tags: ['Hierarchy', 'Exists', 'Case'],
    description: "Table `tree` (id, p_id) describes a tree: `p_id` is the parent id (NULL for a root). Classify each node:\n- **Root** — p_id is NULL\n- **Inner** — has a parent AND has at least one child\n- **Leaf** — has a parent but no children\n\nReturn `id` and `type`. An inner node is simultaneously someone's child and someone's parent — it must be 'Inner', never 'Root' or 'Leaf'.",
    schemaSql: 'CREATE TABLE tree (id INTEGER, p_id INTEGER);',
    solutionSql: "SELECT id, CASE WHEN p_id IS NULL THEN 'Root' WHEN id IN (SELECT p_id FROM tree WHERE p_id IS NOT NULL) THEN 'Inner' ELSE 'Leaf' END AS type FROM tree;",
    hint: "Root: p_id IS NULL. Inner: p_id not null AND this id appears as someone's p_id. Leaf: otherwise.",
    orderMatters: false,
    tests: [
      { name: 'basic', seedSql: "INSERT INTO tree VALUES (1,NULL),(2,1),(3,1),(4,2);" },
      { name: 'inner is both child and parent', seedSql: "INSERT INTO tree VALUES (1,NULL),(2,1),(3,2);" },
      { name: 'single root only', seedSql: "INSERT INTO tree VALUES (1,NULL);" },
      { name: 'root with one leaf', seedSql: "INSERT INTO tree VALUES (1,NULL),(2,1);" },
      { name: 'deep chain', seedSql: "INSERT INTO tree VALUES (1,NULL),(2,1),(3,2),(4,3);" },
      { name: 'two roots', seedSql: "INSERT INTO tree VALUES (1,NULL),(2,NULL),(3,1),(4,2);" },
      { name: 'empty → empty', seedSql: "" },
      { name: 'all leaves under one root', seedSql: "INSERT INTO tree VALUES (1,NULL),(2,1),(3,1),(4,1),(5,1);" },
    ],
  },
];

// ---- generate + write ------------------------------------------------------
let okCount = 0;
let testCount = 0;
for (const spec of SPECS) {
  const tests = [];
  for (const t of spec.tests) {
    const { columns, rows } = run(spec.schemaSql, t.seedSql, spec.solutionSql);
    const expectedOutput = expectedFrom(columns, rows);
    tests.push({ name: t.name, ...(t.seedSql ? { seedSql: t.seedSql } : {}), expectedOutput });
    testCount++;
  }
  const problem = {
    id: spec.id,
    number: spec.number,
    title: spec.title,
    difficulty: spec.difficulty,
    tags: spec.tags,
    top50: true,
    description: spec.description,
    schemaSql: spec.schemaSql,
    solutionSql: spec.solutionSql,
    orderMatters: spec.orderMatters,
    hint: spec.hint,
    tests,
  };
  const file = `${String(spec.number).padStart(3, '0')}-${spec.id}.json`;
  await writeFile(join(PROBLEMS_DIR, file), JSON.stringify(problem, null, 2) + '\n', 'utf8');
  const rowCounts = tests.map((t) => t.expectedOutput.length);
  console.log(`${String(spec.number).padStart(3)} ${spec.difficulty.padEnd(6)} ${spec.id.padEnd(28)} ${tests.length} cases → rows [${rowCounts.join(',')}]`);
  okCount++;
}
console.log(`\nGenerated ${okCount} problems, ${testCount} test cases.`);
console.log('Next: run  node scripts/validate-problems.mjs  to verify.');
