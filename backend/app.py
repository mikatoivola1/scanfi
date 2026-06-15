"""
ScanFi backend — FastAPI service.

Fetches product info from Open Food Facts, then auto-translates
to the user's selected language.

Run:
    pip install fastapi uvicorn httpx
    uvicorn app:app --reload --port 8000
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

# Legal disclaimer - pre-translated
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


ALLERGENS = _load_json("allergens.json")["allergens"]

app = FastAPI(title="ScanFi API", version="0.1.0")


def normalize_lang(lang: str | None) -> str:
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


# ---- Translation using MyMemory API (free) ----
MYMEMORY_URL = "https://api.mymemory.translated.net/get"

async def translate_text(text: str, source_lang: str, target_lang: str, client: httpx.AsyncClient) -> str:
    """Translate text using MyMemory API. Free, no API key needed."""
    if not text or source_lang == target_lang:
        return text

    try:
        response = await client.get(
            MYMEMORY_URL,
            params={
                "q": text[:500],  # MyMemory has length limits
                "langpair": f"{source_lang}|{target_lang}"
            },
            timeout=5.0
        )
        if response.status_code == 200:
            data = response.json()
            if data.get("responseStatus") == 200:
                # Check matches for better translations (higher quality scores)
                matches = data.get("matches", [])
                best_translation = None
                best_score = -1

                for match in matches:
                    quality = float(match.get("quality", 0) or 0)
                    match_score = float(match.get("match", 0) or 0)
                    score = quality + (match_score * 100)
                    translation = match.get("translation", "")

                    # Skip wiki-style translations with # or very short ones
                    if translation and "#" not in translation and len(translation) > 2:
                        if score > best_score:
                            best_score = score
                            best_translation = translation

                if best_translation:
                    return best_translation

                # Fallback to main response
                translated = data.get("responseData", {}).get("translatedText", "")
                if translated and "#" not in translated and translated.upper() != text.upper():
                    return translated
    except Exception as e:
        print(f"Translation error: {e}")

    return text  # Return original if translation fails


# ---- Open Food Facts Integration ----
OFF_API_URL = "https://world.openfoodfacts.org/api/v2/product/{barcode}.json"

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
    "en:wheat": "gluten",
    "en:barley": "gluten",
    "en:oats": "gluten",
    "en:rye": "gluten",
    "en:lactose": "lactose",
}


def detect_source_language(product: dict) -> str:
    """Detect the language of the product data."""
    # Check if product has a primary language set
    lc = product.get("lc", "")
    if lc in SUPPORTED_LANGS:
        return lc

    # Check countries - Finnish products likely in Finnish
    countries = product.get("countries_tags", [])
    if "en:finland" in countries:
        return "fi"

    # Default to English
    return "en"


async def fetch_from_open_food_facts(barcode: str, target_lang: str) -> dict | None:
    """Fetch product from Open Food Facts and translate to target language."""
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # Fetch from world (English) subdomain - most complete data
            url = OFF_API_URL.format(barcode=barcode)
            response = await client.get(url)

            if response.status_code != 200:
                return None

            data = response.json()

            if data.get("status") != 1 or "product" not in data:
                return None

            product = data["product"]
            source_lang = detect_source_language(product)

            # Get raw product info (in native language)
            name = product.get("product_name") or "Unknown Product"
            brand = product.get("brands", "").split(",")[0].strip() or "Unknown Brand"
            generic_name = product.get("generic_name") or ""
            categories = product.get("categories") or ""
            category = categories.split(",")[0].strip() if categories else ""
            quantity = product.get("quantity", "")
            ingredients = product.get("ingredients_text") or ""

            # Extract allergens
            allergen_tags = product.get("allergens_tags", [])
            allergens = []
            seen = set()
            for tag in allergen_tags:
                key = OFF_ALLERGEN_MAP.get(tag.lower())
                if key and key not in seen:
                    allergens.append(key)
                    seen.add(key)

            # Translate if needed
            if source_lang != target_lang:
                name = await translate_text(name, source_lang, target_lang, client)
                if generic_name:
                    generic_name = await translate_text(generic_name, source_lang, target_lang, client)
                if category:
                    category = await translate_text(category, source_lang, target_lang, client)
                if ingredients:
                    # Translate first 300 chars of ingredients
                    ingredients = await translate_text(ingredients[:300], source_lang, target_lang, client)

            # Build description
            nutriscore = product.get("nutriscore_grade", "").upper()
            nutriscore_text = f"Nutri-Score: {nutriscore}" if nutriscore and nutriscore != "UNKNOWN" else ""

            description_parts = []
            if generic_name and generic_name.lower() != name.lower():
                description_parts.append(generic_name)
            if category:
                description_parts.append(category)
            if quantity:
                description_parts.append(quantity)
            if nutriscore_text:
                description_parts.append(nutriscore_text)

            local_equivalent = ". ".join(description_parts) if description_parts else ""
            usage = f"Ingredients: {ingredients}{'...' if len(ingredients) >= 300 else ''}" if ingredients else ""

            return {
                "gtin": barcode,
                "shelfCode": barcode,
                "lang": target_lang,
                "name": name,
                "localEquivalent": local_equivalent,
                "usage": usage,
                "brand": brand,
                "category": category,
                "allergens": localize_allergens(allergens, target_lang),
                "source": "OPEN_FOOD_FACTS",
                "verified": False,
                "disclaimer": DISCLAIMER.get(target_lang, DISCLAIMER[DEFAULT_LANG]),
            }
    except Exception as e:
        print(f"Open Food Facts API error: {e}")
        return None


@app.get("/api/health")
def health():
    return {"status": "ok", "languages": SUPPORTED_LANGS}


@app.get("/api/products")
def list_products(lang: str = Query(DEFAULT_LANG)):
    # No local products anymore - return empty list
    return []


@app.get("/api/product/{code}")
async def get_product(code: str, lang: str = Query(DEFAULT_LANG)):
    lang = normalize_lang(lang)
    code = code.strip()

    # Clean barcode - extract digits only
    clean_code = ''.join(c for c in code if c.isdigit())

    if len(clean_code) >= 8:
        off_product = await fetch_from_open_food_facts(clean_code, lang)
        if off_product:
            return JSONResponse(off_product)

    raise HTTPException(status_code=404, detail=f"No product found for code '{code}'")


# Serve the PWA
if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="frontend")
