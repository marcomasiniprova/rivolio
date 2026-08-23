/**
 * IL PASS DEL CHECK: la ricevuta che apre il cancello.
 *
 * Quando il check è a pagamento, chi ha pagato deve poterlo fare senza
 * account, senza password e senza aspettare. Il pass è una ricevuta
 * FIRMATA che viaggia in un cookie: porta con sé quanti check restano e
 * fino a quando vale, e la firma dimostra che l'abbiamo emessa noi.
 *
 * Perché firmato e non una riga nel database: zero frizione. Non c'è
 * niente da cercare, niente da collegare a un account che l'utente non
 * ha, e funziona al primo colpo anche sul telefono di uno che è appena
 * atterrato. Il pagamento resta registrato nel database (è la prova
 * contabile), ma per PASSARE il cancello basta la ricevuta.
 *
 * Cosa NON è: un abbonamento. Vale per i check che ha pagato e scade,
 * così una ricevuta rubata o incollata in giro non vale una vita intera.
 *
 * Il segreto è quello del servizio, come per i gettoni delle email: se
 * manca, in produzione NON si firma niente, perché un pass che chiunque
 * può fabbricarsi non è un pass, è una porta aperta.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { GIORNI_DEL_PASS } from "./ingresso";

const SEGRETO =
  process.env.SEGRETO_ISCRITTI ??
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "";
const IN_PRODUZIONE = process.env.NODE_ENV === "production";
const SEGRETO_SVILUPPO = "rivolio-sviluppo-non-usare-in-produzione";

/** Il cookie che porta la ricevuta. */
export const COOKIE_PASS = "rivolio_check";

const DURATA_MS = GIORNI_DEL_PASS * 24 * 60 * 60 * 1000;

function chiave(): string | null {
  if (SEGRETO) return SEGRETO;
  if (IN_PRODUZIONE) return null;
  return SEGRETO_SVILUPPO;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const daB64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");
const firma = (corpo: string, k: string) =>
  createHmac("sha256", k).update(corpo).digest("base64url");

export type Pass = {
  /** Quanti check restano da fare, secondo il cookie. */
  restano: number;
  /** Quanti check ha comprato l'ordine. È il tetto vero. */
  quanti: number;
  /** Quando scade, in millisecondi. */
  scadenza: number;
  /** L'ordine che l'ha pagato: serve a ritrovare la ricevuta contabile. */
  ordine: string;
};

/** Emette la ricevuta per un pagamento andato a buon fine. */
export function creaPass(ordine: string, quanti: number, adesso = Date.now()): string | null {
  const k = chiave();
  if (!k) {
    console.error("[pass] nessun segreto in produzione: pass non emesso");
    return null;
  }
  /* `q` è quanti check ha comprato l'ordine e non cambia mai; `r` è
     quanti ne restano secondo il cookie. Servono tutti e due perché il
     cookie da solo non fa fede: il conto vero lo tiene il database
     (vedi `creditoFinito` in cancello.ts). */
  const corpo = b64(JSON.stringify({ r: quanti, q: quanti, x: adesso + DURATA_MS, o: ordine }));
  return `${corpo}.${firma(corpo, k)}`;
}

/** Rilegge una ricevuta. null se manca, è falsa, è scaduta o è esaurita. */
export function leggiPass(pass: string | null | undefined, adesso = Date.now()): Pass | null {
  const k = chiave();
  if (!k || !pass) return null;

  const punto = pass.lastIndexOf(".");
  if (punto <= 0) return null;
  const corpo = pass.slice(0, punto);
  const data = pass.slice(punto + 1);

  /* Confronto a tempo costante: su un confronto normale la firma si
     indovina un carattere alla volta misurando i tempi di risposta. */
  const atteso = Buffer.from(firma(corpo, k));
  const ricevuto = Buffer.from(data);
  if (atteso.length !== ricevuto.length || !timingSafeEqual(atteso, ricevuto)) return null;

  let letto: { r?: unknown; q?: unknown; x?: unknown; o?: unknown };
  try {
    letto = JSON.parse(daB64(corpo));
  } catch {
    return null;
  }

  /* 🔴 UNA RICEVUTA SPESA RESTA UNA RICEVUTA.
     Fino al 13/08 qui si pretendeva `r > 0`, cioè del credito residuo, e
     la ricevuta finita veniva buttata. Ma questo foglietto dice due cose
     diverse: "hai pagato" e "ti resta del credito". La seconda scade, la
     prima no, e sulla prima poggia lo sconto di 1,99 sulla pratica.
     Buttandola, chi pagava l'analisi si vedeva chiedere la pratica a
     prezzo pieno: 1,99 + 14,90 invece dei 14,90 promessi in quattro
     punti del sito. Trovato col collaudo del 13/08.
     ⚠️ Non apre nessuna porta: a decidere se si può fare un'altra
     analisi è `passUsabile`, che conta le analisi consumate NEL
     DATABASE. Il numero nel cookie è un promemoria, non un permesso. */
  if (typeof letto.r !== "number" || letto.r < 0) return null;
  if (typeof letto.x !== "number" || letto.x < adesso) return null;
  if (typeof letto.o !== "string" || !letto.o) return null;

  /* Le ricevute emesse prima dell'11/08 non portano `q`: il tetto lo si
     prende da quanto restava, che per loro coincide col comprato. */
  const quanti = typeof letto.q === "number" && letto.q > 0 ? letto.q : letto.r;

  return { restano: letto.r, quanti, scadenza: letto.x, ordine: letto.o };
}

/**
 * La ricevuta dopo un check consumato: stesso foglietto, un credito in
 * meno. Quando finisce arriva a zero e RESTA, perché continua a
 * dimostrare il pagamento (vedi il commento sopra, in `leggiPass`).
 *
 * ⚠️ Un verdetto INCERTO non consuma niente (vedi CORTESIA_SU_INCERTO in
 * ingresso.ts): chi paga per sapere e si sente rispondere "non lo so"
 * non ha comprato una risposta, e tenergli i soldi è il modo più veloce
 * di prendersi una contestazione sulla carta.
 */
export function consumaPass(pass: Pass, adesso = Date.now()): string | null {
  const k = chiave();
  if (!k) return null;
  const corpo = b64(
    JSON.stringify({
      r: Math.max(0, pass.restano - 1),
      q: pass.quanti,
      x: pass.scadenza,
      o: pass.ordine,
    }),
  );
  void adesso;
  return `${corpo}.${firma(corpo, k)}`;
}
