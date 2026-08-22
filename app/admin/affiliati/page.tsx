import { soloAdmin } from "@/lib/admin/guardia";
import { Avviso, Kpi, euro } from "@/components/admin/Pezzi";
import { leggiAffiliati } from "@/lib/affiliati/lettura";
import { leggiCreatori } from "@/lib/affiliati/creatore";
import { casa } from "@/lib/sito";
import PannelloAffiliati from "@/components/admin/affiliati/PannelloAffiliati";

/**
 * GLI AFFILIATI (i creator): quanto hanno portato e quanto gli devi.
 *
 * Il pagamento è a mano (scelta di Valerio): il pannello somma il non pagato
 * per creator, tu saldi con bonifico e premi "Segna pagato". Niente Stripe
 * Connect: al lancio, coi primi creator, un bonifico ogni tanto è più
 * semplice di far aprire a ciascuno un account e verificarsi.
 */
export const dynamic = "force-dynamic";

export default async function PaginaAffiliati() {
  /* Prima riga, sempre. Vedi lib/admin/guardia.ts. */
  await soloAdmin();

  const righe = await leggiAffiliati();
  if (righe === null) {
    return (
      <Avviso titolo="Il database non ha risposto.">
        I creator e le commissioni si leggono con la chiave di servizio: se non c&apos;è, o il
        database è giù, qui non compare niente. Riprova fra poco.
      </Avviso>
    );
  }

  const attivi = righe.filter((r) => r.attivo).length;
  const daPagare = Math.round(righe.reduce((t, r) => t + r.daPagare, 0) * 100) / 100;
  const maturato = Math.round(righe.reduce((t, r) => t + r.maturato, 0) * 100) / 100;

  /* I creator gratis a vita: lettura a parte (l'email sta nell'auth, non nei
     profili). Se il database non risponde torna null: il pannello lo dice, non
     mostra una lista vuota che sembrerebbe "nessuno". */
  const creatori = await leggiCreatori();

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi
          etichetta="Da pagare, in tutto"
          valore={euro(daPagare)}
          forte
          nota="Quello che devi ai creator adesso."
        />
        <Kpi etichetta="Creator attivi" valore={String(attivi)} nota={`${righe.length} in tutto`} />
        <Kpi
          etichetta="Commissioni maturate"
          className="col-span-2 sm:col-span-1"
          valore={euro(maturato)}
          nota="Da che è partito il programma."
        />
      </div>

      <PannelloAffiliati righe={righe} base={casa()} creatori={creatori} />
    </div>
  );
}
