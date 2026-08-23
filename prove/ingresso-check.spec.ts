import { createHmac } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import {
  CHECK_A_PAGAMENTO,
  CORTESIA_SU_INCERTO,
  POSTI_DI_LANCIO,
  PREZZO_LANCIO,
  PREZZO_PIENO,
  postiRimasti,
  prezzoCheck,
  scontoDaCheck,
} from "../lib/check/ingresso";
import { consumaPass, creaPass, leggiPass } from "../lib/check/pass";
import { LISTINI } from "../lib/prezzi";
import { COPY } from "../lib/copy";

/* Elenca i file sotto certe cartelle, in Node puro. Prima si usavano `rg` e
   `find` via execSync, ma su Windows execSync passa da cmd.exe: gli apici
   singoli non contano, il "|" dentro 'gratis|gratuit' diventa una pipe di
   shell e `find -name` non esiste. La prova moriva prima di controllare i
   testi (locale, 15/08). Camminare le cartelle in Node non dipende dal
   sistema operativo. */
function elencaFile(radici: string[], tieni: (rel: string) => boolean): string[] {
  const trovati: string[] = [];
  const salta = /[/\\](node_modules|\.next|public)([/\\]|$)/;
  const cammina = (assoluto: string) => {
    if (salta.test(assoluto)) return;
    if (statSync(assoluto).isDirectory()) {
      for (const nome of readdirSync(assoluto)) cammina(join(assoluto, nome));
      return;
    }
    const rel = assoluto.slice(process.cwd().length + 1).replace(/\\/g, "/");
    if (tieni(rel)) trovati.push(rel);
  };
  for (const r of radici) {
    const base = join(process.cwd(), r);
    if (existsSync(base)) cammina(base);
  }
  return trovati.sort();
}

/**
 * IL CHECK A PAGAMENTO (decisione di Valerio, 11/08).
 *
 * Queste prove tengono ferme le tre cose che possono fare danno:
 * che nasca SPENTO, che il totale del percorso non aumenti di nascosto,
 * e che una ricevuta non si possa fabbricare.
 */

test.describe("Il cancello nasce spento", () => {
  test("senza la variabile il check resta libero", () => {
    /* Se un giorno questa prova diventa rossa, vuol dire che qualcuno ha
       acceso il muro per tutti scrivendolo nel codice invece che nelle
       variabili: è il modo di mandare offline il check senza volerlo. */
    expect(CHECK_A_PAGAMENTO).toBe(process.env.NEXT_PUBLIC_CHECK_PREZZO_ATTIVO === "1");
  });
});

test.describe("Il prezzo di lancio", () => {
  test("costa meno di quello pieno, e il pieno è un impegno", () => {
    expect(PREZZO_LANCIO).toBeLessThan(PREZZO_PIENO);
  });

  test("il prezzo si alza SOLO quando i posti finiscono davvero", () => {
    expect(prezzoCheck(0).prezzo).toBe(PREZZO_LANCIO);
    expect(prezzoCheck(POSTI_DI_LANCIO - 1).prezzo).toBe(PREZZO_LANCIO);
    expect(prezzoCheck(POSTI_DI_LANCIO).prezzo).toBe(PREZZO_PIENO);
  });

  test("se il conteggio non si legge si serve il prezzo BASSO", () => {
    /* Mai il contrario: far pagare di più per un guasto nostro non si fa. */
    expect(prezzoCheck(null).prezzo).toBe(PREZZO_LANCIO);
  });

  test("i posti rimasti si mostrano solo se il numero è vero", () => {
    expect(postiRimasti(null)).toBeNull();
    expect(postiRimasti(120)).toBe(POSTI_DI_LANCIO - 120);
    expect(postiRimasti(POSTI_DI_LANCIO + 40)).toBe(0);
  });
});

test.describe("Il totale del percorso non cambia", () => {
  test("chi paga l'analisi trova la pratica scontata di quello che ha già dato", () => {
    const scontato = scontoDaCheck(LISTINI.a, PREZZO_LANCIO);
    expect(Math.round((scontato.singola + PREZZO_LANCIO) * 100) / 100).toBe(LISTINI.a.singola);
    expect(Math.round((scontato.famiglia + PREZZO_LANCIO) * 100) / 100).toBe(LISTINI.a.famiglia);
  });

  test("vale anche sull'altro prezzo del test", () => {
    const scontato = scontoDaCheck(LISTINI.b, PREZZO_LANCIO);
    expect(Math.round((scontato.singola + PREZZO_LANCIO) * 100) / 100).toBe(LISTINI.b.singola);
  });

  test("non si scende mai sotto zero", () => {
    expect(scontoDaCheck(LISTINI.a, 999).singola).toBe(0);
  });
});

test.describe("La ricevuta del check", () => {
  test("una ricevuta nostra si rilegge", () => {
    const pass = creaPass("ordine-1", 1);
    expect(pass).toBeTruthy();
    const letto = leggiPass(pass);
    expect(letto?.restano).toBe(1);
    expect(letto?.ordine).toBe("ordine-1");
  });

  test("una ricevuta con la firma cambiata non vale", () => {
    const pass = creaPass("ordine-2", 3)!;
    const rotta = `${pass.slice(0, -3)}xxx`;
    expect(leggiPass(rotta)).toBeNull();
  });

  test("una ricevuta col contenuto cambiato non vale", () => {
    const pass = creaPass("ordine-3", 1)!;
    const [corpo, firma] = pass.split(".");
    const dentro = JSON.parse(Buffer.from(corpo, "base64url").toString("utf8"));
    dentro.r = 999;
    const truccato = `${Buffer.from(JSON.stringify(dentro), "utf8").toString("base64url")}.${firma}`;
    expect(leggiPass(truccato)).toBeNull();
  });

  test("una ricevuta scaduta non vale", () => {
    const pass = creaPass("ordine-4", 1, Date.now() - 400 * 24 * 60 * 60 * 1000)!;
    expect(leggiPass(pass)).toBeNull();
  });

  test("niente ricevuta, niente passaggio", () => {
    expect(leggiPass(null)).toBeNull();
    expect(leggiPass("")).toBeNull();
    expect(leggiPass("qualcosa")).toBeNull();
  });

  test("l'ultimo check consumato porta la ricevuta a zero, ma non la butta", () => {
    /* 🔴 QUESTA PROVA PRETENDEVA IL CONTRARIO, e difendeva un difetto sui
       soldi: chiedeva che la ricevuta finita venisse buttata. Ma quel
       foglietto dice due cose, "hai pagato" e "ti resta del credito", e
       buttandolo si perdeva anche la prima: chi pagava 1,99 l'analisi si
       vedeva chiedere la pratica a 14,90 pieni invece di 12,91, cioè la
       promessa scritta in quattro punti del sito. Trovato col collaudo
       del 13/08 sul sito vero.
       A impedire una seconda analisi ci pensa il registro nel database
       (`creditoFinito`), non la sparizione del cookie. */
    const uno = leggiPass(creaPass("ordine-5", 1))!;
    const dopo = consumaPass(uno);
    expect(dopo).not.toBeNull();
    const spesa = leggiPass(dopo);
    expect(spesa?.restano).toBe(0);
    expect(spesa?.ordine).toBe("ordine-5");
  });

  test("con più check ne resta uno in meno", () => {
    const tre = leggiPass(creaPass("ordine-6", 3))!;
    const dopo = leggiPass(consumaPass(tre));
    expect(dopo?.restano).toBe(2);
  });
});

test.describe("Un incerto non si fa pagare", () => {
  test("la cortesia sull'incerto è accesa", () => {
    /* Se si spegne, uno paga 1,99 e si sente rispondere "non lo so": è la
       strada più breve per una contestazione sulla carta, ed è il motivo
       per cui un venditore guarda storto questo genere di prodotto. */
    expect(CORTESIA_SU_INCERTO).toBe(true);
  });
});

/* ── IL SITO NON PUÒ PROMETTERE GRATIS QUELLO CHE FA PAGARE ───────────
   Il muro nasce spento, e questa prova esiste perché il giorno che si
   accende non si accenda anche una bugia: la landing oggi dice "il
   check è gratis, sempre" in più punti, ed è vero SOLO finché
   CHECK_PREZZO_ATTIVO non vale "1". Se qualcuno accende l'interruttore
   senza riscrivere quei testi, la suite si ferma qui. */
test.describe("Se il check si paga, il sito non dice gratis", () => {
  test("i testi e l'interruttore non si contraddicono", () => {
    const testi = JSON.stringify(COPY).toLowerCase();
    /* Si cercano le promesse sul CHECK, non ogni "gratis": il reclamo
       alla compagnia, la segnalazione all'ente e la conciliazione sono
       gratuiti DAVVERO, e dirlo è uno dei motivi per cui la gente si
       fida. Quelle frasi restano anche quando il check si paga. */
    const prometteGratis =
      /(check|analisi|controlla\w*)[^"]{0,40}(gratis|gratuit)/.test(testi) ||
      /(gratis|gratuit)\w*[^"]{0,40}(check|analisi)/.test(testi) ||
      /sempre gratis|gratis, sempre|gratis, senza account/.test(testi);

    if (CHECK_A_PAGAMENTO) {
      expect(
        prometteGratis,
        "il check è a pagamento ma il sito lo promette ancora gratuito",
      ).toBe(false);
    } else {
      /* Da spento la promessa deve esserci: è il gancio che porta la
         gente dentro, e toglierlo "in anticipo" sarebbe perdere traffico
         per una cassa che non è ancora aperta. */
      expect(prometteGratis).toBe(true);
    }
  });
});

/* ── LA CASSA FINTA È ESTINTA (22/08) ──────────────────────────────────
   La cassa di prova e la chiave del collaudatore sono state tolte: la cassa
   è Stripe e basta. Il muro non ha più nessun indirizzo con un segreto
   dentro da poter far trapelare, quindi la vecchia guardia sulla parola
   segreta non ha più niente da controllare. */
test.describe("La cassa finta non c'è più", () => {
  test("nel muro non resta nessuna traccia della cassa di prova", () => {
    for (const f of ["lib/check/cancello.ts", "app/api/verifica/route.ts"]) {
      const testo = readFileSync(join(process.cwd(), f), "utf8");
      const codice = testo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(codice, `${f} ha ancora un riferimento alla cassa di prova`).not.toMatch(
        /cassa-prova|CASSA_PROVA_SEGRETO|cassaDiProvaAperta|inCollaudo/,
      );
    }
  });
});

/* ── LE PORTE DI SERVIZIO ──────────────────────────────────────────────
   Il verdetto non esce solo da /api/verifica. Tre rotte lo producono per
   conto loro, e la ricerca per tratta mostra l'orario di atterraggio
   vero, cioè la sostanza che vendiamo. Con il muro su una porta sola
   bastava conoscere l'indirizzo di un'altra per non pagare mai. */
test.describe("Il muro copre tutte le porte", () => {
  const codiceDi = (f: string) =>
    readFileSync(join(process.cwd(), f), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

  for (const rotta of ["cancellato", "dichiara", "operativo"]) {
    test(`/api/verifica/${rotta} passa dal cancello prima del verdetto`, () => {
      const codice = codiceDi(`app/api/verifica/${rotta}/route.ts`);
      expect(codice).toContain("cancelloDelSeguito");
      /* E ci passa PRIMA di interrogare il motore, se no la chiamata al
         fornitore la paghiamo comunque noi. */
      expect(codice.indexOf("cancelloDelSeguito(")).toBeLessThan(
        codice.indexOf("verificaVolo("),
      );
    });
  }

  test("la ricerca per tratta non regala l'orario di atterraggio", () => {
    const codice = codiceDi("app/api/voli-tratta/route.ts");
    expect(codice).toContain("arrivoEffettivoOra");
    /* 🔴 Qui c'era scritto `passDi`, che guarda il solo cookie: e il
       cookie si copia. Dal 12/08 questa porta chiede al registro se il
       credito è ancora vivo, ed è `passUsabile` a farlo. Rimettere
       `passDi` qui riaprirebbe il buco. */
    expect(codice).toContain("passUsabile");
  });
});

/* ── LA PROVA CHE VALE PIÙ DI TUTTE ────────────────────────────────────
   Le tre porte del giro #53 erano state aperte una alla volta, in mesi
   diversi, sempre in buona fede: chi scriveva la rotta nuova non stava
   pensando al muro, perché il muro non c'era ancora.

   Questa prova toglie di mezzo la buona fede. Guarda OGNI rotta del
   sito: se chiama qualcosa che ci costa soldi (i dati di volo, la
   lettura delle foto) allora deve nominare il cancello. Il giorno che
   qualcuno aggiunge una rotta cara e si dimentica, la suite si ferma
   prima che finisca online.

   Le eccezioni sono scritte a mano UNA per UNA, con il motivo accanto:
   così togliere il cancello da una rotta non è una dimenticanza, è una
   riga che qualcuno deve scrivere e firmare. */
test.describe("Nessuna porta di servizio sul muro", () => {
  /** Le funzioni che, direttamente o dietro le quinte, si pagano. */
  const COSTANO = [
    "verificaVolo", // AeroDataBox, il verdetto
    "voliDiTratta", // AeroDataBox, due chiamate per volta
    "testoDaDocumento", // Mistral OCR, a chiamata
  ];

  /** Chi nomina il cancello, in una qualsiasi delle sue forme. */
  /* ⚠️ `passUsabile` è entrato in elenco il 12/08: è `passDi` che in più
     chiede al REGISTRO se quel credito è ancora vivo, e le due porte
     laterali adesso usano quello. `passDi` resta buono dove il credito
     non c'entra (la pagina del verdetto, che legge solo per lo sconto). */
  const CANCELLO = [
    "cancelloDelSeguito",
    "passUsabile",
    "passDi",
    "rispostaMuro",
    "leggiPass",
  ];

  /**
   * Le rotte care che NON hanno il cancello, e perché è giusto così.
   * Aggiungere una voce qui è una decisione, non una svista.
   */
  const ESENTI: Record<string, string> = {
    "app/api/leggi-carta/route.ts":
      "l'OCR della carta d'imbarco è LIBERO di proposito (13/08): leggere la foto è compilazione, non l'analisi che si vende, e paywallarla faceva pagare per riempire un modulo e perdere il progresso dopo. Il muro scatta dopo, su /api/verifica. Mistral OCR costa pochissimo e la rotta resta dietro il freno per IP.",
    "app/api/motore/avvisa/route.ts":
      "lavoro notturno di Netlify, chiuso da MOTORE_SEGRETO: non lo chiama un utente",
    "app/api/motore/segui/route.ts":
      "lavoro notturno di Netlify, chiuso da MOTORE_SEGRETO: non lo chiama un utente",
    "app/api/motore/coda/route.ts":
      "lavoro notturno di Netlify, chiuso da MOTORE_SEGRETO: ricontrolla gli incerti con email, non lo chiama un utente",
    "app/api/osservatorio/route.ts":
      "indice degli scali, una sola rilevazione al giorno per otto aeroporti: il costo e' fisso e non cresce col traffico",
    "app/api/pratiche/[id]/documento/route.ts":
      "la seconda fonte dentro una pratica: serve l'account E la proprieta' della pratica (RLS), che si ottengono solo pagando. Trovata da questa prova l'11/08: nessuno l'aveva guardata.",
    "app/api/pratiche/[id]/risposta/route.ts":
      "legge la risposta della compagnia (OCR + modello) dentro una pratica GIA' PAGATA: serve l'account, la proprieta' della pratica e uno stato oltre 'pronta', cioe' un reclamo gia' partito. E' un cancello piu' stretto di quello del check, non piu' largo, e in piu' ha un tetto di 6 chiamate al minuto perche' ognuna costa due giri di modello. Trovata da questa prova il 13/08, il giorno stesso in cui la rotta e' nata.",
  };

  test("ogni rotta che ci costa soldi passa dal cancello", () => {
    const rotte = elencaFile(["app/api"], (rel) => rel.endsWith("/route.ts"));

    expect(rotte.length, "nessuna rotta trovata: la prova non sta guardando niente").toBeGreaterThan(
      10,
    );

    const scoperte: string[] = [];
    for (const f of rotte) {
      const codice = readFileSync(join(process.cwd(), f), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "");
      if (!COSTANO.some((c) => codice.includes(c))) continue;
      if (f in ESENTI) continue;
      if (CANCELLO.some((c) => codice.includes(c))) continue;
      scoperte.push(f);
    }

    expect(
      scoperte,
      `queste rotte chiamano un fornitore a pagamento senza passare dal cancello: ${scoperte.join(", ")}`,
    ).toEqual([]);
  });

  test("le esenzioni scritte a mano esistono davvero", () => {
    /* Un'esenzione su una rotta cancellata resta lì per sempre e un
       domani copre una rotta nuova con lo stesso nome. */
    for (const f of Object.keys(ESENTI)) {
      expect(existsSync(join(process.cwd(), f)), `esenzione su una rotta che non esiste: ${f}`).toBe(
        true,
      );
    }
  });

  test("la cache della ricerca per tratta non serve mai la versione piena", () => {
    /* La cache della rete e' quello che ci salva il conto a scala, ma se
       finisse in cache la risposta di chi HA pagato, la rete la
       servirebbe poi a chi non ha pagato: la cache diventerebbe il buco
       piu' grosso di tutti. */
    const codice = readFileSync(join(process.cwd(), "app/api/voli-tratta/route.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(codice).toContain("Vary");
    /* Il ramo di chi HA pagato deve essere il primo del ternario ed
       essere no-store: e' il ramo che porta l'orario di atterraggio. */
    const ternario = codice.match(/haPagato\s*\n?\s*\?\s*\{([^}]*)\}/);
    expect(ternario, "il ramo di chi ha pagato non si riconosce piu' nel codice").not.toBeNull();
    expect(ternario![1]).toContain("no-store");
    expect(ternario![1]).not.toContain("s-maxage");
  });
});

/* ── E LA STESSA COSA SUI TESTI ────────────────────────────────────────
   Il difetto gemello: non una porta aperta, ma una PAROLA rimasta
   indietro. Col muro acceso, ogni frase che promette il check gratuito
   e' una promessa rotta, e le peggiori non stanno sulla landing: stanno
   dentro il motore, cioe' sono le frasi che uno legge SUBITO DOPO aver
   pagato ("il controllo resta gratuito"). Otto ne sono state trovate
   l'11/08 in lib/regole e lib/voli.

   Questa prova guarda ogni file del progetto e cerca la promessa, non la
   parola: "gratis" vicino a "check / analisi / controllo / verifica".
   Chi la scrive dentro seSiPaga passa, perche' quella frase sparisce da
   sola quando il muro si accende. Tutti gli altri no. */
test.describe("Nessuna promessa di check gratuito fuori dall'interruttore", () => {
  /* Le cose che sono gratuite DAVVERO e devono restare scritte: sono
     quelle che ci fanno guadagnare fiducia, non quelle che ci costano.
     Il reclamo alla compagnia, la segnalazione all'ente, la
     conciliazione ART, i centri europei consumatori, le nostre guide, e
     l'assistenza gratuita per chi ha mobilità ridotta (Reg. 1107, dove il
     testo nomina anche il "check-in" e i "controlli" di sicurezza): niente
     di tutto questo è il check del volo. */
  const DAVVERO_GRATIS =
    /\b(enac|ente|autorit|conciliaz|conciliaweb|ecc-net|europeo consumatori|reclamo|guida|da solo|ita airways|spid|destinazion|accompagnament|assistenz|carrozzin|mobilit)/i;

  test("nessun testo promette il check gratis fuori da seSiPaga", () => {
    const file = elencaFile(["app", "components", "lib", "mobile/src"], (rel) => {
      if (!/\.(t|j)sx?$/.test(rel)) return false;
      return /gratis|gratuit/i.test(readFileSync(join(process.cwd(), rel), "utf8"));
    });

    expect(file.length, "la prova non sta leggendo niente").toBeGreaterThan(5);

    /* L'unica esenzione, e va motivata: le pagine di /admin le vede solo
       Valerio, e la pagina delle impostazioni DEVE poter dire "senza
       questa variabile il check torna gratuito per tutti", perché è
       esattamente la diagnosi che serve. Non è una promessa a un
       cliente: è un cruscotto. */
    /* I commenti multi-riga vanno tolti PRIMA di andare riga per riga: il
       controllo sotto prende la riga d'apertura di un blocco, ma non le
       righe di mezzo e di chiusura, e lì dentro finiscono le spiegazioni
       del codice del buono ("l'analisi gratis: si incolla nel muro") che
       non le legge nessun utente. Si svuota il contenuto del blocco
       tenendo gli a-capo, così i numeri di riga del rapporto restano veri. */
    const senzaBlocchi = (t: string) =>
      t.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "));

    const colpevoli: string[] = [];
    for (const f of file) {
      if (f.startsWith("app/admin/")) continue;
      const righe = senzaBlocchi(readFileSync(join(process.cwd(), f), "utf8")).split("\n");
      righe.forEach((riga, i) => {
        const spoglio = riga.trim();
        // i commenti di riga non li legge nessun utente
        if (/^(\*|\/\/|\/\*|\{\/\*)/.test(spoglio)) return;
        if (!/gratis|gratuit/i.test(riga)) return;
        /* 🔴 LA FRASE PUÒ SPEZZARSI SU PIÙ RIGHE, e prima sfuggiva. Il JSX
           va a capo: la pagina 404 aveva "puoi controllarlo subito, è" su una
           riga e "gratis" su quella dopo, quindi la parola del check e il
           "gratis" finivano separate e il controllo a riga singola non le
           vedeva vicine (bug trovato il 15/08 in locale). Adesso si guarda una
           finestra di tre righe unite, con gli spazi normalizzati. */
        const finestra = righe
          .slice(Math.max(0, i - 1), i + 2)
          .join(" ")
          .replace(/\s+/g, " ");
        // la promessa: "gratis" a meno di 60 caratteri da una parola del check
        const promessa =
          /(check|analisi|controll\w*|verific\w*|scopri).{0,60}(gratis|gratuit)/i.test(finestra) ||
          /(gratis|gratuit)\w*.{0,60}(check|analisi|controll\w*|verific\w*)/i.test(finestra);
        if (!promessa) return;
        if (DAVVERO_GRATIS.test(finestra)) return;
        // dentro un seSiPaga? si guarda il contorno, non la sola riga
        const contorno = righe.slice(Math.max(0, i - 5), i + 2).join("\n");
        if (contorno.includes("seSiPaga")) return;
        colpevoli.push(`${f}:${i + 1}  ${spoglio.slice(0, 110)}`);
      });
    }

    expect(
      colpevoli,
      `queste frasi promettono il check gratuito senza seguire l'interruttore:\n${colpevoli.join("\n")}`,
    ).toEqual([]);
  });
});

/* ── IL REGISTRO: LA RICEVUTA NON SI RIUSA ─────────────────────────────
   Il buco piu' grave del muro, trovato attaccandolo l'11/08: il cookie
   della ricevuta si consuma scrivendone uno nuovo, ma il cookie sta nel
   browser dell'utente. Chi si copiava il valore di prima e lo rimetteva
   a mano tornava ad avere il credito pieno: 1,99 pagati una volta,
   analisi infinite, e la stringa si passa agli amici.
   Il conto vero lo tiene il database, non il cookie. */
test.describe("La ricevuta non si riusa", () => {
  test("la ricevuta dice quante analisi ha comprato l'ordine", () => {
    /* Senza questo numero il registro non saprebbe qual e' il tetto, e
       il tetto e' l'unica cosa che rende il conto verificabile. */
    const pass = leggiPass(creaPass("ordine-registro", 3))!;
    expect(pass.quanti).toBe(3);
    /* E resta fermo mentre il credito cala: e' il comprato, non il resto. */
    const dopo = leggiPass(consumaPass(pass))!;
    expect(dopo.quanti).toBe(3);
    expect(dopo.restano).toBe(2);
  });

  test("le ricevute vecchie, senza il numero comprato, non si rompono", () => {
    /* Emesse prima dell'11/08: hanno solo `r`. Devono continuare a
       funzionare, se no chi ha pagato ieri si ritrova fuori. */
    const k =
      process.env.SEGRETO_ISCRITTI ??
      process.env.SUPABASE_SECRET_KEY ??
      process.env.SUPABASE_SERVICE_ROLE_KEY ??
      "rivolio-sviluppo-non-usare-in-produzione";
    const corpo = Buffer.from(
      JSON.stringify({ r: 2, x: Date.now() + 86_400_000, o: "ordine-vecchio" }),
      "utf8",
    ).toString("base64url");
    const firma = createHmac("sha256", k).update(corpo).digest("base64url");
    const letto = leggiPass(`${corpo}.${firma}`);
    expect(letto).not.toBeNull();
    expect(letto!.quanti).toBe(2);
  });

  test("il check consulta il registro PRIMA di lavorare, e ci scrive dopo", () => {
    const codice = readFileSync(join(process.cwd(), "app/api/verifica/route.ts"), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");
    expect(codice).toContain("creditoFinito");
    expect(codice).toContain("segnaConsumo");
    /* Il controllo del credito deve venire PRIMA della chiamata al
       fornitore, se no la paghiamo comunque noi. */
    expect(codice.indexOf("creditoFinito")).toBeLessThan(codice.indexOf("verificaVolo("));
  });

  test("la colonna del registro esiste nella migrazione da applicare", () => {
    /* Senza la colonna il muro torna a fidarsi del cookie, cioe' il buco
       si riapre: la migrazione non e' una rifinitura, e' parte del muro. */
    const sql = readFileSync(join(process.cwd(), "supabase/DA-APPLICARE.sql"), "utf8");
    expect(sql).toContain("ordine_check");
    expect(sql).toContain("verifiche_ordine_check_idx");
  });
});

/* ── LE PAGINE DA CUI NON SI TORNAVA ───────────────────────────────────
   Valerio, 11/08: «quando uno entra nel blog resta bloccato e non puo'
   uscirne». Il Tabellone e le pagine evento hanno una testata loro, non
   la barra della landing: il filo che riporta al check si spezza. */
test.describe("Dal blog si torna indietro", () => {
  test("i link della landing verso le sezioni a parte aprono una scheda nuova", async () => {
    const { apreAParte, SEZIONI_A_PARTE } = await import("../lib/link");
    for (const p of SEZIONI_A_PARTE) {
      expect(apreAParte(p).target, `${p} deve aprirsi di fianco`).toBe("_blank");
      /* Senza noopener la pagina che si apre puo' toccare quella che
         l'ha aperta: e' una regola di sicurezza, non di stile. */
      expect(apreAParte(p).rel).toContain("noopener");
    }
  });

  test("le ancore della landing NON aprono schede nuove", async () => {
    const { apreAParte } = await import("../lib/link");
    for (const p of ["#prezzi", "/", "/app", "/entra", "/privacy"]) {
      expect(apreAParte(p).target, `${p} non deve aprire una scheda`).toBeUndefined();
    }
  });

  test("dentro il Tabellone c'è una via d'uscita verso il sito", () => {
    const testata = readFileSync(join(process.cwd(), "components/tabellone/Masthead.tsx"), "utf8");
    expect(testata, "manca il ritorno alla landing dalla testata del blog").toContain('href="/"');
  });

  test("il marchio del Tabellone è cliccabile e riporta in cima", () => {
    const m = readFileSync(
      join(process.cwd(), "components/tabellone/MarchioTabellone.tsx"),
      "utf8",
    );
    expect(m).toContain("scrollTo");
    /* Chi ha chiesto meno animazioni riceve il salto secco. */
    expect(m).toContain("prefers-reduced-motion");
  });
});
