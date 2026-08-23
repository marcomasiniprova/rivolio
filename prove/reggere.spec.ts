import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { test, expect } from "@playwright/test";

/**
 * LE DUE COSE CHE SI ROMPONO CON MILLE PERSONE.
 *
 * Scelte di Valerio col popup del 13/08, nate dalla domanda «sono pronto
 * a mandare 1.000 persone oggi?».
 *
 * 🔴 IL PRIMO BUCO ERA IL PEGGIORE E NON LO VEDEVA NESSUNO: la rotta che
 * manda il sollecito al giorno 42, la segnalazione all'ente al 56 e la
 * domanda «com'è andata?» al 90 esisteva, funzionava e aveva le sue
 * prove, ma **nessun orologio la chiamava**. Girava solo premendo un
 * bottone nel pannello. Un prodotto che promette promemoria automatici e
 * non li manda non dà errore: semplicemente non succede niente, e il
 * cliente pensa di essere stato dimenticato.
 *
 * 🔴 IL SECONDO: il freno anti-abuso viveva nella memoria di una singola
 * copia della funzione, e Netlify ne accende molte insieme. Il tetto di
 * «20 al minuto» era in realtà 20 per ogni copia accesa.
 */

const RADICE = join(__dirname, "..");
const leggi = (p: string) => readFileSync(join(RADICE, p), "utf8");

test.describe("I promemoria partono da soli", () => {
  test("esiste l'orologio che chiama la rotta dei promemoria", () => {
    const f = "netlify/functions/segui.mjs";
    expect(existsSync(join(RADICE, f)), "manca la sveglia dei promemoria").toBe(true);
    const testo = leggi(f);
    expect(testo).toContain("/api/motore/segui");
    expect(testo).toMatch(/schedule:\s*"[^"]+"/);
  });

  test("ogni lavoro automatico che esiste ha il suo orologio", () => {
    /* La regola generale, che avrebbe preso il buco il giorno che è
       nato: se in app/api/motore c'è una rotta, da qualche parte deve
       esserci qualcuno che la chiama. */
    const rotte = readdirSync(join(RADICE, "app/api/motore"), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    const sveglie = readdirSync(join(RADICE, "netlify/functions"))
      .filter((f) => f.endsWith(".mjs"))
      .map((f) => leggi(`netlify/functions/${f}`))
      .join("\n");
    /* `abbina` e `raccogli` sono eredità del prodotto viaggi: non hanno
       un orologio e non devono averlo. Ogni altra voce sì. */
    const eredita = new Set(["abbina", "raccogli"]);
    const senzaOrologio = rotte.filter(
      (r) => !eredita.has(r) && !sveglie.includes(`/api/motore/${r}`),
    );
    expect(
      senzaOrologio,
      `queste rotte automatiche non le chiama nessuno: ${senzaOrologio.join(", ")}`,
    ).toEqual([]);
  });

  test("l'orologio non parte insieme agli altri", () => {
    /* Due giri nella stessa ora si contendono le stesse funzioni e lo
       stesso database, e il budget di 8 secondi lo paga chi arriva
       secondo. */
    const ore = readdirSync(join(RADICE, "netlify/functions"))
      .filter((f) => f.endsWith(".mjs"))
      .map((f) => leggi(`netlify/functions/${f}`).match(/schedule:\s*"(\d+)\s+(\d+)/))
      .filter(Boolean)
      .map((m) => `${m![2]}:${m![1]}`);
    expect(new Set(ore).size, `due sveglie alla stessa ora: ${ore.join(", ")}`).toBe(ore.length);
  });

  test("un giorno saltato non perde niente: il calendario è sulla data d'invio", () => {
    /* È la ragione per cui accendere questa sveglia è sicuro. Se il
       calendario fosse «ieri», un giro saltato salterebbe quelle email
       per sempre. */
    const rotta = leggi("app/api/motore/segui/route.ts");
    expect(rotta).toContain("inviata_il");
    // E la memoria che impedisce il doppio invio.
    expect(rotta).toContain("eventiRegistrati");
  });

  test("il benvenuto pagato non si perde: il cron lo recupera se non è mai partito", () => {
    /* 🔴 IL BUCO: il benvenuto (T+0, col link magico per entrare) lo manda
       solo il webhook di Stripe. Se in quel momento Resend è giù, la pratica
       resta pagata SENZA il link, e la persona non trova quello che ha
       comprato. Il cron deve rimandarlo: pratica pagata + nessun evento
       `email_t0` → si rimanda `praticaPronta`. */
    const rotta = leggi("app/api/motore/segui/route.ts");
    expect(rotta).toContain("recuperaBenvenuto");
    expect(rotta).toContain("praticaPronta");
    expect(rotta).toContain("email_t0");
    // Ha la precedenza: si prova PRIMA del passo di follow-up, con un continue.
    const i = rotta.indexOf("recuperaBenvenuto(pr, fatti)");
    const j = rotta.indexOf("passoDovuto(pr, fatti)");
    expect(i).toBeGreaterThan(0);
    expect(j).toBeGreaterThan(i);
  });
});

test.describe("Il freno regge anche con tanta gente", () => {
  test("le rotte che ci costano soldi usano il freno condiviso", () => {
    const care = [
      "app/api/verifica/route.ts",
      "app/api/leggi-carta/route.ts",
      "app/api/voli-tratta/route.ts",
      "app/api/pratiche/[id]/documento/route.ts",
      "app/api/pratiche/[id]/risposta/route.ts",
    ];
    for (const f of care) {
      expect(leggi(f), `${f} usa ancora solo il contatore in memoria`).toContain(
        "oltreIlLimiteCondiviso",
      );
    }
  });

  test("senza configurazione non blocca nessuno: ripiega, non chiude", () => {
    /* Un freno rotto che chiude il sito a tutti fa più danni di un freno
       assente: il primo ferma le vendite, il secondo costa qualche euro. */
    const testo = leggi("lib/api/limite.ts");
    const i = testo.indexOf("export async function oltreIlLimiteCondiviso");
    expect(i).toBeGreaterThan(0);
    const corpo = testo.slice(i);
    expect(corpo).toContain("if (n === null) return oltreIlLimite(");
  });

  test("il contatore scade da solo, se no dopo un'ora non passa più nessuno", () => {
    expect(leggi("lib/api/limite.ts")).toContain('"EXPIRE"');
  });

  test("l'attesa massima è breve: la paga chi sta aspettando il verdetto", () => {
    const testo = leggi("lib/api/limite.ts");
    const m = testo.match(/AbortSignal\.timeout\((\d+)\)/);
    expect(m).not.toBeNull();
    expect(Number(m![1])).toBeLessThanOrEqual(2000);
  });

  test("le due variabili nuove sono spiegate nel pannello", () => {
    /* Una variabile che nessuno sa di dover mettere è una variabile che
       non verrà messa mai. */
    const pagina = leggi("app/admin/impostazioni/page.tsx");
    expect(pagina).toContain("UPSTASH_REDIS_REST_URL");
    expect(pagina).toContain("UPSTASH_REDIS_REST_TOKEN");
  });
});
