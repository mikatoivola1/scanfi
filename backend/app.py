"""
ScanFi backend — FastAPI service.

Implements the core loop from the business plan:
  scan shelf code  ->  resolve product  ->  localize to the traveller's language
                   ->  return name + local-equivalent explanation + allergens + legal disclaimer

Data sources (business plan 2.2) are abstracted behind the JSON store in /data.
Falls back to Open Food Facts API for real commercial products.

Run:
    pip install fastapi uvicorn httpx
    uvicorn app:app --reload --port 8000
Then open http://localhost:8000
"""

import json
from pathlib import Path

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
FRONTEND_DIR = BASE_DIR / "frontend"

SUPPORTED_LANGS = ["en", "de", "fr", "es", "zh", "fi", "sv", "ru", "ja", "it", "pt", "nl", "pl"]
DEFAULT_LANG = "en"

# Legal disclaimer (business plan 7.1 — allergy liability). Localized.
DISCLAIMER = {
    "en": "Allergen information is provided for guidance only. Always check the physical product packaging before consuming. ScanFi is not liable for allergic reactions.",
    "de": "Allergenangaben dienen nur zur Orientierung. Prüfen Sie vor dem Verzehr stets die Produktverpackung. ScanFi haftet nicht für allergische Reaktionen.",
    "fr": "Les informations sur les allergènes sont fournies à titre indicatif. Vérifiez toujours l'emballage du produit avant consommation. ScanFi décline toute responsabilité.",
    "es": "La información sobre alérgenos es solo orientativa. Compruebe siempre el envase del producto antes de consumir. ScanFi no se responsabiliza de reacciones alérgicas.",
    "zh": "过敏原信息仅供参考。食用前请务必查看产品实物包装。ScanFi 不对过敏反应承担责任。",
    "fi": "Allergeenitieto on vain ohjeellista. Tarkista aina tuotepakkaus ennen nauttimista. ScanFi ei vastaa allergisista reaktioista.",
    "sv": "Allergeninformation ges endast som vägledning. Kontrollera alltid produktförpackningen före konsumtion. ScanFi ansvarar inte för allergiska reaktioner.",
    "ru": "Информация об аллергенах носит справочный характер. Всегда проверяйте упаковку продукта перед употреблением. ScanFi не несёт ответственности за аллергические реакции.",
    "ja": "アレルゲン情報は参考用です。必ず製品パッケージをご確認ください。ScanFiはアレルギー反応について責任を負いません。",
    "it": "Le informazioni sugli allergeni sono solo indicative. Controllare sempre la confezione del prodotto prima del consumo. ScanFi non è responsabile per reazioni allergiche.",
    "pt": "As informações sobre alergénios são apenas indicativas. Verifique sempre a embalagem do produto antes de consumir. ScanFi não se responsabiliza por reações alérgicas.",
    "nl": "Allergeneninformatie is alleen ter indicatie. Controleer altijd de productverpakking voor consumptie. ScanFi is niet aansprakelijk voor allergische reacties.",
    "pl": "Informacje o alergenach mają charakter orientacyjny. Zawsze sprawdzaj opakowanie produktu przed spożyciem. ScanFi nie ponosi odpowiedzialności za reakcje alergiczne.",
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


# ---- Open Food Facts Integration ----
# Use language-specific OFF subdomain for better localization
OFF_API_URL = "https://{lang}.openfoodfacts.org/api/v2/product/{barcode}.json"
OFF_LANG_MAP = {
    "en": "world",  # world = English
    "de": "de",
    "fr": "fr",
    "es": "es",
    "zh": "cn",
    "fi": "fi",
    "sv": "se",
    "ru": "ru",
    "ja": "jp",
    "it": "it",
    "pt": "pt",
    "nl": "nl",
    "pl": "pl",
}

# Map OFF allergen tags to our allergen keys
OFF_ALLERGEN_MAP = {
    "en:gluten": "gluten",
    "en:milk": "milk",
    "en:eggs": "eggs",
    "en:fish": "fish",
    "en:crustaceans": "crustaceans",
    "en:molluscs": "molluscs",
    "en:nuts": "nuts",
    "en:peanuts": "peanuts",
    "en:soybeans": "soy",
    "en:celery": "celery",
    "en:mustard": "mustard",
    "en:sesame-seeds": "sesame",
    "en:sulphur-dioxide-and-sulphites": "sulphites",
    "en:lupin": "lupin",
    # Common variations
    "en:wheat": "gluten",
    "en:barley": "gluten",
    "en:oats": "gluten",
    "en:rye": "gluten",
    "en:lactose": "lactose",
}


async def fetch_from_open_food_facts(barcode: str, lang: str) -> dict | None:
    """Fetch product from Open Food Facts API."""
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Use language-specific subdomain
            off_lang = OFF_LANG_MAP.get(lang, "world")
            url = OFF_API_URL.format(lang=off_lang, barcode=barcode)
            response = await client.get(url)

            if response.status_code != 200:
                return None

            data = response.json()

            if data.get("status") != 1 or "product" not in data:
                return None

            product = data["product"]

            # Extract product name - prioritize user's language, then English
            name = (
                product.get(f"product_name_{lang}") or
                product.get("product_name_en") or
                product.get("product_name") or
                "Unknown Product"
            )

            # If name is still in Finnish but user wants another language, note it
            original_name = product.get("product_name", "")
            if name == original_name and lang != "fi" and original_name:
                # Product name not translated, keep original but we'll translate description
                pass

            # Extract brand
            brand = product.get("brands", "").split(",")[0].strip() or "Unknown Brand"

            # Extract allergens
            allergen_tags = product.get("allergens_tags", [])
            allergens = []
            seen = set()
            for tag in allergen_tags:
                key = OFF_ALLERGEN_MAP.get(tag.lower())
                if key and key not in seen:
                    allergens.append(key)
                    seen.add(key)

            # Build a useful description - prioritize user's language
            generic_name = (
                product.get(f"generic_name_{lang}") or
                product.get("generic_name_en") or
                product.get("generic_name") or
                ""
            )

            # Get categories in user's language if available
            categories_raw = (
                product.get(f"categories_{lang}") or
                product.get("categories_en") or
                product.get("categories") or
                ""
            )
            categories = [c.strip() for c in categories_raw.split(",") if c.strip()]
            category = categories[0] if categories else ""

            # Get quantity/serving info
            quantity = product.get("quantity", "")

            # Get nutrition grade if available
            nutriscore = product.get("nutriscore_grade", "").upper()
            nutriscore_text = f"Nutri-Score: {nutriscore}" if nutriscore and nutriscore != "UNKNOWN" else ""

            # Build description parts
            description_parts = []
            if generic_name and generic_name.lower() != name.lower():
                description_parts.append(generic_name)
            if category:
                description_parts.append(f"Category: {category}")
            if quantity:
                description_parts.append(f"Size: {quantity}")
            if nutriscore_text:
                description_parts.append(nutriscore_text)

            local_equivalent = ". ".join(description_parts) if description_parts else "Product information from Open Food Facts database."

            # Get ingredients for usage field (more relevant there)
            ingredients = product.get(f"ingredients_text_{lang}") or product.get("ingredients_text_en") or product.get("ingredients_text") or ""
            usage = f"Ingredients: {ingredients[:300]}{'...' if len(ingredients) > 300 else ''}" if ingredients else ""

            return {
                "gtin": barcode,
                "shelfCode": barcode,
                "lang": lang,
                "name": name,
                "localEquivalent": local_equivalent,
                "usage": usage,
                "brand": brand,
                "category": category,
                "allergens": localize_allergens(allergens, lang),
                "source": "OPEN_FOOD_FACTS",
                "verified": False,
                "disclaimer": DISCLAIMER.get(lang, DISCLAIMER[DEFAULT_LANG]),
            }
    except Exception as e:
        print(f"Open Food Facts API error: {e}")
        return None


@app.get("/api/health")
def health():
    return {"status": "ok", "products": len(PRODUCTS), "languages": SUPPORTED_LANGS}


@app.get("/api/products")
def list_products(lang: str = Query(DEFAULT_LANG)):
    lang = normalize_lang(lang)
    return [build_payload(p, lang) for p in PRODUCTS]


@app.get("/api/product/{code}")
async def get_product(code: str, lang: str = Query(DEFAULT_LANG)):
    lang = normalize_lang(lang)
    code = code.strip()

    # First, check local database
    product = INDEX.get(code.upper()) or INDEX.get(code)
    if product:
        return JSONResponse(build_payload(product, lang))

    # If not found locally, try Open Food Facts (for barcodes)
    clean_code = ''.join(c for c in code if c.isdigit())

    if len(clean_code) >= 8:
        off_product = await fetch_from_open_food_facts(clean_code, lang)
        if off_product:
            return JSONResponse(off_product)

    raise HTTPException(status_code=404, detail=f"No product found for code '{code}'")


# Serve the PWA. Mounted last so /api/* routes take precedence.
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
