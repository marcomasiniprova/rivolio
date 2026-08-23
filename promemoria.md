# Promemoria Rivolio

Il mio blocco note condiviso. Qui segno le cose da fare, mie e tue, e a ogni
giro ti ricordo quelle tue ancora aperte. Le spiegazioni sono in parole
semplici, come piace a te.

Aggiornato: 2026-08-23.

---

## DA FARE TU (Valerio) — le cose che solo tu puoi fare

### 1. Test in locale della seconda fonte (AviationEdge)
**A cosa serve:** misurare quanti "non lo so" diventano "idoneo" grazie alla
seconda fonte, prima di legarti ai 299 dollari al mese fissi.
**Come si fa:**
1. accendi il mese scontato di AviationEdge e prendi la chiave;
2. incolla la chiave nel file `.env.development.local` (nella cartella del
   progetto) su una riga nuova: `AVIATIONEDGE_API_KEY=la-tua-chiave`;
3. sempre da quella cartella, lancia: `npm run banco`.
**Cosa guardi:** la tabella dei 30 voli veri con la colonna "2ª FONTE", e in
fondo la riga "RECUPERATI dalla 2ª fonte: N idonei (+X€)". Quel N è il numero
che dice se vale la pena tenerla. Incollamelo e decidiamo insieme.

### 2. Meteo sul tuo VPS (Open-Meteo self-hosted) — FATTO il 19/08
**A cosa serve:** smontare la scusa del maltempo nella lettera di risposta a
un "no" della compagnia. NON serve a trovare clienti: serve a vincere le liti.
Costo in più zero, perché il VPS ce l'hai già.
**Fatto:** il modulo (`lib/meteo/openmeteo.ts`) ora parla con la tua istanza
`https://meteo.artecai.cloud` (autenticazione Basic, password solo in variabile
d'ambiente). Guarda partenza E arrivo del volo, e usa le variabili giuste:
raffiche, neve e nubi basse dallo storico, codice meteo dalle previsioni per i
voli degli ultimi 5 giorni. La cache (tabella `meteo_cache`) è già sul database
vero. Provato dal vivo contro il tuo server: risponde 200, dati veri, tutte le
variabili presenti. Le due variabili `OPENMETEO_URL` e `METEO_API_PASSWORD`
sono già su Netlify: si accende da solo al prossimo deploy.
**L'unica cosa che resta a te, e solo per lo sviluppo in LOCALE:** aggiungi le
stesse due variabili al tuo `.env.development.local` (la password è quella che
hai dato alla tua istanza). In produzione è già tutto pronto.

### 3. Netlify: fai reindirizzare il vecchio indirizzo al nuovo
**Perché:** oggi il sito risponde SIA su rivolio.it SIA su
rivolio.netlify.app (li ho controllati, rispondono tutti e due). Il sito
dichiara già rivolio.it come indirizzo ufficiale (canonical), quindi Google
capisce qual è quello buono. Ma per pulizia conviene che chi apre
rivolio.netlify.app venga spinto in automatico su rivolio.it.
**Come:** su Netlify, impostazioni del dominio, metti **rivolio.it come
dominio principale (primary domain)**. Da lì Netlify reindirizza il vecchio da
solo. Cosa da due minuti.

### 4. Ri-esporta l'app dopo aver cambiato l'indirizzo
Se cambi `EXPO_PUBLIC_SITO`, l'app va ri-esportata (`npm run anteprima` dentro
`mobile/`), perché quell'indirizzo si decide quando l'app viene costruita, non
quando la apri. Ho già messo rivolio.it come riserva nel codice dell'app.

### 5. Scioperi: se trovi un file aggiornato al 2026, mandamelo
Il file del Ministero che mi hai dato ha le colonne giuste (settore, chi
sciopera, esclusioni) ma **si ferma al febbraio 2020**: nessun volo che si
reclama oggi è così vecchio, quindi per gli scioperi di oggi non serve. Per
quelli di oggi tengo l'autopilota che già gira. Se sul sito del Ministero
trovi la versione aggiornata al 2025-2026, scaricala e mandamela: il lettore
lo costruisco su quello schema in mezza giornata.

### 6. Solidità per l'alto traffico (dall'audit del 14/08)
Prima di mandare un video a migliaia di persone, quattro cose tue. Il codice
per reggerle è già a posto o pronto; queste sono configurazioni.
1. ~~**Applica la migrazione** `supabase/2026-08-14-scala.sql`~~ ✅ **FATTA
   io il 15/08 col connettore Supabase**, insieme a quella della coda
   (`2026-08-15-coda.sql`) e delle recensioni (`2026-08-15-recensioni.sql`).
   Verificato sul database vero: tabelle, colonne e indici tutti presenti.
2. 🔴 **AeroDataBox: i numeri VERI, riletti col motore di Firecrawl il
   15/08** (prima ti avevo detto una cosa sbagliata: il limite al secondo
   NON è uguale su tutti i piani, cresce col piano). I quattro piani su
   RapidAPI:
   - **Basic (gratis):** 2.400 richieste/mese, 600 "unità"/mese, **1 al
     secondo**, storico ±365 giorni.
   - **Pro ($5,35/mese):** 24.000 richieste, 6.000 unità, **1 al secondo**.
   - **Ultra ($32/mese, consigliato da loro):** 240.000 richieste, 60.000
     unità, **2 al secondo**, storico ±210 giorni.
   - **Mega ($160/mese):** 2,4 milioni di richieste, 600.000 unità, **3 al
     secondo**, storico ±365 giorni.
   ⚠️ **Due tetti, non uno:** le "richieste" e le "unità". Ogni nostra
   chiamata al volo costa più di un'unità (gli endpoint ricchi ne costano
   6), quindi a esaurirsi per primo è il tetto delle UNITÀ, non delle
   richieste. Sul Basic 600 unità sono poche centinaia di controlli veri al
   mese: buono per provare, non per un lancio.
   ⚠️ **Il collo di bottiglia di un video resta il "al secondo":** anche
   col Mega sono 3 voli DIVERSI al secondo (la cache aiuta solo sui voli
   ripetuti). Per un lancio grosso: **Ultra o Mega**, e la coda-email (già
   costruita il 15/08) raccoglie chi arriva mentre siamo in piena.
3. **Accendi il freno condiviso:** su Netlify metti `UPSTASH_REDIS_REST_URL`
   e `UPSTASH_REDIS_REST_TOKEN` (account gratuito Upstash). Il codice del
   freno c'è già, è spento perché mancano quelle due righe. Senza, le rotte
   che ci costano (dati volo, OCR) non hanno un tetto vero sotto tanti
   utenti da tante macchine.
4. **Resend a pagamento prima del lancio:** il piano gratis manda 100 email
   al giorno. Il giorno del video le superi e i benvenuti dei clienti
   paganti si perdono in silenzio. I 20 $/mese che avevi in mente bastano.


- **Telegram:** su Netlify mancano due righe, `TELEGRAM_BOT_TOKEN` e
  `TELEGRAM_ADMIN_CHAT` (chat id 8534801784), poi *Trigger deploy*. I valori
  stanno in `.env.development.local`.
- **Supabase, una spunta:** Authentication, Policies, accendi "Leaked
  password protection". Impedisce che qualcuno apra un account con una
  password già rubata. Dieci secondi.
- **Pagamenti: FATTO, la cassa è Stripe.** Stripe Managed Payments (merchant
  of record: versa l'IVA al posto nostro, niente partita IVA). Check e pratica
  si pagano davvero, prezzi finali IVA inclusa. Restano solo
  `STRIPE_WEBHOOK_SECRET` su Netlify e un pagamento di prova con carta test.
- **Dominio email:** verifica `send.rivolio.it` su Resend e metti
  `RESEND_MITTENTE = "Valerio dal team di Rivolio <team@send.rivolio.it>"`.
  Finché non è verificato, le email partono solo verso valerio@artecai.it.

### 7. Sistema email: le quattro cose da controllare su Netlify/Supabase
Dal collaudo del 15/08. Il codice è a posto (ho aggiunto il ritentativo sugli
intoppi transitori). Queste quattro sono configurazioni tue, e sono l'unica
cosa fra un'email che parte e una che si perde:
1. **`RESEND_API_KEY` e `RESEND_MITTENTE` su Netlify.** Senza la chiave non
   parte NIENTE (in silenzio). Senza il mittente sul dominio verificato, le
   email vanno solo a te. Sono la coppia più importante.
2. **`RESEND_RISPOSTA_A`** = l'indirizzo VERO che leggi tu (es. la tua Gmail).
   Le email dicono «rispondi qui»: senza questa riga, chi risponde scrive a
   una casella che non riceve e il messaggio torna indietro. È il tuo unico
   canale di assistenza: non lasciarlo scoperto.
3. **Il gancio email di Supabase.** Authentication → Hooks → «Send Email
   hook» → Enable, URI `https://rivolio.it/api/posta-auth`, e copia il
   segreto in **`RESEND_HOOK_SECRET`** su Netlify. Senza, le email di
   accesso (conferma, link magico, recupero password) le manda Supabase, che
   sul piano gratuito ne fa **2 all'ora** e in inglese: al lancio blocca il
   terzo che si registra. Con questo, tutte le email escono da Resend.
4. **Resend Pro prima del lancio** (già scritto sopra al punto 4): il gratis
   fa 100 email al giorno.

---

## DA FARE IO (prossimi passi)

- Per ora niente di aperto da parte mia: sciopero furbo, coda e recensioni
  sono fatti e provati. Il prossimo pezzo lo decidi tu.

## Fatto il 15/08 (giro #74)
- 🔴 **La pagina fantasma di ZZ777, chiusa** (dopo il volo cancellato la
  scena dell'analisi ripartiva per un attimo: ora una sola volta per pagina).
- 🟢 **Sciopero furbo** (C-28/20): sciopero della compagnia stessa = idoneo,
  controllori/handling/generale = incerto. Prudente, provato.
- 🟢 **La coda degli incerti**: il cron ricontrolla ogni giorno i check
  incerti con email e avvisa se diventano idonei (la promessa "ti avvisiamo
  noi" che prima era vuota).
- 🟢 **Sistema recensioni completo**: box su verdetto e pratica → analisi
  gratis (una per evento, blindata), moderazione in `/admin/recensioni`,
  nastro testimonial animato in landing che si aggiorna quando approvi.
- ✅ **Le tre migrazioni applicate sul database vero** (scala, coda,
  recensioni) col connettore, verificate.
- ✅ **Collaudo email**: sistema solido, aggiunto il ritentativo sugli
  intoppi transitori (prima un singolo intoppo perdeva le email a colpo
  solo). Le quattro cose tue sono al punto 7 qui sopra.
- ✅ **Archivio aeroporti confrontato**: 9.016 scali, tutti i grandi hub del
  mondo presenti, con coordinate/fuso/paese. È già OurAirports (come
  `airportsdata`), rinfrescato ogni lunedì, e la distanza è già great-circle
  (haversine), il metodo che il Regolamento richiede. **Niente da cambiare:
  gli strumenti open-source che hai trovato li facciamo già** (i pacchetti
  Python non si usano, siamo in TypeScript, ma la sostanza è la stessa).

## Fatto il 14-15/08 (giro #73)
- **Conto costi/profitto** nella pagina `/admin/economia` (tre scenari).
- **Audit di scalabilità** a cinque lanterne + primi fix: rete di sicurezza
  sugli errori (mai più un 500/404 nudo), indici del database (migrazione),
  idempotenza del pagamento a prova di corsa, una sola chiamata al fornitore
  per lo stesso volo, allarmi che non intasano il telefono.
- ✅ **I cinque fix delicati dell'audit, tutti fatti** (uno alla volta, ognuno
  provato): timeout di 4 secondi sulle query al database; freno d'emergenza
  sul fornitore (dopo 4 "troppe richieste" di fila si stacca per 3 secondi,
  niente più funzioni appese fino al 503); pulizia dei dati vecchi la domenica
  notte (registro oltre 12 mesi via, email delle verifiche oltre 24 mesi tolta,
  la riga resta anonima); allarme se manca la chiave AeroDataBox; e il recupero
  del benvenuto (il cron rimanda l'email col link d'ingresso a chi ha pagato e
  non l'ha ricevuta, con la precedenza sui solleciti).
- **AeroDataBox, le tue due domande:** il limite di 3 richieste/secondo è del
  piano Basic su RapidAPI, ma il vero tetto è mensile (Basic ~2.400
  chiamate/mese, troppo poche per un lancio); i piani più alti alzano il
  mensile, il "al secondo" cambia poco. E dai dati dell'API usiamo tutto quello
  che serve al verdetto: i campi che scartiamo (modello aereo, terminal, gate)
  non rafforzano il reclamo. **Controlla i numeri esatti sul cruscotto
  RapidAPI:** da qui il loro sito è bloccato.

---

## Fatto di recente (così non lo richiediamo)
- Collaudo del motore: 55 casi d'oro + 81 sui rami, zero falsi positivi.
- Seconda fonte AviationEdge collegata (spenta finché non metti la chiave),
  incrocio a prova di fuso orario.
- Meteo agganciato al VPS e provato dal vivo (19/08): auth Basic, partenza e
  arrivo, cache sul DB. Acceso su Netlify, vivo al prossimo deploy.
- Dominio: rivolio.it è l'indirizzo ufficiale ovunque, verificato sul sito
  vero.
- Suite prove: 1612 verdi, zero rosse.
