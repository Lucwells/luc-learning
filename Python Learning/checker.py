"""
Shared test runner for the lessons.

Each lesson has a file named check_lesson_NN.py. Run it to test your work:

    python check_lesson_03.py        summary of every exercise
    python check_lesson_03.py 2      full detail for exercise 2 only
    python check_lesson_03.py 2 4    full detail for exercises 2 and 4

Detail shows, for every test case, the call that was made, what was expected,
and what your function actually returned.

You can also press the Run button on a check file. Set ONLY near the top of
the file (for example ONLY = 2) to choose an exercise.
"""

import contextlib
import importlib
import io
import os
import pprint
import sys
import traceback

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def load_lesson(module_name):
    """Import the lesson file without showing its demo prints.
    Exits with a readable message if the file has a syntax error."""
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    try:
        with contextlib.redirect_stdout(io.StringIO()):
            return importlib.import_module(module_name)
    except SyntaxError as e:
        print(f"Your lesson file has a syntax error, so no test can run.\n"
              f"  {e.msg} (line {e.lineno}): {e.text.strip() if e.text else ''}")
        sys.exit(1)
    except Exception as e:
        print(f"Importing the lesson file failed: {type(e).__name__}: {e}")
        print("Run the lesson file directly to see the full error.")
        sys.exit(1)


def captured(func, *args):
    """Call func(*args) and return everything it printed, instead of the return value."""
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        func(*args)
    return buf.getvalue()


def _show(value):
    text = pprint.pformat(value, width=70)
    return text.replace("\n", "\n            ")


def _run_case(lesson_file, label, call, expected):
    """Returns (passed, got_text, error_text)."""
    try:
        got = call()
    except Exception as e:
        where = ""
        for fr in reversed(traceback.extract_tb(e.__traceback__)):
            if os.path.basename(fr.filename) == lesson_file:
                where = f" (your code, line {fr.lineno}: {fr.line})"
                break
        return False, None, f"{type(e).__name__}: {e}{where}"
    return got == expected, got, None


def run(lesson_file, exercises, only=None):
    """exercises: {number: (function name, [(label, call, expected), ...])}
    only: list of exercise numbers to show in detail, or None for a summary."""
    args = [a for a in sys.argv[1:] if a.isdigit()]
    chosen = [int(a) for a in args] or only or []
    unknown = [n for n in chosen if n not in exercises]
    if unknown:
        print(f"No exercise {unknown}. Choose from {sorted(exercises)}.")
        return
    detail = bool(chosen)
    todo = chosen if detail else sorted(exercises)

    total_pass = 0
    for n in todo:
        name, cases = exercises[n]
        results = [(label, expected, _run_case(lesson_file, label, call, expected))
                   for label, call, expected in cases]
        passed = sum(1 for _, _, r in results if r[0])
        total_pass += passed == len(results)

        status = "PASS" if passed == len(results) else "FAIL"
        print(f"{status}  Exercise {n}: {name}  ({passed}/{len(results)} cases)")
        if not detail:
            continue
        for k, (label, expected, (ok, got, err)) in enumerate(results, 1):
            print(f"\n  Case {k}: {label}")
            print(f"    expected: {_show(expected)}")
            if err:
                print(f"    ERROR:    {err}")
            else:
                print(f"    got:      {_show(got)}")
                if isinstance(got, str) and "\n" in got:
                    print("    as printed:")
                    print("      | " + got.rstrip("\n").replace("\n", "\n      | "))
            print(f"    {'PASS' if ok else 'FAIL'}")
        print()

    if not detail:
        print(f"\n{total_pass}/{len(todo)} exercises pass. "
              f"For detail run:  python {os.path.basename(sys.argv[0])} <exercise number>")
