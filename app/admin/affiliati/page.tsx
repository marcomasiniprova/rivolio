import { soloAdmin } from "@/lib/admin/guardia";
import { Avviso, Kpi, euro } from "@/components/admin/Pezzi";
import { leggiAffiliati } from "@/lib/affiliati/lettura";
import { leggiCreatori } from "@/lib/affiliati/creatore";
import { linkCruscottoCreator } from "@/lib/affiliati/accesso";
import { casa } from "@/lib/sito";
import PannelloAffiliati from "@/components/admin/affiliati/PannelloAffiliati";

/**
 * GLI AFFILIATI (i creator): quanto hanno portato e quanto gli devi, per
 * intero. Ogni creator ha il suo link ?ref, il suo link privato di cruscotto,
 * i risultati veri (clic, check, singole, famiglia) e i soldi (40% + bonus a
 * soglie + fisso). Il pagamento è a mano: "Segna pagato" chiude base, bonus
 * e fisso insieme.
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
  const daPagare = Math.round(righe.reduce((t, r) => t + r.daPagareTotale, 0) * 100) / 100;
  const clic = righe.reduce((t, r) => t + r.click, 0);
  const maturato =
    Math.round(righe.reduce((t, r) => t + r.baseMaturato + r.bonus.totale, 0) * 100) / 100;

  const base = casa();
  const links: Record<string, string | null> = {};
  for (const r of righe) links[r.id] = linkCruscottoCreator(r.codice, base);

  /* I creator gratis a vita: lettura a parte (l'email sta nell'auth). Se il
     database non risponde torna null: il pannello lo dice. */
  const creatori = await leggiCreatori();

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi
          etichetta="Da pagare, in tutto"
          valore={euro(daPagare)}
          forte
          nota="Base 40% + bonus + fisso."
        />
        <Kpi etichetta="Creator attivi" valore={String(attivi)} nota={`${righe.length} in tutto`} />
        <Kpi
          etichetta="Clic sui link"
          valore={clic.toLocaleString("it-IT")}
          nota="Aperture dei link ?ref."
        />
        <Kpi
          etichetta="Commissioni maturate"
          valore={euro(maturato)}
          nota="Base + bonus, da che è partito."
        />
      </div>

      <PannelloAffiliati righe={righe} base={base} creatori={creatori} links={links} />
    </div>
  );
}
