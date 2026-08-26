"use client";

import { useMemo, useState } from "react";
import { euro } from "@/components/admin/Pezzi";
import { dataIt } from "@/lib/admin/dati";
import { GRUPPI, statoPratica, type GruppoPratica } from "@/lib/pratiche/statiPannello";

/**
 * L'ELENCO DELLE PRATICHE, chiaro e filtrabile (giro #96, scelta di Valerio:
 * "di chi è la palla"). Ogni pratica dice a colpo d'occhio se la lettera è da
 * mandare, se si aspetta la compagnia, se è vinta o chiusa. Si filtra per
 * gruppo e si ordina. È la sezione dove Valerio vive: deve capirsi in tre
 * secondi.
 */

export type RigaPratica = {
  id: string;
  stato: string;
  tipo: string;
  email: string;
  importo_fascia: number | null;
  prezzo_pagato: number | null;
  creata_il: string;
  inviata_il: string | null;
  volo: { volo_iata: string; data_locale: string } | null;
};

/** Il vestito di ogni gruppo: colore del pallino e della pillola. */
const STILE: Record<GruppoPratica, { pallino: string; pillola: string }> = {
  dafare: { pallino: "bg-sole", pillola: "bg-sole/15 text-inchiostro border-sole/40" },
  attesa: { pallino: "bg-fumo-2", pillola: "bg-nebbia text-fumo border-bordo" },
  vinta: { pallino: "bg-verde", pillola: "bg-menta-tenue text-verde-scuro border-verde/30" },
  persa: { pallino: "bg-red-400", pillola: "bg-red-50 text-red-700 border-red-200" },
};

type Filtro = "tutte" | GruppoPratica;
type Ordine = "recente" | "fascia";

function Palla({ gruppo }: { gruppo: GruppoPratica }) {
  const g = GRUPPI.find((x) => x.chiave === gruppo)!;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-pillola border px-2.5 py-1 text-[11.5px] font-medium ${STILE[gruppo].pillola}`}
    >
      <span className={`size-1.5 rounded-full ${STILE[gruppo].pallino}`} />
      {g.palla}
    </span>
  );
}

export default function ElencoPratiche({ pratiche }: { pratiche: RigaPratica[] }) {
  const [filtro, setFiltro] = useState<Filtro>("tutte");
  const [ordine, setOrdine] = useState<Ordine>("recente");

  const conGruppo = useMemo(
    () => pratiche.map((p) => ({ ...p, s: statoPratica(p.stato) })),
    [pratiche],
  );

  const conti = useMemo(() => {
    const c: Record<Filtro, number> = { tutte: conGruppo.length, dafare: 0, attesa: 0, vinta: 0, persa: 0 };
    for (const p of conGruppo) c[p.s.gruppo] += 1;
    return c;
  }, [conGruppo]);

  const mostrate = useMemo(() => {
    const arr = conGruppo.filter((p) => filtro === "tutte" || p.s.gruppo === filtro);
    if (ordine === "fascia") {
      arr.sort((a, b) => (b.importo_fascia ?? 0) - (a.importo_fascia ?? 0));
    } else {
      arr.sort((a, b) => (a.creata_il < b.creata_il ? 1 : -1));
    }
    return arr;
  }, [conGruppo, filtro, ordine]);

  const CHIP: { chiave: Filtro; nome: string }[] = [
    { chiave: "tutte", nome: "Tutte" },
    ...GRUPPI.map((g) => ({ chiave: g.chiave as Filtro, nome: g.nome })),
  ];

  return (
    <div>
      {/* filtri + ordinamento */}
      <div className="flex flex-wrap items-center gap-2">
        {CHIP.map((c) => (
          <button
            key={c.chiave}
            type="button"
            onClick={() => setFiltro(c.chiave)}
            className={`inline-flex items-center gap-1.5 rounded-pillola border px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
              filtro === c.chiave
                ? "border-verde bg-menta-tenue text-verde-scuro"
                : "border-bordo bg-white text-fumo hover:border-fumo-2"
            }`}
          >
            {c.nome}
            <span className={`numeri ${filtro === c.chiave ? "text-verde-scuro" : "text-fumo-2"}`}>
              {conti[c.chiave]}
            </span>
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 text-[12px] text-fumo-2">
          <span>Ordina</span>
          <button
            type="button"
            onClick={() => setOrdine("recente")}
            className={`rounded-[8px] px-2 py-1 font-medium ${ordine === "recente" ? "bg-nebbia text-inchiostro" : "text-fumo hover:text-inchiostro"}`}
          >
            recenti
          </button>
          <button
            type="button"
            onClick={() => setOrdine("fascia")}
            className={`rounded-[8px] px-2 py-1 font-medium ${ordine === "fascia" ? "bg-nebbia text-inchiostro" : "text-fumo hover:text-inchiostro"}`}
          >
            fascia
          </button>
        </div>
      </div>

      {mostrate.length === 0 ? (
        <div className="mt-4 rounded-[12px] border border-dashed border-bordo bg-nebbia/60 px-5 py-8 text-center text-[13px] text-fumo-2">
          Nessuna pratica in questo gruppo.
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2.5">
          {mostrate.map((p) => (
            <li
              key={p.id}
              className="rounded-[14px] border border-bordo bg-white p-4 transition-colors hover:border-verde/30"
            >
              {/* riga 1: palla + volo + stato */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <Palla gruppo={p.s.gruppo} />
                  <span className="min-w-0 truncate">
                    <span className="font-semibold text-inchiostro">{p.volo?.volo_iata ?? "?"}</span>
                    {p.volo && <span className="text-fumo"> · {dataIt(p.volo.data_locale)}</span>}
                    <span className="ml-2 rounded-pillola bg-nebbia px-2 py-0.5 text-[11px] text-fumo-2">
                      {p.tipo === "famiglia" ? "famiglia" : "singola"}
                    </span>
                  </span>
                </div>
                <span className="text-[12.5px] text-fumo">{p.s.nome}</span>
              </div>

              {/* riga 2: cliente + soldi + date */}
              <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-1 border-t border-bordo/60 pt-2.5 text-[13px]">
                <span className="min-w-0 max-w-[260px] truncate text-fumo" title={p.email}>
                  {p.email}
                </span>
                <span className="text-fumo">
                  fascia{" "}
                  <b className="numeri text-inchiostro">
                    {p.importo_fascia !== null ? `${p.importo_fascia}€` : "?"}
                  </b>
                </span>
                <span className="text-fumo">
                  pagato{" "}
                  <b className="numeri text-verde">
                    {p.prezzo_pagato !== null ? euro(Number(p.prezzo_pagato)) : "-"}
                  </b>
                </span>
                <span className="ml-auto text-[12px] text-fumo-2">
                  aperta {dataIt(p.creata_il)}
                  {p.inviata_il ? ` · inviata ${dataIt(p.inviata_il)}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
