import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // rutas privadas / de cuenta: no indexar
      disallow: ["/admin/", "/cuenta/", "/entrar/", "/registro/"],
    },
    sitemap: "https://vapes.do/sitemap.xml",
  };
}
