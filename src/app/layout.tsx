import type { Metadata } from "next";
import { DM_Serif_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AgeGate from "@/components/AgeGate";
import Providers from "@/components/Providers";

const dmSerifDisplay = DM_Serif_Display({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-heading",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://vapes.do"),
  title: {
    default: "Vape 2 Go | Tu vape favorito en República Dominicana",
    template: "%s | Vape 2 Go",
  },
  description:
    "Compra desechables, pods, liquids y accesorios para vape en Santiago, República Dominicana. Entrega rápida por PedidosYa. WAKA, Geek Bar, HQD, Veev, IQOS y más.",
  keywords: [
    "vape dominicana", "vape santiago rd", "desechables vape", "hqd rd",
    "waka vape", "geek bar", "iqos dominicana", "liquids vape rd", "pods vape",
    "vape 2 go", "vapes.do",
  ],
  openGraph: {
    type: "website",
    locale: "es_DO",
    siteName: "Vape 2 Go",
    title: "Vape 2 Go | Tu vape favorito en República Dominicana",
    description: "Los mejores desechables, pods y liquids. Entrega rápida en Santiago, RD.",
    // TODO: reemplazar por un OG image propio de 1200×630 px (hoy usa el logo)
    images: [{ url: "/logo.jpeg", width: 512, height: 512, alt: "Vape 2 Go" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Vape 2 Go | Tu vape favorito en República Dominicana",
    description: "Desechables, pods y liquids con entrega rápida en Santiago, RD.",
    images: ["/logo.jpeg"],
  },
  robots: { index: true, follow: true },
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "Store",
  name: "Vape 2 Go",
  description: "Tienda de vapes y e-cigarettes en Santiago, República Dominicana",
  url: "https://vapes.do",
  // TODO: reemplazar por teléfono real público antes de promocionar (hoy placeholder)
  telephone: "+18094567890",
  priceRange: "$$",
  currenciesAccepted: "DOP",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Santiago de los Caballeros",
    addressRegion: "Santiago",
    addressCountry: "DO",
  },
  // TODO: ajustar a las coordenadas reales de la base de Vape 2 Go (hoy centro de Santiago)
  geo: {
    "@type": "GeoCoordinates",
    latitude: 19.4517,
    longitude: -70.697,
  },
  areaServed: {
    "@type": "City",
    name: "Santiago de los Caballeros",
  },
  sameAs: ["https://instagram.com/vape2go.rd"],
  openingHoursSpecification: [
    {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"],
      opens: "09:00",
      closes: "22:00",
    },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${dmSerifDisplay.variable} ${dmSans.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
        />
      </head>
      <body>
        <Providers>
          <AgeGate />
          <Navbar />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
