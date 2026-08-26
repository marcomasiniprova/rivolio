"use client";

import Link from "next/link";
import { Map,
  Activity,
  Calculator,
  Cog,
  FolderOpen,
  Gavel,
  LayoutDashboard,
  LogOut,
  Mail,
  Search,
  Settings,
  Share2,
  Smartphone,
  Star,
  TrendingUp,
  Users,
  X,
} from "lucide-react";
import { Marchio } from "@/components/Logo";
import { SEZIONI, type ChiaveSezione } from "@/lib/admin/sezioni";
import { esci } from "@/app/entra/azioni";

/**
 * LA BARRA LATERALE (richiesta di Valerio, 11/08: «metti le sezioni a
 * lato non sopra»).
 *
 * È il pezzo che fa la differenza fra una pagina e un gestionale: le
 * sezioni restano sempre sott'occhio, si vede dove sei senza leggere
 * l'indirizzo, e si passa da una all'altra senza tornare indietro.
 *
 * ⚠️ SUL TELEFONO NON DIVENTA UNA BARRA IN CIMA. A 390 punti una colonna
 * fissa da 240 mangerebbe due terzi dello schermo, ma trasformarla in un
 * menu orizzontale sarebbe proprio la cosa che Valerio ha chiesto di non
 * fare. Quindi resta una barra laterale, e sul telefono entra da sinistra
 * quando la chiami: stessa forma, stesso ordine, stesse voci.
 *
 * Lo stato "aperta" non vive qui ma nel Guscio, perché lo condivide col
 * bottone che sta nella testata.
 */

const ICONE: Record<ChiaveSezione, typeof LayoutDashboard> = {
  motore: Cog,
  mappa: Map,
  panoramica: LayoutDashboard,
  economia: Calculator,
  verdetti: Gavel,
  recensioni: Star,
  pratiche: FolderOpen,
  traffico: TrendingUp,
  passaparola: Share2,
  affiliati: Users,
  registro: Activity,
  iscritti: Mail,
  prodotto: Smartphone,
  impostazioni: Settings,
};

type Props = {
  attiva: ChiaveSezione;
  email: string | null;
  aperta: boolean;
  onChiudi: () => void;
};

function Voce({
  href,
  nome,
  Icona,
  accesa,
  onVai,
  servizio = false,
}: {
  href: string;
  nome: string;
  Icona: typeof LayoutDashboard;
  accesa: boolean;
  /* Il cassetto si chiude QUI, al clic, e non con un effetto sul cambio
     di indirizzo: restare aperto sopra la schermata appena scelta è il
     difetto classico dei menu sul telefono. */
  onVai: () => void;
  servizio?: boolean;
}) {
  return (
    <Link
      href={href}
      onClick={onVai}
      aria-current={accesa ? "page" : undefined}
      className={`group relative flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[14px] transition-colors ${
        accesa
          ? "bg-menta-tenue font-medium text-verde-scuro"
          : servizio
            ? "text-fumo-2 hover:bg-nebbia hover:text-fumo"
            : "text-fumo hover:bg-nebbia hover:text-inchiostro"
      }`}
    >
      {/* Il segno della voce attiva: una barretta verde attaccata al bordo
          sinistro. Il fondo verde tenue da solo si confonde con un
          passaggio del mouse; questa dice "sei qui" e basta. */}
      <span
        aria-hidden="true"
        className={`absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-verde transition-opacity ${
          accesa ? "opacity-100" : "opacity-0"
        }`}
      />
      <Icona
        className={`size-[17px] shrink-0 ${accesa ? "text-verde" : "text-fumo-2 group-hover:text-fumo"}`}
        aria-hidden="true"
      />
      {nome}
    </Link>
  );
}

function Contenuto({ attiva, email, onChiudi }: Omit<Props, "aperta">) {
  return (
    <div className="flex h-full flex-col gap-5 px-4 py-5">
      <div className="flex items-center justify-between gap-2 px-1">
        <Link href="/admin" className="flex items-center gap-2.5" aria-label="Rivolio, pannello">
          <Marchio className="size-8" />
          <span className="font-display text-[16px] font-medium leading-none tracking-[-0.03em]">
            Rivo<span className="text-verde">lio</span>
          </span>
          <span className="rounded-pillola bg-nebbia px-1.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-fumo-2">
            pannello
          </span>
        </Link>
        <button
          type="button"
          onClick={onChiudi}
          className="rounded-[10px] p-1.5 text-fumo hover:bg-nebbia md:hidden"
          aria-label="Chiudi le sezioni"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      {/* La ricerca È VERA: porta al registro filtrato. Un campo che non
          cerca niente è la prima cosa che fa capire che un pannello è una
          figura e non uno strumento. */}
      <form action="/admin/registro" className="relative">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fumo-2"
          aria-hidden="true"
        />
        <input
          type="search"
          name="cerca"
          placeholder="Cerca un volo"
          aria-label="Cerca nel registro"
          /* ⚠️ 16px sul telefono: sotto quella misura iOS ingrandisce da
             solo appena si tocca il campo, e il cassetto della barra resta
             zoomato. Sul computer torna a 13,5, che è la misura giusta per
             una barra laterale stretta. */
          className="h-10 w-full rounded-[10px] border border-bordo bg-nebbia pl-9 pr-3 text-[16px] text-inchiostro outline-none transition-colors placeholder:text-fumo-2 focus:border-verde/45 focus:bg-white sm:text-[13.5px]"
        />
      </form>

      <nav className="flex flex-col gap-0.5" aria-label="Sezioni del pannello">
        {SEZIONI.map((s) => (
          <Voce
            key={s.href}
            href={s.href}
            nome={s.nome}
            Icona={ICONE[s.chiave]}
            accesa={s.chiave === attiva}
            onVai={onChiudi}
          />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-bordo pt-4">
        {/* 🔴 «ESCI DAL PANNELLO NON FUNZIONA, RESTO BLOCCATO DENTRO»
            (Valerio, 18/08). Era un Link a /app che non ti portava fuori.
            Scelta col popup: adesso è un LOGOUT vero. Chiude la sessione
            (stessa azione `esci` della web app) e riporta alla home
            pubblica; per rientrare nel pannello si rifà l'accesso. */}
        <form action={esci}>
          <button
            type="submit"
            className="group relative flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[14px] text-fumo-2 transition-colors hover:bg-nebbia hover:text-fumo"
          >
            <LogOut
              className="size-[17px] shrink-0 text-fumo-2 group-hover:text-fumo"
              aria-hidden="true"
            />
            Esci dal pannello
          </button>
        </form>
        {email && (
          <p className="truncate px-3 pt-3 text-[11.5px] text-fumo-2" title={email}>
            {email}
          </p>
        )}
      </div>
    </div>
  );
}

export default function BarraLaterale({ attiva, email, aperta, onChiudi }: Props) {
  return (
    <>
      {/* Fissa sul desktop: non scorre col contenuto, come nei gestionali. */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[240px] border-r border-bordo bg-white md:block">
        <Contenuto attiva={attiva} email={email} onChiudi={onChiudi} />
      </aside>

      {/* Il cassetto del telefono. Resta montato anche da chiuso: così il
          testo già scritto nel campo di ricerca non sparisce quando si
          chiude per sbaglio. */}
      <div
        className={`fixed inset-0 z-50 md:hidden ${aperta ? "" : "pointer-events-none"}`}
        aria-hidden={!aperta}
      >
        <button
          type="button"
          tabIndex={-1}
          aria-label="Chiudi le sezioni"
          onClick={onChiudi}
          className={`absolute inset-0 bg-verde-notte/35 transition-opacity duration-200 ${
            aperta ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute inset-y-0 left-0 w-[268px] max-w-[86vw] border-r border-bordo bg-white transition-transform duration-300 [transition-timing-function:var(--curva-fuori)] ${
            aperta ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Contenuto attiva={attiva} email={email} onChiudi={onChiudi} />
        </div>
      </div>
    </>
  );
}
