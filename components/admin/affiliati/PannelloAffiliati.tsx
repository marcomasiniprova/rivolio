"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
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

const numIt = (n: number) => n.toLocaleString("it-IT");

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
          /* Appunti negati (permesso, http): non è un guasto, si ignora. */
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
        Il codice è anche il codice sconto e la coda del link (rivolio.it/?ref=CODICE). Solo
        lettere e numeri, da 3 a 20.
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
        {ibrido && (
          <Campo nome="bonus_fisso" etichetta="Fisso una-tantum (€)" tipo="number" placeholder="80" />
        )}
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

/** Promuove un'email a creator gratis a vita (check e pratiche, per sempre). */
function ModuloCreator({ creatori }: { creatori: CreatoreRiga[] | null }) {
  const [esito, azione, inCorso] = useActionState<EsitoAffiliati, FormData>(promuoviCreator, {});
  return (
    <div className="rounded-[14px] border border-bordo bg-white p-4 sm:p-5">
      <p className="text-[15px] font-medium text-inchiostro">Creator gratis a vita</p>
      <p className="mt-1 text-[13px] text-fumo-2">
        Un account promosso qui fa check e pratiche senza pagare, per sempre. È un permesso
        sull&apos;account: da quel momento, appena entra con quell&apos;email, è tutto gratis. Diverso
        dal codice sconto qui sotto, che serve a chi PORTA clienti.
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
        <p className="mt-4 text-[13px] text-fumo-2">
          L&apos;elenco non si è caricato: il database non ha risposto. Riprova fra poco.
        </p>
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

function Mini({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.1em] text-fumo-2">{etichetta}</p>
      <p className="numeri mt-1 text-[20px] font-semibold text-inchiostro">{valore}</p>
    </div>
  );
}

function ProssimoBonus({ r }: { r: CreatorPieno }) {
  const voci = [
    { nome: "singole", ...r.prossimi.singola },
    { nome: "famiglia", ...r.prossimi.famiglia },
    { nome: "check", ...r.prossimi.check },
  ].sort((a, b) => a.mancano - b.mancano);
  const p = voci[0];
  return (
    <p className="mt-3 text-[12.5px] text-fumo">
      Prossimo bonus: ancora <b className="numeri text-inchiostro">{p.mancano}</b> {p.nome} per{" "}
      <b className="numeri text-verde-scuro">{euro(p.premio)}</b>.
    </p>
  );
}

function SchedaCreator({ r, base, link }: { r: CreatorPieno; base: string; link: string | null }) {
  const refLink = `${base}/?ref=${r.codice}`;
  return (
    <div className="rounded-[14px] border border-bordo bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="numeri text-[16px] font-semibold tracking-tight text-inchiostro">
              {r.codice}
            </span>
            <Bollo tono={r.attivo ? "verde" : "grigio"}>{r.attivo ? "Attivo" : "Sospeso"}</Bollo>
            {r.tipo_accordo === "ibrido" && <Bollo tono="attesa">Ibrido</Bollo>}
          </div>
          <p className="mt-0.5 text-[13px] text-fumo">
            {r.nome}
            {r.seguito != null && <span className="text-fumo-2"> · {numIt(r.seguito)} follower</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Copia testo={refLink} etichetta="Link ?ref" />
          {link && <Copia testo={link} etichetta="Link cruscotto" />}
        </div>
      </div>
      <p className="mt-2 break-all text-[12px] text-fumo-2">{refLink}</p>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini etichetta="Clic" valore={numIt(r.click)} />
        <Mini etichetta="Check" valore={numIt(r.nCheck)} />
        <Mini etichetta="Singole" valore={numIt(r.nSingola)} />
        <Mini etichetta="Famiglia" valore={numIt(r.nFamiglia)} />
      </div>

      <div className="mt-4 rounded-[12px] border border-verde/25 bg-menta-tenue p-3.5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[13px] font-medium text-verde-scuro">Da pagare adesso</span>
          <span className="numeri text-[22px] font-semibold text-verde">{euro(r.daPagareTotale)}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-fumo">
          <span>
            Base 40%: <b className="numeri text-inchiostro">{euro(r.baseDaPagare)}</b>
          </span>
          <span>
            Bonus: <b className="numeri text-inchiostro">{euro(r.bonusDaPagare)}</b>
          </span>
          {r.tipo_accordo === "ibrido" && (
            <span>
              Fisso: <b className="numeri text-inchiostro">{euro(r.fissoDaPagare)}</b>
            </span>
          )}
        </div>
      </div>

      <ProssimoBonus r={r} />

      <details className="mt-3 border-t border-bordo pt-3">
        <summary className="-my-1 cursor-pointer py-2 text-[13px] font-medium text-fumo transition-colors hover:text-inchiostro">
          Dettaglio e accordo
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-fumo-2">Maturato</p>
            <ul className="mt-1.5 space-y-1 text-[13px] text-fumo">
              <li className="flex justify-between">
                <span>Base 40%</span>
                <span className="numeri text-inchiostro">{euro(r.baseMaturato)}</span>
              </li>
              <li className="flex justify-between">
                <span>Bonus singole</span>
                <span className="numeri text-inchiostro">{euro(r.bonus.singola)}</span>
              </li>
              <li className="flex justify-between">
                <span>Bonus famiglia</span>
                <span className="numeri text-inchiostro">{euro(r.bonus.famiglia)}</span>
              </li>
              <li className="flex justify-between">
                <span>Bonus check</span>
                <span className="numeri text-inchiostro">{euro(r.bonus.check)}</span>
              </li>
              {r.tipo_accordo === "ibrido" && (
                <li className="flex justify-between">
                  <span>Fisso {r.fissoPagatoIl ? "(pagato)" : ""}</span>
                  <span className="numeri text-inchiostro">{euro(r.bonusFisso)}</span>
                </li>
              )}
            </ul>
            <p className="mt-3 text-[12px] font-medium uppercase tracking-[0.1em] text-fumo-2">Saldi</p>
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

          <form action={aggiornaAccordo} className="flex flex-col gap-2">
            <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-fumo-2">Accordo</p>
            <input type="hidden" name="id" value={r.id} />
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
        </div>
      </details>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-bordo pt-3 text-[12px] text-fumo-2">
        <span>Sconto cliente {r.sconto_percento}%</span>
        <span aria-hidden="true">·</span>
        <span>Commissione {r.commissione_percento}%</span>
        <span className="ml-auto flex flex-wrap gap-2">
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
        </span>
      </div>
    </div>
  );
}

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
  return (
    <div className="flex flex-col gap-5">
      <ModuloCreator creatori={creatori} />
      <ModuloCrea />

      {righe.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-bordo bg-nebbia/60 px-5 py-10 text-center">
          <p className="text-[14px] font-medium text-fumo">Ancora nessun creator.</p>
          <p className="mx-auto mt-1.5 max-w-md text-[13px] text-fumo-2">
            Creane uno qui sopra, poi dagli il suo link. Ogni pagante che porta ti costa la
            commissione, non un euro in più.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {righe.map((r) => (
            <SchedaCreator key={r.id} r={r} base={base} link={links[r.id] ?? null} />
          ))}
        </div>
      )}
    </div>
  );
}
