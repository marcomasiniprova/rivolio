import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { completaOpenAI, openAIAttivo } from "@/lib/ai/openai";
import type { Sciopero } from "./scioperi";

/**
 * L'AUTOPILOT DEGLI SCIOPERI (scelta di Valerio, 9/08: "io non devo mai
 * stare ad aggiungere gli scioperi, e questa decisione non deve mai
 * portare al non avere le cose aggiornate").
 *
 * COME FUNZIONA, in tre passi.
 * 1. Si scaricano le pagine pubbliche dove le agitazioni vengono
 *    annunciate (cruscotto del Ministero, Commissione di Garanzia, ENAC).
 * 2. Il testo va a un modello, che ne tira fuori una lista di date con
 *    settore e descrizione. È l'unico punto dove entra un modello, e fa
 *    trascrizione, non giudizio.
 * 3. Ogni riga passa da un CONTROLLO DETERMINISTICO qui sotto prima di
 *    entrare nel database. Quello che non passa, non entra.
 *
 * ⚠️ PERCHÉ QUI L'AI È AMMESSA, mentre nel verdetto non lo è mai.
 * Un errore di questo modulo non può far vendere una pratica sbagliata:
 * al massimo segna come "giorno di sciopero" un giorno che non lo era, e
 * il motore diventa PIÙ prudente (quel volo esce incerto, e un caso
 * incerto non si vende). L'errore va nella direzione di chi non paga, che
 * è la direzione in cui il progetto sbaglia sempre.
 *
 * ⚠️ COSA NON HO POTUTO PROVARE DA QUI. Il proxy di questo ambiente non
 * apre nessuna delle fonti: il primo giro vero avviene su Netlify. Per
 * questo il modulo NON fallisce in silenzio: quando non riesce a leggere
 * niente lo dice su Telegram, e c'è un indirizzo per lanciarlo a mano e
 * guardare cosa succede.
 *
 * Non si cancella MAI una riga: si inserisce e basta. L'indice unico
 * (data, tipo, descrizione) rende il giro ripetibile senza doppioni.
 */

/** Le pagine da cui si legge. Si prova a scaricarle tutte: basta che ne funzioni una. */
export const FONTI = [
  {
    nome: "Cruscotto scioperi del Ministero dei Trasporti",
    url: "https://scioperi.mit.gov.it/mit2/public/scioperi",
  },
  {
    nome: "Commissione di Garanzia Scioperi, elenco delle proclamazioni",
    url: "https://www.cgsse.it/web/guest/scioperi",
  },
  {
    nome: "ENAC, scioperi nel trasporto aereo",
    url: "https://www.enac.gov.it/trasporto-aereo/diritto-alla-mobilita/scioperi-nel-trasporto-aereo/",
  },
] as const;

const TIPI = [
  "personale_compagnia",
  "atc_esterno",
  "handling",
  "generale",
  "altro",
] as const;

export type Candidato = {
  data: string;
  settore: string;
  descrizione: string;
  compagnie: string[];
  tipo: Sciopero["tipo"];
  fonteUrl: string;
};

export type EsitoRaccolta = {
  ok: boolean;
  /** Quante pagine si sono aperte davvero. */
  fontiLette: number;
  /** Quante righe ha proposto il modello. */
  proposte: number;
  /** Quante hanno superato i controlli. */
  valide: number;
  /** Quante erano nuove e sono entrate. */
  inserite: number;
  /** Cosa è andato storto, in italiano. Vuoto se è filato tutto liscio. */
  problemi: string[];
};

/* ─────────────────────── i controlli deterministici ─────────────────── */

const GIORNO = 86_400_000;

/** Oggi in Italia, AAAA-MM-GG. */
function oggi(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Il filtro. Una riga entra solo se passa TUTTO.
 * Meglio perdere una data che scrivere una data inventata: una data
 * sbagliata finisce su una pagina pubblica col nostro nome sopra.
 */
export function validaCandidato(grezzo: unknown, quandoOggi = oggi()): Candidato | null {
  if (!grezzo || typeof grezzo !== "object") return null;
  const c = grezzo as Record<string, unknown>;

  const data = typeof c.data === "string" ? c.data.trim() : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return null;

  /* La data deve stare in una finestra credibile: un mese indietro (le
     proclamazioni si scoprono anche a cose fatte) e nove mesi avanti.
     Fuori da lì è quasi sempre un anno letto male. */
  const quando = Date.parse(`${data}T12:00:00Z`);
  const adesso = Date.parse(`${quandoOggi}T12:00:00Z`);
  if (!Number.isFinite(quando) || !Number.isFinite(adesso)) return null;
  if (quando < adesso - 31 * GIORNO) return null;
  if (quando > adesso + 275 * GIORNO) return null;

  const descrizione = typeof c.descrizione === "string" ? c.descrizione.trim() : "";
  if (descrizione.length < 20 || descrizione.length > 600) return null;

  const settore = typeof c.settore === "string" ? c.settore.trim() : "";
  if (settore.length < 3 || settore.length > 200) return null;

  /* Deve parlare di trasporto aereo: il cruscotto elenca anche treni,
     autobus e sanità, e a noi non servono. */
  const testo = `${settore} ${descrizione}`.toLowerCase();
  const parole = [
    "aere",
    "aerea",
    "aereo",
    "volo",
    "voli",
    "aeroport",
    "navigante",
    "handling",
    "assistenza a terra",
    "controllo del traffico",
    "controllori",
    "enav",
    "vettore",
  ];
  if (!parole.some((p) => testo.includes(p))) return null;

  const tipo = TIPI.includes(c.tipo as (typeof TIPI)[number])
    ? (c.tipo as Sciopero["tipo"])
    : "altro";

  /* Le compagnie sono codici IATA di due caratteri: il motore confronta
     quelli. Qualsiasi altra cosa si butta invece di inquinare la colonna. */
  const compagnie = Array.isArray(c.compagnie)
    ? [
        ...new Set(
          c.compagnie
            .filter((x): x is string => typeof x === "string")
            .map((x) => x.trim().toUpperCase())
            .filter((x) => /^[A-Z0-9]{2}$/.test(x)),
        ),
      ]
    : [];

  const fonteUrl = typeof c.fonteUrl === "string" ? c.fonteUrl.trim() : "";
  if (!/^https?:\/\//.test(fonteUrl)) return null;

  return { data, settore, descrizione, compagnie, tipo, fonteUrl };
}

/* ─────────────────────── lo scarico delle pagine ─────────────────────── */

/** Via i tag: al modello serve il testo, e l'HTML crudo brucia il contesto. */
function soloTesto(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

export async function scaricaFonti(
  timeoutMs = 6000,
): Promise<{ letti: { nome: string; url: string; testo: string }[]; problemi: string[] }> {
  const letti: { nome: string; url: string; testo: string }[] = [];
  const problemi: string[] = [];

  await Promise.all(
    FONTI.map(async (f) => {
      const stop = AbortSignal.timeout(timeoutMs);
      try {
        const r = await fetch(f.url, {
          signal: stop,
          headers: { "User-Agent": "RivolioBot/1.0 (+https://rivolio.it)" },
        });
        if (!r.ok) {
          problemi.push(`${f.nome}: risposta ${r.status}`);
          return;
        }
        const testo = soloTesto(await r.text()).slice(0, 24_000);
        if (testo.length < 200) {
          problemi.push(`${f.nome}: pagina vuota o costruita dal browser`);
          return;
        }
        letti.push({ nome: f.nome, url: f.url, testo });
      } catch (e) {
        problemi.push(`${f.nome}: non raggiungibile (${(e as Error).name})`);
      }
    }),
  );

  return { letti, problemi };
}

/* ─────────────────────── l'estrazione ─────────────────────── */

const MODELLO = "mistral-small-latest";

const ISTRUZIONI = `Sei un archivista. Dal testo che ti do estrai SOLO gli scioperi che riguardano il TRASPORTO AEREO in Italia (piloti, assistenti di volo, personale di terra, handling, controllori del traffico aereo, scioperi generali che includono il trasporto aereo).

Rispondi SOLO con un oggetto JSON in questa forma, senza commenti:
{"scioperi":[{"data":"AAAA-MM-GG","settore":"...","descrizione":"...","compagnie":["FR"],"tipo":"..."}]}

Regole rigide:
- "data": il giorno dello sciopero. Se dura piu' giorni, una voce per ogni giorno.
- "settore": chi si ferma, in poche parole (es. "trasporto aereo, personale navigante").
- "descrizione": una o due frasi in italiano con orario, sigle sindacali e societa' coinvolte se ci sono. Fra 20 e 400 caratteri.
- "compagnie": SOLO codici IATA di due caratteri (FR, U2, W6, AZ...). Se l'agitazione e' generale o riguarda i controllori, lascia la lista vuota.
- "tipo": uno fra personale_compagnia, atc_esterno, handling, generale, altro.
- Se una data non e' scritta chiaramente nel testo, NON inventarla: salta la voce.
- Se nel testo non c'e' nessuno sciopero aereo, rispondi {"scioperi":[]}.
- Non aggiungere scioperi che ricordi da altre fonti: solo quello che sta nel testo.`;

/** Chiede al modello di trascrivere. Torna la lista grezza, da validare. */
export async function estrai(
  testo: string,
): Promise<{ righe: unknown[]; problema?: string }> {
  /* Dal 27/08 il cervello è OpenAI (gpt-5.6-terra); Mistral resta solo da
     ripiego finché la sua chiave è configurata. Il filtro deterministico
     più a valle (validaCandidato) non cambia: un modello non può scrivere
     nel database uno sciopero che non passa i controlli. */
  if (openAIAttivo()) {
    const contenuto = await completaOpenAI({
      sistema: ISTRUZIONI,
      utente: testo,
      json: true,
      maxTokens: 2000,
      timeoutMs: 20_000,
    });
    if (!contenuto) return { righe: [], problema: "OpenAI non ha risposto" };
    try {
      const oggetto = JSON.parse(contenuto) as { scioperi?: unknown };
      const righe = Array.isArray(oggetto.scioperi) ? oggetto.scioperi : [];
      return { righe: righe.slice(0, 40) };
    } catch (e) {
      return { righe: [], problema: `Estrazione fallita: ${(e as Error).message}` };
    }
  }

  const chiave = process.env.MISTRAL_API_KEY;
  if (!chiave) return { righe: [], problema: "MISTRAL_API_KEY assente" };

  try {
    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(20_000),
      headers: {
        Authorization: `Bearer ${chiave}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODELLO,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: ISTRUZIONI },
          { role: "user", content: testo },
        ],
      }),
    });

    if (!r.ok) return { righe: [], problema: `Mistral ha risposto ${r.status}` };

    const dati = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const contenuto = dati.choices?.[0]?.message?.content ?? "";
    const oggetto = JSON.parse(contenuto) as { scioperi?: unknown };
    const righe = Array.isArray(oggetto.scioperi) ? oggetto.scioperi : [];
    /* Un modello che sbrocca e sputa duecento righe non deve poter
       riempire il database: si tagliano a quaranta, che è già tantissimo. */
    return { righe: righe.slice(0, 40) };
  } catch (e) {
    return { righe: [], problema: `Estrazione fallita: ${(e as Error).message}` };
  }
}

/* ─────────────────────── il giro completo ─────────────────────── */

export async function raccogliScioperi(): Promise<EsitoRaccolta> {
  const esito: EsitoRaccolta = {
    ok: false,
    fontiLette: 0,
    proposte: 0,
    valide: 0,
    inserite: 0,
    problemi: [],
  };

  const { letti, problemi } = await scaricaFonti();
  esito.fontiLette = letti.length;
  esito.problemi.push(...problemi);

  if (letti.length === 0) {
    esito.problemi.push("Nessuna fonte si è aperta: la lista non si aggiorna.");
    return esito;
  }

  const validi: Candidato[] = [];
  for (const f of letti) {
    const { righe, problema } = await estrai(f.testo);
    if (problema) esito.problemi.push(`${f.nome}: ${problema}`);
    esito.proposte += righe.length;
    for (const r of righe) {
      const c = validaCandidato({ ...(r as object), fonteUrl: f.url });
      if (c) validi.push(c);
    }
  }

  /* Stessa data e stessa descrizione da due fonti diverse: una sola riga. */
  const chiave = (c: Candidato) => `${c.data}|${c.tipo}|${c.descrizione}`;
  const unici = [...new Map(validi.map((c) => [chiave(c), c])).values()];
  esito.valide = unici.length;

  if (!SERVIZIO_ATTIVO) {
    esito.problemi.push("Database non configurato: niente è stato scritto.");
    return esito;
  }

  if (unici.length === 0) {
    /* Zero righe non è un guasto: nei periodi di franchigia non si sciopera.
       Il giro è andato bene, semplicemente non c'era niente da aggiungere. */
    esito.ok = true;
    return esito;
  }

  try {
    const { data, error } = await supabaseServizio()
      .from("scioperi")
      .upsert(
        unici.map((c) => ({
          data: c.data,
          settore: c.settore,
          descrizione: c.descrizione,
          compagnie: c.compagnie,
          tipo: c.tipo,
          fonte_url: c.fonteUrl,
        })),
        { onConflict: "data,tipo,descrizione", ignoreDuplicates: true },
      )
      .select("id");
    if (error) {
      esito.problemi.push(`Scrittura fallita: ${error.message}`);
      return esito;
    }
    esito.inserite = data?.length ?? 0;
    esito.ok = true;
    return esito;
  } catch (e) {
    esito.problemi.push(`Scrittura fallita: ${(e as Error).message}`);
    return esito;
  }
}
