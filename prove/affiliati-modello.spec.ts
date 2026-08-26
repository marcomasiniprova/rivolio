import { test, expect } from "@playwright/test";
import { bonusMaturato, prossimoBonus, bonusiDi, BONUS } from "../lib/affiliati/modello";

/**
 * I BONUS A SOGLIE DEI CREATOR (brief del 26/08). Numeri tondi decisi da
 * Valerio: se si toccano, questa prova lo dice. Un bonus sbagliato è un
 * pagamento sbagliato a una persona in carne e ossa.
 */
test.describe("I bonus a soglie dei creator", () => {
  test("singole: 20€ alle 10, poi 50€ ogni 25", () => {
    expect(bonusMaturato(9, BONUS.singola)).toBe(0);
    expect(bonusMaturato(10, BONUS.singola)).toBe(20);
    expect(bonusMaturato(34, BONUS.singola)).toBe(20);
    expect(bonusMaturato(35, BONUS.singola)).toBe(70);
    expect(bonusMaturato(60, BONUS.singola)).toBe(120);
  });

  test("famiglia: 50€ ogni 10", () => {
    expect(bonusMaturato(9, BONUS.famiglia)).toBe(0);
    expect(bonusMaturato(10, BONUS.famiglia)).toBe(50);
    expect(bonusMaturato(25, BONUS.famiglia)).toBe(100);
  });

  test("check: 50€ ogni 100", () => {
    expect(bonusMaturato(99, BONUS.check)).toBe(0);
    expect(bonusMaturato(100, BONUS.check)).toBe(50);
    expect(bonusMaturato(250, BONUS.check)).toBe(100);
  });

  test("il prossimo bonus dice quante ne mancano e quanto vale", () => {
    expect(prossimoBonus(0, BONUS.singola)).toEqual({ mancano: 10, premio: 20 });
    expect(prossimoBonus(10, BONUS.singola)).toEqual({ mancano: 25, premio: 50 });
    expect(prossimoBonus(34, BONUS.singola)).toEqual({ mancano: 1, premio: 50 });
    expect(prossimoBonus(5, BONUS.famiglia)).toEqual({ mancano: 5, premio: 50 });
  });

  test("il totale mette insieme i tre stream", () => {
    expect(bonusiDi({ singola: 10, famiglia: 10, check: 100 }).totale).toBe(20 + 50 + 50);
  });
});

test.describe("Il progresso verso il prossimo bonus", () => {
  test("singole: conta gli sbloccati e la posizione nella barra", () => {
    const { progressoBonus, BONUS } = require("../lib/affiliati/modello");
    expect(progressoBonus(0, BONUS.singola)).toMatchObject({ sbloccati: 0, mancano: 10, segmento: 10, dentro: 0 });
    expect(progressoBonus(5, BONUS.singola)).toMatchObject({ sbloccati: 0, mancano: 5, dentro: 5 });
    expect(progressoBonus(10, BONUS.singola)).toMatchObject({ sbloccati: 1, mancano: 25, segmento: 25, dentro: 0 });
    expect(progressoBonus(34, BONUS.singola)).toMatchObject({ sbloccati: 1, mancano: 1, dentro: 24 });
    expect(progressoBonus(35, BONUS.singola)).toMatchObject({ sbloccati: 2 });
  });
  test("famiglia e check contano i traguardi tondi", () => {
    const { progressoBonus, BONUS } = require("../lib/affiliati/modello");
    expect(progressoBonus(10, BONUS.famiglia).sbloccati).toBe(1);
    expect(progressoBonus(25, BONUS.famiglia).sbloccati).toBe(2);
    expect(progressoBonus(100, BONUS.check).sbloccati).toBe(1);
  });
});

