import Navbar from "@/components/Navbar";
import EnvioGratisBar from "@/components/EnvioGratisBar";
import Footer from "@/components/Footer";
import AgeGate from "@/components/AgeGate";
import { WhatsAppFloat } from "@/components/WhatsAppFloat";

/**
 * Chrome de la TIENDA. Vive en el route group (site) para que solo las páginas
 * de tienda hereden AgeGate + Navbar + Footer. El backoffice (route group
 * (admin)) trae su propio shell y NO pasa por aquí. Los route groups no cambian
 * la URL, así que todas las rutas de tienda se mantienen igual.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AgeGate />
      <EnvioGratisBar />
      <Navbar />
      <main>{children}</main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
