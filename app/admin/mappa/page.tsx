import type { Metadata } from "next";
import Mappa from "@/components/admin/Mappa";
import { soloAdmin } from "@/lib/admin/guardia";
import { conto } from "@/lib/admin/mappa";

/**
 * LA LAVAGNA DEL BUSINESS.
 *
 * ⚠️ Perché non ci sono numeri qui dentro: scelta di Valerio (12/08),
 * «i numeri li dà il pannello, la whiteboard è la MACROVISTA di tutto
 * Rivolio». Questa pagina risponde a «come funziona», il cruscotto
 * risponde a «come sta andando». Tenerle separate vuol dire che nessuna
 * delle due invecchia per colpa dell'altra.
 *
 * ⚠️ LO SCHERMO INTERO VIVE DENTRO LA MAPPA, non in una pagina a parte.
 * Prima c'era un link a `/admin/mappa/piena` con `target="_blank"`: quella
 * pagina però stava DENTRO il guscio del pannello (barra + testata +
 * larghezza massima), quindi «schermo pieno» era una promessa falsa, e la
 * scheda nuova quando non si apriva lasciava Valerio sulla stessa pagina.
 * Adesso il bottone «Schermo intero» sta fra i comandi della mappa e apre
 * un velo a tutto schermo nella stessa scheda: niente rotta, niente crash.
 */
export const metadata: Metadata = {
  title: "La mappa | Rivolio",
  robots: { index: false, follow: false },
};

export default async function PaginaMappa() {
  await soloAdmin();
  const c = conto();

  return (
    <div>
      <p className="mb-4 text-[14px] leading-relaxed text-fumo">
        Tutto Rivolio in una schermata: da dove arriva la gente, cosa compra, dove
        entrano i soldi e cosa succede dopo.{" "}
        <strong className="text-inchiostro">
          {c.fatto} pezzi funzionano, {c.spento} sono costruiti ma spenti, {c.manca} non
          ci sono ancora.
        </strong>{" "}
        Le strade tratteggiate sono quelle che oggi si interrompono. Il bottone{" "}
        <strong className="text-inchiostro">Schermo intero</strong> apre la mappa larga
        quanto lo schermo; si esce con Esc.
      </p>
      <Mappa />
    </div>
  );
}
