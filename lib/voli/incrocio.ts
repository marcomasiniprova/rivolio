import { SOGLIA_MINUTI, type FattoVolo } from "@/lib/regole/eu261";

/**
 * L'INCROCIO DI DUE FONTI, per RIDURRE gli incerti senza aprire falsi
 * positivi (scelta di Valerio, 14/08: «aggiungi una seconda fonte, così non
 * perdiamo vendite vere ma non vendiamo false promesse»).
 *
 * Il problema: il primario (AeroDataBox) certifica l'orario di arrivo solo
 * quando il volo era tracciato "Live". Un volo vero e concluso, ma senza
 * quel bollo, oggi esce INCERTO e non si vende, anche quando l'orario c'è.
 *
 * L'idea: due fonti INDIPENDENTI che concordano sull'arrivo effettivo sono
 * un fatto solido quanto un tracciamento. Quando la seconda fonte conferma
 * l'orario del primario, l'orario diventa verificato e il volo si può
 * vendere. Quando le due NON concordano, il caso resta incerto (era già
 * così: è la rete che impedisce di vendere su un dato ballerino).
 *
 * ⚠️ SI CONFRONTA IL RITARDO, NON L'ORARIO ASSOLUTO. È la chiave che rende
 * l'incrocio a prova di fuso orario: il ritardo (arrivo effettivo meno
 * previsto) è lo stesso identico numero sia che la fonte scriva gli orari in
 * UTC sia che li scriva in ora locale, perché il fuso si annulla nella
 * sottrazione. Confrontare gli orari assoluti, invece, farebbe risultare due
 * fonti diverse di ORE su ogni volo appena una delle due è in ora locale, e
 * il motore butterebbe in incerto tutti gli idonei: non un falso positivo,
 * ma una strage di vendite vere. Così no.
 *
 * ⚠️ LA REGOLA NUMERO UNO RESTA INTOCCABILE: mai un falso positivo. Per
 * questo la conferma NON scatta nella ZONA GRIGIA attorno alle 3 ore: lì un
 * errore di pochi minuti, magari condiviso da due fonti che leggono lo
 * stesso feed a monte, sposterebbe l'esito da «non spetta» a «spetta». In
 * quel margine, senza un tracciamento preciso, si resta incerti. Sopra la
 * zona grigia il volo è chiaramente idoneo; sotto è chiaramente non idoneo
 * (e lì non si vende comunque): confermare non rischia niente.
 */

/** Oltre questo scarto (minuti di ritardo) le due fonti si contraddicono. */
export const SCARTO_DISCORDE_MIN = 15;
/** Entro questo scarto (minuti di ritardo) le due fonti si confermano. */
export const SCARTO_CONFERMA_MIN = 10;
/** La zona grigia sopra la soglia in cui NON si conferma per incrocio. */
export const MARGINE_INCROCIO_MIN = 20;

export type EsitoIncrocio = {
  /** Le due fonti non concordano sull'arrivo: il caso resta incerto. */
  discordanti: boolean;
  /** Due fonti d'accordo: l'orario è certo anche senza il "Live" del primario. */
  confermato: boolean;
};

const NIENTE: EsitoIncrocio = { discordanti: false, confermato: false };

/**
 * Confronta il RITARDO del primario con quello della seconda fonte.
 *
 * Dalla seconda fonte servono DUE orari, il previsto e l'effettivo: il loro
 * scarto è il suo ritardo, e si confronta con quello del primario. Se manca
 * uno dei quattro orari (due per fonte) non si può fare il conto: NIENTE.
 * Gli orari della seconda fonte possono essere in qualunque fuso, purché i
 * suoi due siano nello stesso (lo sono sempre: stesso aeroporto, stesso
 * arrivo).
 */
export function incrociaFonti(
  primario: FattoVolo,
  secondaPrevistoUtc: string | null | undefined,
  secondaEffettivoUtc: string | null | undefined,
): EsitoIncrocio {
  /* 🔴 UN PRIMARIO GIÀ CERTO NON SI METTE MAI IN VETO DALLA RISERVA.
     Questo controllo stava DOPO il ramo «si contraddicono»: un volo che il
     primario aveva tracciato Live (fatto solido, idoneo) veniva marcato
     `discordanti` se la riserva sbagliava di un quarto d'ora, verifica.ts
     lo salvava in cache come definitivo, e da lì ogni check di quel volo, di
     chiunque, usciva «incerto» PER SEMPRE: una vendita idonea persa in
     silenzio pur avendo avuto un fatto certo. Adesso, se il primario è già
     verificato, la seconda fonte non serve e non può nemmeno contraddirlo.
     Trovato dall'audit del pannello (26/08). */
  if (primario.orarioVerificato === true) return NIENTE;

  const pPrev = primario.arrivoPrevistoUtc ? Date.parse(primario.arrivoPrevistoUtc) : NaN;
  const pEff = primario.arrivoEffettivoUtc ? Date.parse(primario.arrivoEffettivoUtc) : NaN;
  const sPrev = secondaPrevistoUtc ? Date.parse(secondaPrevistoUtc) : NaN;
  const sEff = secondaEffettivoUtc ? Date.parse(secondaEffettivoUtc) : NaN;
  if (![pPrev, pEff, sPrev, sEff].every((n) => Number.isFinite(n))) return NIENTE;

  const ritardoPrimario = (pEff - pPrev) / 60_000;
  const ritardoSeconda = (sEff - sPrev) / 60_000;
  const scarto = Math.abs(ritardoPrimario - ritardoSeconda);

  // Si contraddicono sul ritardo: non si vende (comportamento storico).
  if (scarto > SCARTO_DISCORDE_MIN) return { discordanti: true, confermato: false };

  // Concordano, ma non abbastanza stretto per promuovere un fatto a certo.
  if (scarto > SCARTO_CONFERMA_MIN) return NIENTE;

  /* La zona grigia: da 180 a 200 minuti. Qui un incrocio non basta, perché
     un errore di pochi minuti cambierebbe l'esito. Si resta incerti. */
  if (
    ritardoPrimario >= SOGLIA_MINUTI &&
    ritardoPrimario < SOGLIA_MINUTI + MARGINE_INCROCIO_MIN
  ) {
    return NIENTE;
  }

  return { discordanti: false, confermato: true };
}
