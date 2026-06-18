# ScanFi Project - Claude Code Memory

## CRITICAL: DEPLOYMENT
- **Production URL**: https://scanfi.onrender.com
- **QR Code**: Points to production, NOT localhost
- **ALL changes must be committed and pushed to GitHub** - Render auto-deploys from master
- **NEVER test with localhost** - user tests on phone via QR code to production

## CRITICAL: DO NOT MODIFY
The barcode scanner is working and fragile. **NEVER change these settings:**

```javascript
// frontend/app.js - startScanner() function
const config = {
  fps: 10,
  qrbox: { width: 250, height: 250 },
  aspectRatio: 1.0,
  formatsToSupport: [
    Html5QrcodeSupportedFormats.QR_CODE,
    Html5QrcodeSupportedFormats.EAN_13,
    Html5QrcodeSupportedFormats.EAN_8,
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.UPC_A,
    Html5QrcodeSupportedFormats.UPC_E
  ]
};
```

## Project Structure
- `frontend/` - Vanilla JS PWA (no framework)
  - `app.js` - Main application logic, scanner, product rendering
  - `styles.css` - All styles
  - `sw.js` - Service worker (network-first for code, cache-first for images)
  - `index.html` - Single page app shell
- `backend/` - FastAPI Python server
  - `app.py` - API endpoints, Open Food Facts integration
  - `.env` - Edamam API keys

## Key Features
1. **Barcode Scanner** - Uses html5-qrcode library, lazy-loaded
2. **Open Food Facts** - Primary product data source
3. **K-Ruoka Button** - Links to K-Ruoka for complete Finnish product data

## K-Ruoka Button (IMPLEMENTED)
- Shows on EVERY product
- Links to: `https://www.k-ruoka.fi/haku?q={barcode}`
- Style: Orange gradient button with inline styles
- Future: Apply for Kesko Developer Portal API access to fetch data directly

## Service Worker Strategy
- HTML, CSS, JS: **Network-first** (always get latest, cache for offline)
- Images: **Cache-first** (fast loading)
- API calls: **Network-only** (no caching)

## Common Issues
1. **Cache problems** - Service worker may cache old files. The index.html has auto-clear script.
2. **Scanner not detecting** - Usually browser cache. Hard refresh or clear site data.
3. **Button not showing** - Check `p.dataWeak` condition in renderProduct()

## Testing
- Fazer chocolate barcode: `6416453020337` (has weak data, good for testing K-Ruoka button)
- Server: `python -m uvicorn app:app --host 0.0.0.0 --port 8000`
- **App QR code**: `frontend/codes/app-qr.png` - points to `http://192.168.22.101:8000`
- **IMPORTANT**: If server IP changes, regenerate QR with:
  ```python
  import qrcode
  qr = qrcode.make('http://NEW_IP:8000')
  qr.save('C:/scanfi/frontend/codes/app-qr.png')
  ```

## Service Worker
- **DISABLED during development** - no caching issues
- To re-enable for production, uncomment the serviceWorker.register code in app.js

## Languages
UI supports: en, de, fr, es, zh, fi, sv, ru, ja, it, pt, nl, pl
Finnish (fi) is primary use case.
