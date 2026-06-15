# ScanFi Project Memory

## What ScanFi Does
A PWA for tourists in Finland to scan product barcodes and see product info (name, allergens, ingredients) in their own language.

## Current State (2026-06-14)

### Working Features
- Camera barcode/QR scanning (Html5Qrcode library)
- Manual code entry
- Product lookup from local database (5 Finnish sample products)
- Product lookup from Open Food Facts API (millions of products)
- 13 languages supported: en, de, fr, es, zh, fi, sv, ru, ja, it, pt, nl, pl
- Allergen display with localized names
- PWA with service worker

### Deployment
- GitHub: https://github.com/mikatoivola1/scanfi
- Deployed on Render.com
- Backend: FastAPI (Python)
- Frontend: Vanilla JS PWA

### Known Issues to Check Tomorrow
1. **Language dropdown** - Should appear in top right. If not visible, service worker cache issue. Bump `CACHE_NAME` in `sw.js`
2. **Product translations** - Open Food Facts may not have translations for all products. UI labels ARE translated, but product names depend on OFF data.

### Key Files
- `frontend/app.js` - Main frontend logic, scanner, language handling
- `frontend/index.html` - HTML structure
- `frontend/sw.js` - Service worker (cache version: v11)
- `backend/app.py` - FastAPI backend, Open Food Facts integration
- `data/products.json` - 5 sample Finnish products
- `data/allergens.json` - 14 EU allergens with translations

### Important: Don't Touch Working Code
User requested: Only fix broken code, don't "improve" working code.

### Scanner Code (Working Version)
The scanner uses Html5Qrcode with this config:
```javascript
const config = {
  fps: 10,
  qrbox: { width: 250, height: 250 },
  aspectRatio: 1.0,
  formatsToSupport: [QR_CODE, EAN_13, EAN_8, CODE_128, CODE_39, UPC_A, UPC_E]
};
```
On success: `stopScanner()` then `lookup(extractCode(decodedText))`

### Language Priority (for tourists)
When fetching from Open Food Facts, priority is:
1. User's selected language (e.g., `product_name_en`)
2. English fallback (`product_name_en`)
3. Generic product name

### To Test
1. Open Render URL on phone
2. Select language from dropdown (top right)
3. Scan any barcode
4. Should show product info in selected language (if available in OFF)
