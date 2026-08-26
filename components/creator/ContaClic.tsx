"use client";

import { useEffect } from "react";

/**
 * Conta un clic sul link di un creator: quando si arriva con ?ref=CODICE.
 * Una volta per sessione dello stesso codice, così un ricaricamento non
 * gonfia il numero. Non blocca e non mostra niente: è solo un contatore.
 */
export default function ContaClic() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (!ref) return;
      const codice = ref.trim().toUpperCase();
      if (!/^[A-Z0-9]{3,20}$/.test(codice)) return;
      const chiave = `rivolio_clic_${codice}`;
      if (sessionStorage.getItem(chiave)) return;
      sessionStorage.setItem(chiave, "1");
      navigator.sendBeacon?.(`/api/ref/clic?ref=${encodeURIComponent(codice)}`);
    } catch {
      /* sessionStorage o sendBeacon non disponibili: pazienza. */
    }
  }, []);
  return null;
}
