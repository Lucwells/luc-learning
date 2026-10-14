# Luc Learning

A personal study guide and quiz game. Knowledge lives in JSON files in this repo; the website turns it into flashcards, quizzes and "name them all" challenges. Add a file, get a new deck.

## Run it

```bash
npm start
```

Open http://localhost:8080. Node 18+ is the only requirement; there are no dependencies and no build step.

The site is plain static files, so it also works on GitHub Pages (Settings → Pages → deploy from the main branch root).

## What you get

- **Library first**: the home page is an index of categories. Each category page lists its subtopics and decks. Each category can have its own view, like the periodic table. Nothing quizzes you unless you ask.
- **Optional quizzes** at every level: "Quiz this category" on any category page, and "Practice this deck" (collapsed by default) on a deck page.
- **Quiz**: multiple choice or typed answers. Typed answers ignore case, accents and punctuation, accept listed alternates, and forgive one typo on longer answers.
- **Flashcards**: reveal, then "Got it" or "Again" (missed cards come back).

## Add knowledge

1. Create `data/<topic>/<name>.json`.
2. Add its path to `data/manifest.json`.
3. Run `npm run validate`.

### Deck format

```json
{
  "title": "Periodic Table",
  "description": "Shown on the deck page.",
  "category": ["Chemistry"],
  "idField": "symbol",
  "modes": [
    { "id": "name-symbol", "label": "Name → Symbol", "question": "What is the symbol for {name}?", "answer": "symbol" }
  ],
  "items": [
    { "number": 13, "name": "Aluminium", "symbol": "Al", "alts": { "name": ["Aluminum"] } }
  ]
}
```

| Key | Meaning |
| --- | --- |
| `category` | Path in the topic tree. `["Chemistry", "Organic"]` nests a subcategory. |
| `idField` | Item field that is unique. Defaults to `id`, then list position. |
| `modes` | Each mode turns every item into a question. `{field}` in `question` is replaced by the item's value; `answer` names the field that is the answer. |
| `mode.mcOnly` | Always multiple choice (good for category-style answers). |
| `mode.grade: "self"` | Reveal the answer and grade yourself. Use for free-text answers. |
| `alts` | Extra accepted answers per field. |
| `attributes` | Optional explanations of each item field: `{ key, label, summary, points[], items[{term,text}] }`. Shown in the periodic table guide and on each element card. |
| `view` | Custom page for a deck. `"periodic-table"` draws the clickable table. `"reaction-types"` lists reaction types from a `types` array (name, form, summary, recognize, realWorld) with examples taken from `items`. |

### Plain question/answer decks

Leave out `modes` and give items `q` and `a`. They are self-graded.

```json
{
  "title": "Thermodynamics",
  "category": ["Physics", "Thermodynamics"],
  "items": [
    { "q": "State the first law.", "a": "Energy is conserved: ΔU = Q − W." }
  ]
}
```

## Layout

```
index.html        page shell
css/style.css     styles
js/app.js         routing, quiz engine, views
data/manifest.json  list of decks
data/**/*.json    the knowledge
scripts/validate.mjs  deck checker
serve.mjs         local static server
```

## Notes

- Always double-check facts you add. Some entries (for example the family of superheavy elements) are predictions, not measurements.

## Article decks and linked terms

A deck with `"view": "articles"` is a set of topics (concepts, processes, people, anything) instead of quiz items. See `data/chemistry/key-concepts.json` and `data/chemistry/industrial-processes.json`.

```json
{
  "title": "Key Concepts",
  "category": ["Chemistry", "Key Concepts"],
  "view": "articles",
  "entries": [
    {
      "id": "catalyst",
      "name": "Catalysts",
      "group": "Reactions & energy",
      "terms": ["catalyst", "catalysts"],
      "tagline": "One line shown on the card.",
      "sections": [
        { "h": "Heading", "text": "A paragraph.", "equations": ["N₂ + 3H₂ ⇌ 2NH₃"],
          "facts": [["Label", "Value"]], "points": ["A bullet."] }
      ],
      "quiz": [ { "q": "Question?", "a": "Right answer", "wrong": ["Wrong 1", "Wrong 2", "Wrong 3"] } ]
    }
  ]
}
```

Every `name` and every word in `terms` becomes a link wherever it appears in any other page's text (element attributes, reaction types, other articles). The first mention in each card is linked, and Esc returns you to the page you came from. Section parts are all optional.

## World map

`data/geography/countries.json` uses `"view": "world-map"` and `"mapFile"`. The map is regenerated from Natural Earth data (world-atlas `countries-50m.json`) with `node scripts/build-map.mjs <file>`; it has region tabs, zoom/pan, click-for-details and a "find them on the map" quiz.
