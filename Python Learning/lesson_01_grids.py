"""
LESSON 1: Decomposition and 2D Grids
====================================

Course goal: write decode_message(url), which reads a Google Doc table of
(x, y, character) rows and prints the hidden message as a grid of characters.

Learning objectives
-------------------
By the end of this lesson you can:
  1. Split a problem into small functions with clear inputs and outputs.
  2. Represent a 2D grid as a list of lists and index it as grid[row][col].
  3. Create a grid without the shared-row aliasing bug.
  4. Place characters on a grid from (x, y) coordinates.
  5. Compute grid dimensions from data.

How to use this file
--------------------
  - Read each section. Run the file after each exercise:  python lesson_01_grids.py
  - Fill in the functions marked  TODO.  Do not edit the tests at the bottom.
  - The test report at the end shows PASS / FAIL for each exercise.
  - Exercises are ordered. Later ones reuse earlier ones.
"""


# =============================================================================
# PART 1. DECOMPOSITION
# =============================================================================
# One big function is hard to write, test, and debug. Instead, split the job
# into steps. Each step is a function with one input type and one output type.
#
#   fetch_html(url)        str                 -> str       (Lesson 2)
#   parse_table(html)      str                 -> list of (x, y, char)  (Lesson 3)
#   build_grid(points)     list of tuples      -> list of lists         (this lesson)
#   print_grid(grid)       list of lists       -> None (prints)         (this lesson)
#   decode_message(url)    calls all of above
#
# Rule: test each function alone before you combine them.


# =============================================================================
# PART 2. GRIDS AS LISTS OF LISTS
# =============================================================================
# A grid is a list of rows. Each row is a list of cells.

example = [
    ["a", "b", "c"],
    ["d", "e", "f"],
]

# Indexing is grid[row][col]. Row first.
#   example[1][2]  ->  "f"      (row 1, column 2)
#   example[0][0]  ->  "a"
#   len(example)    -> 2        (number of rows = height)
#   len(example[0]) -> 3        (cells in a row = width)

# Coordinates are usually written (x, y).
#   x = column index,  y = row index.
# So the point (x=2, y=1) lives at grid[1][2]. Note the swap: grid[y][x].
# This swap is the most common bug in this kind of task.

# Worked example: read a cell using (x, y).
x, y = 2, 1
print("Cell at (x=2, y=1):", example[y][x])


# =============================================================================
# PART 3. THE ALIASING TRAP
# =============================================================================
# Multiplying a list copies references, not values.

bad = [[" "] * 3] * 3             # two names for ONE row
bad[0][0] = "X"
print("bad grid :", bad)           # both rows changed!

good = [[" "] * 3 for _ in range(2)]   # a new row each loop
good[0][0] = "X"
print("good grid:", good)          # only one cell changed

# Why: [" "] * 3 makes one row object. The outer "* 2" repeats a reference to
# that same object. A list comprehension runs the inner expression again for
# every row, so each row is a separate object.


# =============================================================================
# PART 4. LOOPS, STRINGS, AND PRINTING   (needed for Exercise 2)
# =============================================================================
# A for-loop visits every item in a list, one at a time.

fruits = ["apple", "pear", "plum"]
for fruit in fruits:
    print("I see a", fruit)

# A grid is a list of rows, so looping over a grid gives you one ROW per turn.
scores = [[1, 2], [3, 4]]
for row in scores:
    print("row is:", row)           # row is: [1, 2]   then   row is: [3, 4]

# A string is a sequence of characters. Strings can be glued together.
# "".join(list_of_strings) glues a list of strings into ONE string.
# The quotes before .join are the separator placed between items.
letters = ["h", "i", "!"]
print("".join(letters))             # hi!
print("-".join(letters))            # h-i-!
print(" ".join(letters))            # h i !

# join works only on strings. A row that holds numbers needs str() first.
#   "".join([1, 2])                 # TypeError
#   "".join(str(n) for n in [1, 2]) # "12"
# Our grid cells are already one-character strings, so no str() is needed.

# print() ends every call with a newline, so each print() is one line.
print("first line")
print("second line")

# Putting it together (different data, same idea): print each word's letters
# on its own line.
words = [["c", "a", "t"], ["d", "o", "g"]]
for word in words:
    print("".join(word))
# cat
# dog


# =============================================================================
# PART 5. TUPLES AND UNPACKING   (needed for Exercise 3)
# =============================================================================
# A tuple is a fixed group of values, written with parentheses.
# The table in the Google Doc gives you rows like (x, y, character).

point = (3, 1, "#")
print(point[0], point[1], point[2])  # index it like a list: 3 1 #

# Unpacking: name every piece in one line. Counts must match.
px, py, ch = point
print("x is", px, "y is", py, "char is", ch)

# Unpack straight in a for-loop header. This is the pattern you want.
pets = [("Rex", 3, "dog"), ("Tom", 5, "cat")]
for name, age, kind in pets:
    print(name, "is a", age, "year old", kind)

# Assigning into a grid cell uses an equals sign on an indexed cell:
#   grid[row][col] = value
# Example on a scoreboard of 2 rows x 3 columns, using (col, row, value) data:
board = [[0, 0, 0], [0, 0, 0]]
for col, row, value in [(0, 0, 9), (2, 1, 7)]:
    board[row][col] = value
print(board)                          # [[9, 0, 0], [0, 0, 7]]
# Notice the order: data comes as (col, row) but the index is board[row][col].


# =============================================================================
# PART 6. FINDING THE BIGGEST VALUE   (needed for Exercises 3 and 5)
# =============================================================================
# max() returns the largest item in a sequence.
print(max([4, 9, 2]))                 # 9

# To take the max of ONE field from many tuples, build a list of that field.
# A list comprehension is a loop written inside square brackets:
#   [expression  for  name  in  sequence]
pets = [("Rex", 3, "dog"), ("Tom", 5, "cat")]
ages = [age for name, age, kind in pets]
print(ages)                           # [3, 5]
print(max(ages))                      # 5

# Counting from zero: if the largest index is 4, there are 5 slots (0,1,2,3,4).
# So size = largest index + 1.

# max() of an empty list crashes: max([]) -> ValueError.
# Guard against it with an if-statement. An empty list counts as False:
empty = []
if not empty:
    print("list is empty, skip max()")
# You can return early from a function to skip the rest of its body:
def first_or_none(items):
    if not items:
        return None
    return items[0]


# =============================================================================
# PART 7. REVERSING, AND COUNTING   (needed for Exercises 4 and 6)
# =============================================================================
# Reverse a list with slicing [::-1], or with reversed().
nums = [1, 2, 3]
print(nums[::-1])                     # [3, 2, 1]  (a new list, nums unchanged)
for n in reversed(nums):
    print(n)                          # 3 then 2 then 1

# Counting with a loop: keep a counter, add 1 when a condition is true.
total = 0
for n in [5, 8, 5, 5]:
    if n == 5:
        total += 1                    # same as total = total + 1
print(total)                          # 3

# Counting inside a grid needs a loop inside a loop (one per row, one per cell).
table = [[5, 8], [5, 5]]
count = 0
for row in table:
    for cell in row:
        if cell == 5:
            count += 1
print(count)                          # 3

# Shortcut: sum() adds numbers, and True counts as 1, False as 0.
print(sum([True, False, True]))       # 2
print(sum(n == 5 for n in [5, 8, 5, 5]))   # 3: add up the comparisons


# =============================================================================
# EXERCISES
# =============================================================================

# ---- Exercise 1 -------------------------------------------------------------
def make_grid(width, height):
    """Return a grid (list of lists) of height rows and width columns.
    Every cell is the string " " (one space).
    Rows must be independent objects (see Part 3).
    """
    grid = [[" "] * width for _ in range(height)]
    return grid
    pass


# ---- Exercise 2 -------------------------------------------------------------
def print_grid(grid):
    """Print each row on its own line with no brackets, quotes, or commas.
    Example: [["a","b"],["c","d"]] prints
        ab
        cd
    Needs: Part 4 (for-loop over rows, "".join, print).
    Plan: loop over the rows; for each row, join it into a string and print it.
    """
    for row in grid:
        print("".join(row))
    pass


# ---- Exercise 3 -------------------------------------------------------------
def build_grid(points):
    """points is a list of (x, y, char) tuples.
    Return a grid just big enough to hold every point.
    Convention for this course: y = 0 is the TOP row.
    Empty cells are " ".
    Needs: Parts 2, 3, 5 and 6, plus Exercises 1 and 5.
    Plan: (1) get the width and height, (2) make an empty grid of that size,
    (3) loop over the points, unpacking x, y, char, and (4) assign
    grid[y][x] = char. Remember the row index comes first.
    Do Exercise 5 before this one, then call get_size and make_grid here.
    """
    grid = make_grid(get_size(points)[0], get_size(points)[1])
    for col, row, char in points:
        grid[row][col] = char
    return grid
    pass


# ---- Exercise 4 (written answer, no code) -----------------------------------
# In a maths graph, y = 0 is the BOTTOM and y grows upward.
# In our grid above, y = 0 is the TOP because row 0 prints first.
#
# Write your answers as comments below:
# Needs: Part 7 (reversing). Picture the rows printed top to bottom; flipping
# them means printing the last row first.
#
#   a) The message looks upside down when printed. What is the smallest change
#      you could make (in build_grid OR print_grid) to fix it?
#   b) Which of the two places would you change, and why?
#
# ANSWER a:
# ANSWER b:


# ---- Exercise 5 -------------------------------------------------------------
def get_size(points):
    """Return (width, height) for a list of (x, y, char) points.
    Coordinates start at 0, so the largest x of 4 means width 5.
    Return (0, 0) for an empty list.
    Needs: Part 6 (max, list comprehension, empty-list guard, largest + 1).
    Plan: if points is empty, return (0, 0). Otherwise build a list of all
    the x values and a list of all the y values, take the max of each, add 1,
    and return them as a tuple (width, height).
    """
    if not points:
            return (0, 0)
    else:
        width = max([x for x, y, char in points]) + 1
        height = max([y for x, y, char in points]) + 1
    return (width, height)
    pass


# ---- Exercise 6 (challenge) -------------------------------------------------
def count_chars(grid, char):
    """Return how many cells in the grid equal char.
    Needs: Part 7 (counting with nested loops, or sum of comparisons).
    Plan: loop over rows, then over cells in each row, and add 1 to a counter
    whenever the cell equals char. Return the counter.
    """
    count = 0
    for row in grid:
        for col in row:
            if col == char:
                count += 1
    return count
    pass


# =============================================================================
# TESTS (do not edit below this line)
# =============================================================================
_results = []


def _check(name, func):
    try:
        ok = func()
    except Exception as e:           # unfinished stubs often raise errors
        ok = False
        name = f"{name}  [{type(e).__name__}: {e}]"
    _results.append((name, bool(ok)))


def _t1():
    g = make_grid(3, 2)
    if g != [[" ", " ", " "], [" ", " ", " "]]:
        return False
    g[0][0] = "X"
    return g[1][0] == " "              # rows must be independent


def _t2():
    import io
    import contextlib
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        print_grid([["a", "b"], ["c", "d"]])
    return buf.getvalue() == "ab\ncd\n"


def _t3():
    pts = [(0, 0, "#"), (2, 1, "#"), (1, 1, "@")]
    return build_grid(pts) == [["#", " ", " "], [" ", "@", "#"]]


def _t5():
    return (get_size([(0, 0, "a"), (4, 2, "b")]) == (5, 3)
            and get_size([]) == (0, 0))


def _t6():
    g = [["#", " "], ["#", "#"]]
    return count_chars(g, "#") == 3 and count_chars(g, "z") == 0


if __name__ == "__main__":
    _check("Exercise 1  make_grid", _t1)
    _check("Exercise 2  print_grid", _t2)
    _check("Exercise 3  build_grid", _t3)
    _check("Exercise 5  get_size", _t5)
    _check("Exercise 6  count_chars", _t6)

    print("\n--- TEST REPORT ---")
    for name, ok in _results:
        print(("PASS  " if ok else "FAIL  ") + name)
    print(f"{sum(ok for _, ok in _results)}/{len(_results)} passed")
