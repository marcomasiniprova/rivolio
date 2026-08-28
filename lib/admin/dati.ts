/**
 * LE LETTURE DEL PANNELLO.
 *
 * Stessa regola del registro: **non lanciano mai** e, quando un numero
 * non si riesce a leggere, tornano `null` invece di zero. È la differenza
 * fra «oggi non è venuto nessuno» e «non sono riuscito a guardare», e
 * sono due cose che portano a due decisioni opposte.
 *
 * Qui dentro sta solo quello che serve a PIÙ di una schermata. Le letture
 * di una sezione sola restano nella sua pagina: spostarle qui creerebbe
 * un file che cresce a ogni giro e che nessuno riesce più a leggere.
 */

/** Un conteggio che sa dire di non sapere. */
export type Numero = number | null;

/**
 * La mezzanotte italiana di oggi, come istante UTC.
 *
 * ⚠️ Serve perché i contatori "di oggi" devono seguire il giorno di chi
 * guarda il pannello: su Netlify l'orologio del server è a Londra, e
 * senza questo conto un'analisi fatta all'una di notte finirebbe nel
 * giorno prima.
 */
export function inizioOggiRoma(): string {
  const giorno = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Rome" });
  const mezzodiUtc = new Date(`${giorno}T12:00:00Z`);
  const oraRoma = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Rome",
      hour: "2-digit",
      hour12: false,
    }).format(mezzodiUtc),
  );
  const scarto = oraRoma - 12; // +1 d'inverno, +2 d'estate
  return new Date(Date.parse(`${giorno}T00:00:00Z`) - scarto * 3_600_000).toISOString();
}

/** La data, come la scrive un italiano. Regge sia "2026-08-11" sia l'ISO pieno. */
export const dataIt = (iso: string) =>
  new Date(iso.length === 10 ? iso + "T12:00:00Z" : iso).toLocaleDateString("it-IT", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/Rome",
  });

/** L'ora italiana, per le righe del registro. */
export const oraIt = new Intl.DateTimeFormat("it-IT", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  timeZone: "Europe/Rome",
});
