import { test, expect } from "@playwright/test";
import { decidiPronta, MAX_ATTESE_PRONTA } from "../lib/pratiche/pronta";

/**
 * DOPO IL PAGAMENTO: chi è loggato non fa il giro della mail.
 *
 * 🔴 Valerio, 23/08: loggato col suo account, pagava e la pagina diceva
 * ancora "controlla la mail per entrare". Il giro della mail serve solo a
 * chi NON è loggato (protezione contro il furto d'account). Queste prove
 * blindano la differenza, che è tutta nell'email.
 */

const base = {
  pagato: true,
  emailPagante: "mario@esempio.it",
  emailUtente: "mario@esempio.it",
  praticaId: "p1" as string | null,
  giro: 0,
  prossimo: "/pratica/pronta?session_id=cs&t=1",
};

test.describe("Dove atterra chi torna dalla cassa", () => {
  test("loggato con la stessa email e pratica pronta: dritto alla pratica", () => {
    expect(decidiPronta(base)).toEqual({ azione: "pratica", id: "p1" });
  });

  test("la maiuscola non conta: è la stessa persona", () => {
    expect(decidiPronta({ ...base, emailUtente: "Mario@Esempio.IT" })).toEqual({
      azione: "pratica",
      id: "p1",
    });
  });

  test("🔴 NON loggato: giro della mail, mai dritto", () => {
    expect(decidiPronta({ ...base, emailUtente: null })).toEqual({ azione: "mail" });
  });

  test("🔴 loggato con un'ALTRA email (pagato per un altro): mail sicura", () => {
    // Protezione contro il furto d'account: la pratica è dell'altro
    // indirizzo, l'accesso va nella SUA posta.
    expect(decidiPronta({ ...base, emailUtente: "moglie@esempio.it" })).toEqual({
      azione: "mail",
    });
  });

  test("sei tu ma la pratica non è ancora nata: si aspetta e ci si ricontrolla", () => {
    expect(decidiPronta({ ...base, praticaId: null })).toEqual({
      azione: "attesa",
      prossimo: base.prossimo,
    });
  });

  test("l'attesa è finita, non infinita: dall'ultimo giro in poi si va alla lista", () => {
    expect(decidiPronta({ ...base, praticaId: null, giro: MAX_ATTESE_PRONTA - 1 }).azione).toBe(
      "attesa",
    );
    expect(decidiPronta({ ...base, praticaId: null, giro: MAX_ATTESE_PRONTA }).azione).toBe("lista");
  });

  test("pagamento non valido: a casa", () => {
    expect(decidiPronta({ ...base, pagato: false }).azione).toBe("casa");
  });
});
