"""
Generate shelf-edge QR codes for ScanFi pilot stores (business plan Phase 1, section 5).

Each QR encodes a shelf URL like  https://<host>/?c=SKF-0001  so that scanning with
the native phone camera opens the PWA directly — no app download (the zero-friction
requirement, section 2.1). For Phase 2 (ESL labels) the same codes are pushed to
electronic shelf labels instead of printed stickers.

Usage:
    pip install qrcode[pil]
    python generate_qr.py --base-url https://scan.fi --out qr_out
"""

import argparse
import json
from pathlib import Path

import qrcode

DATA = Path(__file__).resolve().parent.parent / "data" / "products.json"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-url", default="https://scan.fi", help="Public host serving the PWA")
    ap.add_argument("--out", default="qr_out", help="Output directory for PNG stickers")
    args = ap.parse_args()

    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    products = json.loads(DATA.read_text(encoding="utf-8"))["products"]
    for p in products:
        code = p["shelfCode"]
        url = f"{args.base_url.rstrip('/')}/?c={code}"
        img = qrcode.make(url)
        path = out / f"{code}.png"
        img.save(path)
        print(f"{code:10s} -> {url}  ({path})")

    print(f"\nGenerated {len(products)} QR sticker(s) in {out.resolve()}")


if __name__ == "__main__":
    main()
