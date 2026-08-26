import { Scheda } from "@/components/admin/Grafici";
import { Avviso, Bollo, Vuoto, euro, type Tono } from "@/components/admin/Pezzi";
import Comandi from "@/components/admin/Comandi";
import ControlloVerdetti from "@/components/admin/ControlloVerdetti";
import { dataIt } from "@/lib/admin/dati";
import { soloAdmin } from "@/lib/admin/guardia";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";

/**
 * LE PRATICHE: chi ha pagato e a che punto è.
 *
 * È la sezione che vale soldi, e per questo mostra due cose che prima non
 * si vedevano da nessuna parte: **quanto è entrato in tutto** e **quante
 * pratiche stanno ferme in ogni stato**. Una pratica ferma su "pronta" da
 * dieci giorni è una lettera che il cliente non ha mandato, ed è il
 * momento in cui si perde una garanzia.
 *
 * Qui sta anche il giro di follow-up, che prima viveva sulla schermata
 * principale: manda le email dovute alle pratiche aperte, quindi è roba
 * di questa sezione e di nessun'altra.
 *
 * ⚠️ SUL TELEFONO NON C'È LA TABELLA. Sei colonne dentro 390 punti si
 * riducevano a una fisarmonica in cui il volo andava a capo quattro volte
 * e lo stato finiva fuori dallo schermo senza che si capisse che si
 * poteva scorrere (visto nel giro visivo). Sotto i 640 ogni pratica
 * diventa una scheda: gli stessi dati, uno sotto l'altro.
 */
export const dynamic = "force-dynamic";

type RigaPratica = {
  id: string;
  stato: string;
  tipo: string;
  email: string;
  importo_fascia: number | null;
  prezzo_pagato: number | null;
  creata_il: string;
  inviata_il: string | null;
  voli: { volo_iata: string; data_locale: string } | null;
};

/** Gli stati, in ordine di percorso: è l'ordine in cui li vive un cliente. */
const STATI: { chiave: string; nome: string; tono: Tono }[] = [
  { chiave: "creata", nome: "creata", tono: "grigio" },
  { chiave: "pagata", nome: "pagata", tono: "verde" },
  { chiave: "pronta", nome: "lettera pronta", tono: "attesa" },
  { chiave: "inviata", nome: "inviata", tono: "grigio" },
  { chiave: "sollecito", nome: "sollecito", tono: "attesa" },
  { chiave: "enac", nome: "ente nazionale", tono: "attesa" },
  { chiave: "esito_pagata", nome: "la compagnia ha pagato", tono: "verde" },
  { chiave: "esito_rifiutata", nome: "rifiutata", tono: "rosso" },
  { chiave: "rimborsata", nome: "rimborsata (garanzia)", tono: "rosso" },
];

const statoDi = (chiave: string) =>
  STATI.find((s) => s.chiave === chiave) ?? { chiave, nome: chiave, tono: "grigio" as Tono };

export default async function PaginaPratiche() {
  /* Prima riga, sempre. Vedi lib/admin/guardia.ts. */
  await soloAdmin();

  let pratiche: RigaPratica[] = [];
  let nonLetto = !SERVIZIO_ATTIVO;
  /** null = non letto. Sono i totali VERI, contati dal database. */
  let quanteInTutto: number | null = null;
  let incassatoInTutto: number | null = null;

  if (SERVIZIO_ATTIVO) {
    /* 🔴 «IN TUTTO» DEVE ESSERE IN TUTTO. Prima i due riquadri qui sotto
       si calcolavano sulle sole 60 righe lette per l'elenco: alla 61esima
       pratica «Pratiche in tutto» sarebbe rimasto a 60 per sempre, e
       l'incasso mostrato sarebbe stato quello delle ultime 60. Peggio:
       essendo ordinate dalla piu' recente, il totale poteva anche
       CALARE, se usciva dalla finestra una pratica famiglia da 29,90 e
       ne entrava una singola da 14,90. Trovato dall'ispezione del 12/08;
       oggi le pratiche sono zero, quindi era un difetto che aspettava.
       Adesso il conteggio e la somma li fa il DATABASE su tutte le
       righe, e l'elenco resta alle ultime 60 perche' e' un elenco. */
    const [{ data, error }, { count: quante, error: erroreConto }, { data: soldi, error: erroreSoldi }] =
      await Promise.all([
        supabaseServizio()
          .from("pratiche")
          .select(
            "id, stato, tipo, email, importo_fascia, prezzo_pagato, creata_il, inviata_il, voli(volo_iata, data_locale)",
          )
          .order("creata_il", { ascending: false })
          .limit(60),
        supabaseServizio().from("pratiche").select("id", { count: "exact", head: true }),
        /* 🔴 QUESTA LETTURA NON AVEVA UN TETTO SCRITTO, quindi ce l'aveva
           quello del database (mille righe di serie). Oltre quel numero la
           somma smetteva di crescere senza dirlo: "Incassato in tutto"
           sarebbe rimasto fermo mentre gli incassi salivano.
           Il tetto adesso è scritto, e se lo si tocca ci si accorge.
           ⚠️ La somma vera la farebbe il database, ma PostgREST non
           espone un `sum()` senza una funzione dedicata: si legge la
           colonna e si somma qui, dichiarando il limite.
           Trovato dall'ispezione del 12/08. */
        supabaseServizio()
          .from("pratiche")
          .select("prezzo_pagato")
          .not("prezzo_pagato", "is", null)
          .order("creata_il", { ascending: false })
          .limit(50_000),
      ]);
    for (const e of [error, erroreConto, erroreSoldi]) {
      if (e) console.error("[pannello] pratiche non lette:", e.message);
    }
    quanteInTutto = erroreConto ? null : (quante ?? 0);
    incassatoInTutto = erroreSoldi
      ? null
      : ((soldi ?? []) as { prezzo_pagato: number | null }[]).reduce(
          (t, r) => t + Number(r.prezzo_pagato ?? 0),
          0,
        );
    /* `nonLetto` distingue "non ci sono pratiche" da "non sono riuscito a
       guardare": senza, una pagina di errore direbbe zero pratiche, che è
       la cosa peggiore che possa leggere chi aspetta il primo cliente. */
    nonLetto = Boolean(error);
    pratiche = (data ?? []) as unknown as RigaPratica[];
  }

  /* ⚠️ QUESTI BOLLINI CONTANO LE RIGHE LETTE, NON TUTTE LE PRATICHE, e
     stavano accanto a un totale che invece è vero: due numeri con la
     stessa faccia e due significati diversi. Adesso il titolo lo dice.
     Trovato dall'ispezione del 12/08. */
  const perStato = STATI.map((s) => ({
    ...s,
    quante: pratiche.filter((p) => p.stato === s.chiave).length,
  })).filter((s) => s.quante > 0);

  return (
    <div className="flex flex-col gap-5">
      {!SERVIZIO_ATTIVO ? (
        <Avviso titolo="Senza chiave del database le pratiche non si leggono." tono="rosso">
          Manca <code>SUPABASE_SECRET_KEY</code> nell&apos;ambiente. La schermata resta come la
          vedi, con i numeri marcati &quot;non letto&quot;.
        </Avviso>
      ) : (
        nonLetto && (
          <Avviso titolo="Le pratiche non si sono lette." tono="rosso">
            Il database non ha risposto. Quello che vedi qui sotto non è &quot;nessuna
            pratica&quot;: è &quot;non lo so&quot;.
          </Avviso>
        )
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Riquadro
          etichetta="Pratiche in tutto"
          valore={quanteInTutto === null ? "non letto" : String(quanteInTutto)}
        />
        <Riquadro
          etichetta="Incassato in tutto"
          valore={incassatoInTutto === null ? "non letto" : euro(incassatoInTutto)}
          verde
          nota="Somma di quanto è stato pagato davvero, su tutte le pratiche."
        />
        <div className="rounded-[14px] border border-bordo bg-white p-4 shadow-[0_1px_2px_rgba(5,46,31,0.04)] sm:p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-fumo-2">
            A che punto sono {pratiche.length > 0 ? `(ultime ${pratiche.length})` : ""}
          </p>
          {perStato.length === 0 ? (
            <p className="mt-2.5 text-[13px] text-fumo-2">
              {nonLetto ? "Non letto." : "Nessuna pratica aperta."}
            </p>
          ) : (
            <ul className="mt-2.5 flex flex-wrap gap-1.5">
              {perStato.map((s) => (
                <li key={s.chiave}>
                  <Bollo tono={s.tono}>
                    {s.quante} {s.nome}
                  </Bollo>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <Scheda titolo="Le pratiche" sotto="Dalla più recente. Le ultime 60.">
        {pratiche.length === 0 ? (
          <Vuoto
            titolo={nonLetto ? "Non letto." : "Nessuna pratica, ancora."}
            spiega={
              nonLetto
                ? undefined
                : "Le pratiche nascono dal pagamento: le crea il webhook del venditore quando il cliente paga. La prima comparirà qui da sola."
            }
          />
        ) : (
          <>
            {/* Da 640 in su: la tabella. */}
            <div className="-mx-4 hidden overflow-x-auto sm:-mx-5 sm:block">
              <table className="w-full min-w-[640px] text-[13.5px]">
                <thead>
                  <tr className="border-b border-bordo text-left text-[11px] uppercase tracking-[0.1em] text-fumo-2">
                    <th className="px-4 py-2 font-medium sm:px-5">Volo</th>
                    <th className="px-4 py-2 font-medium">Cliente</th>
                    <th className="px-4 py-2 text-right font-medium">Fascia</th>
                    <th className="px-4 py-2 text-right font-medium">Pagato</th>
                    <th className="px-4 py-2 font-medium">Aperta</th>
                    <th className="px-4 py-2 pr-4 font-medium sm:pr-5">Stato</th>
                  </tr>
                </thead>
                <tbody>
                  {pratiche.map((p) => {
                    const s = statoDi(p.stato);
                    return (
                      <tr key={p.id} className="border-b border-bordo/60 last:border-0">
                        <td className="whitespace-nowrap px-4 py-2.5 sm:px-5">
                          <span className="font-medium">{p.voli?.volo_iata ?? "?"}</span>
                          <span className="text-fumo">
                            {p.voli ? ` · ${dataIt(p.voli.data_locale)}` : ""}
                          </span>
                          <span className="block text-[12px] text-fumo-2">
                            {p.tipo === "famiglia" ? "famiglia" : "singola"}
                          </span>
                        </td>
                        <td
                          className="max-w-[180px] truncate px-4 py-2.5 text-fumo"
                          title={p.email}
                        >
                          {p.email}
                        </td>
                        <td className="numeri px-4 py-2.5 text-right">
                          {p.importo_fascia !== null ? `${p.importo_fascia}€` : "?"}
                        </td>
                        <td className="numeri px-4 py-2.5 text-right font-medium text-verde">
                          {p.prezzo_pagato !== null ? euro(Number(p.prezzo_pagato)) : "-"}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-fumo">
                          {dataIt(p.creata_il)}
                          {p.inviata_il && (
                            <span className="block text-[12px] text-fumo-2">
                              inviata il {dataIt(p.inviata_il)}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 pr-4 sm:pr-5">
                          <Bollo tono={s.tono}>{s.nome}</Bollo>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Sotto i 640: una scheda per pratica. */}
            <ul className="flex flex-col gap-2.5 sm:hidden">
              {pratiche.map((p) => {
                const s = statoDi(p.stato);
                return (
                  <li key={p.id} className="rounded-[12px] border border-bordo bg-nebbia/50 p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 text-[14px] font-medium">
                        {p.voli?.volo_iata ?? "?"}
                        <span className="font-normal text-fumo">
                          {p.voli ? ` · ${dataIt(p.voli.data_locale)}` : ""}
                        </span>
                      </p>
                      <Bollo tono={s.tono}>{s.nome}</Bollo>
                    </div>
                    <p className="mt-1 truncate text-[13px] text-fumo">{p.email}</p>
                    <p className="mt-2 text-[13px] text-fumo">
                      fascia{" "}
                      <span className="numeri font-medium text-inchiostro">
                        {p.importo_fascia !== null ? `${p.importo_fascia}€` : "?"}
                      </span>{" "}
                      · pagata{" "}
                      <span className="numeri font-medium text-verde">
                        {p.prezzo_pagato !== null ? euro(Number(p.prezzo_pagato)) : "-"}
                      </span>
                    </p>
                    <p className="mt-1 text-[12px] text-fumo-2">
                      {p.tipo === "famiglia" ? "famiglia" : "singola"} · aperta il{" "}
                      {dataIt(p.creata_il)}
                      {p.inviata_il ? ` · inviata il ${dataIt(p.inviata_il)}` : ""}
                    </p>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Scheda>

      <Comandi />

      {/* ── VERDETTI: mezza sezione dentro Pratiche (Valerio, 26/08: le
          due sezioni fuse). Il controllo a campione che il motore dica la
          verità, e non blocca nessun pagamento. ── */}
      <div className="mt-2 border-t border-bordo pt-6">
        <h2 className="font-display text-[1.3rem] tracking-[-0.02em] text-inchiostro">
          Verdetti, il controllo a campione
        </h2>
        <p className="mb-4 mt-1 text-[13px] leading-relaxed text-fumo">
          Gli ultimi idonei, dal più recente. È una spunta a campione sul motore: nessuna di
          queste righe sta bloccando un incasso.
        </p>
        <ControlloVerdetti />
      </div>
    </div>
  );
}

/** Un numero secco in una card, senza confronti: qui non ce ne sono di veri. */
function Riquadro({
  etichetta,
  valore,
  nota,
  verde = false,
}: {
  etichetta: string;
  valore: string;
  nota?: string;
  verde?: boolean;
}) {
  return (
    <div className="rounded-[14px] border border-bordo bg-white p-4 shadow-[0_1px_2px_rgba(5,46,31,0.04)] sm:p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-fumo-2">{etichetta}</p>
      <p
        className={`numeri mt-2.5 font-display leading-none tracking-[-0.04em] ${
          valore === "non letto" ? "text-[19px] text-fumo-2" : "text-[28px] sm:text-[31px]"
        } ${verde && valore !== "non letto" ? "text-verde" : ""}`}
      >
        {valore}
      </p>
      {nota && <p className="mt-3 text-[12px] text-fumo-2">{nota}</p>}
    </div>
  );
}
