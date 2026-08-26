"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

/**
 * L'ULTIMA RETE, quella che prende anche gli errori del layout radice.
 *
 * `global-error.tsx` sostituisce l'intera pagina, quindi deve portarsi
 * <html> e <body> da sé e NON può contare sul foglio di stile del sito: per
 * questo qui gli stili sono scritti a mano, in linea. Serve al caso raro in
 * cui a rompersi è il guscio stesso; nel caso normale interviene error.tsx.
 * Aggiunto dall'audit del 14/08: senza, un errore nel layout era una pagina
 * bianca in inglese.
 */
export default function ErroreGlobale({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[globale] la pagina si è rotta:", error);
    /* L'ultima rete prende anche gli errori del layout radice: qui li mandiamo
       a Sentry (audit 26/08), che altrimenti il global-error non li vede. */
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="it">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#f4f6f3",
          color: "#0e1a13",
        }}
      >
        <div style={{ maxWidth: 440, textAlign: "center" }}>
          <p style={{ fontSize: 22, fontWeight: 600, margin: "0 0 10px" }}>Qualcosa si è inceppato.</p>
          <p style={{ fontSize: 15, lineHeight: 1.6, color: "#4b5a53", margin: "0 0 22px" }}>
            Non è colpa tua. Riprova fra un momento: di solito basta.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#067a46",
              color: "#fff",
              border: 0,
              borderRadius: 12,
              padding: "11px 24px",
              fontSize: 15,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Riprova
          </button>
        </div>
      </body>
    </html>
  );
}
