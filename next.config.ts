import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  // Tree-shaking más agresivo de librerías con muchos exports (iconos, animación).
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "pedidosya.dhmedia.io" },
      { protocol: "https", hostname: "images.deliveryhero.io" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
    unoptimized: true,
  },
};

export default nextConfig;
