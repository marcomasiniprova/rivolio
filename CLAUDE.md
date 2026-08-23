@STATO.md
@INIZIA-QUI.md

# Rivolio — le regole
Recuperiamo i soldi che le compagnie devono ai passeggeri (Reg. CE 261/2004):
check del volo → verdetto → pratica di reclamo. Dominio: rivolio.it. Contesto pieno: PROGETTO.md.

## Con me
1. Ogni prompt: 4 domande popup PRIMA di costruire, sempre, anche dopo "vai/procedi". La consigliata per prima, marcata "(consigliato)".
2. Consegna a pezzi: fai, dillo, continua. Ogni consegna: cosa è fatto / cosa manca / prossimo pezzo.
3. Non fare di testa tua: una mia decisione resta finché non la cambio io. Se ti pare sbagliata, dimmelo in una riga e poi eseguila.
4. Niente agenti o workflow paralleli se non li chiedo io.
5. Più richieste in un messaggio: skill copertura-prompt, chiudi col blocco COPERTURA.

## "Fatto" = provato (la regola che conta di più)
6. Mai "fatto"/"collaudato" senza DUE prove insieme: `npm run verify` verde (output incollato, mai riassunto) + schermata o link sul sito vero. Se non puoi, scrivi "NON VERIFICATO". Se la sandbox non arriva, prova un secondo modo (log, altro endpoint) prima di arrenderti.

## I paletti di Rivolio
7. MAI un falso positivo: vendere un diritto che non c'è è la cosa numero uno vietata. Nel dubbio il verdetto esce "incerto", e l'incerto non si vende.
8. Il motore decide (lib/regole), l'AI mai. Numeri con fonte o "stima". Dati finti solo `demo`, mai in produzione. Segreti solo in `.env.development.local`.

## Quando costruisci
9. Tocca solo il pezzo chiesto, zero refactoring, un fix non rompe altro.
10. Modifica visiva a 360/768/1024/1280/1440 (anche DOVE cambiano i breakpoint). Mai `build` mentre gira `dev`. Skill art-director per ogni superficie.

## Come parli
11. A me: zero gergo senza traduzione, spiegazioni in chat mai in un file. Fine sessione: STATO, verify, commit.
12. All'utente: dieci persone normali, del tu, frasi corte, MAI il trattino lungo, ogni numero apribile.

## Chiedi PRIMA
13. Soldi, domini, software di sistema, cose irreversibili verso l'esterno.
    NON il deploy: ogni pezzo finito va SEMPRE su `main` e quindi online, senza
    chiedere (Valerio, 17/08: vuole il progresso sempre online).

## La mappa dei file
- INIZIA-QUI.md — parti da qui: setup locale, mappa, stato, cosa collaudare.
- STATO.md — il diario giro per giro (l'ultimo in cima). PROGETTO.md — protocollo e regole operative.
- ARRETRATI.md e promemoria.md — le cose da fare, mie e tue. MOTORE.md — come gira il motore. SPEC.md — cosa fa il prodotto.
- LANCIO.md — blocchi al lancio. docs/ — riferimento e ricerca (BRAND, sentenze, riforma...).
- Codice: lib/regole = il motore · lib/check = il muro · lib/pratiche = la pratica · lib/recensioni = il codice dell'analisi.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
