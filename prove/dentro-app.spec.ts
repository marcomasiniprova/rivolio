import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";
import { ingressoDopoPagamento } from "../lib/pratiche/ingresso";

/**
 * CHI È COLLEGATO NON DEVE USCIRE DALLA WEB APP.
 *
 * 🔴 Valerio, 13/08: «quando rifai un'altra analisi loggato nella web app
 * e paghi, vieni fatto uscire dalla web app e fatto ritornare nel sito».
 *
 * Le cause erano due, in due punti lontani:
 * 1. la pagina del verdetto aveva una sola uscita, `/`, cioè la landing
 *    di vendita: chi ha già un account finiva sulla pagina che serve a
 *    convincere gli estranei;
 * 2. dopo il pagamento si passava SEMPRE dal link di accesso, che esce
 *    su supabase.co e rientra da `/auth/conferma`. Per chi la sessione
 *    ce l'aveva già era un giro fuori casa per rientrare in casa, e per
 *    chi era collegato con un altro indirizzo era pure un cambio di
 *    account fatto di nascosto.
 */

const RADICE = join(__dirname, "..");
const leggi = (p: string) => readFileSync(join(RADICE, p), "utf8");

test.describe("Dopo il pagamento", () => {
  test("con la sessione giusta si va dritti alla pratica, senza uscire dal sito", async () => {
    const dove = await ingressoDopoPagamento(
      "trec.tun@gmail.com",
      "/pratica/abc",
      "trec.tun@gmail.com",
    );
    expect(dove).toBe("/pratica/abc");
    expect(dove.startsWith("http")).toBe(false);
  });

  test("le maiuscole non contano: è la stessa persona", async () => {
    const dove = await ingressoDopoPagamento("Mario@Gmail.com", "/pratica/abc", "mario@gmail.com");
    expect(dove).toBe("/pratica/abc");
  });

  test("🔴 senza sessione il browser NON entra: il link va nella posta", async () => {
    /* IL BUCO DELL'ACCOUNT (Valerio, 16/08). Prima questa prova pretendeva
       il contrario: che senza sessione si tornasse il LINK DI ACCESSO
       (`startsWith("http")`, col gettone). Ma quel link, dato al browser di
       chi paga, lo faceva entrare come quell'email SENZA possederla: un
       furto d'account. Adesso il gettone va nella POSTA di quell'indirizzo
       e il browser va su «controlla la posta». */
    const dove = await ingressoDopoPagamento("chi@esempio.it", "/pratica/abc", null);
    // Niente ingresso automatico nella pratica.
    expect(dove).not.toBe("/pratica/abc");
    // Si va sulla pagina «controlla la posta».
    expect(dove).toContain("/entra?pratica=1");
    // E MAI un indirizzo che consegna il gettone al browser.
    expect(dove).not.toContain("token_hash");
    expect(dove).not.toContain("/auth/conferma");
    expect(dove.startsWith("http")).toBe(false);
  });

  test("🔴 collegato con un ALTRO indirizzo: non si entra nell'account altrui", async () => {
    const dove = await ingressoDopoPagamento(
      "moglie@gmail.com",
      "/pratica/abc",
      "marito@gmail.com",
    );
    // Non è la sua sessione: niente ingresso automatico, si passa dalla posta.
    expect(dove).not.toBe("/pratica/abc");
    expect(dove).toContain("/entra?pratica=1");
  });
});

test.describe("La pagina del verdetto sa chi sta guardando", () => {
  test("l'uscita in alto porta alla web app se sei collegato, alla landing se no", () => {
    // Dal 14/08 il cuore della pagina è in contenuto.tsx (indirizzo pulito):
    // /verifica/[id] è un guscio che lo richiama. Il comportamento è lì.
    const testo = leggi("app/verifica/contenuto.tsx");
    expect(testo).toContain('href={collegato ? "/app" : "/"}');
  });

  test("il collegamento si legge dalla sessione, non da un parametro nell'indirizzo", () => {
    /* Un `?da=app` si perde al primo rimbalzo e si falsifica a mano.
       Chi sta guardando lo dice la sessione. */
    // Dal 14/08 il cuore della pagina è in contenuto.tsx (indirizzo pulito):
    // /verifica/[id] è un guscio che lo richiama. Il comportamento è lì.
    const testo = leggi("app/verifica/contenuto.tsx");
    expect(testo).toContain("await utenteCollegato()");
  });
});
