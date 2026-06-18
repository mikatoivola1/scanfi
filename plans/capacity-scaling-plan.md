# ScanFi Capacity Scaling Plan

## Executive Summary

This document outlines a phased approach to increase ScanFi's user capacity from ~50-100 daily users to 10,000+ concurrent users.

---

## Current Architecture Assessment

### Bottlenecks (Priority Order)

| Bottleneck | Current Limit | Impact |
|------------|---------------|--------|
| MyMemory Translation API | 5,000 words/day | **Critical** - blocks all translations after limit |
| Render.com Free Tier | ~50 concurrent requests | High - causes timeouts under load |
| Open Food Facts API | No SLA, shared public API | Medium - occasional slowdowns |
| No caching layer | Every scan = 2 API calls | High - wastes resources, slow response |

### Current Resource Usage Per Request

```
1 product scan =
  → 1 Open Food Facts API call (~200-500ms)
  → 1-5 MyMemory translation calls (~100-300ms each)
  → ~50-200 words translated
  → Total latency: 500-2000ms
```

---

## Phase 1: Quick Wins (1-2 days)

### 1.1 Add Translation Caching

**Problem:** Same products get translated repeatedly.

**Solution:** Cache translations in memory or file.

```python
# Add to backend/app.py
from functools import lru_cache
import hashlib

translation_cache = {}

def get_cached_translation(text: str, target_lang: str) -> str | None:
    key = f"{hashlib.md5(text.encode()).hexdigest()}:{target_lang}"
    return translation_cache.get(key)

def set_cached_translation(text: str, target_lang: str, translated: str):
    key = f"{hashlib.md5(text.encode()).hexdigest()}:{target_lang}"
    translation_cache[key] = translated
```

**Impact:** Reduces MyMemory API calls by 60-80% for repeat products.

### 1.2 Batch Translation Requests

**Problem:** Multiple separate API calls per product.

**Solution:** Combine texts and translate in one call.

```python
# Instead of 5 separate calls:
# translate(name), translate(brand), translate(ingredients)...

# Combine with separator:
combined = "|||".join([name, brand, ingredients, category, generic_name])
translated = translate(combined, target_lang)
parts = translated.split("|||")
```

**Impact:** Reduces API calls from 5 to 1 per product.

### 1.3 Upgrade Render.com Plan

| Plan | Price | Capacity | Recommendation |
|------|-------|----------|----------------|
| Free | $0 | ~50 concurrent | Current |
| Starter | $7/mo | ~200 concurrent | **Phase 1** |
| Standard | $25/mo | ~500 concurrent | Phase 2 |
| Pro | $85/mo | ~2000 concurrent | Phase 3 |

---

## Phase 2: Infrastructure Improvements (1 week)

### 2.1 Add Redis Cache

**Setup:**
```yaml
# render.yaml addition
databases:
  - name: scanfi-redis
    plan: free
    type: redis
```

**Benefits:**
- Persistent cache (survives restarts)
- Shared across instances
- TTL support (expire old translations)

**Cache Strategy:**
```
Key: product:{barcode}:{lang}
TTL: 7 days
Value: Full translated product JSON
```

**Impact:** 90%+ cache hit rate for popular products.

### 2.2 Replace MyMemory with Better Translation Service

| Service | Free Tier | Paid Tier | Quality |
|---------|-----------|-----------|---------|
| MyMemory | 5,000 words/day | $0.006/word | Medium |
| DeepL | 500,000 chars/mo | $5.49/1M chars | **Excellent** |
| Google Translate | $0 (none) | $20/1M chars | Excellent |
| LibreTranslate | Unlimited (self-host) | Free | Good |

**Recommendation:** DeepL Free API
- 500,000 characters/month free
- ~25,000 product scans/month
- Superior translation quality

### 2.3 Open Food Facts Caching

**Problem:** OFF API can be slow or rate-limited.

**Solution:** Cache product data locally.

```python
# Cache OFF responses for 24 hours
async def get_product(barcode: str):
    cached = redis.get(f"off:{barcode}")
    if cached:
        return json.loads(cached)

    product = await fetch_from_off(barcode)
    redis.setex(f"off:{barcode}", 86400, json.dumps(product))
    return product
```

---

## Phase 3: Horizontal Scaling (2-4 weeks)

### 3.1 Multi-Instance Deployment

```yaml
# render.yaml
services:
  - type: web
    name: scanfi
    env: python
    plan: standard
    scaling:
      minInstances: 2
      maxInstances: 10
      targetCPUPercent: 70
```

**Capacity:** 2,000-10,000 concurrent users.

### 3.2 CDN for Static Assets

**Current:** All assets served by Python backend.

**Improved:** Use Cloudflare or Render CDN.

```
User → Cloudflare CDN → Static assets (cached globally)
                     → API requests → Backend
```

**Benefits:**
- 50-100ms latency (vs 200-500ms)
- Reduces backend load by 40%
- Free tier available

### 3.3 Database for Analytics (Optional)

If tracking scans becomes important:

```yaml
databases:
  - name: scanfi-db
    plan: starter
    type: postgresql

# Track: barcode, language, timestamp, country
```

---

## Phase 4: Enterprise Scale (1-2 months)

### 4.1 Architecture Diagram

```
                    ┌─────────────┐
                    │ Cloudflare  │
                    │    CDN      │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌────▼────┐ ┌─────▼─────┐
        │ Instance 1│ │Instance 2│ │Instance N │
        │  FastAPI  │ │ FastAPI │ │  FastAPI  │
        └─────┬─────┘ └────┬────┘ └─────┬─────┘
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────▼──────┐
                    │    Redis    │
                    │   Cluster   │
                    └──────┬──────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
   ┌─────▼─────┐    ┌──────▼──────┐   ┌──────▼──────┐
   │   OFF     │    │   DeepL     │   │  PostgreSQL │
   │   API     │    │Translation  │   │  (optional) │
   └───────────┘    └─────────────┘   └─────────────┘
```

### 4.2 Self-Hosted Translation (Maximum Scale)

For 100,000+ users, self-host translation:

```yaml
# Deploy LibreTranslate or Argos Translate
services:
  - type: web
    name: scanfi-translate
    env: docker
    dockerfilePath: ./translate/Dockerfile
    plan: pro
```

**Benefits:**
- No API limits
- Predictable costs
- Lower latency

---

## Cost Summary

| Phase | Monthly Cost | User Capacity | Timeline |
|-------|--------------|---------------|----------|
| Current | $0 | 50-100/day | Now |
| Phase 1 | $7 | 500/day | 1-2 days |
| Phase 2 | $25 + DeepL Free | 2,000/day | 1 week |
| Phase 3 | $85 | 10,000/day | 2-4 weeks |
| Phase 4 | $200-500 | 100,000+/day | 1-2 months |

---

## Implementation Checklist

### Phase 1 (Do Now)
- [ ] Add in-memory translation cache to `backend/app.py`
- [ ] Implement batch translation (combine texts)
- [ ] Upgrade Render.com to Starter plan ($7/mo)
- [ ] Add response compression (gzip)

### Phase 2 (Next Sprint)
- [ ] Set up Redis on Render
- [ ] Migrate cache to Redis
- [ ] Sign up for DeepL Free API
- [ ] Implement DeepL integration with MyMemory fallback
- [ ] Add OFF product caching (24h TTL)

### Phase 3 (Growth Phase)
- [ ] Enable auto-scaling (2-10 instances)
- [ ] Set up Cloudflare CDN
- [ ] Add health check monitoring
- [ ] Implement graceful degradation (serve cached data if APIs fail)

### Phase 4 (If Needed)
- [ ] Deploy self-hosted translation
- [ ] Add PostgreSQL for analytics
- [ ] Implement rate limiting per client
- [ ] Add APM monitoring (Sentry, DataDog)

---

## Quick Start Commands

```bash
# Test current capacity
hey -n 1000 -c 50 https://your-app.onrender.com/api/health

# Monitor Redis cache hit rate
redis-cli INFO stats | grep keyspace

# Check translation API usage
curl "https://api.mymemory.translated.net/get?q=test&langpair=en|de"
# Response includes: "quotaFinished": false
```

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| MyMemory rate limit hit | High | Implement caching immediately |
| OFF API downtime | Low | Cache products, show cached data |
| Render.com outage | Low | Multi-region deployment (Phase 4) |
| Translation quality issues | Medium | Use DeepL, add quality monitoring |

---

## Success Metrics

- **Response time:** < 500ms (p95)
- **Cache hit rate:** > 80%
- **API error rate:** < 1%
- **Uptime:** > 99.5%

---

*Document created: 2026-06-16*
*Last updated: 2026-06-16*
