#!/usr/bin/env python3
"""
Bulk product enrichment for vapes.do
Adds description, features[], tags[] to all products without them via Claude API.

Usage:
  python3 bulk_enrich.py --dry-run        # preview first 3 products, no writes
  python3 bulk_enrich.py --limit 5        # process 5 products, write locally only
  python3 bulk_enrich.py                  # full run: all 664 products + GitHub commit
  python3 bulk_enrich.py --no-commit      # full run but skip GitHub commit
"""

import asyncio
import json
import sys
import os
import re
import argparse
import time
import base64
import ssl
import urllib.request
import urllib.error
from typing import Optional

SSL_CTX = ssl._create_unverified_context()

CLAUDE_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
GITHUB_TOKEN   = os.environ.get("GITHUB_TOKEN", "")
GITHUB_REPO    = "santiago2go/vape2go-site"
GITHUB_PATH    = "src/data/products.json"

PRODUCTS_FILE   = os.path.join(os.path.dirname(__file__), "../src/data/products.json")
CHECKPOINT_FILE = "/tmp/v2g_enrich_checkpoint.json"

CONCURRENCY = 3  # parallel Claude calls (conservative to avoid 429)

SYSTEM_PROMPT = """Eres un redactor SEO especialista en vapeo y cigarrillos electrónicos en República Dominicana.
Generas contenido para Vape 2 Go, tienda de vapeo en Santiago de los Caballeros, RD. Venden desechables, pods, liquids y accesorios.
Solo para adultos mayores de 18 años.
Responde ÚNICAMENTE con JSON válido, sin texto adicional, sin bloques de código markdown."""

CATEGORY_LABELS = {
    "desechables": "desechables (vapes de un solo uso)",
    "pods": "pods y sistemas de vapeo recargables",
    "liquids": "e-liquids y sales de nicotina",
    "accesorios": "accesorios de vapeo (IQOS, Heets, Terea, etc.)",
}

def build_user_prompt(p: dict) -> str:
    cat_label = CATEGORY_LABELS.get(p.get("category", ""), p.get("category", ""))
    price_line = f"Precio: {p.get('priceFormatted', '')} DOP" if p.get("price", 0) > 0 else ""

    return f"""Genera contenido SEO para este producto de vapeo:

Nombre: {p['name']}
Marca: {p['brand']}
Categoría: {cat_label}
SKU: {p.get('sku', '')}
{price_line}

Devuelve exactamente este JSON (sin texto extra):
{{
  "description": "2-3 oraciones en español (120-180 caracteres por oración). Primera oración: nombre completo + marca + tipo de producto + beneficio principal. Segunda oración: sabores, puffs o característica técnica destacada si aplica. Tercera oración: disponible en Vape 2 Go, Santiago, RD, entrega rápida por PedidosYa. No incluir advertencias de salud ni mención a edad.",
  "features": [
    "Característica 1 — dato técnico concreto (sabor, puffs, nicotina, batería, etc.)",
    "Característica 2 — dato técnico o beneficio",
    "Característica 3 — dato técnico o beneficio",
    "Característica 4 — dato técnico o beneficio",
    "Característica 5 — dato técnico o beneficio"
  ],
  "tags": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5", "keyword6", "keyword7"]
}}"""


def call_claude_sync(prompt: str, retries: int = 4) -> Optional[dict]:
    """Synchronous Claude API call with retry and 429 backoff."""
    body = json.dumps({
        "model": "claude-haiku-4-5-20251001",
        "max_tokens": 1000,
        "system": SYSTEM_PROMPT,
        "messages": [{"role": "user", "content": prompt}]
    }).encode()

    for attempt in range(retries + 1):
        try:
            req = urllib.request.Request(
                "https://api.anthropic.com/v1/messages",
                data=body,
                headers={
                    "x-api-key": CLAUDE_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as r:
                resp = json.loads(r.read())
                text = resp["content"][0]["text"]
                m = re.search(r'\{[\s\S]+\}', text)
                if not m:
                    raise ValueError("No JSON in response")
                data = json.loads(m.group(0))
                if not data.get("description") or not data.get("features"):
                    raise ValueError("Incomplete JSON")
                return data
        except urllib.error.HTTPError as e:
            wait = 30 if e.code == 429 else (2 ** attempt)
            if attempt < retries:
                time.sleep(wait)
            else:
                return None
        except (urllib.error.URLError, json.JSONDecodeError, ValueError, KeyError):
            if attempt < retries:
                time.sleep(2 ** attempt)
            else:
                return None
    return None


async def enrich_product(semaphore: asyncio.Semaphore, p: dict) -> tuple[str, Optional[dict]]:
    slug = p["id"]
    async with semaphore:
        loop = asyncio.get_event_loop()
        prompt = build_user_prompt(p)
        result = await loop.run_in_executor(None, call_claude_sync, prompt)
        return slug, result


def load_checkpoint() -> set:
    try:
        with open(CHECKPOINT_FILE) as f:
            return set(json.load(f))
    except (FileNotFoundError, json.JSONDecodeError):
        return set()


def save_checkpoint(done: set):
    with open(CHECKPOINT_FILE, "w") as f:
        json.dump(list(done), f)


def commit_to_github(products: list) -> bool:
    """Commit updated products.json to GitHub."""
    repo = GITHUB_REPO
    path = GITHUB_PATH
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "Vape2Go-BulkEnrich",
    }

    # Get current SHA
    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/contents/{path}",
        headers=headers
    )
    try:
        with urllib.request.urlopen(req, timeout=30, context=SSL_CTX) as r:
            meta = json.loads(r.read())
            sha = meta["sha"]
    except Exception as e:
        print(f"  ERROR getting SHA: {e}")
        return False

    content_b64 = base64.b64encode(
        json.dumps(products, ensure_ascii=False, indent=2).encode()
    ).decode()

    body = json.dumps({
        "message": f"bulk-enrich: add descriptions, features and tags to {len(products)} products",
        "content": content_b64,
        "sha": sha,
    }).encode()

    req = urllib.request.Request(
        f"https://api.github.com/repos/{repo}/contents/{path}",
        data=body,
        headers=headers,
        method="PUT"
    )
    try:
        with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
            result = json.loads(r.read())
            print(f"  Commit: {result['commit']['sha'][:8]} → Netlify deploying...")
            return True
    except urllib.error.HTTPError as e:
        print(f"  ERROR committing: {e.code} {e.read().decode()[:200]}")
        return False


async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Preview first 3, no writes")
    parser.add_argument("--limit", type=int, default=0, help="Process only N products")
    parser.add_argument("--no-commit", action="store_true", help="Skip GitHub commit")
    parser.add_argument("--reset", action="store_true", help="Clear checkpoint and start fresh")
    args = parser.parse_args()

    products_path = os.path.abspath(PRODUCTS_FILE)
    with open(products_path) as f:
        products = json.load(f)

    to_enrich = [p for p in products if not p.get("description")]
    to_enrich.sort(key=lambda p: (0 if p.get("disponible") else 1, p["id"]))

    print(f"Total products: {len(products)}")
    print(f"Need enrichment: {len(to_enrich)}")
    print(f"  • disponible=true:  {sum(1 for p in to_enrich if p.get('disponible'))}")
    print(f"  • disponible=false: {sum(1 for p in to_enrich if not p.get('disponible'))}")

    if args.dry_run:
        print("\n--- DRY RUN: first 3 products ---")
        for p in to_enrich[:3]:
            print(f"\n[{p['id']}]\n  Nombre: {p['name']}\n  Marca: {p['brand']}\n  Cat: {p['category']}")
            result = call_claude_sync(build_user_prompt(p))
            if result:
                print(f"  description: {result['description'][:140]}...")
                print(f"  features ({len(result['features'])}): {result['features'][0]}")
                print(f"  tags: {result['tags']}")
            else:
                print("  ERROR: Claude returned None")
        return

    if args.reset and os.path.exists(CHECKPOINT_FILE):
        os.remove(CHECKPOINT_FILE)
        print("Checkpoint cleared.")

    done = load_checkpoint()
    pending = [p for p in to_enrich if p["id"] not in done]

    if args.limit:
        pending = pending[:args.limit]

    print(f"\nAlready done (checkpoint): {len(done)}")
    print(f"To process now: {len(pending)}")

    if not pending:
        print("Nothing to process. Use --reset to start over.")
        return

    products_by_id = {p["id"]: p for p in products}
    semaphore = asyncio.Semaphore(CONCURRENCY)
    tasks = [enrich_product(semaphore, p) for p in pending]

    success = 0
    failed = []
    start = time.time()

    print(f"\nStarting enrichment ({CONCURRENCY} concurrent)...\n")

    for i, coro in enumerate(asyncio.as_completed(tasks), 1):
        slug, result = await coro
        p = products_by_id[slug]

        elapsed = time.time() - start
        eta = (elapsed / i) * (len(pending) - i) if i > 1 else 0
        bar = "█" * (i * 20 // len(pending)) + "░" * (20 - i * 20 // len(pending))

        if result:
            products_by_id[slug]["description"] = result["description"]
            products_by_id[slug]["features"]    = result["features"]
            products_by_id[slug]["tags"]         = result["tags"]
            done.add(slug)
            success += 1
            status = "✓"
        else:
            failed.append(slug)
            status = "✗"

        print(f"[{bar}] {i:3d}/{len(pending)} {status} {p['name'][:40]:<40} ETA: {int(eta//60)}m{int(eta%60):02d}s")

        if i % 25 == 0:
            save_checkpoint(done)
            with open(products_path, "w") as f:
                json.dump(list(products_by_id.values()), f, ensure_ascii=False, indent=2)
            print(f"  → Checkpoint saved ({len(done)} done)")

    save_checkpoint(done)

    updated_products = list(products_by_id.values())
    with open(products_path, "w") as f:
        json.dump(updated_products, f, ensure_ascii=False, indent=2)

    total_time = time.time() - start
    print(f"\n{'='*60}")
    print(f"Done in {int(total_time//60)}m{int(total_time%60):02d}s")
    print(f"  ✓ Enriched: {success}")
    print(f"  ✗ Failed:   {len(failed)}")
    if failed:
        print(f"  Failed slugs: {', '.join(failed[:10])}")

    if args.limit:
        print(f"\n--limit mode: products.json written locally. Review quality, then run without --limit.")
        return

    if args.no_commit:
        print("\n--no-commit: skipping GitHub push.")
        return

    if failed and len(failed) > 50:
        print(f"\nWarning: {len(failed)} failures. Committing the {success} that succeeded.")

    print("\nCommitting to GitHub...")
    ok = commit_to_github(updated_products)
    if ok:
        print("✓ Netlify deploy triggered. Site updates in ~60s.")
    else:
        print("✗ Commit failed. products.json is updated locally — push manually.")


if __name__ == "__main__":
    asyncio.run(main())
