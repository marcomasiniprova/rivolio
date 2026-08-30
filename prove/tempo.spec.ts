import { test, expect } from "@playwright/test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import {
  dataConGiorno,
  dataIt,
  dataOraIt,
  fraQuanto,
  giorniFra,
  giornoDiRoma,
  giornoPiu,
  oraDiRoma,
} from "../lib/tempo";

/**
 * IL TEMPO NON PUÒ ESSERE SBAGLIATO.
 *
 * 🔴 Valerio, 12/08: «c'è un orario corretto? Una data e ora precisa di
 * riferimento sempre? Nessuna data o conto cannato? Non possiamo dire
 * "inviala domani domenica" quando domani è giovedì».
 *
 * Il tempo è la parte del prodotto dove un errore non si vede finché non
 * lo vede un cliente: nessuna prova fallisce, nessun allarme suona, e il
 * numero sbagliato ha comunque l'aria di un numero. Queste prove tengono
 * ferme le tre cose che possono andare storte.
 */

const RADICE = join(__dirname, "..");
const leggi = (p: string) => readFileSync(join(RADICE, p), "utf8");

test.describe("I giorni si contano sul calendario", () => {
  test("dalle 23:50 alle 00:10 è passato UN giorno, non zero", () => {
    /* È il caso che rompe il conto fatto a colpi di 24 ore: venti minuti
       di orologio, ma il calendario ha girato pagina. Su un conto alla
       rovescia che promette una data a un cliente pagante, un giorno di
       scarto si vede. Gli istanti sono in ora italiana d'estate (UTC+2). */
    expect(giorniFra("2026-08-12T21:50:00Z", "2026-08-12T22:10:00Z")).toBe(1);
  });

  test("ventitré ore dentro lo stesso giorno restano zero", () => {
    expect(giorniFra("2026-08-12T00:30:00Z", "2026-08-12T21:30:00Z")).toBe(0);
  });

  test("indietro nel tempo il conto è negativo, non un valore assoluto", () => {
    expect(giorniFra("2026-08-14T10:00:00Z", "2026-08-12T10:00:00Z")).toBe(-2);
  });

  test("giornoPiu somma giorni di calendario, anche attraverso un mese", () => {
    expect(giornoPiu(42, "2026-08-12T10:00:00Z")).toBe("2026-09-23");
    expect(giornoPiu(1, "2026-12-31T10:00:00Z")).toBe("2027-01-01");
  });

  test("l'ora legale non sposta il conto dei giorni", () => {
    /* L'ultima domenica di ottobre l'Italia torna all'ora solare: quel
       giorno dura 25 ore. Contando i millisecondi, un salto del genere
       manda il conto fuori di uno. */
    expect(giorniFra("2026-10-24T12:00:00Z", "2026-10-26T12:00:00Z")).toBe(2);
    /* E l'ultima domenica di marzo ne dura 23. */
    expect(giorniFra("2026-03-28T12:00:00Z", "2026-03-30T12:00:00Z")).toBe(2);
  });
});

test.describe("Le date si scrivono in ora italiana", () => {
  test("mezzanotte e mezza in Italia è già il giorno dopo", () => {
    /* Alle 22:30 UTC in Italia sono le 00:30 del giorno successivo. Se
       si formattasse in UTC, l'email spedita in quel momento direbbe il
       giorno sbagliato. */
    expect(giornoDiRoma(new Date("2026-08-12T22:30:00Z"))).toBe("2026-08-13");
    expect(dataIt("2026-08-12T22:30:00Z")).toContain("13 agosto");
  });

  test("l'ora di Roma tiene conto dell'ora legale", () => {
    expect(oraDiRoma(new Date("2026-08-12T19:00:00Z"))).toBe(21); // estate, UTC+2
    expect(oraDiRoma(new Date("2026-12-12T19:00:00Z"))).toBe(20); // inverno, UTC+1
  });

  test("un giorno ISO puro non slitta indietro", () => {
    /* "2026-08-12" senza orario: interpretato male diventa l'11 sera. */
    expect(dataIt("2026-08-12")).toBe("12 agosto 2026");
    expect(dataOraIt("2026-08-12T19:00:00Z")).toContain("21:00");
  });
});

test.describe("Il giorno della settimana lo calcola la data, mai una persona", () => {
  test("il 23 settembre 2026 è un mercoledì, e lo dice", () => {
    expect(dataConGiorno("2026-09-23")).toBe("mercoledì 23 settembre 2026");
  });

  test("le parole relative combaciano col numero di giorni", () => {
    expect(fraQuanto(0)).toBe("oggi");
    expect(fraQuanto(1)).toBe("domani");
    expect(fraQuanto(3)).toBe("fra 3 giorni");
  });

  test("oltre la settimana NON si usa una parola: si usa la data", () => {
    /* "fra 42 giorni" non lo colloca nessuno. Tornare null obbliga chi
       chiama a scrivere la data con il suo giorno della settimana. */
    expect(fraQuanto(42)).toBeNull();
    expect(fraQuanto(8)).toBeNull();
  });

  test("chi nomina un giorno della settimana deve calcolarlo da una data", () => {
    /* La richiesta di Valerio, presa alla lettera: se qualcuno scrive
       "domenica" dentro una frase fissa, quella frase sarà sbagliata sei
       giorni su sette.
       Nominarli non è vietato: una tabella di traduzione è legittima
       (`lib/date.ts` ne ha una). Quello che si pretende è che nello
       stesso file ci sia anche il calcolo: `getUTCDay`, `getDay` oppure
       `weekday:` di Intl. Un file che nomina i giorni e non li deriva mai
       da una data li sta scrivendo a mano, e quello è il difetto. */
    const NOME_IN_STRINGA =
      /["'`][^"'`\n]*\b(lunedì|martedì|mercoledì|giovedì|venerdì|sabato|domenica)\b[^"'`\n]*["'`]/i;
    const CALCOLO = /getUTCDay|getDay\(|weekday:/;

    const file: string[] = [];
    const gira = (dir: string) => {
      for (const voce of readdirSync(join(RADICE, dir), { withFileTypes: true })) {
        const p = `${dir}/${voce.name}`;
        if (voce.isDirectory()) gira(p);
        else if (/\.(ts|tsx)$/.test(voce.name)) file.push(p);
      }
    };
    ["lib", "components", "app"].forEach(gira);
    const senzaCommenti = (t: string) =>
      t.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");

    const colpevoli = file.filter((f) => {
      const testo = senzaCommenti(leggi(f));
      return NOME_IN_STRINGA.test(testo) && !CALCOLO.test(testo);
    });
    expect(colpevoli, `scrivono un giorno della settimana a mano: ${colpevoli.join(", ")}`).toEqual(
      [],
    );
  });
});

test.describe("Le sveglie suonano all'ora italiana", () => {
  test("il riepilogo della sera controlla che ore sono in Italia", () => {
    /* 🔴 Era programmato alle 19 UTC "cioè le 21": vero solo d'estate.
       D'inverno sarebbero state le 20, per sei mesi, senza che nessun
       errore lo dicesse. Adesso la sveglia suona a tutte e due le ore
       candidate e la funzione si spegne da sola se non è l'ora giusta. */
    const f = leggi("netlify/functions/riepilogo.mjs");
    expect(f, "deve controllare l'ora italiana").toContain("Europe/Rome");
    expect(f, "deve avere l'ora dichiarata una volta sola").toContain("ORA_DEL_RIEPILOGO");
    expect(f, "deve suonare a entrambe le ore candidate").toContain('schedule: "0 19,20 * * *"');
  });
});
