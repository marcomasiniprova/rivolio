import { casa, spedisci, type Esito } from "./posta";
import { bottone, COLORI as C, FONT, firma, vestito } from "./modello";

/**
 * LA RETE DI SICUREZZA DEL CHECK PAGATO (audit del pannello, 26/08).
 *
 * 🔴 Il buco: l'unico veicolo dell'analisi pagata era il cookie del pass,
 * scritto SOLO quando il browser atterra su /api/check/pronto (il success_url
 * di Stripe). Se la persona chiude la scheda, il rientro fallisce, o paga dal
 * telefono e riapre dal computer, il cookie non si scrive mai: soldi
 * incassati, analisi non consegnata, nessun recupero. A volume, una piccola
 * frazione di rientri non completati è una perdita sistematica e un rischio
 * di contestazione sulla carta.
 *
 * Questa email chiude il buco: porta il link che RIEMETTE il pass e fa
 * ripartire l'analisi, da qualsiasi dispositivo. Il link è idempotente
 * (/api/check/pronto rilegge la sessione da Stripe e conta le analisi per
 * ordine): riaprirlo dieci volte non regala dieci check.
 *
 * ⚠️ Se la spedizione fallisce, chi chiama NON deve fallire: è un di più.
 */

const p = (testo: string) =>
  `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.65;color:${C.fumo};">${testo}</p>`;

const h = (testo: string) =>
  `<h1 style="margin:0 0 16px;font-family:${FONT};font-size:27px;line-height:1.2;color:${C.inchiostro};font-weight:700;letter-spacing:-0.5px;">${testo}</h1>`;

const CODA =
  "Ricevi questa email perché hai pagato un controllo su Rivolio. Non ti iscrive a niente.";

/**
 * Parte dal webhook di Stripe appena il check è pagato: è insieme la ricevuta
 * e la rete di sicurezza. Il link riapre l'analisi anche da un altro
 * dispositivo.
 */
export function analisiPagataPronta(a: string, sessionId: string): Promise<Esito> {
  const link = `${casa()}/api/check/pronto?session_id=${encodeURIComponent(sessionId)}`;
  return spedisci({
    a,
    oggetto: "La tua analisi è pronta",
    html: vestito({
      titolo: "La tua analisi è pronta",
      corpo:
        h("Hai pagato: la tua analisi ti aspetta.") +
        p(
          "Riaprila con un clic. Riparte da sola sul volo che hai controllato, anche da un altro telefono o computer.",
        ) +
        bottone("Apri la mia analisi", link) +
        p(
          "Tieni da parte questa email: è il tuo accesso all'analisi che hai già pagato. Il link vale solo per te.",
        ) +
        firma(),
      coda: CODA,
    }),
    testo: `Hai pagato: la tua analisi ti aspetta.

Apri la mia analisi: ${link}

Riparte da sola sul volo che hai controllato, anche da un altro dispositivo. Tieni da parte questa email: è il tuo accesso all'analisi che hai già pagato.`,
  });
}
