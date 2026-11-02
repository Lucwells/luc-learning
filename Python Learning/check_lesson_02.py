"""Tests for lesson_02_fetching.py. Exercises 1, 2 and 5 need internet.
Run:  python check_lesson_02.py        (summary)
      python check_lesson_02.py 1      (full detail for exercise 1)
Or press Run and set ONLY below. Do not edit anything else in this file."""

ONLY = None   # for example ONLY = [1] to see detail for exercise 1 when you press Run

import os
import requests
import checker

L = checker.load_lesson("lesson_02_fetching")
OK_URL = "https://example.com"
MISSING_URL = "https://example.com/this-page-does-not-exist"


def _fetch_ok():
    page = L.fetch_html(OK_URL)
    return isinstance(page, str) and "Example Domain" in page


def _fetch_404():
    try:
        L.fetch_html(MISSING_URL)
    except requests.HTTPError:
        return "raised HTTPError"
    return "did NOT raise"


def _safe_ok():
    return "Example Domain" in (L.safe_fetch(OK_URL) or "")


def _save_roundtrip():
    path = "_test_out.txt"
    L.save_text("block █ ok\n", path)
    with open(path, "r", encoding="utf-8") as f:
        got = f.read()
    os.remove(path)
    return got


HTML = '<table><tr><td>a</td></tr><tr class="x"><td>b</td></tr></table>'

EXERCISES = {
    1: ("fetch_html", [
        ("fetch_html('https://example.com') returns a string containing 'Example Domain'", _fetch_ok, True),
        ("fetch_html on a page that does not exist (404)", _fetch_404, "raised HTTPError"),
    ]),
    2: ("safe_fetch", [
        ("safe_fetch('not a url')", lambda: L.safe_fetch("not a url"), None),
        ("safe_fetch('http://localhost:9/')   (nothing listens there)", lambda: L.safe_fetch("http://localhost:9/"), None),
        ("safe_fetch('https://example.com') contains 'Example Domain'", _safe_ok, True),
        ("safe_fetch on a 404 page", lambda: L.safe_fetch(MISSING_URL), None),
    ]),
    3: ("save_text", [
        ("save_text('block \\u2588 ok\\n', '_test_out.txt'), then read the file back", _save_roundtrip, "block █ ok\n"),
    ]),
    4: ("count_tag", [
        (f"count_tag({HTML!r}, 'tr')", lambda: L.count_tag(HTML, "tr"), 2),
        ("count_tag(same html, 'td')", lambda: L.count_tag(HTML, "td"), 2),
        ("count_tag(same html, 'p')", lambda: L.count_tag(HTML, "p"), 0),
    ]),
    5: ("status_of", [
        ("status_of('https://example.com')", lambda: L.status_of(OK_URL), 200),
        ("status_of(a page that does not exist)", lambda: L.status_of(MISSING_URL), 404),
        ("status_of('not a url')", lambda: L.status_of("not a url"), None),
    ]),
}

if __name__ == "__main__":
    checker.run("lesson_02_fetching.py", EXERCISES, ONLY)
