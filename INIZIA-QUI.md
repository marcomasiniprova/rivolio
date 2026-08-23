# INIZIA QUI — Rivolio

Leggi questo per primo. È la mappa per ripartire, pensata per una sessione
di Claude che gira **in locale sul PC di Valerio** (rete aperta, nessun
limite di sandbox).

> ⚠️ **I limiti del cloud NON valgono più in locale.** Nella storia di
> `STATO.md` trovi tante note tipo «da qui non raggiungo Supabase /
> AeroDataBox / il sito vivo», «l'egress blocca *.supabase.co», «il proxy
> risponde 403». Erano vere solo nella vecchia sandbox cloud. **In locale
> la rete è aperta**: puoi collaudare per davvero contro Supabase,
> AeroDataBox, Resend e il resto. Quando in un documento leggi «non ho
> potuto provarlo da qui», in locale **provalo**.

## 1. Cos'è Rivolio

Prende i soldi che le compagnie aeree devono ai passeggeri (Regolamento CE
261/2004: ritardo di 3 ore o più, volo cancellato, negato imbarco,
coincidenza persa, declassamento). Flusso: **check del volo a pagamento**
(1,99 di lancio, si scala dalla pratica) → **verdetto** a tre stati da un
motore deterministico (idoneo / incerto / non idoneo) → **pratica** a 16,90
con la lettera di reclamo pronta → follow-up, replica ai no, conciliazione.
Tagline: *Riprenditi i soldi che ti devono.* Dominio ufficiale:
**rivolio.it**. Online su Netlify.

> ⚠️ **IL CHECK SI PAGA (1,99), NON è GRATIS.** Lo comanda un interruttore,
> la variabile `NEXT_PUBLIC_CHECK_PREZZO_ATTIVO` su Netlify: a "1" il muro
> è acceso (1,99), altrimenti il check è libero. **Oggi Valerio lo tiene
> ACCESO.** I documenti più vecchi e i giri di `STATO.md` dicono spesso
> "check gratis": era vero quando l'interruttore era spento, non adesso.
> Per lo stato VERO leggi la variabile su Netlify col connettore, non
> fidarti della prosa. ✅ E LA CASSA È VERA: **Stripe Managed Payments**
> (merchant of record: versa l'IVA al posto nostro, funziona senza partita
> IVA). Check e pratica si pagano davvero, e i prezzi mostrati sono FINALI,
> IVA inclusa (1,99 e 16,90 tondi). La cassa di prova e Polar sono stati
> tolti. Chi lascia una recensione riceve un codice `RIV-XXXXX` che sblocca
> UNA analisi gratis (`lib/recensioni`).

## 2. Come parti in locale

```
git clone <repo>
cd viaggioancheio
npm install
cp .env.example .env.development.local     # poi riempi i valori (punto 3)
npm run dev                                # http://localhost:3000
```

Prima di dire «fatto» qualcosa: **`npm run verify`** (build + tipi + lint +
prove). Gli script utili stanno in `package.json`:
- `npm run dev` — sviluppo
- `npm run verify` — la prova completa (verde = si può dire fatto)
- `npm run tipi` — solo TypeScript, veloce
- `npm run prove` — solo Playwright
- `npm run eval` — il golden set del motore (55 casi, falsi positivi 0)
- `npm run banco` — passa voli veri dentro il motore (serve la rete)

## 3. Le variabili d'ambiente

I valori veri **non stanno nel repo** (regola 11: segreti solo in
`.env.local`/`.env.development.local`, entrambi ignorati da git). Il
modello coi NOMI e le spiegazioni è **`.env.example`**: copialo in
`.env.development.local` e incolla i valori. I più li trovi sul pannello
Netlify (Site settings → Environment variables) o su Supabase.

⚠️ **`.env.local` è in UTF-16 e Next lo ignora**: usa
`.env.development.local`. Il minimo per far girare il motore vero: le tre
chiavi Supabase, `AERODATABOX_API_KEY`, `MISTRAL_API_KEY`. Senza
`AERODATABOX_API_KEY` gira il **fornitore demo** (voli che iniziano per
ZZ, ogni risposta marcata `demo`).

## 4. Le regole (leggile, e rispettale)

- **`CLAUDE.md`** — le 14 regole di Valerio, corte apposta. La regola 7 è
  quella che conta: «Fatto»/«collaudato» solo con DUE prove insieme
  (output del verify + schermata/link sul sito vero). In locale la seconda
  prova la puoi davvero fare: **falla**.
- **`PROGETTO.md`** — il contesto pieno e il protocollo operativo (le cose
  importanti che non stanno nel CLAUDE.md corto).
- **`.claude/skills/`** — le skill del progetto (`copertura-prompt`,
  `art-director`, `video-review`).

## 5. La mappa del codice

- `app/` — le pagine (Next 16 App Router) e le rotte API (`app/api/**`).
  ⚠️ **Questa versione di Next ha breaking changes**: le guide stanno in
  `node_modules/next/dist/docs/`, leggile prima di scrivere.
- `lib/regole/` — **il motore EU261** (`eu261.ts`, `territorio.ts`,
  `cancellato.ts`, `dichiarati.ts`, `vettori.ts`). Decide sempre il codice,
  mai l'AI. Spiegato in `MOTORE.md`.
- `lib/voli/` — i fornitori dei dati di volo (AeroDataBox), la cache, gli
  aeroporti (`aeroporti.json`, 9.016 scali).
- `lib/check/` — il muro del check (`ingresso.ts`, `pass.ts`,
  `cancello.ts`): chi paga, chi passa, il tetto per il fornitore.
- `lib/recensioni/` — recensioni e **codice dell'analisi gratis**
  (`buono.ts` genera il codice, `recensioni.ts` lo salva e lo riscatta).
- `lib/pratiche/` — la macchina della pratica (`passi.ts` è gli stati,
  `pratiche.ts` le transizioni, `dossier.ts` il fascicolo).
- `lib/lettera/` — la lettera di reclamo (compagnie, enti, conciliazione).
- `lib/email/` — le email (Resend): iscrizione all'Osservatorio, accesso,
  benvenuto. Le email della pratica (T+0/2/…) stanno in `lib/pratiche/`.
- `components/rivolio/` — le superfici visive della landing.
- `components/pratica/` — i pezzi della pagina pratica.
- `prove/` — le prove Playwright. `prove/eu261.spec.ts` è l'eval del motore.
- `mobile/` — l'app Expo (React Native). Non duplica il motore: chiama la
  stessa `/api/verifica` del sito.

## 6. Lo stato e cosa manca

- **`STATO.md`** — il diario giro per giro (lungo). L'ultimo in cima.
- **`promemoria.md`** — le cose da fare, sue e mie.
- **`ARRETRATI.md`**, **`LANCIO.md`** — code e decisioni aperte. La cassa è
  **Stripe** (deciso e live in test); mancano solo `STRIPE_WEBHOOK_SECRET`
  su Netlify e un pagamento di prova con carta test.

### Le decisioni fresche (15/08), già in codice, da COLLAUDARE in locale

Queste sono scritte e il build è verde, ma il giro end-to-end **non l'ho
potuto provare** (la sandbox non raggiungeva il database). In locale
provale davvero:

1. **Il buono analisi gratis è un CODICE usa e getta** (non più cookie).
   La recensione mostra `RIV-XXXXX`, si incolla al muro del check, il
   registro (`buoni_analisi.usato_il`, colonna `codice`) lo brucia al primo
   verdetto. Migrazione già applicata sul database vero.
   **Da provare:** lascia una recensione → prendi il codice → al muro apri
   «Hai un codice?» → incollalo → deve partire l'analisi. Riusarlo deve
   dare il muro.
2. **La garanzia scatta solo con un no scritto** registrato (anti-frode).
   `/api/pratiche/[id]/esito` rifiuta `non_pagata` senza `rifiuto_motivo`.
3. **Box esito fuso**: «Come è andata con la compagnia?» con due bottoni
   (`components/pratica/DichiaraEsito.tsx` ingloba `DichiaraRifiuto` nudo).
4. **Art. 9 (pasti/hotel)** compare solo prima dell'invio, sparisce a
   pratica chiusa.
5. **Un solo bottone** nella card prezzi.

### Il vecchio prodotto viaggi: RIMOSSO (15/08)

Il sottosistema del vecchio prodotto viaggi ("Viaggio Anche Io") è stato
tolto: `lib/offerte/`, `lib/alert/`, `lib/destinazioni.ts`,
`lib/costruttore.ts`, `lib/motore/esegui.ts`, le ricerche in
`components/app/`, i 18 componenti landing morti (`Hero`, `Faq`, `Prezzi`…),
le funzioni email viaggi in `lib/email/messaggi.ts` e le prove relative.
`npm run verify` verde dopo la rimozione.

**Unico residuo rimasto, innocuo:** dentro `mobile/src/lib/testi.ts` restano
alcune chiavi di testo del vecchio prodotto (parlano di "destinazioni a
settimana"). Nessuna schermata viva le legge, quindi non compaiono da
nessuna parte; il mobile è verde. Si possono togliere in un giro dedicato
al mobile (chiavi dentro un dizionario condiviso: meglio con calma e
`npm run` mobile a ogni passo, non insieme ad altro).

### Ancora da fare (non fatto)

- Le voci aperte in `promemoria.md` e `ARRETRATI.md`.
