"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { COPY } from "@/lib/copy";
import { prezzoInEuro } from "@/lib/pratiche/prezzo-testo";

/**
 * "Ti hanno lasciato a terra o hai perso una coincidenza?"
 *
 * I due casi che gli archivi di volo NON possono vedere: il volo
 * controllato può risultare perfetto mentre tu sei rimasto al gate, o
 * hai perso la coincidenza a Monaco per colpa del primo ritardo. Si apre
 * da un invito discreto sotto il verdetto, si risponde a scelte chiuse,
 * e il verdetto lo dà il motore sul server: qui non c'è nessuna regola
 * da poter falsificare.
 *
 * La coincidenza chiede il NUMERO del volo che hai perso: il motore lo
 * legge davvero, prova dagli orari che il primo ritardo te l'ha fatto
 * perdere, e ricava la destinazione finale (e quindi la fascia) dal volo
 * stesso. Chi non ha il numero sotto mano resta incerto e non paga.
 */

const T = COPY.risultato.dichiara;
const CURVA = [0.16, 1, 0.3, 1] as const;

type Esito = { esito: "idoneo" | "incerto" | "non_idoneo"; motivo: string; importo?: number };

function Scelte<V extends string>({
  domanda,
  aiuto,
  voci,
  scelta,
  scegli,
}: {
  domanda: string;
  aiuto?: string;
  voci: readonly { valore: V; testo: string }[];
  scelta: V | null;
  scegli: (v: V) => void;
}) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="text-[15px] font-semibold text-inchiostro">{domanda}</legend>
      {aiuto && <p className="mt-1 text-[13px] leading-relaxed text-fumo">{aiuto}</p>}
      <div className="mt-2.5 flex flex-col gap-2">
        {voci.map((v) => {
          const attiva = scelta === v.valore;
          return (
            <button
              key={v.valore}
              type="button"
              onClick={() => scegli(v.valore)}
              aria-pressed={attiva}
              className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-[14px] transition-all duration-200 ${
                attiva
                  ? "border-verde bg-menta-tenue font-medium text-inchiostro"
                  : "border-bordo bg-white text-fumo hover:border-verde/50 hover:bg-nebbia"
              }`}
            >
              <span
                aria-hidden="true"
                className={`grid h-[17px] w-[17px] shrink-0 place-items-center rounded-full border-2 ${
                  attiva ? "border-verde" : "border-bordo"
                }`}
              >
                {attiva && <span className="h-[7px] w-[7px] rounded-full bg-verde" />}
              </span>
              {v.testo}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export default function DichiaraCaso({
  volo,
  dataVolo,
  idVerifica,
  demo,
}: {
  volo: string;
  dataVolo: string;
  idVerifica: string | null;
  demo: boolean;
}) {
  const [aperto, setAperto] = useState<"negato" | "coincidenza" | "declassamento" | null>(null);
  const [presenza, setPresenza] = useState<string | null>(null);
  const [volonta, setVolonta] = useState<string | null>(null);
  const [unica, setUnica] = useState<string | null>(null);
  const [ritardoFinale, setRitardoFinale] = useState<string | null>(null);
  const [secondoVolo, setSecondoVolo] = useState("");
  const [volontaDecl, setVolontaDecl] = useState<string | null>(null);
  const [prezzo, setPrezzo] = useState("");
  const [invio, setInvio] = useState(false);
  const [esito, setEsito] = useState<Esito | null>(null);
  const [errore, setErrore] = useState("");
  const router = useRouter();

  /* Il prezzo digitato, in numero: `prezzoInEuro` regge la virgola
     all'italiana ("129,90") e il punto delle migliaia ("1.500" → 1500). */
  const prezzoNum = prezzoInEuro(prezzo);
  const prezzoOk = Number.isFinite(prezzoNum) && prezzoNum > 0;

  const pronto =
    aperto === "negato"
      ? presenza !== null && volonta !== null
      : aperto === "declassamento"
        ? volontaDecl !== null && prezzoOk
        : unica !== null && ritardoFinale !== null && secondoVolo.trim().length >= 3;

  async function manda() {
    if (!aperto || !pronto || invio) return;
    setInvio(true);
    setErrore("");
    try {
      const corpo =
        aperto === "negato"
          ? { caso: "negato", presenza, volonta }
          : aperto === "declassamento"
            ? { caso: "declassamento", volonta: volontaDecl, prezzo: prezzoNum }
            : { caso: "coincidenza", unica, ritardoFinale, secondoVolo: secondoVolo.trim() };
      const r = await fetch("/api/verifica/dichiara", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volo, data: dataVolo, verificaId: idVerifica, ...corpo }),
      });
      const d = await r.json().catch(() => null);
      if (!r.ok || !d?.ok) {
        setErrore(typeof d?.errore === "string" ? d.errore : COPY.comune.erroreGenerico);
        return;
      }
      if (idVerifica && d.esito !== "incerto") {
        /* 🔴 PRIMA QUI C'ERA window.location.reload(), e rifaceva partire
           la scenetta dello scanner del biglietto per qualche secondo:
           sembrava un bug o un crash (Valerio, 14/08). Adesso è un
           aggiornamento morbido: il server rilegge il verdetto appena
           dichiarato e la pagina si aggiorna sul posto, senza ricaricare e
           senza rimontare le animazioni. */
        router.refresh();
        return;
      }
      setEsito({ esito: d.esito, motivo: d.motivo, importo: d.importo });
    } catch {
      setErrore(COPY.comune.erroreGenerico);
    } finally {
      setInvio(false);
    }
  }

  if (esito) {
    const buono = esito.esito === "idoneo";
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: CURVA }}
        className={`rounded-2xl border p-5 sm:p-6 ${
          buono ? "border-verde bg-menta-tenue" : "border-bordo bg-nebbia"
        }`}
      >
        {buono && esito.importo && (
          <p className="numeri font-display text-[44px] font-medium leading-none tracking-[-0.04em] text-verde">
            {esito.importo}€
          </p>
        )}
        <p className="mt-3 text-[15px] leading-relaxed text-inchiostro/85">{esito.motivo}</p>
      </motion.div>
    );
  }

  return (
    <div className="rounded-2xl border border-bordo bg-white p-5 sm:p-6">
      <p className="text-[15.5px] font-semibold text-inchiostro">{T.invito}</p>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-fumo">{T.invitoSotto}</p>

      {/* le tre schede: negato imbarco / coincidenza persa / declassamento */}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {(
          [
            ["negato", T.negato.scheda],
            ["coincidenza", T.coincidenza.scheda],
            ["declassamento", T.declassamento.scheda],
          ] as const
        ).map(([chiave, testo]) => (
          <button
            key={chiave}
            type="button"
            onClick={() => setAperto(aperto === chiave ? null : chiave)}
            aria-expanded={aperto === chiave}
            className={`rounded-xl border px-4 py-3 text-[14px] font-medium transition-all duration-200 ${
              aperto === chiave
                ? "border-verde bg-menta-tenue text-inchiostro"
                : "border-bordo bg-nebbia text-fumo hover:border-verde/50"
            }`}
          >
            {testo}
          </button>
        ))}
      </div>

      {aperto && (
        <motion.div
          key={aperto}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: CURVA }}
          className="mt-5 flex flex-col gap-5 border-t border-bordo/70 pt-5"
        >
          {aperto === "negato" ? (
            <>
              <Scelte
                domanda={T.negato.presenza.domanda}
                voci={T.negato.presenza.voci}
                scelta={presenza as never}
                scegli={setPresenza}
              />
              <Scelte
                domanda={T.negato.volonta.domanda}
                voci={T.negato.volonta.voci}
                scelta={volonta as never}
                scegli={setVolonta}
              />
            </>
          ) : aperto === "declassamento" ? (
            <>
              <Scelte
                domanda={T.declassamento.volonta.domanda}
                voci={T.declassamento.volonta.voci}
                scelta={volontaDecl as never}
                scegli={setVolontaDecl}
              />
              <div>
                <label htmlFor="prezzo-decl" className="text-[15px] font-semibold text-inchiostro">
                  {T.declassamento.prezzo.domanda}
                </label>
                <p className="mt-1 text-[13px] leading-relaxed text-fumo">
                  {T.declassamento.prezzo.aiuto}
                </p>
                <div className="relative mt-2.5">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[16px] text-fumo-2"
                  >
                    €
                  </span>
                  <input
                    id="prezzo-decl"
                    type="text"
                    inputMode="decimal"
                    value={prezzo}
                    onChange={(e) => setPrezzo(e.target.value)}
                    placeholder={T.declassamento.prezzo.segnaposto}
                    /* 16px sul telefono, come gli altri campi: sotto quella
                       misura iOS zooma la pagina da solo. */
                    className="h-12 w-full rounded-xl border border-bordo bg-white pl-9 pr-4 text-[16px] outline-none transition-all duration-200 focus:border-verde/60 focus:ring-4 focus:ring-verde/10 sm:text-[15px]"
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              <Scelte
                domanda={T.coincidenza.unica.domanda}
                aiuto={T.coincidenza.unica.aiuto}
                voci={T.coincidenza.unica.voci}
                scelta={unica as never}
                scegli={setUnica}
              />
              <div>
                <label htmlFor="volo-coincidenza" className="text-[15px] font-semibold text-inchiostro">
                  {T.coincidenza.secondoVolo.domanda}
                </label>
                <p className="mt-1 text-[13px] leading-relaxed text-fumo">
                  {T.coincidenza.secondoVolo.aiuto}
                </p>
                <input
                  id="volo-coincidenza"
                  type="text"
                  autoCapitalize="characters"
                  spellCheck={false}
                  value={secondoVolo}
                  onChange={(e) => setSecondoVolo(e.target.value)}
                  placeholder={T.coincidenza.secondoVolo.segnaposto}
                  /* 16px sul telefono, come gli altri campi: sotto quella
                     misura iOS zooma la pagina da solo. */
                  className="mt-2.5 h-12 w-full rounded-xl border border-bordo bg-white px-4 text-[16px] outline-none transition-all duration-200 focus:border-verde/60 focus:ring-4 focus:ring-verde/10 sm:text-[15px]"
                />
              </div>
              <Scelte
                domanda={T.coincidenza.ritardo.domanda}
                voci={T.coincidenza.ritardo.voci}
                scelta={ritardoFinale as never}
                scegli={setRitardoFinale}
              />
            </>
          )}

          {errore && (
            <p role="alert" className="text-[14px] text-red-600">
              {errore}
            </p>
          )}

          <div>
            <button
              type="button"
              onClick={() => void manda()}
              disabled={!pronto || invio}
              className="riflesso h-13 w-full rounded-bottone bg-verde px-7 text-[15.5px] font-semibold text-white shadow-[0_14px_32px_-14px_rgba(10,157,92,.65)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-verde-scuro disabled:pointer-events-none disabled:opacity-50"
            >
              {invio ? COPY.comune.caricamento : T.bottone}
            </button>
            <p className="mt-2.5 text-center text-[12.5px] text-fumo-2">
              {demo ? T.notaDemo : T.nota}
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}
