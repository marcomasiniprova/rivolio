import { NextResponse, type NextRequest } from "next/server";
import { chiamataAutorizzata } from "@/lib/motore/autorizza";
import { modoSicuroAttivo } from "@/lib/motore/modo-sicuro";
import { SERVIZIO_ATTIVO } from "@/lib/supabase/servizio";
import {
  eventiRegistrati,
  praticheDaSeguire,
  registraEvento,
  transizionePratica,
  type PraticaConVolo,
} from "@/lib/pratiche/pratiche";
import {
  comeVa,
  praticaPronta,
  promemoriaInvio,
  promemoriaReplica,
  reclamoEnac,
  sollecitoPronto,
} from "@/lib/email/pratiche";
import { casa } from "@/lib/email/posta";
import { linkDiIngresso } from "@/lib/pratiche/ingresso";
import {
  GIORNI_PRIMA_DELL_ENTE,
  GIORNI_PRIMA_DELL_ESITO,
  GIORNI_PRIMA_DEL_SOLLECITO,
} from "@/lib/pratiche/rifiuto";
import {
  deveRecuperareReplica,
  EVENTO_RECUPERO_REPLICA,
  RECUPERO_ATTIVO,
  statoRepliche,
  type StatoReplica,
} from "@/lib/pratiche/recupero-replica";

/**
 * Il cron dei follow-up (SPEC §6): una volta al giorno scorre le pratiche
 * aperte e manda l'email giusta per il punto in cui sono.
 *
 *   T+0  recupero del benvenuto, se non è mai partito (audit 14/08)
 *   T+2  dal pagamento, se mai segnata come inviata → promemoria
 *   T+42 dall'invio → sollecito pronto (+ stato `sollecito`)
 *   T+56 dall'invio → segnalazione all'ente nazionale (+ stato `enac`)
 *   T+90 dall'invio → com'è andata + garanzia
 *
 * ⚠️ IL BENVENUTO (T+0) HA LA PRECEDENZA. Lo manda il webhook di Stripe
 * appena si paga; ma se in quel momento Resend è giù o il webhook viene
 * ucciso a metà dai 10 secondi di Netlify, la pratica resta pagata SENZA
 * il link magico per entrare. Senza quel link la persona non trova la
 * pratica che ha comprato: è il buco peggiore. Qui il cron lo rimedia
 * prima di ogni follow-up (`recuperaBenvenuto`).
 *
 * ⚠️ PERCHÉ 42 E NON 15, come era prima. Le compagnie rispondono in
 * 8-14 settimane: un sollecito mandato al giorno 15 arriva quando
 * nessuno ha ancora aperto la pratica, e serve solo a farci sembrare
 * automatici. Sei settimane è anche il termine che l'ENAC stesso indica
 * prima di poter presentare reclamo all'ente. I due numeri vivono in
 * `lib/pratiche/rifiuto.ts` e sono uno solo, non due copie.
 *
 * ⚠️ IL RIFIUTO SCAVALCA IL CALENDARIO. Se il cliente dichiara che la
 * compagnia ha risposto no, il sollecito è disponibile subito: la
 * risposta c'è già, aspettare altre cinque settimane sarebbe assurdo.
 * Quel salto lo fa `/api/pratiche/rifiuto`, non questo cron.
 *
 * OGNI invio lascia un evento (`email_t2`, `email_sollecito`...): prima di
 * mandare si controlla che l'evento non esista già, così nessuna email
 * parte due volte. Se l'invio fallisce l'evento NON si scrive, e il giro
 * successivo riprova da solo.
 *
 * Al massimo UN'email per pratica per giro, la più avanzata dovuta: le
 * tappe precedenti non si recuperano (un sollecito del giorno 15 mandato
 * al giorno 40 è solo rumore).
 *
 * Budget 8 secondi come gli altri giri: le funzioni Netlify muoiono a 10.
 */
export const dynamic = "force-dynamic";

const GIORNO_MS = 86_400_000;

type Passo = "email_t2" | "email_sollecito" | "email_ente" | "email_esito";

const NOTE: Record<Passo, string> = {
  email_t2: "Promemoria d'invio (T+2) mandato.",
  email_sollecito: "Sollecito pronto (T+42) mandato.",
  email_ente: "Segnalazione all'ente nazionale (T+56) mandata.",
  email_esito: "Richiesta d'esito e promemoria garanzia (T+90) mandati.",
};

/* I nomi vecchi delle stesse tappe. Servono a non rimandare un'email a
   chi l'ha già ricevuta col nome di prima: una pratica non deve
   accorgersi che abbiamo cambiato i tempi. */
const NOMI_VECCHI: Record<Passo, string | null> = {
  email_t2: null,
  email_sollecito: "email_t15",
  email_ente: "email_t30",
  email_esito: "email_t60",
};

function giorniDa(iso: string | null): number {
  if (!iso) return 0;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? (Date.now() - t) / GIORNO_MS : 0;
}

/** Il passo dovuto adesso per questa pratica, o niente. */
function passoDovuto(pr: PraticaConVolo, fatti: Set<string>): Passo | null {
  const fatto = (t: Passo) => {
    if (fatti.has(`${pr.id}:${t}`)) return true;
    const vecchio = NOMI_VECCHI[t];
    return vecchio ? fatti.has(`${pr.id}:${vecchio}`) : false;
  };

  // Mai inviata: esiste solo il promemoria del giorno 2.
  if (!pr.inviata_il) {
    if (
      (pr.stato === "pagata" || pr.stato === "pronta") &&
      giorniDa(pr.creata_il) >= 2 &&
      !fatto("email_t2")
    ) {
      return "email_t2";
    }
    return null;
  }

  // Inviata: si guarda dal traguardo più lontano. Se una tappa più avanti
  // è già stata mandata, quelle prima sono superate e non si mandano più.
  const g = giorniDa(pr.inviata_il);
  if (g >= GIORNI_PRIMA_DELL_ESITO) return fatto("email_esito") ? null : "email_esito";
  if (g >= GIORNI_PRIMA_DEL_SOLLECITO + GIORNI_PRIMA_DELL_ENTE) {
    return fatto("email_ente") ? null : "email_ente";
  }
  if (g >= GIORNI_PRIMA_DEL_SOLLECITO) {
    return fatto("email_sollecito") ? null : "email_sollecito";
  }
  return null;
}

/** Manda l'email del passo. Vero solo se è partita davvero. */
async function mandaPasso(pr: PraticaConVolo, passo: Passo): Promise<boolean> {
  const link = `${casa()}/pratica/${pr.id}`;
  const volo = pr.voli?.volo_iata ?? "";
  const dataVolo = pr.voli?.data_locale ?? null;

  let esito: { ok: boolean };
  if (passo === "email_t2") {
    esito = await promemoriaInvio(pr.email, { importo: pr.importo_fascia, link });
  } else if (passo === "email_sollecito") {
    esito = await sollecitoPronto(pr.email, {
      volo,
      dataVolo,
      compagnia: pr.voli?.vettore_operativo ?? null,
      partenzaIata: pr.voli?.partenza_iata ?? null,
      dataInvio: pr.inviata_il ?? pr.creata_il,
      importo: pr.importo_fascia,
      link,
    });
  } else if (passo === "email_ente") {
    esito = await reclamoEnac(pr.email, {
      volo,
      dataVolo,
      link,
      partenzaIata: pr.voli?.partenza_iata ?? null,
    });
  } else {
    esito = await comeVa(pr.email, { garanziaFinoAl: pr.garanzia_fino_al, link });
  }

  if (!esito.ok) return false;

  await registraEvento(pr.id, passo, NOTE[passo]);

  // Le tappe che spostano anche lo stato della macchina.
  if (passo === "email_sollecito" && pr.stato === "inviata") {
    await transizionePratica(pr.id, "sollecito", "Sollecito in mano all'utente (sei settimane di silenzio).");
  }
  if (passo === "email_ente" && (pr.stato === "inviata" || pr.stato === "sollecito")) {
    await transizionePratica(pr.id, "enac", "Segnalazione all'ente nazionale in mano all'utente.");
  }
  return true;
}

/**
 * 🔴 RECUPERO DEL BENVENUTO (T+0), audit 14/08.
 *
 * Il webhook di Stripe manda il benvenuto (`praticaPronta`) e scrive
 * l'evento `email_t0` SOLO se è partito. Se in quel momento Resend è giù
 * o il webhook viene ucciso a metà, la pratica resta pagata senza il
 * link magico per entrare. Qui il cron lo rimanda: ogni pratica pagata a
 * cui manca `email_t0` si rimedia il benvenuto.
 *
 * L'evento si scrive solo se l'email parte, quindi il giro dopo riprova
 * da solo finché non riesce. Un raro doppione (email partita ma evento
 * non scritto per un attimo) è molto meglio di un cliente pagante senza
 * il suo link: sbaglia dalla parte giusta.
 */
async function recuperaBenvenuto(pr: PraticaConVolo, fatti: Set<string>): Promise<boolean> {
  if (fatti.has(`${pr.id}:email_t0`)) return false;

  const link = await linkDiIngresso(pr.email, `/pratica/${pr.id}`);
  const spedita = await praticaPronta(pr.email, {
    volo: pr.voli?.volo_iata ?? "",
    dataVolo: pr.voli?.data_locale ?? null,
    importo: pr.importo_fascia,
    tipo: pr.tipo,
    prezzo: pr.prezzo_pagato,
    garanziaFinoAl: pr.garanzia_fino_al,
    link,
  });
  if (!spedita.ok) return false;

  await registraEvento(pr.id, "email_t0", "Email di benvenuto pratica (T+0) recuperata dal cron.");
  return true;
}

/**
 * IL "NO NON REPLICATO" (TIENITELI, scelta di Valerio 19/08).
 *
 * Chi ha registrato il no della compagnia e non ha ancora mandato la
 * replica pronta. Un promemoria gentile qualche giorno dopo il no. Il
 * segnale (no aperto) viene dagli stessi eventi della pagina pratica.
 *
 * ⚠️ Gira SOLO con RECUPERO_ATTIVO=1 (spento finché non c'è la cassa). La
 * `statoMap` è vuota quando è spento, quindi qui non parte niente.
 */
async function recuperaReplica(
  pr: PraticaConVolo,
  statoMap: Map<string, StatoReplica>,
): Promise<boolean> {
  const st = statoMap.get(pr.id) ?? {
    no: 0,
    replicheMandate: 0,
    promemoria: 0,
    ultimoNoIso: null,
  };
  /* Una pratica aperta prima del 13/08 ha `rifiuto_motivo` pieno ma può non
     avere l'evento `rifiuto`: la si conta come un no, come fa la pagina. */
  if (st.no === 0 && pr.rifiuto_motivo) {
    st.no = 1;
    st.ultimoNoIso = pr.rifiuto_il ?? null;
  }
  if (!deveRecuperareReplica(st)) return false;

  const spedita = await promemoriaReplica(pr.email, { link: `${casa()}/pratica/${pr.id}` });
  if (!spedita.ok) return false;

  await registraEvento(
    pr.id,
    EVENTO_RECUPERO_REPLICA,
    "Promemoria: la replica al no della compagnia è pronta, va mandata.",
  );
  return true;
}

async function giroSegui({ budgetMs = 8000 } = {}) {
  if (!SERVIZIO_ATTIVO) return { ok: false as const, motivo: "SUPABASE_SECRET_KEY assente." };

  /* 🔴 MODO SICURO: se l'interruttore d'emergenza è acceso, le email
     automatiche restano ferme. Il giro non fallisce (non è un guasto): dice
     che è in pausa e non manda niente. Check, verdetto e pagamento non
     passano di qui e restano vivi. */
  if (await modoSicuroAttivo()) {
    return {
      ok: true as const,
      aperte: 0,
      esaminate: 0,
      recuperati: [],
      recuperatiReplica: [],
      inviate: [],
      modoSicuro: true as const,
    };
  }

  const inizio = Date.now();
  const pratiche = await praticheDaSeguire();
  const ids = pratiche.map((p) => p.id);
  const fatti = await eventiRegistrati(ids);
  /* 🔴 SI FALLISCE CHIUSO. Se la memoria degli eventi non si è letta
     (`null`, non «vuota»), non si sa cosa è già partito: proseguire
     rimanderebbe benvenuto, sollecito, ente ed esito a OGNI pratica
     aperta, cioè un invio doppio di massa che brucia il dominio. Un giro
     saltato non costa niente: il prossimo cron riprova. Trovato dall'audit
     del pannello (26/08). */
  if (fatti === null) {
    return {
      ok: false as const,
      motivo: "Memoria degli eventi non letta: giro annullato per non rimandare email doppie.",
    };
  }
  /* La query dei no aperti costa una lettura in più: la facciamo solo se il
     recupero è acceso (con la cassa). Spento = mappa vuota, non parte nulla. */
  const statoMap = RECUPERO_ATTIVO ? await statoRepliche(ids) : new Map<string, StatoReplica>();

  const inviate: { pratica: string; passo: Passo }[] = [];
  const recuperati: string[] = [];
  const recuperatiReplica: string[] = [];
  let esaminate = 0;

  for (const pr of pratiche) {
    if (Date.now() - inizio > budgetMs) break;
    esaminate++;

    try {
      // Prima di tutto: se il benvenuto non è mai partito, si rimanda.
      // È una sola email per pratica per giro, e questa vince sui follow-up:
      // senza il link d'ingresso l'utente non entra nemmeno.
      if (await recuperaBenvenuto(pr, fatti)) {
        recuperati.push(pr.id);
        continue;
      }

      // Il "no non replicato": un promemoria, ma solo se è acceso (con la cassa).
      if (RECUPERO_ATTIVO && (await recuperaReplica(pr, statoMap))) {
        recuperatiReplica.push(pr.id);
        continue;
      }

      const passo = passoDovuto(pr, fatti);
      if (!passo) continue;
      if (await mandaPasso(pr, passo)) inviate.push({ pratica: pr.id, passo });
    } catch (e) {
      // Una pratica rotta non ferma le altre: log e avanti.
      console.error(`[segui] pratica ${pr.id} saltata:`, e);
    }
  }

  return {
    ok: true as const,
    aperte: pratiche.length,
    esaminate,
    recuperati,
    recuperatiReplica,
    inviate,
  };
}

export async function POST(req: NextRequest) {
  if (!chiamataAutorizzata(req)) {
    return NextResponse.json({ errore: "Non autorizzato." }, { status: 401 });
  }
  const esito = await giroSegui();
  return NextResponse.json(esito, { status: esito.ok ? 200 : 503 });
}
