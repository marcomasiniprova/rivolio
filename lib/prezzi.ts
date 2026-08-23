/**
 * IL TEST DEI DUE PREZZI (scelta di Valerio, 9/08).
 *
 * Perché si fa. Nessuno sa quanto vale davvero una pratica: 14,90 è il
 * prezzo più aggressivo del mercato, ma su un rimborso da 400 euro anche
 * 24,90 resta sedici volte meno del valore che consegni, e AirHelp per lo
 * stesso lavoro ne trattiene da 100 a 140. Alzare il prezzo taglia del 40%
 * il traffico necessario per lo stesso incasso, ed è la leva più veloce che
 * abbiamo. Ma è una domanda a cui risponde il mercato, non un'opinione:
 * quindi mezzo pubblico vede un prezzo, mezzo l'altro.
 *
 * COME SI LEGGE IL RISULTATO, senza tabelle nuove nel database. La divisione
 * è 50 e 50 e la fa una moneta, quindi quanti hanno VISTO i due prezzi è
 * lo stesso numero: basta contare le vendite. Se la variante B vende più
 * della metà di A, ha già vinto (a 24,90 ne bastano 60 per pareggiare 100
 * vendite da 14,90). Il prodotto comprato dice da solo in che
 * variante era il cliente: nessuna migrazione, nessuna colonna in più.
 *
 * ⚠️ Con Stripe il prezzo lo scriviamo noi in linea (price_data): non ci
 * sono prodotti da creare a mano da nessuna parte, e la variante A/B si
 * decide qui nel codice. Il test resta comunque spento (vedi sotto).
 */

/**
 * ⚠️ IL TEST È SPENTO (scelta di Valerio, 11/08), e il motivo è la
 * velocità della landing.
 *
 * Per sapere quale dei due prezzi mostrare bisogna leggere un cookie, e
 * una pagina che legge un cookie **va ricostruita a ogni visita**: non
 * può essere consegnata già pronta dalla rete di distribuzione. La
 * landing è la pagina che vede più gente, quindi quel costo lo paga
 * ognuno che arriva.
 *
 * E in cambio oggi non si misura niente: senza un venditore il test non
 * ha mai prodotto una vendita, quindi non c'è nessun risultato da
 * perdere. Il giorno che l'incasso esiste si rimette `true` e riparte
 * tutto: il meccanismo resta scritto, non è stato buttato.
 */
export const TEST_DUE_PREZZI = false;

export type Variante = "a" | "b";

/** Il cookie che tiene la persona sullo stesso prezzo, sempre. */
export const COOKIE_PREZZO = "rivolio_prezzo";

export type Listino = {
  singola: number;
  famiglia: number;
  /** Le stesse cifre già scritte come le legge una persona. */
  singolaTesto: string;
  famigliaTesto: string;
};

const listino = (singola: number, famiglia: number): Listino => ({
  singola,
  famiglia,
  singolaTesto: euro(singola),
  famigliaTesto: euro(famiglia),
});

/** "14,90€". Mai il punto decimale: qui si scrive in italiano. */
export function euro(n: number): string {
  return `${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€`;
}

export const LISTINI: Record<Variante, Listino> = {
  /* I prezzi di lancio decisi da Valerio (22/08), su misura per i margini
     con la commissione affiliati al 30%: singola 16,90, famiglia 29,90. */
  a: listino(16.9, 29.9),
  b: listino(24.9, 39.9),
};

/** Il listino di sempre: quello che si usa dove la variante non arriva. */
export const LISTINO_BASE = LISTINI.a;

export function listinoDi(variante: Variante | null | undefined): Listino {
  return variante === "b" ? LISTINI.b : LISTINI.a;
}

/** Una variante valida, o `null` se il valore non è dei nostri. */
export function varianteValida(v: string | null | undefined): Variante | null {
  return v === "a" || v === "b" ? v : null;
}

/**
 * La moneta. Si tira UNA volta per visitatore e il risultato resta nel
 * cookie: chi vede 24,90 sulla landing deve trovare 24,90 anche alla cassa,
 * se no il test misura la nostra incoerenza invece del prezzo.
 */
export function tiraLaMoneta(): Variante {
  return Math.random() < 0.5 ? "a" : "b";
}

/**
 * Il conto del confronto coi portali, ricalcolato sul prezzo che quella
 * persona sta vedendo. Su una compensazione da 600 euro un portale al 35%
 * ne trattiene 210; noi tratteniamo il prezzo della pratica.
 */
export function confronto(listino: Listino) {
  const compensazione = 600;
  const quotaPortale = 0.35;
  const trattenutoPortale = Math.round(compensazione * quotaPortale);
  return {
    compensazione,
    trattenutoPortale,
    restanoPortale: compensazione - trattenutoPortale,
    trattenutoNostro: listino.singola,
    restanoNostro: Math.round((compensazione - listino.singola) * 100) / 100,
  };
}

/**
 * Quanto ha pagato IN TUTTO chi ha aperto questa pratica, ed è la cifra che
 * la garanzia rimborsa se la compagnia non paga.
 *
 * Il totale del percorso è sempre il prezzo pieno del listino (i 1,99 del
 * check si scalano dalla pratica, non si aggiungono): quindi il rimborso è
 * `listino.singola` (16,90) o `listino.famiglia` (29,90), non un numero
 * scritto a mano che il giorno di un cambio prezzo diverge in silenzio.
 * Prima "14,90" era fisso in quattro punti: la famiglia si vedeva promettere
 * meno del versato.
 */
export function rimborsoGaranzia(
  tipo: "singola" | "famiglia",
  listino: Listino = LISTINO_BASE,
): number {
  return tipo === "famiglia" ? listino.famiglia : listino.singola;
}
