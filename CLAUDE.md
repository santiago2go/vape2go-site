# vape2go-site — reglas para Claude

Estado del negocio: `../../ESTADO.md` (léelo primero). Referencia de este sitio: `../../contexto/vapes-do.md`.

- 🔴 Nunca push a `main`: Netlify publica `main` con auto-publish y `main` va atrás. Un push revierte producción (FLIP, backoffice y POS).
- Deploy: `npm run build` + `npx netlify-cli deploy --prod --dir out --site 54f87002-c099-41cd-863e-818f7f60f200`. Verifica en https://vapes.do, no en `out/`.
- `--no-build` sube el `out/` local: `.env.local` necesita todas las `NEXT_PUBLIC_*` o se cae el FLIP.
- Repo de la cuenta `santiago2go`: `gh auth switch --user santiago2go`.
- Secretos solo en `.env.local` y Netlify; nunca en el repo ni impresos.
- Docs viejos del repo: `_historial/`.
