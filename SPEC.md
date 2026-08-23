# SPEC — Rivolio

*Riscritta il 2026-08-07 (sera) dal documento completo di Valerio
(`RIVOLIO_DOCUMENTO_COMPLETO.md`). Le scelte chiuse stanno in `DECISIONI.md`.
La SPEC vecchia (micro-vacanze) è superata: resta solo nella storia di git.*

## 1. Il prodotto, in una riga

> Scopri in 30 secondi se una compagnia ti deve dei soldi. Se sì, il reclamo
> te lo preparo io. Tu lo mandi e tieni il 100%.

Rivolio è lo scanner dei rimborsi. Verticale numero 1: **voli**
(Reg. CE 261/2004). Poi bagagli (settembre), treni gratis come calamita
(ottobre), bollette e altro (2027). Il nome è neutro apposta: il marchio è
"l'app italiana che ti recupera i soldi che ti devono", non "app rimborsi voli".

## 2. Perché funziona (numeri veri, fonti nel documento)

- 229,7 milioni di passeggeri negli aeroporti italiani nel 2025.
- Meno del 10% di chi subisce un disservizio ottiene la compensazione (ReFly).
- Il 52% delle richieste viene rifiutato illegittimamente (AirHelp).
- 3,2 miliardi di euro di compensazioni non pagate in Europa (Euronews).
- **Retroattivo**: ITA/Aeroitalia 2 anni; vettori esteri (Ryanair, Wizz)
  finestre più lunghe, 5-6 anni **come stima da dichiarare caso per caso**.
- Concorrenza: AirHelp 35-50% di commissione, agenzie no-win-no-fee lente.
  Nessuno in Italia ha un prodotto self-service a prezzo fisso.
- Riforma UE chiusa il 13/07/2026: soglia 3h e importi INVARIATI, in vigore
  ~agosto 2027 con onere della prova sulla compagnia. Rischio regolatorio morto.

## 3. Il funnel (la parte che vale un 3,5x, non toccarla)

**Il check vive sul WEB, senza login, senza download, senza email.**
L'app mobile è il posto dove segui la pratica DOPO aver pagato, mai la porta.

| Passo | Cosa si chiede | Cosa NON si chiede |
|---|---|---|
| 1 | Numero volo + data. Basta. | email, login, upload, download |
| 2 | Verifica con teatro onesto (3 passi reali, 8-10s) | |
| 3a | NON IDONEO: risposta chiara, gratis, saluto pulito | |
| 3b | IDONEO: il reveal. "Atterrato alle 02:47 invece delle 22:55. 3h52 di ritardo. Fascia 250€." | |
| 4 | ORA l'email ("ti salvo la pratica") | |
| 5 | Pagamento (Stripe) | |
| 6 | ORA i documenti (carta d'imbarco) | |
| 7 | ORA l'app ("segui la pratica") | |

Regola d'oro: ogni cosa chiesta PRIMA del reveal costa il 40% degli utenti;
dopo, il 5%.

**Il claim onesto che converte** (mai "hai diritto a", mai vaghezza):
"Il tuo volo è atterrato con 3h47 di ritardo. Questa tratta rientra nella
fascia da 400€. Verifichiamo se ci sono cause escludenti. Ecco cosa serve
per chiederli."

## 4. Il motore — architettura a 7 strati

```
[0] INGESTIONE      volo+data a mano · OCR solo scorciatoia (dopo, non v1)
[1] NORMALIZZAZIONE "FR8321" | "Ryanair 8321" → codice IATA canonico
[2] VERIFICA FATTI  API voli (doppia fonte + cache + payload grezzo)   ⚠️ ZERO AI
[3] REGOLE          CE 261/2004 come codice versionato                 ⚠️ ZERO AI
[4] CLASSIFICAZIONE causa dichiarata dalla compagnia (suggerimento, mai verdetto)
[5] GENERAZIONE     lettera su modello rigido (v1: deterministico, senza LLM)
[6] ORCHESTRAZIONE  follow-up, solleciti, escalation ENAC, garanzia
```

**La regola tatuata: l'AI non decide MAI l'eleggibilità.** Il 261 è un albero
di if. Un falso positivo (uno che paga e non aveva diritto) vale 50 falsi
negativi: la metrica bloccante degli eval è falsi positivi = 0.

### Strato 2 — verifica fattuale
- Fonte primaria **AeroDataBox**, riserva AviationStack. Se discordano di
  più di 15 minuti → INCERTO, non si vende.
- **Cache per volo+data**: un volo con 180 passeggeri = 1 chiamata API.
- **`payload_grezzo` immutabile e archiviato sempre**: è la prova se una
  compagnia contesta fra 6 mesi.
- `vettore_operativo` ≠ vettore che vende il biglietto: il reclamo va
  all'operativo. È l'errore n.1 dei reclami respinti.
- OpenSky Network VIETATO: licenza non commerciale.

### Strato 3 — regole (fasce)
| Caso | Condizione | Importo |
|---|---|---|
| Ritardo all'arrivo | ≥ 3h, distanza ≤ 1500 km | 250€ |
| | ≥ 3h, ≤ 3500 km | 400€ |
| | 3-4h, > 3500 km | 300€ (riduzione 50%) |
| | ≥ 4h, > 3500 km | 600€ |
| Cancellazione | preavviso < 14 giorni | stessa scala + biglietto (v1.1) |
| Negato imbarco | | stessa scala (v1.1) |

**Tre stati, mai due**: IDONEO (si vende) · INCERTO (non si vende MAI, si
spiega) · NON_IDONEO (gratis, risposta chiara). Ogni verdetto salva
`ruleset_version` (parte da `2026.08.1`): quando la riforma entra in vigore
si crea la v2 e i casi vecchi restano valutati con le regole del loro tempo.
Prescrizione: data di scadenza STIMATA per caso, con avvertenza esplicita.

### Eval-driven development (non training)
- Golden dataset di casi etichettati a mano (40% non idonei, 35% idonei,
  25% casi limite: confini 1500/3500 km, 179/180/181 min, lungo raggio 3-4h,
  cancellato, dato mancante, fonti discordanti).
- `npm run eval` in verify: **precisione su IDONEO 100%, falsi positivi 0 =
  soglia bloccante**. Un commit che ne introduce uno non passa.
- **Shadow mode al lancio**: il motore emette il verdetto ma un umano lo
  conferma dal pannello `/admin` prima che l'utente possa pagare. Si spegne
  dopo 100 verdetti consecutivi senza correzioni. Ogni discrepanza diventa
  un caso nel golden set.
- Feedback permanente: ogni rifiuto della compagnia → caso etichettato.
  Dopo 6 mesi il golden set con esiti veri è il fossato.

## 5. Cosa compra l'utente (pricing chiuso)

| Prodotto | Prezzo | Nota |
|---|---|---|
| Check | **1,99 (interruttore, oggi acceso)** | costo ~0,0005$ l'uno; l'incerto non consuma il credito |
| 1 pratica | **16,90€** | |
| Famiglia (stesso volo, fino a 5) | **29,90€** | il margine vero: una famiglia di 4 recupera 1.000€+ |

Niente altri SKU al lancio. Meno scelte = più conversione.

**La garanzia (obbligatoria, non si discute):** "Se la compagnia non paga,
non paghi neanche tu." Rimborso integrale se la compagnia rifiuta senza un
motivo valido o non risponde entro i termini di legge.
⚠️ Dal 9/08/2026 è legata all'ESITO, non più a 90 giorni di calendario: le
compagnie rispondono in 8-14 settimane, quindi il giorno 90 cadeva DENTRO
l'attesa e un cliente onesto avrebbe chiesto il rimborso mentre la pratica
era ancora viva. A metà del margine, per un problema di calendario. Costa ~35% del lordo e RENDE: conversione +37%, chargeback quasi
zero, recensioni vive. È ciò che permette di vendere un fatto certo su un
esito incerto senza essere disonesti.

**Cosa vendiamo davvero** (e lo scriviamo nell'app): il dato oggettivo che
da solo non trovi, il secondo e terzo colpo (il sollecito al giorno 15 è il
prodotto vero: è lì che il 60% molla), la garanzia. Scriviamo anche che può
fare tutto gratis da solo, e come. Non vendiamo ignoranza.

## 6. La pratica: cosa succede dopo il pagamento

1. Documenti: carta d'imbarco / email di conferma (upload).
2. **Lettera generata**: reclamo formale in italiano con riferimenti al
   CE 261/2004, dati oggettivi del volo, indirizzo/canale corretto della
   compagnia OPERATIVA, lista allegati. Pagina stampabile + testo email
   pronto da copiare. **L'utente invia dalla SUA email, in proprio.**
3. Sequenza (email Resend, cron una volta al giorno):
   - T+0 pratica pronta + istruzioni + "conferma quando l'hai inviata"
   - T+2gg se non confermata: "L'hai inviata? Ci vogliono 2 minuti"
   - T+15gg sollecito pronto ← il momento in cui il 60% mollerebbe
   - T+30gg se rifiuto: contro-risposta + reclamo ENAC
   - T+60/90gg "com'è andata?" → se nulla, rimborso proattivo (garanzia)
   - stagionale: "hai volato quest'estate? Controlla gratis"
4. Tracker della pratica: sul web e nell'app mobile.

**Perimetro legale (il modello pulito):** Rivolio è un GENERATORE DI
DOCUMENTI. Niente mandato, niente incasso per conto terzi, niente moduli
giudiziari in v1. Ryanair è ostile agli intermediari: che l'utente invii da
solo È un vantaggio tecnico, si vende esplicitamente. Condizioni d'uso e
disclaimer da far leggere a un legale prima del lancio.

## 7. Architettura tecnica (cosa si riusa, cosa è nuovo)

**Si riusa tutto l'impianto:** Next 16 + Tailwind 4 + Motion su Netlify ·
Supabase (auth, RLS, profili) · Resend · pannello `/admin` · app mobile
Expo (diventa il tracker) · il modo di lavorare (verify, prove, documenti).

**Nuovo:**
- `lib/regole/eu261.ts` — il rules engine versionato + eval.
- `lib/voli/` — fornitori dati volo intercambiabili (aerodatabox,
  aviationstack, demo marcata) dietro un tipo unico `FattoVolo`.
- Tabelle: `voli` (cache fatti + payload grezzo), `verifiche` (ogni check),
  `pratiche` (stato macchina: creata → pagata → documenti → inviata →
  sollecito → enac → esito), `pratiche_eventi` (cronologia).
- `/api/verifica` (check pubblico, senza auth, con throttling),
  `/api/stripe/webhook` (pagamento → pratica), `/api/motore/segui`
  (cron follow-up, protetto da MOTORE_SEGRETO).
- Pagina risultato con reveal (contatore che sale, card condivisibile),
  area `/pratica/[id]`, admin shadow-mode.
- Stripe Checkout: price_data inline (pratica, famiglia), IVA inclusa. Managed Payments (MoR): gestisce lui l'IVA UE.
  ~5,3% + 0,40€ a vendita italiana.

**Tabelle di viaggio (offerte, ricerche, invii, strutture) = eredità:**
restano nel database, non si cancellano dati, ma il prodotto non le usa più.

**Email marketing separata dalle transazionali:** Resend per le
transazionali; la newsletter "L'Osservatorio dei Disservizi" (settimanale,
generata dai nostri dati: i 10 voli più in ritardo della settimana) su
Brevo quando parte.

## 8. Frontend: il livello da raggiungere

Design system esistente (verde, Geist/Poppins, corsivo): si tiene, il verde
è il colore dei soldi che tornano. Le 6 animazioni che devono essere
perfette e basta:
1. Hero col campo volo+data che attira (bordo che pulsa).
2. Ingresso del testo a scaglioni.
3. La verifica: 3 passi con avanzamento REALE (cerco il volo → confronto
   gli orari → calcolo), 8-10 secondi di teatro onesto, mai finto.
4. **IL REVEAL**: l'importo che sale col contatore. Vale metà del progetto.
5. La card condivisibile con un tocco (screenshot loop = il canale virale).
6. Scorrimento morbido della landing.
Regola: 60fps su un iPhone 12, `prefers-reduced-motion` rispettato.

## 9. Costi (verificati nel documento)

AeroDataBox $5-32/mese · AviationStack riserva gratis · Supabase Pro (c'è) ·
Netlify gratis · Resend gratis (3k/mese) · Stripe ~5%+0,25€ · Mistral solo
quando entrerà l'OCR. Totale ≈ 30-45€/mese.

## 10. Come si verifica che funzioni

1. `npm run verify` con dentro `npm run eval`: falsi positivi 0 o non passa.
2. Shadow mode: verdetti confermati a mano in `/admin` finché 100 di fila
   non richiedono correzioni.
3. **La prova che decide tutto (di Valerio, 2 ore):** chiave AeroDataBox su
   10 voli reali degli ultimi 2 anni → l'orario EFFETTIVO di atterraggio
   deve esserci. Poi 30 casi reali a mano: meno di 3 idonei = fermare tutto.
4. Prova end-to-end: check vero → pagamento vero (sandbox Stripe) → lettera
   → email T+0 ricevuta.

## 11. Fuori dalla v1 (non discutibile)

Moduli per il Giudice di Pace · mandati e incassi per conto terzi · vendere
sui casi INCERTO · OCR come fondamento (solo scorciatoia dopo) · bagagli e
treni (settembre/ottobre) · gamification di qualunque tipo · ads a pagamento.

## 12. Domande aperte

Vivono in `DECISIONI.md` → "Decisioni ancora aperte".
