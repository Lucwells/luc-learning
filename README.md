# Luc Learning

A personal library of textbooks. Each main category is a **book**, each subcategory is a **chapter**, and every chapter reads like a textbook chapter: numbered sections, worked examples, figures, a summary and problems. Quizzes are optional and are drawn from what is written.

## Run it

```bash
npm start
```

Open http://localhost:8080. Node 18+ is the only requirement. There are no dependencies and no build step. The site is plain static files, so it also works on GitHub Pages.

## How the site is organized

- **Library**: the shelf of books.
- **Book**: a cover, preface and table of contents. Chapters are grouped into parts.
- **Chapter**: a long, readable page with a sticky contents sidebar. Each section ends with "Check your understanding" questions. "Quiz this chapter" and "Quiz this book" are optional.
- **Cross-references**: a term explained elsewhere is linked where it appears, and a Back button returns you to where you were.
- **Search**: press `/` to search section titles, terms and text.

Some chapters are interactive: the periodic table and the world map.

## Add to a book

1. Create `data/<book>/<chapter>.json` (see below).
2. Add its path, without `.json`, to the book's `data/<book>/book.json`.
3. Run `npm run validate`.

To start a new book, create `data/<name>/book.json` and add it to `data/manifest.json`.

### book.json

```json
{
  "id": "chemistry",
  "title": "Chemistry",
  "kicker": "Textbook",
  "color": "#003262",
  "subtitle": "One line under the title.",
  "preface": ["Paragraph.", "Paragraph."],
  "front": ["chemistry/periodic-table"],
  "parts": [
    { "title": "General Chemistry", "blurb": "One line.", "chapters": ["chemistry/general/kinetics"] }
  ]
}
```

Chapters in `parts` are numbered in order across the whole book. Chapters in `front` are unnumbered reference pages.

### Chapter format

```json
{
  "id": "kinetics",
  "view": "chapter",
  "title": "Chemical Kinetics",
  "description": "Shown in the table of contents.",
  "overview": ["Opening paragraph.", "Roadmap paragraph."],
  "objectives": ["After this chapter you can…"],
  "sections": [
    {
      "id": "rates",
      "title": "Reaction rates",
      "terms": ["reaction rate", "initial rate"],
      "body": [ "A paragraph.", { "eq": "rate = k[A]" } ],
      "subs": [ { "id": "…", "title": "…", "terms": [], "body": [] } ],
      "check": [ { "q": "Question?", "a": "Right", "wrong": ["A", "B", "C"], "why": "Optional explanation." } ]
    }
  ],
  "summary": ["Key point."],
  "problems": [ { "q": "Problem.", "solution": "Worked solution.", "a": "Final answer." } ]
}
```

A section has a `body`, `subs` (subsections), or both. Sections are numbered automatically (9.1, 9.1.1). The `title` and every entry in `terms` become links wherever those words appear in other sections.

**Body blocks.** A string is a paragraph. Anything else is an object with one of these keys:

| Key | Result |
| --- | --- |
| `eq` | Display equation. A string, or an array of lines. |
| `h` | Small run-in heading. |
| `list` | Bullet list (`"ordered": true` for numbers). |
| `table` | `{ head, rows, caption }`. Captions are numbered automatically. |
| `example` | Worked example: `{ title, problem, solution }`. Problem and solution can be a string or an array of blocks. |
| `key`, `warn`, `tip`, `note` | Callout boxes. |
| `def` | `["Term", "Definition"]`. |
| `facts` | Label and value pairs: `[["Label", "Value"]]`. |
| `eqs` | Equations with notes: `[["equation", "note"]]`. |
| `svg` | Inline diagram (use `currentColor` and `var(--accent)` so it follows the theme), with optional `caption`. |

**Text markup** works in every string: `**bold**` for a term being defined, `//italic//`, `x^{2}` for superscripts and `x_{i}` for subscripts. Unicode (H₂O, Δ, →) is fine too.

**Questions** with three or more `wrong` answers are multiple choice. Without `wrong`, they are self-graded.

### Interactive chapters

- `"view": "periodic-table"`: the clickable table, built from `items`, with `attributes` explaining each field. See `data/chemistry/periodic-table.json`.
- `"view": "world-map"`: the map, country facts, flags and quizzes. See `data/geography/countries.json`. Regenerate the map from Natural Earth data with `node scripts/build-map.mjs <file>`.
- `"view": "reaction-types"` and `"view": "articles"` are older formats. They are converted to chapters when loaded, so they still work.

Interactive and older decks can define quiz `modes`: `{ "id", "label", "question": "What is the symbol for {name}?", "answer": "symbol" }`. See the existing files.

## Layout

```
index.html           page shell
css/style.css        base styles and quiz screens
css/reader.css       textbook layout
js/app.js            router
js/data.js           loads books and chapters
js/reader.js         shelf, book, chapter and quiz-scope pages
js/terms.js          text markup and automatic links
js/search.js         search box
js/quiz.js           quiz and flashcard engine
js/periodic.js       periodic table view
js/worldmap.js       world map view
data/manifest.json   list of books
data/<book>/         book.json and its chapters
scripts/validate.mjs checker
serve.mjs            local static server
```

## Notes

- Always double-check facts you add. Some entries (for example the superheavy elements) are predictions, not measurements.
