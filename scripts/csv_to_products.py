#!/usr/bin/env python3
"""
Convierte el catálogo PedidosYa de Vape 2 Go a products.json para Next.js.
Uso: python3 scripts/csv_to_products.py
Output: src/data/products.json
"""

import csv
import json
import re
import os

CSV_PATH = os.path.expanduser("~/Downloads/Catalogo completo Vape 2 Go.csv")
OUTPUT_PATH = os.path.join(os.path.dirname(__file__), "../src/data/products.json")

# Keywords para detectar categoría (en minúsculas)
CATEGORY_RULES = [
    ("accesorios", ["heets", "terea", "marlboro", "cajetilla", "caja de", "cigarrillo"]),
    ("pods",       ["iqos", "kit iqos", "pod system", "smok nord", "vaporesso", "voopoo", "uwell", "caliburn", "argus", "drag", "geekvape", "aegis", "suorin", "pod mod", "intro kit", "originals kit", "originals intro"]),
    ("liquids",    ["liquid", "juice", "e-liquid", "salt nic", "salt de", "nicotina salt", "nic salt", "freebase", "mg/ml", "60ml", "100ml", "30ml"]),
    ("desechables",["desechable", "disposable", "waka", "elf bar", "elfbar", "geek bar", "geekbar", "fume", "lost mary", "bang", "air bar", "raz", "hyppe", "hyde", "tyson", "mr fog", "flum", "breeze", "cali", "pop", "puff bar", "randm", "tornado", "vozol", "oxbar", "maskking", "aroma king", "crystal", "puff", "bc5000", "bc3500", "bc10000"]),
]

KNOWN_BRANDS = [
    "WAKA", "Elf Bar", "Geek Bar", "Fume", "Lost Mary", "IQOS", "Heets", "Terea",
    "SMOK", "Vaporesso", "Voopoo", "Uwell", "Geekvape", "Suorin", "Bang", "Air Bar",
    "RAZ", "Hyde", "Mr Fog", "Flum", "Breeze", "Puff Bar", "RandM", "Vozol", "Oxbar",
    "Maskking", "Aroma King", "Crystal Bar", "Tyson", "Hyppe", "Caliburn",
]

def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r"[áàäâ]", "a", text)
    text = re.sub(r"[éèëê]", "e", text)
    text = re.sub(r"[íìïî]", "i", text)
    text = re.sub(r"[óòöô]", "o", text)
    text = re.sub(r"[úùüû]", "u", text)
    text = re.sub(r"ñ", "n", text)
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text)
    return text.strip("-")

def detect_category(name: str) -> str:
    lower = name.lower()
    for cat, keywords in CATEGORY_RULES:
        if any(kw in lower for kw in keywords):
            return cat
    return "desechables"

def extract_brand(name: str) -> str:
    lower = name.lower()
    for brand in KNOWN_BRANDS:
        if brand.lower() in lower:
            return brand
    # Fallback: primer token que no sea artículo
    tokens = name.split()
    skip = {"cajetilla", "caja", "kit", "originals", "nuevo", "pack"}
    for t in tokens:
        if t.lower() not in skip and len(t) > 2:
            return t.title()
    return tokens[0].title() if tokens else "Generic"

def make_unique_slug(base_slug: str, seen: set) -> str:
    slug = base_slug
    counter = 2
    while slug in seen:
        slug = f"{base_slug}-{counter}"
        counter += 1
    seen.add(slug)
    return slug

def main():
    products = []
    seen_slugs: set = set()
    skipped = 0

    csv_abs = os.path.abspath(CSV_PATH)
    print(f"Reading: {csv_abs}")

    with open(csv_abs, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            name = row.get("productTitle::es_DO", "").strip()
            sku = row.get("sku", "").strip()
            master_code = row.get("master_product_code", "").strip()
            image_url = row.get("imageUrls", "").strip()

            if not name:
                skipped += 1
                continue

            base_slug = slugify(name)
            if not base_slug:
                skipped += 1
                continue

            product_id = make_unique_slug(base_slug, seen_slugs)
            category = detect_category(name)
            brand = extract_brand(name)

            products.append({
                "id": product_id,
                "sku": sku or master_code,
                "master_code": master_code,
                "name": name,
                "brand": brand,
                "category": category,
                "price": 0,
                "priceFormatted": "RD$ 0",
                "disponible": True,
                "description": "",
                "features": [],
                "tags": [],
                "bestseller": False,
                "image": image_url or None,
                "images": [image_url] if image_url else [],
            })

    output_abs = os.path.abspath(OUTPUT_PATH)
    os.makedirs(os.path.dirname(output_abs), exist_ok=True)
    with open(output_abs, "w", encoding="utf-8") as f:
        json.dump(products, f, ensure_ascii=False, indent=2)

    # Summary
    from collections import Counter
    cats = Counter(p["category"] for p in products)
    with_img = sum(1 for p in products if p["image"])

    print(f"\n✅ {len(products)} productos guardados → {output_abs}")
    print(f"   Skipped: {skipped}")
    print(f"   Con imagen: {with_img}/{len(products)}")
    print(f"   Categorías: {dict(cats)}")

if __name__ == "__main__":
    main()
