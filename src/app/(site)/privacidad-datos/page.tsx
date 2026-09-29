import type { Metadata } from "next";
import Link from "next/link";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Etiqueta de Privacidad",
  description: "Resumen claro y rápido de los datos que recolecta Vape 2 Go y para qué los usa.",
  alternates: { canonical: "https://vapes.do/privacidad-datos/" },
  robots: { index: true, follow: true },
};

const UPDATED = "22 de junio de 2026";

const ROWS: { data: string; uso: string; comparte: string }[] = [
  { data: "Nombre y correo", uso: "Crear y gestionar tu cuenta", comparte: "Supabase" },
  { data: "Teléfono", uso: "Coordinar entregas y soporte", comparte: "Supabase, PedidosYa" },
  { data: "Dirección de entrega", uso: "Entregar tus pedidos", comparte: "PedidosYa" },
  { data: "Historial de órdenes", uso: "Tu cuenta, lealtad y soporte", comparte: "Supabase" },
  { data: "Navegación (páginas, producto)", uso: "Medir conversión y mejorar la tienda", comparte: "PostHog" },
  { data: "Origen de visita (UTM/referido)", uso: "Atribuir cupones y campañas", comparte: "Supabase, PostHog" },
  { data: "IP aproximada / navegador", uso: "Seguridad y anti-fraude", comparte: "Cloudflare, Sentry" },
];

export default function PrivacyLabelPage() {
  return (
    <LegalPage title="Etiqueta de Privacidad" updated={UPDATED}>
      <p>
        Un resumen rápido y honesto de qué datos recolectamos y para qué. Para el detalle completo, lee la{" "}
        <Link href="/privacidad/" className="text-violet-600 underline hover:text-violet-700">Política de Privacidad</Link>.
      </p>

      <div className="grid sm:grid-cols-3 gap-3 not-prose">
        <Badge ok title="No vendemos tus datos" />
        <Badge ok title="No entrenamos IA con tus datos personales" />
        <Badge ok title="Cada usuario solo ve su propia info" />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-200 rounded-xl overflow-hidden">
          <thead>
            <tr className="bg-gray-50 text-left text-xs text-gray-500">
              <th className="py-3 px-4">Dato</th>
              <th className="py-3 px-4">Para qué</th>
              <th className="py-3 px-4">Con quién</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.data} className="border-t border-gray-100 text-gray-700">
                <td className="py-3 px-4 font-medium text-gray-900">{r.data}</td>
                <td className="py-3 px-4">{r.uso}</td>
                <td className="py-3 px-4 text-gray-500">{r.comparte}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p>
        <strong>IA:</strong> usamos Anthropic (Claude) solo para redactar descripciones de productos del catálogo —
        nunca con tus datos personales. Las decisiones que te afectan tienen revisión humana.
      </p>
      <p>
        <strong>Tus derechos:</strong> acceso, rectificación y eliminación escribiendo a{" "}
        <strong>privacidad@vapes.do</strong> (Ley 172-13, RD).
      </p>
    </LegalPage>
  );
}

function Badge({ title, ok }: { title: string; ok?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 text-sm font-medium ${ok ? "border-green-200 bg-green-50 text-green-800" : "border-gray-200 text-gray-700"}`}>
      ✓ {title}
    </div>
  );
}
