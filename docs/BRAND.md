# BRAND — Rivolio

*Le regole del marchio. Se una cosa è scritta qui, non si improvvisa.*
I valori vivono in `app/globals.css` dentro `@theme`: **quello è l'originale**,
questo file lo spiega. Se cambi un colore, cambialo lì e aggiorna qui.

---

## Il nome

**Rivolio** — scelto da Valerio il 07/08 (sera), col pivot di prodotto.
Sempre per esteso, iniziale maiuscola, mai abbreviato.

**La tagline:** *Riprenditi i soldi che ti devono.*
Proposta dal giro di copy del 07/08 (notte), già nel titolo del sito e nei
testi. Reversibile con una parola di Valerio: è una stringa in `lib/copy.ts`.
Quella vecchia (*La tua fuga, al prezzo giusto*) era dell'idea viaggi.

---

## I colori

> Struttura e misure vengono dal template **Zentivo** (Framer), che Valerio ha
> scelto come riferimento. Il blu `#1A4BED` dell'originale è stato sostituito
> dal nostro verde. Tutto il resto — griglie, pillole, spaziature — è quello.

### I due che fanno il marchio
| | Codice | Dove si usa |
|---|---|---|
| **Verde** | `#0A9D5C` | Il colore del marchio. Logo, bottoni pieni, numeri importanti, accenti |
| **Nebbia** | `#F6F8FA` | Il fondo di tutto (è il fondo di Zentivo) |

### Gli accenti
| | Codice | Dove si usa |
|---|---|---|
| **Verde scuro** | `#067A46` | Il passaggio del mouse sui bottoni verdi |
| **Verde notte** | `#052E1F` | Le sezioni scure (il conto aperto, l'iscrizione) |
| **Menta** | `#7FE8AE` | Numeri e spunte sul fondo scuro, bottoni sul verde |
| **Menta tenue** | `#E6FAF0` | Sfondo delle icone e delle strisce chiare |
| **Oro** | `#F5C451` | **Solo il sole del logo** e i messaggi d'errore sul fondo scuro |

### I testi
| | Codice | Dove |
|---|---|---|
| **Inchiostro** | `#0A0A0A` | Titoli e testo principale (Zentivo usa il nero pieno) |
| **Fumo** | `#6B7280` | Testo secondario, descrizioni |
| **Fumo chiaro** | `#9AA4B0` | Note, didascalie, campi vuoti |
| **Bordo** | `#E4E9EE` | Bordi delle card e linee di divisione |

---

## I caratteri

Gli stessi di Zentivo, misurati dal template dal vivo:

- **Titoli — Geist.** Peso **500**, spaziatura **−0.04em**, interlinea **1.0**.
  Non usare il grassetto pieno: Zentivo sta sul 500 ed è quello che gli dà
  quell'aria pulita.
- **Testo — Poppins.** Pesi 400/500/600.

**Mai** Inter, Roboto, Arial o i caratteri di sistema.

## Le forme

- **Bottoni: pillole.** `border-radius: 999px`, sempre. Nessun bottone squadrato.
- **Card: `1.5rem`** di raggio. Sezioni grandi: `2rem`.
- **La barra di navigazione fluttua**: pillola bianca semitrasparente, staccata
  dal bordo alto, con la sfocatura dietro.

---

## Il marchio

**Definitivo, scelto da Valerio l'8/08: la lente con l'aereo e le barre.**
Una lente d'ingrandimento (il check), dentro un aereo in decollo e tre barre
che salgono (la compensazione). Interno bianco, tratto verde in gradiente.
Il vecchio segno a tre forme (sole, orizzonte, mezzeria) era dell'idea
viaggi: non usarlo più.

I file, generati dall'originale di Valerio (sfondo tolto, upscalato):
- `public/marchio.png`: solo la lente, fondo trasparente. È quella che gira
  nel sito (nav, footer, card di condivisione).
- `public/marchio-completo.png`: lockup intero con la scritta RIVOLIO e la
  micro-tagline, trasparente. Per store, social e materiali.
- `app/icon.png` (512) e `app/apple-icon.png` (180): lente su fondo bianco.
- La scritta accanto alla lente nel sito è testo vero, in due toni come nel
  lockup: "Rivo" scuro, "lio" verde.

### La regola che comanda su tutte
**Deve reggere a 24 pixel.** È lì che verrà visto quasi sempre: favicon del
browser, avatar del bot Telegram, icona sulla schermata Home del telefono.
L'interno bianco della lente è quello che la salva sui fondi scuri e nelle
misure piccole: non riempirlo mai di colore.

### Cosa non fare
- Non allungarlo né schiacciarlo: si ridimensiona sempre in proporzione.
- Non cambiargli i colori per adattarlo a uno sfondo. Su fondo scuro si usa il
  marchio identico, cambia solo il colore del testo accanto.
- Non aggiungere ombre, sfumature o contorni.
- Non scrivere il nome dentro il quadrato: il quadrato è solo il segno.

---

## Come si parla

**Dai del tu.** Sei l'amico che ha già fatto la ricerca al posto suo.

| Si scrive così | Non così |
|---|---|
| "Dimmi da dove parti." | "Inserisci la località di partenza." |
| "Ti avviso io." | "Riceverai una notifica." |
| "Ti avanzano 15€ per la cena." | "Risparmio stimato: €15." |
| "Se non c'è niente di buono, non ti disturbo." | "Nessun risultato disponibile." |

**Le tre regole del testo:**
1. **Frasi corte.** Se una frase ha due virgole, spezzala.
2. **Ogni numero dev'essere apribile.** Se scrivi "€27 di auto", l'utente deve
   poter vedere il conto. La trasparenza *è* il prodotto.
3. **Onesto anche quando costa.** Se la copertura in Sicilia è sottile, si dice.
   Un iscritto perso vale meno di un cliente che si sente preso in giro.

**Mai:** "imperdibile", "esclusivo", "rivoluzionario", "la soluzione definitiva",
punti esclamativi a raffica, MAIUSCOLE per gridare.

---

## La direzione visiva scelta da Valerio (riferimenti del 07/08, sera)

Quattro riferimenti caricati da Valerio (app legale AI, app pulizie con
timeline, landing LinguistAI). Il linguaggio comune, che è il TARGET della
rifinitura:

- **Luce e aria**: fondi chiari con sfumature morbide di cielo, tanta aria
  fra le sezioni. Per noi: il cielo sta bene con i voli, e si sposa col
  verde del marchio (il verde resta il colore dei soldi e dell'azione).
- **Vetro smerigliato**: card traslucide con sfocatura, chip che fluttuano
  attorno agli elementi principali (già nel nostro DNA dalla nav a pillola).
- **Card bianche pulite** con icone in chip tondi colorati, righe
  informative con icona + testo, MAI muri di testo.
- **Un solo bottone pieno che comanda** per schermata; il resto contorno o
  fantasma.
- **Stepper e timeline nitidi** (riferimento 3): è la forma del nostro
  tracker della pratica: Pagata → Pronta → Inviata → Sollecito → Esito.
- **Divisori a onda** fra sezioni chiare e scure (riferimento 4).
- **Titoli grandi con UNA parola accentata** a colore o in corsivo: già
  nostro, si tiene.
- Confronto "vecchio modo contro noi" in due card affiancate
  (riferimento 4): perfetto per "AirHelp 35% contro Rivolio 16,90€".
