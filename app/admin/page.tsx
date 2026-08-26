import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Area, Imbuto, Legenda, Scheda } from "@/components/admin/Grafici";
import GraficoGiorni from "@/components/admin/GraficoGiorni";
import { Avviso, Kpi, euro, oNonLetto } from "@/components/admin/Pezzi";
import { contaInAttesa } from "@/lib/admin/dati";
import { soloAdmin } from "@/lib/admin/guardia";
import { CHECK_A_PAGAMENTO } from "@/lib/check/ingresso";
import { leggiCruscotto, leggiSerie, type GiornoSerie } from "@/lib/eventi/lettura";
import { TELEGRAM_ATTIVO } from "@/lib/eventi/telegram";
import { SERVIZIO_ATTIVO } from "@/lib/supabase/servizio";
import { FISSI_MENSILI, TASSO_RIMBORSO_GARANZIA, contoPratica } from "@/lib/admin/economia";

/**
 * LA PANORAMICA: la schermata che Valerio apre la mattina.
 *
 * L'ordine non è estetico, è di importanza: prima i soldi, poi dove si
 * ferma la gente, poi come sta andando la settimana. Quello che si
 * approfondisce ha una sezione sua nella barra a lato, e da qui ci si
 * arriva con un link invece di ripetere tutto due volte.
 *
 * ⚠️ QUANDO UN NUMERO NON SI LEGGE, SI SCRIVE CHE NON SI È LETTO. Mai
 * zero. Uno zero inventato si legge come «oggi non è venuto nessuno», ed
 * è il modo più veloce per prendere una decisione sbagliata su un dato
 * che non c'era.
 */
export const dynamic = "force-dynamic";

const GIORNI = 14;

const pct = (n: number) => `${Math.round(n * 100)}%`;

/**
 * La variazione contro i giorni prima.
 *
 * ⚠️ Si mostra SOLO se c'è qualcosa con cui confrontarsi. Nel riferimento
 * ogni card porta un "+12% vs mese scorso": scriverlo con due settimane
 * di sito vuoto sarebbe un numero inventato, cioè esattamente la cosa che
 * non si fa qui.
 */
function variazione(
  serie: GiornoSerie[] | null,
  quanto: (g: GiornoSerie) => number,
): { pct: number; rispetto: string } | null {
  if (!serie || serie.length < 3) return null;
  const prima = serie.slice(0, -1);
  const media = prima.reduce((s, g) => s + quanto(g), 0) / prima.length;
  if (media < 1) return null; // senza storico non è un confronto, è rumore
  /* 🔴 CONFRONTAVA MEZZA GIORNATA CON GIORNATE INTERE, quindi la mattina
     era sempre in rosso: alle nove hai un quinto della giornata contro la
     media di giornate finite, e il pannello ti dice "meno 80%" mentre non
     è successo niente di male. Un allarme che suona ogni mattina è un
     allarme che si smette di guardare.
     Adesso il confronto si mostra solo a giornata finita; prima di
     allora si dice quanto manca invece di inventare una percentuale.
     Trovato dall'ispezione del 12/08. */
  const oraRoma = Number(
    new Intl.DateTimeFormat("it-IT", { hour: "numeric", hour12: false, timeZone: "Europe/Rome" })
      .format(new Date()),
  );
  if (oraRoma < 20) return null;
  const oggi = quanto(serie[serie.length - 1]);
  return {
    pct: Math.round(((oggi - media) / media) * 100),
    rispetto: `sulla media dei ${GIORNI} giorni`,
  };
}

export default async function PaginaPanoramica() {
  /* Prima riga, sempre: `proxy.ts` chiede solo di essere collegati, e
     collegato lo è anche un cliente che ha comprato una pratica. */
  await soloAdmin();

  const [c, serie, inAttesa] = await Promise.all([
    leggiCruscotto(8),
    leggiSerie(GIORNI),
    contaInAttesa(),
  ]);

  const q = (n: number | null | undefined) => oNonLetto(n);
  const oggi = c.oggi;
  const settimana = c.settimana;
  const conto = contoPratica();

  /* L'imbuto vive sui sette giorni e non su oggi: alle nove del mattino
     un imbuto di giornata è fatto di due righe e non dice niente. */
  /* 🔴 L'IMBUTO ACCUSAVA IL MURO DI FAR PERDERE TUTTI, E IL MURO ERA
     SPENTO. Col prezzo del check non attivo, "Vedono il muro" e "Pagano
     l'analisi" non possono che essere zero: l'imbuto disegnava due gradini
     a zero con accanto "meno 100%", e poi il gradino dopo tornava a un
     numero maggiore di zero. Un imbuto che si riallarga scendendo è un
     numero impossibile, e fa dubitare di tutti gli altri.
     I due passi adesso compaiono solo quando esistono davvero.
     Trovato dall'ispezione del 12/08. */
  const passi = [
    { nome: "Arrivano sul sito", chiave: "visita" },
    { nome: "Lanciano un'analisi", chiave: "check" },
    ...(CHECK_A_PAGAMENTO
      ? [
          { nome: "Vedono il muro", chiave: "muro" },
          { nome: "Pagano l'analisi", chiave: "sbloccato" },
        ]
      : []),
    { nome: "Aprono la pratica", chiave: "pratica" },
    { nome: "Pagano la pratica", chiave: "pagato" },
  ].map((p) => ({
    nome: p.nome,
    quanti: settimana === null ? null : (settimana[p.chiave as keyof typeof settimana] ?? 0),
  }));

  return (
    <div className="flex flex-col gap-5">
      {!SERVIZIO_ATTIVO && (
        <Avviso titolo="Il pannello non è collegato al database." tono="rosso">
          Manca <code>SUPABASE_SECRET_KEY</code> nell&apos;ambiente: senza, qui non si legge
          niente. Il sito continua a funzionare, ma i numeri di questa schermata non
          esistono. Vedi <Link href="/admin/impostazioni" className="underline">Impostazioni</Link>.
        </Avviso>
      )}
      {/* 🔴 Il tetto della lettura tagliava i numeri IN SILENZIO: sopra
          le 20.000 righe nella settimana i totali si accorciano da soli,
          con la stessa faccia di prima. Un avviso nei log lo leggo io,
          non Valerio: qui lo dice la schermata. */}
      {c.parziale && (
        <Avviso titolo="Questi numeri sono un pezzo, non il totale.">
          Nella settimana ci sono più fatti di quanti se ne leggano in un colpo (il tetto è
          20.000). I conteggi qui sotto contano le righe lette, non tutte: sono un minimo
          garantito, mai un totale.
        </Avviso>
      )}
      {SERVIZIO_ATTIVO && c.ultimi === null && (
        <Avviso titolo="Il registro dei fatti non ha risposto.">
          O la tabella degli eventi non c&apos;è ancora, o il database non si è aperto. Non
          è un guasto del sito: il check funziona, semplicemente questi numeri non si
          vedono. Dove leggi &quot;non letto&quot; è per questo.
        </Avviso>
      )}

      {/* ── I QUATTRO NUMERI, i soldi per primi ───────────────────── */}
      {/* Due per riga già a 390: impilate una per riga erano quattro
          schermate di scorrimento prima del primo grafico. */}
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          forte
          etichetta="Incassato oggi"
          valore={oNonLetto(c.incassoOggi, euro)}
          nota={`In 7 giorni: ${oNonLetto(c.incassoSettimana, euro)}`}
        />
        <Kpi
          etichetta="Analisi lanciate oggi"
          valore={q(oggi?.check)}
          delta={variazione(serie, (g) => g.per.check ?? 0)}
          nota={`In 7 giorni: ${q(settimana?.check)}`}
        />
        <Kpi
          etichetta="Pratiche pagate, 7 giorni"
          valore={q(settimana?.pagato)}
          nota={`Oggi: ${q(oggi?.pagato)}`}
        />
        <Kpi
          etichetta="Verdetti da guardare"
          valore={oNonLetto(inAttesa)}
          nota={
            inAttesa === null
              ? "Elenco non letto."
              : inAttesa > 0
                ? "Controllo a campione: non stanno bloccando nessun pagamento."
                : "Guardati tutti."
          }
        />
      </div>

      {/* ── IL GRANDE E LO STRETTO, come nel riferimento ──────────── */}
      <div className="grid gap-5 xl:grid-cols-[1.75fr_1fr]">
        <Scheda
          titolo="Il percorso, giorno per giorno"
          sotto={`Gli ultimi ${GIORNI} giorni, a giornate italiane.`}
          destra={
            <Legenda
              voci={[
                { nome: "Visite", classe: "bg-menta" },
                { nome: "Analisi", classe: "bg-verde" },
                { nome: "Pagamenti", classe: "bg-verde-notte" },
              ]}
            />
          }
        >
          {/* Le serie si risolvono QUI in liste di numeri: il grafico è
              interattivo (gira nel browser) e una funzione non attraversa il
              confine server→browser. Vedi GraficoGiorni. */}
          <GraficoGiorni
            giorni={serie ? serie.map((g) => ({ etichetta: g.etichetta, oggi: g.oggi })) : null}
            serie={
              serie
                ? [
                    {
                      nome: "Visite",
                      fill: "fill-menta",
                      punto: "bg-menta",
                      valori: serie.map((g) => g.per.visita ?? 0),
                    },
                    {
                      nome: "Analisi",
                      fill: "fill-verde",
                      punto: "bg-verde",
                      valori: serie.map((g) => g.per.check ?? 0),
                    },
                    {
                      nome: "Pagamenti",
                      fill: "fill-verde-notte",
                      punto: "bg-verde-notte",
                      valori: serie.map((g) => g.per.pagato ?? 0),
                    },
                  ]
                : null
            }
          />
        </Scheda>

        {/* L'IMBUTO: l'unico riquadro che dice cosa fare domani. */}
        <Scheda
          titolo="Dove si ferma la gente"
          sotto="Gli ultimi 7 giorni. Dove il numero crolla, è lì che perdi."
        >
          <Imbuto passi={passi} />
          {c.conversioneMuro !== null && (
            <p className="mt-3 border-t border-bordo pt-3 text-[12.5px] text-fumo">
              Di chi vede il muro, paga il{" "}
              <span className="numeri font-medium text-inchiostro">{c.conversioneMuro}%</span>.
            </p>
          )}
        </Scheda>
      </div>

      {/* ── L'ANDAMENTO A TUTTA LARGHEZZA ─────────────────────────── */}
      <Scheda
        titolo="Quanto lavoro può diventare una vendita"
        sotto="Lo spazio fra le due curve è fatto di analisi che non venderanno mai: il verdetto non è idoneo."
        destra={
          <Legenda
            voci={[
              { nome: "Analisi lanciate", classe: "bg-menta" },
              { nome: "Verdetti idonei", classe: "bg-verde" },
            ]}
          />
        }
      >
        <Area
          giorni={serie}
          serie={[
            {
              nome: "Analisi lanciate",
              riempimento: "fill-menta/45",
              tratto: "stroke-menta",
              valore: (g) => g.per.check ?? 0,
            },
            {
              nome: "Verdetti idonei",
              riempimento: "fill-verde/25",
              tratto: "stroke-verde",
              valore: (g) => g.idonei,
            },
          ]}
        />
      </Scheda>

      {/* ── GLI ULTIMI FATTI ──────────────────────────────────────── */}
      <Scheda
        titolo="In diretta"
        sotto="Gli ultimi fatti registrati, dal più recente."
        destra={
          <Link
            href="/admin/registro"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-bordo px-3 py-1.5 text-[12.5px] font-medium text-fumo transition-colors hover:border-verde/40 hover:text-inchiostro"
          >
            Tutto il registro
            <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        }
      >
        <FattiInDiretta righe={c.ultimi} />
      </Scheda>

      {/* ── I COSTI, CON LA LORO FONTE ────────────────────────────
          Stava nella sezione Economia, tolta il 26/08: qui è la prima
          schermata che apri, accanto agli incassi. */}
      <Scheda
        titolo="I costi, con la loro fonte"
        sotto="Trasparenza, come per i numeri che mostriamo all'utente. Le stime sono marcate."
      >
        <ul className="flex flex-col gap-2 text-[13.5px] text-fumo">
          {Object.values(FISSI_MENSILI).map((f) => (
            <li
              key={f.nota}
              className="flex items-baseline justify-between gap-3 border-b border-bordo/60 pb-2"
            >
              <span>{f.nota}</span>
              <span className="numeri shrink-0 font-medium text-inchiostro">{euro(f.euro)}/mese</span>
            </li>
          ))}
          <li className="flex items-baseline justify-between gap-3 pt-1">
            <span>Stripe per pratica: ~5% + 0,25 € (Managed Payments, carta europea)</span>
            <span className="numeri shrink-0 font-medium text-inchiostro">{euro(conto.cassa)}</span>
          </li>
          <li className="text-[12.5px] text-fumo-2">
            <span className="numeri">*</span> Garanzia al {pct(TASSO_RIMBORSO_GARANZIA)}: stima
            prudente, nessuna pratica ancora chiusa. OCR ~1 $/1000 pagine e AeroDataBox
            0,00025 $/richiesta sono stime di listino.
          </li>
        </ul>
      </Scheda>

      <p className="pb-2 text-[12.5px] leading-relaxed text-fumo-2">
        Nel registro non c&apos;è nessun indirizzo IP e nessuna impronta del browser: sono
        fatti, non persone. Il TIN sul telefono è{" "}
        <span className="font-medium text-inchiostro">
          {TELEGRAM_ATTIVO ? "acceso" : "spento: mancano le due variabili di Telegram"}
        </span>
        . Questa schermata si aggiorna da sola ogni 20 secondi.
      </p>
    </div>
  );
}

/* ── le righe in diretta ─────────────────────────────────────────────
   Stessa forma del Registro, ma corta: qui servono le ultime otto, non
   la storia. Il colore lo prendono solo le due che contano: i soldi che
   entrano e le cose che si rompono. */
const COLORE: Record<string, string> = {
  pagato: "text-verde",
  sbloccato: "text-verde",
  guasto: "text-red-600",
};

function FattiInDiretta({
  righe,
}: {
  righe: { quando: string; tipo: string; testo: string; euro: number | null }[] | null;
}) {
  const ORA = new Intl.DateTimeFormat("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Europe/Rome",
  });

  if (righe === null) {
    return <p className="py-6 text-center text-[13px] text-fumo-2">Non letto.</p>;
  }
  if (righe.length === 0) {
    return (
      <p className="py-6 text-center text-[13px] text-fumo-2">
        Ancora nessun fatto registrato.
      </p>
    );
  }
  return (
    <ul className="-mx-1 divide-y divide-bordo/70">
      {righe.map((r, i) => (
        <li key={`${r.quando}-${i}`} className="flex items-baseline gap-3 px-1 py-2">
          <span className="numeri shrink-0 text-[12px] text-fumo-2">
            {ORA.format(new Date(r.quando))}
          </span>
          <span className={`min-w-0 flex-1 truncate text-[13.5px] ${COLORE[r.tipo] ?? "text-fumo"}`}>
            {r.testo}
          </span>
          {r.euro !== null && (
            <span className="numeri shrink-0 text-[13px] font-medium text-verde">
              {euro(r.euro)}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
