import { leggiAffiliati } from "@/lib/affiliati/lettura";
import { SERVIZIO_ATTIVO } from "@/lib/supabase/servizio";
import { casa } from "@/lib/sito";
import PaginaCreator from "@/components/creator/PaginaCreator";

/**
 * Il cruscotto del creator dal link CORTO e privato: rivolio.it/creator/<token>.
 * Il token è la chiave: non serve account. Bello da mandare, non indovinabile.
 */
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Il tuo cruscotto | Rivolio",
  robots: { index: false, follow: false },
};

export default async function CruscottoSlug({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let creator = null;
  let errore = false;
  if (!SERVIZIO_ATTIVO) {
    errore = true;
  } else {
    const tutti = await leggiAffiliati();
    if (tutti === null) errore = true;
    else creator = tutti.find((x) => x.token === slug) ?? null;
  }
  return <PaginaCreator creator={creator} errore={errore} base={casa()} />;
}
