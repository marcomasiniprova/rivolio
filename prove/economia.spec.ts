import { test, expect } from "@playwright/test";
import {
  PREZZO_PRATICA,
  checkPerPaganti,
  contoPratica,
  costoCheck,
  fissiMensiliTotale,
  scenario,
} from "../lib/admin/economia";

/**
 * Il conto economico. Queste prove tengono ferma la matematica: se qualcuno
 * cambia una costante, i numeri restano coerenti e nessuno si ritrova un
 * margine gonfiato senza accorgersene. La regola 2 (mai numeri inventati)
 * vale anche per i conti nostri.
 */

test.describe("Economia", () => {
  test("il conto di una pratica: dove finiscono i 16,90", () => {
    const c = contoPratica();
    // Polar: 5% + 0,50 su 16,90
    expect(c.polar).toBeCloseTo(1.345, 3);
    // garanzia stimata al 15% del prezzo
    expect(c.garanzia).toBeCloseTo(2.535, 3);
    // quel che resta
    expect(c.netto).toBeCloseTo(13.017, 2);
  });

  test("senza garanzia il netto è più alto; a metà reclami falliti crolla", () => {
    expect(contoPratica(PREZZO_PRATICA, 0).netto).toBeCloseTo(15.552, 2);
    // a rimborso pieno si perde la commissione già pagata a Polar: netto negativo
    expect(contoPratica(PREZZO_PRATICA, 1).netto).toBeCloseTo(-1.348, 2);
  });

  test("il costo di un check è spiccioli (dati + un po' di OCR)", () => {
    // 0,0005 dati + 0,2 × 0,001 OCR = 0,0007 €
    expect(costoCheck()).toBeCloseTo(0.0007, 4);
  });

  test("uno scenario a 10.000 check, 2% paga", () => {
    const s = scenario(10_000, 0.02);
    expect(s.paganti).toBe(200);
    expect(s.ricavo).toBeCloseTo(3380, 0);
    // il netto resta ben sopra i tre quarti dell'incasso
    expect(s.nettoGiorno).toBeGreaterThan(s.ricavo * 0.7);
  });

  test("per 1000 pratiche al giorno servono decine di migliaia di check", () => {
    expect(checkPerPaganti(1000, 0.02)).toBe(50_000);
    expect(checkPerPaganti(1000, 0.03)).toBe(33_333);
  });

  test("i costi fissi mensili sono una briciola", () => {
    // Supabase + Netlify + Resend + AeroDataBox Premium
    expect(fissiMensiliTotale()).toBe(196);
    // un solo giorno a 1000 pratiche pagate li ripaga centinaia di volte
    const giorno = scenario(50_000, 0.02).nettoGiorno;
    expect(giorno).toBeGreaterThan(fissiMensiliTotale() * 30);
  });
});
