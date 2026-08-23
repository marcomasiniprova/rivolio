/**
 * DOVE MANDARE CHI TORNA DALLA CASSA STRIPE.
 *
 * 🔴 Valerio, 23/08: «faccio il check dal mio account, sono già loggato, e
 * dopo il pagamento mi dice ancora "controlla la mail per entrare". Quando
 * sono già dentro non serve.» Aveva ragione. Il giro della mail protegge
 * chi NON è loggato: il check non ha account, uno può mettere l'email di un
 * altro, e mandare l'accesso nella posta impedisce il furto d'account. Ma
 * per chi è già loggato con la SUA email quella protezione è già data: è
 * lui, e lo mandavamo a fare un giro inutile.
 *
 * Questa è la decisione, pura e testabile. La pagina si limita a leggere la
 * sessione Stripe e quella dell'utente e a eseguire. La differenza fra "sei
 * tu" e "non sei tu" è tutta nell'email.
 */

export const MAX_ATTESE_PRONTA = 5;

export type DecisionePronta =
  | { azione: "casa" }
  | { azione: "pratica"; id: string }
  | { azione: "attesa"; prossimo: string }
  | { azione: "lista" }
  | { azione: "mail" };

export function decidiPronta(input: {
  /** Il pagamento risulta andato a buon fine su Stripe. */
  pagato: boolean;
  /** L'email che ha pagato (da Stripe). */
  emailPagante: string | null;
  /** L'email dell'account collegato in questo browser, se c'è. */
  emailUtente: string | null | undefined;
  /** L'id della pratica, se il webhook l'ha già creata; null se non ancora. */
  praticaId: string | null;
  /** Quante volte questa pagina si è già ricontrollata da sola. */
  giro: number;
  /** L'indirizzo del prossimo giro d'attesa. */
  prossimo: string;
}): DecisionePronta {
  // Nessun pagamento valido: non c'è niente da mostrare.
  if (!input.pagato) return { azione: "casa" };

  /* Sei loggato con la STESSA email che ha pagato? Allora sei tu: niente
     giro della mail. Il confronto è sull'email, l'unico dato che dice "è la
     stessa persona". */
  const seiTu = Boolean(
    input.emailUtente &&
      input.emailPagante &&
      input.emailUtente.toLowerCase() === input.emailPagante.toLowerCase(),
  );

  /* Non sei loggato, o sei loggato con un'ALTRA email (hai pagato per un
     altro): l'accesso va nella posta di quell'indirizzo, mai aperto qui. È
     la protezione contro il furto d'account (scelta di Valerio, 16/08). */
  if (!seiTu) return { azione: "mail" };

  // Sei tu, e la pratica è pronta: dritto dentro.
  if (input.praticaId) return { azione: "pratica", id: input.praticaId };

  /* Sei tu, ma la pratica non è ancora nata (il webhook è un attimo
     indietro): "un attimo, la preparo", e la pagina si ricontrolla da sola.
     Dopo qualche giro a vuoto, alla lista delle pratiche (rarissimo). */
  if (input.giro < MAX_ATTESE_PRONTA) return { azione: "attesa", prossimo: input.prossimo };
  return { azione: "lista" };
}
