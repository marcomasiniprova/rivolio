"use client";

import { useActionState } from "react";
import { Loader2, Send } from "lucide-react";
import { giroFollowUp, type EsitoAdmin } from "@/app/admin/azioni";
import { Button } from "@/components/ui/button";

const VUOTO: EsitoAdmin = {};

/**
 * Il bottone che fa girare i follow-up a mano, con l'esito sotto.
 *
 * Sta nella sezione Pratiche e non sulla Panoramica: manda le email
 * dovute alle pratiche aperte, quindi è un comando di quella sezione. Su
 * una schermata di riepilogo un bottone che SPEDISCE roba è fuori posto,
 * e prima o poi qualcuno lo preme per sbaglio credendo di aggiornare.
 */
export default function Comandi() {
  const [r, azione, giro] = useActionState(async () => giroFollowUp(), VUOTO);

  return (
    <form
      action={azione}
      className="flex flex-col gap-3 rounded-[14px] border border-bordo bg-white p-4 shadow-[0_1px_2px_rgba(5,46,31,0.04)] sm:p-5"
    >
      <div>
        <h2 className="font-display text-[15.5px] leading-tight tracking-[-0.02em]">
          Giro di follow-up
        </h2>
        {/* Spiegato in parole per Valerio (28/08): niente più "T+42". I
            giorni veri stanno in lib/pratiche/rifiuto.ts e in
            app/api/motore/segui, non qui: questo è solo il testo. */}
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-fumo">
          Ogni mattina, da solo, un orologio guarda le pratiche aperte e manda a ognuna
          l&apos;email giusta per il punto in cui è: due giorni dopo il pagamento un
          promemoria per inviare la lettera; poi, dall&apos;invio, il sollecito (dopo sei
          settimane di silenzio della compagnia), la segnalazione all&apos;ente e la domanda
          «com&apos;è andata». Mai due volte la stessa. <strong>Questo bottone fa lo stesso
          giro adesso, a mano</strong>: serve a te per provarlo. Con nessuna pratica aperta
          non manda niente e te lo dice qui sotto.
        </p>
      </div>
      <Button type="submit" disabled={giro} size="sm" className="self-start">
        {giro ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Send className="size-4" aria-hidden="true" />
        )}
        Fai un giro adesso
      </Button>
      {r.ok && <p className="text-[13px] font-medium text-verde">{r.ok}</p>}
      {r.dettaglio && (
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-[10px] bg-nebbia px-3 py-2 text-[12px] leading-relaxed text-fumo">
          {r.dettaglio}
        </pre>
      )}
      {r.errore && <p className="text-[13px] text-red-600">{r.errore}</p>}
    </form>
  );
}
