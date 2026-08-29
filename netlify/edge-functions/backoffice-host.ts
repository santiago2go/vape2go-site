// Routing por host: en admin.vape2go.do, la raíz abre directo el backoffice.
// El resto de rutas siguen sirviendo normal (así /backoffice/ordenes, /entrar, etc. funcionan).
export default async (request: Request) => {
  const url = new URL(request.url);
  if (url.hostname === "admin.vape2go.do" && (url.pathname === "/" || url.pathname === "")) {
    return Response.redirect(`${url.origin}/backoffice/`, 302);
  }
  // continuar con el manejo normal
  return undefined;
};

export const config = { path: "/" };
