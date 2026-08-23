import type { NextRequest } from "next/server";
import {
  creaPratica,
  praticaPerVerifica,
  registraEvento,
  transizionePratica,
  type TipoPratica,
} from "./pratiche";
import { praticaPronta } from "@/lib/email/pratiche";
import { linkDiIngresso } from "./ingresso";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { registraDa } from "@/lib/eventi/registra";
import { tinGuasto, tinIncasso } from "@/lib/eventi/telegram";
import { registraCommissione } from "@/lib/affiliati/commissioni";

/**
 * DA UN PAGAMENTO A UNA PRATICA: la parte che conta, in un posto solo.
 *
 * Il webhook di Stripe la chiama dopo aver verificato la firma ed estratto
 * i dati dell'ordine. Qui succede tutto il resto:
 *
 *   cancello anti-giallo → creaPratica → stato `pagata` → email T+0 con
 *   link magico per entrare senza password.
 *
 * ⚠️ IL CANCELLO È LA PARTE CHE CONTA, e per questo vive qui e non nel
 * webhook: se la verifica non è `idoneo`, o una persona l'ha guardata e
 * dichiarata `corretta` (cioè: il verdetto era sbagliato), la pratica NON
 * si crea. Non si vende sul giallo, MAI (SPEC §4). Un pagamento arrivato su
 * un caso non vendibile è un guasto da guardare a mano, non da sanare in
 * automatico: serve un rimborso.
 *
 * Torna l'HTTP che il webhook deve rispondere: 200 a tutto ciò che non può
 * aggiustarsi da solo (se no Stripe riprova all'infinito), 500 solo quando
 * un nuovo tentativo può davvero riuscire (database giù per un attimo).
 */

export type DatiPagamento = {
  /** L'id della nostra verifica, dal metadata della sessione. */
  verificaId: string | null;
  /** L'email del cliente, da Stripe. */
  email: string | null;
  /** Quanto ha pagato, in euro. È la cifra che la garanzia rimborsa. */
  prezzo: number | null;
  tipo: TipoPratica;
  /** L'id dell'ordine dal venditore (sessione Stripe): va in cronologia. */
  ordineId: string | null;
  /** Il nome del venditore, per i testi e i log ("Stripe"). */
  venditore: string;
  /** Il codice del creator che ha portato la vendita, se c'è (dai metadata). */
  ref?: string | null;
};

export type EsitoEvasione = { http: number; body: Record<string, unknown> };

export async function evadiPagamentoPratica(
  req: NextRequest,
  dati: DatiPagamento,
): Promise<EsitoEvasione> {
  const { verificaId, email, prezzo, tipo, ordineId, venditore } = dati;
  const eti = `[${venditore.toLowerCase()}]`;

  if (!SERVIZIO_ATTIVO) {
    console.error(`${eti} pagamento ma SUPABASE_SECRET_KEY assente: riproverà.`);
    return { http: 500, body: { errore: "Server non configurato." } };
  }

  if (!verificaId || !email) {
    console.error(
      `${eti} ORDINE ${ordineId ?? "?"} PAGATO MA SENZA verifica_id O EMAIL: da guardare a mano.`,
    );
    /* Qualcuno ha pagato e non sappiamo per cosa: è il guasto più caro che
       esista, perché il cliente aspetta una pratica che non nascerà mai.
       Deve squillare il telefono, non finire in un log. */
    await tinGuasto(
      "ordine-orfano",
      `Ordine ${ordineId ?? "?"} PAGATO ma senza volo o email collegati.\nIl cliente aspetta e la pratica non esiste.`,
    );
    return { http: 200, body: { ok: true, gestito: false, motivo: "Dati mancanti, loggato." } };
  }

  // ---- il cancello: non si vende sul giallo, mai
  let verifica: {
    id: string;
    esito: string;
    conferma: string;
    volo_iata: string;
    data_locale: string;
    importo: number | null;
    rinuncia_recesso_il: string | null;
    rinuncia_recesso_testo: string | null;
  } | null = null;
  try {
    const db = supabaseServizio();
    const { data, error } = await db
      .from("verifiche")
      .select(
        "id, esito, conferma, volo_iata, data_locale, importo, rinuncia_recesso_il, rinuncia_recesso_testo",
      )
      .eq("id", verificaId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    verifica = data;
  } catch (e) {
    console.error(`${eti} verifica non leggibile, riproverà:`, e);
    return { http: 500, body: { errore: "Database non raggiungibile." } };
  }

  if (!verifica) {
    console.error(
      `${eti} ORDINE ${ordineId ?? "?"} PAGATO SU VERIFICA INESISTENTE ${verificaId}: da guardare a mano.`,
    );
    return { http: 200, body: { ok: true, gestito: false, motivo: "Verifica inesistente, loggato." } };
  }

  /* Si vende solo un idoneo che nessuno ha dichiarato sbagliato. Lo shadow
     mode in produzione è acceso da solo, quindi OGNI verdetto nasce "in
     attesa": bloccare su quello vorrebbe dire non incassare mai. A fermare
     la vendita resta il caso giusto: un verdetto guardato e corretto a mano
     (conferma === "corretta"). Su quello la pratica non si crea e serve un
     rimborso. */
  if (verifica.esito !== "idoneo" || verifica.conferma === "corretta") {
    console.error(
      `${eti} PAGAMENTO SU CASO NON VENDIBILE: ordine ${ordineId ?? "?"}, verifica ${verificaId}, esito "${verifica.esito}", conferma "${verifica.conferma}". Pratica NON creata: serve un rimborso a mano.`,
    );
    return {
      http: 200,
      body: { ok: true, gestito: false, motivo: "Caso non vendibile, pratica non creata, loggato." },
    };
  }

  // ---- idempotenza: lo stesso ordine può arrivare più volte
  const esistente = await praticaPerVerifica(verificaId);
  let pratica = esistente;
  if (esistente && esistente.stato !== "creata") {
    return { http: 200, body: { ok: true, pratica: esistente.id, nota: "Già gestito." } };
  }

  if (!pratica) {
    const creata = await creaPratica({ verificaId, email, tipo, passeggeri: [] });
    if (!creata.ok) {
      console.error(`${eti} pratica non creata, riproverà:`, creata.motivo);
      return { http: 500, body: { errore: "Pratica non creata." } };
    }
    pratica = creata.pratica;

    /* #21: la firma della rinuncia al recesso entra nella cronologia. Il
       checkout la esige, quindi se qui manca è un'anomalia: si logga forte
       e si segna, per l'admin. */
    if (verifica.rinuncia_recesso_il) {
      await registraEvento(
        pratica.id,
        "rinuncia_recesso",
        `Consenso all'esecuzione immediata e rinuncia al recesso registrati il ${verifica.rinuncia_recesso_il}. Testo accettato: ${verifica.rinuncia_recesso_testo ?? "non archiviato"}.`,
      );
    } else {
      console.error(
        `${eti} ordine ${ordineId ?? "?"} PAGATO SENZA rinuncia al recesso sulla verifica ${verificaId}: da guardare a mano.`,
      );
      await registraEvento(
        pratica.id,
        "rinuncia_recesso_mancante",
        "Pagamento arrivato senza la spunta di rinuncia al recesso: da verificare a mano.",
      );
    }
  }

  /* Il riferimento del pagamento (oggi la sessione Stripe) va in
     `ordine_pagamento`. La colonna si chiamava `polar_ordine` fino al 22/08:
     rinominata col passaggio a Stripe (Polar estinto). */
  const passaggio = await transizionePratica(
    pratica.id,
    "pagata",
    `Pagamento ricevuto via ${venditore}${ordineId ? ` (ordine ${ordineId})` : ""}.`,
    { prezzo_pagato: prezzo, ordine_pagamento: ordineId },
  );
  if (!passaggio.ok) {
    console.error(`${eti} transizione a pagata fallita, riproverà:`, passaggio.motivo);
    await tinGuasto(
      "pratica-non-pagata",
      `Pagamento arrivato ma la pratica non è passata a "pagata".\nOrdine ${ordineId ?? "?"}, verifica ${verificaId}.\nI soldi ci sono, la pratica no: da guardare adesso.`,
    );
    return { http: 500, body: { errore: "Transizione fallita." } };
  }

  /* ⚠️ IL TIN DEI SOLDI SI ASPETTA: qui non c'è nessun utente fermo davanti
     allo schermo (si risponde al venditore, non a una persona), quindi il
     mezzo secondo non lo paga nessuno e la notifica parte di sicuro. */
  await registraDa(req, {
    tipo: "pagato",
    volo: verifica.volo_iata,
    importo: prezzo,
    extra: { tipo, ordine: ordineId, venditore },
  });
  await tinIncasso(
    tipo === "famiglia" ? "Pratica famiglia" : "Pratica",
    prezzo ?? 0,
    `Volo ${verifica.volo_iata} del ${verifica.data_locale}`,
  );

  /* La commissione del creator, se la vendita è arrivata da un suo codice.
     Idempotente (riferimento unico): un webhook doppio non la raddoppia. Non
     blocca niente: una commissione persa è un problema da log, la pratica
     vale molto di più. */
  if (dati.ref) {
    await registraCommissione({
      codice: dati.ref,
      tipo: "pratica",
      prezzoPagato: prezzo ?? 0,
      riferimento: ordineId ?? pratica.id,
    });
  }

  /* ---- link magico: chi ha appena pagato entra senza password. Il rimbalzo
     passa da /auth/conferma (Supabase consegna la sessione nel frammento
     dell'indirizzo, e solo quella pagina lo sa leggere). */
  const link = await linkDiIngresso(email, `/pratica/${pratica.id}`);

  // ---- email T+0. Se non parte non si blocca niente: l'utente ha comunque
  // la pagina della pratica e il pagamento è registrato.
  const spedita = await praticaPronta(email, {
    volo: verifica.volo_iata,
    dataVolo: verifica.data_locale,
    importo: verifica.importo ?? pratica.importo_fascia,
    tipo,
    prezzo,
    garanziaFinoAl: pratica.garanzia_fino_al,
    link,
  });
  if (spedita.ok) {
    await registraEvento(pratica.id, "email_t0", "Email di benvenuto pratica (T+0) inviata.");
  } else {
    console.error(`${eti} email T+0 non partita per ${pratica.id}: ${spedita.motivo}`);
  }

  return { http: 200, body: { ok: true, pratica: pratica.id } };
}
