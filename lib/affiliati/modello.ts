/**
 * IL MODELLO ECONOMICO DEI CREATOR (brief del 26/08).
 *
 * Pura matematica, nessuna dipendenza dal database: la provano le prove e la
 * usano sia il pannello (vista admin) sia la pagina del creator.
 *
 * Il creator prende il 40% sul LORDO di ogni pratica consolidata, più dei
 * bonus a soglie che premiano i numeri tondi, più (per gli accordi ibridi coi
 * creator grandi) un fisso una-tantum al primo contenuto. I margini interni
 * (IVA, Stripe) NON stanno qui: quelli li vede solo Valerio, mai il creator.
 */

import { LISTINO_BASE } from "@/lib/prezzi";

export const PREZZO_SINGOLA = LISTINO_BASE.singola;
export const PREZZO_FAMIGLIA = LISTINO_BASE.famiglia;

/** La percentuale base, sul lordo della pratica. 40% a tutti. */
export const COMMISSIONE_PCT = 0.4;

/** Ogni quanti giorni si salda, a mano, sul consolidato. */
export const GIORNI_PAGAMENTO = 15;

export type RegolaBonus = {
  /** La prima soglia. */
  prima: number;
  /** Il premio alla prima soglia. */
  premioPrima: number;
  /** Poi un premio ogni `passo` vendite. */
  passo: number;
  premio: number;
};

export const BONUS: Record<"singola" | "famiglia" | "check", RegolaBonus> = {
  // singole: 20€ alle 10, poi 50€ ogni 25 (35, 60, 85, ...)
  singola: { prima: 10, premioPrima: 20, passo: 25, premio: 50 },
  // famiglia: 50€ ogni 10 (10, 20, 30, ...)
  famiglia: { prima: 10, premioPrima: 50, passo: 10, premio: 50 },
  // check pagati: 50€ ogni 100
  check: { prima: 100, premioPrima: 50, passo: 100, premio: 50 },
};

/** Il bonus maturato in uno stream a `n` vendite consolidate. */
export function bonusMaturato(n: number, r: RegolaBonus): number {
  if (n < r.prima) return 0;
  return r.premioPrima + Math.floor((n - r.prima) / r.passo) * r.premio;
}

/** Il prossimo bonus dello stream: quante vendite mancano e quanto vale. */
export function prossimoBonus(n: number, r: RegolaBonus): { mancano: number; premio: number } {
  if (n < r.prima) return { mancano: r.prima - n, premio: r.premioPrima };
  const dentro = (n - r.prima) % r.passo;
  return { mancano: r.passo - dentro, premio: r.premio };
}

/**
 * Il progresso verso il prossimo bonus, per la barra da sbloccare.
 * `sbloccati` = quanti bonus gia' presi; `dentro`/`segmento` = posizione
 * nella barra corrente; `mancano`/`premio` = quanto resta e cosa si vince.
 */
export function progressoBonus(
  n: number,
  r: RegolaBonus,
): {
  sbloccati: number;
  prossimaSoglia: number;
  dentro: number;
  segmento: number;
  premio: number;
  mancano: number;
} {
  const sbloccati = n < r.prima ? 0 : 1 + Math.floor((n - r.prima) / r.passo);
  const p = prossimoBonus(n, r);
  const segmento = n < r.prima ? r.prima : r.passo;
  return {
    sbloccati,
    prossimaSoglia: n + p.mancano,
    dentro: segmento - p.mancano,
    segmento,
    premio: p.premio,
    mancano: p.mancano,
  };
}

export type Conteggi = { singola: number; famiglia: number; check: number };

/** Tutti i bonus maturati, per stream e in totale. */
export function bonusiDi(c: Conteggi) {
  const singola = bonusMaturato(c.singola, BONUS.singola);
  const famiglia = bonusMaturato(c.famiglia, BONUS.famiglia);
  const check = bonusMaturato(c.check, BONUS.check);
  return { singola, famiglia, check, totale: singola + famiglia + check };
}

/** Il prossimo bonus di ogni stream (per spingere il creator verso la soglia). */
export function prossimiBonus(c: Conteggi) {
  return {
    singola: prossimoBonus(c.singola, BONUS.singola),
    famiglia: prossimoBonus(c.famiglia, BONUS.famiglia),
    check: prossimoBonus(c.check, BONUS.check),
  };
}
