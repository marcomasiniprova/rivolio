"use client";

import { useActionState, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Bollo, euro } from "@/components/admin/Pezzi";
import {
  cambiaStato,
  creaAffiliato,
  promuoviCreator,
  rimuoviCreator,
  segnaPagate,
  type EsitoAffiliati,
} from "@/app/admin/affiliati/azioni";
import type { RigaAffiliato } from "@/lib/affiliati/lettura";
import type { CreatoreRiga } from "@/lib/affiliati/creatore";

/** Il bottone che copia il link del creator, con la spunta di conferma. */
function CopiaLink({ link }: { link: string }) {
  const [fatto, setFatto] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(link);
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
          <Copy className="size-3.5" aria-hidden="true" /> Copia link
        </>
      )}
    </button>
  );
}

function ModuloCrea() {
  const [esito, azione, inCorso] = useActionState<EsitoAffiliati, FormData>(creaAffiliato, {});
  return (
    <form action={azione} className="rounded-[14px] border border-bordo bg-white p-4 sm:p-5">
      <p className="text-[15px] font-medium text-inchiostro">Nuovo creator</p>
      <p className="mt-1 text-[13px] text-fumo-2">
        Il codice è anche il codice sconto e la coda del link (rivolio.it/?ref=CODICE). Solo
        lettere e numeri, da 3 a 20.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-[12px] font-medium text-fumo">
          Codice
          <input
            name="codice"
            required
            placeholder="MARCO"
            autoCapitalize="characters"
            className="h-10 rounded-[10px] border border-bordo bg-nebbia px-3 text-[16px] uppercase text-inchiostro outline-none focus:border-verde/45 focus:bg-white sm:text-[14px]"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-medium text-fumo">
          Nome del creator
          <input
            name="nome"
            required
            placeholder="Marco Rossi"
            className="h-10 rounded-[10px] border border-bordo bg-nebbia px-3 text-[16px] text-inchiostro outline-none focus:border-verde/45 focus:bg-white sm:text-[14px]"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-medium text-fumo">
          Sconto al cliente (%)
          <input
            name="sconto"
            type="number"
            min={0}
            max={90}
            defaultValue={10}
            className="h-10 rounded-[10px] border border-bordo bg-nebbia px-3 text-[16px] text-inchiostro outline-none focus:border-verde/45 focus:bg-white sm:text-[14px]"
          />
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-medium text-fumo">
          Commissione al creator (%)
          <input
            name="commissione"
            type="number"
            min={0}
            max={100}
            defaultValue={40}
            className="h-10 rounded-[10px] border border-bordo bg-nebbia px-3 text-[16px] text-inchiostro outline-none focus:border-verde/45 focus:bg-white sm:text-[14px]"
          />
        </label>
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
        dal codice sconto qui sopra, che serve a chi PORTA clienti.
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
              <span className="min-w-0 break-all text-[13px] font-medium text-inchiostro">
                {c.email}
              </span>
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

export default function PannelloAffiliati({
  righe,
  base,
  creatori,
}: {
  righe: RigaAffiliato[];
  base: string;
  creatori: CreatoreRiga[] | null;
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
          {righe.map((r) => {
            const link = `${base}/?ref=${r.codice}`;
            return (
              <div key={r.id} className="rounded-[14px] border border-bordo bg-white p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="numeri text-[16px] font-semibold tracking-tight text-inchiostro">
                        {r.codice}
                      </span>
                      <Bollo tono={r.attivo ? "verde" : "grigio"}>{r.attivo ? "Attivo" : "Sospeso"}</Bollo>
                    </div>
                    <p className="mt-0.5 text-[13px] text-fumo">{r.nome}</p>
                  </div>
                  <CopiaLink link={link} />
                </div>

                <p className="mt-2 break-all text-[12px] text-fumo-2">{link}</p>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.1em] text-fumo-2">Da pagare</p>
                    <p
                      className={`numeri mt-1 text-[20px] font-semibold ${r.daPagare > 0 ? "text-verde" : "text-fumo"}`}
                    >
                      {euro(r.daPagare)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.1em] text-fumo-2">Maturato</p>
                    <p className="numeri mt-1 text-[20px] font-semibold text-inchiostro">
                      {euro(r.maturato)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.1em] text-fumo-2">Pratiche</p>
                    <p className="numeri mt-1 text-[20px] font-semibold text-inchiostro">
                      {r.venditePratica}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.1em] text-fumo-2">Check</p>
                    <p className="numeri mt-1 text-[20px] font-semibold text-inchiostro">
                      {r.venditeCheck}
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-bordo pt-3 text-[12px] text-fumo-2">
                  <span>Sconto cliente {r.sconto_percento}%</span>
                  <span aria-hidden="true">·</span>
                  <span>Commissione {r.commissione_percento}%</span>
                  <span className="ml-auto flex flex-wrap gap-2">
                    {r.daPagare > 0 && (
                      <form action={segnaPagate}>
                        <input type="hidden" name="id" value={r.id} />
                        <button
                          type="submit"
                          className="rounded-[9px] border border-verde/40 bg-menta-tenue px-3 py-1.5 text-[12px] font-medium text-verde-scuro transition-colors hover:border-verde"
                        >
                          Segna pagato ({euro(r.daPagare)})
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
          })}
        </div>
      )}
    </div>
  );
}
