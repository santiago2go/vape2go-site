"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";

/**
 * La barra de «envío gratis», arriba de todo y en todas las páginas de tienda.
 *
 * 🔑 Va acá y no solo en el checkout porque **la compra se decide antes**: en el checkout el
 * cliente ya venía convencido, así que enterarse ahí de que el envío es gratis no cambia
 * ninguna decisión — solo confirma una que ya tomó.
 *
 * 🔴 El texto NO está escrito a mano. Sale de `store_config.zones`, que es el mismo lugar del
 * que sale la tarifa que se le cobra en el checkout. Si mañana esas zonas vuelven a cobrar, la
 * barra desaparece sola. Una promesa escrita a mano en el HTML es una promesa que sobrevive al
 * día en que dejó de ser cierta — y ésta le llega al cliente.
 *
 * Si no hay ninguna zona en cero, no se pinta nada.
 */
interface Zona { name: string; fee: number | null; active?: boolean }

export default function EnvioGratisBar() {
  const [n, setN] = useState(0);

  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    let vivo = true;
    sb.from("store_config")
      .select("value")
      .eq("key", "zones")
      .maybeSingle()
      .then(({ data }) => {
        if (!vivo) return;
        const zonas = (data?.value as Zona[] | undefined) ?? [];
        setN(zonas.filter((z) => z.active !== false && Number(z.fee) === 0).length);
      });
    return () => { vivo = false; };
  }, []);

  // Sin zonas en cero no se pinta NADA — ni un borde. El contenedor fijo del layout
  // queda entonces con el navbar solo, que es como estaba antes de que existiera.
  if (n === 0) return null;

  return (
    <div className="w-full bg-green-600 text-white">
      <p className="mx-auto flex max-w-6xl items-center justify-center gap-2 px-4 py-1.5 text-center text-[12.5px] sm:py-2 font-medium leading-snug sm:text-sm">
        <span aria-hidden="true">🛵</span>
        <span>
          <strong className="font-bold uppercase tracking-wide">Envío gratis</strong>
          {" "}en {n} sectores del centro de Santiago
          <span className="hidden sm:inline"> — sin monto mínimo</span>
        </span>
      </p>
    </div>
  );
}
