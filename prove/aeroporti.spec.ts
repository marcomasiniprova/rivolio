import { test, expect } from "@playwright/test";
import aeroporti from "../lib/dati/aeroporti.json";
import { aeroportoPerIata, cercaAeroporti, etichettaScalo } from "../lib/voli/aeroporti";
import type { Aeroporto } from "../lib/voli/distanza";

/**
 * L'ARCHIVIO DEGLI SCALI: nomi che si riconoscono, fusi che ci sono,
 * ricerca che non propone piste private.
 *
 * 🔴 Valerio, 13/08: «stesso discorso per gli aeroporti, non dobbiamo
 * avere buchi, dobbiamo conoscere tutto». I tre buchi erano veri:
 * - il nome mostrato era il COMUNE, e dopo l'aggiornamento automatico
 *   del 10/08 Malpensa era diventata "Ferno";
 * - 3.500 scali su 9.016 non avevano il fuso orario, Doha compresa;
 * - la ricerca mostrava 9.016 voci, di cui 4.456 piste private ed
 *   eliporti, in mezzo agli aeroporti veri.
 */

const ELENCO = aeroporti as unknown as Record<string, Aeroporto>;

test.describe("Come si scrive un aeroporto", () => {
  test("gli scali che vede un italiano si leggono come li dice lui", () => {
    /* Ognuno di questi è un caso diverso, e ognuno rompeva in un modo
       diverso prima del 13/08. */
    const ATTESI: Record<string, string> = {
      MXP: "Milano Malpensa", // il nome era in inglese: "Milan Malpensa"
      LIN: "Milano Linate",
      FCO: "Roma Fiumicino Leonardo da Vinci", // città attaccata col trattino
      CIA: "Roma Ciampino–G. B. Pastine",
      CDG: "Parigi Charles de Gaulle", // la città non compare nel nome
      ORY: "Parigi Orly",
      LBG: "Parigi Le Bourget", // "Le" spariva tagliando la prima parola
      MUC: "Monaco di Baviera", // il nome È solo la città
      LHR: "Londra Heathrow",
      BGY: "Bergamo Il Caravaggio",
      BER: "Berlino Brandenburg",
    };
    for (const [iata, atteso] of Object.entries(ATTESI)) {
      expect(aeroportoPerIata(iata)?.etichetta, `${iata}`).toBe(atteso);
    }
  });

  test("nessuna etichetta contiene le parole di riempimento", () => {
    /* "International Airport" non aggiunge niente e raddoppia la
       lunghezza: su un telefono manda l'elenco a capo. */
    for (const iata of ["MXP", "FCO", "CDG", "JFK", "DOH", "SIN", "GRU"]) {
      const e = aeroportoPerIata(iata)?.etichetta ?? "";
      expect(e.toLowerCase(), iata).not.toContain("airport");
      expect(e.toLowerCase(), iata).not.toContain("international");
    }
  });

  test("nessuna etichetta comincia o finisce con un trattino", () => {
    /* Togliendo "Airport" da "Paris-Orly Airport" restava un trattino
       appeso: "Parigi -Orly". */
    for (const iata of Object.keys(ELENCO).slice(0, 3000)) {
      const e = aeroportoPerIata(iata)?.etichetta ?? "";
      expect(e, iata).not.toMatch(/^[\s\-–—]|[\s\-–—]$/);
    }
  });

  test("la città non si ripete due volte", () => {
    /* Usciva "Milano Milan Malpensa": l'archivio ha la città in italiano
       e il nome in inglese, e il confronto non se ne accorgeva. */
    expect(etichettaScalo("Milan Malpensa International Airport", "Milano")).toBe(
      "Milano Malpensa",
    );
    expect(etichettaScalo("Milano Linate Airport", "Milan")).toBe("Milano Linate");
  });

  test("un nome che comincia come la città ma è un'altra parola non si taglia", () => {
    /* "Romeo" non è "Rome". Senza il controllo dello stacco, il taglio
       si mangiava tre lettere e il nome diventava incomprensibile. */
    expect(etichettaScalo("Romeo Field", "Rome")).toBe("Roma Romeo");
  });

  test("nessuno scalo si chiama come il suo comune quando ha un nome vero", () => {
    /* Il difetto originale, in una riga: Malpensa non deve mai comparire
       come "Ferno". */
    expect(aeroportoPerIata("MXP")?.etichetta).not.toContain("Ferno");
  });
});

test.describe("I fusi orari", () => {
  test("tutti gli scali grandi hanno il fuso", () => {
    const senza = Object.entries(ELENCO)
      .filter(([, a]) => (a.peso ?? 0) === 2 && !a.tz)
      .map(([k]) => k);
    expect(senza, `scali grandi senza fuso: ${senza.join(", ")}`).toEqual([]);
  });

  test("Doha ce l'ha, ed era il buco più grosso", () => {
    /* Lo scalo di Qatar Airways: un volo Roma → Doha è coperto dal
       Regolamento in partenza, e il fuso mancava. */
    expect(ELENCO.DOH?.tz).toBe("Asia/Qatar");
  });

  test("i fusi dedotti sono marcati come tali", () => {
    /* Non è pignoleria: un valore che abbiamo calcolato noi non ha lo
       stesso peso di uno che viene dalla fonte, e chi lo legge domani
       deve poterlo sapere.
       ⚠️ Dal passaggio a OurAirports (9.016 scali) il fuso lo porta la
       fonte per quasi tutti: i dedotti sono una manciata, ed è giusto
       così. Quello che conta non è quanti sono, ma che ognuno resti
       MARCATO e abbia un fuso vero: un "dedotto" senza fuso sarebbe il
       difetto che questa prova esiste per fermare. */
    const dedotti = Object.values(ELENCO).filter((a) => a.tzDedotto);
    for (const a of dedotti) expect(a.tz).toBeTruthy();
  });

  test("ogni fuso è un fuso vero, non una stringa qualsiasi", () => {
    /* Un nome di fuso inventato non dà errore finché qualcuno non prova
       a formattare un'ora con quello: allora lancia, e lancia in
       produzione. */
    const fusi = new Set(
      Object.values(ELENCO)
        .map((a) => a.tz)
        .filter((t): t is string => Boolean(t)),
    );
    expect(fusi.size).toBeGreaterThan(100);
    for (const t of fusi) {
      expect(() => new Intl.DateTimeFormat("it-IT", { timeZone: t }), t).not.toThrow();
    }
  });
});

test.describe("La ricerca", () => {
  test("mostra solo scali con voli di linea", () => {
    /* 4.456 delle 9.016 voci sono piste private e campi di volo. Restano
       nell'archivio per le distanze, ma nel campo di ricerca non ci
       devono comparire. */
    for (const q of ["mila", "roma", "berg", "napoli", "paris"]) {
      for (const t of cercaAeroporti(q, 8)) {
        expect((ELENCO[t.iata]?.peso ?? 0), `${q} → ${t.iata}`).toBeGreaterThanOrEqual(1);
      }
    }
  });

  test("cercando una città italiana escono i suoi scali, per primi", () => {
    const milano = cercaAeroporti("milano", 5).map((a) => a.iata);
    expect(milano.slice(0, 2)).toEqual(expect.arrayContaining(["MXP", "LIN"]));
    const roma = cercaAeroporti("roma", 5).map((a) => a.iata);
    expect(roma.slice(0, 2)).toEqual(expect.arrayContaining(["FCO", "CIA"]));
  });

  test("i soprannomi continuano a funzionare", () => {
    expect(cercaAeroporti("orio", 3)[0]?.iata).toBe("BGY");
    expect(cercaAeroporti("malpensa", 3)[0]?.iata).toBe("MXP");
  });

  test("l'elenco mostra l'etichetta, non il nome grezzo", () => {
    const primo = cercaAeroporti("milano", 1)[0];
    expect(primo?.etichetta).toBe("Milano Malpensa");
    expect(primo?.nome).toContain("Airport"); // il grezzo resta, ma non si mostra
  });
});
