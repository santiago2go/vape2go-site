import type { Metadata } from "next";
import LegalPage, { H2 } from "@/components/LegalPage";

export const metadata: Metadata = {
  title: "Política de Privacidad",
  description: "Cómo Vape 2 Go recolecta, usa y protege tus datos personales, incluido el uso de inteligencia artificial.",
  alternates: { canonical: "https://vapes.do/privacidad/" },
  robots: { index: true, follow: true },
};

const UPDATED = "22 de junio de 2026";

export default function PrivacidadPage() {
  return (
    <LegalPage title="Política de Privacidad" updated={UPDATED}>
      <p>
        Vape 2 Go (&quot;nosotros&quot;) opera el sitio <strong>vapes.do</strong> en Santiago de los
        Caballeros, República Dominicana. Esta política explica qué datos personales recolectamos,
        con qué fin, cómo los protegemos y qué derechos tienes. Tratamos tus datos conforme a la
        <strong> Ley No. 172-13</strong> sobre Protección de Datos de Carácter Personal de la
        República Dominicana.
      </p>

      <H2>1. Qué datos recolectamos</H2>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Cuenta</strong>: nombre, correo electrónico, teléfono y contraseña (cifrada).</li>
        <li><strong>Órdenes</strong>: productos, dirección de entrega, referencia de pago y código de cupón.</li>
        <li><strong>Uso del sitio</strong>: páginas vistas, producto/categoría consultados, origen de la visita
          (UTM/referido) e identificador de sesión, para medir conversión y mejorar la tienda.</li>
        <li><strong>Técnicos</strong>: tipo de navegador y dirección IP aproximada (seguridad y anti-fraude).</li>
        <li><strong>Verificación de edad</strong>: confirmación de que eres mayor de 18 años.</li>
      </ul>

      <H2>2. Para qué usamos tus datos</H2>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>Procesar y entregar tus pedidos, y darte soporte.</li>
        <li>Administrar tu cuenta, puntos de lealtad y cupones.</li>
        <li>Medir el embudo de conversión y mejorar el catálogo y la experiencia.</li>
        <li>Prevenir fraude, abuso y accesos no autorizados.</li>
        <li>Enviarte ofertas y novedades <strong>solo si diste tu consentimiento</strong> (puedes retirarlo cuando quieras).</li>
      </ul>

      <H2>3. Uso de Inteligencia Artificial (IA)</H2>
      <p>
        Para que esta divulgación sea clara y específica: usamos sistemas de IA en los siguientes casos concretos.
      </p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li>
          <strong>Generación de descripciones de producto</strong>: empleamos modelos de lenguaje de
          <strong> Anthropic (Claude)</strong> para redactar descripciones, características y etiquetas de los
          productos del catálogo. Este proceso usa información pública del producto, <strong>no</strong> tus datos personales.
        </li>
        <li>
          <strong>Analítica de conversión</strong>: usamos modelos estadísticos/automatizados para entender
          patrones de navegación de forma agregada. No tomamos decisiones con efectos jurídicos sobre ti de forma
          únicamente automatizada; cualquier decisión relevante (p. ej. validación de una orden) tiene revisión humana.
        </li>
        <li>
          <strong>Lo que NO hacemos</strong>: no vendemos tus datos, no entrenamos modelos de IA con tu información
          personal identificable, y no hacemos perfilado para decisiones automatizadas que te afecten legalmente.
        </li>
      </ul>
      <p>
        Si en el futuro incorporamos un asistente de IA que procese tus datos personales (por ejemplo, un chatbot de
        soporte), te lo informaremos en el punto de recolección y actualizaremos esta sección.
      </p>
      <p>
        El usuario reconoce que las descripciones generadas por IA son de carácter informativo y promocional, por lo
        que Vape 2 Go no se hace responsable de discrepancias menores de redacción que no alteren las especificaciones
        técnicas reales del producto.
      </p>

      <H2>4. Con quién compartimos datos (encargados de tratamiento)</H2>
      <p>Trabajamos con proveedores que procesan datos por nuestra cuenta, bajo contrato y solo para los fines descritos:</p>
      <ul className="list-disc pl-5 space-y-1.5">
        <li><strong>Supabase</strong> — base de datos y autenticación.</li>
        <li><strong>Netlify</strong> — alojamiento del sitio.</li>
        <li><strong>PostHog</strong> — analítica de producto.</li>
        <li><strong>Sentry</strong> — monitoreo de errores.</li>
        <li><strong>Cloudflare</strong> — protección anti-bot (Turnstile).</li>
        <li><strong>Anthropic</strong> — generación de contenido de catálogo (sin datos personales).</li>
        <li><strong>PedidosYa</strong> — procesamiento y entrega de pedidos.</li>
      </ul>
      <p>Algunos proveedores procesan datos fuera de República Dominicana, con medidas de protección adecuadas.</p>
      <p>
        Al aceptar esta política, consientes expresamente la transferencia internacional de tus datos estrictamente
        necesarios a estos proveedores tecnológicos ubicados fuera de la República Dominicana, bajo estándares
        internacionales de seguridad de la información.
      </p>

      <H2>5. Conservación y seguridad</H2>
      <p>
        Conservamos tus datos mientras tengas cuenta activa y el tiempo que exija la ley fiscal/comercial. Protegemos
        la información con cifrado en tránsito (HTTPS), control de acceso a nivel de fila (cada usuario solo ve lo suyo),
        contraseñas cifradas y monitoreo de seguridad.
      </p>

      <H2>6. Tus derechos</H2>
      <p>
        Puedes acceder, rectificar, actualizar o eliminar tus datos, y oponerte a su uso para marketing (derechos ARCO).
        Escríbenos a <strong>privacidad@vapes.do</strong> y atenderemos tu solicitud conforme a la Ley 172-13 en un plazo
        no mayor a <strong>quince (15) días laborables</strong>. Puedes eliminar tu cuenta desde la sección Mi Cuenta o
        solicitándolo por ese correo.
      </p>

      <H2>7. Cookies y almacenamiento local</H2>
      <p>
        Usamos almacenamiento local del navegador para mantener tu sesión, recordar la verificación de edad y medir
        la conversión. No usamos cookies de publicidad de terceros.
      </p>

      <H2>8. Menores de edad</H2>
      <p>
        El sitio es exclusivo para mayores de 18 años. No recolectamos a sabiendas datos de menores. Si crees que un
        menor nos proporcionó datos, escríbenos y los eliminaremos.
      </p>

      <H2>9. Cambios</H2>
      <p>Podemos actualizar esta política; publicaremos la fecha de la última actualización al inicio.</p>

      <p className="text-xs text-gray-400 border-t border-gray-100 pt-6">
        Documento preparado para Vape 2 Go, con observaciones de revisión legal en República Dominicana (junio 2026).
      </p>
    </LegalPage>
  );
}
