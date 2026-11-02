"""
LESSON 3: Parsing an HTML Table
===============================

Lesson 2 gave you HTML as one long string. This lesson turns a table inside
that HTML into Python data you can work with: a list of rows, each row a list
of values.

Learning objectives
-------------------
By the end of this lesson you can:
  1. Read the structure of an HTML table (tags, nesting).
  2. Parse HTML with BeautifulSoup.
  3. Find elements with find and find_all.
  4. Extract clean text from a cell.
  5. Convert text to numbers safely.
  6. Skip a header row and reject malformed rows.
  7. Combine these steps into one parsing function.

Setup (do this first)
---------------------
Install into the SAME Python that runs your file (see flashcard "pip install"):

    python -m pip install beautifulsoup4

Check:

    python -c "import bs4; print(bs4.__version__)"

The package is named beautifulsoup4, but you import it as bs4.

How to use this file
--------------------
  - Read each Part and run the file to see the demo output.
  - Fill in the TODO functions. Do not edit the tests at the bottom.
  - Every test uses HTML written in this file, so no internet is needed.
"""

from bs4 import BeautifulSoup


# =============================================================================
# PART 1. WHAT HTML LOOKS LIKE
# =============================================================================
# HTML is text made of TAGS. A tag has an opening part and a closing part,
# and it can contain text or other tags. Tags nest like boxes in boxes.
#
#   <table>              the whole table
#     <tr>               one ROW
#       <th>Name</th>    a header cell
#       <th>Age</th>
#     </tr>
#     <tr>
#       <td>Ana</td>     a data cell
#       <td>31</td>
#     </tr>
#   </table>
#
# th = table header cell, td = table data cell, tr = table row.
# A tag can have ATTRIBUTES inside the opening tag: <a href="http://x.com">
# Real pages often wrap cell text in more tags, e.g. <td><p><span>31</span></p></td>.

PEOPLE = """
<table>
  <tr><th>Name</th><th>Age</th><th>City</th></tr>
  <tr><td>Ana</td><td>31</td><td>Lima</td></tr>
  <tr><td>Bo</td><td>27</td><td>Oslo</td></tr>
</table>
"""


# =============================================================================
# PART 2. BEAUTIFULSOUP BASICS
# =============================================================================
# BeautifulSoup(html_string, "html.parser") reads HTML text and builds a tree
# of objects you can search. "html.parser" is the built-in parser; it needs no
# extra install.

soup = BeautifulSoup(PEOPLE, "html.parser")
print("type:", type(soup).__name__)          # BeautifulSoup

# Each tag in the tree is a Tag object.
table = soup.find("table")
print("found:", table.name)                  # table


# =============================================================================
# PART 3. FINDING ELEMENTS
# =============================================================================
# find(name)      returns the FIRST matching tag, or None if there is none.
# find_all(name)  returns a list-like of ALL matching tags (empty if none).
#
# You can call them on any tag, not just the soup. A search on a tag looks only
# INSIDE that tag, at any depth.

rows = table.find_all("tr")
print("rows:", len(rows))                    # 3 (header row counts)

first_row = rows[0]
cells_in_first_row = first_row.find_all("th")
print("header cells:", len(cells_in_first_row))   # 3

# The result of find_all works like a list: len(), indexing, slicing, for loops.
for r in rows:
    print("this row has", len(r.find_all(["td", "th"])), "cells")

# Passing a LIST of names matches any of them: find_all(["td", "th"]) returns
# header cells and data cells in document order.

# find returns None when nothing matches. Calling a method on None crashes with
# AttributeError, so guard it:
missing = soup.find("ul")
print("missing is None:", missing is None)   # True


# =============================================================================
# PART 4. EXTRACTING CLEAN TEXT
# =============================================================================
# tag.get_text() returns all the text inside a tag, including text in nested
# tags. get_text(strip=True) also trims whitespace from the ends.

cell = BeautifulSoup("<td>  <p><span> 31 </span></p> </td>", "html.parser").find("td")
print(repr(cell.get_text()))                 # '   31  ' (spacing varies)
print(repr(cell.get_text(strip=True)))       # '31'

# The result is always a STRING, even if it looks like a number.
print(type(cell.get_text(strip=True)).__name__)   # str

# Attributes are read with .get(name), which returns None if absent:
link = BeautifulSoup('<a href="http://x.com">go</a>', "html.parser").find("a")
print(link.get("href"), link.get("id"))      # http://x.com None

# Web pages sometimes contain a non-breaking space (\xa0) that looks like a
# space. Python's str.strip() removes it, so strip() is safe to use on cell text.
print(repr("\xa0 hi \xa0".strip()))          # 'hi'


# =============================================================================
# PART 5. CONVERTING TEXT TO NUMBERS SAFELY
# =============================================================================
# int(text) converts a string like "31" to the integer 31.
#   int("31")     -> 31
#   int(" 31 ")   -> 31      (surrounding spaces are allowed)
#   int("3.5")    -> ValueError
#   int("abc")    -> ValueError
#   int("")       -> ValueError
#
# Table cells are not always clean. Wrap the conversion in try/except and
# return None when it cannot be converted:

def to_number(text):
    try:
        return int(text)
    except ValueError:
        return None

print(to_number("31"), to_number("abc"))     # 31 None

# A caller can then test the result:
#   n = to_number(cell_text)
#   if n is None:
#       skip this row
# Note: 0 is a valid number but is falsy, so test `n is None`, not `if not n`.


# =============================================================================
# PART 6. HEADERS AND MALFORMED ROWS
# =============================================================================
# The first row of many tables is a header ("Name", "Age"). It is labels, not
# data. Skip it with a slice: rows[1:] is every row except the first.

data_rows = [["Name", "Age"], ["Ana", "31"], ["Bo", "27"]]
print(data_rows[1:])                         # [['Ana', '31'], ['Bo', '27']]

# Real tables also contain bad rows: empty rows, merged cells, notes. Check the
# shape before you use a row:
#
#   if len(row) != 3:
#       continue          # skip to the next loop turn
#
# `continue` jumps to the next item of the loop without running the rest of the
# loop body.

for row in [["a", "b", "c"], ["only one"], ["x", "y", "z"]]:
    if len(row) != 3:
        continue
    print("good row:", row)


# =============================================================================
# PART 7. WORKED EXAMPLE (a different table)
# =============================================================================
# Goal: turn a scores table into a dict mapping name -> score (an int).
#   dict:  {key: value, ...}   d["Ana"] reads, d["Ana"] = 5 sets/adds.

SCORES = """
<table>
  <tr><th>Player</th><th>Score</th></tr>
  <tr><td>Zed</td><td>12</td></tr>
  <tr><td>Kim</td><td>n/a</td></tr>
  <tr><td>Lee</td><td>9</td></tr>
</table>
"""

def parse_scores(html):
    soup = BeautifulSoup(html, "html.parser")
    result = {}
    for tr in soup.find("table").find_all("tr")[1:]:      # skip header
        cells = [td.get_text(strip=True) for td in tr.find_all("td")]
        if len(cells) != 2:
            continue
        score = to_number(cells[1])
        if score is None:
            continue                                      # drop "n/a"
        result[cells[0]] = score
    return result

print(parse_scores(SCORES))                  # {'Zed': 12, 'Lee': 9}


# =============================================================================
# EXERCISES
# =============================================================================

# ---- Exercise 1 -------------------------------------------------------------
def get_cells(html):
    """Return a list of the cleaned text of every <td> in html, in order.
    Header (<th>) cells are NOT included.
    get_cells(PEOPLE) -> ["Ana", "31", "Lima", "Bo", "27", "Oslo"]
    Needs: Parts 2, 3 and 4.
    Plan: parse with BeautifulSoup, find_all("td"), and build a list of
    get_text(strip=True) for each cell (a list comprehension works well).
    """
    soup = BeautifulSoup(html, "html.parser")
    return [td.get_text(strip=True) for td in soup.find_all("td")]
    pass


# ---- Exercise 2 -------------------------------------------------------------
def get_rows(html):
    """Return a list of rows. Each row is a list of the cleaned text of its
    <td> AND <th> cells, in order. Include the header row.
    get_rows(PEOPLE)[0] -> ["Name", "Age", "City"]
    Needs: Parts 3 and 4 (find_all with a list of tag names).
    Plan: for every <tr>, build a list of cell texts, and collect those lists.
    """
    result = []
    soup = BeautifulSoup(html, "html.parser")
    rows = soup.find_all("tr")
    for tr in rows:
        text = [cell.get_text(strip=True) for cell in tr.find_all(["td", "th"])]
        result.append(text)
    return result
    pass


# ---- Exercise 3 -------------------------------------------------------------
def to_int(text):
    """Convert text to an int and return it. If it cannot be converted,
    return None. Surrounding whitespace is allowed.
    to_int(" 7 ") -> 7      to_int("x") -> None      to_int("0") -> 0
    Needs: Part 5.
    """
    try:
        return int(text)
    except ValueError:
        return None
    pass


# ---- Exercise 4 -------------------------------------------------------------
def drop_header(rows):
    """Return rows without its first row. Return [] for an empty list.
    The original list must not change.
    Needs: Part 6 (slicing).
    """
    return rows[1:]
    pass


# ---- Exercise 5 (challenge) -------------------------------------------------
def parse_people(html):
    """Return a list of (name, age, city) tuples from a people table like
    PEOPLE. The age must be an int. Rules:
      - skip the header row
      - skip any row that does not have exactly 3 cells
      - skip any row whose age cannot be converted to an int
    parse_people(PEOPLE) -> [("Ana", 31, "Lima"), ("Bo", 27, "Oslo")]
    Needs: all Parts, plus Exercises 2, 3 and 4 as helpers.
    Plan: get_rows -> drop_header -> loop; for each row check the length,
    convert the age with to_int, skip on None, then append a tuple.
    """
    result = []
    rows = get_rows(html)
    rowData = drop_header(rows)
    for cell in rowData:
        if len(cell) != 3:
            continue
        age = to_int(cell[1])
        if age is None:
            continue
        cell[1] = age
        result.append(tuple(cell))
    return result
    

    pass


# =============================================================================
# CHECK YOUR WORK
# =============================================================================
# Tests live in check_lesson_03.py. Run one exercise at a time to see the exact
# input, the expected result and what your function returned:
#
#   python check_lesson_03.py 2        (full detail for exercise 2)
#   python check_lesson_03.py          (summary of all exercises)
