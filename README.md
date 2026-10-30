# EV Tooling OCR

Read a Siemens NX `.prt` part file entirely in your browser and get instant engineering documents — **no NX license, no backend, no upload**.

**Live demo:** https://ev-tooling-ocr.app.workbuddy.host/?sharecode=P6EYRGTQ73

Built as an entry for the [WorkBuddy 1024 Build Challenge](https://www.workbuddy.link/p/8QYARuAmZ9RgQty3FSzNUs) (2026).

## What it does

Drag & drop a native Siemens NX part file (`.prt`) and the app parses the raw bytes client-side to recover:

1. **Part attributes** — from the embedded `<UgAttributes>` XML block: part number, name, revision, material grade, nominal thickness, mass, volume, surface area, envelope dimensions, tooling type
2. **Derived engineering values** — developed blank area (V ÷ t), outline perimeter, blank-length estimate, and a density cross-check (mass ÷ volume vs. 7.85 g/cm³ for steel) proving the numbers are self-consistent
3. **3D PMI notes** — general note lines recovered from length-prefixed ASCII text in the model
4. **Three printable documents** (one per tab, each prints cleanly to PDF):
   - **Part data sheet** — attributes, derived dimensions, notes, embedded preview
   - **Press tooling concept** — process route comparison, 6-station progressive die logic, strip layout & material utilisation, press force calculation and press selection, die specification, cost & timing — every number computed with its formula printed
   - **PPAP / FAI package** — PSW header, AIAG 18-element status (VER / DER / TBC / N-A chips), ballooned FAI characteristics with inspection methods inferred from the material designation, control-plan extract

## Privacy

**The file never leaves your browser.** All parsing is plain JavaScript on the raw bytes — no server, no upload, no telemetry. The demo mode loads a fictional part so you can try everything without a file.

## Honest limits

NX stores dimensions and GD&T as 3D PMI geometry, not text — so per-feature callouts (hole diameters, positions, bend radii) are **not** recoverable from the file and are marked `TBC` in the documents. The preview thumbnail embedded at save time is good for identification, never for measurement.

## Run it

Zero dependencies — it is plain HTML/CSS/JS:

```bash
# any static server works
python -m http.server 8000
# then open http://localhost:8000
```

Or just open `index.html` directly in a browser.

| File | Purpose |
|---|---|
| `parser.js` | byte-level `.prt` parser (attributes, notes, previews, derived math) |
| `tooling.js` | press tooling concept generator |
| `app.js` | UI logic, PPAP/FAI generator, document tabs |
| `index.html` / `style.css` | markup and styling (incl. print stylesheet) |
| `DEVLOG.md` | development log for the challenge entry |

## License

MIT
