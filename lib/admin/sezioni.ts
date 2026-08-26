/**
 * LE SEZIONI DEL RETROBOTTEGA, scritte una volta sola.
 *
 * Le legge la barra laterale (per l'elenco) e la testata (per il titolo
 * della pagina aperta). Se vivessero in due posti, il giorno che se ne
 * aggiunge una compare nel menu ma la testata resta senza nome: è il
 * genere di sfasatura che non si nota mai finché non la vede un altro.
 *
 * ⚠️ Qui NON ci sono le icone, e non è una dimenticanza: le icone sono
 * componenti React e questo file lo legge anche il server, che non può
 * passarle al browser. La barra laterale le aggancia per chiave.
 */

export type ChiaveSezione =
  | "mappa"
  | "motore"
  | "panoramica"
  | "recensioni"
  | "pratiche"
  | "crescita"
  | "affiliati"
  | "registro"
  | "iscritti"
  | "prodotto"
  | "impostazioni";

export type Sezione = {
  chiave: ChiaveSezione;
  href: string;
  /** Il nome nel menu: una parola, come nei gestionali veri. */
  nome: string;
  /** La riga sotto il titolo: dice a cosa serve questa schermata. */
  sotto: string;
};

export const SEZIONI: Sezione[] = [
  {
    /* La mappa sta PER PRIMA perche' risponde alla domanda che viene
       prima di tutte: come funziona questo posto. I numeri vengono dopo,
       e senza la mappa non si sa nemmeno cosa stanno misurando. */
    chiave: "mappa",
    href: "/admin/mappa",
    nome: "La mappa",
    sotto: "Tutto Rivolio in una schermata: il prodotto, i canali, dove entrano i soldi.",
  },
  {
    /* Subito dopo la mappa, e prima dei numeri: la mappa dice com'è fatto
       Rivolio, questa dice com'è fatto il pezzo che i soldi li giustifica.
       Richiesta di Valerio, 13/08: «spiegami pezzo per pezzo come lavora
       il nostro motore, indicami tutte le fonti, dalla A alla Z cosa
       succede quando uno sta facendo il check». */
    chiave: "motore",
    href: "/admin/motore",
    nome: "Il motore",
    sotto: "Con cosa lavoriamo: le fonti una per una, il giro di un'analisi, e cosa c'è nel database.",
  },
  {
    chiave: "panoramica",
    href: "/admin",
    nome: "Panoramica",
    sotto: "I soldi, il percorso delle persone e come sta andando la settimana.",
  },
  {
    /* Accanto ai Verdetti: è l'altra coda che vuole il tuo occhio. Approvi
       una recensione e compare in landing da sola (richiesta di Valerio,
       15/08: «qualsiasi recensione io devo vederla e approvarla»). */
    chiave: "recensioni",
    href: "/admin/recensioni",
    nome: "Recensioni",
    sotto: "Cosa scrivono le persone. Approva e compare in landing; nascondi e sparisce.",
  },
  {
    chiave: "pratiche",
    href: "/admin/pratiche",
    nome: "Pratiche",
    sotto: "Chi ha pagato e a che punto è. In fondo, il controllo a campione dei verdetti.",
  },
  {
    /* Traffico e Passaparola erano due metà della stessa domanda, «come
       cresce Rivolio»: quanti arrivano e da dove, e quanti ne portano
       altri. Fuse in una sola sezione (Valerio, 26/08). */
    chiave: "crescita",
    href: "/admin/crescita",
    nome: "Crescita",
    sotto: "Da dove arriva la gente, e il passaparola che la moltiplica: visite, canali, inviti, recensioni.",
  },
  {
    /* L'altro pezzo della crescita, con la sua sala di controllo: i creator
       che mandano traffico in cambio di una commissione (40% di default).
       Qui si creano, si copia il loro link e si vede quanto è maturato e
       quanto devi. */
    chiave: "affiliati",
    href: "/admin/affiliati",
    nome: "Affiliati",
    sotto: "I creator: il loro link, quanto hanno portato e quanto gli devi. Il pagamento è a mano.",
  },
  {
    chiave: "registro",
    href: "/admin/registro",
    nome: "Registro",
    sotto: "Tutti i fatti in diretta, dal più recente. Si filtra per tipo.",
  },
  {
    chiave: "iscritti",
    href: "/admin/iscritti",
    nome: "Iscritti",
    sotto: "L'Osservatorio: chi si è iscritto, chi ha confermato, chi se ne è andato.",
  },
  {
    /* ⚠️ Sta QUI dentro e non fra le voci di servizio in fondo alla
       barra. Prima "Vedi il sito" e "La web app" erano due link staccati
       e l'app non c'era proprio: tre cose che il cliente vede, sparse in
       due posti e una mancante. Adesso c'è un posto solo, e il giorno
       che nasce una quarta superficie si sa dove metterla. */
    chiave: "prodotto",
    href: "/admin/prodotto",
    nome: "Prodotto",
    sotto: "Le tre cose che vede il cliente: il sito, la web app e l'app. Aprile e guardale.",
  },
  {
    chiave: "impostazioni",
    href: "/admin/impostazioni",
    nome: "Impostazioni",
    sotto: "Cosa c'è su Netlify, spiegato, e cosa succede se manca.",
  },
];

/**
 * La sezione aperta adesso.
 *
 * ⚠️ Si prende la corrispondenza PIÙ LUNGA. Con un banale "inizia per",
 * `/admin` (che è il prefisso di tutti) vincerebbe sempre e la voce
 * attiva resterebbe Panoramica su ogni pagina.
 *
 * 🔴 MA PRIMA ERA ROTTO AL CONTRARIO (Valerio, 16/08: «quando clicco
 * Panoramica si apre insieme la sezione della Mappa»). La colpa: si partiva
 * da `SEZIONI[0]` (la Mappa, href `/admin/mappa`, lunga 12) e si sostituiva
 * solo con una corrispondenza almeno ALTRETTANTO lunga. Sulla Panoramica
 * (`/admin`, lunga 6) la voce giusta non batteva mai i 12 della Mappa di
 * partenza, così restava selezionata la Mappa: la pagina era la Panoramica,
 * ma il menu e il titolo dicevano «La mappa». Sembravano aperte insieme.
 *
 * Adesso si guardano SOLO le sezioni che davvero corrispondono e si tiene
 * la più lunga fra quelle. Su `/admin` corrisponde solo la Panoramica; su
 * `/admin/mappa` corrispondono Panoramica e Mappa, e vince la Mappa.
 */
export function sezioneDi(percorso: string): Sezione {
  let scelta: Sezione | null = null;
  for (const s of SEZIONI) {
    const dentro = percorso === s.href || percorso.startsWith(s.href + "/");
    if (dentro && (scelta === null || s.href.length > scelta.href.length)) scelta = s;
  }
  /* Fuori da ogni sezione (non dovrebbe capitare): si ripiega sulla
     Panoramica, la casa del pannello, non sulla prima voce dell'elenco. */
  return scelta ?? SEZIONI.find((s) => s.href === "/admin") ?? SEZIONI[0];
}
