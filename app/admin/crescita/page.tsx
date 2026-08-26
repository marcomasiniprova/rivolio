import { Area, BarreOrizzontali, Legenda, Scheda } from "@/components/admin/Grafici";
import { Avviso, Kpi, oNonLetto } from "@/components/admin/Pezzi";
import { soloAdmin } from "@/lib/admin/guardia";
import { leggiCruscotto, leggiSerie } from "@/lib/eventi/lettura";
import { leggiPassaparola } from "@/lib/eventi/passaparola";

/**
 * CRESCITA: da dove arriva la gente, e il passaparola che la moltiplica.
 *
 * Fusione di Traffico e Passaparola (Valerio, 26/08: «la sezione traffico
 * mi sembra un po' inutile, integrala in un'altra; il passaparola fa
 * schifo, rifallo»). Non erano due sezioni diverse: erano due metà della
 * stessa domanda, «come cresce Rivolio». Il traffico dice quanti arrivano
 * e da dove; il passaparola dice quanti ne portano altri. Insieme si
 * leggono, separati no.
 *
 * ⚠️ LA PROVENIENZA È SOLO IL DOMINIO. `tiktok.com`, mai il link del
 * singolo video: quello direbbe cosa ha guardato quella persona, e a noi
 * non serve. Il paese arriva già da Netlify, non lo calcoliamo da un IP.
 *
 * ⚠️ Un numero che non si legge è «non letto», mai zero: uno zero inventato
 * qui direbbe «non è venuto nessuno» o «nessuno passa parola» quando magari
 * il database ha solo avuto un singhiozzo.
 */
export const dynamic = "force-dynamic";

const GIORNI = 14;
const GIORNI_PASSAPAROLA = 30;

/** Il codice a due lettere di Netlify, detto in italiano. */
const PAESI = new Intl.DisplayNames(["it"], { type: "region" });
const nomePaese = (codice: string) => {
  try {
    return PAESI.of(codice) ?? codice;
  } catch {
    /* Un codice che non è un paese (uno sbaglio, una sigla ritirata) resta
       com'è: meglio due lettere strane che un nome inventato. */
    return codice;
  }
};

export default async function PaginaCrescita() {
  /* Prima riga, sempre. Vedi lib/admin/guardia.ts. */
  await soloAdmin();

  const [c, serie, p] = await Promise.all([
    leggiCruscotto(0),
    leggiSerie(GIORNI),
    leggiPassaparola(GIORNI_PASSAPAROLA),
  ]);

  const visiteSettimana = c.settimana?.visita ?? null;
  const checkSettimana = c.settimana?.check ?? null;
  /* Quanti, fra chi arriva, provano davvero: dice se il sito convince o se
     la gente rimbalza. Solo con un denominatore vero. */
  const provano =
    visiteSettimana !== null && checkSettimana !== null && visiteSettimana > 0
      ? Math.round((checkSettimana / visiteSettimana) * 1000) / 10
      : null;

  /* Il coefficiente misurabile ADESSO (senza cassa): quanti inviti
     diventano un arrivo. Mai una divisione per zero travestita da %. */
  const tassoInvito =
    p.invitiCondivisi !== null && p.amiciArrivati !== null && p.invitiCondivisi > 0
      ? Math.round((p.amiciArrivati / p.invitiCondivisi) * 100)
      : null;

  const recTot = p.recensioni ? p.recensioni.totali : null;
  const recAppr = p.recensioni ? p.recensioni.approvate : null;

  const registroMuto = c.provenienze === null;

  return (
    <div className="flex flex-col gap-6">
      {registroMuto && (
        <Avviso titolo="Il registro non ha risposto.">
          I numeri di questa schermata vengono dal registro degli eventi: finché non si apre, qui
          trovi &quot;non letto&quot; invece di zero.
        </Avviso>
      )}

      {/* ── I quattro numeri della crescita ─────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          etichetta="Visite · 7 giorni"
          valore={oNonLetto(visiteSettimana)}
          nota={`Oggi: ${oNonLetto(c.oggi?.visita)}`}
        />
        <Kpi
          etichetta="Analisi · 7 giorni"
          valore={oNonLetto(checkSettimana)}
          nota={`Oggi: ${oNonLetto(c.oggi?.check)}`}
        />
        <Kpi
          etichetta="Provano, su chi arriva"
          valore={provano === null ? "non letto" : `${provano}%`}
          nota={
            provano === null
              ? "Serve almeno una visita registrata per il conto."
              : "Analisi su visite, ultimi 7 giorni."
          }
        />
        <Kpi
          etichetta={`Amici arrivati · ${GIORNI_PASSAPAROLA}g`}
          valore={oNonLetto(p.amiciArrivati)}
          nota="Visite dal link dell'invito. È il numero che conta."
          forte
        />
      </div>

      {/* ── Il grafico della crescita ───────────────────────────────── */}
      <Scheda
        titolo="Visite e analisi, giorno per giorno"
        sotto={`Gli ultimi ${GIORNI} giorni. La riga tratteggiata è oggi.`}
        destra={
          <Legenda
            voci={[
              { nome: "Visite", classe: "bg-menta" },
              { nome: "Analisi", classe: "bg-verde" },
            ]}
          />
        }
      >
        <Area
          giorni={serie}
          serie={[
            {
              nome: "Visite",
              riempimento: "fill-menta/45",
              tratto: "stroke-menta",
              valore: (g) => g.per.visita ?? 0,
            },
            {
              nome: "Analisi",
              riempimento: "fill-verde/25",
              tratto: "stroke-verde",
              valore: (g) => g.per.check ?? 0,
            },
          ]}
        />
      </Scheda>

      {/* ── Da dove arrivano ────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-2">
        <Scheda
          titolo="Da dove arrivano"
          sotto="Il sito che li ha mandati, ultimi 7 giorni. Solo il dominio, mai il link intero."
        >
          <BarreOrizzontali
            righe={c.provenienze}
            vuotoTesto="Nessuna provenienza registrata: finora sono arrivati tutti scrivendo l'indirizzo, oppure il registro è appena partito."
          />
        </Scheda>

        <Scheda titolo="Da che paese" sotto="Come lo dichiara Netlify. Nessun calcolo nostro.">
          <BarreOrizzontali
            righe={c.paesi === null ? null : c.paesi.map((x) => ({ ...x, nome: nomePaese(x.nome) }))}
            vuotoTesto="Nessun paese registrato ancora."
          />
        </Scheda>
      </div>

      <Scheda
        titolo="Ti manda l'AI?"
        sotto="Quante persone arrivano da ChatGPT, Perplexity e simili, ultimi 7 giorni. È il numero che dice se le pagine scritte per farsi citare stanno funzionando."
      >
        <BarreOrizzontali
          righe={c.aiMotori}
          vuotoTesto="Ancora nessuno arriva da un motore AI, o il registro è appena partito. Ci vogliono settimane perché i motori indicizzino le pagine nuove."
        />
      </Scheda>

      {/* ── IL PASSAPAROLA ──────────────────────────────────────────── */}
      <div className="border-t border-bordo pt-6">
        <h2 className="font-display text-[1.3rem] tracking-[-0.02em] text-inchiostro">
          Il passaparola
        </h2>
        <p className="mb-4 mt-1 text-[13px] leading-relaxed text-fumo">
          Su un prodotto che si compra una volta sola, a far crescere non è il riacquisto: è chi
          porta un amico. Qui i numeri che dicono se gira.
        </p>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Kpi
            etichetta={`Inviti mandati · ${GIORNI_PASSAPAROLA}g`}
            valore={oNonLetto(p.invitiCondivisi)}
            nota="Quante volte è stato premuto «invita un amico»."
          />
          <Kpi
            etichetta="Da invito, funziona?"
            valore={tassoInvito === null ? "non letto" : `${tassoInvito}%`}
            nota={
              tassoInvito === null
                ? "Appena qualcuno invita e un amico arriva, qui compare."
                : "Ogni 100 inviti, quanti hanno portato un amico sul sito."
            }
          />
          <Kpi etichetta="Recensioni" valore={oNonLetto(recTot)} nota="In tutto, da sempre." />
          <Kpi
            etichetta="Recensioni approvate"
            valore={oNonLetto(recAppr)}
            nota="Quelle che compaiono in landing."
          />
        </div>

        {/* Cosa aspetta la cassa, detto chiaro invece di mostrare zeri finti. */}
        <div className="mt-4 rounded-[14px] border border-dashed border-bordo bg-nebbia/60 p-4 sm:p-5">
          <p className="text-[13.5px] font-medium text-fumo">Con la cassa accesa si aggiungono:</p>
          <ul className="mt-2.5 flex flex-col gap-2 text-[13.5px] leading-relaxed text-fumo-2">
            <li className="flex gap-2">
              <span aria-hidden="true">·</span>
              <span>
                <strong className="text-fumo">Ricavi e LTV</strong>: quanto vale nel tempo un
                cliente. Senza incassi sarebbero zeri inventati.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true">·</span>
              <span>
                <strong className="text-fumo">La riattivazione</strong>: i due recuperi via email
                (chi controlla e non compra, e il no non replicato) partono con RECUPERO_ATTIVO.
              </span>
            </li>
            <li className="flex gap-2">
              <span aria-hidden="true">·</span>
              <span>
                <strong className="text-fumo">Il coefficiente vero</strong>: clienti nuovi per
                cliente, non solo visite. Serve sapere chi paga.
              </span>
            </li>
          </ul>
        </div>
      </div>

      <p className="pb-2 text-[12.5px] leading-relaxed text-fumo-2">
        Qui non si può sapere se una persona è tornata due volte, ed è voluto: il registro raccoglie
        fatti, non persone. Niente indirizzo IP, niente impronta del browser, nessun modo di
        riconoscere qualcuno domani.
      </p>
    </div>
  );
}
