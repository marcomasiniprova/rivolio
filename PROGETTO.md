# Rivolio — il contesto

*Questo file è il racconto: cos'è il prodotto, come è fatto, perché certe
scelte sono quelle. Le REGOLE stanno in `CLAUDE.md`, che è corto apposta.
Qui si legge quando serve capire; là si obbedisce sempre.*

## Cos'è e qual è l'obiettivo

**Rivolio è lo scanner dei rimborsi aerei (Reg. CE 261/2004)**, definito dal
documento di Valerio del 07/08: check sul web, verdetto a tre stati dal motore
deterministico (l'AI non decide MAI), pratica 16,90 / famiglia 29,90, lettera
pronta che l'utente invia da sé (non siamo intermediari), garanzia legata
all'esito, admin in shadow mode. Online su **rivolio.it**.

**Obiettivo di Valerio: fare cassa entro ottobre 2026.** Ogni scelta si giudica
così: avvicina il primo utente pagante?

Mappa dei documenti: `PIANO.md` (dove andiamo) · `ARRETRATI.md` (cosa resta) ·
`SPEC.md` (cosa costruiamo) · `DECISIONI.md` (scelte chiuse) · `BRAND.md`
(marchio) · `CONTENUTI.md` (social) · `STATO.md` (dove siamo, giro per giro) ·
`MOTORE.md` (di cosa è fatto il motore).

Marchio per esteso: Rivolio. Tagline: *Riprenditi i soldi che ti devono.*

## Lo stack, fissato

Next 16 + React 19 + Tailwind 4 + **Motion** su **Netlify** · **Supabase** ·
**Stripe** (Managed Payments, Valerio non ha partita IVA) · Resend · Telegram Bot API · dati ISTAT
e MIMIT. Le funzioni Netlify hanno 10 secondi: il matcher va a lotti.

## Il flusso della pratica

Lo stato non è una data: è la risposta a «cosa è successo per ultimo?».
Il codice che lo decide sta in un posto solo, `lib/pratiche/passi.ts`.

```
PAGATA        il reclamo è pronto → aprilo, mandalo, torna e premi "l'ho inviato"
INVIATA       hanno risposto no? → RISPOSTA_NO
              42 giorni di silenzio? → SILENZIO
              altrimenti → ATTESA (conto alla rovescia, niente da fare)
RISPOSTA_NO   la replica è scritta sul loro no → mandala
              dal secondo no in poi compaiono ANCHE ente e conciliazione
SILENZIO      manda il sollecito; dopo altri 14 giorni → ENTE
ENTE          l'ente accerta e sanziona; la conciliazione muove i soldi
CHIUSA        hanno pagato, oppure ti rimborsiamo noi
```

Tre regole tengono in piedi tutto:
1. **un fatto batte sempre una data** (se hanno risposto, il calendario non
   conta più);
2. **un solo passo attivo alla volta**, e un solo bottone che lo esegue;
3. **nessun vicolo cieco**: da ogni stato esiste un'azione o un'attesa con una
   data.

## Come si lavora: il protocollo

- Batch di TUTTI i fix, poi UN verify alla fine. Mai fix → verify → fix.
- Per trovare un punto nel codice: `rg -C 20 <pattern>` in un comando solo.
  Leggi un file intero solo se devi modificarne più punti.
- Prima di un edit, verifica che la stringa target sia unica. Se un edit
  fallisce due volte, fermati e chiedi.
- Un task = una unità committabile. «Costruire la SaaS» non è un task;
  «fixare il salvataggio iscritti» sì.
- `/compact <focus>` = stesso task, sessione lunga. `/clear` = task chiuso o
  pivot. Prima di ogni `/clear` consigliato, scrivi `HANDOFF.md`.
- Dopo ogni task chiuso, verificato e committato:
  `--- CHECKPOINT: task chiuso. Consigliato /clear. Prossimo task? ---`
- Se la richiesta non c'entra col task corrente: «Task nuovo. /clear prima,
  poi ripeti la richiesta.»
- Sintomi di degrado da segnalare: rileggi un file già letto, riproponi un
  approccio scartato, richiedi un'informazione già data, un fix supera i 3
  tentativi. Output: `--- DEGRADO: [quale]. Consigliato /compact ---`

## Gli asset

Per generare immagini: `scripts/gen-asset.ts` (`npm run asset`). Gemini per le
scene, `--unsplash` per le foto reali. Chiavi `GEMINI_API_KEY` e
`UNSPLASH_ACCESS_KEY` in `.env.development.local` (qui `.env.local` è in UTF-16
e Next lo ignora). Output in `/public/assets/`, WebP, max 1MB.

## Le regole d'oro dell'interfaccia

- Se l'effetto richiede realismo (luce, materiali, profondità) è un **ASSET**;
  se richiede orchestrazione (timing, sequenza, reazione) è **CODICE**.
- Le hero belle sono immagini, non codice: gli asset si procurano prima.
- Una sezione per volta. «Fammi la landing» in un colpo produce slop.
- Le sezioni `whileInView` vanno scrollate piano e attese 2s prima dello scatto.
- Le catture a pagina intera su questo sito non fanno testo: vanno fatte
  scorrendo.

## Regole operative (le cose importanti che non stanno nel CLAUDE.md corto)

- **Mai `npm run build` mentre gira `npm run dev`**: scrivono nella stessa
  `.next`, e il server di sviluppo legge pezzi della build. L'errore che ne
  esce non somiglia alla causa. Chiudi il dev, cancella `.next`, riparti.
- **`.env.local` è UTF-16 e Next lo ignora**: le chiavi vive stanno in
  `.env.development.local`. Il modello dei nomi è `.env.example`.
- **Prove Playwright, `exact: true`** quando un'etichetta è sottostringa di
  un'altra: `getByRole("button", { name: "So il numero", exact: true })`,
  altrimenti prende «Non so il numero».
- **L'idratazione può mangiare il primo click**: nei giri visivi aspetta un
  attimo e ripeti il click prima di dare per rotto un bottone.
- **Il giro visivo si fa con uno script Node** che importa
  `node_modules/playwright` (Chromium preinstallato), non col server MCP.
  E le larghezze si guardano DOVE cambiano i breakpoint, non solo tre.
- **Le compagnie extra UE stanno in `lib/regole/vettori.ts`**, non in
  `compagnie.ts` (quello dichiara canali reclamo verificati a mano). Non se
  ne aggiunge una «a occhio»: un falso positivo è la cosa numero uno da non
  fare.
- **La cache dei voli è una fotografia, non una verità**: quando aggiungi
  un campo che serve al verdetto, aggiungilo anche in `rigaUsabile`
  (`lib/voli/verifica.ts`), o le righe vecchie danno per sempre il verdetto
  sbagliato.
- **Il buono analisi gratis è un CODICE** (`RIV-XXXXX`, `lib/recensioni/
  buono.ts`), non un cookie: usa e getta, bruciato dal registro al primo
  verdetto. Il vecchio cookie era fragile e riusabile: non tornarci.
- **Le tabelle viaggi** (offerte, ricerche, invii, strutture) sono eredità
  nel database: non usarle, non cancellarle. Il codice viaggi va tolto in
  un giro suo.
