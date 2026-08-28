import { Scheda } from "@/components/admin/Grafici";
import { Avviso, Vuoto, euro } from "@/components/admin/Pezzi";
import Comandi from "@/components/admin/Comandi";
import ElencoPratiche, { type RigaPratica } from "@/components/admin/pratiche/ElencoPratiche";
import { soloAdmin } from "@/lib/admin/guardia";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { GRUPPO_DI, type GruppoPratica } from "@/lib/pratiche/statiPannello";

/**
 * LE PRATICHE: chi ha pagato e a che punto è (rifatta il 26/08, giro #96).
 *
 * È la sezione dove Valerio vive. Prima gli stati erano parole nostre
 * ("sollecito", "esito_pagata") e i conteggi comparivano come bollini
 * grezzi ("4 pagata") senza dire cosa volessero. Adesso ogni pratica dice a
 * colpo d'occhio DI CHI È LA PALLA: la lettera è da mandare, si aspetta la
 * compagnia, è vinta, o è chiusa. Si filtra e si ordina.
 *
 * ⚠️ I NUMERI IN CIMA SONO VERI, contati dal database su TUTTE le pratiche,
 * non sulle 60 lette per l'elenco. Sotto, l'elenco resta alle ultime 60
 * perché è un elenco.
 *
 * In fondo resta il controllo a campione dei verdetti (le due sezioni fuse
 * il 26/08).
 */
export const dynamic = "force-dynamic";

export default async function PaginaPratiche() {
  /* Prima riga, sempre. Vedi lib/admin/guardia.ts. */
  await soloAdmin();

  let pratiche: RigaPratica[] = [];
  let nonLetto = !SERVIZIO_ATTIVO;
  let quanteInTutto: number | null = null;
  let incassatoInTutto: number | null = null;
  let conti: Record<GruppoPratica, number> | null = null;

  if (SERVIZIO_ATTIVO) {
    const db = supabaseServizio();
    const [{ data, error }, { count: quante, error: eConto }, { data: tutte, error: eTutte }] =
      await Promise.all([
        db
          .from("pratiche")
          .select(
            "id, stato, tipo, email, importo_fascia, prezzo_pagato, creata_il, inviata_il, voli(volo_iata, data_locale)",
          )
          .order("creata_il", { ascending: false })
          .limit(60),
        db.from("pratiche").select("id", { count: "exact", head: true }),
        /* Una lettura di due sole colonne, per i numeri veri: la somma degli
           incassi e quante pratiche stanno in ogni gruppo. Il tetto è scritto:
           se lo si tocca ci si accorge, invece di veder fermare i totali in
           silenzio (era un difetto trovato il 12/08). */
        db.from("pratiche").select("prezzo_pagato, stato").limit(50_000),
      ]);
    for (const e of [error, eConto, eTutte]) {
      if (e) console.error("[pannello] pratiche non lette:", e.message);
    }
    quanteInTutto = eConto ? null : (quante ?? 0);
    if (eTutte) {
      incassatoInTutto = null;
      conti = null;
    } else {
      const righe = (tutte ?? []) as { prezzo_pagato: number | null; stato: string }[];
      incassatoInTutto = righe.reduce((t, r) => t + Number(r.prezzo_pagato ?? 0), 0);
      const c: Record<GruppoPratica, number> = { dafare: 0, attesa: 0, vinta: 0, persa: 0 };
      for (const r of righe) {
        const g = GRUPPO_DI[r.stato];
        if (g) c[g] += 1;
      }
      conti = c;
    }
    nonLetto = Boolean(error);
    pratiche = ((data ?? []) as unknown as (Omit<RigaPratica, "volo"> & {
      voli: RigaPratica["volo"];
    })[]).map((p) => ({ ...p, volo: p.voli }));
  }

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

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Riquadro
          etichetta="Pratiche in tutto"
          valore={quanteInTutto === null ? "non letto" : String(quanteInTutto)}
        />
        <Riquadro
          etichetta="Incassato in tutto"
          valore={incassatoInTutto === null ? "non letto" : euro(incassatoInTutto)}
          tono="verde"
          nota="Pagato davvero, su tutte le pratiche."
        />
        <Riquadro
          etichetta="Lettere da mandare"
          valore={conti === null ? "non letto" : String(conti.dafare)}
          tono="sole"
          nota="Tocca al cliente: la lettera non è ancora partita."
        />
        <Riquadro
          etichetta="Vinte"
          valore={conti === null ? "non letto" : String(conti.vinta)}
          tono="verde"
          nota="La compagnia ha pagato il passeggero."
        />
      </div>

      <Scheda
        titolo="Le pratiche"
        sotto="Le ultime 60, dalla più recente. Filtra per di chi è la palla."
      >
        {pratiche.length === 0 ? (
          <Vuoto
            titolo={nonLetto ? "Non letto." : "Nessuna pratica, ancora."}
            spiega={
              nonLetto
                ? undefined
                : "Le pratiche nascono dal pagamento: le crea il webhook di Stripe quando il cliente paga. La prima comparirà qui da sola."
            }
          />
        ) : (
          <ElencoPratiche pratiche={pratiche} />
        )}
      </Scheda>

      <Comandi />
    </div>
  );
}

/** Un numero secco in una card, con un accento di colore quando serve. */
function Riquadro({
  etichetta,
  valore,
  nota,
  tono,
}: {
  etichetta: string;
  valore: string;
  nota?: string;
  tono?: "verde" | "sole";
}) {
  const nonLetto = valore === "non letto";
  const colore = nonLetto ? "text-fumo-2" : tono === "verde" ? "text-verde" : tono === "sole" ? "text-inchiostro" : "text-inchiostro";
  return (
    <div className="rounded-[14px] border border-bordo bg-white p-4 shadow-[0_1px_2px_rgba(5,46,31,0.04)] sm:p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-fumo-2">{etichetta}</p>
      <p
        className={`numeri mt-2.5 font-display leading-none tracking-[-0.04em] ${
          nonLetto ? "text-[19px]" : "text-[26px] sm:text-[30px]"
        } ${colore}`}
      >
        {valore}
      </p>
      {nota && <p className="mt-3 text-[12px] leading-relaxed text-fumo-2">{nota}</p>}
    </div>
  );
}
