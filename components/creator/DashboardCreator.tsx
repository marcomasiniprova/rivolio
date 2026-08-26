"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Gift,
  Lock,
  MousePointerClick,
  Search,
  Ticket,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { Marchio } from "@/components/Logo";
import CruscottoCopia from "@/components/creator/CruscottoCopia";
import type { DatiCreator, Traguardo } from "@/lib/affiliati/lettura";

/**
 * LA DASHBOARD DEL CREATOR (scelta di Valerio col popup, 26/08: gamification
 * e sblocchi). Una pagina che il creator ha voglia di aprire ogni giorno:
 * numeri vivi che salgono contando, traguardi da sbloccare con la barra che
 * si riempie, brandizzata Rivolio. Trasparente sui SUOI numeri, muta sui
 * margini interni (IVA, cassa): quelli non li vede mai.
 *
 * Si aggiorna DA SOLA ogni 30 secondi senza ricaricare (router.refresh), e si
 * ferma quando la scheda non è in primo piano. Rispetta chi ha chiesto meno
 * animazioni.
 */

const eur = (n: number) =>
  `${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const intero = (n: number) => Math.round(n).toLocaleString("it-IT");

/** Un numero che sale contando, da dove stava al nuovo valore. */
function useConta(target: number, animato: boolean, durata = 900): number {
  const [v, setV] = useState(animato ? 0 : target);
  const daRef = useRef(animato ? 0 : target);
  useEffect(() => {
    const da = daRef.current;
    if (!animato || da === target) {
      setV(target);
      daRef.current = target;
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / durata);
      const e = 1 - Math.pow(1 - p, 3);
      setV(da + (target - da) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
      else daRef.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, animato, durata]);
  return v;
}

function StatTile({
  Icona,
  etichetta,
  valore,
  animato,
}: {
  Icona: typeof MousePointerClick;
  etichetta: string;
  valore: number;
  animato: boolean;
}) {
  const v = useConta(valore, animato);
  return (
    <div className="rounded-[16px] border border-bordo bg-white p-4">
      <div className="flex items-center gap-2 text-fumo-2">
        <Icona className="size-4" aria-hidden="true" />
        <span className="text-[11px] font-medium uppercase tracking-[0.1em]">{etichetta}</span>
      </div>
      <p className="numeri mt-1.5 text-[26px] font-semibold leading-none text-inchiostro">
        {intero(v)}
      </p>
    </div>
  );
}

function BarraTraguardo({ t, animato }: { t: Traguardo; animato: boolean }) {
  const [montato, setMontato] = useState(false);
  useEffect(() => setMontato(true), []);
  const pct = t.segmento > 0 ? Math.min(100, Math.round((t.dentro / t.segmento) * 100)) : 0;
  const largo = montato || !animato ? pct : 0;
  const titolo =
    t.chiave === "check" ? "Check portati" : t.chiave === "famiglia" ? "Pratiche famiglia" : "Pratiche singole";

  return (
    <div className="rounded-[16px] border border-bordo bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-medium text-inchiostro">{titolo}</span>
          {t.sbloccati > 0 && (
            <span className="inline-flex items-center gap-1 rounded-pillola bg-menta-tenue px-2 py-0.5 text-[11px] font-medium text-verde-scuro">
              <Check className="size-3" aria-hidden="true" />
              {t.sbloccati} sbloccat{t.sbloccati === 1 ? "o" : "i"}
            </span>
          )}
        </div>
        <span className="numeri text-[12.5px] text-fumo">
          {intero(t.fatte)} / {intero(t.prossimaSoglia)}
        </span>
      </div>

      <div className="relative mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-nebbia">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[linear-gradient(90deg,#0a9d5c,#14c06e)]"
          style={{
            width: `${largo}%`,
            transition: animato ? "width 900ms cubic-bezier(0.22,1,0.36,1)" : "none",
          }}
        />
      </div>

      <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-fumo">
        <Gift className="size-3.5 text-verde" aria-hidden="true" />
        Ancora <b className="numeri text-inchiostro">{intero(t.mancano)}</b> e sblocchi{" "}
        <b className="numeri text-verde-scuro">+{eur(t.premio)}</b>
      </p>
    </div>
  );
}

export default function DashboardCreator({ dati }: { dati: DatiCreator }) {
  const router = useRouter();
  const [animato, setAnimato] = useState(true);

  // Meno animazioni se l'utente le ha chieste ridotte.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mq.matches) setAnimato(false);
  }, []);

  // Vivo: si aggiorna da solo, e si ferma quando la scheda è in secondo piano.
  useEffect(() => {
    const id = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 30_000);
    return () => clearInterval(id);
  }, [router]);

  const totale = useConta(dati.totaleMaturato, animato, 1100);

  return (
    <main className="mx-auto w-full max-w-3xl px-5 py-8 sm:py-12">
      {/* ── HERO brandizzato ─────────────────────────────────────────── */}
      <section
        className="relative overflow-hidden rounded-[24px] p-6 text-white sm:p-8"
        style={{ background: "linear-gradient(140deg, #06301f 0%, #0a7a46 100%)" }}
      >
        {/* alone morbido, profondità */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-16 -top-16 size-56 rounded-full opacity-40 blur-2xl"
          style={{ background: "radial-gradient(circle, #6ff0ad 0%, transparent 70%)" }}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-[10px] bg-white">
              <Marchio className="size-5" />
            </span>
            <span className="font-display text-[16px] font-medium tracking-[-0.02em]">
              Rivo<span className="text-menta">lio</span>
            </span>
            <span className="rounded-pillola bg-white/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em]">
              creator
            </span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-pillola px-2.5 py-1 text-[11.5px] font-medium ${
              dati.attivoDiRecente ? "bg-white/15 text-white" : "bg-white/10 text-white/70"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${dati.attivoDiRecente ? "bg-menta" : "bg-white/50"} ${
                dati.attivoDiRecente && animato ? "animate-pulse" : ""
              }`}
            />
            {dati.attivoDiRecente ? "Attivo" : "In pausa"}
          </span>
        </div>

        <p className="relative mt-6 text-[15px] text-white/80">Ciao {dati.nome.split(" ")[0]}</p>
        <p className="relative mt-1 text-[13px] text-white/60">Hai guadagnato finora</p>
        <p className="relative mt-1 font-display text-[46px] font-semibold leading-none tracking-[-0.03em] sm:text-[56px]">
          {eur(totale)}
        </p>
        <div className="relative mt-4 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[13px] text-white/80">
          <span>
            Da ricevere: <b className="numeri text-white">{eur(dati.daRicevere)}</b>
          </span>
          <span className="text-white/50">·</span>
          <span>Pagamento ogni {dati.giorniPagamento} giorni</span>
        </div>
      </section>

      {/* ── IL LINK ──────────────────────────────────────────────────── */}
      <section className="mt-4 rounded-[18px] border border-verde/30 bg-menta-tenue p-5">
        <p className="text-[13px] font-medium text-verde-scuro">Il tuo link</p>
        <p className="mt-1.5 break-all font-mono text-[15px] text-inchiostro">{dati.link}</p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <CruscottoCopia testo={dati.link} />
          <span className="text-[12.5px] text-fumo">
            Chi lo apre trova <b className="text-inchiostro">{dati.scontoPercento}% di sconto</b>.
          </span>
        </div>
      </section>

      {/* ── NUMERI LIVE ──────────────────────────────────────────────── */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile Icona={MousePointerClick} etichetta="Clic" valore={dati.clic} animato={animato} />
        <StatTile Icona={Search} etichetta="Check" valore={dati.nCheck} animato={animato} />
        <StatTile Icona={Ticket} etichetta="Singole" valore={dati.nSingola} animato={animato} />
        <StatTile Icona={Users} etichetta="Famiglia" valore={dati.nFamiglia} animato={animato} />
      </section>

      {/* ── TRAGUARDI DA SBLOCCARE ───────────────────────────────────── */}
      <section className="mt-6">
        <div className="flex items-center gap-2">
          <Trophy className="size-[18px] text-verde" aria-hidden="true" />
          <h2 className="font-display text-[1.25rem] tracking-[-0.02em] text-inchiostro">
            Traguardi da sbloccare
          </h2>
        </div>
        <p className="mt-1 text-[13px] text-fumo">
          Ogni soglia è un bonus in più, sopra il tuo 40%. Più pubblichi, più sblocchi.
        </p>
        <div className="mt-3 grid gap-3">
          {dati.traguardi.map((t) => (
            <BarraTraguardo key={t.chiave} t={t} animato={animato} />
          ))}
        </div>
      </section>

      {/* ── GUADAGNI NEL DETTAGLIO ───────────────────────────────────── */}
      <section className="mt-6 rounded-[18px] border border-bordo bg-white p-5">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-[18px] text-verde" aria-hidden="true" />
          <h2 className="font-display text-[1.15rem] tracking-[-0.02em] text-inchiostro">
            I tuoi guadagni
          </h2>
        </div>
        <ul className="mt-3 space-y-1.5 text-[13.5px] text-fumo">
          <li className="flex justify-between">
            <span>Commissioni (40% su ogni pratica)</span>
            <span className="numeri text-inchiostro">{eur(dati.baseMaturato)}</span>
          </li>
          <li className="flex justify-between">
            <span>Bonus a soglie</span>
            <span className="numeri text-inchiostro">{eur(dati.bonusTotale)}</span>
          </li>
          {dati.fissoAttivo && (
            <li className="flex justify-between">
              <span>Fisso una-tantum {dati.fissoPagato ? "(pagato)" : "(al primo contenuto)"}</span>
              <span className="numeri text-inchiostro">{eur(dati.bonusFisso)}</span>
            </li>
          )}
        </ul>
        <div className="mt-3 flex items-baseline justify-between gap-3 rounded-[12px] bg-menta-tenue px-4 py-3">
          <span className="text-[13px] font-medium text-verde-scuro">
            Da ricevere al prossimo pagamento
          </span>
          <span className="numeri text-[18px] font-semibold text-verde-scuro">
            {eur(dati.daRicevere)}
          </span>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-fumo-2">
          Paghiamo ogni {dati.giorniPagamento} giorni, con bonifico, sulle pratiche consolidate. Se
          una pratica non va a buon fine il cliente riceve un credito, non un rimborso in contanti:
          la tua commissione resta.
        </p>
      </section>

      {/* ── COME SI GUADAGNA ─────────────────────────────────────────── */}
      <section className="mt-4 rounded-[18px] border border-bordo bg-white p-5">
        <p className="text-[14px] font-medium text-inchiostro">Come si guadagna, per intero</p>
        <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-fumo">
          <li>
            <b className="text-inchiostro">40%</b> su ogni pratica pagata che arriva dal tuo link.
          </li>
          <li>
            Bonus pratiche singole ({eur(dati.prezzoSingola)}):{" "}
            <b className="text-inchiostro">20€</b> alle 10, poi <b className="text-inchiostro">50€</b>{" "}
            ogni 25.
          </li>
          <li>
            Bonus pratiche famiglia ({eur(dati.prezzoFamiglia)}):{" "}
            <b className="text-inchiostro">50€</b> ogni 10.
          </li>
          <li>
            Bonus check pagati: <b className="text-inchiostro">50€</b> ogni 100.
          </li>
          {dati.fissoAttivo && (
            <li className="flex items-start gap-1.5">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-verde" aria-hidden="true" />
              Il tuo accordo ha anche un <b className="text-inchiostro">fisso una-tantum</b> al primo
              contenuto pubblicato.
            </li>
          )}
        </ul>
        <p className="mt-4 border-t border-bordo pt-3 text-[12.5px] text-fumo-2">
          Numeri veri, aggiornati dal vivo. Domande, o vuoi cambiare qualcosa? Scrivi a Rivolio.
        </p>
      </section>
    </main>
  );
}
