import { after } from "next/server";
import { colonnaMancante } from "@/lib/supabase/colonne";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { AMBIENTE_PROVA } from "@/lib/ambiente";

/**
 * IL REGISTRO DI QUELLO CHE SUCCEDE (richiesta di Valerio, 11/08).
 *
 * A cosa serve: senza questo, per sapere come va il sito bisogna
 * indovinare. Con questo si vede quante persone arrivano, quante fanno
 * un'analisi, quante sbattono contro il muro e quante pagano. È la
 * differenza fra migliorare e sperare.
 *
 * ⚠️ COSA NON REGISTRA, ED È UNA SCELTA.
 * Non l'indirizzo IP intero, non l'impronta del browser, nessun modo di
 * riconoscere la stessa persona domani. Registra FATTI, non persone: se
 * un domani qualcuno chiede «cosa avete su di me», la risposta onesta è
 * «niente che ti riguardi», e non c'è un archivio scomodo da consegnare.
 *
 * ⚠️ COSA REGISTRA IN PIÙ, e va scritto nella privacy: **da dove arriva**
 * il visitatore (il sito o il video che l'ha mandato) e **da che paese**.
 * Sono i due dati che dicono quale video funziona, e senza quelli la
 * distribuzione si fa alla cieca. Il paese arriva già da Netlify, non lo
 * calcoliamo noi da un indirizzo.
 *
 * ⚠️ NON DEVE MAI ROMPERE NIENTE. Registrare è un di più: se il database
 * non risponde o la tabella non c'è ancora, si scrive un avviso nei log
 * e si va avanti. Un check che fallisce perché non è riuscito a
 * registrarsi sarebbe il modo più stupido di perdere una vendita.
 */

/** I fatti che vale la pena contare. Nomi corti: finiscono in una tabella. */
export type TipoEvento =
  | "visita" // qualcuno è arrivato sulla landing
  | "check" // ha lanciato un'analisi
  | "muro" // ha visto il muro del pagamento
  | "sbloccato" // ha pagato l'analisi
  | "verdetto" // ha ricevuto un verdetto (con l'esito)
  | "pratica" // ha aperto una pratica
  | "pagato" // ha pagato la pratica: è l'unico che vale soldi
  | "iscritto" // si è iscritto all'Osservatorio
  | "invito" // ha premuto "invita un amico" (TIENITELI, il passaparola)
  | "guasto"; // qualcosa non ha funzionato

export type Evento = {
  tipo: TipoEvento;
  /** Il volo, quando c'entra. Non identifica nessuno: è un numero di volo. */
  volo?: string | null;
  /** L'esito del verdetto, per capire quanti casi reggono. */
  esito?: string | null;
  /** Gli euro, quando ce ne sono. */
  importo?: number | null;
  /** Da dove arriva: il dominio che l'ha mandato, mai l'indirizzo pieno. */
  provenienza?: string | null;
  /** Il paese, come lo dice Netlify. Due lettere, niente di più. */
  paese?: string | null;
  /** Qualsiasi altra cosa utile, senza dati personali. */
  extra?: Record<string, unknown> | null;
};

/**
 * Da dove arriva il visitatore, ridotto al SOLO dominio.
 *
 * `https://www.tiktok.com/@tizio/video/123` diventa `tiktok.com`. Il
 * percorso pieno direbbe quale video ha guardato quella persona: è un
 * dato in più su di lei che a noi non serve, perché per capire cosa
 * funziona basta sapere che è arrivata da TikTok.
 */
/**
 * I NOSTRI HOST, scritti a mano più quelli dell'ambiente.
 *
 * 🔴 Valerio, 16/08: «perché tutti i miei log dicono "arrivato da
 * 6a81...--rivolio.netlify.app"? indirizzi strani, mica dovrebbe essere
 * rivolio.it?». Erano le ANTEPRIME di Netlify: ogni deploy ne pubblica una
 * pubblica, e i bot le visitano. Erano già filtrate, MA solo se
 * `NEXT_PUBLIC_SITO` o `URL` erano impostate. La checklist del dominio dice
 * di togliere `NEXT_PUBLIC_SITO`, e a runtime `URL` di Netlify non è
 * garantita: senza nessuna delle due, il filtro non partiva e le anteprime
 * tornavano nei log come "traffico". Cioè il sito che naviga sé stesso, il
 * numero più inutile del cruscotto.
 *
 * Adesso i nostri host stanno anche SCRITTI A MANO: così il filtro vale
 * sempre, variabili o non variabili. `rivolio.it` è già qui per il giorno
 * del dominio.
 */
const NOSTRE_RADICI_FISSE = ["rivolio.it", "rivolio.netlify.app"];

/** Vero se questo host è nostro: il dominio, un suo sottodominio, o
 *  un'anteprima di deploy (`<hash>--radice`). */
export function èNostroHost(host: string): boolean {
  const h = host.replace(/^www\./, "");
  const radici = [
    ...NOSTRE_RADICI_FISSE,
    ...[process.env.NEXT_PUBLIC_SITO, process.env.URL]
      .filter((v): v is string => Boolean(v))
      .map((s) => s.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "")),
  ];
  return radici.some((r) => {
    /* Le anteprime hanno il nome del sito dopo un "--"; i rami un
       sottodominio. Tutti e due finiscono con la radice. */
    const radice = r.replace(/^[^.]*--/, "");
    return h === r || h === radice || h.endsWith(`--${radice}`) || h.endsWith(`.${radice}`);
  });
}

export function soloIlDominio(referer: string | null | undefined): string | null {
  if (!referer) return null;
  try {
    const h = new URL(referer).hostname.replace(/^www\./, "");
    /* Chi arriva da una nostra pagina (dominio vero o anteprima) non è una
       "provenienza": è navigazione interna, e contarla gonfierebbe i
       numeri. */
    if (èNostroHost(h)) return null;
    return h.slice(0, 80);
  } catch {
    return null;
  }
}

/**
 * I MOTORI AI, normalizzati a un'etichetta pulita (GEO/AIO, 17/08).
 *
 * chat.openai.com e chatgpt.com sono lo stesso posto: senza normalizzare
 * conterebbero separati, e nel cruscotto "da dove arriva" non si capirebbe
 * quanta gente manda ChatGPT. Serve a misurare il marketing GEO: se le
 * pagine per compagnia funzionano, qui cresce il numero da "chatgpt" e
 * "perplexity".
 */
const SORGENTI_AI: Record<string, string> = {
  "chatgpt.com": "chatgpt",
  "chat.openai.com": "chatgpt",
  "openai.com": "chatgpt",
  "perplexity.ai": "perplexity",
  "gemini.google.com": "gemini",
  "bard.google.com": "gemini",
  "copilot.microsoft.com": "copilot",
  "claude.ai": "claude",
  "you.com": "you",
};

/** Se questa provenienza è un motore AI, l'etichetta pulita; altrimenti null. */
export function sorgenteAI(provenienza: string | null | undefined): string | null {
  if (!provenienza) return null;
  const d = provenienza.toLowerCase().replace(/^www\./, "");
  if (SORGENTI_AI[d]) return SORGENTI_AI[d];
  // anche i valori utm scritti a mano ("chatgpt.com", "perplexity") o i
  // sottodomini: se il nome contiene il motore, si riconosce.
  for (const nome of ["chatgpt", "perplexity", "gemini", "copilot", "claude"]) {
    if (d.includes(nome)) return nome;
  }
  return null;
}

/**
 * La provenienza di una visita, con la regola giusta per il GEO.
 *
 * `utm_source` VINCE sul referer: è il segnale esplicito. I motori AI
 * spesso non mandano il referer (o lo tolgono per privacy), e i link che
 * metti tu su Reddit o nella newsletter li tagghi con utm. Se c'è l'utm,
 * quella è la verità; se no, si ripiega sul dominio del referer.
 */
export function provenienzaVisita(
  referer: string | null | undefined,
  utm: string | null | undefined,
): string | null {
  const daUtm = typeof utm === "string" && utm.trim() ? utm.trim().toLowerCase().slice(0, 80) : null;
  if (daUtm) return daUtm;
  return soloIlDominio(referer);
}

/** Il paese, come lo dichiara Netlify. Nessun calcolo nostro sull'IP. */
export function paeseDi(req: Request): string | null {
  const c = req.headers.get("x-nf-geo-country") ?? req.headers.get("x-country");
  return c && /^[A-Za-z]{2}$/.test(c) ? c.toUpperCase() : null;
}

/**
 * Fai questa cosa DOPO aver risposto all'utente.
 *
 * ⚠️ È la differenza fra un registro che costa zero e un registro che
 * rallenta il sito. Scrivere una riga nel database prima di rispondere
 * aggiungerebbe qualche decina di millesimi a OGNI check; `after` di Next
 * fa girare il lavoro quando la risposta è già partita, quindi l'utente
 * non aspetta niente. Vale anche per le notifiche: mandare un messaggio
 * su Telegram può prendere secondi, e nessuno deve restare fermo per
 * quello.
 *
 * Fuori da una richiesta (uno script, una prova) `after` non esiste: in
 * quel caso si esegue e basta, senza aspettare.
 */
export function dopo(lavoro: () => Promise<void>): void {
  try {
    after(lavoro);
  } catch {
    void lavoro().catch((e) => console.error("[eventi] lavoro non eseguito:", e));
  }
}

/**
 * Scrive un fatto nel registro. Non lancia mai e non fa aspettare
 * nessuno: chi la chiama può anche non attenderla.
 */
export async function registra(e: Evento): Promise<void> {
  return registraMolti([e]);
}

/**
 * Scrive più fatti in una chiamata sola.
 *
 * Due righe in un viaggio invece di due viaggi: durante un picco la
 * differenza fra un insert e due è il doppio delle connessioni aperte
 * verso il database per ogni singolo check.
 */
export async function registraMolti(eventi: Evento[]): Promise<void> {
  /* 🔴 IL GEMELLO NON SPORCA I NUMERI DEL SITO VERO (27/08): le sue visite e
     i suoi check di prova non entrano nel registro condiviso, se no il
     pannello di produzione conterebbe il traffico di quando provo io. In
     produzione AMBIENTE_PROVA è falso e si registra tutto come sempre. */
  if (AMBIENTE_PROVA) return;
  if (!SERVIZIO_ATTIVO || eventi.length === 0) return;
  try {
    const { error } = await supabaseServizio()
      .from("eventi")
      .insert(
        eventi.map((e) => ({
          tipo: e.tipo,
          volo: e.volo ?? null,
          esito: e.esito ?? null,
          importo: e.importo ?? null,
          provenienza: e.provenienza ?? null,
          paese: e.paese ?? null,
          extra: e.extra ?? null,
        })),
      );
    if (error && !colonnaMancante(error.message)) {
      /* Se la tabella non c'è ancora (migrazione non applicata) il
         messaggio lo dice: non è un guasto, è un "non ancora". */
      const nonEsiste = /does not exist|schema cache/i.test(error.message);
      if (!nonEsiste) console.error("[eventi] non registrato:", error.message);
    }
  } catch (err) {
    console.error("[eventi] non registrato:", err);
  }
}

/** Comodo: registra prendendo provenienza e paese dalla richiesta. */
export async function registraDa(req: Request, ...eventi: Evento[]): Promise<void> {
  const da = soloIlDominio(req.headers.get("referer"));
  const paese = paeseDi(req);
  return registraMolti(
    eventi.map((e) => ({
      ...e,
      provenienza: e.provenienza ?? da,
      paese: e.paese ?? paese,
    })),
  );
}

/**
 * Quello che si usa nelle rotte: registra DOPO aver risposto.
 *
 * Provenienza e paese si leggono subito (la richiesta serve adesso), la
 * scrittura avviene dopo. Chi chiama non aspetta e non deve ricordarsi
 * di gestire un errore: qui dentro non ne esce nessuno.
 */
export function traccia(req: Request, ...eventi: Evento[]): void {
  const da = soloIlDominio(req.headers.get("referer"));
  const paese = paeseDi(req);
  const righe = eventi.map((e) => ({
    ...e,
    provenienza: e.provenienza ?? da,
    paese: e.paese ?? paese,
  }));
  dopo(() => registraMolti(righe));
}
