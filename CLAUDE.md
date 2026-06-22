# ScanFi Project - Claude Code Memory

## CRITICAL: DEPLOYMENT (Dev/Prod Separation)

### Two Environments
| Environment | URL | Branch | QR Code |
|-------------|-----|--------|---------|
| **Production** | https://scanfi.onrender.com | `master` | Green (`qr-production.png`) |
| **Development** | https://scanfi-dev.onrender.com | `develop` | Orange (`qr-development.png`) |

### Workflow
1. **Develop on `develop` branch** - auto-deploys to dev environment
2. **Test with orange QR** - dev environment shows orange "DEVELOPMENT" banner
3. **When approved, merge to `master`** - auto-deploys to production
4. **Users use green QR** - production has no banner

### Git Commands
```bash
# Feature development
git checkout develop
git checkout -b feature/my-feature
# ... make changes ...
git add . && git commit -m "Add feature"
git push origin feature/my-feature
git checkout develop && git merge feature/my-feature
git push origin develop  # Auto-deploys to DEV

# Promote to production (after testing)
git checkout master
git merge develop
git push origin master  # Auto-deploys to PROD
```

### Environment Detection
- Backend: `ENVIRONMENT` env var (set to `development` on dev server)
- Frontend: Checks `/api/health` and shows orange banner if `environment === 'development'`

### NEVER
- Push untested code directly to `master`
- Test on localhost (always use dev environment)

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
- **NO Google Translate wrapper** - K-Ruoka uses dynamic JavaScript that doesn't load through translate.google.com proxy. Users should use their browser's built-in translation instead.
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
- Local server: `python -m uvicorn app:app --host 0.0.0.0 --port 8000`

### QR Codes
| QR Code | File | URL | Use For |
|---------|------|-----|---------|
| Production (green) | `frontend/codes/qr-production.png` | scanfi.onrender.com | End users |
| Development (orange) | `frontend/codes/qr-development.png` | scanfi-dev.onrender.com | Testing |

**Regenerate QR codes**: `python scripts/generate_qr_codes.py`

## Service Worker
- **DISABLED during development** - no caching issues
- To re-enable for production, uncomment the serviceWorker.register code in app.js

## Languages
UI supports: en, de, fr, es, zh, fi, sv, ru, ja, it, pt, nl, pl
Finnish (fi) is primary use case.

## Quality Control Loop - LESSONS LEARNED
Review this section before making changes.

### Mistake Log
1. **2024-06-18: Localhost testing waste** - Spent hours testing locally while app is deployed on Render.com. User told me "I don't use localhost" but I didn't listen. ALWAYS push to GitHub and test on production URL.
2. **2024-06-18: Google Translate proxy limitation** - Google Translate URL wrapper (`translate.google.com/translate?u=...`) doesn't work with dynamic JavaScript sites like K-Ruoka. The page loads but AJAX calls fail, showing "loading" forever. Browser built-in translation works better.

### Rules
- THINK before acting
- ASK clarifying questions early, not after hours of work
- When user says something doesn't work, first verify WHERE they're testing
- **Always develop on `develop` branch first**
- **Test on dev environment before merging to master**
- All changes must be committed + pushed to see effect
- Development URL: https://scanfi-dev.onrender.com
- Production URL: https://scanfi.onrender.com

## Automated Testing
Before asking user to test, run these checks:

```bash
# 1. Check syntax
node --check frontend/app.js

# 2. Test DEV environment (after pushing to develop)
curl -s "https://scanfi-dev.onrender.com/api/health" | python -c "import sys,json; d=json.load(sys.stdin); print('ENV:', d.get('environment'))"
curl -s "https://scanfi-dev.onrender.com/api/product/6416453020337?lang=fi" | python -c "import sys,json; d=json.load(sys.stdin); print('FI:', d.get('name'))"

# 3. Check version deployed
curl -s "https://scanfi-dev.onrender.com/app.js" | grep "v2\."

# 4. Test PROD environment (after merging to master)
curl -s "https://scanfi.onrender.com/api/health" | python -c "import sys,json; d=json.load(sys.stdin); print('ENV:', d.get('environment'))"
curl -s "https://scanfi.onrender.com/app.js" | grep "v2\."
```

Run DEV checks after pushing to `develop`, PROD checks after merging to `master`.
