# DECISIONI — MicroStay Alert

Una riga per scelta chiusa: **cosa**, **perché**, **quando**.
Se una cosa è qui, non si ridiscute. Se cambia, si aggiunge una riga nuova
con la data e si marca la vecchia `[SUPERATA]`.

| Data | Decisione | Perché |
|---|---|---|
| 2026-08-06 | Struttura repo a 4 file (CLAUDE.md / STATO.md / SPEC.md / DECISIONI.md) + `.claude/` | Contesto pulito: solo CLAUDE.md e STATO.md caricati sempre, il resto letto su richiesta |
| 2026-08-06 | Nessuno stack scelto prima della spec approvata | Scegliere la tecnologia prima di sapere cosa si costruisce fa buttare lavoro |
| 2026-08-06 | `[SUPERATA il 07/08: si fa la mobile app negli store]` **Web app, non app nativa** (iOS/Android) | Apple chiede €99/anno + In-App Purchase obbligatorio sugli abbonamenti digitali (15-30% di commissione); Google Play $25 + review. Con Stripe su web la commissione è ~1,5% + €0,25. Un alert non ha bisogno di un'app: email/Telegram/push arrivano lo stesso. La web app è online in giornata a €0. Reversibile: l'app nativa si aggiunge dopo, quando gli abbonati la pagano |
| 2026-08-06 | **Ingestione offerte = innesto sostituibile** (`source` adapter) | La scelta della fonte prezzi è rimandata (Valerio, 06/08). Il resto del prodotto non deve dipenderne: le offerte entrano in una tabella `offerte` con un campo `fonte`, e ogni fonte è un modulo separato che si può aggiungere o togliere senza toccare il motore di match né gli alert |
| 2026-08-06 | `[SUPERATA il 07/08 sera: il nome è Rivolio]` **Nome: `Viaggio Anche Io`**, per esteso ovunque | Scelto da Valerio. Nasce dal dato di partenza: 40 milioni di italiani non partono ad agosto — "anche io" è la rivendicazione di chi ci va lo stesso, col suo budget. Avevo obiettato sulla lunghezza (14 lettere) e proposto il marchio corto `Anche Io` + payoff: **Valerio ha confermato la forma estesa. Chiuso.** |
| 2026-08-06 | **Tono: amico diretto, si dà del tu** | Pubblico 25-45 che arriva dai social. Voce: *"Dimmi da dove parti e quanto vuoi spendere. Al resto ci penso io."* Frasi corte, zero gergo, zero superlativi pubblicitari |
| 2026-08-06 | **Tutta Italia dal giorno 1**, partenza per comune/CAP e non da un menù di città | Deciso da Valerio. Non costa quanto sembra: un'offerta è un punto sulla mappa, non appartiene a una città — un agriturismo in Toscana serve chi parte da Milano, Bologna, Firenze e Roma insieme. In più le iscrizioni dicono dove sta davvero la domanda. **Buco noto: le isole** (vedi SPEC §9) |
| 2026-08-06 | **Pricing: crediti. 1 credito = 1 alert ricevuto.** 5/€3,99 · 20/€12,99 · 50/€24,99. Nessun abbonamento | Deciso da Valerio. Avevo obiettato due cose — l'incentivo si inverte (guadagni mandandone di più, l'utente ne vuole meno e migliori) e l'utente non sa quanto spenderà — e avevo proposto di vendere la "caccia da 30 giorni". **Valerio ha scelto i crediti avendo le obiezioni sotto gli occhi. Chiuso, si implementa così.** Mitigazione concordata dentro il suo modello: **tetto di alert/settimana scelto dall'utente** |
| 2026-08-06 | 3 crediti gratis all'iscrizione; i crediti non scadono | *Decisione mia, reversibile (è un numero nel DB).* Provare con alert veri è il modo migliore di convertire su un modello a consumo, e una scadenza fa sentire l'utente fregato |
| 2026-08-06 | **Netlify, non Vercel** | Verificato: il piano gratuito Netlify **permette l'uso commerciale** (SaaS a pagamento dentro i 300 crediti/mese); Vercel Hobby lo **vieta** nei Termini e obbliga a Pro a $20/mese appena incassi. Valerio ha già l'account. Risparmio: $240/anno |
| 2026-08-06 | **Si costruisce la landing page per prima**, prima del motore | Deciso da Valerio. Va online e raccoglie iscritti mentre il resto è in costruzione: puoi iniziare i video al giorno 2 invece che al giorno 7. Riferimento visivo dato da Valerio: stile Monex — fondo chiaro, accento verde menta, titoli grandi, angoli arrotondati, mockup telefono con card che fluttuano, CTA a pillola |

| 2026-08-06 | **Obiettivo: cassa entro ottobre 2026**, non prodotto perenne | Valerio punta a €30-100k in ~8 settimane e poi mette in pausa fino all'anno prossimo. Ogni scelta si giudica su "avvicina il primo pagante?" — niente architettura per scalare a milioni |
| 2026-08-06 | `[SUPERATA il 07/08: si fa la mobile app negli store]` **Web app installabile (PWA), niente App Store** | Apple: €99/anno + 15-30% di commissione sugli abbonamenti digitali + revisione di giorni o settimane. Con 8 settimane di tempo è insostenibile. Le notifiche arrivano su Telegram, che è già un'app installata: la sensazione di "app vera" si ha lo stesso |
| 2026-08-06 | **Landing e app sono lo stesso progetto**: `/` pubblica, `/app` dietro login | Un solo dominio, un solo codice, uno stile solo. Serve in più: Supabase Auth + RLS (regole a livello di database, così un bug nel codice non può esporre i dati di un altro utente) |
| 2026-08-06 | **Pagamenti: Polar (Merchant of Record), non Stripe** `[SUPERATA il 22/08: Polar ha rifiutato, si passa a Stripe]` | Valerio **non ha ancora la partita IVA**. Polar diventa il venditore legale, incassa a nome proprio, gestisce l'IVA europea e gira il netto. ⚠️ NON risolve come ricevere legalmente il denaro in Italia: serve comunque un commercialista |
| 2026-08-22 | **Pagamenti: Stripe Managed Payments, non Polar** | Polar ha rifiutato il caso d'uso (categoria reclami di viaggio, a restrizione). Stripe Managed Payments è anch'esso merchant of record: incassa a nome proprio, gestisce l'IVA UE, gira il netto, e non serve la partita IVA per incassare. Prezzi finali IVA inclusa (`tax_behavior: "inclusive"`). Live in modalità test. Resta il commercialista per il reddito. |
| 2026-08-06 | **Prezzi confermati: 5/€3,99 · 20/€12,99 · 50/€24,99** | Gli ho mostrato il conto (con ordine medio ~€10 servono ~3.000 clienti per €30k, cioè ~1.070 iscritti al giorno per 8 settimane) e ho proposto una scala più alta. **Valerio ha scelto di restare così avendo i numeri sotto gli occhi. Chiuso: non si riapre** |
| 2026-08-06 | **Marchio bianco + verde.** Logo di Valerio da rifare semplificato e in verde; tagline sua tenuta: *"La tua fuga, al prezzo giusto"* | Il logo originale (oro + blu notte, emblema dettagliato) ha due problemi: illeggibile a 24-32px, che è dove si vedrà quasi sempre (favicon, avatar Telegram, icona home), e la palette oro/blu comunica lusso — l'opposto di quello che si vende |
| 2026-08-06 | **Framer non esporta codice**: la landing si ricostruisce in Next.js dal template | Framer genera un albero di componenti proprietario che gira solo sulla loro infrastruttura. Il plugin ufficiale di export costa $50/mese (personale) o $250/mese (commerciale). Valerio manda il link del template pubblicato e lo rifaccio in codice |
| 2026-08-06 | **shadcn/ui per l'area riservata**, non per la landing | Componenti già accessibili e testati per menu, finestre, form: giorni risparmiati. La landing resta su misura perché è lì che il marchio si vede |

## Vincoli esterni VERIFICATI — non riaprire, non ricercare di nuovo
Verificato il 2026-08-06. Se serve rimetterlo in discussione, prima rileggi qui.

- **Booking.com Demand API** — domande di connettività *sospese* per aggiornamento T&C; e le regole d'uso vietano l'impiego dei contenuti Booking in *comparatori di prezzo*. Non è una strada.
- **Amadeus Self-Service** — il piano gratuito è in dismissione, chiavi esistenti disattivate a metà 2026. Nessun equivalente free.
- **Travelpayouts / Hotellook cache API** — **spenta.** Test diretto: `engine.hotellook.com/api/v2/cache.json` e `/lookup.json` → HTTP 404 su ogni rotta; `hotellook.com` non risponde (HTTP 000).
- **Travelpayouts Hotel Search API** — richiede approvazione via email *e* impone che ogni ricerca sia avviata da un utente in tempo reale. Incompatibile con uno scanner in background.
- **SerpAPI (Google Hotels)** — funziona, nessuna approvazione. $25/mese per 1.000 ricerche, $75 per 5.000, $150 per 15.000. Tetto di throughput: 20% del volume mensile per ora.
- **Trenitalia / Italo** — **nessuna API pubblica ufficiale.** Solo librerie non ufficiali da reverse engineering, che gli autori dichiarano instabili. Non reggono una promessa di prezzo.
- **iOS e notifiche push web** — un sito normale NON può notificare un iPhone. Servono le PWA aggiunte alla schermata Home (da iOS 16.4, ancora vero nel 2026, su tutti i browser perché Apple impone WebKit). Su Android basta un tap. Per questo Telegram è il canale principale: è già un'app con i permessi di notifica.
- **Prezzo carburante** — dato pubblico dell'Osservatorio MIMIT, aggiornato ogni settimana. Il 06/08/2026: benzina self **€1,994/l** (rete stradale), €2,072/l in autostrada. **Da leggere dalla fonte, mai scritto fisso nel codice.**
- **`.claude/verify.cmd` NON è uno script batch**, nonostante l'estensione. L'hook `verify-gate.js` legge il file, prende la **prima riga non commentata** e la passa a `powershell.exe -Command`. Quindi contiene UNA riga sola. La logica vera sta in `.claude/verify.ps1`. Sbagliato una volta il 06/08 (scritto come `.cmd` batch → PowerShell non sa leggere `@echo off`).

## Chiuse il 06/08 — secondo giro

| Decisione | Perché |
|---|---|
| `[SUPERATA il 07/08]` **Web app ora, store dopo il primo incasso.** Scelta di Valerio. | Apple: 99€/anno, 15-30% su ogni credito venduto, più una revisione che su uno sprint di 8 settimane può costarne 2. Il pacchetto per gli store (Capacitor) entra in FASE 3, dopo che l'incasso esiste. Nel frattempo il manifest la rende installabile sulla schermata Home: sul telefono è indistinguibile da un'app scaricata. |
| **Accesso: email+password come strada principale, link magico come alternativa.** | La password funziona a ogni accesso senza dipendere dalla consegna di un'email. Con la posta interna di Supabase limitata a 2 email l'ora, un login basato solo sul link magico si sarebbe piantato al terzo utente. |
| **I pulsanti principali della landing portano a registrarsi, non alla lista d'attesa.** | La lista d'attesa aveva senso quando non esisteva il prodotto. Ora esiste: mandare la gente su un modulo email invece che dentro l'app butta via l'unica cosa che convince, cioè provarla. Il modulo resta in fondo per chi non vuole ancora un account. |
| **`shadcn init` non si lancia su questo progetto.** | Riscrive `globals.css` con i suoi token e cancella il sistema di colori costruito sul verde. I componenti si copiano a mano: è lo stesso codice, senza il danno. |
| **Nessun testo di Supabase arriva all'utente così com'è.** | Risponde in inglese. Un messaggio inglese in mezzo a un prodotto italiano fa sembrare tutto un giocattolo. Quello che non riconosciamo diventa generico e finisce nei log. |

## Da rivedere quando ci sarà il dominio
- **`mailer_autoconfirm` acceso** (conferma email spenta) è una toppa, non una scelta.
  Motivo: la posta interna di Supabase manda **2 email l'ora**, quindi con la
  conferma accesa il terzo iscritto della giornata non entra. Si riaccende
  appena Resend è verificato sul dominio e collegato come SMTP.
- `site_url` è ancora `http://localhost:3000` e `uri_allow_list` è vuota: i link
  nelle email punteranno al posto sbagliato finché non si cambiano.

## Chiuse il 07/08 — la fonte delle offerte, finalmente

**Scelta di Valerio: raccolta automatica dal web** (Exa, Firecrawl, SearXNG,
Playwright, agenti che navigano e leggono).

Architettura decisa di conseguenza: **`lib/offerte/` con un tipo normalizzato
unico e raccoglitori intercambiabili.** Nessuna parte del prodotto sa da dove
arriva un'offerta: il motore vede solo righe nella tabella `offerte`. Così si
cambia raccoglitore senza toccare niente altro, e se ne possono tenere accesi
più di uno insieme.

### Dove si può raccogliere e dove no — leggere PRIMA di scrivere codice
Questa distinzione non è prudenza legale: è la differenza fra un sistema che
funziona e uno che smette di funzionare dopo due settimane.

| Fonte | Si può? | Perché |
|---|---|---|
| Siti di hotel, B&B, agriturismo **indipendenti** | ✅ **Sì, ed è la strada** | Vogliono essere trovati. Nessun sistema anti-bot, prezzi in chiaro, spesso dati strutturati `schema.org/Offer` già pronti. In Italia sono decine di migliaia |
| Portali turistici regionali, consorzi, Pro Loco | ✅ Sì | Dati pubblici, spesso con feed |
| Booking, Airbnb, Expedia | ❌ **No** | Vietato dalle loro condizioni; sistemi anti-bot seri (impronta del browser, blocco IP, CAPTCHA); e in UE i loro elenchi sono protetti dal diritto sui database. Un prodotto commerciale costruito sopra è un rischio vero, non teorico |
| Google Hotels via SerpAPI | ⚠️ A pagamento | Legale, 25$/mese per 1.000 ricerche. Resta l'alternativa se la raccolta diretta non basta |

**Regola operativa:** si rispetta sempre `robots.txt`, si va piano (una
richiesta al secondo per dominio), ci si dichiara con uno user-agent vero e un
indirizzo di contatto. Un raccoglitore che si maschera è un raccoglitore che
verrà bloccato, e intanto brucia il dominio.

**Ogni offerta raccolta nasce `stato = 'demo'`** e diventa `attiva` solo dopo
una verifica. Nessun alert parte da un'offerta non verificata: mandare qualcuno
su un link morto è l'unico errore da cui questo prodotto non si riprende.

## Chiusa il 07/08 — la ritenzione

**Prodotto stagionale, accettato consapevolmente.** Scelta di Valerio.
Si incassa nei picchi (primavera, ponti, estate) e si accetta il silenzio in
mezzo. Conseguenza da tenere a mente: **serve un flusso costante di utenti
nuovi**, perché sui vecchi non si può contare. Questo sposta peso sulla FASE 2
e rende il blog quotidiano più importante dei video, non meno.

## Chiuse il 07/08 — vocabolario e primo invio

| Decisione | Perché |
|---|---|
| **"Alert" → "destinazione"**, ovunque. Scelta di Valerio. | "Alert" è gergo da centrale operativa. "Ottieni la tua prossima destinazione" è italiano vero. I "crediti" restano crediti. |
| **Vetro sui bottoni secondari, pieno sul principale.** | Su fondo chiaro il vetro perde contrasto proprio dove serve cliccare. |
| **Badge store solo nel footer, inerti, "Presto su".** | Un badge cliccabile verso un'app inesistente è pratica ingannevole (AGCM). |
| **Le email di consegna vanno a `valerio@artecai.it`** finché il dominio non è verificato su Resend. | Resend in modalità prova spedisce solo al proprietario dell'account. Il login dell'app resta sul gmail. |
| I prezzi della riviera romagnola sono **a persona a notte**, non a camera. | Verificato su Hotel Apollo: "€ 60,00 al giorno / persona". Il raccoglitore assume prezzo-camera: la verifica umana corregge. |

## Chiuse il 07/08 — il pivot: mobile app negli store

**Scelta di Valerio (07/08, con immagini di riferimento):** il prodotto è
un'**app mobile su App Store e Google Play**, non la web app. Conseguenze
decise insieme al pivot:

| Decisione | Perché / dettagli |
|---|---|
| ~~**La landing non porta più all'app web.**~~ **[RIBALTATA da Valerio l'8/08]**: la web app torna linkata dal sito (voce "Entra" in nav, "La web app" nel footer) e `/app` è aperta a TUTTI senza account, col check libero e illimitato; l'elenco pratiche appare solo da collegati. Niente redirect verso la home o verso /entra. | Richiesta esplicita di Valerio dell'8/08: "rimettila accessibile dal sito, ognuno quante analisi vuole". |
| **La web app resta viva**: serve il pannello `/admin` (che resta chiuso da login) e il tracker delle pratiche. Il motore server (raccolta, abbinamento, invio) resta dov'è. | Il backend non cambia: cambia la superficie utente. |
| **Framework: Expo SDK 57 (React Native) + expo-router + supabase-js.** | Ricerca del 07/08 con fonti: si riusa il TypeScript e il Supabase già scritti, EAS compila per iOS senza Mac (30 build/mese gratis), notifiche native con expo-notifications. Flutter = riscrivere tutto in Dart senza benefici per questo caso. In `mobile/PROGETTO.md` i contratti. |
| **Niente NativeWind**: stile con StyleSheet e token in `mobile/src/lib/tema.ts`, stessi valori del sito. | NativeWind stabile vuole Tailwind 3, il sito usa la 4: la configurazione non si condivide comunque. Meno pezzi mobili. |
| **Le notifiche push native sostituiscono Telegram come canale principale.** Bot Telegram rimandato (scelta di Valerio: "per adesso no"). | Il motivo per cui esisteva Telegram (l'iPhone non riceve push web) sparisce con l'app nativa. |
| **Permesso notifiche chiesto DOPO la creazione della prima ricerca**, mai al primo avvio, con schermata di spiegazione prima del prompt nativo. Chi rifiuta riceve via email. | Ricerca onboarding 07/08 (pattern Hopper): al primo avvio è la prima causa di rifiuto del permesso. |
| **Onboarding in 6 passi, valore prima dell'account**: benvenuto → conto di esempio (marcato demo) → criteri senza account → aggancio → registrazione → avvisi. | Ricerca 07/08: le app che mostrano il valore prima della registrazione convertono di più. Il nostro aha è il conto aperto. |
| **Crediti dentro l'app = acquisti in-app di Apple e Google, quando si accenderanno.** Polar può vendere solo sul web: non ha acquisti in-app. | Verificato il 07/08: i crediti sono beni digitali consumabili, guideline Apple 3.1.1 e Play Billing obbligatori (15% sotto il milione col programma small business). Le vie UE del DMA esistono ma con commissioni comunque dovute e obblighi di rendicontazione: non per la v1. **V1 senza acquisti**: si parte coi 3 crediti gratis. |
| `[SUPERATA il 07/08 sera dal pivot Rivolio]` **Dominio comprato da Valerio: `ancheioviaggio.it`** (07/08). | Era il dominio dell'idea viaggi. Col nome nuovo non serve più: il dominio per Rivolio è da prendere. Nel Hostinger di Valerio c'è uno slot dominio gratuito ancora da configurare (verificato via Composio il 07/08). |

### Vincoli store VERIFICATI il 07/08 — non riaprire
- **Apple Developer individuale**: 99 USD/anno, si apre da privato senza partita IVA, approvazione 24-48h, review app tipica 24-72h. Prima app: 1-2 settimane realistiche con un rifiuto messo in conto.
- **Google Play personale**: 25 USD una tantum, verifica documento. **Test chiuso obbligatorio per i nuovi account personali: 12 tester per 14 giorni consecutivi**, poi review di produzione (7-14 giorni). Totale realistico: 4-6 settimane. È il collo di bottiglia dei tempi.
- **Sign in with Apple**: obbligatorio (guideline 4.8) se offriamo "Continua con Google" nell'app.
- **EAS Build gratuito**: 30 build/mese (max 15 iOS), coda lenta nelle ore di punta USA. Le notifiche remote NON si provano su Expo Go né sul simulatore iOS: serve una build di sviluppo su un iPhone vero.

## Chiusa il 07/08 (sera) — IL PIVOT: da Viaggio Anche Io a Rivolio

**Scelta di Valerio.** Ha trovato concorrenti più grandi che fanno la stessa
identica cosa: l'idea viaggi è chiusa. Il pivot è di PRODOTTO, non di
struttura né di sviluppo:

- **Si tiene TUTTO**: landing Next, app mobile Expo, Supabase (stesso
  progetto, stesse tabelle), motore, pannello, componenti, prove, documenti,
  modo di lavorare. Niente si rifà da zero.
- **Nome nuovo: Rivolio.** Rinominato ovunque: codice web e mobile, bundle
  (`it.rivolio.app`), pacchetti, documenti, repo GitHub e progetto Supabase.
- **Cosa fa il nuovo prodotto lo definisce Valerio a breve.** Fino ad allora
  i testi descrivono ancora l'idea vecchia: si riscrivono in blocco alla
  definizione, non a pezzi prima.
- Il registro qui sopra NON si riscrive: le decisioni superate restano
  marcate `[SUPERATA]`, come da regola del file. La storia è storia.

## Chiuse il 07/08 (notte) — RIVOLIO È DEFINITO: lo scanner dei rimborsi

**Il documento completo di Valerio definisce il prodotto.** SPEC.md riscritta
da lì. Le scelte strutturali, chiuse:

| Decisione | Perché |
|---|---|
| **Prodotto: check gratuito del volo sul web, pratica a pagamento.** Verticale 1: voli (CE 261/2004). Bagagli a settembre, treni gratis (calamita) a ottobre. | Mercato validato (AirHelp: 3M richieste processate), <10% riscuote, nessun prodotto self-service in Italia. |
| **Funnel web-first: il check NON chiede mai login, email o download prima del verdetto.** L'app mobile è il tracker post-pagamento, mai la porta. | Vale un 3,5x di conversione (conti nel documento). Ogni richiesta prima del reveal costa il 40% degli utenti. |
| **Il motore decide, l'AI mai.** Rules engine deterministico versionato (`lib/regole/eu261.ts`, 2026.08.1), TRE stati: idoneo, incerto (mai vendere), non idoneo. Eval con soglia bloccante: falsi positivi = 0. | Un falso positivo è uno che paga per niente: vale 50 falsi negativi. Il 261 è un albero di if, non interpretazione. |
| **Shadow mode al lancio**: ogni idoneo aspetta la conferma umana in `/admin` prima che si possa pagare. Si spegne dopo 100 verdetti di fila senza correzioni. | Dal documento (fase C). Ogni correzione è un caso nuovo per il golden set. |
| **Prezzi (dal 22/08): check 1,99 (interruttore) / 1 pratica 16,90€ / famiglia stesso volo (fino a 5) 29,90€.** Prezzi finali, IVA inclusa. Nessun altro SKU. | Meno scelte, più conversione. La famiglia è il margine. |
| **Garanzia: "Se la compagnia non paga, non paghi neanche tu."** | I conti del documento: con garanzia il netto è uguale ma tieni recensioni e marchio. Non si toglie. |
| **9/08/2026: la garanzia è legata all'ESITO, non ai 90 giorni** (scelta di Valerio col popup) | Le compagnie rispondono in 8-14 settimane: il giorno 90 cadeva dentro l'attesa, e clienti onesti avrebbero chiesto il rimborso a pratica ancora viva. Al 50% di escussioni il margine per pratica scendeva da 13,66 a 6,83 euro. Ora scatta se la compagnia rifiuta senza un motivo valido o non risponde nei termini di legge. |
| **Lettera deterministica in v1, senza LLM.** Modello rigido con i dati del volo, artt. 5-7 CE 261/2004. L'utente la invia DALLA SUA email: Rivolio è un generatore di documenti, non un intermediario. | Zero allucinazioni normative possibili. Ryanair è ostile agli intermediari: l'invio in proprio è un vantaggio, si vende. |
| **Dati volo: AeroDataBox primario, AviationStack riserva, cache per volo+data, payload grezzo archiviato sempre.** OpenSky VIETATO (licenza non commerciale). | Il fatto oggettivo è il prodotto. Doppia fonte discordante >15 min = incerto. |
| **Pagamenti (dal 22/08): Stripe Managed Payments** (Polar ha rifiutato il caso d'uso). Stripe Checkout + webhook firmato. ⚠️ Managed Payments solleva dall'IVA UE ma NON dal dichiarare il reddito: serve il commercialista. | MoR come Polar, ma aperto. IVA inclusa nel prezzo mostrato. |
| **Deploy su Netlify** (progetto `rivolio`, sito rivoglio.netlify.app, creato via connettore il 07/08). Il documento suggeriva Vercel: Valerio ha scelto Netlify, che è già in DECISIONI dal 06/08. | Scelta di Valerio, connettore diretto disponibile. |
| **Design system tenuto** (verde, Geist/Poppins, corsivo): il verde è il colore dei soldi che tornano. Il documento suggeriva font nuovi: non si rifà quello che funziona. | Pivot di prodotto, non di struttura. |
| **Niente gamification, mai.** Niente streak, badge, reward variabili. | Prodotto sui diritti: la ricompensa deve essere prevedibile e verificabile. La fiducia è l'unica moneta. |
| Tabelle viaggi (offerte, ricerche, invii, strutture) = eredità: restano nel DB, il prodotto non le usa. Il motore viaggi resta nel codice, spento. | Nessun dato si butta. |

## Decisioni ancora aperte
Vivono in `SPEC.md` → "Domande aperte". Appena chiuse, scendono qui.
- **Chiave AeroDataBox + la prova delle 2 ore** (Valerio): 10 voli reali,
  l'orario effettivo di atterraggio deve esserci. È l'unica cosa che può
  ancora far saltare il progetto.
- ✅ **Cassa: fatta** (Stripe Managed Payments, live in test). Chiusa, è
  registrata nella tabella dei vincoli qui sopra.
- **Dominio per Rivolio**: `rivolio.it` da verificare e prendere (slot
  gratuito Hostinger da configurare).
- **Account store** (per il tracker mobile, dopo): Apple 99$/anno, Play 25$
  + 12 tester × 14 giorni. Bundle `it.rivolio.app` già pronto.
- **Legale**: condizioni d'uso e disclaimer da far leggere a un avvocato
  prima del lancio; commercialista sul regime fiscale.
