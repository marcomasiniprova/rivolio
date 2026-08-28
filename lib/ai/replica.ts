import { RIFIUTI, schedaRifiuto, type MotivoRifiuto } from "../pratiche/rifiuto";
import type { Dossier } from "../pratiche/dossier";
import { dossierInParole } from "../pratiche/dossier";
import { modoSicuroAttivo } from "../motore/modo-sicuro";
import { completaOpenAI, openAIAttivo } from "./openai";

/**
 * L'AI CHE LEGGE LA RISPOSTA DELLA COMPAGNIA E SCRIVE LA CONTRO-RISPOSTA.
 *
 * 🔴 Valerio, 13/08: «nel box "non hanno risposto proprio" non si può
 * fare la analisi bella figa con AI, tipo carichi la foto della risposta,
 * lo screenshot, o scrivi letteralmente alla AI e ti dà la contro
 * risposta? è tutto così rigido con domande predefinite».
 *
 * Scelta col popup del 13/08: **l'AI legge, capisce e scrive il pezzo del
 * caso; lo scheletro legale resta nostro.** Cioè:
 * - riconosce da sola quale degli otto motivi è (l'utente non deve più
 *   scegliere da una lista, anche se la lista resta come ripiego);
 * - tira fuori i FATTI che la compagnia dichiara: la data, l'evento,
 *   l'orario, il numero di pratica, chi ha firmato;
 * - scrive il paragrafo che risponde **a quello che hanno scritto loro**,
 *   non a un motivo generico.
 *
 * ⚠️ E POI C'È IL CANCELLO, che è la parte importante di questo file.
 * La regola di casa dice che l'AI non decide mai. Qui l'AI scrive, e la
 * lettera la manda il cliente col nostro nome sopra: una sentenza
 * inventata è una figuraccia sua nel punto esatto in cui ha ragione.
 * Quindi tutto quello che esce dal modello passa da `controlla()`, che è
 * deterministico e boccia senza pietà:
 * 1. può citare SOLO le sentenze e gli articoli che stanno già nel nostro
 *    archivio verificato (lib/pratiche/rifiuto.ts). Una causa che non è
 *    in quella lista fa buttare via il paragrafo;
 * 2. non può scrivere cifre in euro diverse da quelle del fascicolo:
 *    è il modo più facile di promettere a un cliente più di quanto gli
 *    spetta;
 * 3. non può inventare un motivo fuori dagli otto;
 * 4. se qualcosa non passa, non si "corregge": si torna al paragrafo
 *    fisso, che è verificato. Meglio una replica meno brillante che una
 *    replica che si smonta da sola.
 *
 * ⚠️ E L'ONERE DELLA PROVA RESTA NOSTRO E FISSO. Il paragrafo dell'art. 5
 * par. 3 (le due gambe) è il cuore giuridico della replica: non lo tocca
 * il modello, viene aggiunto dopo, uguale per tutti.
 */

/* ⚠️ IL MODELLO GRANDE, non il piccolo (scelta di Valerio, 14/08:
   «l'AI non capisce le risposte»). Leggere una email di rifiuto scritta
   di fretta, riconoscere quale degli otto motivi è, ed estrarre i fatti
   che loro dichiarano è un lavoro di comprensione, non di forma: il
   modello piccolo mollava e diceva «non ho capito». Costa qualche
   centesimo in più a lettura, e sono poche letture per pratica: è il
   punto dove sbagliare fa la figura peggiore, perché la replica la manda
   il cliente col nostro nome sopra. Il cancello deterministico più sotto
   resta identico: un modello più bravo non ha più libertà di inventare. */
const MODELLO = "mistral-large-latest";

/**
 * Legge la risposta della compagnia col modello e torna il JSON grezzo (o
 * null). Dal 27/08 il cervello è OpenAI (gpt-5.6-terra); se manca la chiave
 * OpenAI si ripiega su Mistral finché la sua chiave è configurata. Rete di
 * sicurezza per il passaggio: sparirà quando Mistral verrà tolto. Il
 * cancello `controlla()` più sotto NON cambia: vale per qualunque modello.
 */
async function leggiRispostaColModello(
  sistema: string,
  utente: string,
): Promise<string | null> {
  if (openAIAttivo()) {
    /* 15s: sta sotto il tetto della funzione Netlify (26s), così se il
       modello è lento la controrisposta ripiega sul testo fisso invece di
       far cadere la funzione. La lettera fissa è comunque corretta. */
    return completaOpenAI({ sistema, utente, json: true, maxTokens: 1500, timeoutMs: 15_000 });
  }
  const chiave = process.env.MISTRAL_API_KEY;
  if (!chiave) return null;
  try {
    const r = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chiave}`,
      },
      body: JSON.stringify({
        model: MODELLO,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: sistema },
          { role: "user", content: utente },
        ],
      }),
      /* Ripiego più corto del primo tentativo: OpenAI (15s) + Mistral (9s)
         = 24s, dentro i 26s della funzione. */
      signal: AbortSignal.timeout(9_000),
    });
    if (!r.ok) {
      console.warn("[replica] Mistral ha risposto", r.status);
      return null;
    }
    const dati = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return dati.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.warn("[replica] analisi fallita:", e);
    return null;
  }
}

export type AnalisiRifiuto = {
  /** Il motivo riconosciuto, fra gli otto. */
  motivo: MotivoRifiuto;
  /** Quanto è sicuro il riconoscimento: sotto "alta" si chiede all'utente. */
  sicurezza: "alta" | "media" | "bassa";
  /** I fatti che la compagnia dichiara, uno per riga, come li ha scritti. */
  fattiLoro: string[];
  /**
   * Il paragrafo su misura, già controllato. Null quando il controllo
   * l'ha bocciato: in quel caso vale la replica fissa del motivo.
   */
  paragrafo: string | null;
  /** Perché il paragrafo è stato bocciato, se lo è stato. Per i log. */
  scartato: string | null;
  /** Una riga per l'utente: cosa abbiamo capito, in italiano. */
  riassunto: string;
};

/* ------------------------------ il cancello ZERO: è la tua risposta? */

/**
 * 🔴 LA RISPOSTA INCOLLATA PARLA DAVVERO DI QUESTO CASO?
 *
 * Valerio, 13/08: ha incollato dentro la pratica del volo **ZZ400** la
 * risposta di un altro volo (**FR1234**, con un altro ritardo e un altro
 * numero di reclamo) e il sistema ha scritto la replica come se niente
 * fosse: motivo riconosciuto, fatti estratti, paragrafo pronto. «Il mio
 * fascicolo non lo ha letto veramente.»
 *
 * Aveva ragione, e il buco era strutturale: `controlla()` guardava le
 * sentenze, le cifre e il tono del testo GENERATO, ma nessuno guardava se
 * il testo IN INGRESSO fosse del caso giusto. Il risultato è la cosa
 * peggiore che possiamo mandare a una compagnia: una replica che discute
 * fatti mai avvenuti su quel volo. Loro rispondono con una riga, e il
 * cliente ha pagato per farsi respingere.
 *
 * Questo controllo è **deterministico e viene prima del modello**: non si
 * spendono soldi di API per analizzare l'email sbagliata, e soprattutto
 * l'AI non ha modo di "aggiustare" un caso che non torna.
 *
 * ⚠️ COME È TARATO, e perché così. Blocca **solo quando il testo nomina
 * dei voli e nessuno è il tuo**. Se l'email non nomina nessun volo (ne
 * arrivano tante così: «Gentile cliente, la sua richiesta è stata
 * respinta») passa, perché non c'è niente che la smentisca. Sbagliare
 * dalla parte di chi blocca troppo vorrebbe dire fermare un cliente che
 * ha ragione, e quello è il difetto che stiamo riparando, non uno nuovo.
 */
export type EsitoCoerenza =
  | { ok: true }
  | {
      ok: false;
      /** Il volo che compare nella loro risposta, come l'hanno scritto. */
      voloTrovato: string;
      /** Il volo di questa pratica. */
      voloAtteso: string;
      /** La frase da mostrare all'utente. */
      messaggio: string;
    };

/**
 * I codici di volo dentro un testo.
 *
 * 🔴 LA PRIMA VERSIONE HA PRODOTTO UN FALSO ALLARME SUBITO, e Valerio
 * l'ha visto il 13/08: ha scritto «NON FACCIAMO IL RIMBORSO PERCHE IL
 * VOLO ERA **DI 2** ORE E 50 MINUTI IN RITARDO», e il sistema ha
 * risposto «questa risposta parla del volo DI2». In quel testo un volo
 * non c'era: c'era la preposizione «di» seguita da un numero.
 *
 * Il difetto era la regola. Due caratteri qualsiasi più delle cifre
 * pesca mezzo vocabolario italiano: «di 2», «in 3», «la 5», «al 10». E
 * un falso allarme qui è più grave del difetto che stiamo riparando,
 * perché blocca un cliente che ha incollato la cosa giusta.
 *
 * Adesso un codice si riconosce in due soli modi, tutti e due stretti:
 * 1. **attaccato**, con almeno due cifre: «FR1234», «U21234». Nessuna
 *    preposizione italiana si scrive attaccata a un numero;
 * 2. **preceduto dalla parola volo** (o flight, vuelo, vol, flug), che è
 *    come lo scrive una compagnia quando lo scrive davvero.
 * Tutto il resto non è un volo e non fa scattare niente.
 */
const ATTACCATO = /(?<![A-Z0-9/-])([A-Z]{2}|[A-Z]\d|\d[A-Z])(\d{2,4})(?![\dA-Z/-])/g;
const DOPO_LA_PAROLA =
  /(?:VOLO|VOLI|FLIGHT|VUELO|VOL|FLUG)\s*(?:N\.?|NUMERO|NUMBER)?\s*:?\s*([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})(?![\dA-Z/-])/g;

/** Sigle che compaiono nelle email e voli non sono. */
const NON_VOLI = new Set(["CE", "UE", "EU", "EC", "IT", "SR", "PA", "RE", "ID", "OK", "NO", "SI"]);

function voliNominati(testo: string): string[] {
  const su = testo.toUpperCase();
  const trovati = new Set<string>();
  for (const re of [ATTACCATO, DOPO_LA_PAROLA]) {
    for (const m of su.matchAll(re)) {
      const compagnia = m[1];
      if (NON_VOLI.has(compagnia)) continue;
      trovati.add(`${compagnia}${m[2].replace(/^0+/, "")}`);
    }
  }
  return [...trovati];
}

/** "FR 1234", "fr1234", "FR01234" diventano tutti "FR1234". */
function normalizzaVolo(v: string | null | undefined): string | null {
  if (!v) return null;
  const m = /^([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?0*(\d{1,4})$/.exec(v.trim().toUpperCase());
  return m ? `${m[1]}${m[2]}` : null;
}

export function coerenzaRisposta(testo: string, d: Dossier): EsitoCoerenza {
  const nostro = normalizzaVolo(d.volo.numero);
  if (!nostro) return { ok: true };

  const nominati = voliNominati(testo);
  if (nominati.length === 0) return { ok: true };
  if (nominati.includes(nostro)) return { ok: true };

  /* Da qui in poi: la loro risposta nomina almeno un volo, e nessuno è il
     nostro. Non si prova a indovinare: si dice cosa non torna e ci si
     ferma. */
  const voloTrovato = nominati[0];
  return {
    ok: false,
    voloTrovato,
    voloAtteso: nostro,
    messaggio: `Questa risposta parla del volo ${voloTrovato}, ma questa pratica è del volo ${nostro}. Controlla di aver incollato l'email giusta: una replica costruita sui fatti di un altro volo la compagnia la respinge con una riga.`,
  };
}

/* ------------------------------------------------- il cancello, prima */

/** Tutte le fonti che è lecito citare: sono quelle che abbiamo verificato. */
export function fontiAmmesse(): string[] {
  const insieme = new Set<string>();
  for (const r of RIFIUTI) for (const rif of r.riferimenti) insieme.add(rif);
  return [...insieme];
}

/** Le cause europee ammesse, nella forma "C-549/07". */
function causeAmmesse(): Set<string> {
  const insieme = new Set<string>();
  for (const rif of fontiAmmesse()) {
    for (const m of rif.matchAll(/C-\d+\/\d+/g)) insieme.add(m[0]);
  }
  return insieme;
}

/** Gli articoli del Regolamento che citiamo davvero. */
const ARTICOLI_AMMESSI = new Set(["3", "4", "5", "6", "7", "8", "9", "14", "16"]);

export type EsitoControllo = { ok: true } | { ok: false; motivo: string };

/**
 * Il controllo deterministico sul testo generato. Nessuna AI qui dentro.
 *
 * ⚠️ È SCRITTO PER BOCCIARE, non per correggere. Un testo quasi giusto in
 * una lettera legale è peggio di un testo generico: sembra più forte e si
 * smonta al primo controllo di chi la riceve.
 */
export function controlla(
  paragrafo: string,
  d: Dossier,
): EsitoControllo {
  const t = paragrafo.trim();
  if (t.length < 80) return { ok: false, motivo: "troppo corto per dire qualcosa" };
  if (t.length > 2200) return { ok: false, motivo: "troppo lungo" };

  /* 1. LE SENTENZE. Ogni causa nominata deve stare nel nostro archivio. */
  const ammesse = causeAmmesse();
  for (const m of t.matchAll(/C-\s?\d+\/\d+/g)) {
    const causa = m[0].replace(/\s/g, "");
    if (!ammesse.has(causa)) {
      return { ok: false, motivo: `cita una causa fuori archivio: ${causa}` };
    }
  }
  /* Nominare una corte senza dare gli estremi è il modo elegante di
     inventarsi una sentenza: se parla di una pronuncia, deve dire quale. */
  if (/\b(sentenz|pronunci|cassazion|giurisprudenz)/i.test(t) && !/C-\s?\d+\/\d+/.test(t)) {
    return { ok: false, motivo: "parla di una sentenza senza dire quale" };
  }
  if (/\bcassazion/i.test(t)) {
    return { ok: false, motivo: "cita la Cassazione, che non è nel nostro archivio" };
  }

  /* 2. GLI ARTICOLI. Stesso ragionamento delle sentenze. */
  for (const m of t.matchAll(/articol[oi]\s+(\d+)/gi)) {
    if (!ARTICOLI_AMMESSI.has(m[1])) {
      return { ok: false, motivo: `cita l'articolo ${m[1]}, che non usiamo` };
    }
  }

  /* 3. I SOLDI. Le uniche cifre lecite sono quelle del fascicolo. */
  const leciti = new Set<string>();
  for (const v of [d.diritto.fascia, d.diritto.totale]) {
    if (v !== null) leciti.add(String(v));
  }
  // Le fasce dell'art. 7 sono fatti di legge, non promesse nostre.
  for (const v of ["250", "400", "600"]) leciti.add(v);
  /* ⚠️ La cifra si prende INTERA, non a pezzi. La prima versione di
     questa espressione leggeva "1200 euro" come "200 euro", quindi
     bocciava (bene) ma spiegava male: nei log e nel messaggio compariva
     un numero che nel testo non c'era. Su un controllo che serve a
     capire cosa ha inventato il modello, dire il numero sbagliato è
     mezzo controllo. Trovato da una prova. */
  for (const m of t.matchAll(/(\d[\d.\s]{0,12}\d|\d)(?:,\d{2})?\s*(?:euro|€|EUR)/gi)) {
    const nudo = m[1].replace(/[.\s]/g, "");
    if (!leciti.has(nudo)) {
      return { ok: false, motivo: `scrive una cifra che non è nel fascicolo: ${m[1].trim()}` };
    }
  }

  /* 4. NON SI FIRMA E NON SI PROMETTE. Il paragrafo entra in mezzo a una
     lettera che ha già la sua chiusura e la sua nota di trasparenza. */
  if (/cordiali salut|distinti salut/i.test(t)) {
    return { ok: false, motivo: "contiene una chiusura: è un paragrafo, non una lettera" };
  }
  if (/\b(avvocat|studio legale|vi assicur|garantiam|vincer[eò]|sicuramente otterr)/i.test(t)) {
    return { ok: false, motivo: "promette un esito o si spaccia per uno studio legale" };
  }
  return { ok: true };
}

/* --------------------------------------------------------- il modello */

const ISTRUZIONI = `Sei l'assistente di Rivolio, un servizio italiano che aiuta i passeggeri a ottenere la compensazione del Regolamento (CE) 261/2004. Ricevi il fascicolo di un caso e la risposta con cui la compagnia aerea ha negato la compensazione. Devi produrre SOLO un oggetto JSON.

Campi richiesti:
- "motivo": uno esatto fra questi otto codici, quello che descrive la loro risposta:
${RIFIUTI.map((r) => `  - "${r.motivo}": ${r.aiuto}`).join("\n")}
- "sicurezza": "alta" se la risposta dice chiaramente il motivo, "media" se lo lascia intuire, "bassa" se non si capisce.
  ⚠️ Il campo "motivo" NON è mai vuoto: se hai un dubbio scegli comunque il codice PIÙ VICINO fra gli otto e metti "sicurezza": "bassa". "silenzio" si usa SOLO se il testo non è affatto una risposta della compagnia (una nota tua, una pagina bianca): se c'è una qualunque risposta, il motivo è uno degli altri sette.
- "fattiLoro": array di stringhe brevi, i fatti CHE LORO DICHIARANO (date, orari, eventi, numeri di pratica, nomi). Solo quello che c'è scritto nella loro risposta. Array vuoto se non dichiarano nulla di concreto.
- "riassunto": UNA frase in italiano, massimo 25 parole, che spiega al passeggero cosa gli hanno risposto. Dai del tu.
- "paragrafo": il paragrafo centrale della replica, in italiano, dal punto di vista del PASSEGGERO che scrive alla compagnia ("la vostra risposta...", "vi chiedo...").

REGOLE INDEROGABILI per "paragrafo":
1. Rispondi ai fatti specifici che loro hanno scritto, citandoli. È l'unica ragione per cui esisti: un testo generico ce l'abbiamo già.
2. Puoi citare SOLO queste fonti, con questi identificativi esatti, e solo se pertinenti:
${fontiAmmesse().map((f) => `   - ${f}`).join("\n")}
3. Non nominare mai altre sentenze, altre corti, la Cassazione, o articoli diversi da quelli sopra. Se non sei sicuro di una fonte, non citarla: scrivi l'argomento senza riferimenti.
4. Non scrivere importi in euro diversi da quelli del fascicolo o dalle fasce di legge (250, 400, 600).
5. Non promettere esiti, non dire di essere un avvocato, non minacciare.
6. Non scrivere saluti né firme: è un paragrafo in mezzo a una lettera.
7. Da 120 a 300 parole. Tono fermo, professionale, senza aggettivi.
8. Non usare mai il trattino lungo. Usa punti e virgole.

USO DEL METEO. Se nel fascicolo c'è una sezione "METEO VERIFICATO" con i dati reali e la compagnia dà la colpa al maltempo, servitene nel paragrafo: cita le condizioni reali (precipitazioni, neve, raffiche, nubi basse) all'orario del volo. Se erano normali, dillo chiaramente: è la prova che la scusa non regge. Se invece confermano il maltempo, non insistere su di esse; ricorda che spetta comunque al vettore provare il nesso con QUESTO volo e le misure adottate. I numeri del meteo (mm, km/h, gradi, percentuali) NON sono importi in euro: puoi e devi citarli.

Se la risposta della compagnia non si capisce, metti "sicurezza": "bassa" e "paragrafo": "".`;

type RispostaModello = {
  motivo?: unknown;
  sicurezza?: unknown;
  fattiLoro?: unknown;
  riassunto?: unknown;
  paragrafo?: unknown;
};

const MOTIVI = new Set(RIFIUTI.map((r) => r.motivo));

function stringhe(v: unknown, max: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .map((x) => x.trim().slice(0, 300))
    .slice(0, max);
}

/**
 * Chiede al modello di leggere la risposta della compagnia.
 * Torna `null` se il modello non è disponibile o non risponde: chi chiama
 * ripiega sulla scelta a lista, che funziona da sempre.
 */
export async function analizzaRifiuto(
  dossier: Dossier,
  rispostaCompagnia: string,
  /* Il meteo verificato ai due estremi del volo (lib/meteo meteoDelVolo),
     già pronto in prosa. Null = niente meteo (modulo spento o non letto):
     l'analisi procede identica, senza la sezione. */
  meteo: string | null = null,
): Promise<AnalisiRifiuto | null> {
  /* 🔴 MODO SICURO: con l'interruttore d'emergenza acceso l'AI non scrive.
     Si torna al testo fisso verificato (chi chiama, davanti a null, usa la
     scelta a lista e la replica standard del motivo), che è la stessa strada
     di quando il modello non risponde. Il cliente continua a lavorare la sua
     pratica: cambia solo che il paragrafo su misura resta quello fisso. */
  if (await modoSicuroAttivo()) return null;

  const testo = rispostaCompagnia.trim();
  if (testo.length < 20) return null;

  const utente = `# Il fascicolo del caso\n${dossierInParole(dossier)}${meteo ? `\n\n# METEO VERIFICATO (dato reale, archivio ufficiale)\n${meteo}` : ""}\n\n# La risposta della compagnia, parola per parola\n"""\n${testo.slice(0, 12000)}\n"""`;

  const contenuto = await leggiRispostaColModello(ISTRUZIONI, utente);
  if (!contenuto) return null;
  let grezzo: RispostaModello;
  try {
    grezzo = JSON.parse(contenuto) as RispostaModello;
  } catch {
    return null;
  }

  /* ---- da qui in poi non ci si fida più di niente ---- */

  const motivo =
    typeof grezzo.motivo === "string" && MOTIVI.has(grezzo.motivo as MotivoRifiuto)
      ? (grezzo.motivo as MotivoRifiuto)
      : null;
  if (!motivo) return null;

  const sicurezza =
    grezzo.sicurezza === "alta" || grezzo.sicurezza === "media" ? grezzo.sicurezza : "bassa";

  const paragrafoGrezzo = typeof grezzo.paragrafo === "string" ? grezzo.paragrafo.trim() : "";
  let paragrafo: string | null = null;
  let scartato: string | null = null;
  if (paragrafoGrezzo) {
    const esito = controlla(paragrafoGrezzo, dossier);
    if (esito.ok) {
      paragrafo = paragrafoGrezzo;
    } else {
      scartato = esito.motivo;
      /* Vistoso nei log: è l'unico modo di accorgersi che il modello ha
         cominciato a inventare, prima che se ne accorga un cliente. */
      console.error(
        `[replica] PARAGRAFO SCARTATO (${esito.motivo}). Si usa il testo fisso.\n---\n${paragrafoGrezzo}\n---`,
      );
    }
  } else {
    scartato = "il modello non ha scritto niente";
  }

  const scheda = schedaRifiuto(motivo);
  const riassunto =
    typeof grezzo.riassunto === "string" && grezzo.riassunto.trim()
      ? grezzo.riassunto.trim().slice(0, 240)
      : (scheda?.etichetta ?? "Ho letto la loro risposta.");

  return {
    motivo,
    sicurezza,
    fattiLoro: stringhe(grezzo.fattiLoro, 8),
    paragrafo,
    scartato,
    riassunto,
  };
}
