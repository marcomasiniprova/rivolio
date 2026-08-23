import type { Metadata } from "next";
import Link from "next/link";
import PaginaLegale from "@/components/legale/PaginaLegale";

import { PREZZO_LANCIO, seSiPaga } from "@/lib/check/ingresso";
import { euro } from "@/lib/prezzi";
export const metadata: Metadata = {
  title: "La compagnia non paga: il giudice di pace, spiegato | Rivolio",
  description:
    "Quanto costa davvero, quanto ci vuole, cosa serve e quando conviene. Guida gratuita e onesta, senza promesse: qui non si vende niente.",
};

/**
 * IL TERZO COLPO, SPIEGATO SENZA VENDERE NIENTE (scelta di Valerio col
 * popup, 10/08: "una guida onesta").
 *
 * Perché esiste: dopo il reclamo e la segnalazione all'ente, chi non ha
 * ancora visto un euro resta senza sapere che fare, e a quel punto o
 * molla o va da un portale che gli prende il 35%. Questa pagina gli dice
 * come funziona davvero, coi costi veri, e gli lascia decidere.
 *
 * ⚠️ COSA QUESTA PAGINA NON FA, ed è una scelta, non una mancanza:
 * non prepara nessun atto, non dice "vinci di sicuro" e non fa da
 * avvocato. Rivolio non è un servizio legale e non lo diventa: le regole
 * di chi incassa vietano i servizi umani e la consulenza, e sarebbe comunque una promessa
 * che non possiamo mantenere.
 *
 * ⚠️ I NUMERI. Il contributo unificato per le cause di valore modesto e
 * le soglie di competenza del giudice di pace vengono dal Testo unico
 * spese di giustizia (d.P.R. 115/2002) e dall'art. 7 c.p.c., ma da
 * questo ambiente le fonti ufficiali non si aprono: sono dichiarati come
 * ORDINI DI GRANDEZZA e vanno riletti prima di andare online. È segnato
 * in ARRETRATI.
 */
export default function PaginaGiudiceDiPace() {
  return (
    <PaginaLegale
      titolo="La compagnia continua a non pagare"
      aggiornata="10 agosto 2026"
      sottotitolo="Cosa succede dopo l'ente nazionale. Guida gratuita: qui non si vende niente e non si prepara nessun atto."
    >
      <p>
        Hai mandato il reclamo, hai mandato il sollecito, hai segnalato all&apos;ente nazionale.
        Se dopo tutto questo non hai ancora visto un euro, restano due strade, in ordine: prima la
        conciliazione gratuita, poi, se non basta, il giudice. Questa pagina ti dice com&apos;è
        fatta, senza girarci intorno.
      </p>

      <h2>Prima del giudice c&apos;è un passaggio gratuito, e non è facoltativo</h2>
      <p>
        Nel trasporto è previsto un <strong>tentativo di conciliazione</strong> prima di andare in
        causa. In Italia lo gestisce l&apos;Autorità di regolazione dei trasporti sulla piattaforma
        ConciliaWeb: si accede con SPID, non costa niente e i casi del Regolamento CE 261/2004 ci
        rientrano. Le compagnie lo conoscono bene: Ryanair, per dire, lo spiega sul proprio centro
        assistenza.
      </p>
      <p>
        Due motivi per farlo comunque, anche se pensi già alla causa. Il primo è che spesso finisce
        lì: è un tavolo dove si tratta di soldi, e per la compagnia chiudere costa meno che
        difendersi. Il secondo è pratico:{" "}
        <strong>
          chi va dal giudice senza aver nemmeno provato la conciliazione rischia di vedersi
          rimandare indietro
        </strong>{" "}
        e di aver buttato il contributo unificato.
      </p>
      <p>
        Serve che tu abbia già scritto alla compagnia e che siano passati 30 giorni senza risposta,
        oppure che la risposta sia arrivata e non ti soddisfi. La domanda va presentata entro un
        anno da quel reclamo:{" "}
        <a href="https://www.autorita-trasporti.it/conciliaweb/" target="_blank" rel="noopener noreferrer">
          ConciliaWeb, il servizio conciliazioni dell&apos;Autorità di regolazione dei trasporti
        </a>
        . Se il volo partiva da un altro paese dell&apos;Unione, l&apos;equivalente gratuito è il{" "}
        <a href="https://ecc-netitalia.it/" target="_blank" rel="noopener noreferrer">
          Centro Europeo Consumatori
        </a>
        .
      </p>

      <h2>Al giudice di pace non ti serve per forza un avvocato</h2>
      <p>
        È la cosa che quasi nessuno sa, ed è il motivo per cui tanti si fermano:{" "}
        <strong>non ti serve per forza un avvocato</strong>. Per le cause di valore contenuto il
        giudice di pace ammette di stare in giudizio di persona, ed è esattamente il caso di una
        compensazione da 250, 400 o 600 euro.
      </p>

      <h2>Quanto costa</h2>
      <p>
        Molto meno di quello che immagini, ed è il motivo per cui le compagnie preferiscono spesso
        pagare prima di arrivarci. Le voci sono due:
      </p>
      <ul>
        <li>
          <strong>il contributo unificato</strong>, cioè quello che si versa allo Stato per aprire
          la causa. Per le cause di valore modesto è una cifra di poche decine di euro;
        </li>
        <li>
          <strong>le spese di notifica</strong>, cioè far arrivare l&apos;atto alla compagnia:
          altre poche decine di euro.
        </li>
      </ul>
      <p>
        Se vinci, il giudice di norma condanna la compagnia a rimborsarti anche queste spese.
        <strong> Le cifre esatte cambiano nel tempo</strong> e vanno controllate sul sito del
        tribunale o del giudice di pace competente prima di partire: qui non te ne scriviamo una
        precisa perché una cifra sbagliata in una pagina che parla di soldi è peggio di nessuna
        cifra.
      </p>

      <h2>Quanto ci vuole</h2>
      <p>
        Dipende dal tribunale, e varia molto da città a città: si va da qualche mese a oltre un
        anno. È la parte scomoda, e va detta. In compenso non devi seguirla ogni giorno: dopo il
        deposito ci sono una o due udienze.
      </p>

      <h2>Da chi ci si va</h2>
      <p>
        Il giudice competente è quello del luogo dove si trova l&apos;aeroporto di partenza oppure
        quello di arrivo: puoi scegliere. Se uno dei due è vicino a casa tua, è quello.
      </p>

      <h2>Cosa devi avere in mano</h2>
      <ul>
        <li>la carta d&apos;imbarco o la conferma della prenotazione;</li>
        <li>il reclamo che hai inviato alla compagnia, con la data;</li>
        <li>il sollecito, con la data;</li>
        <li>la risposta della compagnia, se è arrivata;</li>
        <li>la segnalazione all&apos;ente nazionale e la sua eventuale risposta;</li>
        <li>l&apos;esito del tentativo di conciliazione, se lo hai già fatto;</li>
        <li>la prova del ritardo: gli orari previsto ed effettivo del volo.</li>
      </ul>
      <p>
        Se hai fatto la pratica con noi, questi documenti li hai già tutti nella pagina della tua
        pratica, con le date. È il motivo per cui insistiamo tanto sul registrare quando hai
        mandato ogni cosa: quelle date qui diventano una prova.
      </p>

      <h2>Quando conviene, e quando no</h2>
      <p>
        Conviene quando il caso è pulito: ritardo verificato sopra le tre ore, volo coperto dal
        Regolamento, nessuna circostanza eccezionale seria dall&apos;altra parte. In quel caso la
        compagnia spesso paga appena riceve l&apos;atto, senza arrivare all&apos;udienza.
      </p>
      <p>
        Conviene meno se la compagnia ha una circostanza eccezionale documentata e credibile, per
        esempio uno sciopero dei controllori di volo con i suoi provvedimenti pubblici. Lì il
        rischio di perdere è reale, e perdere significa pagare anche le spese dell&apos;altra
        parte.
      </p>

      <h2>Se preferisci non farlo da solo</h2>
      <p>
        Puoi rivolgerti a un avvocato o a un&apos;associazione di consumatori. Costa, e va messo in
        conto rispetto a quello che puoi recuperare. Puoi anche rivolgerti a uno dei portali che
        gestiscono il recupero: lavorano senza anticipo ma trattengono una percentuale importante
        di quello che ottieni.
      </p>

      <h2>Cosa facciamo noi, e cosa no</h2>
      <p>
        Noi ci fermiamo qui, ed è una scelta dichiarata. Rivolio prepara documenti a partire da
        dati verificati: il reclamo, la replica al loro no, la segnalazione all&apos;ente. Non
        siamo avvocati, non prepariamo atti giudiziari e non diamo consulenza legale. Chiunque ti
        prometta il contrario in cambio di 15 euro ti sta raccontando qualcosa.
      </p>
      <p>
        Quello che possiamo fare, e che è già incluso in quello che hai pagato: darti tutte le
        date, tutti i testi e tutte le prove in ordine, così che tu o chi ti aiuta non debba
        ricostruire niente.
      </p>

      <details>
        <summary>Da dove vengono queste informazioni</summary>
        <p>
          Competenza del giudice di pace e possibilità di stare in giudizio di persona per le cause
          di valore contenuto: codice di procedura civile, art. 7 e art. 82. Contributo unificato:
          Testo unico delle spese di giustizia, d.P.R. 30 maggio 2002 n. 115. Foro competente per
          il trasporto aereo: giurisprudenza della Corte di giustizia dell&apos;Unione europea sulla
          scelta fra luogo di partenza e luogo di arrivo.
        </p>
        <p>
          Conciliazione: Autorità di regolazione dei trasporti, servizio conciliazioni e piattaforma
          ConciliaWeb, con le relative FAQ sui tempi e il vademecum. Che le compagnie la usino è
          verificabile sul centro assistenza Ryanair, che le dedica una sezione. Assistenza
          transfrontaliera gratuita: rete ECC-Net, Centro Europeo Consumatori Italia.
        </p>
        <p>
          <strong>Gli importi non sono scritti in questa pagina di proposito</strong>: cambiano nel
          tempo e vanno letti sulla fonte aggiornata il giorno in cui ti servono.
        </p>
      </details>

      <hr />

      <p>
        Non sei ancora arrivato a questo punto?{" "}
        <Link href="/">Controlla il tuo volo</Link>:{" "}
        {seSiPaga(`l'analisi costa ${euro(PREZZO_LANCIO)}`, "il check è gratuito")}, e se ti spetta qualcosa
        prepariamo noi la lettera, il sollecito e la segnalazione all&apos;ente. Tutto compreso nel
        prezzo, senza percentuali sul tuo rimborso.
      </p>
    </PaginaLegale>
  );
}
