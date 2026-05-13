import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
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
