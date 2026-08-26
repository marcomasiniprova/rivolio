import { test, expect } from "@playwright/test";
import { gettoneCreator, codiceDaGettone, linkCruscottoCreator } from "../lib/affiliati/accesso";

/**
 * IL LINK PRIVATO DEL CREATOR. Firmato, non indovinabile: apre solo il
 * cruscotto di quel creator, e solo se la firma torna.
 */
test.describe("Il link privato del creator", () => {
  test("va e torna: il gettone rende il suo codice", () => {
    const g = gettoneCreator("MARCO");
    expect(g).toBeTruthy();
    expect(codiceDaGettone(g)).toBe("MARCO");
  });

  test("un gettone manomesso non apre niente", () => {
    const g = gettoneCreator("MARCO");
    expect(g).toBeTruthy();
    const rotto = g!.slice(0, -1) + (g!.slice(-1) === "a" ? "b" : "a");
    expect(codiceDaGettone(rotto)).toBeNull();
    expect(codiceDaGettone("ciao")).toBeNull();
    expect(codiceDaGettone(null)).toBeNull();
  });

  test("il link punta al cruscotto del creator", () => {
    const l = linkCruscottoCreator("MARCO", "https://rivolio.it");
    expect(l).toContain("https://rivolio.it/creator/cruscotto?t=");
  });
});
