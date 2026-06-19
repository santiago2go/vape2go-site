#!/usr/bin/env python3
"""
Corrige el campo `brand` de products.json usando:
  1) brand_master_map.json  (sku -> marca, autoritativo, del sheet "Vape 2 Go Master")
  2) VOCAB por nombre        (match word-boundary sobre marcas reales)
  3) brands ya limpios       (se respetan si no hay mejor señal)

NO toca description/features/tags/image/price. Es idempotente y seguro de re-correr.
Uso:
  python3 scripts/fix_brands.py --dry-run   # muestra cambios sin escribir
  python3 scripts/fix_brands.py             # aplica y reescribe products.json
"""
import json, os, re, sys, collections

HERE = os.path.dirname(__file__)
PRODUCTS = os.path.join(HERE, "../src/data/products.json")
MASTER = os.path.join(HERE, "brand_master_map.json")

# marca -> variantes a buscar en el nombre (se comparan con \b...\b en minúsculas)
VOCAB = [
    ("WAKA", ["waka"]),
    ("HQD", ["hqd"]),
    ("Geek Bar", ["geek bar", "geekbar", "geek pulse"]),
    ("SWFT", ["swft"]),
    ("Veev", ["veev"]),
    ("Vladdin", ["vladdin"]),
    ("Magi", ["magi"]),
    ("IQOS", ["iqos"]),
    ("Heets", ["heets"]),
    ("Terea", ["terea"]),
    ("Lost Mary", ["lost mary"]),
    ("Relx", ["relx"]),
    ("Juul", ["juul"]),
    ("RAZ", ["raz"]),
    ("Vizzel", ["vizzel"]),
    ("ZYN", ["zyn"]),
    ("Rinnbar", ["rinnbar"]),
    ("Marlboro", ["marlboro"]),
]
_COMPILED = [(b, [re.compile(r"\b" + re.escape(v) + r"\b") for v in vs]) for b, vs in VOCAB]
# brands del JSON original que ya son marca real (se conservan si nada mejor aplica)
CLEAN_KEEP = {"IQOS", "Heets", "Terea", "Lost Mary", "Relx", "Juul", "WAKA",
              "Geek Bar", "HQD", "Vladdin", "Magi", "SWFT", "Veev"}


def name_brand(name: str):
    low = name.lower()
    for brand, rxs in _COMPILED:
        if any(rx.search(low) for rx in rxs):
            return brand
    return None


def resolve(p, master):
    sku = p.get("sku", "")
    if sku in master and master[sku]:
        return master[sku]
    nb = name_brand(p.get("name", ""))
    if nb:
        return nb
    if p.get("brand") in CLEAN_KEEP:
        return p["brand"]
    return p.get("brand")  # sin señal: deja lo que había


def main():
    dry = "--dry-run" in sys.argv
    products = json.load(open(PRODUCTS, encoding="utf-8"))
    master = json.load(open(MASTER, encoding="utf-8")) if os.path.exists(MASTER) else {}

    changes = []
    for p in products:
        old = p.get("brand")
        new = resolve(p, master)
        if new and new != old:
            changes.append((p["id"], old, new))
            if not dry:
                p["brand"] = new

    by_brand = collections.Counter(p.get("brand") for p in products)
    print(f"Productos: {len(products)} | cambios de brand: {len(changes)}")
    print("Muestra de cambios:")
    for cid, old, new in changes[:20]:
        print(f"  {old!r:18} -> {new!r:12}  {cid}")
    print("\nDistribución final por marca (top 20):")
    for b, n in by_brand.most_common(20):
        print(f"  {b:14} {n}")

    if dry:
        print("\n[dry-run] no se escribió nada.")
    else:
        json.dump(products, open(PRODUCTS, "w", encoding="utf-8"),
                  ensure_ascii=False, indent=2)
        print(f"\n✅ Escrito {PRODUCTS}")


if __name__ == "__main__":
    main()
