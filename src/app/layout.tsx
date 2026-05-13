import type { Metadata } from "next";
import { DM_Serif_Display, DM_Sans } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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
    "Compra desechables, pods, liquids y accesorios para vape en Santiago, República Dominicana. Entrega rápida por PedidosYa. WAKA, Elf Bar, Geek Bar, IQOS y más.",
  keywords: [
    "vape dominicana", "vape santiago rd", "desechables vape", "elf bar rd",
    "waka vape", "geek bar", "iqos dominicana", "liquids vape rd", "pods vape",
    "vape 2 go", "vapes.do",
  ],
  openGraph: {
    type: "website",
    locale: "es_DO",
    siteName: "Vape 2 Go",
    title: "Vape 2 Go | Tu vape favorito en República Dominicana",
    description: "Los mejores desechables, pods y liquids. Entrega rápida en Santiago, RD.",
  },
  robots: { index: true, follow: true },
};

const localBusinessSchema = {
  "@context": "https://schema.org",
  "@type": "Store",
  name: "Vape 2 Go",
  description: "Tienda de vapes y e-cigarettes en Santiago, República Dominicana",
  url: "https://vapes.do",
  telephone: "+18094567890",
  address: {
    "@type": "PostalAddress",
    addressLocality: "Santiago de los Caballeros",
    addressRegion: "Santiago",
    addressCountry: "DO",
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
        <Navbar />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
