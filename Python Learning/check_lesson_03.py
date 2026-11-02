"""Tests for lesson_03_parsing.py. No internet needed.
Run:  python check_lesson_03.py        (summary)
      python check_lesson_03.py 2      (full detail for exercise 2)
Or press Run and set ONLY below. Do not edit anything else in this file."""

ONLY = None   # for example ONLY = [2] to see detail for exercise 2 when you press Run

import checker

L = checker.load_lesson("lesson_03_parsing")
PEOPLE = L.PEOPLE

MESSY = """
<table>
  <tr><th>Name</th><th>Age</th><th>City</th></tr>
  <tr><td>Ana</td><td> 31 </td><td><p><span>Lima</span></p></td></tr>
  <tr><td>Note: ages are approximate</td></tr>
  <tr><td>Cy</td><td>unknown</td><td>Rome</td></tr>
  <tr><td>Bo</td><td>0</td><td>Oslo</td></tr>
</table>
"""


def _drop_keeps_original():
    rows = [["h"], ["a"], ["b"]]
    out = L.drop_header(rows)
    return out, rows


EXERCISES = {
    1: ("get_cells", [
        ("get_cells(PEOPLE)", lambda: L.get_cells(PEOPLE), ["Ana", "31", "Lima", "Bo", "27", "Oslo"]),
        ("get_cells('<p>no table</p>')", lambda: L.get_cells("<p>no table</p>"), []),
    ]),
    2: ("get_rows", [
        ("get_rows(PEOPLE)", lambda: L.get_rows(PEOPLE),
         [["Name", "Age", "City"], ["Ana", "31", "Lima"], ["Bo", "27", "Oslo"]]),
        ("get_rows(MESSY)[1]   (nested <p><span> tags, extra spaces)", lambda: L.get_rows(MESSY)[1],
         ["Ana", "31", "Lima"]),
    ]),
    3: ("to_int", [
        ("to_int(' 7 ')", lambda: L.to_int(" 7 "), 7),
        ("to_int('0')", lambda: L.to_int("0"), 0),
        ("to_int('x')", lambda: L.to_int("x"), None),
        ("to_int('')", lambda: L.to_int(""), None),
        ("to_int('3.5')", lambda: L.to_int("3.5"), None),
    ]),
    4: ("drop_header", [
        ("out = drop_header([['h'], ['a'], ['b']])   shows (out, original list)",
         _drop_keeps_original, ([["a"], ["b"]], [["h"], ["a"], ["b"]])),
        ("drop_header([])", lambda: L.drop_header([]), []),
    ]),
    5: ("parse_people", [
        ("parse_people(PEOPLE)", lambda: L.parse_people(PEOPLE), [("Ana", 31, "Lima"), ("Bo", 27, "Oslo")]),
        ("parse_people(MESSY)   (skips the note row and the 'unknown' age)", lambda: L.parse_people(MESSY),
         [("Ana", 31, "Lima"), ("Bo", 0, "Oslo")]),
    ]),
}

if __name__ == "__main__":
    checker.run("lesson_03_parsing.py", EXERCISES, ONLY)
