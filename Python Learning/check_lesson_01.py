"""Tests for lesson_01_grids.py.
Run:  python check_lesson_01.py        (summary)
      python check_lesson_01.py 3      (full detail for exercise 3)
Or press Run and set ONLY below. Do not edit anything else in this file."""

ONLY = None   # for example ONLY = [3] to see detail for exercise 3 when you press Run

import checker
from checker import captured

L = checker.load_lesson("lesson_01_grids")


def _independent_rows():
    g = L.make_grid(3, 2)
    g[0][0] = "X"
    return g[1][0]


EXERCISES = {
    1: ("make_grid", [
        ("make_grid(3, 2)", lambda: L.make_grid(3, 2), [[" ", " ", " "], [" ", " ", " "]]),
        ("make_grid(1, 1)", lambda: L.make_grid(1, 1), [[" "]]),
        ("g = make_grid(3, 2); g[0][0] = 'X'; then read g[1][0]  (rows must be independent)",
         _independent_rows, " "),
    ]),
    2: ("print_grid", [
        ("print_grid([['a', 'b'], ['c', 'd']])   (compares what was PRINTED)",
         lambda: captured(L.print_grid, [["a", "b"], ["c", "d"]]), "ab\ncd\n"),
        ("print_grid([['x', ' ', 'y']])",
         lambda: captured(L.print_grid, [["x", " ", "y"]]), "x y\n"),
    ]),
    3: ("build_grid", [
        ("build_grid([(0, 0, '#'), (2, 1, '#'), (1, 1, '@')])",
         lambda: L.build_grid([(0, 0, "#"), (2, 1, "#"), (1, 1, "@")]),
         [["#", " ", " "], [" ", "@", "#"]]),
        ("build_grid([(1, 0, 'a')])",
         lambda: L.build_grid([(1, 0, "a")]), [[" ", "a"]]),
    ]),
    5: ("get_size", [
        ("get_size([(0, 0, 'a'), (4, 2, 'b')])", lambda: L.get_size([(0, 0, "a"), (4, 2, "b")]), (5, 3)),
        ("get_size([])", lambda: L.get_size([]), (0, 0)),
    ]),
    6: ("count_chars", [
        ("count_chars([['#', ' '], ['#', '#']], '#')",
         lambda: L.count_chars([["#", " "], ["#", "#"]], "#"), 3),
        ("count_chars([['#', ' '], ['#', '#']], 'z')",
         lambda: L.count_chars([["#", " "], ["#", "#"]], "z"), 0),
    ]),
}

if __name__ == "__main__":
    checker.run("lesson_01_grids.py", EXERCISES, ONLY)
