/**
 * IL PREZZO DEL CHECK (decisione di Valerio, 11/08).
 *
 * Perché esiste. Il check gratuito è l'unico pezzo del prodotto che non
 * porta un euro, e Valerio deve fare cassa entro ottobre: 1,99 su ogni
 * analisi è un numero piccolo per chi paga e grosso per chi incassa.
 *
 * ⚠️ NASCE SPENTO. Senza `NEXT_PUBLIC_CHECK_PREZZO_ATTIVO=1` fra le
 * variabili, il check è libero: nessun muro, nessun cambiamento per nessuno.
 * L'interruttore resta apposta, come freno d'emergenza: la cassa è Stripe e
 * si accende quando Valerio vuole, senza toccare il codice.
 *
 * IL PREZZO DI LANCIO, e perché è scritto così.
 * "1,99 adesso, poi 4,99" è una promessa sul FUTURO, ed è lecita. Il
 * finto sconto dal passato ("prima 4,99, ora 1,99") in Italia non si può
 * fare: la direttiva Omnibus (d.lgs. 26/2023) impone che il prezzo
 * barrato sia il più basso davvero praticato nei 30 giorni precedenti, e
 * l'AGCM sanziona chi lo inventa. Quindi il prezzo pieno qui sotto è un
 * impegno: quando i posti di lancio finiscono, si alza sul serio.
 *
 * IL TOTALE NON CAMBIA (richiesta di Valerio). Chi paga il check e poi
 * apre la pratica non spende 16,89: i 1,99 si scalano, e il percorso
 * completo resta 14,90 come sempre. Il check a pagamento non è un
 * rincaro travestito, è un anticipo.
 */

import { euro, type Listino } from "@/lib/prezzi";

/**
 * L'INTERRUTTORE. Assente o diverso da "1" = il check resta libero.
 *
 * ⚠️ Il nome comincia con `NEXT_PUBLIC_` per un motivo preciso, non per
 * distrazione: le variabili senza quel prefisso NON arrivano nel
 * browser, e i testi della landing (che sono componenti client) sono
 * rimasti a promettere "gratis" mentre il muro era già acceso sul
 * server. Visto il 11/08 guardando la pagina. Una variabile sola, letta
 * da tutti e due i lati, è l'unico modo perché non si disallineino.
 *
 * Non è un buco di sicurezza: qui il browser decide solo le PAROLE. Il
 * cancello vero sta dentro /api/verifica, sul server, e chi lo cambia
 * dal browser si ritrova comunque il 402.
 */
export const CHECK_A_PAGAMENTO = process.env.NEXT_PUBLIC_CHECK_PREZZO_ATTIVO === "1";

/**
 * SCEGLIE LE PAROLE, secondo l'interruttore.
 *
 * `seSiPaga(pagando, gratis)`. Esiste perché la promessa "il check è
 * gratis" vive in sessanta punti sparsi fra landing, blog, pagine
 * sciopero, guide, email, condizioni d'uso e app: riscriverli a mano il
 * giorno dell'accensione vuol dire dimenticarne la metà, e il sito
 * resterebbe a promettere gratis quello che fa pagare. Passando tutti da
 * qui, l'interruttore che accende il muro riscrive anche le parole, nello
 * stesso istante e nei due versi.
 */
export const seSiPaga = <T,>(pagando: T, gratis: T): T =>
  CHECK_A_PAGAMENTO ? pagando : gratis;

/** Quanto costa un'analisi durante il lancio. */
export const PREZZO_LANCIO = 1.99;

/** Quanto costerà quando i posti di lancio finiscono. È un impegno. */
export const PREZZO_PIENO = 4.99;

/** Quante analisi al prezzo di lancio. Finiti questi, si alza davvero. */
export const POSTI_DI_LANCIO = 500;

/** Quanti check dà un pagamento: uno pagato, uno di cortesia se il primo
 *  esce incerto (vedi `CORTESIA_SU_INCERTO`). */
export const CHECK_PER_PAGAMENTO = 1;

/**
 * SE IL VERDETTO ESCE INCERTO, IL CHECK NON SI CONSUMA.
 * È la difesa contro il problema più caro del cancello all'ingresso: uno
 * paga 1,99 e si sente rispondere "non lo so". Quella è la strada per le
 * recensioni da una stella e per le contestazioni sulla carta, che sono
 * esattamente il motivo per cui un venditore ci guarda storto. Un
 * incerto non è una risposta venduta: il credito resta e si riusa.
 */
export const CORTESIA_SU_INCERTO = true;

/** Quanto vale il pass, in giorni. Chi paga oggi controlla anche domani. */
export const GIORNI_DEL_PASS = 30;

export type PrezzoCheck = {
  /** Il prezzo che si paga adesso. */
  prezzo: number;
  prezzoTesto: string;
  /** Quello a cui si arriverà: si mostra accanto, mai barrato come sconto. */
  prezzoPieno: number;
  prezzoPienoTesto: string;
  /** Vero finché ci sono posti di lancio. */
  inLancio: boolean;
};

/**
 * Il prezzo di adesso, dato quante analisi sono già state pagate.
 * Il conteggio arriva dal database: se non si riesce a leggerlo si serve
 * il prezzo di lancio, che è il più basso. Mai il contrario: far pagare
 * di più per un guasto nostro non si fa.
 */
export function prezzoCheck(analisiGiaPagate: number | null): PrezzoCheck {
  const inLancio = analisiGiaPagate === null || analisiGiaPagate < POSTI_DI_LANCIO;
  const prezzo = inLancio ? PREZZO_LANCIO : PREZZO_PIENO;
  return {
    prezzo,
    prezzoTesto: euro(prezzo),
    prezzoPieno: PREZZO_PIENO,
    prezzoPienoTesto: euro(PREZZO_PIENO),
    inLancio,
  };
}

/**
 * Quanti posti di lancio restano, da mostrare solo se il numero è VERO.
 * Torna null quando il conteggio non si è potuto leggere: un contatore
 * inventato è la cosa che distingue una scarsità onesta da un trucco, e
 * qui si vende trasparenza.
 */
export function postiRimasti(analisiGiaPagate: number | null): number | null {
  if (analisiGiaPagate === null) return null;
  return Math.max(0, POSTI_DI_LANCIO - analisiGiaPagate);
}

/**
 * Il prezzo della pratica per chi ha già pagato l'analisi.
 * Il totale del percorso resta quello del listino: i 1,99 sono un
 * anticipo, non un pedaggio in più.
 */
/**
 * Quanto vale l'anticipo già versato per l'analisi.
 *
 * ⚠️ La ricevuta nel cookie NON porta la cifra pagata, porta l'ordine e
 * quante analisi dà. Qui si usa il prezzo DI LANCIO, che è quello che ha
 * pagato chiunque abbia una ricevuta oggi. Il giorno che i 500 posti
 * finiscono e il prezzo sale, questa cifra va letta dall'ordine vero: chi
 * ha pagato 4,99 deve vedersene scalare 4,99, non 1,99.
 * ⚠️ Sbaglia dalla parte giusta: scalare meno del dovuto è un cliente che
 * protesta e ha ragione; scalare più del dovuto è un buco di cassa.
 */
export function prezzoPagatoPerIlCheck(): number {
  return PREZZO_LANCIO;
}

export function scontoDaCheck(
  listino: Listino,
  giaPagato: number,
): { singola: number; famiglia: number; singolaTesto: string; famigliaTesto: string } {
  const togli = (n: number) => Math.max(0, Math.round((n - giaPagato) * 100) / 100);
  const singola = togli(listino.singola);
  const famiglia = togli(listino.famiglia);
  return {
    singola,
    famiglia,
    singolaTesto: euro(singola),
    famigliaTesto: euro(famiglia),
  };
}
