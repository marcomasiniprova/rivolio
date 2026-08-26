import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { affiliatoDaCodice } from "./affiliati";

/**
 * IL LIBRO MASTRO: quanto matura un creator su un pagamento.
 *
 * Una riga per ogni pagamento attribuito a un codice. Il pannello somma il
 * non pagato per creator; Valerio salda con bonifico (niente Stripe Connect,
 * scelta del 22/08).
 *
 * ⚠️ IDEMPOTENTE. Il webhook di Stripe può recapitare lo stesso pagamento
 * più volte: il `riferimento` (id della sessione) è UNICO sul database,
 * quindi una consegna doppia non raddoppia la commissione. Non lancia mai:
 * una commissione persa è un problema da log, non un motivo per far fallire
 * la creazione della pratica (che vale molto di più).
 */
export async function registraCommissione(opts: {
  /** Il codice del creator, dai metadata della sessione Stripe. */
  codice: string;
  tipo: "check" | "pratica";
  /** Per le pratiche: singola o famiglia. Serve a separare i bonus a soglie. */
  variante?: "singola" | "famiglia";
  /** Quanto ha pagato il cliente, in euro (già scontato). */
  prezzoPagato: number;
  /** L'id della sessione Stripe: chiave di idempotenza. */
  riferimento: string;
}): Promise<void> {
  if (!SERVIZIO_ATTIVO || opts.prezzoPagato <= 0 || !opts.riferimento) return;

  const aff = await affiliatoDaCodice(opts.codice);
  if (!aff) return; // codice non valido o creator non più attivo: niente commissione

  const commissione = Math.round(opts.prezzoPagato * aff.commissione_percento) / 100;
  const riga: Record<string, unknown> = {
    affiliato_id: aff.id,
    tipo: opts.tipo,
    prezzo_pagato: opts.prezzoPagato,
    commissione,
    riferimento: opts.riferimento,
  };
  if (opts.variante) riga.variante = opts.variante;
  try {
    const db = supabaseServizio();
    let { error } = await db.from("commissioni").insert(riga);
    /* La colonna `variante` arriva con la migrazione del 26/08. Finché non è
       applicata, si salva la commissione SENZA: una commissione persa per un
       campo accessorio sarebbe peggio del campo mancante. */
    if (error && opts.variante && /variante/i.test(error.message)) {
      delete riga.variante;
      ({ error } = await db.from("commissioni").insert(riga));
    }
    // 23505 = riferimento già presente: è il webhook doppio, non un errore.
    if (error && error.code !== "23505") {
      console.error("[commissioni] insert fallito:", error.message);
    }
  } catch (e) {
    console.error("[commissioni] insert fallito:", e);
  }
}
