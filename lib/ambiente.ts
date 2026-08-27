/**
 * L'AMBIENTE: sito vero o gemello di prova (27/08).
 *
 * Rivolio vive in due copie che condividono lo stesso database:
 * - la PRODUZIONE (ramo `main`), il sito vero su rivolio.it;
 * - il GEMELLO (ramo `staging`), la lavagna dove si prova prima.
 *
 * Questo file dice, a runtime, in quale delle due siamo. Serve a far sì che
 * il gemello NON infetti il sito vero: niente chiamate al fornitore a
 * pagamento, niente incassi veri, niente eventi nei numeri del pannello,
 * niente link che rimbalzano sul dominio vero.
 *
 * 🔴 REGOLA D'ORO: IL DEFAULT È SEMPRE LA PRODUZIONE. `AMBIENTE_PROVA` è vero
 * SOLO se un segnale esplicito lo dice. Qualsiasi dubbio (variabili assenti,
 * locale, valore sconosciuto) vuol dire «sito vero». Così un errore o una
 * variabile mancante non possono MAI mettere la produzione in modalità prova
 * (che sarebbe il disastro: clienti veri serviti con dati demo). Si sbaglia
 * sempre dalla parte del sito vero.
 *
 * Tre segnali, dal più affidabile al meno:
 * 1. `RIVOLIO_PROVA` = "1" o "0": la variabile che mettiamo NOI sul contesto
 *    del ramo su Netlify. È l'unica garantita a runtime, quindi vince su
 *    tutto. "0" forza la produzione anche se il resto dicesse prova.
 * 2. `CONTEXT` di Netlify: "branch-deploy" o "deploy-preview" = prova.
 * 3. `BRANCH` di Netlify: un ramo diverso da `main` = prova.
 * Se nessuno dei tre parla, è produzione.
 */
function calcolaProva(): boolean {
  const esplicito = process.env.RIVOLIO_PROVA?.trim();
  if (esplicito === "1") return true;
  if (esplicito === "0") return false;

  const contesto = process.env.CONTEXT?.trim();
  if (contesto === "branch-deploy" || contesto === "deploy-preview") return true;
  /* Se il contesto c'è ed è "production", è il sito vero: non guardare oltre. */
  if (contesto === "production") return false;

  const ramo = process.env.BRANCH?.trim();
  if (ramo && ramo !== "main") return true;

  return false;
}

/** Vero SOLO sul gemello (staging) e sulle anteprime. Mai in produzione. */
export const AMBIENTE_PROVA = calcolaProva();
