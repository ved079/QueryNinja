/**
 * Add outputExplanation to all problems 1-90.
 * Reads each JSON file, inserts the explanation, writes back.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PROBLEMS_DIR = path.join(ROOT, 'problems');

// ── Explanations keyed by problem id ──────────────────────────────
const EXPLANATIONS = {

  // ── Standalone 1–7 ─────────────────────────────────────────────────
  'combine-two-tables':
    'The `LEFT JOIN` keeps all Person rows regardless of whether a matching Address exists. Allen Wang (personId=1) has no address record → city and state are **NULL**. Alice Bob (personId=2) matches addressId=1 → New York City, NY. Vedant Deo (personId=3) matches addressId=2 → Leetcode, California. Three rows total, one per person.',

  'duplicate-emails':
    '`a@b.com` appears at ids 1, 3, 6 → COUNT = 3 (>1). `c@d.com` appears at ids 2, 5 → COUNT = 2 (>1). `e@f.com` appears only at id 4 → COUNT = 1, excluded by `HAVING`. The result is `a@b.com` and `c@d.com`.',

  'customers-who-never-order':
    'Joe (id=1) has order 1 and Sam (id=3) has order 2 → those rows get a non-NULL `o.id` and are filtered out by `WHERE o.id IS NULL`. Henry (id=2) and Max (id=4) have no matching order row → `o.id` stays NULL → they survive and form the result.',

  'second-highest-salary':
    'Distinct salaries: 100, 200, 300. Ordered DESC: 300, 200, 100. `LIMIT 1 OFFSET 1` skips the first (300) and returns 200. The outer SELECT guarantees exactly one row — if no second-highest existed the subquery would return nothing, but the outer layer still emits a single row with **NULL**.',

  'rising-temperature':
    'January 2 (temp 25) > January 1 (temp 10) → id 2 qualifies. January 4 (temp 30) > January 3 (temp 20) → id 4 qualifies. January 3 (20) < January 2 (25) → excluded. January 6 (40) has no previous day in the table — `DATE(\'-1 day\')` lands on January 5, which isn\'t in Weather, so the self-join produces no match.',

  'consecutive-numbers':
    'Num `1` appears at ids 1, 2, 3 (three in a row) → qualifies. Num `2` appears at ids 7, 8, 9 (at least three in a row) → qualifies. The run of `2` at ids 4 alone is only length 1, excluded. `DISTINCT` ensures each number appears only once even if it had multiple qualifying runs.',

  'department-top-three-salaries':
    'IT: DENSE_RANK gives Max(90k)→1, Joe/Randy(85k)→2 (tied, no skip), Will(70k)→3, Janet(69k)→4 → rank ≤ 3 picks 4 employees. Sales: Henry(80k)→1, Sam(60k)→2 → both qualify. 6 rows total. Tied ranks share the same rank number, so Joe and Randy both appear at rank 2.',

  // ── Employees Easy 8–19 ────────────────────────────────────────────
  'emp-high-earners':
    'Employees with salary > 100k: Ava($150k), Ben($120k), Cara($120k), Eve($130k). Dan(95k), Finn(70k), Gia(85k) and Hal(60k) are ≤ 100k and excluded. 4 rows.',

  'emp-headcount-per-department':
    'Engineering has 4 employees (Ava, Ben, Cara, Dan), Sales has 3 (Eve, Finn, Gia), HR has 1 (Hal). The `LEFT JOIN` + `COUNT(e.id)` ensures a department with zero employees would report 0 — without the LEFT JOIN it would be dropped entirely.',

  'emp-no-manager':
    'Ava, Eve and Hal have `manager_id IS NULL` — they are the top-level managers in the company. Every other employee has a non-NULL manager_id and is excluded.',

  'emp-distinct-titles':
    'The 8 employees hold 4 distinct titles: Manager (Ava, Eve), Engineer (Ben, Cara, Dan), Rep (Finn, Gia), Analyst (Hal). `DISTINCT` collapses duplicates.',

  'emp-recent-hires':
    'Dan (2021-07-19), Finn (2020-05-30), Gia (2022-02-14) and Hal (2023-09-01) were hired on or after 2020-01-01. Ava (2018), Ben/Cara (2019-03-01) and Eve (2017) are before the cutoff and excluded.',

  'emp-payroll-per-department':
    'Engineering: 150k + 120k + 120k + 95k = **485,000**. Sales: 130k + 70k + 85k = **285,000**. HR: 60k = **60,000**. `COALESCE(SUM, 0)` makes empty or NULL-only departments show 0 instead of NULL.',

  'emp-average-salary':
    'AVG of the 8 non-NULL salaries (150, 120, 120, 95, 130, 70, 85, 60) = 830,000 / 8 = **103,750** — already an integer so `ROUND` to 2 decimals leaves 103750.00.',

  'emp-name-starts-with':
    'Only Ava begins with the letter `A`. In SQLite, `LIKE \'A%\'` is case-insensitive for ASCII characters, so an employee named `ava` would also match.',

  'emp-highest-salary':
    'The maximum salary in the company is **150,000** (Ava\'s salary). `MAX()` ignores NULL salaries and always returns exactly one row — even with an empty employees table it would return a single row with NULL.',

  'emp-titles-count':
    'Engineer: Ben, Cara, Dan → 3. Manager: Ava, Eve → 2. Rep: Finn, Gia → 2. Analyst: Hal → only 1, excluded by `HAVING COUNT(*) >= 2`.',

  'emp-departments-by-location':
    'Engineering and HR are both located in Austin. Sales is in Denver and is excluded.',

  'emp-salary-range-per-title':
    'Manager: 130k–150k. Engineer: 95k–120k. Rep: 70k–85k. Analyst: only Hal at 60k, so min = max = 60k. `MIN` and `MAX` both skip NULL salaries.',

  // ── Employees Medium 20–35 ──────────────────────────────────────────
  'emp-earn-more-than-manager':
    'The self-join finds employees whose salary exceeds their manager\'s. In the Example dataset, no employee earns more than their own manager — the join produces zero rows. The "deep chain" hidden test (L1–L5) makes the result visible: L5 (Engineer, $250k) earns more than L4 (Manager, $120k), their own manager.',

  'emp-rank-within-department':
    'Engineering: Ava(150k)→1, Ben/Cara(120k)→2 (tied, DENSE_RANK doesn\'t skip 3), Dan(95k)→3. Sales: Eve(130k)→1, Gia(85k)→2, Finn(70k)→3. HR: Hal(60k)→1. DENSE_RANK leaves no gaps after ties — the next distinct salary after 120k is rank 3, not 4.',

  'emp-above-department-average':
    'Engineering avg = (150+120+120+95)/4 = 121.25k → only Ava(150k) exceeds it. Sales avg = (130+70+85)/3 = 95k → only Eve(130k) exceeds it. HR avg = 60k → nobody exceeds. Ben, Cara, Dan and Finn, Gia all earn at or below their department average.',

  'emp-share-of-department-payroll':
    'Engineering total payroll = 485k: Ava=150k (30.93%), Ben=120k (24.74%), Cara=120k (24.74%), Dan=95k (19.59%). Sales total = 285k: Eve=130k (45.61%), Finn=70k (24.56%), Gia=85k (29.82%). HR total = 60k: Hal=60k (100%). Percentages sum to roughly 100% per department.',

  'emp-departments-above-company-average':
    'Company-wide average salary = 103.75k. Engineering department average = 121.25k > 103.75k → qualifies. Sales average = 95k < 103.75k → excluded. HR average = 60k < 103.75k → excluded.',

  'emp-top-earner-per-department':
    'RANK() inside each department: Engineering\'s top earner is Ava (150k), Sales\' is Eve (130k), HR\'s is Hal (60k — its only employee). If there were ties at rank 1, all tied employees would appear. Only one row per department here because each has a clear top earner.',

  'emp-direct-reports':
    'Ava manages Ben, Cara, Dan → 3 direct reports. Eve manages Finn, Gia → 2 direct reports. Hal manages nobody → the inner JOIN excludes managers with zero reports. No manager acts as both employee and manager in a way that double-counts because each is grouped by their own id.',

  'emp-salary-gap-to-next':
    'Ordered by salary descending: Ava(150k)→NULL (top, no one above), Eve(130k)→20k less than Ava, Ben(120k)→10k less than Eve, Cara(120k)→0 less than Ben (same salary), Dan(95k)→25k, Gia(85k)→10k, Finn(70k)→15k, Hal(60k)→10k. The `id` tiebreaker in `ORDER BY salary DESC, id` makes the order deterministic when salaries tie.',

  'emp-running-headcount':
    'Ordered by hire_date: Eve(2017)→1, Ava(2018)→2, Ben(2019-03-01)→3, Cara(2019-03-01)→4 (same date, ROWS frame increments by one for each row), Finn(2020)→5, Dan(2021)→6, Gia(2022)→7, Hal(2023)→8. The `ROWS` frame means each row gets its own count even when dates tie — `RANGE` would give both Ben and Cara the same count of 4.',

  'emp-salary-bands':
    'High (≥130k): Ava(150k) and Eve(130k) = 2. Mid (80k ≤ x < 130k): Ben(120k), Cara(120k), Dan(95k), Gia(85k) = 4. Low (<80k): Finn(70k) and Hal(60k) = 2. Unknown (NULL salary): none in Example data — a hidden test with NULL salaries demonstrates that band.',

  'emp-duplicate-salaries':
    'Only 120,000 is shared — Ben and Cara both earn exactly $120k → salary = 120000, people = 2. Every other salary in the company is unique to a single employee. NULL salaries are excluded by `WHERE salary IS NOT NULL`.',

  'emp-longest-tenured-per-department':
    'Engineering earliest hire: Ava (2018-01-15). Sales earliest hire: Eve (2017-11-02). HR earliest hire: Hal (2023-09-01, only employee). `RANK()` ensures that if two employees were hired on the same earliest date, both would be included at rank 1.',

  'emp-hires-per-year':
    '2017: Eve (1). 2018: Ava (1). 2019: Ben and Cara (2). 2020: Finn (1). 2021: Dan (1). 2022: Gia (1). 2023: Hal (1). `strftime(\'%Y\', hire_date)` extracts the year as text; `GROUP BY` groups all hires from the same year together.',

  'emp-median-salary':
    '8 non-NULL salaries sorted: 60k, 70k, 85k, 95k, 120k, 120k, 130k, 150k. Even count (8) → average of the two middle values (4th = 95k, 5th = 120k) = **107,500**. The `LIMIT`/`OFFSET` median recipe picks rows 4 and 5 and averages them.',

  'emp-managers-of-big-teams':
    'Ava has 3 direct reports (Ben, Cara, Dan) → `COUNT(*) = 3`, qualifies. Eve has 2 direct reports (Finn, Gia) → doesn\'t reach the threshold of ≥3. Hal manages nobody → excluded by the inner JOIN.',

  'emp-difference-from-department-average':
    'Engineering avg = 121.25k: Ava +28.75k, Ben/Cara −1.25k, Dan −26.25k. Sales avg = 95k: Eve +35k, Finn −25k, Gia −10k. HR avg = 60k: Hal ±0 (only employee, salary equals the average). Negative = below department average.',

  // ── Employees Hard 36–45 ────────────────────────────────────────────
  'emp-management-chain-depth':
    'Top-level (manager_id IS NULL): Ava, Eve, Hal → depth 1. Their direct reports: Ben, Cara, Dan report to Ava; Finn, Gia report to Eve → depth 2. The recursive CTE\'s anchor picks the roots, and each recursive step adds one to the depth.',

  'emp-total-team-size':
    'Ava has 3 total people below her in the tree (Ben, Cara, Dan — all direct). Eve has 2 (Finn, Gia — all direct). Hal manages nobody → excluded by `WHERE manager_id IS NOT NULL`. The recursive CTE starts from each (manager, direct report) pair and traverses all descendants, grouping by the original root manager.',

  'emp-above-department-median':
    'Engineering salaries (non-NULL): 95k, 120k, 120k, 150k → median = (120k + 120k) / 2 = 120k → Ava(150k) > 120k qualifies. Sales salaries: 70k, 85k, 130k → median = 85k → Eve(130k) > 85k qualifies. HR has only 1 salary → median = Hal\'s own 60k, nobody can exceed it.',

  'emp-payroll-running-percent':
    'Ordered by salary descending: Ava(150k)→18.07% of total (150k/830k), Eve(130k)→33.73% (cumulative 280k/830k), Ben(120k)→48.19%, Cara(120k)→62.65%, Dan(95k)→74.10%, Gia(85k)→84.34%, Finn(70k)→92.77%, Hal(60k)→100%. The running sum divided by the grand total gives the cumulative share.',

  'emp-second-highest-per-department':
    'Engineering distinct salaries: 150k (rank 1), 120k (rank 2), 95k (rank 3) → rank 2 = Ben and Cara at $120k. Sales distinct salaries: 130k (rank 1), 85k (rank 2), 70k (rank 3) → rank 2 = Gia at $85k. HR has only one distinct salary → no rank 2, zero rows for HR. DENSE_RANK by salary, filtered to rnk = 2.',

  'emp-manager-chain-names':
    'Top-level: Ava → "Ava", Eve → "Eve", Hal → "Hal". Ben → "Ava > Ben", Cara → "Ava > Cara", Dan → "Ava > Dan". Finn → "Eve > Finn", Gia → "Eve > Gia". The recursive CTE builds the chain by appending each child\'s name to the parent\'s chain with `|| \' > \' ||` concatenation.',

  'emp-departments-all-above-70k':
    'Engineering: min salary = 95k > 70k → qualifies (all employees earn > 70k). Sales: min salary = 70k (Finn\'s salary), which is NOT strictly greater than 70k → excluded. HR: Hal has 60k < 70k → excluded. The `EXISTS` guard ensures empty departments (if any existed) don\'t vacuously qualify.',

  'emp-salary-percentile':
    'Hal(60k): 0 of 8 employees strictly below him → 0%. Finn(70k): 1 below → 12.5%. Gia(85k): 2 below → 25%. Dan(95k): 3 below → 37.5%. Ben/Cara(120k, tied): 4 below each → 50%. Eve(130k): 6 below → 75%. Ava(150k): 7 below → 87.5%. The `RANGE` frame counts rows with equal salaries as a peer group, which is subtracted to get the "strictly less than" count.',

  'emp-hired-same-month-pairs':
    'Only Ben and Cara were hired in the same calendar month of the same year — both on 2019-03 → one pair (Ben, Cara). The self-join condition `a.id < b.id` ensures each pair appears only once, not twice.',

  'emp-dept-pay-compression':
    'Engineering: max 150k / min 95k = 1.58. Sales: max 130k / min 70k = 1.86. HR excluded: only 1 employee with salary → `HAVING COUNT(*) >= 2` fails. The `MIN > 0` guard in HAVING also prevents division by zero or negative ratios.',

  // ── Sales Easy 46–57 ────────────────────────────────────────────────
  'sales-us-customers':
    'Ada and Cy have `country = \'US\'`. Bo is \'UK\', Di is \'IN\' — both excluded by the WHERE filter. If a customer had a NULL country, they\'d be excluded too since NULL = \'US\' is never true.',

  'sales-expensive-products':
    'Keyboard ($80) and Desk ($300) are priced above $50. Mouse ($25) and Lamp ($45) are not — they\'re excluded by the WHERE filter.',

  'sales-orders-per-status':
    '4 orders are `completed` (ids 1, 2, 4, 6), 1 is `cancelled` (id 3), 1 is `pending` (id 5). `GROUP BY status` produces one row per status value, including any NULL statuses grouped together.',

  'sales-customers-per-country':
    'US: Ada, Cy → 2. UK: Bo → 1. IN: Di → 1. `GROUP BY country` counts how many customers signed up from each country, including a group for NULL countries if any existed.',

  'sales-distinct-categories':
    'Two non-NULL categories exist in the products table: `Tech` (Keyboard, Mouse) and `Furniture` (Desk, Lamp). The Mystery product has NULL category and is excluded by `WHERE category IS NOT NULL`.',

  'sales-most-expensive-product':
    'The maximum product price is Desk at **$300**. `MAX()` ignores NULL prices and always returns exactly one row — even if the table were empty it would return a single row with NULL.',

  'sales-orders-in-2022':
    'Orders 1 through 5 have order_dates in 2022: from 2022-01-10 to 2022-03-06. Order 6 is dated 2023-01-02 and is excluded by the half-open range `>= \'2022-01-01\' AND < \'2023-01-01\'`.',

  'sales-quantity-per-product':
    'Keyboard: sum(2+1) = 3. Mouse: sum(1+3+2) = 6. Desk: sum(1) = 1. Lamp: sum(4+2) = 6. The `LEFT JOIN` + `COALESCE` ensures products never sold would appear with quantity 0 instead of being dropped.',

  'sales-never-sold':
    'All 4 products appear in order_items at least once, so the anti-join (LEFT JOIN + WHERE oi.id IS NULL) finds nothing — 0 rows. The hidden test "Products never sold" adds a `NeverSold` product that has no order_items row, making it appear in the result.',

  'sales-order-value':
    'Order 1: 2×80 + 1×25 = 185. Order 2: 1×300 = 300. Order 3: 4×45 = 180. Order 4: 3×25 = 75. Order 5: 1×80 = 80. Order 6: 2×45 + 2×25 = 140. The query groups by `order_id` directly on order_items, so it includes all orders regardless of their status.',

  'sales-completed-orders-count':
    'Ada has 3 completed orders (ids 1, 2, 6). Cy has 1 (id 4). Bo has 0 completed (order 3 is cancelled). Di has 0 total orders. The `LEFT JOIN` keeps all customers, and `COUNT(CASE WHEN status = \'completed\' THEN 1 END)` counts only completed orders without filtering out the zero-count rows.',

  'sales-average-price-per-category':
    'Furniture: (300 + 45) / 2 = **172.50**. Tech: (80 + 25) / 2 = **52.50**. Products with NULL category are excluded by `WHERE category IS NOT NULL`. `AVG` skips NULL prices, so a category with only NULL prices would average to NULL.',

  // ── Sales Medium 58–73 ──────────────────────────────────────────────
  'sales-revenue-per-customer':
    'Ada: orders 1(185) + 2(300) + 6(140) = **625**. Cy: order 4(75) = **75**. Bo: only cancelled order → excluded → 0. Di: no orders → 0. The double LEFT JOIN keeps all customers, and the CASE inside SUM only counts completed orders. COALESCE turns NULL total to 0.',

  'sales-repeat-customers':
    'Ada has 3 orders, Cy has 2 → both qualify. Bo has only 1 order → excluded by `HAVING COUNT(*) >= 2`. Di has 0 orders → inner JOIN drops her entirely.',

  'sales-monthly-revenue':
    'The query joins `orders` to `order_items` and filters only completed orders. 2022-01: order 1 = 185. 2022-02: order 2 = 300 (order 3 is cancelled, excluded). 2022-03: order 4 = 75 (order 5 is pending, excluded). 2023-01: order 6 = 140. Four months with revenue.',

  'sales-top-product-by-revenue':
    'Computing total revenue per product from order_items: Desk = 1×300 = **300**, Lamp = 4×45 + 2×45 = 270, Keyboard = 2×80 + 1×80 = 240, Mouse = 1×25 + 3×25 + 2×25 = 150. Desk has the highest at $300. If another product tied, both would be returned — the `WHERE revenue = (SELECT MAX(...))` pattern keeps all ties.',

  'sales-first-order-per-customer':
    'Ada: earliest order 2022-01-10. Bo: only order 2022-02-20. Cy: earliest order 2022-03-05. Di: no orders → excluded by inner JOIN. `ROW_NUMBER` with `ORDER BY order_date, id` ensures exactly one row per customer — if two orders shared the earliest date, the smaller id breaks the tie.',

  'sales-category-revenue-share':
    'From order_items (all statuses), Furniture (Desk $300 + Lamp $270) = $570 → 59.38% of $960 total. Tech (Keyboard $240 + Mouse $150) = $390 → 40.63%. Products with NULL category excluded. The `SUM(revenue) OVER ()` computes the grand total without a second scan.',

  'sales-items-per-order':
    'Order 1: Keyboard and Mouse → 2 distinct products. Order 6: Lamp and Mouse → 2 distinct products. Orders 2 (Desk), 3 (Lamp), 4 (Mouse), 5 (Keyboard) each have only 1 distinct product → excluded by `HAVING COUNT(DISTINCT product_id) >= 2`.',

  'sales-customers-above-country-average':
    'US customers: Ada(total $625) and Cy(total $75) → country avg = $350 → Ada\'s $625 > $350 qualifies. Cy\'s $75 < $350 excluded. UK: Bo($0) = country avg = $0 → $0 is not strictly greater, excluded. IN: Di($0) → same, excluded. The window `AVG(total) OVER (PARTITION BY country)` computes the per-country benchmark.',

  'sales-month-over-month':
    'Monthly revenue from all orders (no status filter): 2022-01=185, 2022-02=480 (includes order 3), 2022-03=155 (includes order 5), 2023-01=140. Change: 2022-01→NULL (earliest month), 2022-02→+295, 2022-03→−325, 2023-01→−15. LAG looks back one row in the aggregated result.',

  'sales-products-above-category-average':
    'Tech avg = (80 + 25) / 2 = 52.50 → Keyboard ($80) > 52.50 qualifies; Mouse ($25) does not. Furniture avg = (300 + 45) / 2 = 172.50 → Desk ($300) > 172.50 qualifies; Lamp ($45) does not. The window `AVG(price) OVER (PARTITION BY category)` makes the category average available on each row.',

  'sales-cancelled-rate':
    'Ada: 0 cancelled orders out of 3 total → 0%. Bo: 1 cancelled (only order) → 100%. Cy: 0 cancelled out of 2 → 0%. Di has no orders → inner JOIN excludes her entirely. The inner JOIN is appropriate here because customers without orders can\'t have a cancellation rate.',

  'sales-running-revenue':
    'Daily totals from all order_items (no status filter): 2022-01-10=185, 2022-02-14=300, 2022-02-20=180, 2022-03-05=75, 2022-03-06=80, 2023-01-02=140. Running totals accumulate each day: 185, 485, 665, 740, 820, **960**. Grouping by date first prevents double-counting multi-item orders.',

  'sales-customers-single-category':
    'Bo: only ordered Lamp (Furniture) → one category. Cy: ordered Mouse and Keyboard (both Tech) → one category. Ada: ordered Tech (Keyboard, Mouse) AND Furniture (Desk, Lamp) → two categories → excluded. Di: no orders → inner JOIN excludes her. The `HAVING COUNT(DISTINCT category) = 1` ensures exactly one category.',

  'sales-average-order-value':
    'Per-order totals: 185, 300, 180, 75, 80, 140 → average = 960 / 6 = **160**. Only orders with at least one item are included (all 6 have items). This is the average of order-level totals, not the average line-item value.',

  'sales-orders-without-items':
    'All 6 orders have items in order_items, so `NOT EXISTS` returns nothing — 0 rows. The "Orders with no items, products never sold" hidden test has order 2 with no order_items rows, making it visible.',

  'sales-signup-to-first-order':
    'Ada: signup 2021-01-05 → first order 2022-01-10 = 370 days. Bo: signup 2021-03-12 → first order 2022-02-20 = 345 days. Cy: signup 2022-06-30 → first order 2022-03-05 = **−117 days** (signed up after they first ordered — a data anomaly captured by the test data). JULIANDAY converts dates to numeric days for subtraction.',

  // ── Activity 74–90 ──────────────────────────────────────────────────
  'act-daily-active-users':
    '2022-03-01: users 1 (Ada) + 2 (Bo) = 2. 2022-03-02: users 1 (Ada) + 3 (Cy) = 2. 2022-03-03: user 1 (Ada) = 1. 2022-03-04: user 3 (Cy) = 1. 2022-03-05: user 2 (Bo) = 1. `DATE()` strips the time portion; `COUNT(DISTINCT user_id)` counts unique users per calendar day.',

  'act-silent-users':
    'Di has no rows in the events table at all — the correlated `NOT EXISTS` subquery finds no match and returns true, so Di is included. Ada, Bo and Cy all have events and are excluded.',

  'act-first-last-event':
    'Ada: first event 2022-03-01 09:00, last 2022-03-03 11:00. Bo: first 2022-03-01 08:00, last 2022-03-05 08:10. Cy: first 2022-03-02 20:00, last 2022-03-04 21:00. Di has no events → excluded by the inner JOIN. ISO timestamps sort correctly as text, so MIN/MAX work directly.',

  'act-event-type-pivot':
    'Ada: 3 logins, 1 view, 1 purchase. Bo: 1 login, 1 view, 0 purchases. Cy: 2 logins, 0 views, 1 purchase. `SUM(CASE WHEN event_type = \'login\' THEN 1 ELSE 0 END)` counts events of each type in a single column — a manual pivot.',

  'act-time-between-events':
    'Ada\'s events: id1(NULL, first), id2(+5 min), id3(+35 min >30 = new session), id4(+1460 min ≈ next day), id5(+1500 min ≈ next+1). Bo\'s events: id6(NULL), id7(+5770 min ≈ 4 days). Cy\'s events: id8(NULL), id9(+30 min), id10(+2910 min ≈ 2 days). JULIANDAY difference × 24 × 60 converts days to minutes.',

  'act-purchased-on-first-day':
    'Ada\'s first event is 2022-03-01 09:00 (login); she made a purchase at 09:40 on the same calendar day → qualifies. Cy\'s first event is 2022-03-02 20:00 (login); purchase at 20:30 same day → qualifies. Bo: never made a purchase → excluded.',

  'act-favourite-event-type':
    'Ada: 3 logins (most frequent). Bo: 1 login and 1 view — tied, both reported. Cy: 2 logins (most frequent). NULL event types are excluded from the count. The RANK window over `COUNT(*) DESC` keeps all tied types at rank 1.',

  'act-longest-login-streak':
    'Ada: active on 2022-03-01, 02, 03 → consecutive streak of 3. Bo: active on 2022-03-01 and 03-05 → no consecutive days → streak of 1. Cy: active on 2022-03-02 and 03-04 → no consecutive days → streak of 1. The gaps-and-islands trick groups consecutive dates by subtracting a row number.',

  'act-three-day-streak':
    'Ada has 3 consecutive active days (March 1–3) → qualifies. Bo and Cy don\'t reach the 3-day threshold. The same islands technique as the longest-streak problem, but filtered to groups with `COUNT(*) >= 3`.',

  'act-sessionize':
    'Ada: events at 09:00, 09:05 (within 30 min → same session), 09:40 (+35 min > 30 → new session), next day 10:00 (>30 min → new session), day+1 11:00 (>30 min → new session) → 4 sessions. Bo: events 4 days apart → 2 sessions. Cy: events at 20:00, 20:30 (+30 min, within 30 → same session), day+2 21:00 (>30 min → new session) → 2 sessions. Each flag = 1 starts a new session.',

  'act-next-day-return':
    'Ada\'s first active day is 2022-03-01; she has an event on 2022-03-02 (immediately next day) → qualifies. Bo\'s first day is 2022-03-01; next event is 2022-03-05 → not the next calendar day → excluded. Cy\'s first day is 2022-03-02; next event is 2022-03-04 → not the next day → excluded. The query uses `DATE(first_day, \'+1 day\')` to check for events exactly one day later.',

  'act-rolling-seven-day':
    'Daily event counts: 2022-03-01=4, 03-02=3, 03-03=1, 03-04=1, 03-05=1. Rolling 7-day: 03-01→4, 03-02→7, 03-03→8, 03-04→9, 03-05→10. The `RANGE` frame over `JULIANDAY(day)` counts actual calendar days, not just rows — so a seven-day gap with no events correctly contributes zero to the sum.',

  'act-longest-gap':
    'Ada\'s longest inter-event gap: 1.04 days (between day 1 evening and day 2 morning). Bo\'s longest gap: 4.01 days (between March 1 and March 5). Cy\'s longest gap: 2.02 days (between March 2 evening and March 4 evening). Each user\'s first event has a NULL gap (nothing before it), filtered out by `WHERE g.gap IS NOT NULL`.',

  'act-view-then-purchase':
    'Ada has a view (id 2 at 09:05) followed later by a purchase (id 3 at 09:40 on the same day) → qualifies. Bo has a view (id 7) but no purchase ever → excluded. Cy has a purchase (id 9) but no view event at all → excluded. The self-join requires `view.time < purchase.time` for the same user.',

  'act-first-event-was-purchase':
    'No user in the Example data started with a purchase — Ada\'s first event is login, Bo\'s is login, Cy\'s is login. The "Purchases only, no logins" hidden test has users whose *only* events are purchases, where the first event trivially is a purchase and they qualify.',

  'act-busiest-hour':
    'Hourly event counts: hour `09` has 3 events (ids 1, 2, 3 — Ada\'s login, view, purchase at 09:00, 09:05, 09:40). Hour `08` has 1, `10` has 1, `11` has 1, `20` has 2, `21` has 1. Max = 3 at hour `09`. `strftime(\'%H\', event_time)` returns a two-digit text string like \'09\'.',

  'act-median-events-per-user':
    'Active users (with ≥1 event): Ada=5, Bo=2, Cy=3. Sorted counts: 2, 3, 5. Odd count (3) → median = middle value = **3**. Di has zero events and is excluded from the per-user counts.',

};

// ── File processing ──────────────────────────────────────────────────

const files = [
  '001-combine-two-tables.json', '002-duplicate-emails.json',
  '003-customers-who-never-order.json', '004-second-highest-salary.json',
  '005-rising-temperature.json', '006-consecutive-numbers.json',
  '007-department-top-three-salaries.json',
  path.join('specs', 'employees-easy.json'),
  path.join('specs', 'employees-medium.json'),
  path.join('specs', 'employees-hard.json'),
  path.join('specs', 'sales-easy.json'),
  path.join('specs', 'sales-medium.json'),
  path.join('specs', 'activity.json'),
];

function orderedProblem(obj) {
  // Build a new object with keys in the desired order,
  // inserting outputExplanation after hint.
  const keys = Object.keys(obj);
  const result = {};
  for (const k of keys) {
    result[k] = obj[k];
    if (k === 'hint') {
      result.outputExplanation = EXPLANATIONS[obj.id] ?? '';
    }
  }
  return result;
}

let total = 0;
for (const file of files) {
  const filePath = path.join(PROBLEMS_DIR, file);
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (Array.isArray(raw)) {
    // Spec file: array of problem objects
    const updated = raw.map(p => orderedProblem(p));
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2) + '\n');
    total += updated.length;
  } else {
    // Standalone file: single problem object
    const updated = orderedProblem(raw);
    fs.writeFileSync(filePath, JSON.stringify(updated, null, 2) + '\n');
    total++;
  }
  console.log(`  ${file} ✓`);
}

console.log(`\nWrote outputExplanation for ${total} problems.`);
