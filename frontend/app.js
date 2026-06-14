/* ScanFi PWA — front-end logic.
 * Zero-friction: no login, no app store. Auto-detects phone language,
 * scans a shelf QR code, and renders localized product + allergen info.
 */

const SUPPORTED = ["en", "de", "fr", "es", "zh"];
const LANG_NAMES = { en: "English", de: "Deutsch", fr: "Français", es: "Español", zh: "中文" };

// UI string table (the app shell itself is localized too, not just product data).
const UI = {
  en: { hint: "Scan QR code or product barcode", lookup: "Look up", manual: "or type a code (e.g. SKF-0001 or barcode)", back: "Scan another", source_v: "Verified data (GS1)", source_c: "Community data", allergens: "Allergens", contains: "Contains", none: "No major allergens listed", equiv: "What is it?", usage: "How to use", notfound: "No product found for that code.", footer: "ScanFi · Demo build · Always check the packaging." },
  de: { hint: "QR-Code oder Produkt-Barcode scannen", lookup: "Suchen", manual: "oder Code eingeben (z.B. SKF-0001 oder Barcode)", back: "Erneut scannen", source_v: "Geprüfte Daten (GS1)", source_c: "Community-Daten", allergens: "Allergene", contains: "Enthält", none: "Keine relevanten Allergene gelistet", equiv: "Was ist das?", usage: "Verwendung", notfound: "Kein Produkt für diesen Code gefunden.", footer: "ScanFi · Demo · Verpackung stets prüfen." },
  fr: { hint: "Scannez le QR code ou le code-barres", lookup: "Rechercher", manual: "ou saisissez un code (ex. SKF-0001 ou code-barres)", back: "Scanner à nouveau", source_v: "Données vérifiées (GS1)", source_c: "Données communautaires", allergens: "Allergènes", contains: "Contient", none: "Aucun allergène majeur signalé", equiv: "Qu'est-ce que c'est ?", usage: "Utilisation", notfound: "Aucun produit trouvé pour ce code.", footer: "ScanFi · Démo · Vérifiez toujours l'emballage." },
  es: { hint: "Escanea el código QR o el código de barras", lookup: "Buscar", manual: "o escribe un código (ej. SKF-0001 o código de barras)", back: "Escanear otro", source_v: "Datos verificados (GS1)", source_c: "Datos de la comunidad", allergens: "Alérgenos", contains: "Contiene", none: "Sin alérgenos principales listados", equiv: "¿Qué es?", usage: "Cómo usar", notfound: "No se encontró producto para ese código.", footer: "ScanFi · Demo · Comprueba siempre el envase." },
  zh: { hint: "扫描二维码或产品条形码", lookup: "查询", manual: "或输入代码（如 SKF-0001 或条形码）", back: "再次扫描", source_v: "已验证数据 (GS1)", source_c: "社区数据", allergens: "过敏原", contains: "含有", none: "未列出主要过敏原", equiv: "这是什么？", usage: "食用方法", notfound: "未找到该代码对应的产品。", footer: "ScanFi · 演示版 · 请务必查看包装。" },
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
  try {
    const res = await fetch(`/api/product/${encodeURIComponent(code)}?lang=${lang}`);
    if (!res.ok) throw new Error("notfound");
    const data = await res.json();
    renderProduct(data);
  } catch (e) {
    showError(UI[lang].notfound);
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
let videoStream = null;
let scanTimer = null;

function startScanner() {
  const readerEl = $("reader");
  readerEl.innerHTML = "";

  // Create video element
  const video = document.createElement("video");
  video.setAttribute("playsinline", "true");
  video.setAttribute("autoplay", "true");
  video.style.cssText = "width:100%;height:100%;object-fit:cover;border-radius:8px;";
  readerEl.appendChild(video);

  // Check for camera support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    readerEl.innerHTML = "<p style='color:red;text-align:center;padding:20px;'>Camera not supported on this browser. Please use manual entry.</p>";
    return;
  }

  // Request camera
  navigator.mediaDevices.getUserMedia({
    video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
  })
  .then(function(stream) {
    videoStream = stream;
    video.srcObject = stream;
    video.play();

    // Start scanning frames with html5-qrcode
    if (window.Html5Qrcode) {
      scanner = new Html5Qrcode("temp-reader-" + Date.now(), { verbose: false });
      scanFrames(video);
    }
  })
  .catch(function(err) {
    console.error("Camera error:", err);
    readerEl.innerHTML = "<p style='color:red;text-align:center;padding:20px;'>Camera access denied. Please allow camera access and refresh.</p>";
  });
}

function scanFrames(video) {
  if (!videoStream || !scanner) return;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  scanTimer = setInterval(function() {
    if (!videoStream) {
      clearInterval(scanTimer);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL("image/png");

    scanner.scanFile(imageData, false)
      .then(function(decodedText) {
        console.log("Scanned:", decodedText);
        if (navigator.vibrate) navigator.vibrate(100);
        stopScanner();
        lookup(extractCode(decodedText));
      })
      .catch(function() {
        // No code found, continue scanning
      });
  }, 200);
}

function stopScanner() {
  if (scanTimer) {
    clearInterval(scanTimer);
    scanTimer = null;
  }
  if (videoStream) {
    videoStream.getTracks().forEach(function(track) { track.stop(); });
    videoStream = null;
  }
  if (scanner) {
    try { scanner.clear(); } catch(e) {}
    scanner = null;
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
  startScanner();
};

buildLangSelect();
applyUiStrings();
buildSamples();

// If opened from a native-camera QR scan (deep link ?c=CODE), look it up immediately.
const deepLink = new URLSearchParams(location.search).get("c");
if (deepLink) {
  lookup(deepLink.trim());
} else {
  // Wait for page to fully load before starting scanner
  if (document.readyState === "complete") {
    startScanner();
  } else {
    window.addEventListener("load", startScanner);
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
