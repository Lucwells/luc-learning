"""
LESSON 2: Fetching a Web Page
=============================

Course goal: write decode_message(url). Lesson 1 built the grid half.
This lesson builds the first step: fetch_html(url), which downloads the
Google Doc as text.

Learning objectives
-------------------
By the end of this lesson you can:
  1. Install a third-party package with pip.
  2. Explain a request, a response, and a status code.
  3. Download a page with requests.get.
  4. Handle failures with try/except.
  5. Save and inspect HTML so you can see what you are parsing.

Setup (do this first)
---------------------
In the VS Code terminal run:

    pip install requests

If "pip" is not found, use:

    python -m pip install requests

Check it worked:

    python -c "import requests; print(requests.__version__)"

How to use this file
--------------------
  - Read each Part, run the file, read the output.
  - Fill in the TODO functions. Do not edit the tests at the bottom.
  - Exercises 1 and 5 need an internet connection.
"""

import requests


# =============================================================================
# PART 1. HOW THE WEB WORKS
# =============================================================================
# Your program (the client) sends a REQUEST to a server. The server sends back
# a RESPONSE. Both are plain text with a few parts:
#
#   Request  : method (GET = "give me this page") + URL
#   Response : status code + headers + body
#
# A URL has parts:   https://docs.google.com/document/d/e/ABC123/pub
#                    scheme  host            path
#
# Status codes tell you what happened:
#   200  OK, here is the page
#   301/302  moved, go to another URL (requests follows these for you)
#   403  forbidden (you are not allowed to see it)
#   404  not found
#   500  the server broke
#
# The BODY is what you want. For a web page the body is HTML: text with tags
# like <table> and <td>. Lesson 3 reads that HTML. This lesson only gets it.


# =============================================================================
# PART 2. requests.get
# =============================================================================
# requests.get(url) sends a GET request and returns a Response object.
# A Response object has attributes (values) you read with a dot:
#
#   response.status_code   int, e.g. 200
#   response.text         str, the body decoded as text
#   response.headers       dict-like, e.g. response.headers["Content-Type"]
#
# Worked example (needs internet):

demo = requests.get("https://example.com", timeout=10)
print("status :", demo.status_code)
print("type   :", demo.headers["Content-Type"])
print("length :", len(demo.text), "characters")
print("first 60 characters:", demo.text[:60].replace("\n", " "))

# Always pass timeout=<seconds>. Without it, a stuck server freezes your
# program forever.
#
# demo.text[:60] is slicing: characters from index 0 up to (not including) 60.


# =============================================================================
# PART 3. WHEN THINGS GO WRONG
# =============================================================================
# requests does NOT raise an error for 404 or 500. It returns a normal
# Response with status_code 404. If you then read .text you get an error page
# and think it is your data. To turn bad statuses into errors, call:
#
#   response.raise_for_status()
#
# It does nothing for 2xx codes and raises requests.HTTPError for 4xx and 5xx.
#
# Other things fail BEFORE a response exists: no internet, bad host name,
# connection refused, timeout. Those raise exceptions too. They all inherit from
# requests.RequestException.
#
# try/except catches an error instead of crashing:
#
#   try:
#       risky_code()
#   except SomeError:
#       what_to_do_instead()
#
# Code after the try/except still runs.

try:
    bad = requests.get("https://example.com/this-page-does-not-exist", timeout=10)
    print("bad status:", bad.status_code)          # 404, no crash
    bad.raise_for_status()                          # now it raises
    print("this line is skipped")
except requests.RequestException as err:
    print("caught:", type(err).__name__)            # HTTPError

# Catching the broad parent class RequestException handles every requests
# failure in one place. Catch only what you can handle; do not use a bare
# "except:" because it hides typing mistakes too.

# A function can return None to signal "nothing to give you":
def safe_divide(a, b):
    try:
        return a / b
    except ZeroDivisionError:
        return None

print(safe_divide(6, 3), safe_divide(1, 0))        # 2.0 None


# =============================================================================
# PART 4. GOOGLE DOC URLS
# =============================================================================
# A Google Doc has two kinds of URL:
#
#   .../document/d/<ID>/edit    the editor. Needs sign-in. requests gets a
#                               login page, not your data.
#   .../document/d/e/<ID>/pub   a PUBLISHED copy. Anyone can fetch it, so
#                               requests works.
#
# The URL you are given for the project should be the published (/pub) kind.
# If you only have /edit, ask for the /pub link.
#
# Test the idea on any page: fetch the URL, check the status code, check that
# the text contains something you expect.


# =============================================================================
# PART 5. READING AND SAVING HTML
# =============================================================================
# HTML can be thousands of characters. Printing it all is unreadable. Two
# tools help you look at it.
#
# (a) Search inside a string:
text = "<table><tr><td>a</td></tr><tr><td>b</td></tr></table>"
print("<table" in text)         # True   ("in" checks for a substring)
print(text.count("<tr"))        # 2      (how many times it appears)
print(text.find("<td"))         # 11     (index of first match, -1 if none)

# (b) Save to a file, then open the file in VS Code and read it:
#
#   with open("page.html", "w", encoding="utf-8") as f:
#       f.write(some_text)
#
# "w" means write (replaces the file). "with" closes the file for you when the
# block ends. encoding="utf-8" is needed so symbols like the block character
# survive on Windows.
#
# Reading it back:
#   with open("page.html", "r", encoding="utf-8") as f:
#       content = f.read()

with open("_scratch.txt", "w", encoding="utf-8") as f:
    f.write("hello\n")
with open("_scratch.txt", "r", encoding="utf-8") as f:
    print("read back:", f.read().strip())


# =============================================================================
# EXERCISES
# =============================================================================

# ---- Exercise 1 -------------------------------------------------------------
def fetch_html(url):
    """Download url and return the page body as a string.
    Raise an error (do not return a page) when the status is 4xx or 5xx.
    Needs: Parts 2 and 3.
    Plan: requests.get with a timeout of 10 seconds, call raise_for_status(),
    return the response text.
    """
    link = requests.get(url, timeout=10)
    link.raise_for_status()
    return link.text
    pass


# ---- Exercise 2 -------------------------------------------------------------
def safe_fetch(url):
    """Like fetch_html, but return None instead of raising when ANY requests
    problem happens (bad URL, no connection, 404, timeout).
    Needs: Part 3 (try/except, safe_divide example).
    Plan: call fetch_html inside try, return its result; in except
    requests.RequestException, return None.
    """
    try:
        return fetch_html(url)
    except requests.RequestException:
        return None
    pass


# ---- Exercise 3 -------------------------------------------------------------
def save_text(text, path):
    """Write text to the file at path, replacing the file. Use UTF-8.
    Return nothing.
    Needs: Part 5(b).
    """
    with open(path, 'w', encoding="utf-8") as f:
        f.write(text)
    pass


# ---- Exercise 4 -------------------------------------------------------------
def count_tag(html, tag):
    """Return how many times the opening tag appears in html.
    count_tag("<tr><td>a</td></tr>", "tr")  ->  1
    Opening tags look like <tr or <tr class="x". Search for "<" plus the tag.
    Needs: Part 5(a), plus f-strings: f"<{tag}" builds the string "<tr" when
    tag is "tr".
    """
    return html.count(f"<{tag}")
    pass


# ---- Exercise 5 (challenge) -------------------------------------------------
def status_of(url):
    """Return the integer status code for url. If the request fails before any
    response exists (bad URL, no connection), return None.
    Unlike fetch_html, a 404 must RETURN 404, not raise.
    Needs: Parts 2 and 3.
    """
    try:
        link = requests.get(url, timeout=10)
        return link.status_code
    except requests.RequestException:
        return None
    pass


# =============================================================================
# CHECK YOUR WORK
# =============================================================================
# Tests live in check_lesson_02.py. Run one exercise at a time to see the exact
# input, the expected result and what your function returned:
#
#   python check_lesson_02.py 2        (full detail for exercise 2)
#   python check_lesson_02.py          (summary of all exercises)
