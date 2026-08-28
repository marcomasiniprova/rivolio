/**
 * IL PREZZO DEL BIGLIETTO, dal testo che scrive l'utente al numero in euro.
 *
 * 🔴 IL DIFETTO CHE CHIUDE (audit del 28/08). Il vecchio parse faceva
 * `Number(testo.replace(",", "."))`, ma in Italia il punto è il separatore
 * delle MIGLIAIA: così "1.500" diventava `Number("1.500")` = 1,5, e un
 * declassamento su un biglietto da 1.500 euro usciva "idoneo, 0€" (il 30%
 * di 1,5 arrotondato). Il cliente pagava la pratica e la lettera gli diceva
 * "0€", cioè non otteneva niente. Le tariffe aeree in italiano si scrivono
 * spesso proprio "1.500" o "2.000".
 *
 * La regola, robusta sui due modi di scrivere un prezzo:
 *  - il separatore decimale è quello PIÙ A DESTRA, ma solo se dopo ha una o
 *    due cifre ("129,90", "129.90" → 129,90);
 *  - un punto (o una virgola) con TRE o più cifre dopo è un separatore di
 *    migliaia, si toglie ("1.500" → 1500, "1.234.567" → 1234567);
 *  - i separatori di migliaia a sinistra del decimale si tolgono sempre
 *    ("1.500,00" → 1500).
 * Torna NaN su un testo senza cifre: chi chiama valida già `> 0` e finito.
 */
export function prezzoInEuro(grezzo: unknown): number {
  const pulito = String(grezzo ?? "").replace(/[^\d.,]/g, "");
  if (!pulito) return NaN;

  const posDecimale = Math.max(pulito.lastIndexOf(","), pulito.lastIndexOf("."));
  const cifreDopo = posDecimale >= 0 ? pulito.length - posDecimale - 1 : 0;

  // Un decimale vero: una o due cifre dopo l'ultimo separatore.
  if (posDecimale >= 0 && cifreDopo >= 1 && cifreDopo <= 2) {
    const intero = pulito.slice(0, posDecimale).replace(/[.,]/g, "");
    const decimali = pulito.slice(posDecimale + 1);
    return Number(`${intero || "0"}.${decimali}`);
  }

  // Nessun decimale credibile: ogni separatore è di migliaia.
  return Number(pulito.replace(/[.,]/g, ""));
}
