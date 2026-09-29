#!/usr/bin/env node
/**
 * Candado del permiso de marketing.
 *
 * Por qué existe: hasta el 28-sep-2026 el checkout de las dos webs mandaba
 * `marketingConsent: true` FIJO, sin casilla. O sea, todo el que compraba quedaba
 * marcado como que dio permiso de marketing. Eso contradice la propia política de
 * privacidad, no es el consentimiento «libre, expreso y consciente» del art. 5.4 de
 * la Ley 172-13, y es la causa #1 de cuentas cerradas de WhatsApp Business.
 *
 * Esta prueba se cae si vuelve a pasar. Mira DOS sitios a propósito:
 *   1. el código fuente  (src/app/(site)/checkout/page.tsx)
 *   2. el `out/` construido, que es lo que de verdad se publica
 * El bug se midió en los chunks publicados, no en el repo: revisar solo el fuente
 * es dejar las dos piezas gemelas sin mirarse.
 *
 * Uso:  node scripts/verificar-consentimiento.mjs          (fuente; out/ si existe)
 *       node scripts/verificar-consentimiento.mjs --exigir-build   (out/ obligatorio)
 *       CHECKOUT_SRC=... OUT_DIR=... node scripts/verificar-consentimiento.mjs
 *          (para sabotear la prueba contra una copia trucada)
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const RAIZ = resolve(process.env.PROJECT_ROOT ?? process.cwd());
const CHECKOUT = process.env.CHECKOUT_SRC ?? join(RAIZ, "src/app/(site)/checkout/page.tsx");
const OUT = process.env.OUT_DIR ?? join(RAIZ, "out");
const EXIGIR_BUILD = process.argv.includes("--exigir-build");
const TEXTO_CASILLA = "Quiero recibir ofertas y novedades";

const fallos = [];
const pasos = [];
const ok = (m) => pasos.push(`  ok  ${m}`);
const mal = (m) => { fallos.push(m); pasos.push(`  MAL ${m}`); };

// ── 1. Código fuente ──────────────────────────────────────────────────────────
if (!existsSync(CHECKOUT)) {
  mal(`no encuentro el checkout en ${CHECKOUT}`);
} else {
  // Le quito los comentarios ANTES de mirar: un comentario no puede aprobar un aserto
  // (ni un `// marketingConsent: true` viejo puede tumbarlo).
  const src = readFileSync(CHECKOUT, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:"'`\\])\/\/[^\n]*/g, "$1");

  // 1a. nada de literal fijo
  const fijo = src.match(/marketingConsent\s*:\s*(true|!0|1\b|"[^"]*"|Boolean\s*\(\s*(?:true|1)\s*\))/g);
  if (fijo) mal(`el checkout manda un valor FIJO: ${fijo.join(", ")}`);
  else ok("el checkout no manda marketingConsent con un literal fijo");

  // 1b. lo que manda tiene que ser una variable
  const usos = [...src.matchAll(/marketingConsent\s*:\s*([A-Za-z_$][\w$]*)/g)].map((m) => m[1]);
  if (usos.length === 0) {
    mal("el checkout ya no manda marketingConsent: ¿se movió el permiso a otra parte sin candado?");
  } else {
    ok(`marketingConsent sale de una variable (${[...new Set(usos)].join(", ")})`);

    // 1c. esa variable arranca DESMARCADA
    for (const v of new Set(usos)) {
      const decl = new RegExp(
        `const\\s*\\[\\s*${v}\\s*,\\s*[A-Za-z_$][\\w$]*\\s*\\]\\s*=\\s*useState(?:<[^>]*>)?\\(\\s*([^)]*?)\\s*\\)`
      ).exec(src);
      if (!decl) mal(`no encuentro el useState de "${v}": no puedo probar que arranque desmarcada`);
      else if (decl[1].trim() !== "false") mal(`"${v}" arranca en \`${decl[1].trim()}\`, tiene que arrancar en false (desmarcada)`);
      else ok(`"${v}" arranca en false → la casilla sale desmarcada`);

      // 1d. y está atada a un checkbox de verdad
      if (!new RegExp(`checked=\\{\\s*${v}\\s*\\}`).test(src)) mal(`"${v}" no está atada a ningún checkbox (checked={${v}})`);
      else ok(`hay un checkbox atado a "${v}"`);
    }
  }

  // 1e. la persona tiene que poder leer qué está aceptando
  if (!src.includes(TEXTO_CASILLA)) mal(`el checkout no muestra el texto «${TEXTO_CASILLA}…»: casilla sin etiqueta`);
  else ok("la casilla tiene su texto visible");

  // 1f. los términos tampoco van fijos
  if (/termsAccepted\s*:\s*(true|!0)/.test(src)) mal("termsAccepted va FIJO en true: manda lo que la persona marcó");
  else ok("termsAccepted no va fijo");
}

// ── 2. Lo que de verdad se publica ────────────────────────────────────────────
function js(dir, acc = []) {
  for (const n of readdirSync(dir)) {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) js(p, acc);
    else if (n.endsWith(".js") || n.endsWith(".txt") || n.endsWith(".html")) acc.push(p);
  }
  return acc;
}

if (!existsSync(OUT)) {
  if (EXIGIR_BUILD) mal(`no existe ${OUT}: la prueba del build NO CORRIÓ (corre \`npm run build\` primero)`);
  else pasos.push(`  --  ${OUT} no existe: la parte del build no corrió`);
} else {
  const archivos = js(OUT);
  if (archivos.length === 0) {
    mal(`${OUT} no tiene ni un .js: ¿build vacío?`);
  } else {
    // Al chunk del checkout lo reconozco por su título, que no está en ninguna otra
    // página. Así la casilla de /registro no puede aprobar el aserto del checkout.
    // Solo los .js: el index.html del checkout también dice «Finalizar compra» pero
    // el permiso vive en el JavaScript, no en el HTML prerenderizado.
    const delCheckout = archivos
      .filter((f) => f.endsWith(".js"))
      .filter((f) => readFileSync(f, "utf8").includes("Finalizar compra"));
    if (delCheckout.length === 0) {
      mal('en el build no hay ningún archivo con «Finalizar compra»: no encuentro el chunk del checkout, la prueba NO comprobó el build');
    } else {
      ok(`chunk(s) del checkout en el build: ${delCheckout.map((f) => f.slice(OUT.length + 1)).join(", ")}`);
      for (const f of delCheckout) {
        const rel = f.slice(OUT.length + 1);
        const c = readFileSync(f, "utf8");
        if (!c.includes("marketingConsent")) {
          mal(`${rel}: el chunk del checkout no menciona marketingConsent (¿se movió el permiso sin candado?)`);
          continue;
        }
        if (/marketingConsent\s*:\s*(!0|true)/.test(c)) mal(`${rel}: EL BUILD PUBLICADO manda marketingConsent FIJO`);
        else ok(`${rel}: no manda marketingConsent fijo`);
        if (!c.includes(TEXTO_CASILLA)) mal(`${rel}: el checkout publicado no trae la casilla «${TEXTO_CASILLA}…»`);
        else ok(`${rel}: trae la casilla con su texto`);
        if (/termsAccepted\s*:\s*(!0|true)/.test(c)) mal(`${rel}: termsAccepted va fijo en el build`);
      }
    }
    // Barrido de red: ningún otro archivo publicado puede tener el literal.
    const otros = archivos
      .filter((f) => !delCheckout.includes(f))
      .filter((f) => /marketingConsent\s*:\s*(!0|true)/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(OUT.length + 1));
    if (otros.length) mal(`otros archivos del build mandan marketingConsent fijo: ${otros.join(", ")}`);
    else ok("ningún otro archivo del build manda marketingConsent fijo");
  }
}

console.log(`\nPermiso de marketing — ${RAIZ}`);
console.log(pasos.join("\n"));
if (fallos.length) {
  console.error(`\n✗ ${fallos.length} fallo(s):`);
  for (const f of fallos) console.error(`   · ${f}`);
  process.exit(1);
}
console.log("\n✓ el permiso de marketing sale de la casilla, y arranca desmarcada.\n");
