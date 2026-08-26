import { createHmac, timingSafeEqual } from "node:crypto";
import { codiceAffiliatoValido } from "./codice";

/**
 * IL LINK PRIVATO DEL CRUSCOTTO DEL CREATOR.
 *
 * Un creator apre la SUA pagina da un indirizzo firmato, senza account e
 * senza password (scelta di Valerio col popup, 26/08): zero attriti, glielo
 * mando e lo mette nei segnalibri. La firma HMAC dimostra che l'abbiamo
 * scritto noi: nessuno può fabbricarsi il link di un altro cambiando il
 * codice. Stesso impianto dei gettoni delle email (lib/iscritti/gettone.ts).
 */

const SEGRETO =
  process.env.SEGRETO_ISCRITTI ??
  process.env.SUPABASE_SECRET_KEY ??
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  "";
const IN_PRODUZIONE = process.env.NODE_ENV === "production";
const SEGRETO_SVILUPPO = "rivolio-sviluppo-non-usare-in-produzione";

function chiave(): string | null {
  if (SEGRETO) return SEGRETO;
  if (IN_PRODUZIONE) return null;
  return SEGRETO_SVILUPPO;
}

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const daB64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");
const firma = (corpo: string, k: string) =>
  createHmac("sha256", k).update(corpo).digest("base64url");

export function gettoneCreator(codice: string): string | null {
  const c = codiceAffiliatoValido(codice);
  const k = chiave();
  if (!c || !k) return null;
  const corpo = b64(JSON.stringify({ c, s: "creator" }));
  return `${corpo}.${firma(corpo, k)}`;
}

export function codiceDaGettone(gettone: string | null | undefined): string | null {
  if (!gettone) return null;
  const k = chiave();
  if (!k) return null;
  const punto = gettone.lastIndexOf(".");
  if (punto <= 0) return null;
  const corpo = gettone.slice(0, punto);
  const firmaData = gettone.slice(punto + 1);
  const atteso = firma(corpo, k);
  const a = Buffer.from(firmaData);
  const b = Buffer.from(atteso);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const dati = JSON.parse(daB64(corpo)) as { c?: string; s?: string };
    if (dati.s !== "creator") return null;
    return codiceAffiliatoValido(dati.c);
  } catch {
    return null;
  }
}

export function linkCruscottoCreator(codice: string, base: string): string | null {
  const g = gettoneCreator(codice);
  return g ? `${base}/creator/cruscotto?t=${g}` : null;
}

/** Il link CORTO e privato del creator: rivolio.it/creator/<token>. È quello
    che si dà davvero (bello, non indovinabile). null se il creator non ha
    ancora un token. */
export function linkCortoCreator(token: string | null | undefined, base: string): string | null {
  if (!token) return null;
  return `${base}/creator/${token}`;
}
