/**
 * GLI STATI DI UNA PRATICA, tradotti per il pannello (giro #96).
 *
 * Il pannello prima mostrava lo stato grezzo del database ("sollecito",
 * "esito_pagata"): parole nostre, che a colpo d'occhio non dicono di chi è
 * la palla. Qui ogni stato diventa una frase umana e un GRUPPO: da mandare,
 * in attesa della compagnia, vinta, chiusa. Il pannello raggruppa e colora
 * su questo, non sul nome grezzo.
 *
 * Sta da solo perché lo leggono sia la pagina (server, per i conteggi veri
 * dal database) sia l'elenco (client, per filtri e badge): un posto solo,
 * così i due non possono raccontare due verità diverse.
 */

export type GruppoPratica = "dafare" | "attesa" | "vinta" | "persa";

export type StatoInfo = { chiave: string; nome: string; gruppo: GruppoPratica };

export const STATI_PRATICA: StatoInfo[] = [
  { chiave: "creata", nome: "appena creata", gruppo: "dafare" },
  { chiave: "pagata", nome: "pagata, lettera da mandare", gruppo: "dafare" },
  { chiave: "pronta", nome: "lettera pronta", gruppo: "dafare" },
  { chiave: "inviata", nome: "reclamo inviato", gruppo: "attesa" },
  { chiave: "sollecito", nome: "sollecito mandato", gruppo: "attesa" },
  { chiave: "enac", nome: "segnalata all'ente", gruppo: "attesa" },
  { chiave: "esito_pagata", nome: "la compagnia ha pagato", gruppo: "vinta" },
  { chiave: "esito_rifiutata", nome: "la compagnia ha detto no", gruppo: "persa" },
  { chiave: "rimborsata", nome: "rimborsata con la garanzia", gruppo: "persa" },
];

/** Lo stato di una pratica, con un ripiego che non lancia mai. */
export function statoPratica(chiave: string): StatoInfo {
  return STATI_PRATICA.find((s) => s.chiave === chiave) ?? { chiave, nome: chiave, gruppo: "attesa" };
}

export const GRUPPO_DI: Record<string, GruppoPratica> = Object.fromEntries(
  STATI_PRATICA.map((s) => [s.chiave, s.gruppo]),
);

export type InfoGruppo = { chiave: GruppoPratica; nome: string; palla: string };

/** I quattro gruppi, in ordine di percorso: di chi è la palla. */
export const GRUPPI: InfoGruppo[] = [
  { chiave: "dafare", nome: "Da mandare", palla: "Lettera da mandare" },
  { chiave: "attesa", nome: "In attesa", palla: "Palla alla compagnia" },
  { chiave: "vinta", nome: "Vinte", palla: "Ha pagato" },
  { chiave: "persa", nome: "Chiuse", palla: "Chiusa" },
];
