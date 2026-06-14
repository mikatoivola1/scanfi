/**
 * Generate QR codes and barcodes as PNG files for testing
 *
 * Run: npm install qrcode barcodelib canvas && node generate-codes.js
 * Or:  npx -y qrcode -o frontend/app-qr.png "http://localhost:3000/"
 */

const fs = require('fs');
const path = require('path');

// Check if we can use the qrcode library
let QRCode;
try {
  QRCode = require('qrcode');
} catch (e) {
  console.log('QRCode library not installed.');
  console.log('');
  console.log('Quick option - generate app QR code with npx:');
  console.log('  npx -y qrcode -o frontend/app-qr.png "http://localhost:3000/"');
  console.log('');
  console.log('Or install dependencies and run again:');
  console.log('  npm install qrcode');
  console.log('  node generate-codes.js');
  process.exit(1);
}

const outputDir = path.join(__dirname, 'frontend', 'codes');

// Create output directory
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

const products = [
  { shelfCode: "SKF-0001", gtin: "6411401012345", name: "Leipajuusto" },
  { shelfCode: "SKF-0002", gtin: "6408430000018", name: "Fazer-Blue" },
  { shelfCode: "SKF-0003", gtin: "6437002000027", name: "Paulig-Coffee" },
  { shelfCode: "SKF-0004", gtin: "6411300000034", name: "Reindeer" },
  { shelfCode: "SKF-0005", gtin: "6411200000041", name: "Rye-Bread" }
];

async function generate() {
  console.log('Generating codes in:', outputDir);
  console.log('');

  // App QR code
  const appUrl = 'http://localhost:3000/';
  const appQrPath = path.join(outputDir, 'app-qr.png');
  await QRCode.toFile(appQrPath, appUrl, { width: 300, margin: 2 });
  console.log('Created: app-qr.png ->', appUrl);

  // Product QR codes
  for (const p of products) {
    const qrPath = path.join(outputDir, `${p.shelfCode}-qr.png`);
    await QRCode.toFile(qrPath, p.shelfCode, { width: 300, margin: 2 });
    console.log(`Created: ${p.shelfCode}-qr.png ->`, p.shelfCode);

    const gtinPath = path.join(outputDir, `${p.shelfCode}-gtin-qr.png`);
    await QRCode.toFile(gtinPath, p.gtin, { width: 300, margin: 2 });
    console.log(`Created: ${p.shelfCode}-gtin-qr.png ->`, p.gtin);
  }

  console.log('');
  console.log('Done! Files saved to: frontend/codes/');
}

generate().catch(console.error);
