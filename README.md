# ScanFi — MVP scaffold

A zero-friction mobile web app (PWA) that lets international travellers scan a
shelf-edge QR code in a grocery store and instantly see the product's name,
allergens, and a culturally-aware "local equivalent" explanation **in their own
language** — no app download, no login.

This repository is an MVP scaffold generated from the business plan
(`ScanFi_-_Gemini.docx`). It implements the core loop end-to-end with sample data
so it can be demoed and extended.

## What's here

```
SkanFi/
├── backend/            FastAPI service: product lookup + language resolution
│   ├── app.py
│   └── requirements.txt
├── frontend/           PWA (no build step): camera QR scan, auto-language, product card
│   ├── index.html
│   ├── styles.css
│   ├── app.js
│   ├── manifest.json
│   ├── sw.js
│   └── icons/
├── data/               JSON data store (stands in for GS1 Synkka / Open Food Facts)
│   ├── products.json
│   └── allergens.json
├── scripts/
│   └── generate_qr.py  Generates printable shelf QR stickers (Phase 1 pilots)
└── docs/
```

## Run it

```bash
cd backend
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Open <http://localhost:8000>. The FastAPI app also serves the PWA, so the front-end
and API share an origin (no CORS setup needed).

- **Desktop demo:** click a sample chip, or type a shelf code (e.g. `SKF-0001`).
- **Phone demo:** serve over HTTPS (camera access requires it), then scan a code.
- **Switch language:** top-right selector, or it auto-detects your browser language.

### Generate shelf QR stickers (Phase 1)

```bash
cd scripts
python generate_qr.py --base-url https://your-host --out qr_out
```

Each QR encodes `https://your-host/?c=SKF-0001`, so the native phone camera opens
the PWA straight to that product — the zero-friction requirement.

## How the code maps to the business plan

| Plan section | Where it lives |
|---|---|
| 2.1 Zero-friction PWA, auto language (en/de/fr/es/zh) | `frontend/` — `detectLang()`, `manifest.json`, `sw.js` |
| 2.2 Primary (GS1 Synkka) vs secondary (Open Food Facts) data | `data/products.json` `source`/`verified` fields → trust badge in UI |
| 2.3 AI "Local Equivalent Matching" (not dictionary translation) | `translations[lang].localEquivalent` + `usage` per product |
| 5 Phase 1 physical QR stickers | `scripts/generate_qr.py` |
| 5 Phase 2 ESL labels | Same `shelfCode`/QR payload pushed to ESL instead of print |
| 7.1 Allergy liability disclaimer | `backend/app.py` `DISCLAIMER`, rendered on every product card |
| 7.2 Shelf moves break QR mapping | Codes resolve server-side; remap in `products.json` (or via ESL) without reprinting |

## Next steps (not yet built)

These are the obvious follow-ups once the MVP direction is confirmed:

1. **Real data ingestion** — replace the JSON store with connectors to GS1 Synkka
   (authoritative allergen data) and Open Food Facts, plus a caching layer.
2. **AI Local Equivalent pipeline** — generate `localEquivalent`/`usage` via an LLM
   with human review, rather than hand-authored entries.
3. **Merchant back-office** — the B2B side: store onboarding, shelf-code assignment,
   subscription tiers (Pilot/Medium/Large, plan section 4), and an ESL integration
   adapter (e.g. Pricer).
4. **Persistence + auth** — move from in-memory dicts to a database; add merchant accounts.
5. **Analytics** — scan counts per product/store to evidence the ROI argument (plan 4.2).

## Notes

- Icons in `frontend/icons/` are placeholders.
- Sample data is illustrative; GTINs are not guaranteed to be real.
- This is a demo build with no persistence layer yet.
