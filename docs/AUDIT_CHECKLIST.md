# ScanFi Audit Checklist

Quick-reference checklist for completing the audit requirements.

---

## Phase 1: Legal Documents (REQUIRED)

### Privacy Policy
- [ ] Draft privacy policy using template in `SOFTWARE_AUDIT_PROCESS.md`
- [ ] Include third-party services (Open Food Facts, MyMemory, Edamam)
- [ ] Add contact email for privacy inquiries
- [ ] Publish at `https://scanfi.onrender.com/privacy`
- [ ] Add link to app footer

### Terms of Service
- [ ] Draft terms of service
- [ ] Include limitation of liability (allergen disclaimer)
- [ ] Include prohibited uses
- [ ] Publish at `https://scanfi.onrender.com/terms`
- [ ] Add link to app footer

---

## Phase 2: Security Hardening (HIGH PRIORITY)

### Security Headers
```python
# Add to backend/app.py
# See SOFTWARE_AUDIT_PROCESS.md Section 3.2 for full implementation
```
- [ ] X-Content-Type-Options
- [ ] X-Frame-Options
- [ ] Content-Security-Policy
- [ ] Referrer-Policy
- [ ] Permissions-Policy

### Dependency Audit
```bash
# Run these commands
pip-audit --requirement backend/requirements.txt
npm audit  # if applicable
```
- [ ] Run pip-audit
- [ ] Update vulnerable packages
- [ ] Document any exceptions

### Rate Limiting
- [ ] Add slowapi or similar to FastAPI
- [ ] Limit: 60 requests/minute per IP
- [ ] Document rate limit in API response headers

---

## Phase 3: Testing & CI/CD (MEDIUM PRIORITY)

### Unit Tests
- [ ] Create `backend/tests/` directory
- [ ] Write tests for API endpoints
- [ ] Write tests for translation function
- [ ] Achieve 80% code coverage

### CI/CD Pipeline
- [ ] Create `.github/workflows/ci.yml`
- [ ] Add linting step (black, flake8)
- [ ] Add security scanning (bandit)
- [ ] Add test execution
- [ ] Configure auto-deploy to Render

---

## Phase 4: App Store Submission (WHEN READY)

### Google Play
- [ ] Create developer account ($25)
- [ ] Complete Data Safety form
- [ ] Create app icon (512x512)
- [ ] Create feature graphic (1024x500)
- [ ] Take screenshots (phone + tablet)
- [ ] Write store description
- [ ] Complete content rating questionnaire
- [ ] Create TWA wrapper (optional for PWA)

### Apple App Store
- [ ] Enroll in Apple Developer Program ($99/year)
- [ ] Create native wrapper (Capacitor recommended)
- [ ] Complete App Privacy details
- [ ] Create app icon set (all sizes)
- [ ] Take screenshots (all device sizes)
- [ ] Submit for TestFlight
- [ ] Submit for App Review

---

## Verification Commands

```bash
# 1. Security scan
pip install bandit pip-audit
bandit -r backend/
pip-audit

# 2. Check security headers
curl -I https://scanfi.onrender.com | grep -E "X-|Content-Security"

# 3. Verify HTTPS
curl -s https://scanfi.onrender.com | head -1

# 4. Check rate limiting (should see 429 eventually)
for i in {1..100}; do curl -s -o /dev/null -w "%{http_code}\n" https://scanfi.onrender.com/api/health; done

# 5. Test API responses
curl -s "https://scanfi.onrender.com/api/product/6416453020337?lang=fi" | python -c "import sys,json; print(json.load(sys.stdin).get('name'))"
```

---

## Sign-off

| Phase | Completed By | Date | Verified By |
|-------|-------------|------|-------------|
| Legal Documents | | | |
| Security Hardening | | | |
| Testing & CI/CD | | | |
| Google Play Ready | | | |
| Apple App Store Ready | | | |

---

**Next Steps**: Start with Phase 1 (Legal Documents) as they are blockers for app store submission.
