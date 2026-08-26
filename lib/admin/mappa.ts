/**
 * LA MAPPA DI RIVOLIO: tutto il business in una schermata sola.
 *
 * Richiesta di Valerio (12/08): «una whiteboard, un canvas leggerissimo
 * con zoom, che mappa tutto il business: il funnel, il prodotto, i canali
 * di distribuzione. Così so dove siamo e capisco come funzionano le cose».
 *
 * ⚠️ QUI DENTRO NON CI SONO NUMERI, ed è una sua scelta esplicita: «i
 * numeri li dà il pannello, la whiteboard è la MACROVISTA di tutto
 * Rivolio». È giusto anche tecnicamente: un numero scritto in un file si
 * fossilizza il giorno dopo, e una mappa che mente è peggio di nessuna
 * mappa. Il cruscotto sa quante persone sono passate; questa pagina sa
 * COME funziona il posto in cui passano.
 *
 * ⚠️ E DICE ANCHE COSA NON C'È. Ogni nodo porta uno `stato`: costruito,
 * costruito ma spento, non ancora. Una mappa che disegna solo le cose
 * fatte fa credere che il business sia finito, ed è esattamente l'errore
 * che porta a distribuire prima di avere una cassa.
 *
 * Come si tiene aggiornata: la struttura la scrivo io a ogni giro, perché
 * è il racconto del business e cambia quando cambiamo noi.
 */

export type StatoNodo =
  /** Esiste, gira, l'ha visto qualcuno. */
  | "fatto"
  /** Costruito ma dietro un interruttore, o in attesa di qualcosa. */
  | "spento"
  /** Non esiste ancora. */
  | "manca";

export type ChiaveZona = "ingresso" | "prodotto" | "soldi" | "dopo" | "fondamenta";

export type Nodo = {
  id: string;
  zona: ChiaveZona;
  /** Il nome corto sulla card. */
  titolo: string;
  /** Una riga: cosa succede qui. */
  riga: string;
  /** Il dettaglio che si apre al clic: perché esiste, cosa si rompe. */
  dentro: string;
  stato: StatoNodo;
  /** L'icona, per chiave: la sceglie il componente. */
  icona: string;
  /** Posizione sulla tela, in unità da 10 punti. */
  x: number;
  y: number;
  /** Dove si va a vedere questa cosa, se si può. */
  dove?: string;
};

export type Filo = {
  da: string;
  a: string;
  /** L'etichetta sul filo: cosa passa di qui. */
  testo?: string;
  /** Un filo tratteggiato è una strada che oggi non è percorribile. */
  fermo?: boolean;
};

export const ZONE: {
  chiave: ChiaveZona;
  nome: string;
  sotto: string;
  /** Il colore della fascia: sono i nostri, non una tavolozza nuova. */
  tinta: string;
}[] = [
  {
    chiave: "ingresso",
    nome: "Da dove arriva la gente",
    sotto: "Nessuno ci conosce. È l'unico problema che conta oggi.",
    tinta: "#7c3aed",
  },
  {
    chiave: "prodotto",
    nome: "Il prodotto",
    sotto: "Il check e il verdetto: 30 secondi, senza account e senza email.",
    tinta: "#0a9d5c",
  },
  {
    chiave: "soldi",
    nome: "Dove si incassa",
    sotto: "Due momenti: il muro dell'analisi e la pratica. La cassa è Stripe ed è pronta; resta accenderla per il pubblico.",
    tinta: "#b45309",
  },
  {
    chiave: "dopo",
    nome: "Dopo il pagamento",
    sotto: "Quattro colpi, non uno. È qui che il cliente vede il valore vero.",
    tinta: "#0369a1",
  },
  {
    chiave: "fondamenta",
    nome: "Sotto tutto",
    sotto: "I pezzi che nessuno vede e che, se cadono, fermano ogni cosa.",
    tinta: "#475569",
  },
];

/**
 * I NODI.
 *
 * Le coordinate sono a mano di proposito: una disposizione automatica
 * mette i box dove tornano i conti a un algoritmo, non dove il racconto
 * si legge. Qui si legge da sinistra a destra come una storia: arriva
 * una persona, fa il check, sbatte sul muro, paga, riceve la lettera,
 * la manda, e alla fine o la compagnia paga o si va avanti.
 */
export const NODI: Nodo[] = [
  /* ---------------- da dove arriva la gente ---------------- */
  {
    id: "tiktok",
    zona: "ingresso",
    titolo: "TikTok e Instagram",
    riga: "Video sui voli storti, col check in descrizione.",
    dentro:
      "È il canale numero uno perché costa zero e perché il pubblico è esattamente quello: gente che ha preso un volo andato male e non sa di avere diritto a qualcosa. Il registro segna da quale dominio arriva ogni visita, mai da quale video: serve a sapere cosa funziona, non a seguire le persone. Account @rivolio_ai, ancora senza pubblicazioni.",
    stato: "manca",
    icona: "video",
    x: 0,
    y: 8,
  },
  {
    id: "google",
    zona: "ingresso",
    titolo: "Google",
    riga: "Il Tabellone: 11 articoli, sitemap inviata.",
    dentro:
      "Chi cerca «rimborso volo Ryanair» o «sciopero aerei oggi» ha già il problema in mano. Gli articoli portano al check dentro il testo, non con un rimando. Ci vogliono settimane perché Google si fidi di un sito nuovo: è il canale più lento a partire e il più stabile una volta partito.",
    stato: "fatto",
    icona: "cerca",
    x: 0,
    y: 22,
    dove: "/tabellone",
  },
  {
    id: "eventi",
    zona: "ingresso",
    titolo: "Le giornate storte",
    riga: "Pagine sciopero e pagine aeroporto, aggiornate da sole.",
    dentro:
      "Il giorno di uno sciopero la gente cerca «sciopero aerei oggi», non «reclamo Ryanair». Un blog quella ricerca non la prende, perché non può avere un articolo per ogni giorno del calendario. Queste pagine si costruiscono dai nostri dati e un automatismo raccoglie gli scioperi proclamati ogni notte.",
    stato: "fatto",
    icona: "allarme",
    x: 0,
    y: 36,
    dove: "/sciopero-aerei",
  },
  {
    id: "osservatorio",
    zona: "ingresso",
    titolo: "L'Osservatorio",
    riga: "Una email a settimana coi 10 voli più in ritardo.",
    dentro:
      "Non è una newsletter di marketing: è un motivo per tornare. Chi si iscrive lascia un contatto prima di aver comprato niente, e il giorno che il suo volo va storto si ricorda di noi. Doppio consenso: l'iscrizione vale solo dopo il clic sul link nell'email.",
    stato: "spento",
    icona: "posta",
    x: 0,
    y: 50,
  },
  {
    id: "affiliati",
    zona: "ingresso",
    titolo: "I creator",
    riga: "Un link tracciato, sconto per l'amico, commissione al creator.",
    dentro:
      "Il quinto canale, e l'unico che porta traffico caldo senza che paghiamo prima: un creator mette il suo link, chi arriva ha uno sconto e chi ha portato prende una commissione (40% di default). Tutto è tracciato con un cookie di 60 giorni, e le commissioni si contano una volta sola. C'è la sala di controllo per crearli e vedere quanto hanno portato, e la loro dashboard con i bonus da sbloccare. I creator scelti hanno l'account gratis a vita.",
    stato: "fatto",
    icona: "persone",
    x: 0,
    y: 62,
    dove: "/admin/affiliati",
  },

  /* ---------------- il prodotto ---------------- */
  {
    id: "check",
    zona: "prodotto",
    titolo: "Il check",
    riga: "Volo e data. Nient'altro: né email né account.",
    dentro:
      "È il prodotto, non una schermata di ingresso. Tre modi per dire qual è il volo: la tratta (predefinito, perché il numero di volo quasi nessuno lo ricorda), il numero per chi ce l'ha, e la foto della carta d'imbarco. La foto si legge e si butta: non viene mai salvata.",
    stato: "fatto",
    icona: "lente",
    x: 26,
    y: 22,
    dove: "/",
  },
  {
    id: "motore",
    zona: "prodotto",
    titolo: "Il motore",
    riga: "Decide lui. L'intelligenza artificiale non decide MAI.",
    dentro:
      /* 🔴 QUI C'ERA SCRITTO «58 casi», E I CASI SONO 53. Il numero era
         copiato a mano dal diario di un giro precedente e nessuno lo
         ricontrollava: una mappa che dichiara una prova più larga di
         quella che c'è è esattamente il genere di numero gonfiato che
         questo progetto non si può permettere.
         Adesso `prove/mappa.spec.ts` confronta questa riga con
         `CASI_ORO.length` e con `VERSIONE_REGOLE`: se il motore cresce e
         la riga resta indietro, la suite si ferma. Trovato
         dall'ispezione del 12/08. */
      "Regole scritte del Regolamento CE 261/2004, versione 2026.08.9, provate su 55 casi etichettati a mano con zero falsi positivi. Tre risposte possibili: idoneo, incerto, non idoneo. Un caso incerto non si vende mai: è la regola che tiene in piedi tutto, perché vendere una lettera per un diritto che non esiste vuol dire rimborsare e prendersi una stella.",
    stato: "fatto",
    icona: "ingranaggio",
    x: 50,
    y: 22,
    /* Dal 13/08 il motore ha la sua schermata: le nove fonti una per una,
       il giro completo di un'analisi e cosa c'è nel database adesso.
       Richiesta di Valerio: «spiegami pezzo per pezzo come lavora». */
    dove: "/admin/motore",
  },
  {
    id: "dati",
    zona: "prodotto",
    titolo: "AeroDataBox",
    riga: "L'orario vero delle ruote a terra, non quello che ricordi.",
    dentro:
      "Il fornitore dei dati di volo. È l'unico costo fisso che abbiamo: un abbonamento, non un prezzo a chiamata, e la memoria fa sì che un volo con 180 passeggeri costi una chiamata sola. Se smette di rispondere i check escono incerti: nessuno paga per un verdetto sbagliato, ma le vendite si fermano, e per questo suona un allarme sul telefono.",
    stato: "fatto",
    icona: "aereo",
    x: 26,
    y: 6,
  },
  {
    id: "verdetto",
    zona: "prodotto",
    titolo: "Il verdetto",
    riga: "Quanto ti spetta, e da quali orari esce quel numero.",
    dentro:
      "Ogni numero mostrato si può aprire e dice da dove viene. È il prodotto vero: non «hai diritto a 600 euro», ma «il tuo volo è atterrato con 3 ore e 20 di ritardo, quindi ricadi nella fascia da 400». La differenza fra le due frasi è tutta l'azienda.",
    stato: "fatto",
    icona: "timbro",
    x: 74,
    y: 22,
  },

  /* ---------------- dove si incassa ---------------- */
  {
    id: "muro",
    zona: "soldi",
    titolo: "Il muro dell'analisi",
    riga: "1,99 per sbloccare il verdetto. Nasce spento.",
    dentro:
      "Primo dei due punti in cui entrano soldi. Non è un rincaro: i 1,99 si scalano dalla pratica, quindi il totale del percorso resta 16,90. Un verdetto incerto non consuma il credito, perché chi paga per sapere e si sente rispondere «non lo so» non ha comprato una risposta. Si accende con una variabile su Netlify.",
    stato: "spento",
    icona: "muro",
    x: 74,
    y: 44,
  },
  {
    id: "pratica-acquisto",
    zona: "soldi",
    titolo: "La pratica",
    riga: "16,90 singola, 29,90 famiglia. Una volta sola.",
    dentro:
      "Secondo punto di incasso, e quello che vale davvero. I portali a percentuale trattengono il 35-50% della compensazione: su 600 euro sono 210. Qui paghi una cifra fissa e tieni il 100%. Prima di pagare si spunta la rinuncia al recesso, perché il prodotto si consuma nell'istante in cui viene consegnato.",
    stato: "spento",
    icona: "carta",
    x: 100,
    y: 44,
  },
  {
    id: "venditore",
    zona: "soldi",
    titolo: "La cassa (Stripe)",
    riga: "Fatta: la cassa è Stripe. Manca solo l'ultima chiave su Netlify.",
    dentro:
      "La cassa è Stripe. Con Managed Payments Stripe fa da «merchant of record»: incassa al posto nostro e versa lui l'IVA in 80+ paesi, che è la ragione per cui funziona senza partita IVA. Il prezzo lo scriviamo noi in linea, niente prodotti da creare a mano. ⚠️ MP non è automatico: va abilitato nel pannello e passa una revisione di idoneità; finché non lo è si incassa con lo Stripe standard (venditore sei tu). STRIPE_SECRET_KEY e STRIPE_WEBHOOK_SECRET sono su Netlify e la cassa è viva in test: resta il passaggio a live (chiavi sk_live_).",
    stato: "fatto",
    icona: "cassa",
    x: 126,
    y: 44,
  },

  /* ---------------- dopo il pagamento ---------------- */
  {
    id: "lettera",
    zona: "dopo",
    titolo: "1. La lettera",
    riga: "Reclamo già scritto, col canale giusto di quella compagnia.",
    dentro:
      "Primo colpo. Venti compagnie con canale di reclamo verificato a mano, uno per uno. La manda l'utente dalla propria email, e non è un ripiego: Ryanair, easyJet, Wizz Air e altre dichiarano per iscritto che lavorano solo i reclami inviati dal passeggero. È anche il motivo per cui la compensazione arriva intera.",
    stato: "fatto",
    icona: "lettera",
    x: 170,
    y: 6,
  },
  {
    id: "sollecito",
    zona: "dopo",
    titolo: "2. Il sollecito",
    riga: "Al giorno 42, o subito se la compagnia ha già detto no.",
    dentro:
      "Secondo colpo. Le compagnie rispondono in 8-14 settimane, quindi un sollecito al giorno 15 arriverebbe prima che qualcuno abbia aperto la pratica. Se il no è già arrivato, il calendario si scavalca: la replica cambia secondo il motivo del rifiuto, otto motivi a scelta chiusa, ognuno con la sua risposta.",
    stato: "fatto",
    icona: "orologio",
    x: 170,
    y: 20,
  },
  {
    id: "ente",
    zona: "dopo",
    titolo: "3. L'ente nazionale",
    riga: "Segnalazione già scritta. Accerta, ma non paga.",
    dentro:
      "Terzo colpo. L'ente competente lo decide il paese di PARTENZA, non la compagnia: 29 paesi in tabella, presi dal documento ufficiale della Commissione. ⚠️ Non promettiamo che l'ente paghi, perché non paga: accerta la violazione e può sanzionare. Dirlo diversamente sarebbe la bugia più facile da raccontare.",
    stato: "fatto",
    icona: "istituzione",
    x: 170,
    y: 34,
  },
  {
    id: "conciliazione",
    zona: "dopo",
    titolo: "4. La conciliazione",
    riga: "ConciliaWeb: gratis, da casa, e qui i soldi si muovono.",
    dentro:
      "Quarto colpo, ed è quello che paga davvero. In Italia la gestisce l'Autorità di regolazione dei trasporti: è gratuita, si fa con SPID, e le compagnie ci si siedono perché è un passaggio previsto prima della causa. Si apre dopo 30 giorni di silenzio, quindi PRIMA del nostro sollecito. ⚠️ La domanda va presentata entro un anno dal reclamo.",
    stato: "fatto",
    icona: "bilancia",
    x: 170,
    y: 48,
  },
  {
    id: "garanzia",
    zona: "dopo",
    titolo: "La garanzia",
    riga: "Se la compagnia non paga, ti restituiamo quello che hai speso.",
    dentro:
      "È legata all'ESITO, non a un calendario. Prima erano 90 giorni, ma quel giorno cadeva dentro l'attesa normale della compagnia e un cliente onesto avrebbe chiesto il rimborso a pratica ancora viva: al 50% di richieste il guadagno per pratica si sarebbe dimezzato.",
    stato: "fatto",
    icona: "scudo",
    x: 198,
    y: 27,
  },

  /* ---------------- sotto tutto ---------------- */
  {
    id: "supabase",
    zona: "fondamenta",
    titolo: "Il database",
    riga: "Uno solo, condiviso da sito e app.",
    dentro:
      "Voli, verifiche, pratiche, eventi, iscritti, scioperi. Il motore è uno: se cambia una regola cambia per sito e app nello stesso istante, perché l'app il check non lo calcola, lo chiede al sito. Le tabelle si leggono solo con la chiave segreta del server.",
    stato: "fatto",
    icona: "database",
    x: 0,
    y: 82,
  },
  {
    id: "registro",
    zona: "fondamenta",
    titolo: "Il registro",
    riga: "Registra FATTI, non persone. Niente IP, niente impronte.",
    dentro:
      "Senza questo, per sapere come va il sito bisogna indovinare. Con questo si vede quante persone arrivano, quante fanno un'analisi, quante sbattono sul muro e quante pagano. Le uniche due informazioni di contorno sono il dominio di provenienza e il paese, che lo dice già Netlify.",
    stato: "fatto",
    icona: "registro",
    x: 26,
    y: 82,
    dove: "/admin/registro",
  },
  {
    id: "telegram",
    zona: "fondamenta",
    titolo: "Il TIN sul telefono",
    riga: "Suona per due cose sole: i soldi e i guasti.",
    dentro:
      "Più il riepilogo della sera alle 21. Un avviso a ogni analisi sarebbe bello il primo giorno e insopportabile il secondo: dopo due ore si silenzia il canale, e allora si perdono anche gli avvisi che contano. Il guasto ha un silenziatore da un quarto d'ora, quindi mille errori di fila restano un messaggio.",
    stato: "fatto",
    icona: "campana",
    x: 52,
    y: 82,
  },
  {
    id: "email",
    zona: "fondamenta",
    titolo: "Le email",
    riga: "Resend su send.rivolio.it. Da verificare.",
    dentro:
      "Servono per la conferma dell'Osservatorio, per l'accesso senza password e per le tappe della pratica. ⚠️ Finché il dominio non è verificato partono SOLO verso la casella che possiede l'account Resend: lo decide Resend, non il nostro codice. E finché non c'è il gancio di Supabase, le email di accesso hanno un tetto di 2 all'ora per tutto il progetto.",
    stato: "spento",
    icona: "busta",
    x: 78,
    y: 82,
  },
  {
    id: "app",
    zona: "fondamenta",
    titolo: "L'app sul telefono",
    riga: "34 schermate su 34. Non è ancora negli store.",
    dentro:
      "Costruita e completa, ma gira solo in un browser: per stare su App Store e Play Store servono gli account sviluppatore e la revisione. Il pagamento resta sul sito e non dentro l'app, perché Apple e Google trattengono dal 15 al 30%.",
    stato: "spento",
    icona: "telefono",
    x: 104,
    y: 82,
    dove: "/anteprima-app",
  },
];

/**
 * I FILI.
 *
 * ⚠️ Un filo tratteggiato è una strada che oggi NON si può percorrere.
 * Guardando la mappa si deve vedere a colpo d'occhio dove il percorso si
 * interrompe, e oggi si interrompe in un punto solo: la cassa.
 */
export const FILI: Filo[] = [
  { da: "tiktok", a: "check", testo: "il canale da costruire" },
  { da: "google", a: "check" },
  { da: "eventi", a: "check" },
  { da: "osservatorio", a: "check", testo: "chi torna" },
  { da: "affiliati", a: "check", testo: "link tracciato" },

  { da: "check", a: "motore", testo: "volo e data" },
  { da: "dati", a: "motore", testo: "orari certificati" },
  { da: "motore", a: "verdetto", testo: "idoneo / incerto / no" },

  { da: "verdetto", a: "muro", testo: "1,99", fermo: true },
  { da: "muro", a: "pratica-acquisto", testo: "si scalano", fermo: true },
  { da: "venditore", a: "pratica-acquisto", testo: "da accendere", fermo: true },

  { da: "pratica-acquisto", a: "lettera", testo: "subito" },
  { da: "lettera", a: "sollecito", testo: "42 giorni" },
  { da: "sollecito", a: "ente", testo: "56 giorni" },
  { da: "ente", a: "conciliazione", testo: "se non basta" },
  { da: "conciliazione", a: "garanzia", testo: "se non paga nessuno" },

  /* ⚠️ LE FONDAMENTA NON HANNO FILI, ED È UNA SCELTA. Ne avevano cinque
     e attraversavano la tela in diagonale da un angolo all'altro, sopra
     le altre card, per dire una cosa che la fascia dice gia' meglio in
     una riga: "i pezzi che nessuno vede e che, se cadono, fermano ogni
     cosa". Il database non serve al motore: serve a tutto. Disegnarlo
     con una freccia sola sarebbe anche sbagliato. */

];

/** Quante cose sono a posto, quante spente, quante mancano. */
export function conto() {
  return {
    fatto: NODI.filter((n) => n.stato === "fatto").length,
    spento: NODI.filter((n) => n.stato === "spento").length,
    manca: NODI.filter((n) => n.stato === "manca").length,
    totale: NODI.length,
  };
}
