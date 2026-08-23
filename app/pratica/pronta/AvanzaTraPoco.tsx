"use client";

import { useEffect } from "react";

/**
 * L'attesa che si aggiorna da sola: appena montata, dopo una breve pausa
 * porta al prossimo giro, che ricontrolla se la pratica è pronta. Nessun
 * bottone da premere. È l'unica parte "client" della pagina di arrivo.
 */
export default function AvanzaTraPoco({
  prossimo,
  dopoMs = 1500,
}: {
  prossimo: string;
  dopoMs?: number;
}) {
  useEffect(() => {
    const id = setTimeout(() => window.location.assign(prossimo), dopoMs);
    return () => clearTimeout(id);
  }, [prossimo, dopoMs]);
  return null;
}
