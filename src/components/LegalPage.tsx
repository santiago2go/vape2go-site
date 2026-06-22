import Link from "next/link";

/** Contenedor tipográfico para las páginas legales. */
export default function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12 sm:py-16">
      <nav className="text-sm text-gray-400 flex items-center gap-2 mb-8">
        <Link href="/" className="hover:text-gray-700 transition-colors">Inicio</Link>
        <span>/</span>
        <span className="text-gray-700">{title}</span>
      </nav>
      <h1 className="text-3xl sm:text-4xl text-gray-900 mb-2" style={{ fontFamily: "var(--font-heading)" }}>
        {title}
      </h1>
      <p className="text-xs text-gray-400 mb-10">Última actualización: {updated}</p>
      <div className="legal-prose space-y-6 text-[15px] leading-relaxed text-gray-700">
        {children}
      </div>
    </div>
  );
}

export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xl text-gray-900 pt-4" style={{ fontFamily: "var(--font-heading)" }}>
      {children}
    </h2>
  );
}
