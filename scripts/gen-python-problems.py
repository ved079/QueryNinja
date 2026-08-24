#!/usr/bin/env python3
"""Generate 24 Python problem JSON files from PyNinja data."""
import json
import os

PROBLEMS_DIR = os.path.join(os.path.dirname(__file__), '..', 'problems', 'python')
os.makedirs(PROBLEMS_DIR, exist_ok=True)

problems = [
    {
        "id": "hello-world",
        "number": 1,
        "title": "Hello, World!",
        "difficulty": "Easy",
        "category": "Basics",
        "tags": ["Print", "Strings"],
        "type": "python",
        "description": 'Write a function `greet(name)` that returns the string `"Hello, {name}!"`.\n\nThe function should take a single string argument and return the greeting. Do not print \u2014 return the string.',
        "starterCode": 'def greet(name):\n    # Your code here\n    pass',
        "solutionCode": 'def greet(name):\n    return f"Hello, {name}!"',
        "hint": 'Use an f-string to format the greeting: `f"Hello, {name}!"`',
        "outputExplanation": 'greet("Alice") returns "Hello, Alice!" \u2014 a simple string formatting exercise.',
        "tests": [
            {"name": "Basic greeting", "input": 'print(greet("Alice"))', "expectedOutput": "Hello, Alice!"},
            {"name": "Another name", "input": 'print(greet("Bob"))', "expectedOutput": "Hello, Bob!"},
            {"name": "Empty name", "input": 'print(greet(""))', "expectedOutput": "Hello, !"}
        ]
    },
    {
        "id": "two-sum",
        "number": 2,
        "title": "Two Sum",
        "difficulty": "Easy",
        "category": "Arrays",
        "tags": ["Arrays", "Hash Map"],
        "type": "python",
        "description": 'Given a list of integers `nums` and an integer `target`, return the **indices** of the two numbers such that they add up to `target`.\n\nYou may assume that each input has exactly one solution, and you may not use the same element twice. Return the indices as a tuple `(i, j)` where `i < j`.',
        "starterCode": 'def two_sum(nums, target):\n    # Your code here\n    pass',
        "solutionCode": 'def two_sum(nums, target):\n    seen = {}\n    for i, num in enumerate(nums):\n        complement = target - num\n        if complement in seen:\n            return (seen[complement], i)\n        seen[num] = i',
        "hint": "Use a dictionary to store numbers you've seen so far and look up the complement.",
        "outputExplanation": "For [2, 7, 11, 15] and target 9, we find 2 at index 0 and 7 at index 1, so the answer is (0, 1).",
        "tests": [
            {"name": "Basic case", "input": "print(two_sum([2, 7, 11, 15], 9))", "expectedOutput": "(0, 1)"},
            {"name": "Later match", "input": "print(two_sum([3, 2, 4], 6))", "expectedOutput": "(1, 2)"},
            {"name": "Negative numbers", "input": "print(two_sum([-1, -2, -3, -4, -5], -8))", "expectedOutput": "(2, 4)"}
        ]
    },
    {
        "id": "fizzbuzz",
        "number": 3,
        "title": "FizzBuzz",
        "difficulty": "Easy",
        "category": "Loops",
        "tags": ["Conditionals", "Loops"],
        "type": "python",
        "description": 'Write a function `fizzbuzz(n)` that returns a list of strings from 1 to `n` where:\n- Multiples of 3 are replaced with `"Fizz"`\n- Multiples of 5 are replaced with `"Buzz"`\n- Multiples of both 3 and 5 are replaced with `"FizzBuzz"`\n- All other numbers remain as strings',
        "starterCode": 'def fizzbuzz(n):\n    # Your code here\n    pass',
        "solutionCode": 'def fizzbuzz(n):\n    result = []\n    for i in range(1, n + 1):\n        if i % 15 == 0:\n            result.append("FizzBuzz")\n        elif i % 3 == 0:\n            result.append("Fizz")\n        elif i % 5 == 0:\n            result.append("Buzz")\n        else:\n            result.append(str(i))\n    return result',
        "hint": "Check for divisibility by 15 (3\u00d75) first, then 3, then 5.",
        "outputExplanation": "fizzbuzz(5) returns ['1', '2', 'Fizz', '4', 'Buzz'] \u2014 classic modulo problem.",
        "tests": [
            {"name": "Small range", "input": "print(fizzbuzz(5))", "expectedOutput": "['1', '2', 'Fizz', '4', 'Buzz']"},
            {"name": "Includes 15", "input": "print(fizzbuzz(16))", "expectedOutput": "['1', '2', 'Fizz', '4', 'Buzz', 'Fizz', '7', '8', 'Fizz', 'Buzz', '11', 'Fizz', '13', '14', 'FizzBuzz', '16']"},
            {"name": "Single element", "input": "print(fizzbuzz(1))", "expectedOutput": "['1']"}
        ]
    },
    {
        "id": "palindrome-checker",
        "number": 4,
        "title": "Palindrome Checker",
        "difficulty": "Easy",
        "category": "Strings",
        "tags": ["Strings", "Two Pointers"],
        "type": "python",
        "description": 'Write a function `is_palindrome(s)` that returns `True` if the string `s` is a palindrome (reads the same forwards and backwards), ignoring case and non-alphanumeric characters. Otherwise return `False`.',
        "starterCode": 'def is_palindrome(s):\n    # Your code here\n    pass',
        "solutionCode": "def is_palindrome(s):\n    cleaned = ''.join(c.lower() for c in s if c.isalnum())\n    return cleaned == cleaned[::-1]",
        "hint": "First clean the string (lowercase + alphanumeric only), then compare with its reverse using slicing `[::-1]`.",
        "outputExplanation": 'is_palindrome("A man, a plan, a canal: Panama") returns True after cleaning to "amanaplanacanalpanama".',
        "tests": [
            {"name": "Classic palindrome", "input": 'print(is_palindrome("A man, a plan, a canal: Panama"))', "expectedOutput": "True"},
            {"name": "Simple word", "input": 'print(is_palindrome("racecar"))', "expectedOutput": "True"},
            {"name": "Not a palindrome", "input": 'print(is_palindrome("hello world"))', "expectedOutput": "False"},
            {"name": "Empty string", "input": 'print(is_palindrome(""))', "expectedOutput": "True"}
        ]
    },
    {
        "id": "reverse-string",
        "number": 5,
        "title": "Reverse String",
        "difficulty": "Easy",
        "category": "Strings",
        "tags": ["Strings", "Slicing"],
        "type": "python",
        "description": 'Write a function `reverse_string(s)` that returns the reverse of the input string `s` without using the built-in `reversed()` function or `[::-1]` slicing.',
        "starterCode": 'def reverse_string(s):\n    # Your code here - do NOT use [::-1] or reversed()\n    pass',
        "solutionCode": 'def reverse_string(s):\n    result = ""\n    for char in s:\n        result = char + result\n    return result',
        "hint": "Build the result character by character, prepending each new character.",
        "outputExplanation": 'reverse_string("hello") builds "" + "h" = "h", then "e" + "h" = "eh", etc., resulting in "olleh".',
        "tests": [
            {"name": "Simple word", "input": 'print(reverse_string("hello"))', "expectedOutput": "olleh"},
            {"name": "Single char", "input": 'print(reverse_string("a"))', "expectedOutput": "a"},
            {"name": "Empty string", "input": 'print(reverse_string(""))', "expectedOutput": ""},
            {"name": "With spaces", "input": 'print(reverse_string("abc def"))', "expectedOutput": "fed cba"}
        ]
    },
    {
        "id": "roman-to-integer",
        "number": 6,
        "title": "Roman to Integer",
        "difficulty": "Medium",
        "category": "Strings",
        "tags": ["Strings", "Parsing", "Hash Map"],
        "type": "python",
        "description": 'Given a Roman numeral string `s`, convert it to an integer.\n\nRoman numerals are represented by seven symbols: I(1), V(5), X(10), L(50), C(100), D(500), M(1000).\n\nA smaller value before a larger value means subtraction (e.g., IV = 4, IX = 9).',
        "starterCode": 'def roman_to_int(s):\n    # Your code here\n    pass',
        "solutionCode": "def roman_to_int(s):\n    values = {'I': 1, 'V': 5, 'X': 10, 'L': 50, 'C': 100, 'D': 500, 'M': 1000}\n    total = 0\n    for i in range(len(s)):\n        if i + 1 < len(s) and values[s[i]] < values[s[i + 1]]:\n            total -= values[s[i]]\n        else:\n            total += values[s[i]]\n    return total",
        "hint": "Iterate left to right. If the current value is less than the next, subtract it; otherwise add it.",
        "outputExplanation": 'For "MCMXCIV": M=1000, CM=900, XC=90, IV=4 \u2192 1994.',
        "tests": [
            {"name": "Basic case", "input": 'print(roman_to_int("III"))', "expectedOutput": "3"},
            {"name": "With subtraction", "input": 'print(roman_to_int("IV"))', "expectedOutput": "4"},
            {"name": "Year", "input": 'print(roman_to_int("MCMXCIV"))', "expectedOutput": "1994"},
            {"name": "Large number", "input": 'print(roman_to_int("LVIII"))', "expectedOutput": "58"}
        ]
    },
    {
        "id": "valid-parentheses",
        "number": 7,
        "title": "Valid Parentheses",
        "difficulty": "Medium",
        "category": "Stack",
        "tags": ["Stack", "String"],
        "type": "python",
        "description": 'Given a string `s` containing only `()`, `{}`, and `[]`, determine if the input string is valid.\n\nAn input string is valid if:\n- Open brackets are closed by the same type of brackets\n- Open brackets are closed in the correct order\n- Every close bracket has a corresponding open bracket of the same type',
        "starterCode": 'def is_valid(s):\n    # Your code here\n    pass',
        "solutionCode": 'def is_valid(s):\n    stack = []\n    pairs = {")": "(", "]": "[", "}": "{"}\n    for char in s:\n        if char in pairs.values():\n            stack.append(char)\n        elif char in pairs:\n            if not stack or stack.pop() != pairs[char]:\n                return False\n    return len(stack) == 0',
        "hint": "Use a stack. Push opening brackets, pop and compare when you see a closing bracket.",
        "outputExplanation": 'For "()[]{}": push (, pop matches. push [, pop matches. push {, pop matches. Stack empty \u2192 True.',
        "tests": [
            {"name": "Valid simple", "input": 'print(is_valid("()"))', "expectedOutput": "True"},
            {"name": "Valid mixed", "input": 'print(is_valid("()[]{}"))', "expectedOutput": "True"},
            {"name": "Invalid", "input": 'print(is_valid("(]"))', "expectedOutput": "False"},
            {"name": "Nested valid", "input": 'print(is_valid("({[]})"))', "expectedOutput": "True"},
            {"name": "Empty string", "input": 'print(is_valid(""))', "expectedOutput": "True"}
        ]
    },
    {
        "id": "flatten-nested-list",
        "number": 8,
        "title": "Flatten Nested List",
        "difficulty": "Medium",
        "category": "Recursion",
        "tags": ["Recursion", "Lists"],
        "type": "python",
        "description": 'Write a function `flatten(lst)` that takes a nested list (lists within lists) and returns a single flattened list with all elements in order.\n\nExample: `flatten([1, [2, [3, 4], 5], 6])` returns `[1, 2, 3, 4, 5, 6]`.',
        "starterCode": 'def flatten(lst):\n    # Your code here\n    pass',
        "solutionCode": 'def flatten(lst):\n    result = []\n    for item in lst:\n        if isinstance(item, list):\n            result.extend(flatten(item))\n        else:\n            result.append(item)\n    return result',
        "hint": "Use recursion: if an element is a list, recursively flatten it; otherwise, add it to the result.",
        "outputExplanation": "flatten([1, [2, [3, 4], 5], 6]) recursively processes each nested list, yielding [1, 2, 3, 4, 5, 6].",
        "tests": [
            {"name": "Basic nesting", "input": "print(flatten([1, [2, [3, 4], 5], 6]))", "expectedOutput": "[1, 2, 3, 4, 5, 6]"},
            {"name": "Already flat", "input": "print(flatten([1, 2, 3]))", "expectedOutput": "[1, 2, 3]"},
            {"name": "Empty", "input": "print(flatten([]))", "expectedOutput": "[]"},
            {"name": "Deep nesting", "input": "print(flatten([[[[1]]]]))", "expectedOutput": "[1]"}
        ]
    },
    {
        "id": "merge-sorted-lists",
        "number": 9,
        "title": "Merge Two Sorted Lists",
        "difficulty": "Medium",
        "category": "Lists",
        "tags": ["Lists", "Two Pointers"],
        "type": "python",
        "description": 'Write a function `merge_sorted(a, b)` that merges two sorted lists into one sorted list.\n\nExample: `merge_sorted([1, 3, 5], [2, 4, 6])` returns `[1, 2, 3, 4, 5, 6]`.',
        "starterCode": 'def merge_sorted(a, b):\n    # Your code here\n    pass',
        "solutionCode": 'def merge_sorted(a, b):\n    result = []\n    i = j = 0\n    while i < len(a) and j < len(b):\n        if a[i] <= b[j]:\n            result.append(a[i])\n            i += 1\n        else:\n            result.append(b[j])\n            j += 1\n    result.extend(a[i:])\n    result.extend(b[j:])\n    return result',
        "hint": "Use two pointers, one for each list. Compare and advance the smaller one.",
        "outputExplanation": "Two pointers walk through both lists simultaneously, always picking the smaller element.",
        "tests": [
            {"name": "Equal length", "input": "print(merge_sorted([1, 3, 5], [2, 4, 6]))", "expectedOutput": "[1, 2, 3, 4, 5, 6]"},
            {"name": "Unequal length", "input": "print(merge_sorted([1, 2], [3, 4, 5, 6]))", "expectedOutput": "[1, 2, 3, 4, 5, 6]"},
            {"name": "Empty lists", "input": "print(merge_sorted([], [1, 2]))", "expectedOutput": "[1, 2]"},
            {"name": "With duplicates", "input": "print(merge_sorted([1, 1, 3], [1, 2]))", "expectedOutput": "[1, 1, 1, 2, 3]"}
        ]
    },
    {
        "id": "group-anagrams",
        "number": 10,
        "title": "Group Anagrams",
        "difficulty": "Medium",
        "category": "Hash Map",
        "tags": ["Hash Map", "Strings", "Sorting"],
        "type": "python",
        "description": 'Write a function `group_anagrams(words)` that takes a list of strings and groups anagrams together.\n\nReturn a list of lists where each inner list contains words that are anagrams of each other. The order of groups and words within groups does not matter \u2014 but the test expects sorted output for verification.',
        "starterCode": 'def group_anagrams(words):\n    # Your code here\n    pass',
        "solutionCode": "def group_anagrams(words):\n    groups = {}\n    for word in words:\n        key = ''.join(sorted(word))\n        if key not in groups:\n            groups[key] = []\n        groups[key].append(word)\n    return sorted([sorted(g) for g in groups.values()])",
        "hint": "Use a dictionary with the sorted string as key. All anagrams share the same sorted key.",
        "outputExplanation": 'group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"]) groups them by sorted characters: "aet"\u2192["ate","eat","tea"], "ant"\u2192["nat","tan"], "abt"\u2192["bat"].',
        "tests": [
            {"name": "Classic case", "input": 'print(group_anagrams(["eat", "tea", "tan", "ate", "nat", "bat"]))', "expectedOutput": "[['bat'], ['nat', 'tan'], ['ate', 'eat', 'tea']]"},
            {"name": "No anagrams", "input": 'print(group_anagrams(["a", "b", "c"]))', "expectedOutput": "[['a'], ['b'], ['c']]"},
            {"name": "Empty", "input": "print(group_anagrams([]))", "expectedOutput": "[]"}
        ]
    },
    {
        "id": "fibonacci-memoized",
        "number": 11,
        "title": "Fibonacci with Memoization",
        "difficulty": "Medium",
        "category": "Recursion",
        "tags": ["Recursion", "Dynamic Programming"],
        "type": "python",
        "description": 'Write a function `fib(n)` that returns the nth Fibonacci number using **memoization**.\n\nThe Fibonacci sequence: F(0) = 0, F(1) = 1, F(n) = F(n-1) + F(n-2).\n\nYour solution must use memoization (caching) to avoid redundant recursive calls. Simply computing iteratively is also acceptable but memoization is the goal.',
        "starterCode": 'def fib(n):\n    # Your code here - use memoization!\n    pass',
        "solutionCode": 'def fib(n, memo={}):\n    if n in memo:\n        return memo[n]\n    if n <= 1:\n        return n\n    memo[n] = fib(n - 1, memo) + fib(n - 2, memo)\n    return memo[n]',
        "hint": "Create a dictionary to cache computed values. Before computing fib(n), check if it is already in the cache.",
        "outputExplanation": "fib(10) = 55. Memoization stores each computed value, reducing the time complexity from O(2^n) to O(n).",
        "tests": [
            {"name": "Small n", "input": "print(fib(0))", "expectedOutput": "0"},
            {"name": "fib(1)", "input": "print(fib(1))", "expectedOutput": "1"},
            {"name": "fib(10)", "input": "print(fib(10))", "expectedOutput": "55"},
            {"name": "fib(20)", "input": "print(fib(20))", "expectedOutput": "6765"}
        ]
    },
    {
        "id": "max-subarray",
        "number": 12,
        "title": "Maximum Subarray (Kadane's)",
        "difficulty": "Medium",
        "category": "Arrays",
        "tags": ["Arrays", "Dynamic Programming"],
        "type": "python",
        "description": 'Write a function `max_subarray(nums)` that finds the contiguous subarray with the largest sum and returns that sum.\n\nExample: `max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4])` returns `6` (from subarray `[4, -1, 2, 1]`).',
        "starterCode": "def max_subarray(nums):\n    # Your code here - try Kadane's algorithm\n    pass",
        "solutionCode": 'def max_subarray(nums):\n    if not nums:\n        return 0\n    current_max = global_max = nums[0]\n    for num in nums[1:]:\n        current_max = max(num, current_max + num)\n        global_max = max(global_max, current_max)\n    return global_max',
        "hint": "Use Kadane's algorithm: at each step, decide whether to extend the current subarray or start a new one.",
        "outputExplanation": "Kadane's algorithm tracks the best subarray ending at each position and the overall best.",
        "tests": [
            {"name": "Classic case", "input": "print(max_subarray([-2, 1, -3, 4, -1, 2, 1, -5, 4]))", "expectedOutput": "6"},
            {"name": "All positive", "input": "print(max_subarray([1, 2, 3, 4]))", "expectedOutput": "10"},
            {"name": "All negative", "input": "print(max_subarray([-1, -2, -3]))", "expectedOutput": "-1"},
            {"name": "Single element", "input": "print(max_subarray([5]))", "expectedOutput": "5"}
        ]
    },
    {
        "id": "binary-search",
        "number": 13,
        "title": "Binary Search",
        "difficulty": "Medium",
        "category": "Searching",
        "tags": ["Searching", "Divide & Conquer"],
        "type": "python",
        "description": 'Write a function `binary_search(arr, target)` that performs binary search on a **sorted** list.\n\nReturn the index of `target` if found, otherwise return `-1`.\n\nYou must implement the algorithm \u2014 do not use `list.index()` or the `bisect` module.',
        "starterCode": 'def binary_search(arr, target):\n    # Your code here - implement binary search\n    pass',
        "solutionCode": 'def binary_search(arr, target):\n    left, right = 0, len(arr) - 1\n    while left <= right:\n        mid = (left + right) // 2\n        if arr[mid] == target:\n            return mid\n        elif arr[mid] < target:\n            left = mid + 1\n        else:\n            right = mid - 1\n    return -1',
        "hint": "Maintain left and right pointers. Compare the middle element with target and narrow the range.",
        "outputExplanation": "Binary search halves the search space each step, giving O(log n) time complexity.",
        "tests": [
            {"name": "Found", "input": "print(binary_search([1, 3, 5, 7, 9], 5))", "expectedOutput": "2"},
            {"name": "Not found", "input": "print(binary_search([1, 3, 5, 7, 9], 4))", "expectedOutput": "-1"},
            {"name": "First element", "input": "print(binary_search([1, 3, 5, 7], 1))", "expectedOutput": "0"},
            {"name": "Last element", "input": "print(binary_search([1, 3, 5, 7], 7))", "expectedOutput": "3"}
        ]
    },
    {
        "id": "longest-common-subsequence",
        "number": 14,
        "title": "Longest Common Subsequence",
        "difficulty": "Hard",
        "category": "Dynamic Programming",
        "tags": ["Dynamic Programming", "Strings"],
        "type": "python",
        "description": 'Write a function `lcs(s1, s2)` that returns the length of the longest common subsequence (LCS) between two strings.\n\nA subsequence is a sequence that appears in the same relative order but not necessarily contiguous.\n\nExample: `lcs("abcde", "ace")` returns `3` (the LCS is "ace").',
        "starterCode": 'def lcs(s1, s2):\n    # Your code here\n    pass',
        "solutionCode": 'def lcs(s1, s2):\n    m, n = len(s1), len(s2)\n    dp = [[0] * (n + 1) for _ in range(m + 1)]\n    for i in range(1, m + 1):\n        for j in range(1, n + 1):\n            if s1[i-1] == s2[j-1]:\n                dp[i][j] = dp[i-1][j-1] + 1\n            else:\n                dp[i][j] = max(dp[i-1][j], dp[i][j-1])\n    return dp[m][n]',
        "hint": "Build a 2D DP table where dp[i][j] = LCS length of s1[:i] and s2[:j]. If characters match, add 1 to the diagonal. Otherwise, take the max of left and above.",
        "outputExplanation": 'For "abcde" and "ace", the DP table builds up to find that the longest common subsequence has length 3 ("ace").',
        "tests": [
            {"name": "Basic case", "input": 'print(lcs("abcde", "ace"))', "expectedOutput": "3"},
            {"name": "No common", "input": 'print(lcs("abc", "def"))', "expectedOutput": "0"},
            {"name": "Same string", "input": 'print(lcs("abc", "abc"))', "expectedOutput": "3"},
            {"name": "Empty string", "input": 'print(lcs("", "abc"))', "expectedOutput": "0"}
        ]
    },
    {
        "id": "word-frequency",
        "number": 15,
        "title": "Word Frequency Counter",
        "difficulty": "Medium",
        "category": "Hash Map",
        "tags": ["Hash Map", "Strings", "Sorting"],
        "type": "python",
        "description": 'Write a function `word_frequency(text)` that takes a string of text and returns a list of `(word, count)` tuples sorted by frequency (descending), then alphabetically for ties.\n\nWords are case-insensitive and separated by whitespace. Strip punctuation from words (keep only alphanumeric characters and hyphens within words).',
        "starterCode": 'def word_frequency(text):\n    # Your code here\n    pass',
        "solutionCode": 'import re\ndef word_frequency(text):\n    words = re.findall(r"[a-zA-Z0-9-]+", text.lower())\n    freq = {}\n    for word in words:\n        freq[word] = freq.get(word, 0) + 1\n    return sorted(freq.items(), key=lambda x: (-x[1], x[0]))',
        "hint": 'Use `re.findall()` to extract words, a dictionary to count, and `sorted()` with a custom key for ordering.',
        "outputExplanation": 'word_frequency("the cat sat on the mat") counts each word and returns sorted by frequency: [("the", 2), ("cat", 1), ("mat", 1), ("on", 1), ("sat", 1)].',
        "tests": [
            {"name": "Basic text", "input": 'print(word_frequency("the cat sat on the mat"))', "expectedOutput": "[('the', 2), ('cat', 1), ('mat', 1), ('on', 1), ('sat', 1)]"},
            {"name": "Single word", "input": 'print(word_frequency("hello hello hello"))', "expectedOutput": "[('hello', 3)]"},
            {"name": "Empty", "input": "print(word_frequency(\"\"))", "expectedOutput": "[]"}
        ]
    },
    {
        "id": "linked-list-cycle",
        "number": 16,
        "title": "Linked List Cycle Detection",
        "difficulty": "Hard",
        "category": "Linked List",
        "tags": ["Two Pointers", "Linked List"],
        "type": "python",
        "description": "Implement a simple `Node` class and a function `has_cycle(head)` that detects if a linked list has a cycle using Floyd's Tortoise and Hare algorithm.\n\nThe `Node` class should have `val` and `next` attributes. The function should return `True` if there is a cycle, `False` otherwise.",
        "starterCode": "class Node:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\ndef has_cycle(head):\n    # Your code here - use Floyd's algorithm\n    pass",
        "solutionCode": "class Node:\n    def __init__(self, val=0, next=None):\n        self.val = val\n        self.next = next\n\ndef has_cycle(head):\n    if not head:\n        return False\n    slow = fast = head\n    while fast and fast.next:\n        slow = slow.next\n        fast = fast.next.next\n        if slow is fast:\n            return True\n    return False",
        "hint": "Use two pointers: slow moves 1 step, fast moves 2 steps. If they meet, there's a cycle.",
        "outputExplanation": "Floyd's algorithm uses O(1) extra space. The slow and fast pointers will meet inside the cycle if one exists.",
        "tests": [
            {"name": "Has cycle", "input": "n1 = Node(1)\nn2 = Node(2)\nn3 = Node(3)\nn1.next = n2\nn2.next = n3\nn3.next = n1\nprint(has_cycle(n1))", "expectedOutput": "True"},
            {"name": "No cycle", "input": "n1 = Node(1)\nn2 = Node(2)\nn1.next = n2\nprint(has_cycle(n1))", "expectedOutput": "False"},
            {"name": "Single node no cycle", "input": "n1 = Node(1)\nprint(has_cycle(n1))", "expectedOutput": "False"}
        ]
    },
    {
        "id": "bfs-shortest-path",
        "number": 17,
        "title": "BFS Shortest Path",
        "difficulty": "Hard",
        "category": "Graphs",
        "tags": ["BFS", "Graphs", "Queues"],
        "type": "python",
        "description": 'Write a function `shortest_path(graph, start, end)` that finds the shortest path between two nodes in an **unweighted** graph using BFS.\n\nThe graph is given as a dictionary where keys are node labels and values are lists of neighboring nodes.\n\nReturn the shortest path as a list of nodes, or an empty list if no path exists.',
        "starterCode": 'from collections import deque\n\ndef shortest_path(graph, start, end):\n    # Your code here - use BFS\n    pass',
        "solutionCode": 'from collections import deque\n\ndef shortest_path(graph, start, end):\n    if start == end:\n        return [start]\n    queue = deque([[start]])\n    visited = {start}\n    while queue:\n        path = queue.popleft()\n        node = path[-1]\n        for neighbor in graph.get(node, []):\n            if neighbor == end:\n                return path + [neighbor]\n            if neighbor not in visited:\n                visited.add(neighbor)\n                queue.append(path + [neighbor])\n    return []',
        "hint": "Use BFS with a queue of paths. Track visited nodes to avoid cycles.",
        "outputExplanation": "BFS explores all nodes at distance 1, then 2, etc., guaranteeing the first path found is shortest.",
        "tests": [
            {"name": "Simple path", "input": 'g = {"A": ["B", "C"], "B": ["D"], "C": ["D"], "D": []}\nprint(shortest_path(g, "A", "D"))', "expectedOutput": "['A', 'B', 'D']"},
            {"name": "No path", "input": 'g = {"A": ["B"], "B": [], "C": ["D"]}\nprint(shortest_path(g, "A", "D"))', "expectedOutput": "[]"},
            {"name": "Start equals end", "input": 'g = {"A": ["B"]}\nprint(shortest_path(g, "A", "A"))', "expectedOutput": "['A']"}
        ]
    },
    {
        "id": "implement-queue-stacks",
        "number": 18,
        "title": "Queue using Stacks",
        "difficulty": "Hard",
        "category": "Data Structures",
        "tags": ["Stack", "Queue", "Design"],
        "type": "python",
        "description": 'Implement a queue using two stacks. Create a class `QueueViaStacks` with the following methods:\n- `push(x)`: Add element to the back\n- `pop()`: Remove and return the front element\n- `peek()`: Return the front element without removing it\n- `empty()`: Return `True` if the queue is empty',
        "starterCode": 'class QueueViaStacks:\n    def __init__(self):\n        # Your code here\n        pass\n\n    def push(self, x):\n        pass\n\n    def pop(self):\n        pass\n\n    def peek(self):\n        pass\n\n    def empty(self):\n        pass',
        "solutionCode": 'class QueueViaStacks:\n    def __init__(self):\n        self.in_stack = []\n        self.out_stack = []\n\n    def push(self, x):\n        self.in_stack.append(x)\n\n    def _transfer(self):\n        if not self.out_stack:\n            while self.in_stack:\n                self.out_stack.append(self.in_stack.pop())\n\n    def pop(self):\n        self._transfer()\n        return self.out_stack.pop()\n\n    def peek(self):\n        self._transfer()\n        return self.out_stack[-1]\n\n    def empty(self):\n        return not self.in_stack and not self.out_stack',
        "hint": "Use two stacks: one for pushing, one for popping. Transfer elements from push-stack to pop-stack when the pop-stack is empty.",
        "outputExplanation": "Two stacks simulate a FIFO queue. The push stack receives new elements, and the pop stack reverses them to maintain FIFO order.",
        "tests": [
            {"name": "Basic operations", "input": "q = QueueViaStacks()\nq.push(1)\nq.push(2)\nq.push(3)\nprint(q.pop(), q.pop(), q.peek(), q.empty())", "expectedOutput": "1 2 3 False"},
            {"name": "Empty queue", "input": "q = QueueViaStacks()\nprint(q.empty())", "expectedOutput": "True"},
            {"name": "Push pop interleaved", "input": "q = QueueViaStacks()\nq.push(10)\nprint(q.pop())\nq.push(20)\nprint(q.pop())", "expectedOutput": "10\n20"}
        ]
    },
    {
        "id": "json-parser",
        "number": 19,
        "title": "Simple JSON Parser",
        "difficulty": "Hard",
        "category": "Parsing",
        "tags": ["Parsing", "Strings", "Recursion"],
        "type": "python",
        "description": 'Write a function `parse_json(s)` that parses a simple JSON string into a Python object.\n\nYou need to handle:\n- Strings: `"hello"`\n- Numbers: `42`, `3.14`\n- Booleans: `true`, `false`\n- Null: `null`\n- Arrays: `[1, 2, 3]`\n- Objects: `{"key": "value"}`\n\nYou may use a simple recursive descent approach. Return `None` for JSON `null`.',
        "starterCode": 'def parse_json(s):\n    # Your code here\n    pass',
        "solutionCode": """def parse_json(s):
    def skip_whitespace():
        nonlocal i
        while i < len(s) and s[i] in ' \\t\\n\\r':
            i += 1

    def parse_value():
        nonlocal i
        skip_whitespace()
        if i >= len(s):
            return None
        c = s[i]
        if c == '"': return parse_string()
        if c == '{': return parse_object()
        if c == '[': return parse_array()
        if c == 't':
            i += 4; return True
        if c == 'f':
            i += 5; return False
        if c == 'n':
            i += 4; return None
        return parse_number()

    def parse_string():
        nonlocal i
        i += 1
        start = i
        while i < len(s) and s[i] != '"':
            if s[i] == '\\\\': i += 2
            else: i += 1
        result = s[start:i]
        i += 1
        return result

    def parse_number():
        nonlocal i
        start = i
        if s[i] == '-': i += 1
        while i < len(s) and (s[i].isdigit() or s[i] == '.'):
            i += 1
        val = s[start:i]
        return int(val) if '.' not in val else float(val)

    def parse_array():
        nonlocal i
        i += 1
        result = []
        skip_whitespace()
        if i < len(s) and s[i] == ']':
            i += 1
            return result
        while True:
            result.append(parse_value())
            skip_whitespace()
            if i < len(s) and s[i] == ']':
                i += 1
                break
            i += 1
        return result

    def parse_object():
        nonlocal i
        i += 1
        result = {}
        skip_whitespace()
        if i < len(s) and s[i] == '}':
            i += 1
            return result
        while True:
            skip_whitespace()
            key = parse_string()
            skip_whitespace()
            i += 1
            val = parse_value()
            result[key] = val
            skip_whitespace()
            if i < len(s) and s[i] == '}':
                i += 1
                break
            i += 1
        return result

    i = 0
    return parse_value()""",
        "hint": "Use a recursive descent parser with an index pointer. Handle each JSON value type with its own parse function.",
        "outputExplanation": "The parser reads character by character, dispatching to type-specific parse functions based on the current character.",
        "tests": [
            {"name": "Parse number", "input": 'print(parse_json("42"))', "expectedOutput": "42"},
            {"name": "Parse string", "input": "print(parse_json('\"hello\"'))", "expectedOutput": "hello"},
            {"name": "Parse array", "input": 'print(parse_json("[1, 2, 3]"))', "expectedOutput": "[1, 2, 3]"},
            {"name": "Parse object", "input": "print(parse_json('{\"a\": 1, \"b\": 2}'))", "expectedOutput": "{'a': 1, 'b': 2}"}
        ]
    },
    {
        "id": "lru-cache",
        "number": 20,
        "title": "LRU Cache",
        "difficulty": "Hard",
        "category": "Design",
        "tags": ["Design", "Hash Map", "Linked List"],
        "type": "python",
        "description": 'Implement an LRU (Least Recently Used) cache with a capacity limit.\n\nCreate a class `LRUCache` with:\n- `__init__(capacity)`: Initialize with max capacity\n- `get(key)`: Return the value if exists and move to most-recently-used. Return `-1` if not found.\n- `put(key, value)`: Add/update key-value. If over capacity, evict the least recently used.',
        "starterCode": 'from collections import OrderedDict\n\nclass LRUCache:\n    def __init__(self, capacity):\n        # Your code here\n        pass\n\n    def get(self, key):\n        pass\n\n    def put(self, key, value):\n        pass',
        "solutionCode": 'from collections import OrderedDict\n\nclass LRUCache:\n    def __init__(self, capacity):\n        self.cache = OrderedDict()\n        self.capacity = capacity\n\n    def get(self, key):\n        if key in self.cache:\n            self.cache.move_to_end(key)\n            return self.cache[key]\n        return -1\n\n    def put(self, key, value):\n        if key in self.cache:\n            self.cache.move_to_end(key)\n        self.cache[key] = value\n        if len(self.cache) > self.capacity:\n            self.cache.popitem(last=False)',
        "hint": "Python's `collections.OrderedDict` is perfect \u2014 `move_to_end()` marks as recently used, `popitem(last=False)` removes the oldest.",
        "outputExplanation": "OrderedDict maintains insertion order. move_to_end() moves a key to the end (most recent), popitem(last=False) removes the first (least recent).",
        "tests": [
            {"name": "Basic operations", "input": "cache = LRUCache(2)\ncache.put(1, 1)\ncache.put(2, 2)\nprint(cache.get(1))\ncache.put(3, 3)\nprint(cache.get(2))", "expectedOutput": "1\n-1"},
            {"name": "Update existing", "input": "cache = LRUCache(2)\ncache.put(1, 1)\ncache.put(2, 2)\ncache.put(1, 10)\ncache.put(3, 3)\nprint(cache.get(2))\nprint(cache.get(1))", "expectedOutput": "-1\n10"}
        ]
    },
    {
        "id": "count-vowels",
        "number": 21,
        "title": "Count Vowels and Consonants",
        "difficulty": "Easy",
        "category": "Strings",
        "tags": ["Strings", "Loops"],
        "type": "python",
        "description": 'Write a function `count_chars(s)` that returns a tuple `(vowels, consonants)` where:\n- `vowels` is the count of vowel characters (a, e, i, o, u \u2014 case-insensitive)\n- `consonants` is the count of alphabetic characters that are not vowels\n\nIgnore non-alphabetic characters.',
        "starterCode": 'def count_chars(s):\n    # Your code here\n    pass',
        "solutionCode": 'def count_chars(s):\n    vowels = set("aeiou")\n    v = c = 0\n    for char in s.lower():\n        if char.isalpha():\n            if char in vowels:\n                v += 1\n            else:\n                c += 1\n    return (v, c)',
        "hint": "Convert to lowercase, iterate, use a set of vowels for O(1) lookup.",
        "outputExplanation": 'count_chars("Hello World!") counts e,o (2 vowels) and h,l,l,w,r,l,d (7 consonants), returning (2, 7).',
        "tests": [
            {"name": "Basic case", "input": 'print(count_chars("Hello World!"))', "expectedOutput": "(3, 7)"},
            {"name": "All vowels", "input": 'print(count_chars("aeiou"))', "expectedOutput": "(5, 0)"},
            {"name": "Empty", "input": 'print(count_chars(""))', "expectedOutput": "(0, 0)"}
        ]
    },
    {
        "id": "matrix-rotate",
        "number": 22,
        "title": "Rotate Matrix 90\u00b0",
        "difficulty": "Hard",
        "category": "Matrix",
        "tags": ["Matrix", "In-Place"],
        "type": "python",
        "description": "Write a function `rotate_matrix(matrix)` that rotates an n\u00d7n matrix 90 degrees clockwise **in-place**.\n\nExample:\n```\n[[1, 2],    [[3, 1],\n [3, 4]] \u2192   [4, 2]]\n```\n\nThe function should modify the matrix in place and also return it.",
        "starterCode": 'def rotate_matrix(matrix):\n    # Your code here - rotate in-place\n    pass',
        "solutionCode": 'def rotate_matrix(matrix):\n    n = len(matrix)\n    # Transpose\n    for i in range(n):\n        for j in range(i + 1, n):\n            matrix[i][j], matrix[j][i] = matrix[j][i], matrix[i][j]\n    # Reverse each row\n    for row in matrix:\n        row.reverse()\n    return matrix',
        "hint": "Two-step approach: first transpose (swap across diagonal), then reverse each row.",
        "outputExplanation": "Transposing swaps rows and columns, then reversing each row completes the 90\u00b0 clockwise rotation.",
        "tests": [
            {"name": "2x2 matrix", "input": "print(rotate_matrix([[1, 2], [3, 4]]))", "expectedOutput": "[[3, 1], [4, 2]]"},
            {"name": "3x3 matrix", "input": "print(rotate_matrix([[1,2,3],[4,5,6],[7,8,9]]))", "expectedOutput": "[[7, 4, 1], [8, 5, 2], [9, 6, 3]]"},
            {"name": "1x1 matrix", "input": "print(rotate_matrix([[5]]))", "expectedOutput": "[[5]]"}
        ]
    },
    {
        "id": "validate-sudoku",
        "number": 23,
        "title": "Validate Sudoku Board",
        "difficulty": "Hard",
        "category": "Matrix",
        "tags": ["Matrix", "Hash Set"],
        "type": "python",
        "description": 'Write a function `is_valid_sudoku(board)` that checks if a 9\u00d79 Sudoku board is valid.\n\nA valid board has:\n- Each row containing digits 1-9 without repetition\n- Each column containing digits 1-9 without repetition\n- Each of the nine 3\u00d73 sub-boxes containing digits 1-9 without repetition\n\nEmpty cells are represented as `0`. The board need not be solvable or complete \u2014 just check no duplicates in rows, columns, or boxes.',
        "starterCode": 'def is_valid_sudoku(board):\n    # Your code here\n    pass',
        "solutionCode": 'def is_valid_sudoku(board):\n    for i in range(9):\n        row = set()\n        col = set()\n        box = set()\n        for j in range(9):\n            if board[i][j] != 0:\n                if board[i][j] in row: return False\n                row.add(board[i][j])\n            if board[j][i] != 0:\n                if board[j][i] in col: return False\n                col.add(board[j][i])\n            r, c = 3 * (i // 3), 3 * (i % 3)\n            val = board[r + j // 3][c + j % 3]\n            if val != 0:\n                if val in box: return False\n                box.add(val)\n    return True',
        "hint": "Use sets to track seen numbers in each row, column, and 3\u00d73 box. Check all three simultaneously in nested loops.",
        "outputExplanation": "The algorithm iterates through each row, column, and box using sets to detect duplicates.",
        "tests": [
            {"name": "Valid board", "input": "board = [\n  [5,3,0,0,7,0,0,0,0],\n  [6,0,0,1,9,5,0,0,0],\n  [0,9,8,0,0,0,0,6,0],\n  [8,0,0,0,6,0,0,0,3],\n  [4,0,0,8,0,3,0,0,1],\n  [7,0,0,0,2,0,0,0,6],\n  [0,6,0,0,0,0,2,8,0],\n  [0,0,0,4,1,9,0,0,5],\n  [0,0,0,0,8,0,0,7,9]\n]\nprint(is_valid_sudoku(board))", "expectedOutput": "True"},
            {"name": "Invalid board (duplicate in row)", "input": "board = [\n  [5,5,0,0,7,0,0,0,0],\n  [6,0,0,1,9,5,0,0,0],\n  [0,9,8,0,0,0,0,6,0],\n  [8,0,0,0,6,0,0,0,3],\n  [4,0,0,8,0,3,0,0,1],\n  [7,0,0,0,2,0,0,0,6],\n  [0,6,0,0,0,0,2,8,0],\n  [0,0,0,4,1,9,0,0,5],\n  [0,0,0,0,8,0,0,7,9]\n]\nprint(is_valid_sudoku(board))", "expectedOutput": "False"}
        ]
    },
    {
        "id": "generators-101",
        "number": 24,
        "title": "Prime Number Generator",
        "difficulty": "Medium",
        "category": "Generators",
        "tags": ["Generators", "Algorithms"],
        "type": "python",
        "description": 'Write a generator function `primes()` that yields prime numbers indefinitely, one at a time.\n\nAlso write a function `first_n_primes(n)` that uses the generator to return a list of the first `n` prime numbers.',
        "starterCode": 'def primes():\n    # Your code here - yield primes indefinitely\n    pass\n\ndef first_n_primes(n):\n    # Use the primes() generator\n    pass',
        "solutionCode": 'def primes():\n    yield 2\n    candidate = 3\n    while True:\n        is_prime = True\n        i = 3\n        while i * i <= candidate:\n            if candidate % i == 0:\n                is_prime = False\n                break\n            i += 2\n        if is_prime:\n            yield candidate\n        candidate += 2\n\ndef first_n_primes(n):\n    gen = primes()\n    return [next(gen) for _ in range(n)]',
        "hint": "Use `yield` to create a generator. Start with 2, then check odd numbers for primality using trial division.",
        "outputExplanation": "The generator yields 2, then checks each odd number for primality. first_n_primes(n) collects the first n values.",
        "tests": [
            {"name": "First 5 primes", "input": "print(first_n_primes(5))", "expectedOutput": "[2, 3, 5, 7, 11]"},
            {"name": "First 10 primes", "input": "print(first_n_primes(10))", "expectedOutput": "[2, 3, 5, 7, 11, 13, 17, 19, 23, 29]"},
            {"name": "First prime only", "input": "print(first_n_primes(1))", "expectedOutput": "[2]"}
        ]
    }
]

for p in problems:
    filename = f"{p['number']:03d}-{p['id']}.json"
    filepath = os.path.join(PROBLEMS_DIR, filename)
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(p, f, indent=2, ensure_ascii=False)
    print(f"Created: {filename}")

print(f"\nGenerated {len(problems)} Python problem files")
