# Habilitar "Continuar con Google" — Vape 2 Go

El botón ya está puesto en `/entrar` y `/registro`. Solo funciona cuando habilites
el proveedor Google en Supabase. Pasos (10-15 min, una sola vez):

## 1. Google Cloud Console
1. Entra a https://console.cloud.google.com → crea un proyecto ("Vape 2 Go").
2. **APIs & Services → OAuth consent screen**:
   - User type: **External** → Create.
   - App name: *Vape 2 Go*. Support email: el tuyo.
   - Authorized domains: `vapes.do` y `supabase.co`.
   - Scopes: deja los básicos (email, profile). Guarda.
   - Publishing status: pásalo a **In production** (si lo dejas en "Testing",
     solo entran correos que agregues como testers).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: `https://vapes.do` y `http://localhost:3000`.
   - **Authorized redirect URIs**: pega la URL del paso 2 de Supabase (abajo):
     `https://<TU-PROYECTO>.supabase.co/auth/v1/callback`
   - Create → copia el **Client ID** y **Client Secret**.

## 2. Supabase
1. Dashboard → **Authentication → Providers → Google** → Enable.
2. Pega **Client ID** y **Client Secret**. Guarda.
3. Justo ahí Supabase muestra el **Callback URL** — es el que va en "Authorized
   redirect URIs" de Google (paso 1.3). Si lo copiaste antes, verifica que coincida.
4. **Authentication → URL Configuration**: Site URL `https://vapes.do`, y agrega
   `https://vapes.do/cuenta/` y `http://localhost:3000/cuenta/` a Redirect URLs.

## 3. Listo
No hay que tocar código ni variables de entorno: el botón usa
`supabase.auth.signInWithOAuth({ provider: 'google' })` y vuelve a `/cuenta/`.
El perfil se crea solo (trigger `handle_new_user`) con el nombre y correo de Google.

> Nota: el AgeGate 18+ sigue aplicando (es del sitio, antes del login). Para el
> registro con Google no pedimos teléfono; el usuario puede completarlo luego en
> Mi Cuenta.
