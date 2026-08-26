"use client";

import { useState, useTransition } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { impostaModoSicuroAdmin } from "@/app/admin/azioni";

/**
 * L'INTERRUTTORE D'EMERGENZA, nel pannello (audit 26/08).
 *
 * Un bottone solo. Acceso, ferma le email automatiche e la replica AI;
 * spento, tutto riparte. Check, verdetto, pagamento e apertura pratica non
 * si toccano mai: sta scritto sotto il bottone, così chi lo preme sa
 * esattamente cosa ferma e cosa no.
 *
 * Lo stato mostrato lo tiene questo componente (dalla risposta dell'azione),
 * non la cache del server: dopo un clic si vede subito il vero.
 */
export function ModoSicuro({ acceso }: { acceso: boolean }) {
  const [on, setOn] = useState(acceso);
  const [msg, setMsg] = useState<string | null>(null);
  const [inCorso, avvia] = useTransition();

  function cambia(nuovo: boolean) {
    setMsg(null);
    avvia(async () => {
      const esito = await impostaModoSicuroAdmin(nuovo);
      if (esito.ok) {
        setOn(nuovo);
        setMsg(esito.ok);
      } else {
        setMsg(esito.errore ?? "Non salvato: ricarica la pagina.");
      }
    });
  }

  return (
    <div
      className={`mb-6 rounded-[14px] border p-5 ${
        on ? "border-red-300 bg-red-50" : "border-bordo bg-white"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-display text-[1.15rem] tracking-[-0.02em] text-inchiostro">
            {on ? (
              <ShieldAlert className="size-5 text-red-600" aria-hidden="true" />
            ) : (
              <ShieldCheck className="size-5 text-verde" aria-hidden="true" />
            )}
            {on ? "Modo sicuro ACCESO" : "Modo sicuro"}
          </p>
          <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-fumo">
            {on
              ? "Le email automatiche e la replica scritta dall'AI sono in pausa. Il resto lavora: la gente controlla il volo, paga e apre la pratica come sempre."
              : "Il freno d'emergenza. Se qualcosa va storto lo accendi e in un colpo fermi le email automatiche e la replica AI, senza toccare cassa e verdetti. Da spento è tutto normale."}
          </p>
        </div>

        <button
          type="button"
          onClick={() => cambia(!on)}
          disabled={inCorso}
          className={`shrink-0 rounded-bottone px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${
            on
              ? "bg-verde text-white hover:bg-verde/90"
              : "border border-red-300 bg-white text-red-700 hover:bg-red-50"
          }`}
        >
          {inCorso ? "Un attimo…" : on ? "Spegni, riparti" : "Accendi il modo sicuro"}
        </button>
      </div>

      {msg && <p className="mt-3 text-[13px] leading-relaxed text-fumo">{msg}</p>}

      <p className="mt-3 text-[12px] leading-relaxed text-fumo-2">
        Vale entro pochi secondi, senza rifare il deploy. Ferma: i promemoria della pratica (il
        sollecito, l&apos;ente, «com&apos;è andata?»), il recupero via email, e la replica AI (che
        torna al testo fisso). Non ferma: check, verdetto, pagamento, apertura della pratica.
      </p>
    </div>
  );
}
