import type { ReactNode } from "react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { cookies, headers } from "next/headers";
import Risultato, { type DatiVerifica } from "@/components/verifica/Risultato";
import { passDi } from "@/lib/check/cancello";
import { CHECK_A_PAGAMENTO, prezzoPagatoPerIlCheck, scontoDaCheck } from "@/lib/check/ingresso";
import { COPY } from "@/lib/copy";
import { listinoCorrente } from "@/lib/prezzi-server";
import { stripeAttivo } from "@/lib/stripe";
import { affiliatoDaCodice } from "@/lib/affiliati/affiliati";
import { COOKIE_REF } from "@/lib/affiliati/codice";
import { listinoScontato } from "@/lib/pratiche/prezzo";
import { scadenzaStimata, valuta } from "@/lib/regole/eu261";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { SUPABASE_CONFIGURATO } from "@/lib/supabase/chiavi";
import { utenteCollegato } from "@/lib/supabase/server";
import { creditoDisponibile } from "@/lib/pratiche/credito";
import { creatorePerId } from "@/lib/affiliati/creatore";
import { demo as fornitoreDemo } from "@/lib/voli/fornitori/demo";
import { normalizzaData, normalizzaVolo } from "@/lib/voli/normalizza";

/**
 * IL CUORE DELLA PAGINA DEL RISULTATO, condiviso da due indirizzi:
 * - `/verifica/[id]` (link demo, email, condivisi): l'id sta nell'indirizzo;
 * - `/verifica` (dopo un check vero): l'indirizzo è PULITO, l'id lo porta un
 *   cookie di sessione (scelta di Valerio, 14/08: «gli indirizzi sono sempre
 *   sporchi e diversi, /verifica/f1677518-...»).
 *
 * È PUBBLICA e senza login, per scelta (SPEC §3: niente prima del reveal).
 * Regge perché la pagina non mostra MAI dati personali: l'email della
 * verifica si legge soltanto per sapere SE c'è, e al browser arriva un sì/no.
 *
 * Due forme di id:
 * - UUID → riga vera in `verifiche`, letta col client di servizio;
 * - "demo-ZZ250-2026-08-06" → esempio ricalcolato dal fornitore demo.
 */

const UUID_OK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DEMO_OK = /^demo-([a-z0-9]{2,8})-([0-9]{4}-[0-9]{2}-[0-9]{2})$/i;

/* `inCollaudo` vuole una Request per leggere il cookie: qui siamo in un
   Server Component, quindi la si ricostruisce dalle intestazioni. */
async function richiesta(): Promise<Request> {
  const h = await headers();
  return new Request("https://rivolio.it/", { headers: { cookie: h.get("cookie") ?? "" } });
}

/** Gli unici valori ammessi per ?checkout=: tutto il resto si ignora. */
function avvisoCheckoutDa(grezzo: string | string[] | undefined): DatiVerifica["avvisoCheckout"] {
  return grezzo === "demo" || grezzo === "non-attivo" || grezzo === "errore" || grezzo === "recesso"
    ? grezzo
    : null;
}

/**
 * C'è un venditore vero? Se sì, i bottoni d'acquisto si accendono. La cassa è
 * Stripe, che li accende tutti e due (crea la sessione al volo, senza un link
 * per prodotto). Il client non tocca mai gli env: legge un sì/no.
 */
function checkoutConfigurato() {
  return stripeAttivo() ? { singola: true, famiglia: true } : { singola: false, famiglia: false };
}

/* --------------------------------------------------------- la cornice */

/**
 * 🔴 CHI ERA COLLEGATO VENIVA SBATTUTO FUORI DALLA WEB APP: l'unica uscita
 * era `/`, la landing di vendita. Ora chi ha un account torna a `/app`.
 * Il ritorno lo decide CHI guarda, non da dove arriva il link.
 */
function Cornice({ children, collegato }: { children: ReactNode; collegato: boolean }) {
  return (
    <div className="min-h-dvh bg-nebbia">
      <header className="border-b border-bordo bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <Link
            href={collegato ? "/app" : "/"}
            className="text-sm text-fumo transition-colors hover:text-inchiostro"
          >
            {collegato ? COPY.pratica.torna : COPY.risultato.nonIdoneo.cta}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">{children}</main>
    </div>
  );
}

/** Il pannello dei casi in cui il risultato non c'è: chiaro, con l'uscita. */
function Pannello({ titolo, testo, cta }: { titolo: string; testo: string; cta?: string }) {
  return (
    <div className="rounded-2xl border border-bordo bg-white px-6 py-8">
      <h1 className="font-display text-[1.6rem] leading-tight tracking-[-0.035em]">{titolo}</h1>
      <p className="mt-3 text-[0.95rem] leading-relaxed text-fumo">{testo}</p>
      {cta && (
        <Button asChild className="mt-6">
          <Link href="/">{cta}</Link>
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ i dati */

/** La riga di `verifiche` col volo agganciato. */
type RigaVerifica = {
  id: string;
  volo_iata: string;
  data_locale: string;
  esito: "idoneo" | "incerto" | "non_idoneo";
  importo: number | null;
  ritardo_minuti: number | null;
  caso_dichiarato?: string | null;
  motivo: string | null;
  conferma: "automatica" | "in_attesa" | "confermata" | "corretta";
  email?: string | null;
  voli: {
    arrivo_previsto_utc: string | null;
    arrivo_effettivo_utc: string | null;
    km_ortodromica: number | null;
    vettore_operativo: string | null;
    fonte: string;
  } | null;
};

/** Ricostruisce un esempio dimostrativo, senza database e senza chiavi. */
async function datiDemo(
  idPagina: string,
  voloGrezzo: string,
  dataGrezza: string,
  avvisoCheckout: DatiVerifica["avvisoCheckout"],
): Promise<DatiVerifica | { errore: string } | null> {
  const volo = normalizzaVolo(voloGrezzo);
  if (!volo.ok) return { errore: volo.errore };
  const data = normalizzaData(dataGrezza);
  if (!data.ok) return { errore: data.errore };

  const fatto = await fornitoreDemo.cerca(volo.valore, data.valore);
  if (!fatto) return null;

  const verdetto = valuta(fatto);
  return {
    idPagina,
    idVerifica: null,
    esito: verdetto.esito,
    volo: fatto.voloIata,
    dataVolo: fatto.dataLocale,
    importo: verdetto.esito === "idoneo" ? verdetto.importo : null,
    ritardoMinuti: "ritardoMinuti" in verdetto ? verdetto.ritardoMinuti : null,
    motivo: verdetto.motivo,
    demo: true,
    inAttesa: false,
    arrivoPrevistoUtc: fatto.arrivoPrevistoUtc,
    arrivoEffettivoUtc: fatto.arrivoEffettivoUtc,
    km: fatto.kmOrtodromica,
    scadenza:
      verdetto.esito === "idoneo"
        ? scadenzaStimata(fatto.dataLocale, fatto.vettoreOperativo)
        : null,
    checkout: checkoutConfigurato(),
    // I voli dimostrativi non usano il credito: sono esempi, non pratiche vere.
    credito: { singola: false, famiglia: false },
    avvisoCheckout,
  };
}

/* ----------------------------------------------------------- il contenuto */

/**
 * Il contenuto della pagina del risultato, dato un id (UUID o demo) e il
 * grezzo del parametro ?checkout=. Lo chiamano due indirizzi: `/verifica/[id]`
 * (id nell'indirizzo, per demo/email/condivisi) e `/verifica` (indirizzo
 * pulito, l'id lo porta il cookie dell'ultima verifica).
 */
export async function contenutoVerifica(
  id: string,
  checkoutGrezzo: string | string[] | undefined,
): Promise<ReactNode> {
  const avvisoCheckout = avvisoCheckoutDa(checkoutGrezzo);
  const utente = SUPABASE_CONFIGURATO ? await utenteCollegato() : null;
  const collegato = Boolean(utente);
  /* L'email dell'account di chi guarda (dalla sessione, sempre la sua):
     serve a non richiederla a chi è già loggato. */
  const emailAccount = utente?.email ?? null;

  // ── Esempio dimostrativo: si ricalcola, non si legge ────────────────
  const demoMatch = id.match(DEMO_OK);
  if (demoMatch) {
    const dati = await datiDemo(id, demoMatch[1], demoMatch[2], avvisoCheckout);
    if (!dati) {
      return (
        <Cornice collegato={collegato}>
          <Pannello
            titolo={COPY.risultato.nonTrovata.titolo}
            testo={COPY.risultato.nonTrovata.testo}
            cta={COPY.risultato.nonTrovata.cta}
          />
        </Cornice>
      );
    }
    if ("errore" in dati) {
      return (
        <Cornice collegato={collegato}>
          <Pannello
            titolo={COPY.risultato.nonTrovata.titolo}
            testo={dati.errore}
            cta={COPY.risultato.nonTrovata.cta}
          />
        </Cornice>
      );
    }
    return (
      <Cornice collegato={collegato}>
        <Risultato dati={dati} />
      </Cornice>
    );
  }

  // ── Link non riconoscibile: né UUID né demo ─────────────────────────
  if (!UUID_OK.test(id)) {
    return (
      <Cornice collegato={collegato}>
        <Pannello
          titolo={COPY.risultato.nonTrovata.titolo}
          testo={COPY.risultato.nonTrovata.testo}
          cta={COPY.risultato.nonTrovata.cta}
        />
      </Cornice>
    );
  }

  // ── Verifica vera: si legge col client di servizio ──────────────────
  if (!SERVIZIO_ATTIVO) {
    return (
      <Cornice collegato={collegato}>
        <Pannello
          titolo={COPY.risultato.nonDisponibile.titolo}
          testo={COPY.risultato.nonDisponibile.testo}
        />
      </Cornice>
    );
  }

  let riga: RigaVerifica | null = null;
  try {
    const db = supabaseServizio();
    const { data, error } = (await db
      .from("verifiche")
      .select(
        "id, volo_iata, data_locale, esito, importo, ritardo_minuti, motivo, conferma, caso_dichiarato, email, voli(arrivo_previsto_utc, arrivo_effettivo_utc, km_ortodromica, vettore_operativo, fonte)",
      )
      .eq("id", id)
      .maybeSingle()) as { data: RigaVerifica | null; error: { message: string } | null };
    if (error) throw new Error(error.message);
    riga = data;
  } catch (e) {
    console.error("[verifica/pagina] lettura fallita:", e);
    return (
      <Cornice collegato={collegato}>
        <Pannello
          titolo={COPY.risultato.nonDisponibile.titolo}
          testo={COPY.risultato.nonDisponibile.testo}
        />
      </Cornice>
    );
  }

  if (!riga) {
    return (
      <Cornice collegato={collegato}>
        <Pannello
          titolo={COPY.risultato.nonTrovata.titolo}
          testo={COPY.risultato.nonTrovata.testo}
          cta={COPY.risultato.nonTrovata.cta}
        />
      </Cornice>
    );
  }

  /* IL CREDITO DELLA GARANZIA (Valerio, 17/08): se chi guarda è collegato,
     il verdetto è idoneo e ha un credito libero, al posto di "Prepara la
     pratica a 14,90€" gli offriamo di aprirla gratis. Solo per gli idonei:
     sul giallo non si vende, e col credito nemmeno. */
  const credito =
    utente && riga.esito === "idoneo"
      ? await creditoDisponibile(utente.id)
      : { singola: false, famiglia: false };

  /* Account creator (gratis a vita): sul verdetto idoneo il bottone dice
     «gratis» invece del prezzo, e apre la pratica senza pagare. Solo per gli
     idonei, come tutto il resto: sul giallo non si apre niente. */
  const creatore = Boolean(utente && riga.esito === "idoneo" && (await creatorePerId(utente.id)));

  const { listino: listinoPieno } = await listinoCorrente();
  const cassePronte = checkoutConfigurato();
  const venditoreVero = cassePronte.singola || cassePronte.famiglia;
  const pass = passDi(await richiesta());

  /* Il prezzo che questa persona paga davvero, mostrato QUI uguale a quanto
     poi incassa la cassa (stessa funzione, lib/pratiche/prezzo). Con Stripe,
     la cassa vera sa applicare sconti al volo: si tolgono lo sconto del creator
     (se arrivata da un suo link) e l'anticipo del check (se l'ha già pagato).
     Senza Stripe resta la vecchia regola: il ripiego ha un prezzo bloccato,
     quindi lo sconto del check si vede solo dove non c'è un venditore. */
  let listino = listinoPieno;
  if (stripeAttivo()) {
    const affiliato = await affiliatoDaCodice((await cookies()).get(COOKIE_REF)?.value);
    const scalaCheck = CHECK_A_PAGAMENTO && pass ? prezzoPagatoPerIlCheck() : 0;
    listino = listinoScontato(listinoPieno, { affiliato, scalaCheck });
  } else if (pass && !venditoreVero) {
    listino = scontoDaCheck(listinoPieno, prezzoPagatoPerIlCheck());
  }

  const dati: DatiVerifica = {
    idPagina: id,
    idVerifica: riga.id,
    listino,
    esito: riga.esito,
    volo: riga.volo_iata,
    dataVolo: riga.data_locale,
    importo: riga.importo,
    ritardoMinuti: riga.ritardo_minuti,
    casoDichiarato: riga.caso_dichiarato ?? null,
    motivo: riga.motivo,
    demo: riga.voli?.fonte === "demo",
    inAttesa: riga.conferma === "in_attesa",
    corretto: riga.conferma === "corretta",
    emailGiaData: Boolean(riga.email),
    emailAccount,
    arrivoPrevistoUtc: riga.voli?.arrivo_previsto_utc ?? null,
    arrivoEffettivoUtc: riga.voli?.arrivo_effettivo_utc ?? null,
    km: riga.voli?.km_ortodromica ?? null,
    scadenza:
      riga.esito === "idoneo"
        ? scadenzaStimata(riga.data_locale, riga.voli?.vettore_operativo ?? riga.volo_iata)
        : null,
    checkout: cassePronte,
    credito,
    creatore,
    avvisoCheckout,
  };

  return (
    <Cornice collegato={collegato}>
      <Risultato dati={dati} />
    </Cornice>
  );
}
