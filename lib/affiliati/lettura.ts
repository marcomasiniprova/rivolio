import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import {
  bonusiDi,
  prossimiBonus,
  progressoBonus,
  BONUS,
  GIORNI_PAGAMENTO,
  PREZZO_SINGOLA,
  PREZZO_FAMIGLIA,
} from "./modello";

/**
 * LE LETTURE PER IL PANNELLO: ogni creator coi suoi numeri veri, dal
 * database. Solo server (chiave di servizio).
 *
 * ⚠️ DEGRADA DA SOLO se la migrazione del 26/08 non è ancora applicata: le
 * colonne nuove non ci sono, si legge il minimo. Un pannello a metà è meglio
 * di un pannello rotto.
 */

const SOGLIA_VARIANTE = (PREZZO_SINGOLA + PREZZO_FAMIGLIA) / 2;
const GIORNI_ATTIVO = 7;
const arrotonda = (n: number) => Math.round(n * 100) / 100;

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
  token: string | null;
  ultimoClic: string | null;
  /** L'ultimo segnale di vita: clic o vendita, il più recente. */
  ultimoMovimento: string | null;
  /** Attivo = un movimento negli ultimi 7 giorni. */
  attivoDiRecente: boolean;
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
  token?: string | null;
  ultimo_clic?: string | null;
};
type RigaComm = {
  affiliato_id: string;
  tipo: "check" | "pratica";
  variante?: "singola" | "famiglia" | null;
  prezzo_pagato: number | string;
  commissione: number | string;
  pagata_il: string | null;
  creato_il?: string | null;
};

/**
 * TUTTE le righe di `commissioni`, lette a pagine.
 *
 * 🔴 Prima si leggevano con una `select` senza limite. PostgREST taglia in
 * SILENZIO a 1000 righe: superato quel numero, `baseMaturato` e
 * `baseDaPagare` uscivano SOTTOSTIMATI e ai creator si pagava MENO del
 * dovuto, senza nessun errore. È l'invariante che non si può rompere: mai
 * perdere una commissione dovuta. Qui si legge a pagine finché finiscono,
 * ordinando per `riferimento` (UNICO) così nessuna riga viene saltata sul
 * confine di una pagina. Il tetto è altissimo e, se mai lo si toccasse, si
 * fa sentire nei log invece di tagliare zitto.
 * Trovato dall'audit del pannello (26/08).
 */
async function tutteLeCommissioni(db: ReturnType<typeof supabaseServizio>): Promise<RigaComm[]> {
  const PAGINA = 1000;
  const TETTO = 500_000; // 500 pagine: irraggiungibile in pratica, non un cap muto
  let colonne = "affiliato_id, tipo, variante, prezzo_pagato, commissione, pagata_il, creato_il";
  const righe: RigaComm[] = [];
  for (let da = 0; da < TETTO; da += PAGINA) {
    let r: Risp<RigaComm> = await db
      .from("commissioni")
      .select(colonne)
      .order("riferimento", { ascending: true })
      .range(da, da + PAGINA - 1)
      .returns<RigaComm[]>();
    /* Migrazione della variante non applicata: si rilegge senza, da qui in
       avanti, così non si ritenta a ogni pagina. */
    if (r.error && /variante|column|schema cache/i.test(r.error.message) && colonne.includes("variante")) {
      colonne = "affiliato_id, tipo, prezzo_pagato, commissione, pagata_il";
      r = await db
        .from("commissioni")
        .select(colonne)
        .order("riferimento", { ascending: true })
        .range(da, da + PAGINA - 1)
        .returns<RigaComm[]>();
    }
    if (r.error) throw new Error(r.error.message);
    const pezzo = r.data ?? [];
    righe.push(...pezzo);
    if (pezzo.length < PAGINA) return righe; // ultima pagina
  }
  console.warn("[affiliati] tetto di lettura commissioni raggiunto: i totali potrebbero essere parziali.");
  return righe;
}

export async function leggiAffiliati(): Promise<CreatorPieno[] | null> {
  if (!SERVIZIO_ATTIVO) return null;
  try {
    const db = supabaseServizio();
    const PIENE =
      "id, codice, nome, sconto_percento, commissione_percento, attivo, creato_il, tipo_accordo, bonus_fisso, bonus_fisso_pagato_il, bonus_pagato, seguito, click, token, ultimo_clic";
    const BASE = "id, codice, nome, sconto_percento, commissione_percento, attivo, creato_il";

    let aff: Risp<RigaAff> = await db
      .from("affiliati")
      .select(PIENE)
      .order("creato_il", { ascending: false });
    if (aff.error && /column|colonna|does not exist|schema cache/i.test(aff.error.message)) {
      aff = await db.from("affiliati").select(BASE).order("creato_il", { ascending: false });
    }
    if (aff.error) throw new Error(aff.error.message);

    /* Tutte le commissioni, paginate: la lettura non tronca più a 1000 in
       silenzio (vedi tutteLeCommissioni). */
    const righeComm = await tutteLeCommissioni(db);
    const adesso = Date.now();

    return (aff.data ?? []).map((a) => {
      const sue = righeComm.filter((r) => r.affiliato_id === a.id);
      let nCheck = 0;
      let nSingola = 0;
      let nFamiglia = 0;
      let baseMaturato = 0;
      let baseDaPagare = 0;
      let ultimaVendita: string | null = null;
      const saldi = new Map<string, number>();

      for (const r of sue) {
        const imp = Number(r.commissione);
        baseMaturato += imp;
        if (r.pagata_il === null) baseDaPagare += imp;
        else saldi.set(r.pagata_il, (saldi.get(r.pagata_il) ?? 0) + imp);
        if (r.creato_il && (!ultimaVendita || r.creato_il > ultimaVendita)) ultimaVendita = r.creato_il;

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

      const ultimoClic = a.ultimo_clic ?? null;
      const ultimoMovimento =
        [ultimoClic, ultimaVendita].filter((x): x is string => Boolean(x)).sort().at(-1) ?? null;
      const attivoDiRecente = ultimoMovimento
        ? adesso - Date.parse(ultimoMovimento) < GIORNI_ATTIVO * 24 * 60 * 60 * 1000
        : false;

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
        token: a.token ?? null,
        ultimoClic,
        ultimoMovimento,
        attivoDiRecente,
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

/* ─────────────────────────── i dati per la dashboard del creator ───────── */

export type Traguardo = {
  chiave: "singola" | "famiglia" | "check";
  nome: string;
  fatte: number;
  sbloccati: number;
  dentro: number;
  segmento: number;
  mancano: number;
  premio: number;
  prossimaSoglia: number;
};

export type DatiCreator = {
  nome: string;
  codice: string;
  link: string;
  scontoPercento: number;
  attivoDiRecente: boolean;
  ibrido: boolean;
  clic: number;
  nCheck: number;
  nSingola: number;
  nFamiglia: number;
  totaleMaturato: number;
  baseMaturato: number;
  bonusTotale: number;
  bonusFisso: number;
  fissoAttivo: boolean;
  fissoPagato: boolean;
  daRicevere: number;
  giorniPagamento: number;
  prezzoSingola: number;
  prezzoFamiglia: number;
  traguardi: Traguardo[];
};

/** Trasforma un creator nei dati semplici (senza funzioni) che la dashboard
    client sa disegnare. Il link glielo passa la rotta (corto se c'è il token). */
export function datiCreator(c: CreatorPieno, link: string): DatiCreator {
  const nomi = { singola: "singole", famiglia: "famiglia", check: "check" } as const;
  const conteggi: Record<"singola" | "famiglia" | "check", number> = {
    singola: c.nSingola,
    famiglia: c.nFamiglia,
    check: c.nCheck,
  };
  const traguardi: Traguardo[] = (["singola", "famiglia", "check"] as const).map((k) => {
    const p = progressoBonus(conteggi[k], BONUS[k]);
    return { chiave: k, nome: nomi[k], fatte: conteggi[k], ...p };
  });

  return {
    nome: c.nome,
    codice: c.codice,
    link,
    scontoPercento: c.sconto_percento,
    attivoDiRecente: c.attivoDiRecente,
    ibrido: c.tipo_accordo === "ibrido",
    clic: c.click,
    nCheck: c.nCheck,
    nSingola: c.nSingola,
    nFamiglia: c.nFamiglia,
    totaleMaturato: arrotonda(c.baseMaturato + c.bonus.totale + (c.tipo_accordo === "ibrido" ? c.bonusFisso : 0)),
    baseMaturato: c.baseMaturato,
    bonusTotale: c.bonus.totale,
    bonusFisso: c.bonusFisso,
    fissoAttivo: c.tipo_accordo === "ibrido" && c.bonusFisso > 0,
    fissoPagato: Boolean(c.fissoPagatoIl),
    daRicevere: c.daPagareTotale,
    giorniPagamento: GIORNI_PAGAMENTO,
    prezzoSingola: PREZZO_SINGOLA,
    prezzoFamiglia: PREZZO_FAMIGLIA,
    traguardi,
  };
}
