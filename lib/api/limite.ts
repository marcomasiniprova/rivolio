/**
 * Tetto elementare di richieste per IP, condiviso dalle rotte pubbliche.
 *
 * Onestà su quanto vale: la memoria è quella dell'istanza della funzione
 * Netlify, sparisce a ogni cold start e non è condivisa fra istanze
 * parallele. Ferma il curl in loop di un curioso, non un attacco
 * distribuito. La spesa vera, quella che si paga a chiamata, la protegge
 * il tetto sul fornitore (`lib/api/tetto-fornitore.ts`), che conta le
 * chiamate reali in tutto il sito e non le richieste per IP.
 */

const FINESTRA_MS = 60_000;
const contatori = new Map<string, number[]>();

/**
 * L'IP dagli header. Funziona sia da una Request (le rotte API) sia dagli
 * header di una server action (`headers()` di next/headers): entrambi
 * espongono un `.get(nome)`, e il freno del login sta in una server action.
 */
export function ipDaHeaders(h: { get(nome: string): string | null }): string {
  const grezzo = h.get("x-nf-client-connection-ip") ?? h.get("x-forwarded-for") ?? "sconosciuto";
  return grezzo.split(",")[0].trim();
}

/** L'IP del chiamante: su Netlify sta in x-nf-client-connection-ip. */
export function ipDi(req: Request): string {
  return ipDaHeaders(req.headers);
}

/**
 * true se questo IP ha già superato il tetto nel minuto corrente.
 * `chiave` separa i contatori delle rotte diverse: la ricerca degli
 * aeroporti si digita a raffica, il resto no.
 */
export function oltreIlLimite(chiave: string, ip: string, massimo: number): boolean {
  const adesso = Date.now();
  // La mappa non deve crescere per sempre: ogni tanto si butta via tutto.
  if (contatori.size > 10_000) contatori.clear();
  const id = `${chiave}:${ip}`;
  const recenti = (contatori.get(id) ?? []).filter((t) => adesso - t < FINESTRA_MS);
  recenti.push(adesso);
  contatori.set(id, recenti);
  return recenti.length > massimo;
}

/* L'indirizzo del sito in produzione. Su Netlify NEXT_PUBLIC_SITO è
   impostato; URL lo mette Netlify da solo; in locale si cade su localhost. */
const SITO =
  process.env.NEXT_PUBLIC_SITO ?? process.env.URL ?? "http://localhost:3000";

/**
 * Header CORS. PRIMA era aperto a chiunque (`*`): qualunque sito poteva
 * chiamare il nostro check dal browser di un visitatore e bruciarci i
 * crediti dei dati di volo. Ora l'unica origine ammessa dal browser è la
 * NOSTRA.
 *
 * Perché non rompe niente:
 *  - Il check della landing è same-origin: il browser non applica affatto
 *    il CORS alle richieste verso lo stesso sito, qualunque valore abbia
 *    questo header. Resta identico.
 *  - L'app mobile NATIVA non è un browser: il CORS non la riguarda, chiama
 *    lo stesso. (Il token di sessione viaggia in Authorization, mai in un
 *    cookie, quindi niente credenziali cross-site da proteggere.)
 *  - Un sito qualsiasi che prova a chiamarci dal browser di un ignaro si
 *    becca un'origine diversa dalla sua e la lettura viene bloccata.
 */
export const CORS = {
  "Access-Control-Allow-Origin": SITO,
  Vary: "Origin",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  /* Authorization: l'app manda il token della sua sessione lì dentro, e
     senza il permesso esplicito il browser blocca il preflight. */
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Max-Age": "86400",
} as const;

/**
 * Il freno da usare sulle rotte CHE CI COSTANO SOLDI.
 *
 * ⚠️ FINO AL 26/08 QUESTO FRENO AVEVA UN SECONDO CERVELLO SU REDIS
 * (Upstash), pensato per contare le richieste al di là delle copie della
 * funzione. Non è mai stato acceso: nasceva spento e la spesa vera la
 * protegge già il tetto sul fornitore. Valerio l'ha fatto togliere del
 * tutto (26/08), Redis compreso: un pezzo mai usato è solo una cosa in più
 * che si può rompere.
 *
 * Il nome resta perché lo chiamano una dozzina di rotte con `await`:
 * tenere la firma (una Promise) evita di toccare tutti quei file per una
 * cosa che non cambia comportamento. Oggi è, semplicemente, il contatore
 * in memoria qui sopra. Il giorno che servirà un freno distribuito, si
 * rifà da qui.
 */
export function oltreIlLimiteCondiviso(
  chiave: string,
  ip: string,
  massimo: number,
): Promise<boolean> {
  return Promise.resolve(oltreIlLimite(chiave, ip, massimo));
}
