# ARRETRATI — cose chieste da Valerio

*Creato il 2026-08-06 dopo che Valerio ha fatto notare, giustamente, che
chiedeva cose che poi non venivano fatte e nessuno gliene rendeva conto.*

**Regola: si aggiorna a ogni sessione. Niente sparisce da qui senza essere
stato fatto o senza che Valerio dica di lasciar perdere.**

---

## 🔴 APERTI dal giro #40 (9/08)

| # | Cosa | Perché è qui |
|---|---|---|
| A | ~~Le pagine evento~~ | ✅ **CHIUSA il 9/08, giro #41.** Valerio ha capito la differenza col blog e ha detto di farle: online tutte e tre le famiglie (`/sciopero-aerei`, `/sciopero-aerei/<data>`, `/aeroporto/<sigla>`), in sitemap, col check dentro. |
| A0 | ✅ ~~**Polar ha rifiutato il caso d'uso**~~ | **CHIUSA il 22/08: si incassa con Stripe Managed Payments.** Polar aveva risposto "Use case not supported" (categoria reclami di viaggio, a restrizione). Invece di cercare un altro merchant of record dello stesso scaffale, si è passati a Stripe Managed Payments: anche lui MoR (niente partita IVA per incassare), ma aperto. Live in modalità test. |
| A1 | 🟡 **`EXPO_PUBLIC_CHECK_PREZZO_ATTIVO` va tenuta allineata a mano** | L'app ha il suo interruttore per i testi perché Expo non legge le variabili senza quel prefisso (stesso difetto della landing, giro #52). Due variabili che devono dire la stessa cosa sono due variabili che prima o poi non la dicono: se il muro è acceso sul sito e questa è spenta, l'app promette gratis e poi mostra il muro. ⚠️ Cambiarla non basta: l'app va **riesportata** (`npm run anteprima` dentro `mobile/`), perché quel testo si decide quando l'app viene costruita. Il giorno degli store, questa diventa una voce della lista di rilascio. |
| A3 | ✅ ~~**La cassa di prova aperta a tutti**~~ | **CHIUSA il 22/08: la cassa finta non esiste più.** Cancellati pagina, rotte e chiave (`/cassa-prova` risponde 404). Il muro del check porta ora a Stripe. Non c'è più una cassa finta da spegnere. |
| A4 | 🟡 **La ricevuta del check vive in UN browser solo** | È un cookie di 30 giorni: regge il ricaricamento, la chiusura del sito, lo spegnimento del telefono. **Non regge il cambio di dispositivo.** Chi paga dal telefono e poi apre il sito dal computer non ritrova la sua analisi. È il prezzo della scelta "zero frizione, niente account": legarla a un'email vorrebbe dire chiedere l'email prima di far provare, che è la frizione che il prodotto evita. Da riaprire quando ci sono clienti veri e si può misurare quanto capita: la via di mezzo è mandare un link di recupero SOLO a chi lascia l'email dopo aver pagato. |
| A10 | 🟡 **`text-errore` non è definito come token** | In `app/globals.css` il token `--color-errore` **non esiste**, quindi Tailwind non genera la classe `text-errore` e chi la usa scrive del colore del testo intorno. Trovato l'11/08 rifacendo il pannello: là è stato corretto. ⚠️ L'istanza dentro `CassaProva.tsx` è sparita col file (cassa di prova cancellata il 22/08). Se `text-errore` compare ancora da qualche parte, o si definisce il token in `globals.css` o si sostituisce dove capita. |
| A8 | ✅ ~~**Stripe Managed Payments: aperto per l'Italia?**~~ | **CHIUSA il 22/08: aperto e attivo.** L'account è configurato, il checkout è vivo in modalità test. Resta il passaggio da test a live (chiavi `sk_live_`) e un pagamento vero end-to-end. |
| A9 | ✅ ~~Lemon Squeezy, la quarta email~~ | **CHIUSA l'11/08: non si manda.** Stripe l'ha comprata e i clienti stanno migrando su Stripe Managed Payments; in più il loro elenco ci vieta due volte (*"legal / debt-relief / collections"* e *"services of any kind"*). Era la porta più stretta delle quattro, e sta anche chiudendo. |
| A7 | 🟡 **Il test dei due prezzi è spento, e va riacceso quando serve** | `TEST_DUE_PREZZI = false` in `lib/prezzi.ts` (11/08, scelta di Valerio): serviva a far diventare **statica** la landing, che è la leva più grossa sulla velocità. Il meccanismo è tutto lì e si riaccende con una parola. ⚠️ Con Stripe il prezzo della variante si costruisce nel codice (`price_data` inline), quindi non servono prodotti preconfigurati: basta riaccendere la logica della variante. E va rifatto il controllo sul cookie da sei mesi, che è la crepa trovata spegnendolo. |
| A5 | 🟡 **Il TIN aspetta due variabili di Telegram** | Il cruscotto (`/admin/cruscotto`) gira da subito e non chiede niente; le notifiche invece non partono finché su Netlify non ci sono `TELEGRAM_BOT_TOKEN` e `TELEGRAM_ADMIN_CHAT`. Non è un guasto e non rompe niente (`tin` risponde `false` e si va avanti), ma **fino ad allora un pagamento arrivato di notte non lo sa nessuno fino al mattino**. I tre minuti per farlo sono in `STATO.md`, voce 0-prima. |
| A6 | 🟡 **Il cruscotto conta le visite con un segno nel browser** | Una visita = una scheda aperta, segnata in `sessionStorage`. Chi naviga in incognito con l'archivio bloccato viene contato a ogni pagina, e chi torna il giorno dopo conta come persona nuova (è voluto: non teniamo niente che permetta di riconoscerlo). Vuol dire che **il numero delle visite è una misura di traffico, non di persone**, e va letto così quando si giudica un video. Se un giorno servisse la precisione vera servirebbe un identificativo persistente, cioè esattamente la cosa che la privacy promette di non fare. |
| A2 | **Il primo giro a mano dell'autopilot scioperi** | Il modulo che tiene viva la tabella è scritto e il suo filtro è coperto da prove, ma da qui il proxy non apre nessuna delle fonti: il primo scarico vero avviene su Netlify. Valerio apre una volta `/api/motore/scioperi?segreto=...` e guarda l'esito. Se si rompe, manda un'email da solo. |
| B | **Le copertine fotografiche del blog** | Le dieci copertine di oggi sono illustrazioni disegnate da noi: qui non si generano immagini (quota Gemini a zero) e non si scaricano (manca `UNSPLASH_ACCESS_KEY`, e l'uscita di rete è chiusa). I dieci prompt sono pronti in `COPERTINE.md`. Serve Valerio. |
| C | **Riverificare le fonti degli articoli dal PC di Valerio** | Il proxy di questo ambiente non apre nessuna delle pagine citate (ENAC, AGCM, Eurocontrol, condizioni delle compagnie, Corte di giustizia). Gli indirizzi sono reali e i numeri vengono dagli estratti dei motori di ricerca, ma su un blog che vende trasparenza vanno riletti sulla pagina, con la data di consultazione. |
| D | 🟡 **I dettagli della riforma europea del 261** | Il 10/08 le date e i voti sono stati verificati (Parlamento 7 luglio, 646 contro 12; Consiglio 13 luglio) e sono in `RIFORMA-2027.md` e nel pezzo `/tabellone/riforma-261-2027-cosa-cambia`. **Resta aperta la parte operativa**: i 9 mesi per chiedere, i 4 giorni per informare e i 30 giorni per rispondere vengono da comunicati e analisi, non dall'articolato in Gazzetta ufficiale. L'articolo lo dichiara al lettore. Quando la Gazzetta esce, quella pagina si rilegge riga per riga. |
| R | **Il codice via SMS (OTP con la SIM)** | Valerio lo vuole ("sarebbe bellissimo"). Richiede un fornitore SMS a pagamento collegato a Supabase (Twilio, MessageBird: si paga a messaggio più un numero mittente). È una SPESA: si decide insieme prima di attivare qualsiasi cosa. Il codice via email intanto è vivo e gratuito. Da controllare anche il template dell'email del codice su Supabase: esce in inglese finché non lo si traduce dal pannello. |
| Q | **La conciliazione ART va riletta sulla fonte** | Il quarto colpo (`lib/lettera/conciliazione.ts`) dice: gratis, entro un anno dal reclamo, dopo 30 giorni di silenzio o una risposta che non soddisfa. Viene dalle FAQ e dal vademecum ART, letti negli estratti dei motori di ricerca: da qui `autorita-trasporti.it` è bloccato dal proxy. Da riaprire dal PC prima del primo cliente pagante, insieme alla pagina ConciliaWeb e al centro assistenza Ryanair che la documenta. |
| E | **Le percentuali dei portali concorrenti** | Nessun listino di AirHelp, Flightright o Skycop è stato riaperto oggi, quindi negli articoli non compare nessuna loro percentuale. L'unico dato pubblicato è quello che Ryanair scrive sul proprio sito. Per usarne altri servono le pagine tariffe ufficiali, con data e schermata. |
| F | ~~La Svizzera e i grandi vettori extra UE fuori tabella~~ | 🟡 **META' CHIUSA il 9/08, giro #44.** I grandi vettori extra UE sono in tabella (`lib/regole/vettori.ts`, 55 compagnie con nome e paese): New York → Roma con Delta adesso esce con un no pulito. **La Svizzera resta incerta di proposito** e serve Valerio: la fonte va aperta dal suo PC (vedi G). |
| G | ~~La Svizzera: serve una fonte verificata~~ | ✅ **CHIUSA il 10/08, giro #47.** Due fonti indipendenti (Accordo bilaterale con Decisione 1/2006, e la FAQ ENAC). Zurigo → Roma adesso è coperto; le tratte fra Svizzera e paesi terzi restano incerte, e non per prudenza nostra: è il limite vero dell'Accordo. |
| P | ~~I nove enti nazionali che mancano~~ | ✅ **CHIUSA il 10/08.** Valerio ha aperto il PDF ufficiale (13 luglio 2026) e me ne ha passato il testo: otto paesi aggiunti, più la Svizzera. Il Liechtenstein resta fuori perché nel PDF non c'è. E il PDF ha fatto emergere **tre errori veri** nella tabella di prima: Ungheria, Finlandia e Norvegia mandavano il passeggero a un ufficio che i casi individuali non li tratta. |
| H | **Il primo giro a mano dell'autopilot aeroporti** | ⚠️ **Bloccato da L**: finché il ramo non è unito a `main`, il lavoro non compare in Actions e non parte, perché GitHub legge i lavori programmati solo dal ramo predefinito. Dopo l'unione: scheda **Actions** → "Aeroporti sempre aggiornati" → **Run workflow**. Da qui OurAirports non si apre (403 dal proxy), quindi il primo scarico vero lo fa GitHub. Se il file arriva rotto, il lavoro fallisce e non committa niente. |
| I | ~~Le migrazioni Supabase~~ | ✅ **CHIUSA il 10/08.** Valerio ha eseguito `supabase/DA-APPLICARE.sql` sul database vero: doppio opt-in, voli cancellati, negato imbarco, paese degli scali e compagnia dichiarata sono tutti attivi. Il file resta nel repo e si può rilanciare. |
| L | ~~Il ramo di lavoro non è mai stato unito a `main`~~ | ✅ **CHIUSA il 10/08.** 79 commit uniti, zero conflitti. Da qui si lavora su `main` e basta. |
| M | 🔴 **Le sentenze citate nelle repliche vanno rilette sulla fonte** | Le otto repliche del dopo-lettera (`lib/pratiche/rifiuto.ts`) citano Wallentin-Hermann (C-549/07), van der Lans (C-257/14), Airhelp contro SAS (C-28/20) e Sturgeon (C-402/07 e C-432/07). Da qui EUR-Lex non si apre: i riferimenti vengono dalla conoscenza consolidata, non da una pagina letta oggi. **Blocca la vendita, non è una rifinitura**: un numero di causa sbagliato in una lettera che il cliente manda alla compagnia lo fa sembrare sprovveduto. Da riaprire su eur-lex.europa.eu prima del primo pagante. |
| O | **Le catture a pagina intera mentono** | Con `fullPage: true` le sezioni animate escono bianche e il verdetto sembra senza bottone d'acquisto. Non è il sito: è Playwright che ridimensiona la finestra e le animazioni non si riattivano. Il giro visivo va fatto **scorrendo e scattando schermata per schermata**, come nel giro #46. |
| N | **Le cifre del giudice di pace** | `/giudice-di-pace` di proposito NON scrive nessun importo: contributo unificato e spese di notifica cambiano nel tempo, e una cifra sbagliata in una pagina che parla di soldi è peggio di nessuna cifra. Se un giorno le vuoi in pagina, vanno lette sul sito del tribunale e datate. |

---

## ✅ CHIUSI il 06/08

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 1 | **Landing "da urlo, cinematica bella"** | Motion 13. Ingressi allo scroll, sfalsamento fra le card, sollevamento al passaggio del mouse, contatori che salgono. |
| 2 | **AI Vacation Builder** | `lib/costruttore.ts` + `/api/costruttore` + sezione «Dove arrivi con quello che hai» sulla landing. Dai partenza, budget, notti, persone e voglia, ti dà 3 posti veri con distanza, ore, costo auto calcolato e quanto ti resta per dormire. **16 prove.** |
| 3 | **"Voglio esplodere sui social"** | `CONTENUTI.md`: formato video ripetibile, 12 aperture, 3 script pronti, ritmo, canali, cosa non fare, come si misura. |
| 4 | **Skill `webapp-testing`** | `.claude/skills/prova-browser/SKILL.md`: guida Playwright, legge console e DOM, cattura e **guarda** le schermate, con la tabella delle trappole già pagate su questo progetto. |
| 5 | **Esplorare il codice di Zentivo** | Fatto, e ha cambiato la strategia. Vedi sotto. |
| 6 | **Copy professionale** | Tolti tutti i trattini lunghi dal testo visibile. Riscritte le sezioni dal tono da confessione. |
| 7 | **Tenerti aggiornato** | `PIANO.md`: mappa in tre pezzi, percentuali, cosa blocca cosa. |
| 8 | **Telefono rotto** | Nav compatta sotto i 420px, titolo che rientra, `overflow-x` bloccato. Catture automatiche anche su telefono. |
| 9 | **Sfondo brutto** | Erano macchie bianche sparse a caso. Ora: un alone verde unico centrato sul titolo più una trama a puntini. |
| 10 | **Animazioni tipo ScrollRevealText e Typewriter** | `TestoRivelato.tsx` (testo che si accende parola per parola con lo scroll) e `Macchina.tsx` (macchina da scrivere), ricavati dai due moduli Framer che avevi linkato. |

### Cosa ha rivelato il bundle di Zentivo
**Zentivo non fa lo sfondo in CSS: usa fotografie**, alcune da 4923×4778 pixel
(cielo, mano che regge il telefono, card). Per questo sembrava «di un altro
livello»: è artwork professionale, non codice. Imitarlo con i gradienti è una
gara persa. La strada giusta è un design pulito e preciso che sta in piedi da
solo. **Se un giorno vuoi quel look, serve un grafico o delle immagini vere,
non altro codice.**

---

---

## ✅ CHIUSI il 06/08 — secondo giro

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 11 | **Login** | Email+password, link magico, conferma via email. `proxy.ts` chiude `/app`. Messaggi di errore tradotti in italiano. **16 prove.** |
| 12 | **La pagina app** | `/app`: imposti partenza, budget, ore, notti, persone, voglia. Ogni ricerca mostra dove arrivi oggi con quel budget. Pausa, riaccendi, cancella. |
| 13 | **"Non vedo UI e UX"** | Le pagine esistono e si guardano: `/entra` fotografata, `/app` appena crei `.env.local`. |
| 14 | **Tech stack avanzato, shadcn** | shadcn/ui montato a mano (Button, Input, Label, Card) sui nostri colori, Radix sotto, Motion 13 sopra, lucide per le icone. Niente `init`: avrebbe riscritto `globals.css`. |
| 15 | **Il piano completo in tre fasi** | `PIANO.md` riscritto: COSTRUISCI · DISTRIBUISCI · MANTIENI, con le percentuali vere. |
| 16 | **Marketing e distribuzione** | `DISTRIBUZIONE.md`: imbuto TOFU/MOFU/BOFU, personaggio AI, blog quotidiano, community, creator, calendario, cosa faccio io e cosa serve da te. |
| 17 | **Iscritti su file** | Spostati su Supabase. In produzione senza chiavi si alza un errore invece di perderli in silenzio. |

---

## ✅ CHIUSI il 07/08 — terzo giro

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 18 | **Auth rotta ("link scaduto")** | Erano il rimbalzo di Supabase senza token + la lista redirect vuota. Sistemati entrambi, autoconferma accesa: registrazione immediata, provata dal vivo. |
| 19 | **Email su Resend, non Supabase** | 8 email (benvenuto, conferma, link, ricerca, destinazione, crediti, ricevuta) + gancio Send Email. |
| 20 | **Vocabolario italiano** | "alert" → **destinazione**, in 20 file: landing, app, email, prove. |
| 21 | **Bottoni rettangolari + vetro** | Raggio 9px ovunque, vetro sui secondari, riflesso al passaggio. |
| 22 | **Badge App Store / Google Play** | Nel footer, disegnati a mano, inerti con "Presto su" (un badge cliccabile verso il nulla è pratica ingannevole). |
| 23 | **Corsivo + luce in tutte le sezioni** | 12 titoli col serif corsivo e ombre a due aloni. |
| 24 | **Sfondo hero vivo** | Colonne a fisarmonica più ampie + faro di luce che le attraversa. Parallasse sulla foto di Manarola. |
| 25 | **Google sign-in** | Bottone con la G ufficiale, flusso già collegato a /auth/conferma. Si accende con Client ID + Secret. |
| 26 | **Il motore (blocco B)** | Raccolta Exa → anagrafe `strutture` → pannello `/admin` → abbinamento → **prima destinazione partita davvero** (Rimini, 147€, credito 3→2, rimborso provato sul fallimento). |

## ✅ CHIUSI il 07/08 — quarto giro: controllo completo della repo (chiesto da Valerio)

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 27 | **"Controlla che tutto sia a posto"** | Repo letta per intero (documenti, codice, prove). `npm run verify`: build, tipi e lint passano; prove 106/108 nella sandbox remota. Le 2 fallite sono la stessa prova (iscrizione con email valida) e falliscono solo perché la rete della sandbox blocca Supabase con un 403: sul tuo PC passano tutte e 108. |
| 28 | Errori trovati dal controllo, corretti subito | **Data dell'esempio sulla landing**: diceva "ven 9 ago", ma il 9/8/2026 è domenica. Ora: ven 14 · dom 16 ago (calendario verificato). **Trattino lungo** tolto dai due testi visibili che lo avevano (versione testo dell'email destinazione, data dell'esempio). **`.env.example` completato**: mancavano EXA_API_KEY, MOTORE_SEGRETO e RESEND_HOOK_SECRET, e il commento mandava nella trappola di `.env.local` in UTF-16. |

## ✅ CHIUSI il 07/08 — quinto giro: il pivot mobile (pomeriggio)

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 29 | **"Togli dalla landing ogni collegamento con l'app"** | Via "Entra" e ogni CTA verso `/entra` e `/app` da 11 componenti. Tutto porta alla lista d'attesa, la FAQ e i canali raccontano l'app in arrivo sugli store. Prova nuova: zero `href` verso l'app web in pagina. |
| 30 | **"Che framework suggerisci? Fai ricerche online"** | Tre esperti con fonti: **Expo SDK 57** (riusa TypeScript e Supabase, EAS compila iOS senza Mac). Vincoli store verificati e scritti in `DECISIONI.md`. |
| 31 | **"Costruisci un team di agenti e fammi l'app"** | 8 agenti coordinati (backend, UI, copy, AI, 3 frontend, QA): app in `mobile/` con onboarding in 6 passi, tab Destinazioni/Ricerche/Profilo, dettaglio col conto aperto, punteggio preferenze. Esito verificato due volte: tsc 0 errori, lint pulito, **29 prove su 29**. |
| 32 | **"Usa Composio"** | Usato per operare sul tuo Supabase vero (la sandbox non lo raggiunge): schema di `profili` verificato colonna per colonna e **migrazione `expo_push_token` applicata e riverificata** in produzione. |

## ✅ CHIUSI il 07-08/08 — sesto giro: il pivot Rivolio

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 33 | **"Elimina ogni traccia del vecchio nome, rinomina tutto in Rivolio"** | Repo GitHub rinominata in `rivolio` (remote ripuntato, push provato), progetto Supabase rinominato, bundle `it.rivolio.app`, codice e documenti ripuliti. Via Composio, senza rifare nulla da zero. |
| 34 | **"Esplora il documento e costruisci il prodotto"** | Documento (1432 righe) letto per intero, `SPEC.md` riscritto come bibbia. Costruito tutto: motore EU261 deterministico (`lib/regole/eu261.ts`, 3 stati, l'AI non decide mai), golden set 25 casi + eval bloccante falsi positivi 0, strato voli (AeroDataBox + AviationStack + demo marcata), check gratuito senza login, reveal, Polar (webhook firmato, provato 10/10), lettera coi canali verificati di 10 compagnie, follow-up T+0/2/15/30/60, tracker, `/admin` in shadow mode. Schema (voli, verifiche, pratiche, eventi) applicato sul Supabase vero. |
| 35 | **"Web app Next + app mobile Expo"** | Web completa (16 pagine). Mobile: pivot minimo a tab Pratiche/Profilo; il tracker completo arriva dopo che il web incassa (il documento è chiaro: l'app non è la porta d'ingresso). |
| 36 | **"Netlify col connettore collegato a te"** | Progetto `rivolio` creato via connettore, 5 variabili impostate, `rivoglio.netlify.app` riservato. |
| 37 | **"/impeccable, poi /taste-skill, poi /seo, prima del deploy"** | Fatti in quest'ordine. Impeccable: schermate desktop/mobile/reveal verificate, detector a 0. Taste: trattini lunghi 0, occhielli 7→4, CTA coerenti. SEO: robots, sitemap, JSON-LD, llms.txt, canonical, metadata Rivolio (tutti provati con 200 sul server di sviluppo). |
| 38 | **"Installa le skill di Emil Kowalski"** | 9 skill ufficiali in `.claude/skills/` (animate, apple-design, prototype, review-animations e le altre). |
| 39 | **"Le 3 fasi: SVILUPPO, DISTRIBUZIONE, MIGLIORAMENTO"** | `PIANO.md` riscritto con le tre fasi come le hai definite + artefatto visivo della fase SVILUPPO consegnato. |
| 40 | **"UI come le 4 foto di riferimento"** | Direzione registrata in `BRAND.md` (luce e aria, vetro smerigliato, card pulite, stepper): cielo sull'hero, form col bordo che pulsa, reveal col contatore, schermate di conferma consegnate. |

## ✅ CHIUSI l'8/08 — settimo giro: logo definitivo e rifiniture dal vivo

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 41 | **"Logo nuovo definitivo, posizionalo benissimo e migliora la qualità"** | Sfondo tolto col riempimento dai bordi, solo la lente estratta come componente connesso, upscalata a 1024px e affilata. Montata in nav, footer e card di condivisione via `components/Logo.tsx`; scritta accanto in due toni (Rivo scuro, lio verde) come nel lockup. Icone rifatte: `app/icon.png` 512, `apple-icon.png` 180, favicon.ico, manifest e JSON-LD aggiornati. Vecchio segno (sole e strada) eliminato. |
| 42 | **"Nel footer l'immagine del telefono come il riferimento, senza sfondo"** | La tua foto ripulita (sfondo a righe tolto, tenuto solo il componente mano+telefono, 878x1257) in una card bianca sul footer scuro: titolo, testo, bottone verde e il telefono che entra dal bordo basso. Come la quarta immagine, coi nostri colori. |
| 43 | **"La scritta Rivolio in basso più grande e occupante"** | Maiuscola come nel lockup, fino a 15rem, taglio sul bordo basso, sfumatura menta. Occupa tutta la larghezza. |
| 44 | **"FAQ: testo in disparte, centralo"** | Titolo centrato sopra le domande, lista in colonna da 760px. Prima era una griglia con la colonna laterale. |
| 45 | **"Newsletter schiacciata piccolissima"** | Trovata la causa vera: `flex-1` sul campo email dentro un contenitore in colonna (sul telefono governa l'altezza, non la larghezza): campo a 27px contro i 52 del bottone. Ora `sm:flex-1`: 52px misurati, prova visiva fatta. |

## ✅ CHIUSI l'8/08 — ottavo giro: la squadra del design

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 46 | **"Installa questi MCP"** | `.mcp.json` nel repo (vale per ogni sessione futura, anche sul tuo PC): playwright (gli occhi), context7 (documentazione vera di GSAP/Motion/Lenis), shadcn (componenti veri), figma (serve FIGMA_API_KEY), blender (gira solo dove c'è Blender aperto + uv, non nella sandbox). |
| 47 | **"Installa la skill art-director"** | `.claude/skills/art-director/SKILL.md`, identica al tuo file, più il subagente `art-director` in `.claude/agents/` che la segue fase per fase. |
| 48 | **"Scrivi gen-asset.ts"** | `scripts/gen-asset.ts` + `npm run asset`: Gemini per le scene, Unsplash per le foto (col credito), WebP sotto 1MB in `/public/assets/`. Servono GEMINI_API_KEY e UNSPLASH_ACCESS_KEY. |
| 49 | **"Salva le regole d'oro"** | In CLAUDE.md: realismo = asset, orchestrazione = codice; le hero belle sono immagini; una sezione per volta; loop visivo con gli occhi; vietati i pattern slop. |

## ✅ CHIUSI l'8/08 — nono giro: chiavi, web app aperta, anteprima mobile

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 50 | **Chiavi Gemini e Figma** | Salvate in `.env.development.local` (non tracciato). Provata la filiera Gemini dal vivo: la rete passa e la chiave è valida, ma il modello immagini ha **quota 0 sul piano gratuito**: per generare asset va attivata la fatturazione su Google AI Studio. Figma pronta per l'MCP (variabile FIGMA_API_KEY). |
| 51 | **"Rimetti la web app accessibile e togli il redirect"** | Decisione ribaltata e registrata in DECISIONI: `/app` aperta a TUTTI senza account, col check libero e illimitato (componente nuovo `CheckRapido`); l'elenco pratiche appare solo da collegati; `/admin` resta chiuso. Link "Entra" in nav e "La web app" nel footer. Prove aggiornate: 20/20. |
| 52 | **"Voglio vedere la app mobile da iPhone"** | Anteprima web dell'app Expo esportata e fotografata (funziona). Scoperta onesta: **l'onboarding mobile è ancora al prodotto viaggi** ("La tua fuga, al prezzo giusto"): il pivot mobile era solo le tab. E da maggio 2026 l'Expo Go dell'App Store è fermo all'SDK 54 (noi siamo su 57): su iPhone la via nativa è TestFlight con l'account Apple Developer, oppure l'anteprima web. |

## ✅ CHIUSI l'8/08 — decimo giro: il giro di design (Zentivo, pricing, scanner)

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 53 | **"Crawla Zentivo e spiegami le nuvole"** | Smontato dal workbench: le nuvole sono una striscia FOTOGRAFICA da 4320px dentro un Ticker di Framer (scorrimento orizzontale infinito) sopra un cielo fotografico da 4800x3928 e un velo sfumato. Asset + una sola animazione. Tu hai deciso: niente cielo, non ci rappresenta. |
| 54 | **"Anima lo sfondo: colonne geometriche a onda calma"** | Rifatte: spigoli definiti, filo di bordo chiaro, zigzag di tono fra pari e dispari, UN'onda sola che viaggia da sinistra a destra (fase per indice, durata unica 8,4s). Via i respiri casuali. |
| 55 | **"Pricing esattamente come la reference"** | L'agente art-director l'ha replicata coi nostri colori: occhiello a pillola, card bianche, la centrale (Una pratica 14,90) sollevata con nastro verde "La più scelta", spunte, bottoni pieni a tutta larghezza. Niente toggle (deciso da te). Il confronto col 35% è sotto, come striscia. |
| 56 | **"Scanner cinematico nel check"** | Il teatro ora è una scansione: carta d'imbarco coi dati VERI inseriti, raggio verde che la percorre, righe che si accendono a ogni passo completato. I passi restano agganciati allo stato vero della richiesta. |
| 57 | **"Ogni bottone animato e funzionante"** | Pressione fisica globale al click (scale 0.965) su tutti i bottoni del sito; "Entra" in nav ora è pillola di vetro; il sistema variants (pieno/scuro/vetro/contorno) c'era già e resta. "Esci" e i checkout NON erano rotti in codice: sul tuo rivolioo statico le azioni server non esistono, sul progetto giusto funzionano. |
| 58 | **"Testi grigi piccoli illeggibili"** | Alzati misura e contrasto dei peggiori: etichette e note del check (13→14,5px, da fumo-2 a fumo/inchiostro), crediti e disclaimer del footer (bianco dal 40-45% al 55-65%). |

## ✅ CHIUSI l'8/08 — undicesimo giro: micro-animazioni alla Emil

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 59 | **Scanner anche sulla pagina del verdetto** | Arrivando con un link diretto la pagina si apre con la carta del volo scansionata dal raggio (1,3s), poi il reveal. Chi arriva dal check NON lo rivede (flag in sessione: due teatri di fila sono una presa in giro). Con reduced-motion si salta. |
| 60 | **Giro Emil Kowalski di micro-animazioni** | Curve condivise registrate (--curva-fuori, --curva-dentro-fuori, dalle tabelle della skill animate). FAQ: la risposta entra scivolando (0,25s) e l'altezza si anima dove il browser lo sa fare. Card pratiche: ingresso in fila a 50ms. Tutto transform e opacity, tutto con la variante reduced-motion. |

## ✅ CHIUSI l'8/08 — dodicesimo giro: le chiavi vere e il giro dell'onestà

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 61 | **Chiavi Mistral e AeroDataBox** | Salvate in `.env.development.local`. Scoperta di riflesso: con la chiave vera nel file, le PROVE andavano sull'API reale (bloccata in sandbox) e diventavano rosse. Doppio fix: i voli ZZ* vanno SEMPRE al fornitore demo (anche in produzione: ZZ non è un codice IATA e brucerebbe unità), e il server delle prove azzera le chiavi apposta (playwright.config). |
| 62 | **La prova delle 2 ore, fatta con la TUA chiave** | Dentro i 365 giorni il dato regge: a 6 e a 11 mesi status Arrived, quality Live, revisedTime e perfino runwayTime. OLTRE i 365 giorni il piano BASIC rifiuta la richiesta. Documentato anche il rinominare del 2023: actualTime NON esiste più, si chiama revisedTime; runwayTime è le ruote a terra. |
| 63 | **"Riscrivo su 12 mesi" (tua scelta dal popup)** | Headline "Hai preso un volo nell'ultimo anno?", note, sezione retroattiva, FAQ, llms.txt e immagine social riscritte: cosa VERIFICHIAMO (12 mesi) separato da quanto DURA il diritto (2 anni ITA, stima 5-6 esteri, che restano scritti perché veri per legge). |
| 64 | **Campo data spappolato (1A)** | `block` + `appearance-none` + larghezza piena: Safari iOS ignorava la larghezza dei campi data. Provato a 390px. |
| 65 | **Cartolina storta (1B)** | In locale era già a filo (misurato: fondo immagine = fondo card al pixel); blindata comunque: testo centrato sul telefono, immagine senza padding, 2px di sanguinamento sotto il bordo, sizes espliciti. Il difetto che vedi online è del deploy vecchio. |
| 66 | **Email di supporto** | valerio@artecai.it nel footer (mailto), come da tua scelta. Si cambia con una riga quando c'è il dominio. |
| 67 | **Newsletter "pareva non funzionare"** | Il salvataggio usa la chiave pubblica: l'iscrizione quasi certamente È salvata. A mancare è l'email di conferma: serve RESEND_API_KEY su Netlify, e finché il dominio non è verificato Resend spedisce solo a valerio@artecai.it. Intanto l'email di benvenuto è stata riscritta: era rimasta al prodotto viaggi ("fughe sotto soglia"), ora racconta l'Osservatorio. |

## ✅ CHIUSI l'8/08 notte — tredicesimo giro: recesso, campi veri, audit

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 68 | **#21 Rinuncia al recesso** ("te ne ho parlato e non la vedo", il buco più costoso) | Spunta esplicita con testo versionato (art. 59 Cod. Consumo, `lib/pratiche/recesso.ts`) prima dei bottoni Polar; consenso registrato lato server in `verifiche` (quando + testo esatto); la rotta di checkout respinge chi non ha firmato, anche con l'URL diretto; il webhook copia la firma nella cronologia della pratica e segnala l'anomalia se manca. Migrazione applicata e verificata sul Supabase vero. |
| 69 | **Punto 3: "due fonti indipendenti" promesse senza averle** | Le 4 frasi in vetrina (come funziona, card del dato, pricing, FAQ) ora dicono "tracciamento reale del volo": vero da oggi anche nel motore. Superato più tardi la stessa notte: la seconda fonte sono i documenti (riga 72). |
| 70 | **#26 Motore sui campi veri** | Regola "senza Live niente vendita": quality senza "Live" sull'arrivo = NESSUN verdetto (nemmeno il no: 179 minuti stimati possono essere 185 veri). Codeshare non risolto sopra soglia = incerto (la lettera deve andare al vettore operativo). runwayTime/revisedTime già a posto. Golden set 25→30 casi, dentro il tuo FR4001 del 6/08 (155 min, non idoneo per 25 minuti). Versione regole 2026.08.2. Eval 33/33, falsi positivi 0. |
| 71 | **"Leggi tutti i miei prompt, dimmi cosa è stato ignorato, mega to do list"** | Transcript completo riletto (34 messaggi, 17 prompt veri), audit consegnato in chat prompt per prompt, arretrati aggiornati qui sotto. |

## ✅ CHIUSI l'8/08 notte fonda — quattordicesimo giro: la seconda fonte vera e i 7 pezzi (#27)

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 72 | **#22 La seconda fonte, dopo la scoperta che AviationStack free è finta** (solo tempo reale, licenza personale) | La seconda fonte sono i DOCUMENTI dell'utente, come hai deciso tu: dentro la pratica, dopo il pagamento, carichi carta d'imbarco o email della compagnia (`components/pratica/CaricaDocumento.tsx`). Mistral OCR fa UNA cosa (immagine → testo), l'estrazione dei campi è a regex, il confronto è deterministico: concorde = evento in cronologia, discorde = conferma umana, MAI un verdetto cambiato dal codice. Il file NON si salva. La landing dice la tua frase: "Incrociamo i dati ufficiali del volo con i tuoi documenti. Se non concordano, il caso è incerto e non paghi." |
| 73 | **#27 OpenFlights come riserva distanze** | `lib/dati/aeroporti.json`: 6.072 aeroporti IATA (coordinate, città, fuso) congelati nel repo, `lib/voli/distanza.ts` con haversine. Se AeroDataBox non manda la distanza, la calcoliamo noi; se manca pure l'aeroporto, il campo resta nullo e il motore fa la sua parte (mai inventare). |
| 74 | **#27 Scioperi (cgsse/MIT/ENAC), regola v1** | Tabella `scioperi` creata e POPOLATA sul Supabase vero (migrazione `20260809_scioperi`, 10 scioperi giugno-settembre 2026, controprova con SELECT: 10 righe). Fonti: ENAC (21/07 ufficiale) + testate che riportano i calendari MIT/CGS, perché i siti ufficiali dalla sandbox sono bloccati: da riverificare dal tuo PC. Regola nel motore (2026.08.3): sciopero noto + ritardo sopra soglia = INCERTO; sotto soglia il no resta un no. Esclusi apposta: DAT 21/07 (revocato) ed elicotteri Avincis 4/08 (non voli di linea). |
| 75 | **#27 DB indirizzi reclamo, "fallo per terzo"** | `lib/lettera/compagnie.ts` da 10 a 20 compagnie con lo schema che hai dettato: entità legale, paese, ICAO, canale ufficiale, indirizzo postale, PEC (solo dal registro imprese), NEB con riferimento ENAC, accettaIntermediari, fonti citate riga per riga. Ricerca di 4 agenti in parallelo, tutte le 20 con URL sul dominio ufficiale. Il dato strategico c'è: Ryanair, easyJet, Wizz, Volotea e Norwegian scrivono nelle condizioni che lavorano SOLO il reclamo del passeggero: il nostro modello con loro è l'unico. Iberia e Transavia senza chiavi di nome (le sorelle Iberia Express e Transavia France sono società diverse: meglio nessun destinatario che quello sbagliato). |
| 76 | ✅ **#27 Open-Meteo nel reclamo — FATTO il 19/08 con l'istanza self-hosted** | Niente più piano Professional da ~99 USD/mese: gira l'istanza dedicata sul VPS (`meteo.artecai.cloud`, auth Basic, password solo in env). Il modulo (`lib/meteo/openmeteo.ts`) guarda partenza E arrivo, usa raffiche/neve/nubi basse dallo storico e il codice meteo dalle previsioni per i voli degli ultimi 5 giorni, con cache su `meteo_cache` (sul DB vero). `OPENMETEO_URL` e `METEO_API_PASSWORD` già su Netlify: acceso al prossimo deploy. Provato dal vivo contro il server: 200, dati veri, tutte le variabili presenti. |
| 77 | **#27 Codeshare: vendi solo IsOperator** | Il fornitore marca `vettoreDaDeterminare` per ogni volo con codeshareStatus diverso da IsOperator: sopra soglia il motore dice incerto e la lettera non parte verso il vettore sbagliato. Il confronto scioperi usa il codice IATA del volo, non il nome del vettore. |

## ✅ CHIUSI l'8/08 all'alba — quindicesimo giro: il motore online e i dati veri

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 78 | **"Ho provato FR4001 e non funziona, cazzo, mica il motore andava?"** | Il motore andava benissimo: su Netlify mancava AERODATABOX_API_KEY (avevi messo Supabase, Resend e Mistral, non quella) e il sito girava col fornitore demo. Messa via connettore (attenzione: il flag "secret" del connettore fallisce in silenzio), rideploy, controprova sul sito VERO: FR4001 del 6/08 → non idoneo, 155 minuti, orari veri, demo:false. Collaudo end-to-end fatto. |
| 79 | **#25 Osservatorio coi dati veri** | Tabella `osservatorio_ritardi` sul Supabase vero, indice ritardi AeroDataBox per gli 8 aeroporti che hai scelto col popup, cache 24 ore, striscia nella sezione scura. Prima rilevazione vera già seminata. Fonte e scala (0-5, ultime 2 ore) dichiarate sotto i numeri. |
| 80 | **Il giro estetico: foto storta, sezioni lontane, bullet a piramide, hero col glow, scanner più realistico, titoli più grandi** | Foto footer analizzata pixel per pixel: il telefono era GIÀ dritto (bordo cornice a ±2px), il difetto era il polso tagliato dal bordo sinistro; ritagliata al polso e centrata sull'asse del telefono. Sezioni ravvicinate e titoli +7%. Punti fiducia in striscia allineata. Bottone retroattivo e sezione dato oggettivo centrati su telefono. Hero: il corsivo era SPARITO (aggancio rotto dal cambio headline), rimesso con lo stile e il glow dell'Osservatorio su fondo chiaro. Scanner rifatto come carta d'imbarco vera (fascia scura, campi in lettura, barcode, timbro CE 261/2004, raggio luminoso), condiviso fra hero e verdetto. |
| 81 | **"Controlla che tutto il sistema email funzioni end-to-end"** | Iscrizione all'Osservatorio provata sul sito vero con valerio@artecai.it: salvataggio ok e benvenuto spedito via Resend (controlla la casella). Il resto della sequenza (T+0/2/15/30/60) parte solo con una pratica pagata: si collauda quando Polar esiste. |

## ✅ CHIUSI l'8/08 mattina — sedicesimo giro: deploy automatico, legali, onda

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 82 | **"Il deploy ha fallito, analizza e fixa"** | Hai collegato il repo GitHub a Netlify (bene: era la strada giusta) e il build moriva su "@netlify/plugin-nextjs is missing a manifest.yml": nei build da repo il plugin dichiarato in netlify.toml va installato nel progetto, nei deploy via zip lo forniva Netlify. Aggiunto come devDependency, push, build verde: il sito vero ora serve il giro design. Da adesso ogni push = deploy automatico. |
| 83 | **I due 404 su /condizioni e /privacy + "scrivi privacy, termini e cookie professionali"** | Tre pagine vere, in italiano comprensibile, con ricerca fatta (art. 13 GDPR per l'informativa; linee guida Garante 10/06/2021 per i cookie: con SOLI tecnici niente banner, ed è il nostro caso). Dicono la verità del prodotto: check senza account, documenti OCR mai salvati, niente profilazione, rinuncia recesso art. 59, garanzia 90 giorni, foro del consumatore. Cookie linkata anche dal footer, tutte in sitemap. PRIMA BOZZA, come chiesto: revisione legale e dati societari del titolare restano da fare (riga sotto, "Tocca a Valerio"). |
| 84 | **"Il background della hero come nell'immagine: colonne animate una alla volta, onda da sinistra a destra in loop"** | SfondoColonne riscritto: 26 colonne con ALTEZZE diverse (profilo mosso come il riferimento) e un impulso che occupa il 13% del ciclo con fase crescente: in ogni istante brilla una colonna sola, l'accensione viaggia da sinistra a destra e ricomincia (8.3 secondi a giro). Base spenta e picco pieno perché l'onda si veda. Il faro è stato tolto: l'onda è la scena. |
| 85 | **Task di configurazione (doctor, ripgrep, MCP, audit, protocollo)** | Doctor eseguito e righe non verdi riportate in chat; rg di sistema presente e USE_BUILTIN_RIPGREP=0 + ENABLE_TOOL_SEARCH=auto:5 nell'rc (bash) del container cloud, con le righe pronte per il tuo PC; elenco MCP con stima tool e candidati da scollegare in chat; audit dei .md con file:riga e classificazione in chat; sezione "Protocollo operativo" scritta in CLAUDE.md identica alla tua dettatura (il diff era nel popup rimasto senza risposta: eseguita alla lettera, la deduplica col PROTOCOLLO CONTESTO resta a tua scelta). |
| 86 | **"Come vedo l'app mobile da PC come i veri developer?"** | Ricerca fatta: la strada giusta su Windows è Android Studio (gratuito) + emulatore; `npx expo start` installa da solo l'Expo Go giusto per l'SDK 57 nell'emulatore (il muro dell'App Store fermo all'SDK 54 vale solo per iPhone fisico). Passi dettagliati in chat. Tutto gratis. |

## ✅ CHIUSI l'8/08 pomeriggio — diciassettesimo giro: barre, regole, ambiente

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 87 | **"Le colonne troppo trasparenti, staccate e rotonde agli estremi"** | Attaccate (gap 0) e a tutta larghezza: a separarle è la tinta pari/dispari, non il vuoto. Quadrate ovunque: raggio 0 e colore che arriva fino al bordo basso, così il taglio si vede netto (prima sfumava a trasparente e sembrava arrotondato). Più visibili: base di luminosità da 0.30 a 0.55, picco pieno. La maschera del contenitore inizia a sfumare all'80%, non al 45%: gli estremi quadrati restano visibili. |
| 88 | **"Non ho capito come vedere l'app dal PC Windows"** | Scritta la guida `mobile/ANTEPRIMA-WINDOWS.md`: Strada A (`expo start --web`, 2 minuti, zero installazioni) e Strada B (Android Studio + emulatore, quella vera). Comandi copia-incolla uno alla volta, con la regola zero: nel terminale si incollano solo i riquadri di codice, non i titoli della guida (era quello l'errore in PowerShell). |
| 89 | **"Unifica le 4 regole duplicate"** | Fatto: checkpoint, task nuovo, degrado e HANDOFF stanno SOLO nel Protocollo operativo. Il PROTOCOLLO CONTESTO tiene le tre cose che non erano doppie: metodo batch, /compact vs /clear, un task = una unità committabile. |
| 90 | **"Ammorbidisci l'intervista di art-director"** | FASE 0 ora dice: salta le domande già risposte nel brief, chiedi solo ciò che manca, e se non manca niente vai avanti dichiarando cosa hai dedotto. Un brief esplicito e dettagliato vale come conferma per passare alla fase dopo. |
| 91 | **"Dove si configurano le variabili d'ambiente, mettile una volta sola"** | `.claude/settings.json` (tracciato) con USE_BUILTIN_RIPGREP=0 e ENABLE_TOOL_SEARCH=auto:5: valgono su ogni macchina che apre il repo, PC compreso, senza toccare più nessun file di shell. FIGMA_API_KEY è un segreto, quindi sta in `.claude/settings.local.json` che è in .gitignore (regola #5): sul tuo PC va ricreato, la riga è nel rapporto in chat. |

## ✅ CHIUSI l'8/08 sera — diciottesimo giro: l'app mobile diventa Rivolio

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 92 | **"Ho aperto l'app ed è ancora quella dei viaggi, fa schifo, non c'è traccia di Rivolio"** | Vero, ed era scritto in STATO ma andava fatto. Primo pezzo consegnato: la schermata di apertura ora è **il check del volo di Rivolio** (logo, occhiello, titolo col corsivo, campo volo e data con le barre automatiche, punti di fiducia) e il **verdetto** ha la sua schermata coi tre esiti, orari, ritardo e fascia. Il motore non è duplicato: l'app chiama la stessa API del sito. Provato end-to-end nell'anteprima (ZZ250 → 3h20 di ritardo → fascia 250€). **Restano viaggi**: tab, registrazione, destinazioni, ricerche. Prossimo pezzo. |
| 93 | **"Voglio vedere l'app come uno sviluppatore serio, col mockup del telefono"** | La cornice iPhone della tua immagine è il simulatore iOS, che su Windows non esiste (Apple lo dà solo su Mac). Le due strade vere: `F12` → `Ctrl+Shift+M` nel browser (misure del telefono in 2 secondi, è quello che usano gli sviluppatori web) oppure l'emulatore Android di Android Studio, che ha la cornice vera. Entrambe nella guida. |
| 94 | **Il check dell'app diceva "sei offline" pur avendo rete** | Trovato provando davvero: mancavano gli header CORS su `/api/verifica`, e il browser bloccava la risposta. Aggiunti (più la risposta al preflight OPTIONS). Verificato con preflight e POST: 204 e 200 con gli header giusti. |

## ✅ CHIUSI l'8/08 notte — diciannovesimo giro: le tab, il deep scan, il motore spiegato

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 95 | **"Procedi col prossimo pezzo: le tab e le pratiche"** | Fatto, e con la pulizia vera: tre tab (Controlla, Pratiche, Profilo), nessuna protetta, il check è la prima cosa che si vede e funziona senza account. Pratiche invita a entrare invece di sbattere un muro. Profilo riscritto (prima erano crediti e ore di auto del prodotto viaggi): chi sei, sito, supporto, privacy, condizioni. CANCELLATI onboarding viaggi, registrazione viaggi, destinazioni, ricerche e il motore punteggio: dell'app vecchia non resta niente. |
| 96 | **"Rendi lo scan più realistico, un deep scan da almeno 15 secondi"** | L'analisi ora dura ~16 secondi e racconta SEI passi veri (archivi di volo, orario certificato, distanza della tratta, scioperi del giorno, confronto orari, regolamento), ognuno col suo dettaglio sotto e una barra che si riempie a passo chiuso. La sequenza non si taglia mai, nemmeno se il server risponde subito: si va al verdetto quando sono finiti sia il lavoro sia il racconto. Se invece c'è un errore si torna subito al campo: far aspettare chi deve correggere sarebbe cattiveria. |
| 97 | **"Non ho capito come vedere l'app e il mockup del telefono"** | Guida riscritta con in cima il blocco "in due minuti": sei comandi copia-incolla, uno alla volta, coi percorsi veri. E la vista telefono: `F12` poi `Ctrl+Shift+M`. |
| 98 | **"Segnati che non sono tecnico e devi spiegare più facile"** | Scritto in CLAUDE.md, sezione "Come parlare a Valerio": zero gergo senza traduzione, comandi uno alla volta col percorso giusto (mai segnaposto), prima cosa succede e poi perché, e se una cosa su Windows non si può dirlo subito con l'alternativa. |
| 99 | **"Il motore dietro le quinte cosa fa? Usa tutte le API?"** | Spiegato in chat passo per passo con FR4001: il check usa AeroDataBox (dati del volo), la cache Supabase, la tabella scioperi e il motore di regole. NON usa Mistral (OCR: solo dopo il pagamento, dentro la pratica), NON usa Open-Meteo (spento, serve il piano a pagamento) e NON usa più AviationStack. |

## ✅ CHIUSI l'8/08 notte — ventesimo giro: i tuoi voli salvati

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 100 | **"L'app è ancora vecchia"** | Non lo era: le schermate viaggi erano già cancellate sul ramo (verificato su GitHub: nella cartella app restano solo tabs, layout, accesso, verdetto). Sul tuo PC c'era la copia vecchia: serviva `git pull` e il riavvio con `--clear`. Comandi in cima alla guida. |
| 101 | **Popup: le 4 scelte sull'app** | Tutte e tre le funzioni in ordine (notifiche voli, fotocamera, tracker) · pagamento SUL SITO, così Apple e Google non trattengono il 15-30% · voli aggiunti a mano, una volta sola · prima completa e bella, poi store. Segnate qui e in STATO. |
| 102 | **Primo pezzo: "I tuoi voli"** | Ogni volo controllato si salva sul telefono con l'esito che ha dato il motore (copiato, mai ricalcolato) e resta nella schermata Controlla, con la sua faccia: idoneo mostra la fascia, incerto dice che non si vende, non idoneo dice il ritardo. Bottone "Ricontrolla" su ognuno: serve per i voli appena partiti, che il giorno dopo hanno il dato. È la base delle notifiche, il pezzo successivo. |

## ✅ CHIUSI l'8/08 notte fonda — ventunesimo giro: i 6 pezzi del handoff #31

| # | Cosa avevi chiesto | Come è stato chiuso |
|---|---|---|
| 103 | **Scena di scansione nativa nell'app** (il check saltava dritto al verdetto) | `ScenaScan.tsx`: la stessa scena del sito in React Native. 6 passi da 2,4s mai tagliati, biglietto che si compila coi dati veri del server, luce dello scanner (3,4s + pausa), timbro CE a molla, barra e contatore. Scelta popup: identica al sito. Provata end-to-end su Expo web: ZZ250 → scena → verdetto da sola, zero errori. Su 390px la tratta ha una riga sua (le tre colonne del sito la troncavano). |
| 104 | **Sezione prezzi da rifare esteticamente** | Due carte d'imbarco affiancate (scelta popup): fascia scura col nome e il nastro "La più scelta", strappo coi fori, codice a barre, timbro Rivolio. Il check gratis è una striscia sopra le carte. Conti e confronto apribili restano (prova landing verde). |
| 105 | **Messaggi del motore per cancellato/dirottato** | Riscritti per l'utente: il cancellato dice che il preavviso lo sa solo lui e che rimborso/volo alternativo si chiedono comunque; il dirottato spiega l'atterraggio in un altro scalo e perché il dato non basta. Versione regole 2026.08.4, golden set verde. |
| 106 | **Pagina guida bagagli** (popup: guida sì, vendita no) | `/guida-bagagli`: PIR, termini 7/21 giorni, perso dopo 21, 2 anni, tetto 1.519 DSP (ICAO dal 28/12/2024) con conversione dichiarata stima, fonti in fondo, ponte al check. Footer (colonna Domande) + sitemap. |
| 107 | **Testi delle email brandizzate** | Scoperta: l'email di benvenuto alla registrazione era ANCORA quella dei crediti viaggi. Riscritta per Rivolio (check libero, pratiche, avvisi). Le T+0/2/15/30/60 rilette: già in stile casa. Il ramo email/alert viaggi resta da spegnere (voce qui sotto). |
| 108 | **QA da utente critico + verify** | Giro visivo con Chromium su app (welcome → check → scena → verdetto), prezzi 1440/390, guida 1440/390: zero errori console, zero scroll orizzontale. Fix piccoli subito (data ISO sul biglietto del sito → GG/MM/AAAA; griglia carta mobile). Il lint mobile era rosso dal giro precedente (ref Animated + require): sistemato con `useValoreAnimato` e import statici. Verify e prove nel commit di chiusura. |

## ⏳ ANCORA DA FARE

### LA MEGA TO DO (dall'audit dei prompt, 8/08 notte)

**Attività numerate restanti (dalla lista del 07/08 sera):**
- Nessuna: #22, #25 e #27 sono chiusi (righe 72-79). La lista numerata
  del 07/08 è finita.
- **Scioperi di ottobre**: a inizio settembre, finita la franchigia estiva,
  ricontrollare il cruscotto MIT e aggiungere le date nuove alla tabella.

**Prodotto (dal documento, rimandati di proposito):**
- **Spegnere il ramo email/alert del prodotto viaggi**: le email 5-8 di
  `lib/email/messaggi.ts` (ricerca attiva, destinazione, crediti, ricevuta)
  sono ancora testi viaggi e restano richiamabili da `creaRicerca`,
  `lib/alert/invia.ts` e dalle rotte `/api/motore/abbina|raccogli`, che
  però nessun flusso di Rivolio usa più. Scoperto l'8/08 notte
  ricontrollando i testi: l'unica che partiva DAVVERO (benvenuto, alla
  registrazione) è stata riscritta subito per Rivolio. Il resto si
  spegne in un giro suo, con calma: rimuovere chiamanti morti e funzioni.
- **Onboarding dell'app mobile ancora al prodotto viaggi**: va riscritto
  per Rivolio (check del volo, non micro-vacanze). Scoperto l'8/08 con
  l'anteprima web. Si fa insieme al tracker mobile completo.
- **Golden set da 30 a 100+ casi** man mano che passano voli veri (il
  documento chiede casi reali etichettati a mano; il primo, FR4001, è
  dentro dall'8/08).
- **Tracker mobile completo** (oggi tab minima): dopo i primi incassi web.
- **Contatore rate-limit condiviso**: oggi il tetto 20/min per IP vive in
  memoria del singolo processo; con più istanze serve Supabase o KV.
- **Verticali di contenuto** (rotte per compagnia/aeroporto) e Osservatorio
  come newsletter: fase DISTRIBUZIONE.
- **Bagagli (settembre) e treni (ottobre)**: espansioni previste dal
  documento, non si toccano ora.
- **Design "mozzafiato" al livello delle reference**: la strada è tracciata
  (art-director, gen-asset.ts, regole d'oro) ma è BLOCCATA dalle chiavi
  immagini: Gemini ha quota 0 senza fatturazione, Unsplash è in
  approvazione. Senza asset non si supera il livello attuale.

**Tocca a Valerio (in ordine di soldi):**
1. Deploy dell'ultimo giro (design + Osservatorio dati veri): pubblichi tu,
   tua scelta col popup. Il motore online funziona già.
2. ✅ Cassa Stripe: chiavi su Netlify, live in test. Resta un pagamento vero end-to-end e il passaggio da test a live.
3. ~~Chiavi su Netlify~~ FATTE (Supabase, Resend, Mistral, AeroDataBox e
   Stripe): tutte configurate.
4. Riverificare gli scioperi sul cruscotto MIT dal tuo PC (la sandbox non
   lo apre) · Open-Meteo Professional (~99 USD/mese) SOLO quando vorrai la
   riga meteo nel reclamo: fino ad allora resta spenta per scelta.
5. Fatturazione Gemini su Google AI Studio · UNSPLASH_ACCESS_KEY quando
   approvata · alla prossima fattura AeroDataBox chiedere la profondità
   storica dei piani a pagamento.
6. Dominio (slot Hostinger) e social @rivolio (li crei tu, tua scelta).
7. Legale: revisione avvocato delle 3 pagine bozza (privacy, condizioni,
   cookie) + cognome e dati societari del titolare da darmi per inserirli
   · commercialista sul regime fiscale.

### [SUPERATI dal pivot del 07/08 sera — idea viaggi chiusa da Valerio]
<details>
<summary>Arretrati dell'idea viaggi (congelati, non cancellati)</summary>
- **Il passo "avvisi" può essere scavalcato**: provato dal vivo nel browser,
  dopo la registrazione lo smistamento della radice porta subito alle tab
  prima che la schermata del permesso notifiche si veda. Da verificare su
  telefono e sistemare (vincolare lo smistamento mentre si è nel gruppo
  benvenuto, o chiedere il permesso dal feed).
- **Prova sul telefono vero** (Expo Go per il giro veloce, build di sviluppo
  per le notifiche): serve il telefono di Valerio.
- **Account store**: Apple Developer (99$/anno) e Play Console (25$ +
  12 tester × 14 giorni). Sono il collo di bottiglia dei tempi.
- **Canale push nel motore**: `lib/alert/invia.ts` oggi manda email;
  aggiungere l'invio al token `expo_push_token` (API di Expo) come canale
  primario quando esiste.
- **Il dettaglio destinazione ricava persone e soglia dalla prima ricerca
  attiva**: `invii` ha già `ricerca_id`, va selezionato in
  `caricaDestinazioni` e usato per prendere la ricerca giusta.
- Schermate vere dell'app nella landing (dall'export web appena stabile).
- Benzina ferma (1,994) anche in 2 punti dell'app mobile: si sistema
  insieme al lettore MIMIT.

- Cron in produzione per raccolta/abbinamento (endpoint pronti, serve MOTORE_SEGRETO su Netlify)
- Bot Telegram (il codice c'è, manca TELEGRAM_BOT_TOKEN)
- Acquisto crediti con Polar (serve partita IVA). Nel codice di Polar non c'è
  ancora niente: è l'unico pezzo di prodotto tutto da scrivere.
- Schermate vere dell'app dentro la landing al posto del telefono disegnato

### Aperti dal controllo del 07/08 (decisioni o pezzi nuovi)

- **La camera per quante persone vale?** Le offerte non hanno una capienza:
  il motore divide il prezzo camera per le persone della ricerca (1-8).
  Una ricerca in 4 su una doppia produce un totale falso. Oggi regge solo
  la verifica umana, ma il pannello non chiede "per quante persone vale
  questo prezzo". Serve una decisione di Valerio (campo in più, o limite).
- **Lettore del prezzo benzina dal MIMIT**: 1,994 è scritto fisso in 7 file
  (motore, pagina app, API costruttore, onboarding, landing). La regola dice
  "mai scritto fisso": ogni settimana che passa i conti invecchiano.
- **Rimborso credito atomico**: `restituisciCredito` riscrive il valore
  letto prima (`rimasti + 1`). Se fra scalo e rimborso arrivasse un acquisto,
  verrebbe sovrascritto. Oggi non può succedere (niente acquisti), va chiuso
  con una RPC come `consuma_credito` quando entra Polar.

</details>

---

## 📌 COSE CHE VALGONO SEMPRE

- **Obiettivo: fare cassa entro ottobre 2026.** Ogni scelta si giudica così.
- **Prodotto: Rivolio**, lo scanner dei rimborsi EU261. Check 1,99
  (interruttore), pratica 16,90€, famiglia 29,90€, garanzia legata
  all'esito. **Chiuso.**
- **Nome: Rivolio**, per esteso. Tagline: *Riprenditi i soldi che ti devono.*
- **L'incerto non si vende MAI. I falsi positivi sono 0, bloccante.**
- **Web-first**: il check e l'incasso stanno sul web; l'app mobile è il
  tracker post-pagamento, non la porta d'ingresso.
- Bianco e verde. **Stripe Managed Payments** (niente partita IVA fino a
  ~10k/mese: da confermare col commercialista, il documento stesso lo chiede).
- **Ti servono:** chiave AeroDataBox, chiavi Stripe, dominio, account social.
- **Come vuoi che lavori:** tutte le cose chieste in una seduta, domande mentre
  si lavora e non al posto di lavorare, aggiornandoti su dove siamo.

## Dal giro #32 (9/08)
- **Migrazione doppio opt-in da applicare** sul Supabase vero:
  `supabase/2026-08-11-doppio-optin.sql` (colonne `confermato_il` e
  `disdetto_il` su `iscritti`). Senza, il clic di conferma non si
  registra: la pagina dice onestamente "riprova", ma nessuno si iscrive.
- **Chi manda la newsletter deve filtrare i confermati**: quando si
  scriverà l'invio settimanale dell'Osservatorio, la query è
  `confermato_il is not null and disdetto_il is null`. L'indice
  `iscritti_confermati_idx` è già lì per quello.
- **Gli iscritti di prima del 9/08 non hanno `confermato_il`**: sono
  pochi (prove di Valerio) e vanno confermati a mano o riscritti una
  volta sola chiedendo la conferma. Non mandare loro la newsletter
  dandoli per confermati.
- **RESEND_MITTENTE su Netlify** appena il dominio è verificato:
  "Valerio di Rivolio <valerio@DOMINIO>". Finché non c'è, il nome
  mostrato è giusto ma l'indirizzo resta quello di prova di Resend e la
  consegna è limitata a valerio@artecai.it.

## Dal giro #34 (9/08)
- **Migrazione `supabase/2026-08-12-cancellato.sql` DA APPLICARE** sul
  Supabase vero (3 colonne su `verifiche`: preavviso, alternativa, data
  della risposta). Senza, il verdetto sui cancellati funziona lo stesso ma
  le risposte non restano scritte, e quella è la prova se la compagnia
  contesta.
- **Il dominio**: appena rivolio.it è attivo e puntato su Netlify, due
  variabili e basta: NEXT_PUBLIC_SITO sul sito e EXPO_PUBLIC_SITO
  sull'app. Da quel momento sparisce anche l'ultimo `rivoglio.netlify.app`
  dal codice. Vanno rinominati anche il progetto Netlify, la repo GitHub e
  il progetto Supabase, che si chiamano ancora rivoglio.
- **Negato imbarco e coincidenza persa**: stessa struttura dei cancellati
  (due domande + albero deterministico). È il prossimo caso del CE 261
  che vale soldi, e ora c'è il modello da copiare.
- **Il limite sulla PARTENZA nella riprotezione**: oggi non lo chiediamo e
  quindi diciamo "non spetta" in qualche caso in cui la legge lo
  concederebbe. Se un giorno il volume lo giustifica, si aggiunge una
  terza domanda e si allenta.

## Dal giro #35 (9/08)
- **Migrazione `supabase/2026-08-13-dichiarati.sql` DA APPLICARE** sul
  Supabase vero (caso_dichiarato, dichiarazione jsonb, dichiarato_il su
  `verifiche`): senza, i verdetti su negato imbarco e coincidenza
  funzionano ma la dichiarazione non resta scritta come prova.
- **Testimonial**: Valerio vuole la sezione dal blocco Efferd
  `@efferd/testimonials-8`. STOP obbligato: serve EFFERD_REGISTRY_TOKEN
  (Efferd Pro, efferd.com/account?tab=registry-token) e il progetto non
  è ancora shadcn (manca components.json). Quando c'è il token:
  npx shadcn@latest init, registry @efferd in components.json, poi
  npx shadcn@latest add @efferd/testimonials-8. Recensioni VERE che
  fornirà lui: mai inventate (regola 3).
- **Lettera per negato/coincidenza**: oggi il verdetto c'è, la lettera
  usa il modello del ritardo; va scritta la variante con art. 4 e
  giurisprudenza Folkerts per i due casi nuovi.

## Dal giro #37 (9/08) — dopo il cancello territoriale e la ricerca
- **I 30 CASI VERI: tocca a te lanciarli.** Un comando solo, dalla cartella
  del progetto: `npm run banco`. Legge `prove/casi-reali.json` (30 voli veri
  già scelti), li passa nel motore e stampa quanti risultano idonei. Ci
  mette circa un minuto. Da qui non posso: l'ambiente blocca AeroDataBox.
  **È la validazione che il piano mette prima di tutto: senza, non sappiamo
  quanti voli reali risultano davvero idonei.**
- **Le due domande al supporto AeroDataBox** (costo zero, sbloccano o
  chiudono per sempre il retroattivo lungo). In inglese:
  1. "How far back does the historical flight-by-number archive go on the
     Pro, Ultra and Mega plans?"
  2. "Do records older than 12 months still include `arrival.quality =
     Live` and `arrival.runwayTime`?"
  Se la risposta alla seconda è no, il retroattivo lungo è chiuso comunque:
  senza Live il motore non dà verdetti, quindi si pagherebbe un abbonamento
  per zero pratiche in più. **Non abbonarsi a niente prima della risposta.**
- ~~**La garanzia dei 90 giorni va ripensata.**~~ **CHIUSO il 9/08 (giro
  #38)**: legata all'esito (rifiuto senza motivo valido o silenzio oltre i
  termini). Il testo originale resta qui sotto perché spiega il conto.
- ~~La garanzia dei 90 giorni, il rischio più
  sottovalutato.~~ Le compagnie rispondono in 8-14 settimane: il giorno 90
  cade DENTRO quella finestra, quindi clienti onesti chiederanno il rimborso
  senza che la compagnia abbia ancora deciso. Al 50% di escussioni il
  margine per pratica scende da 13,66 a circa 6,83 euro. Due strade, decide
  Valerio: legarla all'ESITO ("se la compagnia rifiuta senza motivo valido o
  non risponde nei termini, ti rimborsiamo") oppure allungarla a 180 giorni.
  **Non è un dettaglio di testo: è metà del guadagno.**
- **I 9 paesi che mancano nella tabella degli enti nazionali**
  (`lib/lettera/neb.ts`): Croazia, Slovenia, Slovacchia, Romania, Cipro,
  Estonia, Lettonia, Lituania, Liechtenstein. Non ci sono perché la pagina
  ufficiale della Commissione e i suoi PDF sono bloccati dal proxy di questo
  ambiente: **non ho voluto scrivere nomi non verificati**. Oggi per quei
  paesi la lettera dice il paese e rimanda all'elenco ufficiale, che è
  onesto ma meno comodo. Si chiude aprendo
  https://transport.ec.europa.eu/transport-themes/passenger-rights/national-enforcement-bodies-neb_en
  da un PC normale e copiando le righe mancanti.
- **Il francese, lo svedese, il danese e il norvegese hanno il nome
  dell'ente ma non l'indirizzo verificato**: la lettera li nomina
  correttamente e rimanda all'elenco ufficiale per il link. Stessa fonte di
  sopra, stessa mezz'ora di lavoro.
- ~~**La lettera manda tutti all'ENAC, anche chi parte da fuori Italia.**~~
  **CHIUSO il 9/08 (giro #38)**: `lib/lettera/neb.ts` sceglie l'ente dallo
  Stato dell'aeroporto di partenza, 20 paesi verificati, 6 prove.
- **Resta il campo vecchio da buttare:** `autoritaNazionale` dentro
  `compagnie.ts` è agganciato alla COMPAGNIA, che è concettualmente
  sbagliato (la competenza è dello Stato di partenza). Oggi non lo usa
  nessuno, quindi non fa danni: va tolto, non corretto, così nessuno in
  futuro lo ripesca credendolo buono.
- **La Svizzera resta fuori dal cancello territoriale, di proposito.**
  Applica il 261 per accordo bilaterale, non come Stato membro, e non ho
  una fonte verificata sotto mano. Oggi quei casi escono incerti (vendita
  persa, mai un falso positivo). **Ancora aperta al 9/08**: la fonte va
  aperta dal PC di Valerio, il proxy di qui non ci arriva. Dal giro #44
  vale anche dal lato compagnia: Swiss in arrivo da un paese terzo non
  produce né un sì né un no.
- ~~I grandi vettori extra UE non sono in tabella~~ **CHIUSO il 9/08
  (giro #44)**: `lib/regole/vettori.ts` porta 55 compagnie extra UE con
  nome e paese della licenza, e `vettoreConLicenzaUE` le legge dopo le
  schede complete. Un New York → Roma con Delta esce non idoneo invece
  che incerto. La tabella sta fuori da `compagnie.ts` di proposito:
  quel file dichiara canali reclamo VERIFICATI, e per queste compagnie
  non li abbiamo.
- **Il dopo-lettera** (dalla ricerca, alto impatto): il 52% dei reclami
  validi viene respinto alla prima risposta. Oggi Rivolio si ferma alla
  lettera. Serve il secondo colpo già pronto e incluso nel prezzo: il
  sollecito e la segnalazione all'ente nazionale precompilata. Abbassa le
  escussioni della garanzia e giustifica il pagamento anticipato.

## Dal giro #36 (9/08) — sicurezza e stile
- **Cancellazione automatica dopo 24 mesi**: la privacy ora PROMETTE che le
  verifiche perdono i dati che identificano l'utente entro 24 mesi. La
  promessa è scritta ma il lavoro NON è ancora automatico: serve un job (cron
  Netlify, come `avvisa.mjs`) che gira ogni notte, trova le verifiche più
  vecchie di 24 mesi e azzera i campi riconducibili (email collegata,
  eventuali nomi passeggeri), lasciando solo i numeri anonimi per le
  statistiche. Finché non c'è, la pulizia va fatta a mano. Priorità bassa
  finché il volume è piccolo, ma la promessa è pubblica: non lasciarla vuota
  a lungo.
- **Titolare del trattamento nella privacy** (l'unico punto 🔴 dell'audit che
  resta): serve cognome e, se c'è, ragione sociale + P.IVA + indirizzo di
  Valerio. È un dato suo, non lo posso inventare. Vedi "Serve Valerio".
- **Strato anti-copia**: è dentro (`AntiCopia.tsx`, scelta "entrambi" col
  popup) ma è DEBOLE per natura e si può spegnere quando si vuole (basta
  togliere `<AntiCopia />` dal layout). Se un domani dà fastidio agli utenti
  veri (tasto destro bloccato), toglierlo è sano.
- **CSP più stretta (nonce)**: oggi la CSP ammette `'unsafe-inline'` sugli
  script perché Next inietta i suoi senza nonce. Il gradino successivo, se un
  domani si vuole blindare anche l'inline, è una CSP con nonce per richiesta
  (serve un middleware che genera il nonce e lo passa a Next). Non urgente:
  non c'è nessun punto dove un dato dell'utente finisce in uno script.

## Dal giro #62 (13/08)

- **A-mobile.** L'app sul telefono ha ancora la sua copia del controllo
  email (`mobile/src/lib/sessione.tsx`, la regex permissiva di prima).
  Non può importare da `lib/`: è un pacchetto a parte. Quindi da lì un
  account con un'email inesistente si può ancora aprire. Va portata la
  stessa logica, oppure l'app deve chiedere al sito (una rotta
  `/api/email/controlla`), che è la strada più pulita perché tiene una
  regola sola.
- **A-costi.** La lettura della risposta della compagnia costa due giri
  di modello (OCR + chat) per ogni no dichiarato. Oggi il tetto è 6 al
  minuto per indirizzo e serve un account con una pratica pagata, quindi
  il costo cresce coi clienti e non col traffico. Da riguardare il giorno
  che le pratiche diventano decine al giorno.
- ~~**A-analisi.** Il prompt non ha mai girato contro Mistral vero.~~
  ✅ **PROVATO IL 13/08, e ha funzionato al primo colpo** su un rifiuto
  scritto come li scrivono le compagnie (guasto tecnico + «abbiamo già
  rimborsato il biglietto»): motivo riconosciuto `guasto_tecnico` con
  sicurezza alta, sei fatti loro estratti compreso il numero di pratica,
  e il paragrafo **passato dal controllo**, con la citazione giusta
  (Wallentin-Hermann C-549/07, che è nel nostro archivio).
  ⚠️ **Da qui serve un trucco per provarlo**: `fetch` di Node ignora
  `HTTPS_PROXY`, quindi in sandbox le chiamate a `api.mistral.ai` tornano
  403 e sembra una chiave scaduta. Non lo è: si lancia con
  `NODE_USE_ENV_PROXY=1` e `NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`.
  Su Netlify il proxy non c'è e il problema nemmeno.
  ⚠️ Resta da guardare **cosa scrive nei log quando SCARTA** un
  paragrafo: quello capiterà solo su una risposta strana, e va visto una
  volta prima di fidarsi del tutto.
- **A-eventi.** Risposta e analisi stanno in `pratiche_eventi.nota` come
  testo (l'analisi come JSON). Funziona e non richiede migrazioni, ma
  quella colonna non ha un limite: una risposta di compagnia molto lunga
  ci finisce intera (il taglio è a 12.000 caratteri lato rotta). Se un
  domani si volesse cercare dentro le analisi, lì servirebbe una colonna
  vera.
