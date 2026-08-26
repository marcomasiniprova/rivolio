"use client";

import { Fragment, useActionState, useMemo, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { Bollo, euro } from "@/components/admin/Pezzi";
import {
  aggiornaAccordo,
  cambiaStato,
  creaAffiliato,
  promuoviCreator,
  rimuoviCreator,
  segnaPagate,
  type EsitoAffiliati,
} from "@/app/admin/affiliati/azioni";
import type { CreatorPieno } from "@/lib/affiliati/lettura";
import type { CreatoreRiga } from "@/lib/affiliati/creatore";

const gruppi = (s: string) => s.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
// Deterministico apposta: toLocaleString sul server (Node senza ICU) dà
// "1240" e nel browser "1.240", e sono due HTML diversi (idratazione rotta).
const numIt = (n: number) => gruppi(Math.round(n).toString());
const maturatoDi = (r: CreatorPieno) => r.baseMaturato + r.bonus.totale;

/** Copia un testo negli appunti, con la spunta di conferma. */
function Copia({ testo, etichetta }: { testo: string; etichetta: string }) {
  const [fatto, setFatto] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(testo);
          setFatto(true);
          setTimeout(() => setFatto(false), 1800);
        } catch {
          /* Appunti negati: si ignora. */
        }
      }}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-[9px] border border-bordo bg-white px-2.5 py-1.5 text-[12px] font-medium text-fumo transition-colors hover:border-verde hover:text-verde-scuro"
    >
      {fatto ? (
        <>
          <Check className="size-3.5 text-verde" aria-hidden="true" /> Copiato
        </>
      ) : (
        <>
          <Copy className="size-3.5" aria-hidden="true" /> {etichetta}
        </>
      )}
    </button>
  );
}

/** Pallino dell'attività: verde se ha mosso qualcosa negli ultimi 7 giorni. */
function Attivita({ acceso, quando }: { acceso: boolean; quando: string | null }) {
  const data = quando ? new Date(quando).toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }) : null;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-[11.5px] text-fumo-2"
      title={data ? `Ultimo movimento: ${data}` : "Nessun movimento ancora"}
    >
      <span className={`size-2 rounded-full ${acceso ? "bg-verde" : "bg-bordo"}`} />
      {acceso ? "Attivo" : quando ? "Fermo" : "Mai"}
    </span>
  );
}

/* ─────────────────────────────────── i moduli per aggiungere ─────────── */

function Campo({
  nome,
  etichetta,
  placeholder,
  tipo = "text",
  def,
  required,
  maiuscolo,
}: {
  nome: string;
  etichetta: string;
  placeholder?: string;
  tipo?: string;
  def?: string;
  required?: boolean;
  maiuscolo?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-[12px] font-medium text-fumo">
      {etichetta}
      <input
        name={nome}
        type={tipo}
        required={required}
        placeholder={placeholder}
        defaultValue={def}
        autoCapitalize={maiuscolo ? "characters" : undefined}
        className={`h-10 rounded-[10px] border border-bordo bg-nebbia px-3 text-[16px] text-inchiostro outline-none focus:border-verde/45 focus:bg-white sm:text-[14px] ${
          maiuscolo ? "uppercase" : ""
        }`}
      />
    </label>
  );
}

function ModuloCrea() {
  const [esito, azione, inCorso] = useActionState<EsitoAffiliati, FormData>(creaAffiliato, {});
  const [ibrido, setIbrido] = useState(false);
  return (
    <form action={azione} className="rounded-[14px] border border-bordo bg-white p-4 sm:p-5">
      <p className="text-[15px] font-medium text-inchiostro">Nuovo creator</p>
      <p className="mt-1 text-[13px] text-fumo-2">
        Il codice è anche il codice sconto e la coda del link (rivolio.it/?ref=CODICE). Solo lettere
        e numeri, da 3 a 20. Il link corto del cruscotto glielo genero io.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Campo nome="codice" etichetta="Codice" placeholder="MARCO" maiuscolo required />
        <Campo nome="nome" etichetta="Nome del creator" placeholder="Marco Rossi" required />
        <Campo nome="sconto" etichetta="Sconto al cliente (%)" tipo="number" def="10" />
        <Campo nome="commissione" etichetta="Commissione al creator (%)" tipo="number" def="40" />
        <label className="flex flex-col gap-1 text-[12px] font-medium text-fumo">
          Tipo di accordo
          <select
            name="tipo_accordo"
            onChange={(e) => setIbrido(e.target.value === "ibrido")}
            className="h-10 rounded-[10px] border border-bordo bg-nebbia px-3 text-[16px] text-inchiostro outline-none focus:border-verde/45 focus:bg-white sm:text-[14px]"
          >
            <option value="performance">Performance (40% + bonus)</option>
            <option value="ibrido">Ibrido (anche un fisso una-tantum)</option>
          </select>
        </label>
        <Campo nome="seguito" etichetta="Follower (facoltativo)" tipo="number" placeholder="171000" />
        {ibrido && <Campo nome="bonus_fisso" etichetta="Fisso una-tantum (€)" tipo="number" placeholder="80" />}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={inCorso}
          className="inline-flex h-10 items-center rounded-bottone bg-verde px-5 text-[14px] font-semibold text-white transition-colors hover:bg-verde-scuro disabled:opacity-60"
        >
          {inCorso ? "Creo..." : "Crea il creator"}
        </button>
        {esito.ok && <span className="text-[13px] font-medium text-verde-scuro">{esito.ok}</span>}
        {esito.errore && <span className="text-[13px] font-medium text-red-700">{esito.errore}</span>}
      </div>
    </form>
  );
}

function ModuloCreator({ creatori }: { creatori: CreatoreRiga[] | null }) {
  const [esito, azione, inCorso] = useActionState<EsitoAffiliati, FormData>(promuoviCreator, {});
  return (
    <div className="rounded-[14px] border border-bordo bg-white p-4 sm:p-5">
      <p className="text-[15px] font-medium text-inchiostro">Creator gratis a vita</p>
      <p className="mt-1 text-[13px] text-fumo-2">
        Un account promosso qui fa check e pratiche senza pagare, per sempre. È un permesso
        sull&apos;account, diverso dal codice sconto qui sopra (che serve a chi PORTA clienti).
      </p>
      <form action={azione} className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-[12px] font-medium text-fumo">
          Email del creator
          <input
            name="email"
            type="email"
            required
            placeholder="marco@esempio.it"
            className="h-10 rounded-[10px] border border-bordo bg-nebbia px-3 text-[16px] text-inchiostro outline-none focus:border-verde/45 focus:bg-white sm:text-[14px]"
          />
        </label>
        <button
          type="submit"
          disabled={inCorso}
          className="inline-flex h-10 items-center rounded-bottone bg-verde px-5 text-[14px] font-semibold text-white transition-colors hover:bg-verde-scuro disabled:opacity-60"
        >
          {inCorso ? "Promuovo..." : "Rendi gratis a vita"}
        </button>
      </form>
      {esito.ok && <p className="mt-2 text-[13px] font-medium text-verde-scuro">{esito.ok}</p>}
      {esito.errore && <p className="mt-2 text-[13px] font-medium text-red-700">{esito.errore}</p>}

      {creatori === null ? (
        <p className="mt-4 text-[13px] text-fumo-2">L&apos;elenco non si è caricato. Riprova fra poco.</p>
      ) : creatori.length === 0 ? (
        <p className="mt-4 text-[13px] text-fumo-2">Ancora nessun account gratis a vita.</p>
      ) : (
        <ul className="mt-4 flex flex-col divide-y divide-bordo border-t border-bordo">
          {creatori.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-2 py-2.5">
              <span className="min-w-0 break-all text-[13px] font-medium text-inchiostro">{c.email}</span>
              {c.nickname && <span className="text-[12px] text-fumo-2">({c.nickname})</span>}
              <form action={rimuoviCreator} className="ml-auto">
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  className="rounded-[9px] border border-bordo bg-white px-3 py-1.5 text-[12px] font-medium text-fumo transition-colors hover:border-fumo-2"
                >
                  Togli il gratis
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ─────────────────────────────────── il dettaglio di un creator ──────── */

function Dettaglio({ r, base, link }: { r: CreatorPieno; base: string; link: string | null }) {
  const refLink = `${base}/?ref=${r.codice}`;
  const prox = [
    { nome: "singole", ...r.prossimi.singola },
    { nome: "famiglia", ...r.prossimi.famiglia },
    { nome: "check", ...r.prossimi.check },
  ].sort((a, b) => a.mancano - b.mancano)[0];

  return (
    <div className="grid gap-4 border-t border-bordo bg-nebbia/40 p-4 sm:grid-cols-2 sm:p-5">
      {/* link + soldi */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Copia testo={refLink} etichetta="Link ?ref" />
          {link && <Copia testo={link} etichetta="Link cruscotto" />}
        </div>
        <p className="mt-2 break-all text-[11.5px] text-fumo-2">{refLink}</p>

        <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.1em] text-fumo-2">Maturato</p>
        <ul className="mt-1.5 space-y-1 text-[13px] text-fumo">
          <li className="flex justify-between">
            <span>Base 40%</span>
            <span className="numeri text-inchiostro">{euro(r.baseMaturato)}</span>
          </li>
          <li className="flex justify-between">
            <span>Bonus singole / famiglia / check</span>
            <span className="numeri text-inchiostro">
              {euro(r.bonus.singola)} / {euro(r.bonus.famiglia)} / {euro(r.bonus.check)}
            </span>
          </li>
          {r.tipo_accordo === "ibrido" && (
            <li className="flex justify-between">
              <span>Fisso {r.fissoPagatoIl ? "(pagato)" : ""}</span>
              <span className="numeri text-inchiostro">{euro(r.bonusFisso)}</span>
            </li>
          )}
        </ul>
        <p className="mt-2 text-[12.5px] text-fumo">
          Prossimo bonus: ancora <b className="numeri text-inchiostro">{prox.mancano}</b> {prox.nome} per{" "}
          <b className="numeri text-verde-scuro">{euro(prox.premio)}</b>.
        </p>

        <p className="mt-4 text-[12px] font-medium uppercase tracking-[0.1em] text-fumo-2">Saldi</p>
        {r.pagamenti.length === 0 ? (
          <p className="mt-1 text-[12.5px] text-fumo-2">Ancora nessun saldo.</p>
        ) : (
          <ul className="mt-1 space-y-1 text-[13px] text-fumo">
            {r.pagamenti.map((p) => (
              <li key={p.quando} className="flex justify-between">
                <span>{new Date(p.quando).toLocaleDateString("it-IT")}</span>
                <span className="numeri text-inchiostro">{euro(p.importo)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* accordo + azioni */}
      <div className="flex flex-col gap-3">
        <form action={aggiornaAccordo} className="flex flex-col gap-2 rounded-[12px] border border-bordo bg-white p-3.5">
          <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-fumo-2">Accordo</p>
          <input type="hidden" name="id" value={r.id} />
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[12px] text-fumo">
              Tipo
              <select
                name="tipo_accordo"
                defaultValue={r.tipo_accordo}
                className="h-9 rounded-[9px] border border-bordo bg-white px-2 text-[16px] sm:text-[13px]"
              >
                <option value="performance">Performance</option>
                <option value="ibrido">Ibrido</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-fumo">
              Follower
              <input
                name="seguito"
                type="number"
                defaultValue={r.seguito ?? ""}
                placeholder="171000"
                className="h-9 rounded-[9px] border border-bordo bg-white px-2 text-[16px] sm:text-[13px]"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-[12px] text-fumo">
            Fisso una-tantum (€)
            <input
              name="bonus_fisso"
              type="number"
              step="0.01"
              defaultValue={r.bonusFisso || ""}
              placeholder="80"
              className="h-9 rounded-[9px] border border-bordo bg-white px-2 text-[16px] sm:text-[13px]"
            />
          </label>
          <button
            type="submit"
            className="mt-1 self-start rounded-[9px] border border-bordo bg-white px-3 py-1.5 text-[12px] font-medium text-fumo transition-colors hover:border-fumo-2"
          >
            Salva l&apos;accordo
          </button>
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {r.daPagareTotale > 0 && (
            <form action={segnaPagate}>
              <input type="hidden" name="id" value={r.id} />
              <button
                type="submit"
                className="rounded-[9px] border border-verde/40 bg-menta-tenue px-3 py-1.5 text-[12px] font-medium text-verde-scuro transition-colors hover:border-verde"
              >
                Segna pagato ({euro(r.daPagareTotale)})
              </button>
            </form>
          )}
          <form action={cambiaStato}>
            <input type="hidden" name="id" value={r.id} />
            <input type="hidden" name="attivo" value={r.attivo ? "0" : "1"} />
            <button
              type="submit"
              className="rounded-[9px] border border-bordo bg-white px-3 py-1.5 text-[12px] font-medium text-fumo transition-colors hover:border-fumo-2"
            >
              {r.attivo ? "Sospendi" : "Riattiva"}
            </button>
          </form>
          <span className="ml-auto text-[12px] text-fumo-2">
            Sconto {r.sconto_percento}% · Commissione {r.commissione_percento}%
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────── la sala di controllo ────────────── */

type Ordine = "attivita" | "daPagare" | "clic" | "maturato" | "nome";
const ORDINI: { chiave: Ordine; nome: string }[] = [
  { chiave: "attivita", nome: "Attività" },
  { chiave: "daPagare", nome: "Da pagare" },
  { chiave: "clic", nome: "Clic" },
  { chiave: "maturato", nome: "Maturato" },
  { chiave: "nome", nome: "Nome" },
];

export default function PannelloAffiliati({
  righe,
  base,
  creatori,
  links,
}: {
  righe: CreatorPieno[];
  base: string;
  creatori: CreatoreRiga[] | null;
  links: Record<string, string | null>;
}) {
  const [ordine, setOrdine] = useState<Ordine>("attivita");
  const [aperto, setAperto] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const arr = [...righe];
    const cmp: Record<Ordine, (a: CreatorPieno, b: CreatorPieno) => number> = {
      attivita: (a, b) =>
        Number(b.attivoDiRecente) - Number(a.attivoDiRecente) ||
        (b.ultimoMovimento ?? "").localeCompare(a.ultimoMovimento ?? ""),
      daPagare: (a, b) => b.daPagareTotale - a.daPagareTotale,
      clic: (a, b) => b.click - a.click,
      maturato: (a, b) => maturatoDi(b) - maturatoDi(a),
      nome: (a, b) => a.nome.localeCompare(b.nome),
    };
    return arr.sort(cmp[ordine]);
  }, [righe, ordine]);

  return (
    <div className="flex flex-col gap-5">
      {/* Aggiungere sta in un cassetto: la tabella è la protagonista. */}
      <details className="rounded-[14px] border border-bordo bg-white">
        <summary className="cursor-pointer list-none px-4 py-3 text-[14px] font-medium text-inchiostro sm:px-5">
          + Aggiungi un creator
        </summary>
        <div className="grid gap-4 border-t border-bordo p-4 sm:p-5 lg:grid-cols-2">
          <ModuloCrea />
          <ModuloCreator creatori={creatori} />
        </div>
      </details>

      {righe.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-bordo bg-nebbia/60 px-5 py-10 text-center">
          <p className="text-[14px] font-medium text-fumo">Ancora nessun creator.</p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] text-fumo-2">
            Aprine uno dal cassetto qui sopra, poi dagli il suo link corto.
          </p>
        </div>
      ) : (
        <>
          {/* i tasti d'ordinamento */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-fumo-2">Ordina per</span>
            {ORDINI.map((o) => (
              <button
                key={o.chiave}
                type="button"
                onClick={() => setOrdine(o.chiave)}
                className={`rounded-pillola border px-3 py-1 text-[12.5px] font-medium transition-colors ${
                  ordine === o.chiave
                    ? "border-verde bg-menta-tenue text-verde-scuro"
                    : "border-bordo bg-white text-fumo hover:border-fumo-2"
                }`}
              >
                {o.nome}
              </button>
            ))}
          </div>

          {/* TABELLA (da md in su): l'esercito a colpo d'occhio */}
          <div className="hidden overflow-x-auto rounded-[14px] border border-bordo bg-white md:block">
            <table className="w-full min-w-[720px] text-[13.5px]">
              <thead>
                <tr className="border-b border-bordo text-left text-[11px] uppercase tracking-[0.08em] text-fumo-2">
                  <th className="px-4 py-3 font-medium">Creator</th>
                  <th className="px-3 py-3 text-right font-medium">Clic</th>
                  <th className="px-3 py-3 text-right font-medium">Check</th>
                  <th className="px-3 py-3 text-right font-medium">Sing.</th>
                  <th className="px-3 py-3 text-right font-medium">Fam.</th>
                  <th className="px-3 py-3 text-right font-medium">Maturato</th>
                  <th className="px-3 py-3 text-right font-medium">Da pagare</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-bordo/70">
                {sorted.map((r) => {
                  const espanso = aperto === r.id;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        onClick={() => setAperto(espanso ? null : r.id)}
                        className={`cursor-pointer transition-colors hover:bg-nebbia/60 ${espanso ? "bg-nebbia/60" : ""}`}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="numeri font-semibold text-inchiostro">{r.codice}</span>
                            {!r.attivo && <Bollo tono="grigio">Sospeso</Bollo>}
                            {r.tipo_accordo === "ibrido" && <Bollo tono="attesa">Ibrido</Bollo>}
                          </div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <span className="text-[12px] text-fumo">{r.nome}</span>
                            <Attivita acceso={r.attivoDiRecente} quando={r.ultimoMovimento} />
                          </div>
                        </td>
                        <td className="numeri px-3 py-3 text-right text-inchiostro">{numIt(r.click)}</td>
                        <td className="numeri px-3 py-3 text-right text-inchiostro">{numIt(r.nCheck)}</td>
                        <td className="numeri px-3 py-3 text-right text-inchiostro">{numIt(r.nSingola)}</td>
                        <td className="numeri px-3 py-3 text-right text-inchiostro">{numIt(r.nFamiglia)}</td>
                        <td className="numeri px-3 py-3 text-right font-medium text-inchiostro">{euro(maturatoDi(r))}</td>
                        <td className={`numeri px-3 py-3 text-right font-semibold ${r.daPagareTotale > 0 ? "text-verde" : "text-fumo-2"}`}>
                          {euro(r.daPagareTotale)}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <ChevronDown
                            className={`inline size-4 text-fumo-2 transition-transform ${espanso ? "rotate-180" : ""}`}
                            aria-hidden="true"
                          />
                        </td>
                      </tr>
                      {espanso && (
                        <tr>
                          <td colSpan={8} className="p-0">
                            <Dettaglio r={r} base={base} link={links[r.id] ?? null} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* CARD (sul telefono): stessa roba, impilata */}
          <div className="flex flex-col gap-3 md:hidden">
            {sorted.map((r) => {
              const espanso = aperto === r.id;
              return (
                <div key={r.id} className="overflow-hidden rounded-[14px] border border-bordo bg-white">
                  <button
                    type="button"
                    onClick={() => setAperto(espanso ? null : r.id)}
                    className="flex w-full items-center justify-between gap-3 p-4 text-left"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="numeri font-semibold text-inchiostro">{r.codice}</span>
                        {!r.attivo && <Bollo tono="grigio">Sospeso</Bollo>}
                        {r.tipo_accordo === "ibrido" && <Bollo tono="attesa">Ibrido</Bollo>}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2">
                        <span className="text-[12px] text-fumo">{r.nome}</span>
                        <Attivita acceso={r.attivoDiRecente} quando={r.ultimoMovimento} />
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`numeri text-[16px] font-semibold ${r.daPagareTotale > 0 ? "text-verde" : "text-fumo-2"}`}>
                        {euro(r.daPagareTotale)}
                      </p>
                      <p className="text-[11px] text-fumo-2">da pagare</p>
                    </div>
                  </button>
                  <div className="grid grid-cols-4 gap-1 border-t border-bordo px-4 py-2 text-center text-[12px]">
                    {[
                      ["Clic", r.click],
                      ["Check", r.nCheck],
                      ["Sing.", r.nSingola],
                      ["Fam.", r.nFamiglia],
                    ].map(([k, v]) => (
                      <div key={k as string}>
                        <p className="numeri font-semibold text-inchiostro">{numIt(v as number)}</p>
                        <p className="text-[10.5px] uppercase tracking-[0.08em] text-fumo-2">{k}</p>
                      </div>
                    ))}
                  </div>
                  {espanso && <Dettaglio r={r} base={base} link={links[r.id] ?? null} />}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
