/* ScanFi PWA — front-end logic.
 * Zero-friction: no login, no app store. Auto-detects phone language,
 * scans a shelf QR code, and renders localized product + allergen info.
 */

// Scanner library state (lazy-loaded)
let scannerLibLoaded = false;
let scannerLibLoading = false;
let cameraWarmedUp = false;

// Lazy-load the QR scanner library only when needed
function loadScannerLib() {
  return new Promise((resolve, reject) => {
    if (scannerLibLoaded) {
      resolve();
      return;
    }
    if (scannerLibLoading) {
      // Already loading, wait for it
      const check = setInterval(() => {
        if (scannerLibLoaded) {
          clearInterval(check);
          resolve();
        }
      }, 50);
      return;
    }
    scannerLibLoading = true;
    const script = document.createElement("script");
    script.src = "https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js";
    script.onload = () => {
      scannerLibLoaded = true;
      scannerLibLoading = false;
      resolve();
    };
    script.onerror = () => {
      scannerLibLoading = false;
      reject(new Error("Failed to load scanner library"));
    };
    document.head.appendChild(script);
  });
}

// Pre-warm camera if permission already granted (no prompt)
function warmUpCamera() {
  if (cameraWarmedUp || !navigator.mediaDevices || !navigator.permissions) return;
  // Only warm up if permission already granted (don't trigger prompt)
  navigator.permissions.query({ name: 'camera' })
    .then(result => {
      if (result.state === 'granted') {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
          .then(stream => {
            cameraWarmedUp = true;
            stream.getTracks().forEach(t => t.stop());
          })
          .catch(() => {});
      }
    })
    .catch(() => {}); // Permissions API not supported, skip warmup
}

// Pre-fetch scanner library in background (non-blocking)
function prefetchScannerLib() {
  // Start loading after a short delay to not compete with critical resources
  setTimeout(() => {
    loadScannerLib()
      .then(() => warmUpCamera()) // After lib loads, warm up camera
      .catch(() => {});
  }, 100);
}

const SUPPORTED = ["en", "de", "fr", "es", "zh", "fi", "sv", "ru", "ja", "it", "pt", "nl", "pl"];
const LANG_NAMES = {
  en: "English", de: "Deutsch", fr: "Français", es: "Español", zh: "中文",
  fi: "Suomi", sv: "Svenska", ru: "Русский", ja: "日本語",
  it: "Italiano", pt: "Português", nl: "Nederlands", pl: "Polski"
};

// UI string table (the app shell itself is localized too, not just product data).
const UI = {
  en: { hint: "Scan QR code or product barcode", lookup: "Look up", manual: "or type a code (e.g. SKF-0001 or barcode)", back: "Scan another", source_v: "Verified data (GS1)", source_c: "Community data", allergens: "Allergens", traces: "May contain", none: "No major allergens listed", ingredients: "Ingredients", nutrition: "Nutrition (per 100g)", calories: "Calories", fat: "Fat", saturatedFat: "Saturated fat", carbs: "Carbs", sugars: "Sugars", proteins: "Protein", salt: "Salt", fiber: "Fiber", notfound: "No product found for that code.", footer: "ScanFi · Demo build · Always check the packaging.", startScan: "Start Scanning" },
  de: { hint: "QR-Code oder Produkt-Barcode scannen", lookup: "Suchen", manual: "oder Code eingeben (z.B. SKF-0001 oder Barcode)", back: "Erneut scannen", source_v: "Geprüfte Daten (GS1)", source_c: "Community-Daten", allergens: "Allergene", traces: "Kann enthalten", none: "Keine relevanten Allergene gelistet", ingredients: "Zutaten", nutrition: "Nährwerte (pro 100g)", calories: "Kalorien", fat: "Fett", saturatedFat: "Gesättigte Fettsäuren", carbs: "Kohlenhydrate", sugars: "Zucker", proteins: "Eiweiß", salt: "Salz", fiber: "Ballaststoffe", notfound: "Kein Produkt für diesen Code gefunden.", footer: "ScanFi · Demo · Verpackung stets prüfen.", startScan: "Scannen starten" },
  fr: { hint: "Scannez le QR code ou le code-barres", lookup: "Rechercher", manual: "ou saisissez un code (ex. SKF-0001 ou code-barres)", back: "Scanner à nouveau", source_v: "Données vérifiées (GS1)", source_c: "Données communautaires", allergens: "Allergènes", traces: "Peut contenir", none: "Aucun allergène majeur signalé", ingredients: "Ingrédients", nutrition: "Nutrition (pour 100g)", calories: "Calories", fat: "Matières grasses", saturatedFat: "Graisses saturées", carbs: "Glucides", sugars: "Sucres", proteins: "Protéines", salt: "Sel", fiber: "Fibres", notfound: "Aucun produit trouvé pour ce code.", footer: "ScanFi · Démo · Vérifiez toujours l'emballage.", startScan: "Lancer le scan" },
  es: { hint: "Escanea el código QR o el código de barras", lookup: "Buscar", manual: "o escribe un código (ej. SKF-0001 o código de barras)", back: "Escanear otro", source_v: "Datos verificados (GS1)", source_c: "Datos de la comunidad", allergens: "Alérgenos", traces: "Puede contener", none: "Sin alérgenos principales listados", ingredients: "Ingredientes", nutrition: "Nutrición (por 100g)", calories: "Calorías", fat: "Grasas", saturatedFat: "Grasas saturadas", carbs: "Carbohidratos", sugars: "Azúcares", proteins: "Proteínas", salt: "Sal", fiber: "Fibra", notfound: "No se encontró producto para ese código.", footer: "ScanFi · Demo · Comprueba siempre el envase.", startScan: "Iniciar escaneo" },
  zh: { hint: "扫描二维码或产品条形码", lookup: "查询", manual: "或输入代码（如 SKF-0001 或条形码）", back: "再次扫描", source_v: "已验证数据 (GS1)", source_c: "社区数据", allergens: "过敏原", traces: "可能含有", none: "未列出主要过敏原", ingredients: "成分", nutrition: "营养成分 (每100克)", calories: "热量", fat: "脂肪", saturatedFat: "饱和脂肪", carbs: "碳水化合物", sugars: "糖", proteins: "蛋白质", salt: "盐", fiber: "纤维", notfound: "未找到该代码对应的产品。", footer: "ScanFi · 演示版 · 请务必查看包装。", startScan: "开始扫描" },
  fi: { hint: "Skannaa QR-koodi tai viivakoodi", lookup: "Hae", manual: "tai kirjoita koodi (esim. SKF-0001 tai viivakoodi)", back: "Skannaa toinen", source_v: "Vahvistettu tieto (GS1)", source_c: "Yhteisön tieto", allergens: "Allergeenit", traces: "Saattaa sisältää", none: "Ei merkittäviä allergeeneja", ingredients: "Ainesosat", nutrition: "Ravintosisältö (per 100g)", calories: "Kalorit", fat: "Rasva", saturatedFat: "Tyydyttynyt rasva", carbs: "Hiilihydraatit", sugars: "Sokerit", proteins: "Proteiini", salt: "Suola", fiber: "Kuitu", notfound: "Tuotetta ei löytynyt tällä koodilla.", footer: "ScanFi · Demo · Tarkista aina pakkaus.", startScan: "Aloita skannaus" },
  sv: { hint: "Skanna QR-kod eller streckkod", lookup: "Sök", manual: "eller skriv en kod (t.ex. SKF-0001 eller streckkod)", back: "Skanna igen", source_v: "Verifierad data (GS1)", source_c: "Community-data", allergens: "Allergener", traces: "Kan innehålla", none: "Inga allergener listade", ingredients: "Ingredienser", nutrition: "Näringsvärde (per 100g)", calories: "Kalorier", fat: "Fett", saturatedFat: "Mättat fett", carbs: "Kolhydrater", sugars: "Socker", proteins: "Protein", salt: "Salt", fiber: "Fiber", notfound: "Ingen produkt hittades för den koden.", footer: "ScanFi · Demo · Kontrollera alltid förpackningen.", startScan: "Börja skanna" },
  ru: { hint: "Сканируйте QR-код или штрих-код", lookup: "Найти", manual: "или введите код (напр. SKF-0001 или штрих-код)", back: "Сканировать ещё", source_v: "Проверенные данные (GS1)", source_c: "Данные сообщества", allergens: "Аллергены", traces: "Может содержать", none: "Аллергены не указаны", ingredients: "Состав", nutrition: "Пищевая ценность (на 100г)", calories: "Калории", fat: "Жиры", saturatedFat: "Насыщенные жиры", carbs: "Углеводы", sugars: "Сахар", proteins: "Белки", salt: "Соль", fiber: "Клетчатка", notfound: "Продукт не найден.", footer: "ScanFi · Демо · Всегда проверяйте упаковку.", startScan: "Начать сканирование" },
  ja: { hint: "QRコードまたはバーコードをスキャン", lookup: "検索", manual: "またはコードを入力（例：SKF-0001またはバーコード）", back: "もう一度スキャン", source_v: "認証済みデータ (GS1)", source_c: "コミュニティデータ", allergens: "アレルゲン", traces: "含む可能性", none: "主要アレルゲンなし", ingredients: "原材料", nutrition: "栄養成分 (100gあたり)", calories: "カロリー", fat: "脂質", saturatedFat: "飽和脂肪酸", carbs: "炭水化物", sugars: "糖質", proteins: "タンパク質", salt: "塩分", fiber: "食物繊維", notfound: "商品が見つかりません。", footer: "ScanFi · デモ · 必ずパッケージを確認してください。", startScan: "スキャン開始" },
  it: { hint: "Scansiona QR code o codice a barre", lookup: "Cerca", manual: "o inserisci un codice (es. SKF-0001 o codice a barre)", back: "Scansiona altro", source_v: "Dati verificati (GS1)", source_c: "Dati della community", allergens: "Allergeni", traces: "Può contenere", none: "Nessun allergene principale", ingredients: "Ingredienti", nutrition: "Valori nutrizionali (per 100g)", calories: "Calorie", fat: "Grassi", saturatedFat: "Grassi saturi", carbs: "Carboidrati", sugars: "Zuccheri", proteins: "Proteine", salt: "Sale", fiber: "Fibre", notfound: "Nessun prodotto trovato per questo codice.", footer: "ScanFi · Demo · Controlla sempre la confezione.", startScan: "Inizia scansione" },
  pt: { hint: "Digitalize o código QR ou código de barras", lookup: "Pesquisar", manual: "ou digite um código (ex. SKF-0001 ou código de barras)", back: "Digitalizar outro", source_v: "Dados verificados (GS1)", source_c: "Dados da comunidade", allergens: "Alergénios", traces: "Pode conter", none: "Sem alergénios principais", ingredients: "Ingredientes", nutrition: "Nutrição (por 100g)", calories: "Calorias", fat: "Gordura", saturatedFat: "Gordura saturada", carbs: "Carboidratos", sugars: "Açúcares", proteins: "Proteínas", salt: "Sal", fiber: "Fibra", notfound: "Nenhum produto encontrado para este código.", footer: "ScanFi · Demo · Verifique sempre a embalagem.", startScan: "Iniciar digitalização" },
  nl: { hint: "Scan QR-code of barcode", lookup: "Zoeken", manual: "of typ een code (bijv. SKF-0001 of barcode)", back: "Opnieuw scannen", source_v: "Geverifieerde gegevens (GS1)", source_c: "Community-gegevens", allergens: "Allergenen", traces: "Kan bevatten", none: "Geen allergenen vermeld", ingredients: "Ingrediënten", nutrition: "Voedingswaarde (per 100g)", calories: "Calorieën", fat: "Vet", saturatedFat: "Verzadigd vet", carbs: "Koolhydraten", sugars: "Suikers", proteins: "Eiwitten", salt: "Zout", fiber: "Vezels", notfound: "Geen product gevonden voor deze code.", footer: "ScanFi · Demo · Controleer altijd de verpakking.", startScan: "Start scannen" },
  pl: { hint: "Zeskanuj kod QR lub kod kreskowy", lookup: "Szukaj", manual: "lub wpisz kod (np. SKF-0001 lub kod kreskowy)", back: "Skanuj ponownie", source_v: "Zweryfikowane dane (GS1)", source_c: "Dane społeczności", allergens: "Alergeny", traces: "Może zawierać", none: "Brak alergenów", ingredients: "Składniki", nutrition: "Wartości odżywcze (na 100g)", calories: "Kalorie", fat: "Tłuszcz", saturatedFat: "Tłuszcz nasycony", carbs: "Węglowodany", sugars: "Cukry", proteins: "Białko", salt: "Sól", fiber: "Błonnik", notfound: "Nie znaleziono produktu.", footer: "ScanFi · Demo · Zawsze sprawdzaj opakowanie.", startScan: "Rozpocznij skanowanie" },
};

function detectLang() {
  const stored = localStorage.getItem("scanfi_lang");
  if (stored && SUPPORTED.includes(stored)) return stored;
  const nav = (navigator.language || "en").toLowerCase().split("-")[0];
  return SUPPORTED.includes(nav) ? nav : "en";
}

let lang = detectLang();
let scanner = null;

const $ = (id) => document.getElementById(id);

function applyUiStrings() {
  const t = UI[lang];
  $("hintText").textContent = t.hint;
  $("manualBtn").textContent = t.lookup;
  $("manualCode").placeholder = t.manual;
  $("backLabel").textContent = t.back;
  $("footer").textContent = t.footer;
  document.documentElement.lang = lang;
}

function buildLangSelect() {
  const sel = $("langSelect");
  sel.innerHTML = "";
  SUPPORTED.forEach((l) => {
    const o = document.createElement("option");
    o.value = l;
    o.textContent = LANG_NAMES[l];
    if (l === lang) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = () => {
    lang = sel.value;
    localStorage.setItem("scanfi_lang", lang);
    applyUiStrings();
    buildSamples();
  };
}

async function lookup(code) {
  $("errorBox").classList.add("hidden");

  // Show loading state immediately
  $("scannerView").classList.add("hidden");
  $("productView").classList.remove("hidden");
  $("productCard").innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:3rem;">
      <div style="width:50px;height:50px;border:3px solid #38ada9;border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></div>
      <p style="margin-top:1rem;color:#636e72;">${code}</p>
      <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
    </div>
  `;

  try {
    const res = await fetch(`/api/product/${encodeURIComponent(code)}?lang=${lang}`);
    if (!res.ok) throw new Error("notfound");
    const data = await res.json();
    renderProduct(data);
  } catch (e) {
    showError(UI[lang].notfound);
    // Go back to scanner view on error
    $("productView").classList.add("hidden");
    $("scannerView").classList.remove("hidden");
    showStartButton();
  }
}

function renderProduct(p) {
  const t = UI[lang];
  const badgeClass = p.verified ? "verified" : "community";
  const badgeText = p.verified ? t.source_v : t.source_c;

  // Show original name with translation if different
  const origName = p.originalName || p.name;
  const transName = p.name;
  const nameHtml = (origName !== transName && transName)
    ? `<h1>${escapeHtml(origName)}</h1><div class="translated-name">(${escapeHtml(transName)})</div>`
    : `<h1>${escapeHtml(origName)}</h1>`;

  // Show original brand with translation if different
  const origBrand = p.originalBrand || p.brand;
  const transBrand = p.brand;
  const brandHtml = (origBrand !== transBrand && transBrand)
    ? `${escapeHtml(origBrand)} <span class="translated-brand">(${escapeHtml(transBrand)})</span>`
    : escapeHtml(origBrand);

  // Product image
  const imageHtml = p.imageUrl
    ? `<img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(origName)}" class="product-image">`
    : '';

  // Quantity and generic name
  let infoLine = [];
  if (p.quantity) infoLine.push(p.quantity);
  if (p.genericName && p.genericName.toLowerCase() !== origName.toLowerCase()) infoLine.push(p.genericName);
  const infoHtml = infoLine.length ? `<div class="info-line">${escapeHtml(infoLine.join(' · '))}</div>` : '';

  // Scores (Nutri-Score, NOVA, Eco-Score)
  let scoresHtml = '';
  if (p.nutriScore || p.novaGroup || p.ecoScore) {
    let scores = [];
    if (p.nutriScore) scores.push(`<span class="score nutri-${p.nutriScore.toLowerCase()}">Nutri-Score ${p.nutriScore}</span>`);
    if (p.novaGroup) scores.push(`<span class="score nova-${p.novaGroup}">NOVA ${p.novaGroup}</span>`);
    if (p.ecoScore) scores.push(`<span class="score eco-${p.ecoScore.toLowerCase()}">Eco-Score ${p.ecoScore}</span>`);
    scoresHtml = `<div class="scores">${scores.join('')}</div>`;
  }

  // Allergens
  let allergensHtml = '';
  if (p.allergens && p.allergens.length) {
    allergensHtml = `<div class="section-label">${t.allergens}</div><div class="allergens">` +
      p.allergens.map((a) => `<span class="allergen-chip">${escapeHtml(a.label)}</span>`).join("") +
      `</div>`;
  }

  // Traces (may contain)
  let tracesHtml = '';
  if (p.traces && p.traces.length) {
    tracesHtml = `<div class="section-label">${t.traces}</div><div class="traces">` +
      p.traces.map((a) => `<span class="trace-chip">${escapeHtml(a.label)}</span>`).join("") +
      `</div>`;
  }

  // No allergens message
  if (!allergensHtml && !tracesHtml) {
    allergensHtml = `<div class="section-label">${t.allergens}</div><div class="allergen-none">✓ ${t.none}</div>`;
  }

  // Ingredients
  const ingredientsHtml = p.ingredients
    ? `<div class="section-label">${t.ingredients}</div><p class="ingredients-text">${escapeHtml(p.ingredients)}</p>`
    : '';

  // Nutrition facts
  let nutritionHtml = '';
  if (p.nutrition && Object.keys(p.nutrition).length > 0) {
    const n = p.nutrition;
    let rows = [];
    if (n.energy_kcal !== undefined) rows.push(`<tr><td>${t.calories}</td><td>${n.energy_kcal} kcal</td></tr>`);
    if (n.fat !== undefined) rows.push(`<tr><td>${t.fat}</td><td>${n.fat}g</td></tr>`);
    if (n.saturated_fat !== undefined) rows.push(`<tr><td class="indent">${t.saturatedFat}</td><td>${n.saturated_fat}g</td></tr>`);
    if (n.carbs !== undefined) rows.push(`<tr><td>${t.carbs}</td><td>${n.carbs}g</td></tr>`);
    if (n.sugars !== undefined) rows.push(`<tr><td class="indent">${t.sugars}</td><td>${n.sugars}g</td></tr>`);
    if (n.proteins !== undefined) rows.push(`<tr><td>${t.proteins}</td><td>${n.proteins}g</td></tr>`);
    if (n.salt !== undefined) rows.push(`<tr><td>${t.salt}</td><td>${n.salt}g</td></tr>`);
    if (n.fiber !== undefined) rows.push(`<tr><td>${t.fiber}</td><td>${n.fiber}g</td></tr>`);

    if (rows.length) {
      nutritionHtml = `<div class="section-label">${t.nutrition}</div><table class="nutrition-table">${rows.join('')}</table>`;
    }
  }

  // Dietary badges (halal, kosher, vegan, vegetarian)
  let dietaryHtml = '';
  if (p.dietary) {
    let badges = [];
    if (p.dietary.halal) badges.push(`<span class="dietary-badge halal">✓ Halal</span>`);
    if (p.dietary.kosher) badges.push(`<span class="dietary-badge kosher">✓ Kosher</span>`);
    if (p.dietary.vegan) badges.push(`<span class="dietary-badge vegan">✓ Vegan</span>`);
    if (p.dietary.vegetarian && !p.dietary.vegan) badges.push(`<span class="dietary-badge vegetarian">✓ Vegetarian</span>`);
    if (badges.length) {
      dietaryHtml = `<div class="dietary-badges">${badges.join('')}</div>`;
    }
  }

  // Labels
  const labelsHtml = p.labels
    ? `<div class="labels">${escapeHtml(p.labels)}</div>`
    : '';

  $("productCard").innerHTML = `
    <span class="badge ${badgeClass}">${p.verified ? "✓" : "ℹ"} ${badgeText}</span>
    ${imageHtml}
    ${nameHtml}
    <div class="brand-line">${brandHtml}</div>
    ${infoHtml}
    ${scoresHtml}
    ${dietaryHtml}
    ${labelsHtml}

    ${allergensHtml}
    ${tracesHtml}

    ${ingredientsHtml}
    ${nutritionHtml}

    <p class="disclaimer">${escapeHtml(p.disclaimer)}</p>
  `;

  $("scannerView").classList.add("hidden");
  $("productView").classList.remove("hidden");
  stopScanner();
}

function showError(msg) {
  const box = $("errorBox");
  box.textContent = msg;
  box.classList.remove("hidden");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// QR codes encode either a raw shelf code or a URL like https://scan.fi/?c=SKF-0001.
function extractCode(text) {
  try {
    const u = new URL(text);
    const c = u.searchParams.get("c");
    if (c) return c.trim();
    return u.pathname.split("/").filter(Boolean).pop() || text.trim();
  } catch {
    return text.trim();
  }
}

/* ---- QR + Barcode scanner ---- */

function showStartButton() {
  const readerEl = $("reader");
  const t = UI[lang];
  readerEl.classList.remove("hidden");
  readerEl.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;padding:2rem;">
      <button id="startScanBtn" style="padding:1.5rem 3rem;font-size:1.2rem;background:#38ada9;color:#fff;border:none;border-radius:12px;cursor:pointer;font-weight:600;">
        ${t.startScan}
      </button>
    </div>
  `;
  document.getElementById("startScanBtn").addEventListener("click", async function() {
    // Immediately show camera-ready state (instant visual feedback)
    readerEl.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:#38ada9;">
        <div style="width:60px;height:60px;border:3px solid #38ada9;border-top-color:transparent;border-radius:50%;animation:spin 1s linear infinite;"></div>
        <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
      </div>
    `;

    try {
      await loadScannerLib();
      startScanner();
    } catch (e) {
      readerEl.innerHTML = "<p style='color:red;text-align:center;padding:20px;'>Failed to load scanner. Please refresh and try again.</p>";
    }
  });
}

function startScanner() {
  const readerEl = $("reader");
  readerEl.innerHTML = "";

  // Check for camera support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    readerEl.innerHTML = "<p style='color:red;text-align:center;padding:20px;'>Camera not supported on this browser. Please use manual entry.</p>";
    return;
  }

  // Use Html5Qrcode's built-in camera support
  scanner = new Html5Qrcode("reader");

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

  scanner.start(
    { facingMode: "environment" },
    config,
    function onScanSuccess(decodedText) {
      if (navigator.vibrate) navigator.vibrate(100);
      var code = extractCode(decodedText);
      // Show code immediately
      $("manualCode").value = code;
      // Stop scanner and lookup in parallel
      stopScanner();
      lookup(code);
    },
    function onScanFailure(error) {
      // Ignore scan failures, keep trying
    }
  ).catch(function(err) {
    readerEl.innerHTML = "<p style='color:red;text-align:center;padding:20px;'>Camera access denied. Please allow camera access and refresh, or use manual entry below.</p>";
  });
}

function stopScanner() {
  if (scanner) {
    scanner.stop().then(function() {
      scanner.clear();
      scanner = null;
    }).catch(function(err) {
      scanner = null;
    });
  }
}

/* ---- Sample chips removed - using Open Food Facts only ---- */
function buildSamples() {
  // No longer using local products
  const wrap = $("samples");
  if (wrap) wrap.innerHTML = "";
}

/* ---- wiring ---- */
$("manualBtn").onclick = () => {
  const v = $("manualCode").value.trim();
  if (v) lookup(v);
};
$("manualCode").addEventListener("keydown", (e) => { if (e.key === "Enter") $("manualBtn").click(); });
$("backBtn").onclick = () => {
  $("productView").classList.add("hidden");
  $("scannerView").classList.remove("hidden");
  showStartButton();
};


buildLangSelect();
applyUiStrings();
buildSamples();

// If opened from a native-camera QR scan (deep link ?c=CODE), look it up immediately.
const deepLink = new URLSearchParams(location.search).get("c");
if (deepLink) {
  // For deep links, pre-load scanner library in background
  loadScannerLib().catch(() => {});
  lookup(deepLink.trim());
} else {
  // Show start button instead of auto-starting scanner
  if (document.readyState === "complete") {
    showStartButton();
    prefetchScannerLib();
  } else {
    window.addEventListener("load", () => {
      showStartButton();
      prefetchScannerLib();
    });
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
