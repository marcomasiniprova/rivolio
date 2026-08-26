"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Menu, RefreshCw } from "lucide-react";
import BarraLaterale from "./BarraLaterale";
import { sezioneDi } from "@/lib/admin/sezioni";

/**
 * IL GUSCIO DEL PANNELLO: barra laterale, testata, area di lavoro.
 *
 * Tiene lui lo stato del cassetto perché lo condividono in due (la barra
 * e il bottone nella testata), e tiene lui il rinfresco perché Valerio ha
 * chiesto «voci sempre aggiornate»: se ogni sezione se lo scrivesse da
 * sola, prima o poi una nascerebbe ferma.
 *
 * ⚠️ IL RINFRESCO NON RICARICA LA PAGINA. Prima il cruscotto usava
 * `<meta http-equiv="refresh">`, che è una ricaricata vera: perde il punto
 * dove stavi guardando, chiude i riquadri aperti e sbianca lo schermo ogni
 * venti secondi. `router.refresh()` invece rifà solo i dati e li incastra
 * al posto dei vecchi: la pagina non si muove e non lampeggia.
 *
 * ⚠️ IN SECONDO PIANO SI FERMA. Questo pannello resta aperto per giorni su
 * un secondo schermo: continuare a interrogare il database da una scheda
 * che nessuno guarda è lavoro pagato per niente.
 *
 * ⚠️ L'ORA DELL'AGGIORNAMENTO ARRIVA DAL SERVER, non da un orologio del
 * browser. È l'ora in cui i numeri sono stati letti davvero: se il server
 * ci mette due secondi a rispondere, quello che si legge in testata è il
 * momento della lettura e non quello della richiesta. Cambia da sola a
 * ogni rinfresco perché il guscio viene ridisegnato insieme ai dati.
 */

/** Venti secondi: abbastanza da sembrare in diretta, abbastanza da non pesare. */
const OGNI_MS = 20_000;

/**
 * 🔴 IL RINFRESCO GIRAVA SU TUTTE LE SEZIONI, ANCHE SU QUELLE FERME.
 *
 * Valerio, 12/08: «clicco una sezione e se va bene ci mette 3 secondi,
 * altrimenti non funziona proprio». Non era solo lentezza: era una gara.
 * Ogni venti secondi partiva una rilettura completa del pannello, anche
 * mentre lui stava aprendo un'altra sezione, e le due richieste si
 * accavallavano. Su Impostazioni e Prodotto poi non c'era proprio niente
 * da aggiornare: sono elenchi di come è configurato il sito, non numeri
 * che cambiano.
 *
 * Adesso si rinfrescano da sole SOLO le sezioni dove i numeri si muovono
 * davvero. Sulle altre il bottone "aggiorna" resta, e lo premi tu.
 */
const SEZIONI_VIVE = ["/admin", "/admin/cruscotto", "/admin/crescita", "/admin/registro"];

export default function Guscio({
  email,
  ora,
  children,
}: {
  email: string | null;
  /** L'ora della lettura, calcolata sul server. */
  ora: string;
  children: ReactNode;
}) {
  const percorso = usePathname() ?? "/admin";
  const sezione = sezioneDi(percorso);
  const router = useRouter();
  const [aperta, setAperta] = useState(false);
  const [inCorso, avvia] = useTransition();

  useEffect(() => {
    if (!aperta) return;
    const suTasto = (e: KeyboardEvent) => e.key === "Escape" && setAperta(false);
    window.addEventListener("keydown", suTasto);
    return () => window.removeEventListener("keydown", suTasto);
  }, [aperta]);

  const aggiorna = () => avvia(() => router.refresh());

  const sezioneViva = SEZIONI_VIVE.includes(percorso);

  useEffect(() => {
    if (!sezioneViva) return;
    let orologio: ReturnType<typeof setInterval> | null = null;

    const parti = () => {
      if (orologio) return;
      /* ⚠️ Non si rinfresca se c'è già qualcosa in volo: due letture
         sovrapposte non arrivano prima, arrivano tutte e due dopo. */
      orologio = setInterval(() => {
        if (document.hidden) return;
        router.refresh();
      }, OGNI_MS);
    };
    const fermati = () => {
      if (!orologio) return;
      clearInterval(orologio);
      orologio = null;
    };

    const suVisibilita = () => (document.hidden ? fermati() : parti());
    document.addEventListener("visibilitychange", suVisibilita);
    suVisibilita();

    return () => {
      fermati();
      document.removeEventListener("visibilitychange", suVisibilita);
    };
  }, [router, sezioneViva]);

  return (
    <div className="min-h-dvh bg-nebbia">
      {/* Le tre animazioni dei grafici, scritte QUI e una volta sola.
          Non stanno in globals.css perché sono roba del solo pannello:
          il foglio comune del sito non deve crescere per una schermata
          che vede una persona. Durano meno di mezzo secondo e partono a
          scaglioni: servono a far capire che il numero è appena arrivato,
          non a fare spettacolo. Chi ha chiesto meno animazioni non ne
          vede nessuna. */}
      <style>{`
        @keyframes g-sale { from { transform: scaleY(0); } to { transform: scaleY(1); } }
        @keyframes g-larga { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes g-entra { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .g-sale { transform-box: fill-box; transform-origin: bottom; animation: g-sale .5s var(--curva-fuori) backwards; animation-delay: calc(var(--n, 0) * 22ms); }
        .g-larga { transform-box: fill-box; transform-origin: center; animation: g-larga .5s var(--curva-fuori) backwards; animation-delay: calc(var(--n, 0) * 45ms); }
        .g-larga-sx { transform-origin: left center; animation: g-larga .5s var(--curva-fuori) backwards; animation-delay: calc(var(--n, 0) * 45ms); }
        .g-entra { animation: g-entra .45s var(--curva-fuori) backwards; }
        @media (prefers-reduced-motion: reduce) {
          .g-sale, .g-larga, .g-larga-sx, .g-entra { animation: none; }
        }
      `}</style>

      <BarraLaterale
        attiva={sezione.chiave}
        email={email}
        aperta={aperta}
        onChiudi={() => setAperta(false)}
      />

      <div className="md:pl-[240px]">
        {/* La testata resta attaccata in cima mentre il contenuto scorre:
            il titolo della sezione e l'ora dell'ultimo aggiornamento sono
            le due cose che si guardano di continuo. */}
        <header className="sticky top-0 z-20 border-b border-bordo bg-white/85 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1180px] items-center gap-3 px-4 py-3.5 sm:px-7">
            <button
              type="button"
              onClick={() => setAperta(true)}
              className="-ml-1 shrink-0 rounded-[10px] p-2 text-fumo transition-colors hover:bg-nebbia hover:text-inchiostro md:hidden"
              aria-label="Apri le sezioni"
            >
              <Menu className="size-5" aria-hidden="true" />
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-[19px] leading-tight tracking-[-0.03em] sm:text-[21px]">
                {sezione.nome}
              </h1>
              <p className="mt-0.5 hidden truncate text-[12.5px] text-fumo lg:block">
                {sezione.sotto}
              </p>
            </div>

            <button
              type="button"
              onClick={aggiorna}
              className="flex shrink-0 items-center gap-2 rounded-[10px] border border-bordo bg-white px-2.5 py-2 text-[12.5px] text-fumo transition-colors hover:border-verde/40 hover:text-inchiostro"
              title="Aggiorna adesso"
            >
              <RefreshCw
                className={`size-3.5 ${inCorso ? "animate-spin text-verde" : ""}`}
                aria-hidden="true"
              />
              {/* Il pallino verde è l'unico posto del pannello dove qualcosa
                  pulsa: dice che i numeri si muovono da soli. ⚠️ Sta FUORI
                  dal testo, se no sul telefono spariva insieme all'ora e il
                  bottone sembrava un semplice "ricarica".
                  🔴 E PULSAVA ANCHE DOVE NON SI AGGIORNA NIENTE: su
                  Impostazioni, Mappa e Prodotto i numeri non si muovono da
                  soli, ma il pallino e l'ora dicevano di sì. Un segnale di
                  "in diretta" su una schermata ferma insegna a non
                  fidarsi del pallino, che è l'unica cosa che dovrebbe dire
                  se stai guardando dati freschi.
                  Trovato dall'ispezione del 12/08. */}
              {sezioneViva && (
                <span
                  aria-hidden="true"
                  className="inline-block size-1.5 animate-pulse rounded-full bg-verde"
                />
              )}
              <span className="hidden sm:inline">
                {sezioneViva ? `aggiornato alle ${ora}` : "aggiorna"}
              </span>
              <span className="sr-only">Aggiorna adesso</span>
            </button>

            <span
              aria-hidden="true"
              title={email ?? undefined}
              className="grid size-9 shrink-0 place-items-center rounded-full bg-verde-notte font-display text-[14px] font-medium text-menta"
            >
              {(email ?? "?").slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-[1180px] px-4 pb-16 pt-5 sm:px-7 sm:pt-7">{children}</main>
      </div>
    </div>
  );
}
