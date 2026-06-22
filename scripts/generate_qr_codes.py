"""
Generate QR codes for Production and Development environments.
"""

import qrcode
from pathlib import Path

CODES_DIR = Path(__file__).parent.parent / "frontend" / "codes"
CODES_DIR.mkdir(exist_ok=True)

def generate_qr(url: str, filename: str, fill_color: str, label: str):
    """Generate a QR code with custom color."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color=fill_color, back_color="white")

    filepath = CODES_DIR / filename
    img.save(filepath)
    print(f"{label}: {filepath}")
    print(f"  URL: {url}")
    return filepath

def main():
    print("Generating ScanFi QR codes...\n")

    # Production QR (green)
    generate_qr(
        url="https://scanfi.onrender.com",
        filename="qr-production.png",
        fill_color="#2ecc71",
        label="Production QR"
    )

    print()

    # Development QR (orange)
    generate_qr(
        url="https://scanfi-dev.onrender.com",
        filename="qr-development.png",
        fill_color="#ff6b35",
        label="Development QR"
    )

    print("\nDone! QR codes saved to:", CODES_DIR)

if __name__ == "__main__":
    main()
