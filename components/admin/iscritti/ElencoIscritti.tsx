"use client";

import { useMemo, useState } from "react";
import { dataIt } from "@/lib/admin/dati";

/**
 * L'ELENCO DEGLI ISCRITTI, chiaro e filtrabile (giro #96).
 *
 * Prima era una tabella piatta. Adesso ogni riga dice a colpo d'occhio se
 * quella persona riceverà le email («confermato»), se è ferma sulla soglia
 * («non ha confermato») o se se n'è andata («uscito»). Si filtra per stato
 * e si cerca per email. Stessa grammatica delle Pratiche: un pannello che
 * si legge sempre allo stesso modo.
 */

export type RigaIscritto = {
  id: string;
  email: string;
  comune: string | null;
  creato_il: string;
  confermato_il: string | null;
  disdetto_il: string | null;
};

type Stato = "confermato" | "attesa" | "uscito";
type Filtro = "tutti" | Stato;

function statoDi(r: RigaIscritto): Stato {
  if (r.disdetto_il) return "uscito";
  if (r.confermato_il) return "confermato";
  return "attesa";
}

const VESTITO: Record<Stato, { nome: string; pallino: string; pillola: string }> = {
  confermato: {
    nome: "riceve le email",
    pallino: "bg-verde",
    pillola: "bg-menta-tenue text-verde-scuro border-verde/30",
  },
  attesa: {
    nome: "non ha confermato",
    pallino: "bg-sole",
    pillola: "bg-sole/15 text-inchiostro border-sole/40",
  },
  uscito: {
    nome: "uscito",
    pallino: "bg-red-400",
    pillola: "bg-red-50 text-red-700 border-red-200",
  },
};

const CHIP: { chiave: Filtro; nome: string }[] = [
  { chiave: "tutti", nome: "Tutti" },
  { chiave: "confermato", nome: "Confermati" },
  { chiave: "attesa", nome: "In attesa" },
  { chiave: "uscito", nome: "Usciti" },
];

export default function ElencoIscritti({ righe }: { righe: RigaIscritto[] }) {
  const [filtro, setFiltro] = useState<Filtro>("tutti");
  const [cerca, setCerca] = useState("");

  const conStato = useMemo(() => righe.map((r) => ({ ...r, s: statoDi(r) })), [righe]);

  const conti = useMemo(() => {
    const c: Record<Filtro, number> = { tutti: conStato.length, confermato: 0, attesa: 0, uscito: 0 };
    for (const r of conStato) c[r.s] += 1;
    return c;
  }, [conStato]);

  const mostrate = useMemo(() => {
    const q = cerca.trim().toLowerCase();
    return conStato.filter(
      (r) =>
        (filtro === "tutti" || r.s === filtro) &&
        (q === "" || r.email.toLowerCase().includes(q) || (r.comune ?? "").toLowerCase().includes(q)),
    );
  }, [conStato, filtro, cerca]);

  return (
    <div>
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
        <input
          type="search"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          placeholder="Cerca email o comune"
          aria-label="Cerca fra gli iscritti"
          className="ml-auto h-9 w-full max-w-[220px] rounded-[10px] border border-bordo bg-white px-3 text-[13px] text-inchiostro outline-none transition-colors placeholder:text-fumo-2 focus:border-verde/45"
        />
      </div>

      {mostrate.length === 0 ? (
        <div className="mt-4 rounded-[12px] border border-dashed border-bordo bg-nebbia/60 px-5 py-8 text-center text-[13px] text-fumo-2">
          Nessun iscritto in questo gruppo.
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-2">
          {mostrate.map((r) => (
            <li
              key={r.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-[12px] border border-bordo bg-white px-4 py-3 transition-colors hover:border-verde/30"
            >
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-pillola border px-2.5 py-1 text-[11.5px] font-medium ${VESTITO[r.s].pillola}`}
              >
                <span className={`size-1.5 rounded-full ${VESTITO[r.s].pallino}`} />
                {VESTITO[r.s].nome}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-inchiostro" title={r.email}>
                {r.email}
              </span>
              <span className="text-[12.5px] text-fumo">{r.comune ?? "—"}</span>
              <span className="text-[12px] text-fumo-2">
                iscritto {dataIt(r.creato_il)}
                {r.disdetto_il ? ` · uscito ${dataIt(r.disdetto_il)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
