import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { bonusiDi, prossimiBonus, PREZZO_SINGOLA, PREZZO_FAMIGLIA } from "./modello";

/**
 * LE LETTURE PER IL PANNELLO: ogni creator coi suoi numeri veri, dal
 * database. Solo server (chiave di servizio).
 *
 * ⚠️ DEGRADA DA SOLO se la migrazione del 26/08 non è ancora applicata: le
 * colonne nuove (accordo, bonus, clic, variante) non ci sono, si legge il
 * minimo. Un pannello a metà è meglio di un pannello rotto.
 */

const SOGLIA_VARIANTE = (PREZZO_SINGOLA + PREZZO_FAMIGLIA) / 2;
const arrotonda = (n: number) => Math.round(n * 100) / 100;

/* Le due letture si riassegnano col ripiego (meno colonne): un tipo lasco
   tiene insieme la lettura piena e quella minima senza litigare coi tipi. */
type Risp<T> = { data: T[] | null; error: { message: string } | null };

export type CreatorPieno = {
  id: string;
  codice: string;
  nome: string;
  attivo: boolean;
  creato_il: string;
  sconto_percento: number;
  commissione_percento: number;
  tipo_accordo: "performance" | "ibrido";
  seguito: number | null;
  click: number;
  nCheck: number;
  nSingola: number;
  nFamiglia: number;
  baseMaturato: number;
  baseDaPagare: number;
  bonus: { singola: number; famiglia: number; check: number; totale: number };
  bonusPagato: number;
  bonusDaPagare: number;
  bonusFisso: number;
  fissoPagatoIl: string | null;
  fissoDaPagare: number;
  daPagareTotale: number;
  prossimi: ReturnType<typeof prossimiBonus>;
  pagamenti: { quando: string; importo: number }[];
};

type RigaAff = {
  id: string;
  codice: string;
  nome: string;
  sconto_percento: number;
  commissione_percento: number;
  attivo: boolean;
  creato_il: string;
  tipo_accordo?: string | null;
  bonus_fisso?: number | string | null;
  bonus_fisso_pagato_il?: string | null;
  bonus_pagato?: number | string | null;
  seguito?: number | null;
  click?: number | null;
};
type RigaComm = {
  affiliato_id: string;
  tipo: "check" | "pratica";
  variante?: "singola" | "famiglia" | null;
  prezzo_pagato: number | string;
  commissione: number | string;
  pagata_il: string | null;
};

export async function leggiAffiliati(): Promise<CreatorPieno[] | null> {
  if (!SERVIZIO_ATTIVO) return null;
  try {
    const db = supabaseServizio();
    const PIENE =
      "id, codice, nome, sconto_percento, commissione_percento, attivo, creato_il, tipo_accordo, bonus_fisso, bonus_fisso_pagato_il, bonus_pagato, seguito, click";
    const BASE = "id, codice, nome, sconto_percento, commissione_percento, attivo, creato_il";

    let aff: Risp<RigaAff> = await db
      .from("affiliati")
      .select(PIENE)
      .order("creato_il", { ascending: false });
    if (aff.error && /column|colonna|does not exist|schema cache/i.test(aff.error.message)) {
      aff = await db.from("affiliati").select(BASE).order("creato_il", { ascending: false });
    }
    if (aff.error) throw new Error(aff.error.message);

    let commRes: Risp<RigaComm> = await db
      .from("commissioni")
      .select("affiliato_id, tipo, variante, prezzo_pagato, commissione, pagata_il");
    if (commRes.error && /variante|column|schema cache/i.test(commRes.error.message)) {
      commRes = await db
        .from("commissioni")
        .select("affiliato_id, tipo, prezzo_pagato, commissione, pagata_il");
    }
    if (commRes.error) throw new Error(commRes.error.message);

    const righeComm = commRes.data ?? [];

    return (aff.data ?? []).map((a) => {
      const sue = righeComm.filter((r) => r.affiliato_id === a.id);
      let nCheck = 0;
      let nSingola = 0;
      let nFamiglia = 0;
      let baseMaturato = 0;
      let baseDaPagare = 0;
      const saldi = new Map<string, number>();

      for (const r of sue) {
        const imp = Number(r.commissione);
        baseMaturato += imp;
        if (r.pagata_il === null) baseDaPagare += imp;
        else saldi.set(r.pagata_il, (saldi.get(r.pagata_il) ?? 0) + imp);

        if (r.tipo === "check") {
          nCheck += 1;
        } else {
          const fam =
            r.variante === "famiglia" ||
            (r.variante == null && Number(r.prezzo_pagato) >= SOGLIA_VARIANTE);
          if (fam) nFamiglia += 1;
          else nSingola += 1;
        }
      }

      const conteggi = { singola: nSingola, famiglia: nFamiglia, check: nCheck };
      const bonus = bonusiDi(conteggi);
      const bonusPagato = Number(a.bonus_pagato ?? 0);
      const bonusDaPagare = Math.max(0, arrotonda(bonus.totale - bonusPagato));
      const tipoAccordo = a.tipo_accordo === "ibrido" ? "ibrido" : "performance";
      const bonusFisso = Number(a.bonus_fisso ?? 0);
      const fissoPagatoIl = a.bonus_fisso_pagato_il ?? null;
      const fissoDaPagare =
        tipoAccordo === "ibrido" && bonusFisso > 0 && !fissoPagatoIl ? bonusFisso : 0;

      const pagamenti = [...saldi.entries()]
        .map(([quando, importo]) => ({ quando, importo: arrotonda(importo) }))
        .sort((x, y) => (x.quando < y.quando ? 1 : -1));

      return {
        id: a.id,
        codice: a.codice,
        nome: a.nome,
        attivo: a.attivo,
        creato_il: a.creato_il,
        sconto_percento: a.sconto_percento,
        commissione_percento: a.commissione_percento,
        tipo_accordo: tipoAccordo,
        seguito: a.seguito ?? null,
        click: Number(a.click ?? 0),
        nCheck,
        nSingola,
        nFamiglia,
        baseMaturato: arrotonda(baseMaturato),
        baseDaPagare: arrotonda(baseDaPagare),
        bonus,
        bonusPagato,
        bonusDaPagare,
        bonusFisso,
        fissoPagatoIl,
        fissoDaPagare,
        daPagareTotale: arrotonda(baseDaPagare + bonusDaPagare + fissoDaPagare),
        prossimi: prossimiBonus(conteggi),
        pagamenti,
      };
    });
  } catch (e) {
    console.error("[affiliati] lettura pannello fallita:", e);
    return null;
  }
}
