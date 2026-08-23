# rivolio.it e le email, passo per passo

*Aggiornato l'11/08 per **IONOS** (è lì che hai il dominio). Ogni passo
è un riquadro da copiare: nessun segnaposto, nessun "metti il tuo".*

---

## Cosa cambia quando hai finito

**Oggi le email partono SOLO verso valerio@artecai.it.** Non è una scelta
nostra: Resend, finché non gli dimostri che il dominio è tuo, spedisce
soltanto all'indirizzo con cui ti sei registrato. Quindi in questo
momento **chi si iscrive all'Osservatorio non riceve niente**, e chi apre
una pratica non riceve le sue email.

Alla fine di questi passi partono a tutti, e il sito si chiama
`rivolio.it` invece di `rivolio.netlify.app`.

**Tempo: venti minuti tuoi, poi si aspetta.** I cambi DNS ci mettono da
dieci minuti a qualche ora a fare il giro del mondo. Non è rotto: è
lento per costruzione.

---

## PASSO 1. Il dominio punta sul sito

Su **IONOS**: *Domini e SSL* → clicca `rivolio.it` → *DNS*.

Devi aggiungere due record. Se ce ne sono già di uguali (spesso IONOS ne
mette uno che punta a una pagina di parcheggio), **modificali invece di
aggiungerne altri**: due record dello stesso tipo sullo stesso nome
litigano fra loro.

**Record 1 · il sito senza www**

| Campo | Valore |
|---|---|
| Tipo | `ALIAS` (se IONOS non ce l'ha, usa `A`) |
| Nome / Host | `@` |
| Valore | `apex-loadbalancer.netlify.com` |

⚠️ Se IONOS ti fa scegliere solo `A`, allora il valore diventa
`75.2.60.5`. È l'indirizzo che Netlify pubblica per i domini senza www.

**Record 2 · il sito con www**

| Campo | Valore |
|---|---|
| Tipo | `CNAME` |
| Nome / Host | `www` |
| Valore | `rivolio.netlify.app` |

Poi su **Netlify**: *Domain management* → *Add a domain* → scrivi
`rivolio.it`. Netlify si accorge da solo dei record e accende il
lucchetto (il certificato HTTPS) entro qualche minuto.

---

## PASSO 2. Il sito impara il suo nome nuovo

Su **Netlify**: *Site configuration* → *Environment variables*.
Cambia questa:

```
NEXT_PUBLIC_SITO = https://rivolio.it
```

E aggiungi questa, che serve **all'app** (Expo non legge le variabili che
non cominciano per `EXPO_PUBLIC_`):

```
EXPO_PUBLIC_SITO = https://rivolio.it
```

Poi *Deploys* → *Trigger deploy* → *Clear cache and deploy site*.

⚠️ **Serve il deploy nuovo.** Quell'indirizzo finisce dentro le pagine
quando il sito viene costruito, non quando qualcuno lo apre: senza
ricostruire, i link vecchi restano.

---

## PASSO 3. Resend: dimostrare che il dominio è tuo

Su **resend.com** → *Domains* → *Add Domain* → scrivi `rivolio.it`.

Resend ti mostra **tre record**. Non te li posso scrivere io perché uno
dei tre, la firma, **lo genera Resend in quel momento** ed è diverso per
ogni dominio: se te lo inventassi, il dominio non verrebbe mai
verificato e passeresti un pomeriggio a cercare il perché.

Quello che posso dirti è **che forma hanno**, così li riconosci e non
sbagli a incollarli su IONOS:

| # | Tipo | Nome / Host | Valore |
|---|---|---|---|
| 1 | `MX` | `send` | `feedback-smtp.<zona>.amazonses.com` · priorità **10** |
| 2 | `TXT` | `send` | `v=spf1 include:amazonses.com ~all` |
| 3 | `TXT` | `resend._domainkey` | una riga lunghissima che comincia per `p=` |

**Le tre trappole, in ordine di quanto fanno perdere tempo:**

1. **IONOS attacca il dominio da solo.** Se dopo aver salvato vedi
   `feedback-smtp.eu-west-1.amazonses.com.rivolio.it`, aggiungi un
   **punto finale** al valore: `...amazonses.com.` Il punto dice "questo
   indirizzo è completo, non aggiungerci niente".
2. **Il nome è `send`, non `@`.** Alcuni pannelli chiedono il nome
   completo: allora scrivi `send.rivolio.it`. Se sbagli qui, Resend
   resta in attesa per sempre senza dirti perché.
3. **Su `send` ci deve essere UN SOLO record MX.** Se IONOS ne ha già
   messo uno suo per la posta, quello va tolto: due MX sullo stesso nome
   si annullano.

Poi torna su Resend e premi *Verify*. Se resta in attesa, aspetta
mezz'ora e ripremi: sono i DNS che stanno ancora girando.

---

## PASSO 4. Il mittente

Solo **dopo** che Resend dice *Verified*, su Netlify:

```
RESEND_MITTENTE = Valerio di Rivolio <valerio@rivolio.it>
```

Poi di nuovo *Trigger deploy* → *Clear cache and deploy site*.

⚠️ **Se la metti prima della verifica, le email smettono di partire del
tutto.** Adesso funzionano perché il mittente di riserva è un indirizzo
di prova di Resend: se lo cambi con un dominio che Resend non ha ancora
approvato, rifiuta ogni invio.

---

## PASSO 5. La prova, in tre minuti

1. Apri `https://rivolio.it` in una finestra **in incognito**. Deve
   caricare col lucchetto chiuso.
2. Vai in fondo, all'Osservatorio, e iscrivi **un indirizzo che non sia
   il tuo**: quello di un amico, o un tuo secondo indirizzo.
3. Su quella casella deve arrivare *"Confermi l'iscrizione?"* entro un
   minuto. **Se arriva, hai finito**: è la prova che le email escono
   verso chiunque.
4. Clicca il link nell'email. Deve arrivare il benvenuto con dentro gli
   scali della giornata.

Se non arriva: su **resend.com** → *Emails* si vede la lista degli
invii e il motivo del rifiuto scritto in chiaro. Mandami quella riga.

---

## PASSO 6. Le tre cose da cambiare lo stesso giorno

1. **Il logo social.** L'immagine che si vede quando qualcuno incolla il
   link su WhatsApp o Instagram si costruisce dall'indirizzo del sito:
   dopo il deploy, controlla incollando `https://rivolio.it` in una
   chat con te stesso.
2. **Gli indirizzi di Stripe.** Il ritorno dopo il pagamento e l'endpoint
   del webhook usano l'indirizzo del sito: dopo il cambio dominio, controlla
   che `NEXT_PUBLIC_SITO` sia il nuovo dominio e che l'URL del webhook su
   Stripe punti a `https://rivolio.it/api/stripe/webhook`.
3. **L'app.** Va riesportata (`npm run anteprima` dentro `mobile/`)
   perché l'indirizzo del sito ce l'ha scritto dentro da quando è stata
   costruita.

---

## Cosa NON devi fare

- **Non spostare i name server su Netlify.** Ti servono i DNS di IONOS
  per i record di Resend: se sposti tutto, quei record spariscono e le
  email si fermano.
- **Non cancellare `rivolio.netlify.app`.** Continua a funzionare e
  resta l'indirizzo di riserva se qualcosa va storto col dominio.
- **Non mettere `RESEND_MITTENTE` prima della verifica** (vedi passo 4).
- **Non inventare la riga della firma DKIM.** È l'unica cosa che deve
  arrivare da Resend e da nessun altro posto.
