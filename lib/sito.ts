/**
 * L'INDIRIZZO DI CASA, in un posto solo.
 *
 * 🔴 IL DIFETTO CHE HA FATTO NASCERE QUESTO FILE (12/08, trovato
 * percorrendo il giro sul sito VERO, non in locale).
 * Dopo aver aperto la pratica dalla cassa di collaudo, il browser non
 * finiva su `rivolio.it/pratica/...` ma su
 * `6a7cba1f40e5080008777918--rivolio.netlify.app/pratica/...`, cioe'
 * l'indirizzo interno della copia appena pubblicata.
 *
 * Perche' succedeva: le rotte costruivano il rimando con
 * `new URL(percorso, new URL(req.url).origin)`, e dietro il proxy di
 * Netlify `req.url` NON e' l'indirizzo che ha digitato la persona: e'
 * quello della macchina che sta servendo la richiesta. In locale
 * combaciano, quindi il difetto non si vede mai finche' non si prova
 * online.
 *
 * ⚠️ E NON ERA SOLO BRUTTO DA VEDERE. Cambiare dominio vuol dire
 * cambiare sito per il browser: i cookie restano di la'. Quindi la
 * ricevuta dell'analisi e la sessione non seguivano l'utente, e da quel
 * momento in poi si ritrovava sconosciuto su una copia del sito, con
 * l'aria di essere finito su qualcosa di losco proprio nel punto in cui
 * gli abbiamo appena chiesto dei soldi.
 *
 * ⚠️ PERCHE' NON SI LEGGE L'INTESTAZIONE `Host`. Sarebbe l'indirizzo che
 * ha chiesto il browser, ed e' la risposta giusta nel 99% dei casi. Ma e'
 * un valore che arriva da fuori: chi manda la richiesta puo' scriverci
 * quello che vuole, e un rimando costruito su un valore altrui e' il modo
 * classico di portare qualcuno su un sito che non e' il nostro. La
 * variabile d'ambiente invece la scrive Netlify e non la tocca nessuno.
 */

import { AMBIENTE_PROVA } from "@/lib/ambiente";

/** L'indirizzo pubblico del sito, senza la barra finale. */
export function casa(): string {
  /* 🔴 IL GEMELLO PUNTA A SÉ STESSO (27/08). Su staging l'indirizzo di casa
     è quello del gemello (DEPLOY_PRIME_URL, che Netlify dà al ramo), NON il
     dominio vero: se no i rimandi della cassa e i link finirebbero su
     rivolio.it, portandosi dietro i cookie del sito vero. In produzione
     AMBIENTE_PROVA è falso e vale la regola di sempre (dominio principale). */
  if (AMBIENTE_PROVA && process.env.DEPLOY_PRIME_URL) {
    return process.env.DEPLOY_PRIME_URL.replace(/\/$/, "");
  }
  return (
    process.env.NEXT_PUBLIC_SITO ??
    /* Netlify la mette da solo, ed e' il dominio PRINCIPALE del progetto:
       per questo si preferisce a DEPLOY_PRIME_URL, che invece punta alla
       singola pubblicazione. */
    process.env.URL ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

/**
 * Un indirizzo assoluto verso una nostra pagina.
 *
 * `req` serve solo come ultima spiaggia in sviluppo, dove le variabili
 * non ci sono: in produzione non viene mai guardato.
 */
export function versoCasa(percorso: string, req?: Request): URL {
  const base =
    process.env.NEXT_PUBLIC_SITO || process.env.URL
      ? casa()
      : req
        ? new URL(req.url).origin
        : "http://localhost:3000";
  return new URL(percorso, base);
}
