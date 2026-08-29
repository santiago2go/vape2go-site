import type { Metadata } from "next";
import LegalPage, { H2 } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Términos de Servicio",
  description: "Términos y condiciones de uso de Vape 2 Go (vapes.do): edad mínima, pedidos, reclamos y jurisdicción aplicable en República Dominicana.",
  alternates: { canonical: "https://vapes.do/terminos/" },
  robots: { index: true, follow: true },
};

const UPDATED = "22 de junio de 2026";

export default function TerminosPage() {
  return (
    <LegalPage title="Términos de Servicio" updated={UPDATED}>
      <p>
        Al usar <strong>vapes.do</strong> aceptas estos Términos. Si no estás de acuerdo, no uses el sitio.
        Vape 2 Go opera en Santiago de los Caballeros, República Dominicana.
      </p>

      <H2>1. Edad mínima (18+)</H2>
      <p>
        Nuestros productos contienen nicotina y son exclusivos para mayores de 18 años. Al usar el sitio y crear una
        cuenta declaras y garantizas que tienes 18 años o más. Podemos solicitar verificación de edad y cancelar
        pedidos cuando no se cumpla.
      </p>
      <p>
        Al momento de la entrega a través de PedidosYa o cualquier otro transportista, el receptor deberá mostrar
        obligatoriamente un documento de identidad oficial físico (Cédula de Identidad o Pasaporte) que confirme su
        mayoría de edad. Si el receptor es menor de edad, el producto no será entregado, el pedido será cancelado y se
        cobrarán los gastos de envío por concepto de penalidad.
      </p>

      <H2>2. Salud y uso responsable</H2>
      <p>
        El consumo de nicotina es perjudicial para la salud y crea dependencia. No está recomendado para mujeres
        embarazadas o en lactancia, ni para personas con condiciones cardíacas o respiratorias. La información del
        sitio no es consejo médico.
      </p>

      <H2>3. Tu cuenta</H2>
      <p>
        Eres responsable de mantener la confidencialidad de tu contraseña y de la actividad de tu cuenta. Debes
        darnos información veraz. Podemos suspender cuentas con actividad fraudulenta o abusiva.
      </p>

      <H2>4. Pedidos, precios y cupones</H2>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Los precios están en pesos dominicanos (DOP) y pueden cambiar sin previo aviso.</li>
        <li>Confirmamos el pedido al validarse el pago y la disponibilidad; podemos rechazar o cancelar pedidos.</li>
        <li>Los cupones/códigos de afiliado tienen condiciones (un uso por cliente nuevo, topes de descuento, vigencia)
          y no son canjeables por efectivo.</li>
        <li>La entrega de última milla puede realizarse a través de terceros (p. ej. PedidosYa).</li>
      </ul>

      <H2>5. Propiedad intelectual</H2>
      <p>
        La marca, el diseño y el contenido del sitio son propiedad de Vape 2 Go o de sus licenciantes. No puedes
        copiarlos ni usarlos sin autorización.
      </p>

      <H2>6. Limitación de responsabilidad</H2>
      <p>
        El sitio se ofrece &quot;tal cual&quot;. En la máxima medida permitida por la ley, Vape 2 Go no será responsable
        por daños indirectos o incidentales derivados del uso del sitio o de los productos.
      </p>

      <H2>7. Resolución de conflictos, reclamos y jurisdicción aplicable</H2>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>
          <strong>Proceso de reclamo previo.</strong> Ante cualquier disconformidad con un producto o servicio, te
          comprometes a contactarnos prioritariamente a través de <strong>legal@vapes.do</strong>. Vape 2 Go dispondrá
          de un plazo de quince (15) días laborables para evaluar tu caso y proponer una solución amigable.
        </li>
        <li>
          <strong>Jurisdicción de consumo.</strong> Las partes reconocen la competencia administrativa de las
          autoridades de protección al consumidor de la República Dominicana (Pro Consumidor) para las controversias
          que califiquen bajo la <strong>Ley No. 358-05</strong>.
        </li>
        <li>
          <strong>Resolución alternativa opcional.</strong> Para disputas que no puedan ser resueltas por la vía
          directa y que excedan el ámbito de consumo ordinario, las partes podrán acordar someter la controversia a una
          mediación o arbitraje de derecho en el Centro de Resolución Alternativa de Controversias de la Cámara de
          Comercio y Producción de Santiago, de conformidad con la <strong>Ley No. 489-08</strong> sobre Arbitraje Comercial.
        </li>
        <li>
          <strong>Tribunales competentes.</strong> En caso de litigios judiciales, las partes eligen como domicilio
          legal y foro exclusivo los tribunales ordinarios de la ciudad de Santiago de los Caballeros, República Dominicana.
        </li>
      </ul>

      <H2>8. Ley aplicable</H2>
      <p>Estos Términos se rigen por las leyes de la República Dominicana.</p>

      <H2>9. Cambios</H2>
      <p>Podemos actualizar estos Términos; el uso continuado del sitio implica aceptación de la versión vigente.</p>

      <H2>10. Contacto</H2>
      <p>Dudas sobre estos Términos: <strong>legal@vapes.do</strong>.</p>

      <p className="text-xs text-gray-400 border-t border-gray-100 pt-6">
        Documento preparado para Vape 2 Go, con observaciones de revisión legal en República Dominicana (junio 2026).
      </p>
    </LegalPage>
  );
}
