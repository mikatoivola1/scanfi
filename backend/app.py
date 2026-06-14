"""
ScanFi backend — FastAPI service.

Implements the core loop from the business plan:
  scan shelf code  ->  resolve product  ->  localize to the traveller's language
                   ->  return name + local-equivalent explanation + allergens + legal disclaimer

Data sources (business plan 2.2) are abstracted behind the JSON store in /data.
In production these endpoints would hydrate from GS1 Synkka (primary) and
Open Food Facts (secondary). The `source` / `verified` fields drive the
trust badge shown in the UI.

Run:
    pip install fastapi uvicorn
    uvicorn app:app --reload --port 8000
Then open http://localhost:8000
"""

import json
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
FRONTEND_DIR = BASE_DIR / "frontend"

SUPPORTED_LANGS = ["en", "de", "fr", "es", "zh"]   # launch languages, plan 2.1
DEFAULT_LANG = "en"

# Legal disclaimer (business plan 7.1 — allergy liability). Localized.
DISCLAIMER = {
    "en": "Allergen information is provided for guidance only. Always check the physical product packaging before consuming. ScanFi is not liable for allergic reactions.",
    "de": "Allergenangaben dienen nur zur Orientierung. Prüfen Sie vor dem Verzehr stets die Produktverpackung. ScanFi haftet nicht für allergische Reaktionen.",
    "fr": "Les informations sur les allergènes sont fournies à titre indicatif. Vérifiez toujours l'emballage du produit avant consommation. ScanFi décline toute responsabilité.",
    "es": "La información sobre alérgenos es solo orientativa. Compruebe siempre el envase del producto antes de consumir. ScanFi no se responsabiliza de reacciones alérgicas.",
    "zh": "过敏原信息仅供参考。食用前请务必查看产品实物包装。ScanFi 不对过敏反应承担责任。",
}


def _load_json(name: str) -> dict:
    with open(DATA_DIR / name, "r", encoding="utf-8") as fh:
        return json.load(fh)


PRODUCTS = _load_json("products.json")["products"]
ALLERGENS = _load_json("allergens.json")["allergens"]

# Index by both shelf code and GTIN so a QR code can encode either.
INDEX = {}
for _p in PRODUCTS:
    INDEX[_p["shelfCode"].upper()] = _p
    INDEX[_p["gtin"]] = _p

app = FastAPI(title="ScanFi API", version="0.1.0")


def normalize_lang(lang: str | None) -> str:
    """Map a browser language tag (e.g. 'de-AT', 'zh-Hans') to a supported language."""
    if not lang:
        return DEFAULT_LANG
    base = lang.lower().split("-")[0]
    return base if base in SUPPORTED_LANGS else DEFAULT_LANG


def localize_allergens(keys: list[str], lang: str) -> list[dict]:
    out = []
    for key in keys:
        entry = ALLERGENS.get(key, {})
        out.append({"id": key, "label": entry.get(lang) or entry.get(DEFAULT_LANG) or key})
    return out


def build_payload(product: dict, lang: str) -> dict:
    tr = product["translations"].get(lang) or product["translations"][DEFAULT_LANG]
    return {
        "gtin": product["gtin"],
        "shelfCode": product["shelfCode"],
        "lang": lang,
        "name": tr["name"],
        "localEquivalent": tr["localEquivalent"],
        "usage": tr.get("usage", ""),
        "brand": product.get("brand", ""),
        "category": product.get("category", ""),
        "allergens": localize_allergens(product.get("allergens", []), lang),
        "source": product.get("source", "UNKNOWN"),
        "verified": product.get("verified", False),
        "disclaimer": DISCLAIMER.get(lang, DISCLAIMER[DEFAULT_LANG]),
    }


@app.get("/api/health")
def health():
    return {"status": "ok", "products": len(PRODUCTS), "languages": SUPPORTED_LANGS}


@app.get("/api/products")
def list_products(lang: str = Query(DEFAULT_LANG)):
    lang = normalize_lang(lang)
    return [build_payload(p, lang) for p in PRODUCTS]


@app.get("/api/product/{code}")
def get_product(code: str, lang: str = Query(DEFAULT_LANG)):
    lang = normalize_lang(lang)
    product = INDEX.get(code.upper()) or INDEX.get(code)
    if not product:
        raise HTTPException(status_code=404, detail=f"No product found for code '{code}'")
    return JSONResponse(build_payload(product, lang))


# Serve the PWA. Mounted last so /api/* routes take precedence.
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
