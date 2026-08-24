# Python Curriculum Plan

Learning path for Python from zero to LeetCode-ready, built into QueryNinja.
Stages are hard-locked — complete a stage before the next unlocks.

---

## Stage 1: Python Fundamentals

**Goal:** Write basic Python confidently. No prior experience assumed.

### Topics (lessons + exercises)
1. Variables & Types — int, float, str, bool, type()
2. Strings — indexing, slicing, f-strings, common methods
3. Lists — create, index, append, remove, slice, iterate
4. Loops — for loops, while loops, range(), break, continue
5. Conditionals — if / elif / else, comparison operators, logical operators
6. Functions — def, return, parameters, default args, scope
7. Dicts & Sets — create, access, insert, delete, iterate

**Problem style:** Small exercises like "reverse a string", "count vowels", "sum a list" — language mechanics, not algorithms.

---

## Stage 2: Intermediate Python

**Goal:** Write clean idiomatic Python.

### Topics
1. List Comprehensions — `[x*2 for x in lst if x > 0]`
2. Tuples & Unpacking — immutability, `a, b = b, a`, `*rest`
3. Built-in Functions — `map`, `filter`, `zip`, `enumerate`, `sorted`, `min/max` with key
4. Error Handling — try/except, raise, common exceptions
5. Classes & OOP Basics — `__init__`, methods, self, inheritance (light)
6. Modules & Imports — import, from, standard library (collections, itertools, math)

**Problem style:** Slightly harder exercises — word frequency counter, stack using a list, custom sort, etc.

---

## Stage 3: DSA Foundations

**Goal:** Solve easy LeetCode problems reliably.

### Topics
1. Arrays & Two Pointers — in-place ops, left/right pointers, fast/slow
2. Sliding Window — fixed window, variable window, substring problems
3. Stacks & Queues — LIFO/FIFO, monotonic stack, `collections.deque`
4. Hash Maps & Sets — frequency maps, seen sets, O(1) lookup patterns
5. Linked Lists — Node class, traversal, reversal, cycle detection
6. Recursion — base case, call stack, tree of calls

**Problem style:** LeetCode Easy — real problems with hidden test cases, pass/fail grading.

---

## Stage 4: Core Algorithms

**Goal:** Solve medium LeetCode problems.

### Topics
1. Binary Search — classic, search on answer, rotated array
2. Sorting — merge sort, quick sort, counting sort (concepts + when to use)
3. Trees — BFS, DFS, inorder/preorder/postorder, BST properties
4. Graphs — adjacency list, BFS shortest path, DFS connected components
5. Backtracking — permutations, subsets, N-queens pattern
6. Dynamic Programming (intro) — memoization, tabulation, 1D DP problems

**Problem style:** LeetCode Easy/Medium mix.

---

## Stage 5: LeetCode Patterns

**Goal:** Recognize patterns fast and apply the right tool.

### Patterns
1. Prefix Sum
2. Fast & Slow Pointers
3. Merge Intervals
4. Top K Elements (heap)
5. Binary Search on Answer
6. DP — knapsack, longest subsequence, matrix paths
7. Graph — Dijkstra, Union-Find, topological sort

**Problem style:** LeetCode Medium/Hard. Mixed topics, timed feel.

---

## Build Plan (what needs to be built)

### Data
- [ ] Rewrite/expand `problems/python/` — organize problems by stage + topic
- [ ] Add `lesson` field to each topic (short markdown, 5–10 bullets + code snippet)
- [ ] Add `stage` and `topicOrder` fields to each problem JSON

### UI
- [ ] Stage/topic sidebar replacing flat problem list
- [ ] Lesson viewer — renders before the first problem of each topic
- [ ] Stage lock UI — locked stages greyed out, show completion requirement
- [ ] Progress tracked per stage (X/Y problems solved to unlock next)

### Backend
- [ ] Python progress API already exists (`/api/python/progress`, etc.) — verify it works
- [ ] Stage unlock logic (client-side is fine — server just stores per-problem status)

---

## Problem Count Target

| Stage | Topics | Problems |
|-------|--------|----------|
| 1     | 7      | ~20      |
| 2     | 6      | ~15      |
| 3     | 6      | ~25      |
| 4     | 6      | ~30      |
| 5     | 7      | ~30      |
| **Total** | **32** | **~120** |
