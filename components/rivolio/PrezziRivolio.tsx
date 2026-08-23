import { Check } from "lucide-react";
import { Anima, AnimaLista, Figlio } from "@/components/Anima";
import ConfrontoBanconote from "./ConfrontoBanconote";
import { COPY } from "@/lib/copy";
import { listinoCorrente } from "@/lib/prezzi-server";

/**
 * I prezzi: check 1,99 di lancio (si scala dalla pratica), pratica 16,90€,
 * famiglia 29,90€. Le cifre non si scrivono qui: vengono dal listino
 * (listinoCorrente), cosi' la pagina e la cassa non possono divergere.
 * Niente altri SKU, niente toggle mensile/annuale: i prezzi sono una tantum.
 *
 * Il giro estetico dell'8/08 sera (scelta di Valerio col popup): i due
 * prodotti sono DUE CARTE D'IMBARCO affiancate, nello stesso linguaggio del
 * biglietto che il sito usa per lo scan (CartaImbarcoScan) e l'app per i
 * voli salvati: fascia scura in testa, strappo tratteggiato coi fori,
 * codice a barre nel tagliando. Il check gratis non è un terzo biglietto:
 * è la premessa, una striscia sopra le carte.
 *
 * Il confronto coi portali a percentuale resta sotto, e ogni cifra si
 * apre: la matematica è in COPY.prezzi.notaConfronto.
 *
 * I bottoni portano tutti al check (#controllo): sul sito non si compra
 * niente prima del verdetto, è il funnel (SPEC §3) e non si scavalca. Il
 * pagamento vero (Stripe) parte dal verdetto, dopo il check.
 */
const SEZIONE = COPY.prezzi;
const CHECK = SEZIONE.piani.check;

/* Il titolo viene da COPY; qui si decide solo dove cade il corsivo. */
const stacco = SEZIONE.titolo.indexOf(". ") + 2;
const titoloPrima = SEZIONE.titolo.slice(0, stacco).trimEnd();
const titoloCorsivo = SEZIONE.titolo.slice(stacco);

const CARTE = [
  { ...SEZIONE.piani.pratica, evidenza: true, apriNota: null, nota: null },
  { ...SEZIONE.piani.famiglia, evidenza: false, nastro: null },
] as const;

/** Lo strappo del biglietto: tratteggio e due fori che escono dai bordi. */
function Strappo({ evidenza }: { evidenza: boolean }) {
  const bordo = evidenza ? "border-verde" : "border-bordo";
  return (
    <div aria-hidden="true" className="flex items-center">
      <span
        className={`-ml-[9px] h-[18px] w-[18px] shrink-0 rounded-full border bg-nebbia ${bordo}`}
      />
      <span className="mx-2 flex-1 border-t-[1.5px] border-dashed border-bordo/90" />
      <span
        className={`-mr-[9px] h-[18px] w-[18px] shrink-0 rounded-full border bg-nebbia ${bordo}`}
      />
    </div>
  );
}

export default async function PrezziRivolio() {
  /* IL TEST DEI DUE PREZZI: le cifre qui sopra vengono dal listino che
     questa persona sta vedendo, non da COPY. Se il cookie manca è il
     listino di sempre, quindi la pagina non cambia. */
  const { listino } = await listinoCorrente();
  const prezzoDi = (nome: string) =>
    nome === COPY.prezzi.piani.famiglia.nome ? listino.famigliaTesto : listino.singolaTesto;
  return (
    <section id="prezzi" className="scroll-mt-24 px-5 py-13 sm:px-8 sm:py-16">
      <div className="mx-auto max-w-[1200px]">
        <Anima className="mx-auto max-w-2xl text-center">
          {/* L'occhiello a pillola col puntino, come nel riferimento. */}
          <p className="inline-flex items-center gap-2 rounded-pillola border border-bordo/70 bg-white px-4 py-1.5 text-[13px] font-medium text-inchiostro shadow-[0_6px_18px_-10px_rgba(5,46,31,.25)]">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-verde" />
            {SEZIONE.occhiello}
          </p>
          <h2 className="luce-testo mt-5 text-[clamp(2.25rem,5.2vw,3.5rem)] leading-[1.02]">
            {titoloPrima}
            <br />
            <span className="corsivo text-verde-scuro">{titoloCorsivo}</span>
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-[16.5px] leading-relaxed text-fumo">
            {SEZIONE.sottotitolo}
          </p>
        </Anima>

        {/* IL CHECK GRATUITO HA LA SUA SCHEDA, ed è la più grande della
            sezione (richiesta di Valerio, 9/08): è la cosa che distingue
            Rivolio da chi ti fa pagare per sapere se hai diritto. Prima
            era una strisciolina sopra i biglietti e si leggeva come una
            nota a piè di pagina. */}
        <Anima ritardo={0.05} className="mx-auto mt-12 max-w-[880px]">
          <div className="relative overflow-hidden rounded-[1.75rem] border-2 border-verde bg-white shadow-[0_34px_80px_-40px_rgba(10,157,92,.55)]">
            {/* l'alone verde dietro il numero: fa da faro alla cifra */}
            <span
              aria-hidden="true"
              className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-menta/45 blur-[70px]"
            />
            <span className="absolute right-0 top-0 rounded-bl-2xl bg-verde px-4 py-1.5 text-[11.5px] font-semibold uppercase tracking-[0.16em] text-white">
              {CHECK.nastro}
            </span>

            <div className="relative grid gap-7 p-6 sm:p-9 md:grid-cols-[auto_1fr] md:items-center md:gap-10">
              {/* la cifra, grande come merita */}
              <div className="text-center md:text-left">
                <p className="numeri font-display text-[76px] font-medium leading-[0.85] tracking-[-0.05em] text-verde sm:text-[92px]">
                  {CHECK.prezzo}
                </p>
                <p className="mt-2 text-[13.5px] font-medium uppercase tracking-[0.16em] text-fumo-2">
                  {CHECK.periodo}
                </p>
              </div>

              <div className="min-w-0">
                <h3 className="font-display text-[24px] font-medium leading-tight tracking-[-0.02em] text-inchiostro sm:text-[27px]">
                  {CHECK.nome}
                </h3>
                <p className="mt-2 text-[15.5px] leading-relaxed text-fumo">
                  {CHECK.descrizione}
                </p>

                {/* i punti si vedono ANCHE sul telefono: prima sparivano
                    sotto i 640px, cioè proprio dove passa la gente */}
                <ul className="mt-5 grid gap-2.5 sm:grid-cols-2">
                  {CHECK.punti.map((punto) => (
                    <li key={punto} className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-[19px] w-[19px] shrink-0 place-items-center rounded-full bg-menta-tenue">
                        <Check aria-hidden="true" strokeWidth={3} className="h-3 w-3 text-verde" />
                      </span>
                      <span className="text-[13.5px] leading-snug text-fumo">{punto}</span>
                    </li>
                  ))}
                </ul>

                {/* UN SOLO BOTTONE (Valerio, 15/08: «due bottoni uguali,
                    che senso ha?»). Prima ce n'erano due, tutti e due a
                    prezzo di lancio: uno portava al check, l'altro alla
                    cassa. Erano gemelli e confondevano. Resta quello che
                    porta al check, dove si mette il volo e si paga: è
                    l'unico che porta davvero all'analisi. */}
                <div className="mt-6">
                  <a
                    href="#controllo"
                    className="riflesso inline-flex h-13 w-full items-center justify-center gap-2 rounded-bottone bg-verde px-8 text-[16px] font-semibold text-white shadow-[0_16px_34px_-14px_rgba(10,157,92,.7)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-verde-scuro active:scale-[0.99] sm:w-auto"
                  >
                    {CHECK.bottone}
                    <span aria-hidden="true">→</span>
                  </a>
                </div>
                <p className="mt-3 text-[13px] text-fumo-2">{CHECK.rassicurazione}</p>
              </div>
            </div>
          </div>
        </Anima>

        {/* I due biglietti: la pratica e la famiglia, carte d'imbarco. */}
        <AnimaLista className="mx-auto mt-6 grid max-w-[880px] gap-6 md:grid-cols-2" passo={0.1}>
          {CARTE.map((p) => (
            <Figlio key={p.nome} className="flex">
              <div
                className={`flex flex-1 flex-col overflow-hidden rounded-3xl border bg-white ${
                  p.evidenza
                    ? "border-verde shadow-[0_32px_70px_-28px_rgba(10,157,92,.5)]"
                    : "border-bordo/70 shadow-[0_18px_44px_-32px_rgba(5,46,31,.3)]"
                }`}
              >
                {/* la fascia del documento, come sulla carta d'imbarco */}
                <div className="flex items-center justify-between gap-3 bg-verde-notte px-6 py-2.5">
                  <span className="truncate text-[11px] font-medium uppercase tracking-[0.22em] text-menta/80">
                    {p.nome}
                  </span>
                  {p.nastro ? (
                    <span className="shrink-0 rounded-pillola bg-verde px-2.5 py-0.5 text-[11px] font-medium text-white">
                      {p.nastro}
                    </span>
                  ) : (
                    <span className="numeri shrink-0 text-[10px] uppercase tracking-[0.14em] text-white/50">
                      Boarding pass
                    </span>
                  )}
                </div>

                {/* il corpo del biglietto */}
                <div className="flex flex-1 flex-col px-6 pb-5 pt-5 sm:px-7">
                  <p className="text-[14px] leading-relaxed text-fumo">{p.descrizione}</p>

                  {/* Il prezzo grande col suffisso attaccato: "una volta
                      sola" sta accanto alla cifra, non a fondo pagina. */}
                  <p className="numeri mt-5 font-display text-[40px] font-medium leading-none tracking-[-0.04em] text-inchiostro">
                    {prezzoDi(p.nome)}
                    <span className="ml-2 font-sans text-[13px] font-normal tracking-normal text-fumo-2">
                      {p.periodo}
                    </span>
                  </p>

                  {/* La garanzia, proprio sotto il prezzo: è l'obiezione
                      numero uno di chi sta per pagare, e va tolta di dosso
                      dove si decide (scelta di Valerio col popup, 9/08). */}
                  <p className="mt-3 flex items-start gap-2 rounded-xl bg-menta-tenue/70 px-3 py-2 text-[12.5px] font-medium leading-snug text-verde-scuro">
                    <span
                      aria-hidden="true"
                      className="mt-px grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full bg-verde"
                    >
                      <Check strokeWidth={3.2} className="h-2.5 w-2.5 text-white" />
                    </span>
                    {SEZIONE.garanziaCarta}
                  </p>

                  <ul className="mt-5 flex-1 space-y-2.5 border-t border-bordo/60 pt-5">
                    {p.punti.map((punto) => (
                      <li key={punto} className="flex items-start gap-2.5">
                        <span className="mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-menta-tenue">
                          <Check
                            aria-hidden="true"
                            strokeWidth={2.8}
                            className="h-3 w-3 text-verde"
                          />
                        </span>
                        <span className="text-[13.5px] leading-relaxed text-fumo">{punto}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Il "1.000€" della famiglia si apre: la trasparenza è il prodotto. */}
                  {p.nota && p.apriNota && (
                    <details className="group mt-4">
                      <summary className="tocco-comodo inline-flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-fumo underline decoration-dotted underline-offset-4 transition-colors marker:hidden hover:text-verde">
                        {p.apriNota}
                        <span
                          aria-hidden="true"
                          className="text-[10px] transition-transform duration-300 group-open:rotate-90"
                        >
                          ▸
                        </span>
                      </summary>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-fumo">{p.nota}</p>
                    </details>
                  )}
                </div>

                {/* lo strappo e il tagliando col codice a barre */}
                <Strappo evidenza={p.evidenza} />
                <div className="px-6 pb-6 pt-4 sm:px-7">
                  <a
                    href="#controllo"
                    className={`block rounded-bottone py-3.5 text-center text-[15px] font-medium text-white transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98] ${
                      p.evidenza
                        ? "riflesso bg-verde shadow-[0_12px_28px_-12px_rgba(6,122,70,.75),0_2px_0_0_rgba(255,255,255,.22)_inset] hover:bg-verde-scuro"
                        : "bg-inchiostro hover:bg-inchiostro/85"
                    }`}
                  >
                    {p.bottone}
                  </a>
                  {/* Il timbro, centrato. Il codice a barre che c'era
                      qui sembrava un'etichetta da supermercato: via. */}
                  <p className="numeri mt-4 text-center text-[9.5px] uppercase tracking-[0.2em] text-fumo-2">
                    Rivolio · Reg. CE 261/2004
                  </p>
                </div>
              </div>
            </Figlio>
          ))}
        </AnimaLista>

        {/* IL CONFRONTO COI PORTALI, con le banconote che se ne volano
            via (scelta di Valerio col popup, 9/08). Era un riquadro con
            due righe di testo: giusto nei numeri, invisibile agli occhi.
            Il "come nasce" apre la matematica dichiarata, come sempre. */}
        <Anima ritardo={0.08} className="mx-auto mt-10 max-w-3xl">
          <div className="rounded-2xl border border-bordo/70 bg-white p-5 sm:p-6">
            <ConfrontoBanconote prezzoNostro={listino.singola} />
            <details className="group mt-5 border-t border-bordo/60 pt-4">
              <summary className="tocco-comodo inline-flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-fumo underline decoration-dotted underline-offset-4 transition-colors marker:hidden hover:text-verde">
                {COPY.comune.apriIlConto}
                <span
                  aria-hidden="true"
                  className="text-[11px] transition-transform duration-300 group-open:rotate-90"
                >
                  ▸
                </span>
              </summary>
              <p className="mt-2.5 text-[13.5px] leading-relaxed text-fumo">
                {SEZIONE.notaConfronto}
              </p>
            </details>
          </div>
        </Anima>

        {/* ⚠️ QUESTA RIGA NON È UNA NOTA A PIÈ DI PAGINA (richiesta di
            Valerio, 12/08: «enfatizzala, coloriscila, centrala,
            ingrandiscila di pochissimo»). Ha ragione: è la risposta
            all'obiezione che uno si fa da solo guardando un prezzo su
            internet, cioè «e poi cosa mi arriva dopo». Era grigia a 14
            punti sotto due card enormi, quindi non la leggeva nessuno.
            Adesso è una pillola verde chiaro, centrata, a 15,5 punti:
            un filo più grande e un colore, non un titolo. */}
        <Anima ritardo={0.1}>
          <p className="mt-9 flex justify-center">
            <span className="inline-flex items-center gap-2.5 rounded-pillola border border-verde/20 bg-menta-tenue px-5 py-2.5 text-center text-[15.5px] font-medium text-verde-scuro">
              <Check className="size-4 shrink-0" aria-hidden="true" />
              {SEZIONE.promemoria}
            </span>
          </p>
        </Anima>
      </div>
    </section>
  );
}
