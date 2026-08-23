# Di cosa è fatto il motore di Rivolio

*Scritto per Valerio, il 9/08. Zero gergo: dove serve una parola tecnica,
c'è la traduzione accanto.*

## La risposta corta

Rivolio non è un'intelligenza artificiale che indovina i rimborsi.
È **una calcolatrice che segue una legge**, con davanti un archivio di
voli e dietro un magazzino di dati.

Ci sono **cinque pezzi**, e solo uno usa l'AI.

| Pezzo | Cosa fa | È AI? |
|---|---|---|
| **AeroDataBox** | Ci dice a che ora è atterrato davvero l'aereo | No, è un archivio |
| **Il motore delle regole** | Legge il Regolamento e dà il verdetto | **No, mai** |
| **Supabase** | Il magazzino: utenti, verifiche, pratiche | No, è un database |
| **Mistral OCR** | Legge la foto della carta d'imbarco | Sì |
| **Il raccoglitore di scioperi** | Legge le pagine pubbliche degli scioperi | Sì |

**Python non c'è.** Zero. Tutto il progetto è scritto in un linguaggio
solo, TypeScript, che è JavaScript con i controlli. Sito, app del
telefono e calcoli: stessa lingua, un unico posto dove guardare.

---

## Pezzo 1. AeroDataBox: il testimone

È un servizio a pagamento che tiene l'orario vero di ogni volo del mondo.
Gli chiediamo "volo FR4001 del 6 agosto" e ci risponde con l'orario
previsto, quello effettivo, gli aeroporti, la compagnia.

**Il dettaglio che vale i soldi:** ci dice anche se quell'orario è
*certificato dal tracciamento* oppure *stimato*. Noi diamo un verdetto
solo sul certificato. Una stima di 179 minuti può essere 185 minuti veri:
su quella non si vende niente e non si dice nemmeno di no.

Ogni risposta viene messa da parte così com'è arrivata. Se fra sei mesi
una compagnia contesta, la prova esiste.

**Costo:** si paga a chiamata, quindi ogni volo si chiede **una volta
sola**. Se su un aereo c'erano 180 passeggeri e fanno tutti il check,
la chiamata resta una: le altre 179 leggono la copia che abbiamo già.

## Pezzo 2. Il motore delle regole: il giudice

È un file solo, `lib/regole/eu261.ts`, ed è il cuore del prodotto.
Dentro non c'è nessuna intelligenza artificiale, e non ci sarà mai.

Perché: il Regolamento CE 261/2004 è **una scala a gradini**. Meno di 3
ore, niente. Più di 3 ore, dipende dai chilometri. Un'AI risponde "molto
probabilmente sì", e quel "molto probabilmente" è una persona che paga
per una lettera che non vale niente. Il codice invece fa una cosa sola:
guarda i numeri e scende i gradini.

I passaggi, in ordine:

1. **Questo volo è coperto dalla legge europea?** Conta da dove è
   partito l'aereo. Dall'Europa, sempre coperto, con qualunque
   compagnia. Da fuori con arrivo in Europa, coperto solo se la
   compagnia è europea. Da fuori a fuori, mai.
2. **I dati sono solidi?** Se l'orario non è certificato, ci si ferma.
3. **Quanto ritardo c'è stato?** Si misura all'arrivo, non alla partenza.
4. **Quanto è lunga la tratta?** 250, 400 o 600 euro secondo i chilometri.
5. **C'è qualcosa che rende il caso dubbio?** Uno sciopero quel giorno,
   due fonti che non concordano, la compagnia che non si sa chi sia.

Alla fine escono **tre risposte, mai due**:

- **verde**, ti spetta: si può vendere la pratica;
- **giallo**, incerto: **non si vende niente**, e si spiega perché;
- **rosso**, non ti spetta: gratis, e si dice il motivo.

**Il numero che comanda tutto il progetto: falsi positivi zero.** Un
falso positivo è un giallo o un rosso che esce verde, cioè uno che paga
16,90 per niente. C'è una lista di 55 casi decisi a mano (`casi-oro.ts`)
e a ogni modifica devono passare tutti e 55. Se uno solo sbaglia in quella
direzione, non si pubblica.

## Pezzo 3. Supabase: il magazzino

Supabase è il database, cioè lo schedario. Quattordici cassetti, i
principali:

- **voli**: la copia dei voli già chiesti ad AeroDataBox (la cache);
- **verifiche**: una riga per ogni check fatto da chiunque, col verdetto;
- **pratiche** e **pratiche_eventi**: chi ha pagato e a che punto sta;
- **profili**: gli account, il soprannome, la classifica;
- **voli_seguiti**: i voli da ricontrollare per le notifiche;
- **iscritti**: l'Osservatorio;
- **scioperi**: il calendario;
- **osservatorio_ritardi**: l'indice giornaliero degli otto scali.

### La tua domanda: sito e app usano lo stesso Supabase?

**Sì, ed è uno solo.** Non ce ne sono due e non ce ne saranno.

Nel dettaglio:

- **il check** l'app non lo calcola: lo chiede al sito (`/api/verifica`),
  la stessa porta che usa la pagina web. Quindi il motore è **uno**, e
  se domani cambia una regola cambia per tutti e due nello stesso
  istante. Se fossero due, prima o poi darebbero due risposte diverse
  allo stesso volo, e quello sarebbe il giorno in cui ci fai brutta figura;
- **profilo, pratiche e voli seguiti** l'app li legge e li scrive dritto
  su Supabase, con la sua chiave pubblica. È sicuro perché su ogni
  tabella c'è la regola che dice "ognuno vede solo la sua roba", e quella
  regola sta sul server, non nell'app.

Quindi: **un account, un archivio, due schermi.** Se ti registri sul sito
e apri l'app, ci trovi le tue pratiche.

## Pezzo 4. Mistral OCR: gli occhi

Serve a una cosa sola: **leggere la foto della carta d'imbarco**. Tu la
fotografi, lui la trasforma in testo, e da quel testo il numero del volo
e la data si prendono con una ricerca fissa, non con l'AI.

La foto **non si salva**: si legge e si butta.

E soprattutto: **quello che legge non decide niente**. Se il testo dice
una cosa e AeroDataBox ne dice un'altra, il caso diventa incerto e passa
da un controllo umano. L'AI non può spostare un verdetto.

## Pezzo 5. Il raccoglitore di scioperi: l'unico posto dove l'AI scrive

Ogni notte alle 4:20 un programma apre le pagine pubbliche (cruscotto
del Ministero, Commissione di Garanzia, ENAC), le fa trascrivere a un
modello e **fa passare ogni riga da un filtro fisso** prima di salvarla:
la data deve esistere ed essere in una finestra credibile, il testo deve
parlare di voli, il link alla fonte è obbligatorio.

**Perché qui l'AI è ammessa e nel verdetto no.** Un errore di questo
pezzo può solo segnare come sciopero un giorno che non lo era. E allora
il motore diventa **più prudente**: quel volo esce giallo, e un giallo
non si vende. Sbaglia dalla parte di chi non paga. Un errore nel
verdetto invece sbaglia dalla parte di chi incassa, ed è tutta un'altra
cosa.

---

## Le due cose che si aggiornano da sole

1. **Gli scioperi**, ogni notte alle 4:20 (vedi sopra).
2. **Gli aeroporti del mondo**, ogni lunedì mattina. L'elenco vecchio era
   una fotografia del 2017 e non aveva Berlino Brandeburgo, aperto nel
   2020: quel volo usciva "non riconosciamo l'aeroporto di partenza".
   Adesso GitHub scarica da solo l'elenco pubblico di OurAirports, lo
   controlla e lo aggiorna. Se il file arriva rotto, si ferma e non
   pubblica niente.

Tutti e due mandano un allarme se qualcosa non va. Il silenzio non è mai
una buona notizia.

## Le altre cose collegate (non sono il motore)

- **Stripe (Managed Payments)**: incassa i pagamenti al posto nostro, fa le
  fatture e gestisce l'IVA. Serve perché non hai partita IVA.
- **Resend**: manda le email.
- **Telegram**: gli avvisi a te.
- **OpenFlights → OurAirports**: l'elenco degli aeroporti, per calcolare
  i chilometri fra due città senza chiedere niente a nessuno.
- **Open-Meteo**: il meteo storico dentro la lettera. **Spento**: l'uso
  commerciale costa circa 99 dollari al mese.

## Se domani ti chiedono "come funziona"

> Prendiamo l'orario vero del tuo volo da un archivio professionale.
> Lo confrontiamo con l'orario che era previsto. Se il ritardo supera le
> tre ore, un programma applica il Regolamento europeo e dice quale
> fascia ti riguarda. Nessuna intelligenza artificiale decide: la legge è
> una tabella, e le tabelle si leggono, non si interpretano. Se il dato
> non è certificato non diamo nessun verdetto e non ti facciamo pagare.
