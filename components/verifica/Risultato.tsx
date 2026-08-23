"use client";

import { useEffect, useId, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { animate, useMotionValue, useReducedMotion } from "motion/react";
import { Anima } from "@/components/Anima";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { COPY } from "@/lib/copy";
import { controllaFormato } from "@/lib/email/indirizzo";
import { LISTINO_BASE } from "@/lib/prezzi";
import { formattaMinuti } from "@/lib/regole/eu261";
import DomandeCancellato from "./DomandeCancellato";
import DichiaraCaso from "./DichiaraCaso";
import DichiaraRinuncia from "./DichiaraRinuncia";
import ChiHaOperato from "./ChiHaOperato";
import CardCondivisione from "./CardCondivisione";
import LasciaRecensione from "@/components/rivolio/LasciaRecensione";

/**
 * La pagina del risultato, lato client. TRE stati, mai due (SPEC §4):
 * IDONEO (il reveal, si vende) · INCERTO (si spiega, MAI vendere) ·
 * NON_IDONEO (risposta chiara, gratis).
 *
 * Regole rispettate qui dentro:
 * - Il claim è sempre fatto oggettivo + fascia + cose da verificare.
 *   MAI "hai diritto a" (SPEC §3): i testi vengono tutti da COPY.
 * - Ogni numero è apribile: la fascia ha "Come nasce questa cifra",
 *   la scadenza porta l'avvertenza del motore.
 * - demo = badge visibile e onesto, pagamento e salvataggio spenti.
 * - Shadow mode: bottoni sostituiti dall'avviso del controllo umano.
 */

export type DatiVerifica = {
  /** Il segmento [id] dell'URL: serve ai link di checkout per tornare qui. */
  idPagina: string;
  /** UUID vero della riga `verifiche`; null per gli esempi dimostrativi. */
  idVerifica: string | null;
  esito: "idoneo" | "incerto" | "non_idoneo";
  volo: string;
  /** "aaaa-mm-gg", la data locale di partenza. */
  dataVolo: string;
  importo: number | null;
  ritardoMinuti: number | null;
  /** "negato" o "coincidenza" quando il verdetto viene da una dichiarazione. */
  casoDichiarato?: string | null;
  motivo: string | null;
  /** Vero se il dato viene dal fornitore dimostrativo: il badge è obbligatorio. */
  demo: boolean;
  /** Il listino che questa persona vede: test dei due prezzi (9/08). */
  listino?: { singolaTesto: string; famigliaTesto: string };
  /**
   * Shadow mode: il verdetto aspetta ancora l'occhio umano nel pannello.
   *
   * 🔴 FINO AL 12/08 QUESTO NASCONDEVA I BOTTONI, ed era il difetto che
   * ha rotto il collaudo di Valerio: dopo il verdetto restava un campo
   * email e nient'altro, senza nessun modo di andare avanti. Lui ha
   * dovuto entrare nel pannello e confermare a mano; un cliente vero
   * chiude la pagina, e non sa nemmeno perché.
   *
   * Adesso è solo un'informazione: si vende comunque, e il controllo
   * umano avviene DOPO (decisione di Valerio, 12/08). Il conto che la
   * regge: il motore è provato su 53 casi con zero falsi positivi, e la
   * garanzia copre l'errore, quindi il rischio residuo lo paghiamo noi
   * 14,90 e non il cliente. A fermare la vendita resta un caso solo, ed
   * è quello giusto: un verdetto che una persona ha guardato e
   * **corretto**.
   */
  inAttesa: boolean;
  /** Un umano ha guardato il verdetto e l'ha dichiarato sbagliato. */
  corretto?: boolean;
  /**
   * L'email è già agganciata a questa verifica.
   *
   * ⚠️ Arriva il SÌ/NO, mai l'indirizzo: la pagina è pubblica per chi ha
   * il link, e stampare lì dentro l'email di qualcuno sarebbe un regalo a
   * chiunque riceva quel link inoltrato. Serve a non chiederla due volte,
   * che è esattamente quello che faceva prima.
   */
  emailGiaData?: boolean;
  /**
   * L'email dell'account di CHI STA GUARDANDO, se è loggato. Viene dalla
   * SESSIONE, non dalla verifica: è sempre la sua, mai quella di un altro,
   * quindi un link condiviso non la espone. Serve a non richiedere l'email
   * (né il modulo di cattura) a chi è già loggato: ce l'ha già l'account.
   */
  emailAccount?: string | null;
  arrivoPrevistoUtc: string | null;
  arrivoEffettivoUtc: string | null;
  km: number | null;
  scadenza: { dataStimata: string; avvertenza: string } | null;
  /** La cassa Stripe è attiva: quando sì, i bottoni d'acquisto si accendono. */
  checkout: { singola: boolean; famiglia: boolean };
  /**
   * IL CREDITO DELLA GARANZIA (Valerio, 17/08). Se chi guarda è collegato e ha
   * un credito libero, al posto del pagamento apre la pratica gratis. `singola`
   * = ha un credito che copre una singola (qualsiasi credito); `famiglia` = ha
   * un credito famiglia. Il server ricontrolla: qui è solo l'esperienza.
   */
  credito: { singola: boolean; famiglia: boolean };
  /** Rimbalzo dalla rotta di checkout: cosa dire e perché. */
  avvisoCheckout: "demo" | "non-attivo" | "errore" | "recesso" | null;
};

/* ------------------------------------------------------------ attrezzi */

/** "{volo} del {data}" → testo pieno. Segnaposto senza valore: stringa vuota. */
function riempi(modello: string, valori: Record<string, string>): string {
  return modello.replace(/\{(\w+)\}/g, (_, chiave: string) => valori[chiave] ?? "");
}

/** 200 → "3h20". */
function ritardoUmano(minuti: number): string {
  const m = Math.abs(Math.round(minuti));
  return formattaMinuti(m);
}

/** "2026-08-06" → "6 agosto 2026". */
function dataIt(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** ISO UTC → "23:20" in ora italiana (dichiarato accanto: notaOrari). */
function oraIt(utc: string): string {
  return new Date(utc).toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Rome",
  });
}

/* ------------------------------------------------------------- pezzi */

function BadgeDemo() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pillola bg-sole/25 px-3 py-1 text-xs font-medium text-inchiostro">
      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sole" aria-hidden="true" />
      {COPY.comune.demo}
    </span>
  );
}

function Occhiello({ testo, demo }: { testo: string; demo: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <p className="text-[13px] font-medium uppercase tracking-wider text-fumo-2">{testo}</p>
      {demo && <BadgeDemo />}
    </div>
  );
}

/**
 * IL REVEAL: l'importo che sale da 0 alla fascia. Vale metà del progetto
 * (SPEC §8, animazione 4). Motion anima un MotionValue e noi mostriamo
 * il numero arrotondato; chi ha chiesto meno animazioni vede subito la
 * cifra finale, senza corsa.
 */
function ContatoreReveal({ importo }: { importo: number }) {
  const ridotto = useReducedMotion();
  const valore = useMotionValue(0);
  const [mostrato, setMostrato] = useState(0);

  useEffect(() => {
    if (ridotto) {
      // Un setState sincrono dentro l'effect fa partire render a catena:
      // si passa da requestAnimationFrame (stessa scelta di Anima.Contatore).
      const frame = requestAnimationFrame(() => setMostrato(importo));
      return () => cancelAnimationFrame(frame);
    }
    const corsa = animate(valore, importo, {
      delay: 0.35,
      duration: 2.2,
      // la curva unica del sito: parte veloce e si posa piano
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setMostrato(Math.round(v)),
    });
    return () => corsa.stop();
  }, [importo, ridotto, valore]);

  return (
    <span className="numeri luce-testo-chiaro block font-display text-[clamp(4.6rem,17vw,7.5rem)] font-medium leading-none tracking-[-0.05em] text-menta">
      {mostrato}€
    </span>
  );
}

/**
 * La cattura email, DOPO il reveal (SPEC §3, passo 4). Una sola meccanica
 * per idoneo e incerto, cambiano solo i testi. Sui casi demo non chiama
 * nessuna API: dice onestamente che non c'è niente da salvare.
 */
function CatturaEmail({
  idVerifica,
  demo,
  titolo,
  testo,
  etichetta,
  segnaposto,
  bottone,
  conferma,
  rassicurazione,
}: {
  idVerifica: string | null;
  demo: boolean;
  titolo?: string;
  testo: string;
  etichetta: string;
  segnaposto: string;
  bottone: string;
  conferma: string;
  rassicurazione?: string;
}) {
  const idCampo = useId();
  const [email, setEmail] = useState("");
  const [stato, setStato] = useState<"fermo" | "invio" | "fatto" | "demo" | "errore">("fermo");
  const [errore, setErrore] = useState("");
  /* IL REFUSO SI PROPONE, NON SI IMPONE (13/08). `gmial.com` esiste
     davvero come dominio, quindi il controllo del DNS lo lascia passare:
     l'unico modo di prenderlo è dire all'utente "volevi dire gmail.com?".
     Ma domini legittimi che assomigliano ai famosi esistono, quindi il
     "no, è giusto così" deve esserci ed è un tocco solo. */
  const [suggerito, setSuggerito] = useState<string | null>(null);

  async function invia(evento: FormEvent | null, forza?: { email?: string; insisto?: boolean }) {
    evento?.preventDefault();
    const daMandare = forza?.email ?? email;
    /* Su un volo dimostrativo l'email non si salva, ed è giusto: non c'è
       niente da avvisare, e chi ci capita per caso non deve lasciare un
       indirizzo per un volo che non esiste. */
    if (demo || !idVerifica) {
      setStato("demo");
      return;
    }
    setStato("invio");
    setSuggerito(null);
    try {
      const risposta = await fetch("/api/verifica/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: idVerifica,
          email: daMandare,
          insisto: forza?.insisto === true,
        }),
      });
      const corpo = (await risposta.json().catch(() => null)) as {
        ok?: boolean;
        errore?: string;
        motivo?: string;
        suggerimento?: string | null;
      } | null;
      if (risposta.ok && corpo?.ok) {
        setStato("fatto");
        return;
      }
      if (corpo?.motivo === "refuso" && corpo.suggerimento) {
        setSuggerito(corpo.suggerimento);
        setStato("fermo");
        return;
      }
      setErrore(corpo?.errore ?? COPY.comune.erroreGenerico);
      setStato("errore");
    } catch {
      setErrore(COPY.comune.erroreGenerico);
      setStato("errore");
    }
  }

  if (stato === "fatto") {
    return (
      <div className="rounded-2xl border border-verde/30 bg-menta-tenue px-6 py-5">
        <p className="flex items-start gap-2.5 text-[0.95rem] leading-relaxed text-verde-notte">
          <SpuntaVerde />
          {conferma}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-bordo bg-white px-6 py-6">
      {titolo && <h2 className="font-display text-xl tracking-[-0.03em]">{titolo}</h2>}
      <p className={`${titolo ? "mt-2" : ""} text-[0.95rem] leading-relaxed text-fumo`}>{testo}</p>

      <form onSubmit={(e) => void invia(e)} className="mt-4 flex flex-col gap-3 sm:flex-row">
        <div className="flex-1">
          <Label htmlFor={idCampo} className="sr-only">
            {etichetta}
          </Label>
          <Input
            id={idCampo}
            type="email"
            required
            placeholder={segnaposto}
            aria-label={etichetta}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={stato === "invio"}
          />
        </div>
        <Button type="submit" size="lg" className="h-12 shrink-0" disabled={stato === "invio"}>
          {stato === "invio" ? COPY.comune.caricamento : bottone}
        </Button>
      </form>

      {suggerito && (
        <div
          role="alert"
          className="mt-3 rounded-xl border border-sole/40 bg-sole/10 px-3.5 py-3 text-sm leading-relaxed"
        >
          <p>
            Volevi dire <strong className="font-medium">{suggerito}</strong>?
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setEmail(suggerito);
                void invia(null, { email: suggerito });
              }}
              className="h-9 rounded-bottone bg-verde px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-verde-scuro"
            >
              Sì, correggi
            </button>
            <button
              type="button"
              onClick={() => void invia(null, { insisto: true })}
              className="h-9 rounded-bottone border border-bordo bg-white px-3.5 text-[13px] font-medium text-fumo transition-colors hover:text-inchiostro"
            >
              No, è giusto così
            </button>
          </div>
        </div>
      )}
      {stato === "errore" && (
        <p role="alert" className="mt-3 text-sm leading-relaxed text-red-600">
          {errore}
        </p>
      )}
      {stato === "demo" && (
        <p role="status" className="mt-3 rounded-xl bg-sole/15 px-3.5 py-2.5 text-sm leading-relaxed">
          {COPY.catturaEmail.demoNota}
        </p>
      )}
      {rassicurazione && stato !== "demo" && (
        <p className="mt-3 text-[13px] text-fumo-2">{rassicurazione}</p>
      )}
    </div>
  );
}

function SpuntaVerde() {
  return (
    <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-verde" aria-hidden="true">
      <svg viewBox="0 0 12 12" className="h-3 w-3">
        <path
          d="M2.5 6.2 5 8.6l4.5-5.2"
          fill="none"
          stroke="#fff"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-2xl border border-bordo bg-white px-6 py-6 ${className}`}>
      {children}
    </section>
  );
}

/* ============================================================= IDONEO */

function Idoneo({ dati, importo }: { dati: DatiVerifica; importo: number }) {
  const t = COPY.risultato.idoneo;
  /* Il ritardo si mostra SOLO quando è lui a decidere. Su negato
     imbarco e coincidenza persa il verdetto nasce da quello che ha
     dichiarato il passeggero, e stampare qui il ritardo del volo
     sarebbe mettere accanto alla cifra un numero che la smentisce. */
  const dichiarato = dati.casoDichiarato ?? null;
  const ritardo =
    !dichiarato && dati.ritardoMinuti !== null ? ritardoUmano(dati.ritardoMinuti) : null;
  const titolo = dichiarato
    ? dichiarato === "negato"
      ? t.titoloNegato
      : dichiarato === "declassamento"
        ? t.titoloDeclassamento
        : dichiarato === "ritardo_rinuncia"
          ? t.titoloRinuncia
          : t.titoloCoincidenza
    : ritardo
      ? riempi(t.titoloTemplate, { ritardo })
      : null;
  const avviso = dati.avvisoCheckout;
  const compraSingola = dati.demo || dati.checkout.singola;

  const testoAvviso =
    avviso === "demo"
      ? t.checkoutDemo
      : avviso === "non-attivo"
        ? t.checkoutNonAttivo
        : avviso === "recesso"
          ? t.recesso.avvisoRimbalzo
          : avviso === "errore"
            ? COPY.comune.erroreGenerico
            : null;

  return (
    <div className="flex flex-col gap-6">
      <Anima>
        <Occhiello testo={t.occhiello} demo={dati.demo} />
        {titolo && (
          /* Il fatto oggettivo bene in vista: è il titolo, non una nota. */
          <h1 className="luce-testo mt-4 font-display text-[clamp(1.9rem,6.4vw,2.9rem)] leading-[1.04] tracking-[-0.04em]">
            {titolo}
          </h1>
        )}
      </Anima>

      {/* ------------------------------------------------ IL REVEAL */}
      <Anima ritardo={0.1}>
        <section className="relative overflow-hidden rounded-[2rem] bg-verde-notte px-6 py-10 text-center text-white sm:px-10">
          {/* un alone di luce dietro la cifra, come sui titoli della landing */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 h-56 w-[130%] -translate-x-1/2 -translate-y-1/3 rounded-full bg-menta/20 blur-3xl"
          />
          {/* La frase della fascia, senza la cifra: la cifra È il contatore.
              Sul rimborso da rinuncia non è una "fascia a passeggero": è il
              prezzo del biglietto che ti devono ridare, e le due righe lo
              dicono giusto invece di prendere in prestito le parole della
              compensazione. */}
          <p className="relative text-[0.95rem] text-white/75">
            {dichiarato === "ritardo_rinuncia"
              ? t.rimborsoPrima
              : t.fasciaTemplate.split("{importo}")[0].trim()}
          </p>
          <div className="relative mt-3">
            <ContatoreReveal importo={importo} />
            <p className="mt-2 text-sm text-white/60">
              {dichiarato === "ritardo_rinuncia" ? t.rimborsoDopo : t.perPasseggero}
            </p>
          </div>

          {/* Ogni numero è apribile: la trasparenza è il prodotto. */}
          <details className="group relative mx-auto mt-6 max-w-md text-left">
            <summary className="tocco-comodo cursor-pointer list-none text-center text-sm font-medium text-menta underline decoration-menta/40 underline-offset-4 transition-colors hover:text-white">
              {t.comeNasceLaCifra.titolo}
            </summary>
            <div className="mt-3 rounded-xl bg-white/8 px-4 py-3.5 text-sm leading-relaxed text-white/80">
              <p>{t.comeNasceLaCifra.testo}</p>
              {dati.km !== null && (
                <p className="mt-2 font-medium text-white">
                  {riempi(t.comeNasceLaCifra.trattaTemplate, {
                    distanza: Math.round(dati.km).toLocaleString("it-IT"),
                  })}
                </p>
              )}
            </div>
          </details>
        </section>
      </Anima>

      {/* --------------------------------------- il fatto oggettivo */}
      <Anima ritardo={0.16}>
        <Card>
          {/* 🔴 A CHI È RIMASTO A TERRA NON SI DICE «SEI ATTERRATO ALLE
              00:59». Trovato col collaudo del 13/08: dopo aver dichiarato
              il negato imbarco la pagina stampava lo stesso gli orari di
              arrivo del volo, cioè di un volo che quella persona non ha
              preso. Il ritardo era già stato tolto dal titolo per lo
              stesso motivo; questa riga era rimasta indietro.
              Su negato imbarco e coincidenza persa il fatto che conta
              l'ha dichiarato il passeggero, e il volo si nomina senza
              raccontargli un viaggio che non ha fatto. */}
          {!dichiarato && dati.arrivoPrevistoUtc && dati.arrivoEffettivoUtc ? (
            <>
              <p className="text-[1.05rem] leading-relaxed">
                {riempi(t.fattoTemplate, {
                  volo: dati.volo,
                  data: dataIt(dati.dataVolo),
                  oraEffettiva: oraIt(dati.arrivoEffettivoUtc),
                  oraPrevista: oraIt(dati.arrivoPrevistoUtc),
                })}
              </p>
              <p className="mt-1.5 text-[13px] text-fumo-2">{t.notaOrari}</p>
            </>
          ) : (
            ritardo && (
              <p className="text-[1.05rem] leading-relaxed">
                {riempi(t.fattoBreveTemplate, {
                  volo: dati.volo,
                  data: dataIt(dati.dataVolo),
                  ritardo,
                })}
              </p>
            )
          )}
          <p className="mt-3 text-[0.95rem] leading-relaxed text-fumo">{t.verifica}</p>

          <ul className="mt-4 flex flex-col gap-2.5">
            {t.cosaServe.map((voce) => (
              <li key={voce} className="flex items-start gap-2.5 text-[0.95rem] leading-relaxed">
                <SpuntaVerde />
                {voce}
              </li>
            ))}
          </ul>

          {dati.scadenza && (
            <div className="mt-5 border-t border-bordo pt-4">
              <p className="text-sm font-medium">{t.scadenzaTitolo}</p>
              <p className="mt-1 text-[0.95rem] leading-relaxed text-fumo">
                {riempi(t.scadenzaTemplate, { data: dataIt(dati.scadenza.dataStimata) })}
              </p>
              {/* L'avvertenza viene dal motore: la stima è dichiarata, sempre. */}
              <p className="mt-1.5 text-[13px] leading-relaxed text-fumo-2">
                {dati.scadenza.avvertenza}
              </p>
            </div>
          )}
        </Card>
      </Anima>

      {/* ---------------------------------- passo 4: aprire la pratica
          🔴 QUI C'ERANO DUE PEZZI, E FACEVANO A PUGNI.
          Prima veniva un riquadro che chiedeva l'email, e SOTTO il
          pagamento. Due moduli uno sopra l'altro per la stessa cosa:
          Valerio ha lasciato l'email in cima, poi la cassa gliel'ha
          richiesta, e nel mezzo (col controllo umano acceso) di bottoni
          per andare avanti non ce n'era nessuno.
          Adesso è un modulo solo: la spunta, l'email SE manca, e il
          bottone. Si chiede una cosa una volta sola, nel punto in cui
          serve davvero. */}
      <Anima ritardo={0.22}>
        {dati.corretto ? (
          /* L'unico caso in cui non si vende: una persona ha guardato
             questo verdetto e l'ha dichiarato sbagliato. */
          <Card className="border-verde/30 bg-menta-tenue">
            <p className="flex items-start gap-2.5 text-[0.95rem] leading-relaxed text-verde-notte">
              <SpuntaVerde />
              {t.shadow}
            </p>
            <p className="mt-2.5 pl-[30px] text-sm leading-relaxed text-verde-notte/80">
              {t.controlloUmano}
            </p>
          </Card>
        ) : (
          <div className="flex flex-col gap-3">
            {/* Il blocco autorità, appena prima dell'acquisto: il diritto è
                legge europea, non una nostra promessa, e l'onere della prova
                è della compagnia. È la prova che regge al posto dei numeri
                sociali (framework CONVERTI, leva "autorità"). */}
            <div className="rounded-2xl border border-verde/25 bg-menta-tenue/60 px-5 py-4">
              <p className="font-display text-[1.05rem] leading-snug tracking-[-0.02em] text-verde-notte">
                {t.autorita.titolo}
              </p>
              <p className="mt-1.5 text-[0.92rem] leading-relaxed text-verde-notte/80">
                {t.autorita.testo}
              </p>
            </div>
            {testoAvviso && (
              <p
                role="status"
                className="rounded-xl bg-sole/15 px-4 py-3 text-sm leading-relaxed"
              >
                {testoAvviso}
              </p>
            )}
            {dati.credito.singola ? (
              /* Ha un credito della garanzia: apre gratis, niente pagamento. */
              <AcquistoColCredito dati={dati} />
            ) : compraSingola ? (
              <AcquistoPratica dati={dati} />
            ) : (
              !testoAvviso && (
                <p className="rounded-xl bg-sole/15 px-4 py-3 text-sm leading-relaxed">
                  {t.checkoutNonAttivo}
                </p>
              )
            )}
            <p className="flex items-center justify-center gap-2 text-center text-sm text-fumo">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-verde" aria-hidden="true" />
              {t.garanziaBreve}
            </p>
          </div>
        )}
      </Anima>

      {/* --------- l'alternativa: hai rinunciato? allora è un rimborso.
          Un volo con 5 ore e più di ritardo esce idoneo alla COMPENSAZIONE,
          ma chi non è partito ha diritto al RIMBORSO del biglietto (art. 6 →
          art. 8), non alla compensazione. Si offre solo qui, dove il volo
          qualifica davvero (≥ 300 minuti = SOGLIA_RINUNCIA_MINUTI), e solo
          se non è già un caso dichiarato né un verdetto corretto a mano. */}
      {!dichiarato &&
        !dati.corretto &&
        dati.ritardoMinuti !== null &&
        dati.ritardoMinuti >= 300 && (
          <Anima ritardo={0.26}>
            <DichiaraRinuncia
              volo={dati.volo}
              dataVolo={dati.dataVolo}
              idVerifica={dati.idVerifica}
              demo={dati.demo}
            />
          </Anima>
        )}

      {/* ------------------------- la card virale (SPEC §8, punto 5) */}
      {ritardo && (
        <Anima ritardo={0.28}>
          <CardCondivisione volo={dati.volo} ritardo={ritardo} importo={importo} demo={dati.demo} />
        </Anima>
      )}

      {/* La recensione: solo su una verifica VERA (non sui dimostrativi:
          un esempio non è un'esperienza da recensire, e non deve emettere
          un buono). Il premio lo gestisce il componente. */}
      {dati.idVerifica && !dati.demo && (
        <Anima ritardo={0.34}>
          <LasciaRecensione eventoTipo="verdetto" eventoRif={dati.idVerifica} />
        </Anima>
      )}
    </div>
  );
}

/* --------------------- #21: la rinuncia al recesso, poi la cassa -------- */

/**
 * La spunta di rinuncia al recesso (art. 59 Cod. Consumo) DAVANTI ai
 * bottoni verso la cassa. Senza spunta non si parte; con la spunta il
 * consenso si registra sul server (/api/pratiche/recesso) e SOLO poi si
 * naviga al checkout. Il cancello vero sta comunque nella rotta di
 * checkout: qui l'esperienza, lì la legge.
 */
function AcquistoPratica({ dati }: { dati: DatiVerifica }) {
  /* I due prezzi del test (9/08): se la pagina non passa il listino si usa
     quello di sempre, così niente si rompe e nessuno vede un segnaposto. */
  const conPrezzo = (modello: string) =>
    modello
      .replace("{prezzo}", dati.listino?.singolaTesto ?? LISTINO_BASE.singolaTesto)
      .replace("{prezzoFamiglia}", dati.listino?.famigliaTesto ?? LISTINO_BASE.famigliaTesto);

  const t = COPY.risultato.idoneo;
  const idSpunta = useId();
  const idEmail = useId();
  const [accettato, setAccettato] = useState(false);
  const [richiamo, setRichiamo] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [errore, setErrore] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  /* L'email va SALVATA sulla verifica (da lì nasce l'account e si aggancia
     la pratica) se non c'è già. Su un esempio puro non c'è riga a cui
     agganciarla. */
  const serveSalvareEmail = Boolean(dati.idVerifica) && !dati.emailGiaData;
  /* 🔴 IL CAMPO EMAIL SI MOSTRA SOLO A CHI NON È LOGGATO (Valerio, 15/08:
     «da loggato mi esce ancora il campo email»). Chi ha un account ce l'ha
     già: usiamo quella del suo account e non gliela richiediamo. Così la
     pratica si aggancia lo stesso, senza un campo inutile davanti. */
  const emailDaUsare = dati.emailAccount ?? email;
  const mostraCampoEmail = serveSalvareEmail && !dati.emailAccount;

  const compraFamiglia = dati.demo || dati.checkout.famiglia;

  async function vai(tipo: "singola" | "famiglia") {
    if (inCorso) return;
    if (!accettato) {
      setRichiamo(true);
      return;
    }
    if (mostraCampoEmail) {
      /* Lo stesso controllo del server, meno il giro sul DNS (che nel
         browser non si può fare). Serve a dire subito cosa non va invece
         di far aspettare un viaggio andata e ritorno; il cancello vero
         resta dentro /api/verifica/email. Solo l'email DIGITATA si valida:
         quella dell'account è già buona. */
      const forma = controllaFormato(email, { insisto: true });
      if (!forma.ok) {
        setErrore(forma.motivo === "formato" ? COPY.catturaEmail.errore : forma.messaggio);
        return;
      }
    }
    const destinazione = `/api/pratiche/checkout?verifica=${dati.idPagina}&tipo=${tipo}`;

    /* 🔴 QUI STAVA LA SCORCIATOIA CHE HA ROTTO IL COLLAUDO DI VALERIO.
       C'era scritto: se il volo è dimostrativo, salta la registrazione
       del consenso e vai dritto alla cassa. Aveva senso quando gli
       esempi rimbalzavano sempre con "questo è un esempio". Ma un volo
       ZZ analizzato per davvero ha una riga vera nel database e percorre
       la strada vera: saltando la registrazione, la cassa non trovava il
       consenso e rispondeva **«manca la spunta»** a chi la spunta
       l'aveva appena messa. Poi rimandava alla pagina, che ripartiva
       dall'analisi. Loop.
       La distinzione giusta non è "il volo è finto" ma "esiste una riga
       su cui scrivere". */
    if (!dati.idVerifica) {
      window.location.assign(destinazione);
      return;
    }

    setInCorso(true);
    setErrore(null);
    try {
      /* L'email prima del consenso: se la si scrive dopo, un guasto a
         metà lascia una verifica firmata e senza destinatario, cioè una
         pratica che non si può consegnare a nessuno. */
      if (serveSalvareEmail) {
        const r = await fetch("/api/verifica/email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: dati.idVerifica, email: emailDaUsare.trim() }),
        });
        /* ⚠️ Un 404 qui vuol dire "un'email c'era già" (la rotta scrive
           una volta sola, di proposito), e non è un guasto: si tira
           dritto. Fermarsi direbbe a chi torna indietro che qualcosa non
           va, quando invece è tutto a posto. */
        if (!r.ok && r.status !== 404) throw new Error("email non salvata");
      }
      const risposta = await fetch("/api/pratiche/recesso", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verifica: dati.idPagina }),
      });
      const corpo = (await risposta.json().catch(() => null)) as { ok?: boolean } | null;
      if (!risposta.ok || !corpo?.ok) throw new Error("registrazione fallita");
      window.location.assign(destinazione);
    } catch {
      setInCorso(false);
      setErrore(t.recesso.errore);
    }
  }

  return (
    <>
      <label
        htmlFor={idSpunta}
        className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3.5 text-sm leading-relaxed transition-colors ${
          accettato
            ? "border-verde/40 bg-menta-tenue"
            : richiamo
              ? "border-sole bg-sole/10"
              : "border-bordo bg-white"
        }`}
      >
        <input
          id={idSpunta}
          type="checkbox"
          checked={accettato}
          onChange={(e) => {
            setAccettato(e.target.checked);
            if (e.target.checked) setRichiamo(false);
          }}
          className="mt-0.5 size-4 shrink-0 accent-verde"
        />
        <span>{t.recesso.etichetta}</span>
      </label>
      <p className="px-1 text-[13px] leading-relaxed text-fumo">{t.recesso.nota}</p>

      {/* L'email, una volta sola e proprio qui: prima del pagamento
          serve, dopo il verdetto era solo un ostacolo fra la persona e
          il suo risultato. Se c'è già (o sei loggato) questo pezzo non
          compare. */}
      {mostraCampoEmail && (
        <div className="rounded-xl border border-bordo bg-white px-4 py-3.5">
          <label htmlFor={idEmail} className="block text-sm font-medium">
            {COPY.catturaEmail.campo.etichetta}
          </label>
          <input
            id={idEmail}
            type="email"
            inputMode="email"
            autoComplete="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errore) setErrore(null);
            }}
            placeholder={COPY.catturaEmail.campo.segnaposto}
            /* ⚠️ 16px: sotto quella misura iOS ingrandisce la pagina da
               solo appena si tocca il campo, e da lì in poi resta storta.
               È lo stesso difetto già trovato sul login. */
            className="mt-2 h-12 w-full rounded-bottone border border-bordo bg-nebbia px-3.5 text-[16px] outline-none transition-colors placeholder:text-fumo-2 focus:border-verde/45 focus:bg-white"
          />
          <p className="mt-2 text-[13px] leading-relaxed text-fumo-2">
            {COPY.catturaEmail.rassicurazione}
          </p>
        </div>
      )}
      {richiamo && !accettato && (
        <p role="status" className="rounded-xl bg-sole/15 px-4 py-3 text-sm leading-relaxed">
          {t.recesso.blocco}
        </p>
      )}
      {errore && (
        <p role="alert" className="rounded-xl bg-sole/15 px-4 py-3 text-sm leading-relaxed">
          {errore}
        </p>
      )}
      <Button
        asChild
        size="lg"
        className={`h-auto w-full py-4 text-base ${accettato ? "" : "opacity-60"}`}
      >
        <a
          href={`/api/pratiche/checkout?verifica=${dati.idPagina}&tipo=singola`}
          onClick={(e) => {
            e.preventDefault();
            void vai("singola");
          }}
        >
          {inCorso ? t.recesso.attesa : conPrezzo(t.cta)}
        </a>
      </Button>
      {compraFamiglia && (
        <Button
          asChild
          variant="contorno"
          size="lg"
          className={`h-auto w-full whitespace-normal py-3.5 text-center text-[0.95rem] ${
            accettato ? "" : "opacity-60"
          }`}
        >
          <a
            href={`/api/pratiche/checkout?verifica=${dati.idPagina}&tipo=famiglia`}
            onClick={(e) => {
              e.preventDefault();
              void vai("famiglia");
            }}
          >
            {conPrezzo(t.ctaFamiglia)}
          </a>
        </Button>
      )}
    </>
  );
}

/* ------------------- il credito della garanzia: pratica gratis ------- */

/**
 * Al posto del pagamento, quando chi guarda ha un credito della garanzia
 * (Valerio, 17/08). Niente recesso e niente cassa: la pratica è coperta dal
 * credito. È un form POST, non un link: aprire una pratica e spendere un
 * credito non deve poter partire da un prefetch. Il cancello vero sta nel
 * server (/api/pratiche/credito), che ricontrolla il credito.
 */
function AcquistoColCredito({ dati }: { dati: DatiVerifica }) {
  const base = `/api/pratiche/credito?verifica=${dati.idPagina}`;
  return (
    <div className="flex flex-col gap-2.5">
      <form method="post" action={`${base}&tipo=singola`}>
        <Button type="submit" size="lg" className="h-auto w-full py-4 text-base">
          Apri la pratica, gratis col tuo credito
        </Button>
      </form>
      {dati.credito.famiglia && (
        <form method="post" action={`${base}&tipo=famiglia`}>
          <Button
            type="submit"
            variant="contorno"
            size="lg"
            className="h-auto w-full whitespace-normal py-3.5 text-center text-[0.95rem]"
          >
            Eravate in più sullo stesso volo? Apri la pratica famiglia, gratis
          </Button>
        </form>
      )}
      <p className="text-center text-sm leading-relaxed text-fumo">
        La garanzia ti aveva lasciato un credito: questa pratica è su di noi, non paghi niente.
      </p>
    </div>
  );
}

/* ============================================================ INCERTO */

function Incerto({ dati }: { dati: DatiVerifica }) {
  const t = COPY.risultato.incerto;
  /* Un cancellato non è un incerto qualsiasi: gli mancano DUE risposte,
     e quelle le può dare solo chi c'era. Invece di fermarsi, si chiedono. */
  const cancellato = (dati.motivo ?? "").toLowerCase().includes("risulta cancellato");
  /* Stessa idea per il codeshare: il motore lo dichiara nel motivo, e la
     risposta che manca ce l'ha l'utente sulla carta d'imbarco. */
  const codeshare = (dati.motivo ?? "").toLowerCase().includes("codeshare");
  /* Quando le due domande chiudono il caso, il titolo "qui ci fermiamo"
     diventa falso: la pagina se ne accorge e cambia faccia. */
  const [chiuso, setChiuso] = useState<"idoneo" | "incerto" | "non_idoneo" | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <Anima>
        <Occhiello testo={t.occhiello} demo={dati.demo} />
        <h1 className="luce-testo mt-4 font-display text-[clamp(1.9rem,6.4vw,2.9rem)] leading-[1.04] tracking-[-0.04em]">
          {chiuso && chiuso !== "incerto" ? COPY.risultato.cancellato.titoloChiuso : t.titolo}
        </h1>
      </Anima>

      {!chiuso && (
        <Anima ritardo={0.1}>
          <Card>
            {/* La spiegazione viene dal motivo del motore: mai vaga. */}
            <p className="text-[1.05rem] leading-relaxed">
              {dati.motivo ?? t.motivi.datoMancante}
            </p>
            <p className="mt-3 text-[0.95rem] leading-relaxed text-fumo">{t.testo}</p>
            <p className="mt-3 border-t border-bordo pt-3 text-[0.95rem] leading-relaxed text-fumo">
              {t.alternativa}
            </p>
          </Card>
        </Anima>
      )}

      {/* IL CANCELLATO SI CHIUDE, non resta appeso: due domande e il
          motore dà il verdetto vero (art. 5 CE 261/2004). */}
      {cancellato && (
        <Anima ritardo={0.14}>
          <DomandeCancellato
            volo={dati.volo}
            dataVolo={dati.dataVolo}
            idVerifica={dati.idVerifica}
            demo={dati.demo}
            avvisa={setChiuso}
          />
        </Anima>
      )}

      {/* IL CODESHARE SI CHIUDE con una domanda sola: chi ha fatto volare
          l'aereo. Senza, il reclamo partirebbe alla compagnia sbagliata. */}
      {codeshare && !cancellato && (
        <Anima ritardo={0.14}>
          <ChiHaOperato
            volo={dati.volo}
            dataVolo={dati.dataVolo}
            idVerifica={dati.idVerifica}
            demo={dati.demo}
            avvisa={setChiuso}
          />
        </Anima>
      )}

      {/* Anche sull'incerto: lasciato a terra o coincidenza persa si
          dichiarano, il tracciamento non li vede. */}
      {!chiuso && !cancellato && !codeshare && (
        <Anima ritardo={0.15}>
          <DichiaraCaso
            volo={dati.volo}
            dataVolo={dati.dataVolo}
            idVerifica={dati.idVerifica}
            demo={dati.demo}
          />
        </Anima>
      )}

      {/* Niente vendita sul giallo, MAI. Solo l'avviso se il dato si
          sblocca: a caso chiuso non serve più. E niente modulo email a chi
          è loggato: ce l'ha già l'account (Valerio, 15/08). */}
      {!chiuso && !dati.emailAccount && (
      <Anima ritardo={0.16}>
        <CatturaEmail
          idVerifica={dati.idVerifica}
          demo={dati.demo}
          testo={t.avviso.testo}
          etichetta={t.avviso.campoEmail.etichetta}
          segnaposto={t.avviso.campoEmail.segnaposto}
          bottone={t.avviso.bottone}
          conferma={t.avviso.conferma}
        />
      </Anima>
      )}

      <Anima ritardo={0.2}>
        <Button asChild size="lg" className="h-auto w-full py-4 text-base">
          <Link href="/">{t.cta}</Link>
        </Button>
      </Anima>
    </div>
  );
}

/* ========================================================= NON IDONEO */

function NonIdoneo({ dati }: { dati: DatiVerifica }) {
  const t = COPY.risultato.nonIdoneo;
  const minuti = dati.ritardoMinuti;
  const fatto =
    minuti === null
      ? null
      : minuti > 0
        ? riempi(t.fattoTemplate, {
            volo: dati.volo,
            data: dataIt(dati.dataVolo),
            ritardo: ritardoUmano(minuti),
          })
        : riempi(t.fattoPuntuale, { volo: dati.volo, data: dataIt(dati.dataVolo) });

  return (
    <div className="flex flex-col gap-6">
      <Anima>
        <Occhiello testo={t.occhiello} demo={dati.demo} />
        <h1 className="luce-testo mt-4 font-display text-[clamp(1.9rem,6.4vw,2.9rem)] leading-[1.04] tracking-[-0.04em]">
          {t.titolo}
        </h1>
      </Anima>

      <Anima ritardo={0.1}>
        <Card>
          {/* Il dato si mostra anche quando è un no: risposta chiara, gratis. */}
          {fatto && <p className="text-[1.05rem] leading-relaxed">{fatto}</p>}
          <p className={`${fatto ? "mt-3" : ""} text-[0.95rem] leading-relaxed text-fumo`}>
            {t.saluto}
          </p>
          <p className="mt-3 border-t border-bordo pt-3 text-[0.95rem] leading-relaxed text-fumo">
            {COPY.retroattivo.suggerimento}
          </p>
        </Card>
      </Anima>

      {/* Il "no" del tracciamento non chiude i casi che gli archivi non
          vedono: negato imbarco e coincidenza persa si dichiarano qui. */}
      <Anima ritardo={0.14}>
        <DichiaraCaso
          volo={dati.volo}
          dataVolo={dati.dataVolo}
          idVerifica={dati.idVerifica}
          demo={dati.demo}
        />
      </Anima>

      <Anima ritardo={0.16}>
        <div className="flex flex-col gap-3">
          <Button asChild size="lg" className="h-auto w-full py-4 text-base">
            <Link href="/">{t.cta}</Link>
          </Button>
          <p className="text-center text-[13px] text-fumo-2">{t.linkPromemoria}</p>
          <p className="text-center text-sm text-fumo">
            {t.suggerimentoOsservatorio}{" "}
            <Link href="/#osservatorio" className="font-medium text-verde hover:text-verde-scuro">
              {COPY.osservatorio.titolo}
            </Link>
          </p>
        </div>
      </Anima>

      {dati.idVerifica && !dati.demo && (
        <Anima ritardo={0.2}>
          <LasciaRecensione eventoTipo="verdetto" eventoRif={dati.idVerifica} />
        </Anima>
      )}
    </div>
  );
}

/* ============================================================ ingresso */

export default function Risultato({ dati }: { dati: DatiVerifica }) {
  /* 🔴 LO SCANNER FANTASMA, CHIUSO PER DAVVERO (Valerio, 22/08). Aprendo la
     pratica non pagata dal link dell'email, per un lampo compariva la scena
     dell'analisi e poi spariva: un teatro fuori posto, proprio mentre uno
     voleva solo pagare. Il motivo: questa pagina rifaceva il "velo"
     dell'analisi a ogni arrivo che NON venisse dal check dell'hero (link
     email, segnalibro, condivisione). Ma il teatro vero l'analisi ce l'ha
     già all'hero (SchedaCheck), dov'è al posto giusto: lo guardi mentre
     succede. Qui era solo un doppione che lampeggiava durante il rimando.
     Tolto del tutto: la pagina del verdetto mostra SUBITO il verdetto, da
     qualunque parte tu arrivi. Nessuno stato, nessun sessionStorage, niente
     da far ripartire per sbaglio: è la fine di una serie di rattoppi
     (ZZ777, il velo che restava, i pallini che rimbalzavano). */

  // Un "idoneo" senza importo non deve mai vendere: si tratta da incerto.
  const verdetto =
    dati.esito === "idoneo" && dati.importo !== null ? (
      <Idoneo dati={dati} importo={dati.importo} />
    ) : dati.esito === "non_idoneo" ? (
      <NonIdoneo dati={dati} />
    ) : (
      <Incerto dati={dati} />
    );

  // Il verdetto e basta: niente velo sopra. Vedi la nota in cima al componente.
  return verdetto;
}
