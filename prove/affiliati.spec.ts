import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scontoAffiliato, type Affiliato } from "../lib/affiliati/affiliati";
import { listinoScontato } from "../lib/pratiche/prezzo";
import type { Listino } from "../lib/prezzi";

/**
 * GLI AFFILIATI. Prove sui due punti che, se si rompono, costano: il conto
 * dello sconto (il bottone e la cassa devono dire lo stesso prezzo) e il
 * filo che lega la vendita al creator (senza, o non si paga la commissione,
 * o la si paga due volte).
 */

const RADICE = join(__dirname, "..");
const leggi = (f: string) => readFileSync(join(RADICE, f), "utf8");

const MARCO: Affiliato = {
  id: "x",
  codice: "MARCO",
  nome: "Marco",
  commissione_percento: 30,
  sconto_percento: 10,
};
const LISTINO: Listino = { singola: 16.9, famiglia: 29.9, singolaTesto: "", famigliaTesto: "" };

test.describe("Gli affiliati", () => {
  test("sconto del creator e anticipo del check si sommano, ai centesimi", () => {
    expect(scontoAffiliato(16.9, MARCO)).toBeCloseTo(15.21, 2); // 16,90 meno 10%
    expect(scontoAffiliato(16.9, null)).toBe(16.9); // niente creator, niente sconto

    // Col creator (10%) e l'anticipo del check (1,99): 16,90 -> 15,21 -> 13,22.
    expect(listinoScontato(LISTINO, { affiliato: MARCO, scalaCheck: 1.99 }).singola).toBeCloseTo(
      13.22,
      2,
    );
    // Solo l'anticipo del check, senza creator: 16,90 -> 14,91.
    expect(listinoScontato(LISTINO, { affiliato: null, scalaCheck: 1.99 }).singola).toBeCloseTo(
      14.91,
      2,
    );
    // Mai sotto zero, per costruzione.
    expect(listinoScontato(LISTINO, { affiliato: null, scalaCheck: 999 }).singola).toBe(0);
  });

  test("la commissione è idempotente: un webhook doppio non la raddoppia", () => {
    const c = leggi("lib/affiliati/commissioni.ts");
    // Il riferimento (id sessione Stripe) è la chiave: il duplicato si ignora.
    expect(c).toContain("riferimento");
    expect(c).toContain('error.code !== "23505"');
  });

  test("il checkout aggancia il creator e ne sconta il prezzo", () => {
    const r = leggi("app/api/pratiche/checkout/route.ts");
    expect(r).toContain("listinoScontato");
    expect(r).toContain("metadata.ref = affiliato.codice");
  });

  test("il webhook riavvolge il creator e segna la commissione", () => {
    expect(leggi("app/api/stripe/webhook/route.ts")).toContain("ref");
    expect(leggi("lib/pratiche/evasione.ts")).toContain("registraCommissione");
  });

  test("il prezzo del bottone e quello della cassa vengono dalla STESSA funzione", () => {
    // Se divergessero, il cliente vedrebbe un prezzo e ne pagherebbe un altro:
    // è il motivo per cui uno chiude la pagina.
    expect(leggi("app/verifica/contenuto.tsx")).toContain("listinoScontato");
    expect(leggi("app/api/pratiche/checkout/route.ts")).toContain("listinoScontato");
  });

  test("il link del creator si cattura nel middleware, in un cookie", () => {
    const p = leggi("proxy.ts");
    expect(p).toContain("codiceAffiliatoValido");
    expect(p).toContain("COOKIE_REF");
  });
});

/**
 * I CREATOR GRATIS A VITA. Il permesso è un flag sull'account, quindi la cosa
 * che lo tiene sicuro è UNA: si legge dal server, mai dal browser. Se qualcuno
 * un domani lo legge da un header o da un cookie, è un aggiramento aperto a
 * tutti. Queste prove non si vedono cliccando: si vedono solo leggendo il
 * codice, ed è lì che rientrerebbero dalla finestra.
 */
test.describe("I creator gratis a vita", () => {
  test("il flag si legge dal database, non da una parola del browser", () => {
    const c = leggi("lib/affiliati/creatore.ts");
    // Dal profilo, con la chiave di servizio: è il solo modo per cui un utente
    // non se lo può dare da solo.
    expect(c).toContain("supabaseServizio");
    expect(c).toContain('.select("creator")');
    // Mai da un header o da un cookie: quello sì che sarebbe un aggiramento.
    expect(c).not.toMatch(/headers\.get|cookies\.get|req\.headers/);
  });

  test("il muro del check salta SOLO per un creator vero (lato server)", () => {
    const r = leggi("app/api/verifica/route.ts");
    expect(r).toContain("utenteCreatore");
    // La bypass sta dentro il ramo del muro: se non c'è un creator, il muro resta.
    expect(r).toMatch(/if\s*\(!\(await utenteCreatore\(req\)\)\)/);
  });

  test("la pratica gratis del creator nasce DOPO il cancello, non prima", () => {
    const r = leggi("app/api/pratiche/checkout/route.ts");
    const gate = r.indexOf('conferma === "corretta"');
    const creator = r.indexOf("utenteCreatore(req)");
    expect(gate).toBeGreaterThan(-1);
    expect(creator).toBeGreaterThan(-1);
    // Un creator non apre una pratica su un verdetto non idoneo o corretto a mano.
    expect(creator).toBeGreaterThan(gate);
    // E la apre a prezzo zero, mai a un prezzo qualsiasi.
    expect(r).toContain("prezzo_pagato: 0");
  });
});
