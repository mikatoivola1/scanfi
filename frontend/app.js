/* ScanFi PWA — front-end logic.
 * Zero-friction: no login, no app store. Auto-detects phone language,
 * scans a shelf QR code, and renders localized product + allergen info.
 */

const SUPPORTED = ["en", "de", "fr", "es", "zh", "fi", "sv", "ru", "ja", "it", "pt", "nl", "pl"];
const LANG_NAMES = {
  en: "English", de: "Deutsch", fr: "Français", es: "Español", zh: "中文",
  fi: "Suomi", sv: "Svenska", ru: "Русский", ja: "日本語",
  it: "Italiano", pt: "Português", nl: "Nederlands", pl: "Polski"
};

// UI string table (the app shell itself is localized too, not just product data).
const UI = {
  en: { hint: "Scan QR code or product barcode", lookup: "Look up", manual: "or type a code (e.g. SKF-0001 or barcode)", back: "Scan another", source_v: "Verified data (GS1)", source_c: "Community data", allergens: "Allergens", contains: "Contains", none: "No major allergens listed", equiv: "What is it?", usage: "How to use", notfound: "No product found for that code.", footer: "ScanFi · Demo build · Always check the packaging.", startScan: "Start Scanning" },
  de: { hint: "QR-Code oder Produkt-Barcode scannen", lookup: "Suchen", manual: "oder Code eingeben (z.B. SKF-0001 oder Barcode)", back: "Erneut scannen", source_v: "Geprüfte Daten (GS1)", source_c: "Community-Daten", allergens: "Allergene", contains: "Enthält", none: "Keine relevanten Allergene gelistet", equiv: "Was ist das?", usage: "Verwendung", notfound: "Kein Produkt für diesen Code gefunden.", footer: "ScanFi · Demo · Verpackung stets prüfen.", startScan: "Scannen starten" },
  fr: { hint: "Scannez le QR code ou le code-barres", lookup: "Rechercher", manual: "ou saisissez un code (ex. SKF-0001 ou code-barres)", back: "Scanner à nouveau", source_v: "Données vérifiées (GS1)", source_c: "Données communautaires", allergens: "Allergènes", contains: "Contient", none: "Aucun allergène majeur signalé", equiv: "Qu'est-ce que c'est ?", usage: "Utilisation", notfound: "Aucun produit trouvé pour ce code.", footer: "ScanFi · Démo · Vérifiez toujours l'emballage.", startScan: "Lancer le scan" },
  es: { hint: "Escanea el código QR o el código de barras", lookup: "Buscar", manual: "o escribe un código (ej. SKF-0001 o código de barras)", back: "Escanear otro", source_v: "Datos verificados (GS1)", source_c: "Datos de la comunidad", allergens: "Alérgenos", contains: "Contiene", none: "Sin alérgenos principales listados", equiv: "¿Qué es?", usage: "Cómo usar", notfound: "No se encontró producto para ese código.", footer: "ScanFi · Demo · Comprueba siempre el envase.", startScan: "Iniciar escaneo" },
  zh: { hint: "扫描二维码或产品条形码", lookup: "查询", manual: "或输入代码（如 SKF-0001 或条形码）", back: "再次扫描", source_v: "已验证数据 (GS1)", source_c: "社区数据", allergens: "过敏原", contains: "含有", none: "未列出主要过敏原", equiv: "这是什么？", usage: "食用方法", notfound: "未找到该代码对应的产品。", footer: "ScanFi · 演示版 · 请务必查看包装。", startScan: "开始扫描" },
  fi: { hint: "Skannaa QR-koodi tai viivakoodi", lookup: "Hae", manual: "tai kirjoita koodi (esim. SKF-0001 tai viivakoodi)", back: "Skannaa toinen", source_v: "Vahvistettu tieto (GS1)", source_c: "Yhteisön tieto", allergens: "Allergeenit", contains: "Sisältää", none: "Ei merkittäviä allergeeneja", equiv: "Mikä tämä on?", usage: "Käyttöohje", notfound: "Tuotetta ei löytynyt tällä koodilla.", footer: "ScanFi · Demo · Tarkista aina pakkaus.", startScan: "Aloita skannaus" },
  sv: { hint: "Skanna QR-kod eller streckkod", lookup: "Sök", manual: "eller skriv en kod (t.ex. SKF-0001 eller streckkod)", back: "Skanna igen", source_v: "Verifierad data (GS1)", source_c: "Community-data", allergens: "Allergener", contains: "Innehåller", none: "Inga allergener listade", equiv: "Vad är det?", usage: "Användning", notfound: "Ingen produkt hittades för den koden.", footer: "ScanFi · Demo · Kontrollera alltid förpackningen.", startScan: "Börja skanna" },
  ru: { hint: "Сканируйте QR-код или штрих-код", lookup: "Найти", manual: "или введите код (напр. SKF-0001 или штрих-код)", back: "Сканировать ещё", source_v: "Проверенные данные (GS1)", source_c: "Данные сообщества", allergens: "Аллергены", contains: "Содержит", none: "Аллергены не указаны", equiv: "Что это?", usage: "Применение", notfound: "Продукт не найден.", footer: "ScanFi · Демо · Всегда проверяйте упаковку.", startScan: "Начать сканирование" },
  ja: { hint: "QRコードまたはバーコードをスキャン", lookup: "検索", manual: "またはコードを入力（例：SKF-0001またはバーコード）", back: "もう一度スキャン", source_v: "認証済みデータ (GS1)", source_c: "コミュニティデータ", allergens: "アレルゲン", contains: "含有", none: "主要アレルゲンなし", equiv: "これは何？", usage: "使用方法", notfound: "商品が見つかりません。", footer: "ScanFi · デモ · 必ずパッケージを確認してください。", startScan: "スキャン開始" },
  it: { hint: "Scansiona QR code o codice a barre", lookup: "Cerca", manual: "o inserisci un codice (es. SKF-0001 o codice a barre)", back: "Scansiona altro", source_v: "Dati verificati (GS1)", source_c: "Dati della community", allergens: "Allergeni", contains: "Contiene", none: "Nessun allergene principale", equiv: "Cos'è?", usage: "Come usare", notfound: "Nessun prodotto trovato per questo codice.", footer: "ScanFi · Demo · Controlla sempre la confezione.", startScan: "Inizia scansione" },
  pt: { hint: "Digitalize o código QR ou código de barras", lookup: "Pesquisar", manual: "ou digite um código (ex. SKF-0001 ou código de barras)", back: "Digitalizar outro", source_v: "Dados verificados (GS1)", source_c: "Dados da comunidade", allergens: "Alergénios", contains: "Contém", none: "Sem alergénios principais", equiv: "O que é?", usage: "Como usar", notfound: "Nenhum produto encontrado para este código.", footer: "ScanFi · Demo · Verifique sempre a embalagem.", startScan: "Iniciar digitalização" },
  nl: { hint: "Scan QR-code of barcode", lookup: "Zoeken", manual: "of typ een code (bijv. SKF-0001 of barcode)", back: "Opnieuw scannen", source_v: "Geverifieerde gegevens (GS1)", source_c: "Community-gegevens", allergens: "Allergenen", contains: "Bevat", none: "Geen allergenen vermeld", equiv: "Wat is het?", usage: "Gebruik", notfound: "Geen product gevonden voor deze code.", footer: "ScanFi · Demo · Controleer altijd de verpakking.", startScan: "Start scannen" },
  pl: { hint: "Zeskanuj kod QR lub kod kreskowy", lookup: "Szukaj", manual: "lub wpisz kod (np. SKF-0001 lub kod kreskowy)", back: "Skanuj ponownie", source_v: "Zweryfikowane dane (GS1)", source_c: "Dane społeczności", allergens: "Alergeny", contains: "Zawiera", none: "Brak alergenów", equiv: "Co to jest?", usage: "Jak używać", notfound: "Nie znaleziono produktu.", footer: "ScanFi · Demo · Zawsze sprawdzaj opakowanie.", startScan: "Rozpocznij skanowanie" },
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
  console.log("Looking up code:", code);
  try {
    const url = `/api/product/${encodeURIComponent(code)}?lang=${lang}`;
    console.log("Fetching:", url);
    const res = await fetch(url);
    if (!res.ok) {
      console.log("API returned:", res.status);
      throw new Error("notfound");
    }
    const data = await res.json();
    console.log("Product found:", data);
    renderProduct(data);
  } catch (e) {
    console.error("Lookup error:", e);
    showError(UI[lang].notfound + " (" + code + ")");
  }
}

function renderProduct(p) {
  const t = UI[lang];
  const badgeClass = p.verified ? "verified" : "community";
  const badgeText = p.verified ? t.source_v : t.source_c;

  let allergensHtml;
  if (p.allergens && p.allergens.length) {
    allergensHtml = `<div class="allergens">` +
      p.allergens.map((a) => `<span class="allergen-chip">${escapeHtml(a.label)}</span>`).join("") +
      `</div>`;
  } else {
    allergensHtml = `<div class="allergen-none">✓ ${t.none}</div>`;
  }

  $("productCard").innerHTML = `
    <span class="badge ${badgeClass}">${p.verified ? "✓" : "ℹ"} ${badgeText}</span>
    <h1>${escapeHtml(p.name)}</h1>
    <div class="brand-line">${escapeHtml(p.brand)}</div>

    <div class="section-label">${t.equiv}</div>
    <p class="equiv">${escapeHtml(p.localEquivalent)}</p>

    ${p.usage ? `<div class="section-label">${t.usage}</div><p class="usage">${escapeHtml(p.usage)}</p>` : ""}

    <div class="section-label">${t.allergens}</div>
    ${allergensHtml}

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
  document.getElementById("startScanBtn").addEventListener("click", function() {
    startScanner();
  });
}

function showScannedCode(code) {
  // Put the code in the manual input field and trigger lookup
  const extractedCode = extractCode(code);
  console.log("Scanned code:", code);
  console.log("Extracted code:", extractedCode);
  $("manualCode").value = extractedCode;
  // Call lookup directly after a small delay
  setTimeout(function() {
    var codeToLookup = $("manualCode").value.trim();
    console.log("Looking up:", codeToLookup);
    if (codeToLookup) {
      lookup(codeToLookup);
    }
  }, 200);
}

function startScanner() {
  const readerEl = $("reader");
  readerEl.innerHTML = "";
  readerEl.classList.remove("hidden");

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
      console.log("Scanned:", decodedText);
      if (navigator.vibrate) navigator.vibrate(100);
      // Stop scanner first, THEN show the code (to avoid clear() wiping our HTML)
      stopScanner(function() {
        showScannedCode(decodedText);
      });
    },
    function onScanFailure(error) {
      // Ignore scan failures, keep trying
    }
  ).catch(function(err) {
    console.error("Camera error:", err);
    readerEl.innerHTML = "<p style='color:red;text-align:center;padding:20px;'>Camera access denied. Please allow camera access and refresh, or use manual entry below.</p>";
  });
}

function stopScanner(callback) {
  if (scanner) {
    var s = scanner;
    scanner = null;
    s.stop().then(function() {
      try { s.clear(); } catch(e) {}
      if (callback) callback();
    }).catch(function(err) {
      console.error("Stop error:", err);
      if (callback) callback();
    });
  } else if (callback) {
    callback();
  }
}

/* ---- Sample chips (demo convenience; not part of production UX) ---- */
async function buildSamples() {
  try {
    const res = await fetch(`/api/products?lang=${lang}`);
    const items = await res.json();
    const wrap = $("samples");
    wrap.innerHTML = "";
    items.forEach((p) => {
      const chip = document.createElement("span");
      chip.className = "sample-chip";
      chip.textContent = p.name;
      chip.onclick = () => lookup(p.shelfCode);
      wrap.appendChild(chip);
    });
  } catch (e) { /* backend not running */ }
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
  lookup(deepLink.trim());
} else {
  // Show start button instead of auto-starting scanner
  if (document.readyState === "complete") {
    showStartButton();
  } else {
    window.addEventListener("load", showStartButton);
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
