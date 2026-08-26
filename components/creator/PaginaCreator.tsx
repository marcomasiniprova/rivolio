import type { ReactNode } from "react";
import { datiCreator, type CreatorPieno } from "@/lib/affiliati/lettura";
import { linkCortoCreator, linkCruscottoCreator } from "@/lib/affiliati/accesso";
import DashboardCreator from "./DashboardCreator";

/**
 * Il guscio server della pagina del creator: risolve il link e gli stati
 * (link non valido, database giù), poi passa i dati alla dashboard client.
 * Lo usano sia il link corto (/creator/<token>) sia il vecchio link firmato
 * (/creator/cruscotto?t=...).
 */

function Schermo({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-[1.6rem] tracking-[-0.02em] text-inchiostro">{titolo}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-fumo">{children}</p>
    </main>
  );
}

export default function PaginaCreator({
  creator,
  errore,
  base,
}: {
  creator: CreatorPieno | null;
  errore: boolean;
  base: string;
}) {
  if (errore) {
    return (
      <Schermo titolo="Torna fra poco.">
        Non riusciamo a leggere i tuoi numeri in questo momento. Riprova più tardi.
      </Schermo>
    );
  }
  if (!creator) {
    return (
      <Schermo titolo="Link non valido.">
        Questo indirizzo non apre nessun cruscotto. Chiedi a Rivolio il tuo link giusto.
      </Schermo>
    );
  }
  const link =
    linkCortoCreator(creator.token, base) ??
    linkCruscottoCreator(creator.codice, base) ??
    `${base}/creator/${creator.token ?? ""}`;
  return <DashboardCreator dati={datiCreator(creator, link)} />;
}
