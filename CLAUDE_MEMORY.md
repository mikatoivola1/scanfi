# ScanFi Project Memory

## What ScanFi Does
A PWA for tourists in Finland to scan product barcodes and see product info (name, allergens, ingredients) in their own language.

## Current State (2026-06-15)

### Architecture Change
- **Removed local products.json** from lookup - now relies solely on Open Food Facts
- **Auto-translation added** - fetches product in native language, then translates to user's selected language
- Uses **MyMemory API** (free) for translation

### How It Works Now
1. User selects language from dropdown (e.g., Japanese)
2. User scans/enters a barcode
3. Backend fetches product from Open Food Facts (in native language)
4. Backend auto-translates product name, description, ingredients to user's language
5. Returns fully translated product info

### Working Features
- Camera barcode/QR scanning (Html5Qrcode library)
- Manual code entry
- Product lookup from Open Food Facts API
- **Auto-translation** to 13 languages: en, de, fr, es, zh, fi, sv, ru, ja, it, pt, nl, pl
- Allergen display with localized names
- PWA with service worker

### Deployment
- GitHub: https://github.com/mikatoivola1/scanfi
- Deployed on Render.com
- Backend: FastAPI (Python)
- Frontend: Vanilla JS PWA

### Key Files
- `frontend/app.js` - Main frontend logic, scanner, language handling
- `frontend/index.html` - HTML structure
- `frontend/sw.js` - Service worker (cache version: v12)
- `backend/app.py` - FastAPI backend, Open Food Facts + auto-translation
- `data/allergens.json` - 14 EU allergens with translations

### Testing
To test locally:
```
cd backend
pip install fastapi uvicorn httpx
uvicorn app:app --reload --port 8000
```

Then scan any barcode (e.g., Coca-Cola: 5449000000996) and change the language dropdown.

### Notes
- Translation uses MyMemory free API (5000 words/day limit)
- Products not in Open Food Facts will show "not found"
- Allergen names are pre-translated in allergens.json
- Service worker bumped to v12 - users need to refresh to get new code
