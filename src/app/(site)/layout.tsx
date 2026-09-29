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
      {/* 🔑 EL CARTEL VIAJA CON EL NAVBAR, no debajo de él.
          Antes la barra iba suelta arriba y el `<Navbar>` traía su propio `sticky top-0`: al
          bajar, el navbar se clavaba y **la barra se iba con el scroll**, así que la promesa
          desaparecía justo mientras el cliente elige. Envolviendo a los dos en UN solo contenedor
          fijo, el bloque entero se clava y el cartel se ve siempre.
          El `sticky` de adentro no estorba: su caja ya está clavada, así que no tiene por dónde
          moverse. Y si `EnvioGratisBar` no pinta nada —ninguna zona en cero— este contenedor
          queda con el navbar solo, exactamente como estaba antes. */}
      <div className="sticky top-0 z-50">
        <EnvioGratisBar />
        <Navbar />
      </div>
      <main>{children}</main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
