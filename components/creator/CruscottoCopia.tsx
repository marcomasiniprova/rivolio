"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Copia il link del creator negli appunti, con la spunta di conferma. */
export default function CruscottoCopia({ testo }: { testo: string }) {
  const [fatto, setFatto] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(testo);
          setFatto(true);
          setTimeout(() => setFatto(false), 1800);
        } catch {
          /* Appunti negati: non è un guasto, si ignora. */
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-bottone bg-verde px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-verde-scuro"
    >
      {fatto ? (
        <>
          <Check className="size-4" aria-hidden="true" /> Copiato
        </>
      ) : (
        <>
          <Copy className="size-4" aria-hidden="true" /> Copia il link
        </>
      )}
    </button>
  );
}
