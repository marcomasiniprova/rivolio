"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import CartaImbarcoScan from "@/components/rivolio/CartaImbarcoScan";
import { COPY } from "@/lib/copy";
import MuroCheck, { type DatiMuro } from "@/components/rivolio/MuroCheck";
import { riprendiCheck, sospendiCheck, tornatoDallaCassa } from "@/lib/check/ripresa";

/**
 * LA SCHEDA DEL CHECK: lo standard, identico ovunque.
 *
 * Richiesta di Valerio (8/08): "trova lo standard ufficiale per tutti gli
 * entry point". Eccolo: questa scheda vive nell'hero della landing, nella
 * web app e (nella sua versione nativa) nell'app. Tre modi di dire qual
 * è il volo, dal più facile al più tecnico:
 *   1. la FOTO della carta d'imbarco (Mistral OCR, la foto non si salva);
 *   2. la TRATTA e il giorno (predefinito: è quello che uno ricorda);
 *   3. il NUMERO del volo, per chi ce l'ha davanti.
 *
 * E il TEATRO ONESTO è per tutti: i sei passi veri dell'analisi, il
 * biglietto che si compila coi dati del server, mai una barra finta.
 */

const HERO = COPY.hero;
const TEATRO = COPY.comeFunziona.verifica;
const CHECK = COPY.check;
const CURVA = [0.16, 1, 0.3, 1] as const;

type Fase = "campo" | "teatro";
type Modo = "tratta" | "numero";

const attesa = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * LA RICHIESTA CHE NON SI ARRENDE AL PRIMO INTOPPO.
 *
 * 🔴 «NON DEVE MAI RICEVERE ERRORI ROSSI E BUG O CRASH» (Valerio, 14/08,
 * con lo screenshot di FR4001 che dà "Qualcosa non ha funzionato").
 *
 * Il collegamento può essere lento o cadere per un attimo, e su Netlify una
 * funzione lenta viene interrotta: senza rete di sicurezza l'utente vede un
 * errore rosso da crash proprio dopo aver premuto un bottone. Questo
 * involucro dà un tetto di tempo alla richiesta e, se salta per la rete o
 * per un guasto passeggero del server (5xx), riprova UNA volta da solo
 * prima di arrendersi.
 *
 * ⚠️ Un 4xx (muro, volo non trovato, troppe richieste) NON è un guasto: è
 * una risposta vera del server, e riprovare non cambierebbe niente. Quello
 * torna subito al chiamante, che lo mostra con calma.
 */
const TIMEOUT_MS = 20_000;

async function richiestaResiliente(url: string, opzioni: RequestInit): Promise<Response> {
  let ultimo: unknown = null;
  for (let tentativo = 0; tentativo < 2; tentativo++) {
    if (tentativo > 0) await attesa(700);
    const ctrl = new AbortController();
    const stop = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(url, { ...opzioni, signal: ctrl.signal });
      clearTimeout(stop);
      /* 5xx = guasto passeggero del server: al primo colpo vale la pena
         riprovare; al secondo si consegna comunque, e lo gestisce il
         chiamante con un messaggio calmo. */
      if (r.status >= 500 && tentativo === 0) {
        ultimo = new Error(`http ${r.status}`);
        continue;
      }
      return r;
    } catch (e) {
      clearTimeout(stop);
      ultimo = e; // rete giù o timeout: si riprova, se restano tentativi
    }
  }
  throw ultimo ?? new Error("richiesta fallita");
}

/* L'analisi profonda (scelta di Valerio, 8/08): la sequenza non si taglia
   MAI, nemmeno se il server risponde subito. */
const PASSO_MS = 2400;
const PAUSA_FINALE_MS = 900;

/** "zz 0250" → "ZZ250", per il link demo. Il giudizio vero resta al server. */
function canonico(grezzo: string): string {
  const pezzi = grezzo.trim().match(/^([A-Za-z0-9]{2})[\s-]*0*([0-9]{1,4})\s*([A-Za-z])?$/);
  if (pezzi) return (pezzi[1] + pezzi[2] + (pezzi[3] ?? "")).toUpperCase();
  return grezzo.replace(/[\s-]+/g, "").toUpperCase();
}

/** Confini del campo data: fino a domani, indietro di 6 anni (come il server). */
function confiniData(): { minData: string; maxData: string } {
  const giorno = 24 * 60 * 60 * 1000;
  const max = new Date(Date.now() + giorno).toISOString().slice(0, 10);
  const min = new Date();
  min.setUTCFullYear(min.getUTCFullYear() - 6);
  return { minData: min.toISOString().slice(0, 10), maxData: max };
}
const { minData, maxData } = confiniData();

const riempi = (t: string, v: Record<string, string>) =>
  t.replace(/\{(\w+)\}/g, (tutto, k) => v[k] ?? tutto);

const dataEstesa = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/** "2026-08-07" → "07/08/2026": sul biglietto la data si legge, non è ISO. */
const dataBreve = (iso: string) => iso.split("-").reverse().join("/");

/* ─────────────────────────── il campo aeroporto ────────────────────── */

/* Come lo manda /api/aeroporti. `etichetta` è il nome pronto da
   mostrare: "Milano Malpensa". Vedi lib/voli/aeroporti.ts. */
type Scalo = { iata: string; citta: string; nome: string; etichetta: string; paese: string };

function CampoScalo({
  id,
  etichetta,
  segnaposto,
  scelto,
  onScegli,
}: {
  id: string;
  etichetta: string;
  segnaposto: string;
  scelto: Scalo | null;
  onScegli: (s: Scalo | null) => void;
}) {
  const [testo, setTesto] = useState("");
  const [risposta, setRisposta] = useState<{ q: string; lista: Scalo[] }>({ q: "", lista: [] });

  const domanda = testo.trim();
  const attiva = !scelto && domanda.length >= 2;
  const aggiornata = risposta.q === domanda;
  const proposte = attiva && aggiornata ? risposta.lista : [];

  useEffect(() => {
    if (!attiva) return;
    let vivo = true;
    const timer = setTimeout(() => {
      fetch(`/api/aeroporti?q=${encodeURIComponent(domanda)}`)
        .then((r) => r.json())
        .then((j) => {
          if (vivo) setRisposta({ q: domanda, lista: j?.ok ? j.aeroporti : [] });
        })
        .catch(() => {
          if (vivo) setRisposta({ q: domanda, lista: [] });
        });
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(timer);
    };
  }, [domanda, attiva]);

  if (scelto) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-inchiostro/70">{etichetta}</span>
        <div className="flex h-14 items-center justify-between gap-3 rounded-bottone border border-menta bg-white px-4">
          <span className="min-w-0 truncate">
            <span className="font-display text-[17px] font-medium tracking-[-0.01em]">
              {scelto.citta}
            </span>{" "}
            <span className="text-[13px] font-medium text-verde-scuro">{scelto.iata}</span>
            <span className="ml-2 hidden text-[12px] text-fumo sm:inline">{scelto.nome}</span>
          </span>
          <button
            type="button"
            onClick={() => {
              onScegli(null);
              setTesto("");
            }}
            className="shrink-0 text-[13px] font-medium text-fumo transition-colors hover:text-inchiostro"
          >
            {CHECK.tratta.cambia}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-inchiostro/70">
        {etichetta}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        spellCheck={false}
        value={testo}
        onChange={(e) => setTesto(e.target.value)}
        placeholder={segnaposto}
        className="h-14 w-full min-w-0 rounded-bottone border border-bordo bg-white px-4 text-[16px] text-inchiostro outline-none transition-all duration-200 placeholder:text-fumo-2 focus:border-verde/60 focus:ring-4 focus:ring-verde/12"
      />
      {proposte.length > 0 && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-2xl border border-bordo bg-white shadow-[0_24px_48px_-20px_rgba(5,46,31,.3)]">
          {proposte.map((a) => (
            <li key={a.iata} className="border-b border-bordo/60 last:border-0">
              <button
                type="button"
                onClick={() => onScegli(a)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-nebbia"
              >
                <span className="min-w-0">
                  {/* "Milano Malpensa", non "Milan Malpensa International
                      Airport" e non "Ferno". Vedi etichettaScalo. */}
                  <span className="block truncate text-[15px] font-medium text-inchiostro">
                    {a.etichetta}
                  </span>
                  <span className="block truncate text-[12px] text-fumo">{a.paese}</span>
                </span>
                <span className="shrink-0 text-[13px] font-semibold tracking-wide text-verde-scuro">
                  {a.iata}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {attiva && aggiornata && proposte.length === 0 && (
        <p className="text-[12px] leading-snug text-fumo">{CHECK.tratta.nessunoScalo}</p>
      )}
    </div>
  );
}

/* ─────────────────────────── la scheda intera ──────────────────────── */

type VoloTrovato = {
  volo: string;
  compagnia: string | null;
  partenzaOra: string;
  arrivoOra: string;
  cancellato: boolean;
};

export default function SchedaCheck() {
  const router = useRouter();

  const [modo, setModo] = useState<Modo>("tratta");
  const [fase, setFase] = useState<Fase>("campo");
  const [passo, setPasso] = useState(0);
  const [errore, setErrore] = useState<string | null>(null);
  /* Il muro del check a pagamento: acceso dal 402 del server, mai da qui.
     Se un giorno il muro dipendesse da una decisione presa nel browser,
     lo scavalcherebbe chiunque apra gli strumenti per sviluppatori. */
  const [muro, setMuro] = useState<DatiMuro | null>(null);
  /* L'avviso del muro quando un codice della recensione non vale (finto o
     già speso): lo capiamo perché il server rimanda il 402 su un riscatto. */
  const [erroreRiscatto, setErroreRiscatto] = useState<string | null>(null);
  /* `riprova`: presente solo quando ha senso riprovare (rete o guasto
     passeggero del server), non su un volo che non esiste. */
  const [avviso, setAvviso] = useState<{
    testo: string;
    demo: boolean;
    riprova?: () => void;
  } | null>(null);
  const inCorso = useRef(false);
  /* 🔴 IL FRENO DELLE CORSE, contro i pallini che rimbalzano (Valerio,
     18/08). L'animazione dei passi gira su un timer. Se sbatti sul muro e
     poi usi il codice della recensione, parte una SECONDA analisi mentre la
     prima non è stata spenta: due timer contano insieme sullo stesso
     indicatore, e i pallini vanno avanti e indietro. Ogni analisi prende un
     numero; solo l'ultima muove i pallini, le vecchie si fermano da sole. */
  const corsa = useRef(0);

  // il numero
  const [volo, setVolo] = useState("");
  const [data, setData] = useState("");

  // la tratta
  const [da, setDa] = useState<Scalo | null>(null);
  const [a, setA] = useState<Scalo | null>(null);
  const [giorno, setGiorno] = useState("");
  const [cercaInCorso, setCercaInCorso] = useState(false);
  const [trovati, setTrovati] = useState<VoloTrovato[] | null>(null);
  const [trattaDemo, setTrattaDemo] = useState(false);

  // la carta d'imbarco
  const fotoRef = useRef<HTMLInputElement>(null);
  const [leggoCarta, setLeggoCarta] = useState(false);
  const [daCarta, setDaCarta] = useState<string | null>(null);

  // il volo sotto analisi (per il teatro) e i dati veri del server
  const [inAnalisi, setInAnalisi] = useState<{ volo: string; data: string }>({
    volo: "",
    data: "",
  });
  const [letto, setLetto] = useState<{
    tratta: string | null;
    previsto: string | null;
    effettivo: string | null;
  }>({ tratta: null, previsto: null, effettivo: null });

  const oraDa = (iso: string | null | undefined): string | null => {
    if (!iso) return null;
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    return d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  };

  /** IL CHECK, uguale per tutti i modi: teatro + richiesta vera. Il
      `codice` arriva solo dal muro, quando la persona ne incolla uno per
      l'analisi gratis: viaggia col check e il server lo valida sul registro. */
  async function avvia(voloDaControllare: string, giornoIso: string, codice?: string) {
    if (inCorso.current) return;
    inCorso.current = true;
    const miaCorsa = ++corsa.current;
    setErrore(null);
    setAvviso(null);
    /* 🔴 IL MURO SI AZZERA QUI, e prima non lo faceva: premendo "Usa il
       codice" partiva l'analisi ma `muro` restava, e il render mostra il
       muro PRIMA del teatro, quindi non succedeva niente di visibile
       (Valerio, 15/08). Azzerandolo, il teatro compare; se poi il codice
       non vale, il 402 lo rimette con l'avviso. */
    setMuro(null);
    setErroreRiscatto(null);
    setInAnalisi({ volo: voloDaControllare.trim().toUpperCase(), data: giornoIso });
    setFase("teatro");
    setPasso(0);
    setLetto({ tratta: null, previsto: null, effettivo: null });

    const sequenza = (async () => {
      for (let i = 1; i < TEATRO.passi.length; i++) {
        await attesa(PASSO_MS);
        if (corsa.current !== miaCorsa) return; // un'analisi nuova ha preso il posto
        setPasso(i);
      }
      await attesa(PASSO_MS);
      if (corsa.current !== miaCorsa) return;
      setPasso(TEATRO.passi.length);
      await attesa(PAUSA_FINALE_MS);
    })();

    try {
      const r = await richiestaResiliente("/api/verifica", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          volo: voloDaControllare.trim(),
          data: giornoIso,
          ...(codice ? { codice } : {}),
        }),
      });
      const dati = await r.json().catch(() => null);

      if (dati?.ok && dati.dato) {
        setLetto({
          tratta: dati.dato.da && dati.dato.a ? `${dati.dato.da} → ${dati.dato.a}` : null,
          previsto: oraDa(dati.dato.previsto),
          effettivo: oraDa(dati.dato.effettivo),
        });
      }

      /* IL MURO. Il server risponde 402 quando l'analisi si sblocca
         pagando: non è un errore da riga rossa, è una schermata. */
      if (r.status === 402 && dati?.serveIlPass) {
        setFase("campo");
        setMuro(dati.muro as DatiMuro);
        /* Se stavamo riscattando un codice e il muro torna, quel codice
           non valeva (finto o già speso): lo diciamo sul muro stesso,
           invece di lasciare la persona a chiedersi perché non è partito. */
        if (codice) setErroreRiscatto("Questo codice non è valido o è già stato usato.");
        /* Il volo si mette da parte PRIMA di mandare qualcuno alla cassa:
           al ritorno l'analisi riparte da sola, invece di ritrovarsi un
           modulo vuoto dopo aver pagato (vedi lib/check/ripresa.ts).
           Con sé porta anche il MODO e la PAGINA da cui si parte: così
           chi fa il check dentro la web app ci torna, invece di finire
           sulla hero del sito (Valerio, 14/08). */
        sospendiCheck(
          voloDaControllare,
          giornoIso,
          modo,
          typeof window !== "undefined" ? window.location.pathname : "/",
        );
        /* ⚠️ QUI NON SI SCROLLA, e prima si scrollava. C'era un
           `scrollIntoView` che riportava la pagina in cima al riquadro
           del check: sulla carta serviva a non far comparire la cifra
           grossa già coperta, in pratica la pagina saltava sotto le
           mani proprio nel momento in cui uno aveva appena premuto un
           bottone. Sembrava un ricaricamento, e un ricaricamento dopo
           un clic si legge come "qualcosa è andato storto" (segnalato
           da Valerio, 11/08).
           Adesso il muro compare dov'è il riquadro, la pagina resta
           ferma, e a tenerlo leggibile ci pensa `scroll-mt` sulla
           sezione: se il riquadro sta già sotto la barra si vede tutto
           lo stesso. */
        /* Il muro prende il posto del teatro: spengo la sequenza dei passi di
           questa analisi, se no continua a contare in sottofondo e, al
           riscatto del codice, si accavalla con quella nuova. */
        corsa.current++;
        inCorso.current = false;
        return;
      }

      if (!r.ok || !dati?.ok) {
        /* 🔴 Niente più riga rossa da crash. Se il volo non si trova (o il
           server dice il perché con calma), si mostra quel messaggio; se è
           un guasto passeggero del server (5xx), si offre di riprovare,
           perché lì riprovare serve davvero. Mai rosso, mai "qualcosa non
           ha funzionato". */
        setFase("campo");
        const guasto = r.status >= 500;
        setAvviso({
          testo:
            typeof dati?.errore === "string" && !guasto ? dati.errore : COPY.comune.erroreRete,
          demo: false,
          riprova: guasto ? () => void avvia(voloDaControllare, giornoIso) : undefined,
        });
        inCorso.current = false;
        return;
      }

      /* Indirizzo PULITO per un verdetto vero: si va su /verifica e basta,
         l'id lo porta il cookie scritto da /api/verifica (Valerio, 14/08:
         niente più /verifica/<uuid> lungo). La demo tiene il suo indirizzo
         esplicito, che serve a ricostruirla senza database. */
      const destinazione = dati.id
        ? "/verifica"
        : dati.demo === true
          ? `/verifica/demo-${canonico(voloDaControllare)}-${giornoIso}`
          : null;

      if (!destinazione) {
        setFase("campo");
        setAvviso({
          testo: typeof dati.motivo === "string" ? dati.motivo : COPY.comune.erroreGenerico,
          demo: dati.demo === true,
        });
        inCorso.current = false;
        return;
      }

      await sequenza;
      sessionStorage.setItem("rivolio-scan-fatto", "1");
      router.push(destinazione);
    } catch {
      /* Rete giù o timeout, anche dopo la riprova automatica: messaggio
         calmo col bottone per riprovare a mano. Mai rosso. */
      setFase("campo");
      setAvviso({
        testo: COPY.comune.erroreRete,
        demo: false,
        riprova: () => void avvia(voloDaControllare, giornoIso),
      });
      inCorso.current = false;
    }
  }

  /**
   * SI TORNA DALLA CASSA: l'analisi riparte da sola.
   *
   * Gira una volta sola, all'apertura della pagina, e solo se
   * nell'indirizzo c'è il segno che dice "vengo dalla cassa". Il campo si
   * riempie lo stesso, così chi guarda vede QUALE volo sta partendo:
   * un'analisi che parte da sola senza dire su cosa è una scatola nera.
   */
  const ripresaFatta = useRef(false);
  useEffect(() => {
    if (ripresaFatta.current) return;
    ripresaFatta.current = true;
    if (!tornatoDallaCassa()) return;
    const sospeso = riprendiCheck();
    if (!sospeso) return;
    /* ⚠️ Lo stato non si tocca dentro il corpo dell'effetto: React lo
       vieta perché innesca un secondo disegno a catena. Un rinvio di un
       giro basta, e il risultato per chi guarda è identico. */
    /* ⚠️ E non si annulla in uscita: in sviluppo React monta, smonta e
       rimonta apposta per scovare i difetti, e un `clearTimeout` qui
       spegnerebbe la ripresa proprio in quel giro. A non farla partire
       due volte ci pensa già il segnaposto qui sopra. */
    setTimeout(() => {
      setModo(sospeso.modo === "tratta" ? "tratta" : "numero");
      setVolo(sospeso.volo);
      setData(sospeso.data);
      void avvia(sospeso.volo, sospeso.data);
    }, 0);
    /* Deve girare all'apertura e basta: `avvia` cambia a ogni disegno e
       metterlo qui dentro rilancerebbe l'analisi in continuazione. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Il modo numero: valida e avvia. */
  function inviaNumero(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!volo.trim()) return setErrore(HERO.form.errori.voloMancante);
    if (!data) return setErrore(HERO.form.errori.dataMancante);
    void avvia(volo, data);
  }

  /** Il modo tratta: cerca i voli del giorno fra i due scali. */
  async function cercaTratta(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrore(null);
    setAvviso(null);
    setTrovati(null);
    if (!da) return setErrore(CHECK.tratta.errori.partenza);
    if (!a) return setErrore(CHECK.tratta.errori.arrivo);
    if (da.iata === a.iata) return setErrore(CHECK.tratta.errori.stessoScalo);
    if (!giorno) return setErrore(CHECK.tratta.errori.data);

    setCercaInCorso(true);
    try {
      const r = await richiestaResiliente(
        `/api/voli-tratta?da=${da.iata}&a=${a.iata}&data=${encodeURIComponent(giorno)}`,
        {},
      );
      const j = await r.json().catch(() => null);
      setCercaInCorso(false);
      if (!r.ok || !j?.ok) {
        /* Un messaggio del server (es. scalo non riconosciuto) si mostra;
           altrimenti il messaggio calmo, mai "qualcosa non ha funzionato". */
        setErrore(typeof j?.errore === "string" ? j.errore : COPY.comune.erroreRete);
        return;
      }
      setTrovati(j.voli as VoloTrovato[]);
      setTrattaDemo(Boolean(j.demo));
    } catch {
      setCercaInCorso(false);
      setErrore(COPY.comune.erroreRete);
    }
  }

  /** La carta d'imbarco: foto → volo e data già scritti. */
  async function leggiCarta(file: File) {
    setErrore(null);
    setDaCarta(null);
    setLeggoCarta(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const lettore = new FileReader();
        lettore.onload = () => resolve(String(lettore.result).split(",")[1] ?? "");
        lettore.onerror = () => reject(lettore.error);
        lettore.readAsDataURL(file);
      });
      const r = await richiestaResiliente("/api/leggi-carta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ immagine: base64, tipo: file.type || "image/jpeg" }),
      });
      const j = await r.json().catch(() => null);
      setLeggoCarta(false);
      /* La lettura della carta NON si paga più (vedi /api/leggi-carta): è
         solo compilazione. Il muro scatta dopo, sull'analisi, quando si
         preme "Analizza". Così la foto riempie volo e data e non fa
         perdere niente: da qui in poi è identico a chi scrive a mano. */
      if (!r.ok || !j?.ok) {
        setErrore(typeof j?.errore === "string" ? j.errore : COPY.comune.erroreRete);
        return;
      }
      setModo("numero");
      if (j.volo) setVolo(j.volo);
      if (j.data) setData(j.data);
      const giornoLetto = j.data ? dataEstesa(j.data) : "";
      if (j.volo && j.data) {
        setDaCarta(riempi(CHECK.carta.letto, { volo: j.volo, data: giornoLetto }));
      } else if (j.volo) {
        setDaCarta(riempi(CHECK.carta.lettoSoloVolo, { volo: j.volo }));
      } else {
        setDaCarta(riempi(CHECK.carta.lettoSoloData, { data: giornoLetto }));
      }
    } catch {
      setLeggoCarta(false);
      setErrore(COPY.comune.erroreRete);
    }
  }

  const apriCalendario = (e: React.MouseEvent<HTMLInputElement>) => {
    try {
      e.currentTarget.showPicker();
    } catch {
      /* Safari: comportamento nativo */
    }
  };

  const campoData = (id: string, valore: string, cambia: (v: string) => void) => (
    <input
      id={id}
      type="date"
      min={minData}
      max={maxData}
      value={valore}
      onChange={(e) => cambia(e.target.value)}
      onClick={apriCalendario}
      className="h-14 w-full min-w-0 cursor-pointer rounded-bottone border border-bordo bg-white px-4 text-[16px] text-inchiostro outline-none transition-all duration-200 focus:border-verde/60 focus:ring-4 focus:ring-verde/12"
    />
  );

  /* ────────────────────────────── il muro ──────────────────────────── */
  if (muro) {
    return (
      <MuroCheck
        dati={muro}
        onPaga={() => {
          /* Alla cassa con una navigazione PIENA: la cassa vera è Stripe,
             un sito esterno, e router.push (navigazione morbida) non ci
             arriverebbe. L'origine (landing o web app) viaggia
             nell'indirizzo, così al ritorno si torna dove si era. Senza
             cassa si scende ai prezzi: meglio una pagina che spiega che un
             bottone che non fa niente. */
          if (muro.cassa) {
            const sep = muro.cassa.includes("?") ? "&" : "?";
            const origine =
              typeof window !== "undefined" ? window.location.pathname : "/";
            // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- la cassa è Stripe (esterno): router.push non seguirebbe il redirect fuori dal sito
            window.location.assign(`${muro.cassa}${sep}origine=${encodeURIComponent(origine)}`);
          } else {
            router.push("/#prezzi");
          }
        }}
        onRiscatta={(codice) => {
          /* Il codice dell'analisi gratis (da recensione): rifà il check
             sullo stesso volo, stavolta col codice. Se vale, il cancello
             si apre e parte l'analisi; se no, il muro resta con l'avviso. */
          void avvia(inAnalisi.volo, inAnalisi.data, codice);
        }}
        erroreRiscatto={erroreRiscatto}
      />
    );
  }

  /* ───────────────────────────── il teatro ─────────────────────────── */
  if (fase === "teatro") {
    return (
      <div aria-live="polite" className="py-1">
        <div className="flex items-baseline justify-between gap-4">
          <p className="text-[13px] font-medium uppercase tracking-[0.14em] text-fumo">
            {TEATRO.titolo}
          </p>
          <p className="numeri text-[13px] font-medium text-verde-scuro">
            {Math.min(passo, TEATRO.passi.length)}/{TEATRO.passi.length}
          </p>
        </div>

        <div className="mt-2 h-1 overflow-hidden rounded-full bg-bordo">
          <motion.div
            className="h-full rounded-full bg-verde"
            initial={{ width: "0%" }}
            animate={{
              width: `${(Math.min(passo, TEATRO.passi.length) / TEATRO.passi.length) * 100}%`,
            }}
            transition={{ duration: 0.8, ease: CURVA }}
          />
        </div>

        <div className="mt-4">
          <CartaImbarcoScan
            tratta={letto.tratta}
            arrivoPrevisto={letto.previsto}
            arrivoEffettivo={letto.effettivo}
            volo={inAnalisi.volo}
            dataTesto={inAnalisi.data ? dataBreve(inAnalisi.data) : ""}
            passo={Math.min(3, Math.floor(passo / 2))}
          />
        </div>

        {/* ⚠️ I PASSI SONO RIGHE RIGIDE: dot + testo, e basta. Prima sotto
            il passo attivo compariva una riga di dettaglio che si montava e
            smontava, e il pallino attivo pulsava CAMBIANDO dimensione:
            ogni volta la riga cambiava altezza e spingeva su e giù tutte le
            altre. Da telefono il testo andava a capo e i pallini
            "traballavano forte" (Valerio, 15/08). Adesso il dettaglio vive
            in UN solo slot ad altezza fissa qui sotto, e il pallino pulsa
            solo di opacità, non di dimensione: le righe non si muovono. */}
        <ol className="mt-4 space-y-3">
          {TEATRO.passi.map((testo, i) => {
            const fatto = i < passo;
            const attivo = i === passo;
            return (
              <li key={testo} className="flex items-center gap-3.5">
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border transition-colors duration-300 ${
                    fatto
                      ? "border-verde bg-verde text-white"
                      : attivo
                        ? "border-verde/50 bg-white text-verde"
                        : "border-bordo bg-white text-fumo-2"
                  }`}
                >
                  {fatto ? (
                    <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
                      <path
                        d="m3.5 8.4 2.8 2.8 6-6.4"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : attivo ? (
                    <motion.span
                      className="h-2.5 w-2.5 rounded-full bg-verde"
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-bordo" />
                  )}
                </span>
                <span
                  className={`min-w-0 text-[15.5px] leading-snug transition-colors duration-300 ${
                    fatto || attivo ? "font-medium text-inchiostro" : "text-fumo-2"
                  }`}
                >
                  {testo}
                </span>
              </li>
            );
          })}
        </ol>

        {/* Lo slot del dettaglio: altezza fissa, allineato sotto il testo dei
            passi (spaziatore largo come il pallino). Cambia solo il testo,
            mai l'altezza. */}
        <div className="mt-3 flex min-h-[2.5rem] items-start gap-3.5">
          <span className="h-8 w-8 shrink-0" aria-hidden="true" />
          <AnimatePresence mode="wait">
            <motion.span
              key={Math.min(passo, TEATRO.dettagli.length - 1)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="block text-[13px] leading-snug text-fumo"
            >
              {TEATRO.dettagli[Math.min(passo, TEATRO.dettagli.length - 1)]}
            </motion.span>
          </AnimatePresence>
        </div>

        <p className="mt-3 border-t border-bordo/70 pt-3 text-[12.5px] leading-relaxed text-fumo">
          {TEATRO.nota}
        </p>
      </div>
    );
  }

  /* ───────────────────────────── il campo ──────────────────────────── */
  return (
    <div>
      {/* la carta d'imbarco: la strada più corta di tutte */}
      <div className="mb-4 rounded-2xl border border-menta bg-menta-tenue/70 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[14.5px] font-semibold text-verde-notte">{CHECK.carta.titolo}</p>
            <p className="mt-0.5 text-[13px] leading-snug text-verde-scuro">
              {CHECK.carta.testo}
            </p>
          </div>
          <button
            type="button"
            onClick={() => fotoRef.current?.click()}
            disabled={leggoCarta}
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-bottone bg-verde px-4 text-[14px] font-medium text-white transition-all duration-200 hover:bg-verde-scuro disabled:opacity-60"
          >
            {leggoCarta ? CHECK.carta.attesa : CHECK.carta.bottone}
          </button>
        </div>
        <p className="mt-2 text-[11.5px] text-verde-scuro/80">{CHECK.carta.privacy}</p>
        <input
          ref={fotoRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void leggiCarta(f);
            e.target.value = "";
          }}
        />
      </div>

      {daCarta && (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl border border-menta bg-menta-tenue px-4 py-3 text-[13.5px] leading-relaxed text-verde-notte"
        >
          {daCarta}
        </motion.p>
      )}

      {/* i due modi */}
      <div className="mb-4 flex gap-1 rounded-pillola bg-nebbia p-1">
        {(["tratta", "numero"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setModo(m);
              setErrore(null);
              setAvviso(null);
            }}
            aria-pressed={modo === m}
            /* ⚠️ 44 PUNTI SUL TELEFONO, e solo lì. Questo è il comando
               più toccato del sito: è la prima cosa che si preme per
               fare un check. Era alto 37, cioè sotto i 44 che Apple
               indica come minimo per un dito; da 640 punti in su si
               clicca col puntatore e resta com'era. */
            className={`min-h-11 flex-1 rounded-pillola py-2 text-[14px] font-medium transition-colors sm:min-h-0 ${
              modo === m ? "bg-white text-inchiostro shadow-sm" : "text-fumo hover:text-inchiostro"
            }`}
          >
            {CHECK.modo[m]}
          </button>
        ))}
      </div>

      {/* L'AVVISO CALMO, condiviso dai due modi. Prima viveva solo dentro
          il modo "numero", quindi un intoppo partito dalla ricerca per
          tratta non lo mostrava. Qui lo vedono tutti, e non è mai rosso:
          è una nota, non un allarme. Col guasto passeggero del server porta
          anche il bottone per riprovare. */}
      {avviso && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 rounded-xl border border-bordo bg-nebbia p-4"
        >
          {avviso.demo && (
            <span className="mb-2 inline-block rounded-pillola border border-bordo bg-white px-2.5 py-0.5 text-[11px] font-medium text-fumo">
              {COPY.comune.demo}
            </span>
          )}
          <p className="text-[13.5px] leading-relaxed text-inchiostro/85">{avviso.testo}</p>
          {avviso.riprova && (
            <button
              type="button"
              onClick={avviso.riprova}
              className="mt-3 inline-flex h-10 items-center rounded-bottone bg-verde px-4 text-[14px] font-medium text-white transition-colors hover:bg-verde-scuro"
            >
              {COPY.comune.riprova}
            </button>
          )}
        </motion.div>
      )}

      {modo === "tratta" ? (
        <form onSubmit={cercaTratta} noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoScalo
              id="sc-da"
              etichetta={CHECK.tratta.da.etichetta}
              segnaposto={CHECK.tratta.da.segnaposto}
              scelto={da}
              onScegli={setDa}
            />
            <CampoScalo
              id="sc-a"
              etichetta={CHECK.tratta.a.etichetta}
              segnaposto={CHECK.tratta.a.segnaposto}
              scelto={a}
              onScegli={setA}
            />
          </div>
          <div className="mt-4 flex flex-col gap-1.5">
            <label htmlFor="sc-giorno" className="text-[13px] font-medium text-inchiostro/70">
              {CHECK.tratta.data.etichetta}
            </label>
            {campoData("sc-giorno", giorno, setGiorno)}
            <p className="text-[12px] leading-snug text-fumo">{CHECK.tratta.data.aiuto}</p>
          </div>

          {errore && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-[14px] font-medium text-amber-700"
            >
              {errore}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={cercaInCorso}
            className="riflesso mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-bottone bg-verde text-[16.5px] font-medium text-white shadow-[0_12px_28px_-12px_rgba(6,122,70,.75),0_2px_0_0_rgba(255,255,255,.22)_inset] transition-all duration-300 hover:-translate-y-0.5 hover:bg-verde-scuro disabled:opacity-70"
          >
            {cercaInCorso ? TEATRO.titolo : CHECK.tratta.bottone}
            <span aria-hidden="true">→</span>
          </button>

          {/* l'elenco dei voli del giorno */}
          {trovati !== null && (
            <div className="mt-5">
              {trovati.length === 0 ? (
                <p className="rounded-xl border border-bordo bg-nebbia p-4 text-[13.5px] leading-relaxed text-inchiostro/85">
                  {CHECK.tratta.elenco.nessuno}
                </p>
              ) : (
                <>
                  <p className="font-display text-[19px] font-medium tracking-[-0.02em]">
                    {CHECK.tratta.elenco.titolo}
                  </p>
                  <p className="mt-0.5 text-[13px] text-fumo">{CHECK.tratta.elenco.sottotitolo}</p>
                  {trattaDemo && (
                    <p className="mt-2 text-[12px] font-medium text-fumo">
                      {CHECK.tratta.elenco.demo}
                    </p>
                  )}
                  <ul className="mt-3 space-y-2">
                    {trovati.map((v) => (
                      <li key={v.volo}>
                        <button
                          type="button"
                          onClick={() => void avvia(v.volo, giorno)}
                          className="flex w-full items-center gap-4 rounded-2xl border border-bordo bg-nebbia px-4 py-3 text-left transition-all duration-200 hover:border-verde/50 hover:bg-white"
                        >
                          <span className="w-16 shrink-0">
                            <span className="numeri block font-display text-[19px] font-medium tracking-[-0.02em]">
                              {v.partenzaOra || "--:--"}
                            </span>
                            <span className="block text-[11px] text-fumo-2">
                              {CHECK.tratta.elenco.arrivo} {v.arrivoOra || "--:--"}
                            </span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14.5px] font-medium text-inchiostro">
                              {v.compagnia ?? v.volo}
                            </span>
                            <span className="block text-[12.5px] text-fumo">
                              {v.volo}
                              {v.cancellato ? ` · ${CHECK.tratta.elenco.cancellato}` : ""}
                            </span>
                          </span>
                          <span aria-hidden="true" className="shrink-0 text-verde">
                            →
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </form>
      ) : (
        <form onSubmit={inviaNumero} noValidate>
          <div className="grid gap-4 sm:grid-cols-[1.15fr_1fr]">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sc-volo" className="text-[13px] font-medium text-inchiostro/70">
                {HERO.form.volo.etichetta}
              </label>
              <input
                id="sc-volo"
                name="volo"
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={volo}
                onChange={(e) => setVolo(e.target.value)}
                placeholder={HERO.form.volo.segnaposto}
                className="h-14 w-full min-w-0 rounded-bottone border border-bordo bg-white px-4 font-display text-[19px] font-medium tracking-[-0.01em] text-inchiostro outline-none transition-all duration-200 placeholder:font-sans placeholder:text-[16px] placeholder:font-normal placeholder:text-fumo-2 focus:border-verde/60 focus:ring-4 focus:ring-verde/12"
              />
              <p className="text-[12px] leading-snug text-fumo">{HERO.form.volo.aiuto}</p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="sc-data" className="text-[13px] font-medium text-inchiostro/70">
                {HERO.form.data.etichetta}
              </label>
              {campoData("sc-data", data, setData)}
              <p className="text-[12px] leading-snug text-fumo">{HERO.form.data.aiuto}</p>
            </div>
          </div>

          {errore && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 text-[14px] font-medium text-amber-700"
            >
              {errore}
            </motion.p>
          )}

          <button
            type="submit"
            className="riflesso mt-4 inline-flex h-14 w-full items-center justify-center gap-2 rounded-bottone bg-verde text-[16.5px] font-medium text-white shadow-[0_12px_28px_-12px_rgba(6,122,70,.75),0_2px_0_0_rgba(255,255,255,.22)_inset] transition-all duration-300 hover:-translate-y-0.5 hover:bg-verde-scuro hover:shadow-[0_18px_40px_-14px_rgba(6,122,70,.85),0_2px_0_0_rgba(255,255,255,.22)_inset]"
          >
            {HERO.form.bottone}
            <span aria-hidden="true">→</span>
          </button>
        </form>
      )}

      {/* La promessa del funnel vale in OGNI modo, non solo col numero:
          niente email, niente account. Come nell'app. */}
      <p className="mt-3 text-center text-[14.5px] text-fumo">{HERO.form.rassicurazione}</p>
    </div>
  );
}
