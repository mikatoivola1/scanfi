# ScanFi Development & Production Separation Plan

## Overview

This document outlines the strategy for separating development/testing from production, enabling safe testing before deploying to users.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        GIT REPOSITORY                           │
│  ┌─────────────────┐              ┌─────────────────┐          │
│  │  develop branch │─── merge ───▶│  master branch  │          │
│  └────────┬────────┘              └────────┬────────┘          │
└───────────┼────────────────────────────────┼────────────────────┘
            │                                │
            │ auto-deploy                    │ auto-deploy
            ▼                                ▼
┌─────────────────────┐          ┌─────────────────────┐
│   DEV ENVIRONMENT   │          │  PROD ENVIRONMENT   │
│                     │          │                     │
│ scanfi-dev.onrender │          │ scanfi.onrender.com │
│        .com         │          │                     │
│                     │          │                     │
│   🔶 Orange badge   │          │   🟢 Green badge    │
│   "DEVELOPMENT"     │          │   (no badge)        │
└──────────┬──────────┘          └──────────┬──────────┘
           │                                │
           ▼                                ▼
    ┌─────────────┐                 ┌─────────────┐
    │  DEV QR     │                 │  PROD QR    │
    │  (orange)   │                 │  (green)    │
    └─────────────┘                 └─────────────┘
```

---

## Environments

| Environment | URL | Branch | Purpose |
|-------------|-----|--------|---------|
| **Production** | scanfi.onrender.com | `master` | Live users, stable |
| **Development** | scanfi-dev.onrender.com | `develop` | Testing, new features |

---

## Git Branching Strategy

### Branch Structure

```
master (production)
  │
  └── develop (staging)
        │
        ├── feature/shelf-location
        ├── feature/kesko-api
        ├── fix/scanner-ios
        └── ...
```

### Workflow

1. **New feature/fix**: Create branch from `develop`
   ```bash
   git checkout develop
   git pull
   git checkout -b feature/my-feature
   ```

2. **Development work**: Commit to feature branch
   ```bash
   git add .
   git commit -m "Add feature X"
   git push origin feature/my-feature
   ```

3. **Merge to develop**: When feature is ready
   ```bash
   git checkout develop
   git merge feature/my-feature
   git push origin develop
   # Auto-deploys to scanfi-dev.onrender.com
   ```

4. **Test on dev environment**: Use DEV QR code to test on phone

5. **Promote to production**: When tested and approved
   ```bash
   git checkout master
   git merge develop
   git push origin master
   # Auto-deploys to scanfi.onrender.com
   ```

---

## Setup Instructions

### Step 1: Create Develop Branch

```bash
# From your current master branch
git checkout master
git pull
git checkout -b develop
git push -u origin develop
```

### Step 2: Create Dev Environment on Render

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click "New" → "Web Service"
3. Connect same GitHub repo
4. Configure:
   - **Name**: `scanfi-dev`
   - **Branch**: `develop`
   - **Build Command**: (same as production)
   - **Start Command**: (same as production)
   - **Environment Variables**: (copy from production)

### Step 3: Add Visual Indicator for Dev Environment

Add an environment variable to distinguish environments:

**Render Dev Environment Variables:**
```
ENVIRONMENT=development
```

**Render Prod Environment Variables:**
```
ENVIRONMENT=production
```

### Step 4: Update Backend to Show Environment Badge

```python
# backend/app.py - Add environment indicator

import os
ENVIRONMENT = os.environ.get("ENVIRONMENT", "production")

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "environment": ENVIRONMENT,
        "languages": SUPPORTED_LANGS,
        "edamam_available": bool(EDAMAM_APP_ID and EDAMAM_APP_KEY)
    }
```

### Step 5: Update Frontend to Show Dev Banner

```javascript
// frontend/app.js - Add at the top after page load

async function checkEnvironment() {
  try {
    const res = await fetch('/api/health');
    const data = await res.json();
    if (data.environment === 'development') {
      const banner = document.createElement('div');
      banner.id = 'dev-banner';
      banner.innerHTML = '🔶 DEVELOPMENT';
      banner.style.cssText = 'position:fixed;top:0;left:0;right:0;background:#ff6b35;color:#fff;text-align:center;padding:4px;font-weight:bold;font-size:12px;z-index:9999;';
      document.body.prepend(banner);
    }
  } catch (e) {}
}
checkEnvironment();
```

### Step 6: Generate QR Codes

```python
# scripts/generate_qr_codes.py

import qrcode
from pathlib import Path

CODES_DIR = Path("C:/scanfi/frontend/codes")
CODES_DIR.mkdir(exist_ok=True)

# Production QR (green)
prod_qr = qrcode.QRCode(box_size=10, border=2)
prod_qr.add_data('https://scanfi.onrender.com')
prod_qr.make(fit=True)
prod_img = prod_qr.make_image(fill_color="#2ecc71", back_color="white")
prod_img.save(CODES_DIR / "qr-production.png")

# Development QR (orange)
dev_qr = qrcode.QRCode(box_size=10, border=2)
dev_qr.add_data('https://scanfi-dev.onrender.com')
dev_qr.make(fit=True)
dev_img = dev_qr.make_image(fill_color="#ff6b35", back_color="white")
dev_img.save(CODES_DIR / "qr-development.png")

print("QR codes generated:")
print(f"  Production: {CODES_DIR / 'qr-production.png'}")
print(f"  Development: {CODES_DIR / 'qr-development.png'}")
```

---

## QR Code Management

### Physical QR Codes

| QR Code | Color | URL | Usage |
|---------|-------|-----|-------|
| **Production** | Green border | scanfi.onrender.com | Public, end users |
| **Development** | Orange border | scanfi-dev.onrender.com | Testing only |

### QR Code Labels

Create printed labels:

```
┌─────────────────────────┐     ┌─────────────────────────┐
│  ┌─────────────────┐    │     │  ┌─────────────────┐    │
│  │                 │    │     │  │                 │    │
│  │   [PROD QR]     │    │     │  │   [DEV QR]      │    │
│  │                 │    │     │  │                 │    │
│  └─────────────────┘    │     │  └─────────────────┘    │
│                         │     │                         │
│  🟢 ScanFi              │     │  🔶 ScanFi DEV          │
│  Production             │     │  Testing Only           │
│                         │     │  Do not distribute      │
└─────────────────────────┘     └─────────────────────────┘
```

---

## Release Workflow

### Pre-Release Checklist

Before merging `develop` → `master`:

```markdown
## Release Checklist

### Code Quality
- [ ] All new features work on dev environment
- [ ] Tested on both Android and iOS
- [ ] No console errors
- [ ] Scanner works correctly

### Testing
- [ ] Manual test with sample barcodes (6416453020337)
- [ ] Language switching works
- [ ] K-Ruoka button works
- [ ] Error handling works (invalid barcode)

### Documentation
- [ ] CLAUDE.md updated if needed
- [ ] Version number bumped in app.js

### Approval
- [ ] Tested by: _______________
- [ ] Date: _______________
- [ ] Ready for production: [ ] Yes
```

### Release Commands

```bash
# 1. Ensure develop is up to date
git checkout develop
git pull

# 2. Run tests (when implemented)
# npm test

# 3. Merge to master
git checkout master
git pull
git merge develop

# 4. Tag the release
git tag -a v1.x.x -m "Release description"

# 5. Push to production
git push origin master --tags

# 6. Verify deployment
curl -s https://scanfi.onrender.com/api/health | python -c "import sys,json; print(json.load(sys.stdin))"
```

---

## Environment Comparison

| Aspect | Development | Production |
|--------|-------------|------------|
| URL | scanfi-dev.onrender.com | scanfi.onrender.com |
| Branch | `develop` | `master` |
| Banner | Orange "DEVELOPMENT" | None |
| QR Color | Orange | Green |
| Testing | Active development | Stable only |
| Users | Developers only | Public |
| Rollback | Safe to break | Avoid at all costs |

---

## Rollback Procedure

If production has issues after deployment:

```bash
# 1. Revert master to previous commit
git checkout master
git revert HEAD
git push origin master

# OR: Reset to specific tag
git checkout master
git reset --hard v1.2.3
git push origin master --force  # Use with caution!
```

---

## Cost Considerations

Render.com free tier allows multiple services:

| Service | Type | Cost |
|---------|------|------|
| scanfi (prod) | Web Service | Free |
| scanfi-dev | Web Service | Free |

**Note**: Free tier services spin down after inactivity. First request may be slow.

---

## Summary

1. **Create `develop` branch** from `master`
2. **Create dev environment** on Render (scanfi-dev)
3. **Add environment variable** to distinguish dev/prod
4. **Add visual banner** for dev environment
5. **Generate two QR codes** (green=prod, orange=dev)
6. **Always test on dev** before merging to master
7. **Use release checklist** before production deployments
