# PIANO — Rivolio

*Se leggi un file solo, leggi questo. Risponde a una domanda: **a che punto siamo?***
*Riscritto il 2026-08-07 (notte) col prodotto definito: lo scanner dei rimborsi.*

**Obiettivo: cassa entro settembre/ottobre 2026.** Realistico dal documento:
10-25k€ agosto-settembre se la distribuzione gira. Ogni scelta si giudica
così: avvicina il primo pagante?

---

## Le tre fasi (definite da Valerio il 07/08)

```
  FASE 1               FASE 2                  FASE 3
  SVILUPPO       →     DISTRIBUZIONE     →     MIGLIORAMENTO
  si finisce TUTTO     3 contenuti al          iterazione e
  il prodotto          giorno, ogni giorno     mantenimento
```

FASE 1 = il prodotto completo e provato (check, pratica, lettera, follow-up,
tracker). FASE 2 = distribuzione, parte appena il check è online (65%
dell'energia, dal documento). FASE 3 = miglioramento continuo, iterazione
sui dati veri e mantenimento: i verticali nuovi (bagagli, treni), il golden
set che cresce coi rifiuti veri, le correzioni da feedback.

---

# FASE 1 — SVILUPPO

**Fatta quando:** uno sconosciuto fa il check, vede il dato oggettivo, paga,
riceve la lettera, la invia e la sequenza di follow-up parte da sola.

## 1.1 Il motore (lo strato che decide)

| | Stato |
|---|---|
| Rules engine EU261 versionato, 3 stati, zero AI (`lib/regole/eu261.ts`) | ✅ 07/08 |
| Golden set etichettato a mano + eval (falsi positivi 0, bloccante) | ✅ 32 casi (dentro il FR4001 vero e 2 trappole sciopero) |
| Schema dati: voli (cache+payload grezzo), verifiche, pratiche, eventi + RLS + scioperi | ✅ applicato sul Supabase vero |
| Fornitori dati volo (AeroDataBox + demo marcata; distanze di riserva OpenFlights) | ✅ 8/08, cache + payload grezzo come prova |
| Seconda fonte: documenti dell'utente via OCR Mistral dentro la pratica | ✅ 8/08 (concorde/discorde/illeggibile; discorde = conferma umana; file mai salvato) |
| **Prova delle 2 ore: chiave AeroDataBox su voli reali** | ✅ 8/08: dati solidi con Live fino a 11 mesi (AZ610); oltre 365 giorni il BASIC rifiuta → vetrina onesta sui 12 mesi |
| Golden set esteso a 500 casi reali (gruppi FB, amici) | ⏳ man mano che passano voli veri |
| **Art. 7 lett. b): le tratte intracomunitarie lunghe restano a 400€** | ✅ 9/08 giro #40, regole 2026.08.6, golden set 45 su 45 |
| **Cancello territoriale (art. 3 par. 1): paese dal fornitore, archivio, prefisso ICAO** | ✅ 9/08 giro #43, regole 2026.08.7 |
| **La cache non può congelare un incerto** (`rigaUsabile`) | ✅ 9/08 giro #44: era il motivo di FR4001 |
| **Archivio aeroporti che si aggiorna da solo** (OurAirports, ogni lunedì) | ✅ 9/08 giro #44, con freno se il file arriva rotto |
| **I grandi vettori extra UE riconosciuti** (55 compagnie) | ✅ 9/08 giro #44: New York → Roma con Delta esce un no pulito |
| **Il codeshare si chiude chiedendo chi ha operato** | ✅ 9/08 giro #44, `/api/verifica/operativo` |
| **La Svizzera: serve una fonte verificata** | ⏳ resta incerta di proposito, serve Valerio (ARRETRATI G) |
| Golden set | ✅ **55 casi, 55 su 55, falsi positivi 0** |

## 1.2 Le superfici web

| | Stato |
|---|---|
| Landing check-first (hero col campo volo+data, garanzia, prezzi, FAQ oneste) | ✅ 07/08, rifinita (impeccable, taste, seo) |
| Pagina risultato: reveal, dato oggettivo, card condivisibile, cattura email | ✅ 07/08 |
| Checkout Stripe (pratica 16,90 / famiglia 29,90) + webhook firmato | ✅ 22/08: Stripe Managed Payments, prezzi finali IVA inclusa, live in modalità test |
| Lettera di reclamo deterministica + canali compagnie verificati | ✅ 20 compagnie, riverificate l'8/08 (entità legali, NEB, chi rifiuta gli intermediari) + riga meteo pronta ma spenta |
| Sequenza email T+0/2/15/30/60 (Resend) + cron follow-up | ✅ 07/08, invii idempotenti marcati a evento |
| Tracker pratica (web) + area utente | ✅ 07/08 |
| `/admin` shadow mode (conferma umana dei verdetti) | ✅ 07/08, SHADOW_MODE=1 |
| Guida bagagli `/guida-bagagli` (Montreal: solo guida, niente vendita) | ✅ 8/08 notte, footer + sitemap |
| Prove Playwright del flusso in modalità demo | ✅ 208/210 (2 = rete sandbox verso Supabase) + eval 35/35 |
| **Il dopo-lettera: replica al no, segnalazione all'ente, guida al giudice** | ✅ 10/08 giro #45, 8 motivi a scelta chiusa |
| **Il quarto colpo: la conciliazione (ART/ConciliaWeb, ECC-Net)** | ✅ 10/08 giro #48. È l'unico passo dopo il reclamo che i soldi li muove davvero: l'ente accerta e sanziona, non paga |
| **L'onere della prova nelle repliche: le due gambe dell'art. 5 par. 3** | ✅ 10/08 giro #48, in tutte e cinque le repliche dove invocano una circostanza |
| **"Non costituisce parere legale" in fondo a tutti e tre i fogli** | ✅ 10/08 giro #48 |

## 1.3 Deploy e conti

| | Stato |
|---|---|
| Netlify: progetto `rivolio` creato, variabili impostate, rivoglio.netlify.app | ✅ 07/08 via connettore |
| Primo deploy di produzione | ✅ 8/08: **https://rivoglio.netlify.app** (via workbench + connettore; netlify.toml con build e plugin Next). Il rivoglioo.netlify.app di Valerio è un altro account, senza variabili: da dismettere |
| La cassa che incassa | ✅ **22/08: Stripe Managed Payments.** Polar aveva rifiutato il caso d'uso (categoria a restrizione), si è passati a Stripe: anch'esso merchant of record, niente partita IVA per incassare. Live in test; resta un pagamento vero end-to-end e il passaggio da test a live |
| ~~Cassa di prova~~ | ✅ **22/08: cancellata.** C'è la cassa vera (Stripe), la finta non serve più: pagina, rotte e chiave rimosse |
| Chiavi su Netlify: SUPABASE_SECRET_KEY, RESEND_API_KEY, AERODATABOX, MISTRAL, STRIPE | ✅ 8/08 le prime 4 (motore collaudato, FR4001) · ✅ 22/08 STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET |
| Dominio di Rivolio (slot Hostinger gratuito da configurare) | ⏳ **serve Valerio** |
| Legale: condizioni d'uso + disclaimer da avvocato; commercialista sul fiscale | ⏳ prima del lancio vero |

## 1.4 L'app mobile (il tracker, NON la porta)

| | Stato |
|---|---|
| App Expo rinominata, icone, motore, prove | ✅ (base del 07/08) |
| L'app È Rivolio: check a 3 modi (foto carta, tratta, numero), voli salvati, verdetto | ✅ 8/08 |
| Notifiche push sui voli seguiti + tracker pratica DENTRO l'app + profilo + welcome | ✅ 8/08 (l'app non scappa nel sito: fuori solo il pagamento) |
| Scena di scansione nativa (il teatro del check, identico al sito) | ✅ 8/08 notte, provata end-to-end su Expo web |
| Store (Apple 99$, Play 25$ + 12 tester × 14 giorni) | ⏳ serve Valerio; prima l'app completa e bella (sua scelta), poi gli store |

---

# FASE 2 — DISTRIBUZIONE (piano in `DISTRIBUZIONE.md` e `CONTENUTI.md`)

| | Stato |
|---|---|
| Formati video (tabellone, disruption-jacking, check dal vivo, screenshot loop) | ✅ scritti |
| Account `@rivolio` su TikTok/IG/YouTube | ⏳ **serve Valerio, subito** |
| Primi 10 video girati (si può PRIMA del lancio) | ⏳ Valerio |
| Newsletter "Osservatorio dei Disservizi" (Brevo) | ⏳ coi primi iscritti |
| **Il Tabellone**: il blog su `/tabellone`, hub and spoke, 10 articoli | ✅ 9/08 giro #40 |
| Copertine fotografiche degli articoli (10 prompt pronti in `COPERTINE.md`) | ⏳ **serve Valerio** |
| Fonti degli articoli riaperte e confermate dal PC di Valerio | ⏳ **serve Valerio** (da qui la rete è chiusa) |
| Pagine evento: `/sciopero-aerei`, `/sciopero-aerei/<data>`, `/aeroporto/<sigla>` | ✅ 9/08 giro #41 |
| Autopilot: gli scioperi si aggiornano da soli ogni notte, con allarme se si rompe | ✅ 9/08 giro #41 · ⏳ primo giro vero dopo il deploy |
| Un articolo nuovo a settimana, sempre lo stesso giorno | ⏳ da qui in avanti |
| **Il cruscotto**: `/admin/cruscotto`, chi arriva, da dove, dove si ferma, chi paga | ✅ 11/08 giro #56 |
| Il TIN sul telefono: soldi, guasti, riepilogo della sera | ✅ 11/08 · ⏳ **serve Valerio**: 3 minuti su Telegram |

**Perché il cruscotto sta in FASE 2 e non in FASE 1.** Non serve a
costruire il prodotto, serve a distribuirlo: senza, il primo video si
giudica a sensazione. Con, si vede quale ha portato gente e a quale
gradino si ferma; e la distanza fra "aprono la pratica" e "pagano la
pratica" è l'unico punto dove si perde qualcuno che aveva già deciso
di pagare.

# FASE 3 — MIGLIORAMENTO, ITERAZIONE E MANTENIMENTO

Si apre quando la FASE 1 è chiusa e la 2 gira. Dentro ci sta:
- **I verticali nuovi** (la retention vera): bagagli a settembre (Montreal,
  scontrino 300-1.900€, la Cassazione 2026 sul PIR è un argomento che
  nessuno usa) · treni gratis a ottobre (calamita) · bollette 2027.
- **Iterazione sui dati veri**: ogni rifiuto delle compagnie diventa un caso
  etichettato nel golden set; shadow mode che si spegne a 100 verdetti
  puliti; correzioni guidate da quello che chiedono gli utenti.
- **Mantenimento**: regole aggiornate quando la riforma UE entra in vigore
  (~agosto 2027, ruleset v2), canali compagnie riverificati, costi API
  sotto controllo.
Niente gamification, mai: si torna perché "mi devono dei soldi" succede
3-4 volte l'anno, non per gli streak.

---

## Cosa blocca cosa

```
 UN VENDITORE CHE ACCETTI IL CASO D'USO ──→ si incassa (È IL COLLO DI BOTTIGLIA)
 deploy dell'ultimo ramo (Valerio) ──→ online anche design nuovo e Osservatorio dati veri
 dominio ──→ Resend verificato ──→ email a chiunque + link puliti nei video
 account social ──→ FASE 2
 blog online ──→ traffico da Google che non costa niente (mesi, non giorni)
```

**Sul blog, una cosa da sapere.** Il traffico organico non arriva la
settimana dopo: le pagine vanno indicizzate, poi salgono. Il Tabellone è
un investimento sui mesi, non la leva per ottobre. La leva per ottobre
resta la distribuzione video. Il blog serve perché a gennaio quel traffico
c'è già e non si paga.

**La prova AeroDataBox è fatta (8/08, chiave vera su voli reali): non
restano rischi tecnici aperti.** Tutto il resto è esecuzione.

## Prossimo pezzo di codice
Il motore è chiuso: da qui il collo di bottiglia non è più il prodotto,
**è il traffico** (dalla ricerca del giro #37: la conversione di lavoro è
1% al lancio, 2-3% a regime, e il traffico è quello che manca).
Quindi: deploy, le due cose che sbloccano le email (dominio su Resend e
migrazioni), poi FASE 2, distribuzione.

⚠️ **Ma dall'11/08 c'è un secondo collo di bottiglia, ed è più duro:
nessun venditore ufficiale accetta il caso d'uso.** Il muro del check è
costruito, provato e acceso, e il bottone "Sblocca l'analisi" porta a Stripe (Managed
Payments, live in test). Quello che resta è un pagamento vero end-to-end,
il passaggio da test a live e il commercialista per il reddito.

**Il dopo-lettera è finito, e adesso ha quattro colpi**: reclamo, replica
al loro no, segnalazione all'ente, conciliazione. È il pezzo che dalla
riforma del 2027 esce come il più importante del prodotto: da allora sarà
la compagnia stessa a dire al passeggero che può chiedere, e quello che
resterà da vendere non è più "ti diciamo se ti spetta", è **quando ti
dicono di no, ecco cosa fai**.

Le cose chieste e non fatte: `ARRETRATI.md`.
