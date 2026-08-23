import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import Logo from "@/components/Logo";
import { stripe, stripeAttivo } from "@/lib/stripe";
import { utenteCollegato } from "@/lib/supabase/server";
import { praticaPerVerifica } from "@/lib/pratiche/pratiche";
import { decidiPronta } from "@/lib/pratiche/pronta";
import AvanzaTraPoco from "./AvanzaTraPoco";

/**
 * DOVE ATTERRA CHI HA APPENA PAGATO (success_url della sessione Stripe).
 *
 * Due strade, e la differenza è tutta nell'essere loggati o no:
 *
 * - SEI LOGGATO con la stessa email che ha pagato → sei tu, niente giro
 *   della mail: dritto alla tua pratica (o "un attimo, la preparo" se il
 *   webhook è un secondo indietro). La pagina della pratica ricontrolla
 *   comunque la proprietà (utente_id), quindi è sicuro.
 * - NON sei loggato, o sei loggato con un'ALTRA email → l'accesso arriva
 *   SOLO nella posta di quell'indirizzo (email T+0 col link magico). Il
 *   check non ha account: al verdetto uno può aver messo l'email di un
 *   altro, e collegare qui il browser a quell'indirizzo sarebbe un furto
 *   d'account (buco chiuso il 16/08, vedi lib/pratiche/ingresso.ts).
 *
 * Il pagamento si conferma leggendo la sessione da Stripe: l'id sta
 * nell'indirizzo, ce l'ha solo chi torna dalla cassa.
 */
export const dynamic = "force-dynamic";

export default async function PaginaPronta({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; t?: string }>;
}) {
  const { session_id, t } = await searchParams;
  if (!session_id || !stripeAttivo()) redirect("/");

  let email: string | null = null;
  let verificaId: string | null = null;
  let pagato = false;
  try {
    const s = await stripe().checkout.sessions.retrieve(session_id);
    pagato = s.payment_status === "paid";
    email = s.customer_details?.email ?? s.customer_email ?? null;
    verificaId = (s.metadata?.verifica_id as string | undefined) ?? null;
  } catch (e) {
    console.error("[pratica/pronta] sessione non recuperata:", e);
  }
  if (!pagato) redirect("/");

  /* Chi è collegato in questo browser (dalla sessione, verificata da
     Supabase, non dal cookie). Solo se la sua email è quella che ha pagato
     si salta il giro della mail. */
  const utente = await utenteCollegato();
  const seiTu = Boolean(
    utente?.email && email && utente.email.toLowerCase() === email.toLowerCase(),
  );

  /* La pratica si cerca SOLO quando serve (sei tu e c'è la verifica): per un
     estraneo non si tocca il database. */
  const praticaId =
    seiTu && verificaId ? ((await praticaPerVerifica(verificaId))?.id ?? null) : null;

  const giro = Number(t) || 0;
  const prossimo = `/pratica/pronta?session_id=${encodeURIComponent(session_id)}&t=${giro + 1}`;

  const decisione = decidiPronta({
    pagato,
    emailPagante: email,
    emailUtente: utente?.email,
    praticaId,
    giro,
    prossimo,
  });

  if (decisione.azione === "casa") redirect("/");
  if (decisione.azione === "pratica") redirect(`/pratica/${decisione.id}`);
  if (decisione.azione === "lista") redirect("/app");

  // "attesa": sei tu, la pratica sta nascendo. Un attimo, e la pagina va da sé.
  if (decisione.azione === "attesa") {
    return (
      <div className="min-h-dvh bg-nebbia">
        <header className="border-b border-bordo bg-white/85 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-5 sm:px-8">
            <Logo />
            <Link href="/" className="text-sm text-fumo transition-colors hover:text-inchiostro">
              Torna al sito
            </Link>
          </div>
        </header>
        <main className="mx-auto max-w-xl px-5 py-14 sm:px-8 sm:py-20">
          <div className="rounded-2xl border border-verde/25 bg-white px-6 py-9 text-center sm:px-9">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-menta-tenue">
              <Loader2 aria-hidden="true" className="h-7 w-7 animate-spin text-verde" />
            </span>
            <h1 className="mt-6 font-display text-[1.7rem] leading-tight tracking-[-0.035em] text-inchiostro">
              Un attimo, preparo la tua pratica.
            </h1>
            <p className="mt-3 text-[0.98rem] leading-relaxed text-fumo">
              Pagamento ricevuto. Sei già dentro col tuo account: ti porto alla pratica appena è
              pronta, non devi fare niente.
            </p>
            <AvanzaTraPoco prossimo={decisione.prossimo} />
          </div>
        </main>
      </div>
    );
  }

  // "mail": non sei tu (o non sei loggato). Il giro della mail sicura.
  return (
    <div className="min-h-dvh bg-nebbia">
      <header className="border-b border-bordo bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <Link href="/" className="text-sm text-fumo transition-colors hover:text-inchiostro">
            Torna al sito
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-5 py-14 sm:px-8 sm:py-20">
        <div className="rounded-2xl border border-verde/25 bg-white px-6 py-9 text-center sm:px-9">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-menta-tenue">
            <Check aria-hidden="true" strokeWidth={3} className="h-7 w-7 text-verde" />
          </span>

          <h1 className="mt-6 font-display text-[1.7rem] leading-tight tracking-[-0.035em] text-inchiostro">
            Pagamento ricevuto.
          </h1>

          <p className="mt-3 text-[0.98rem] leading-relaxed text-fumo">
            Ti abbiamo mandato l&apos;accesso alla tua pratica per email
            {email ? (
              <>
                , a <strong className="text-inchiostro">{email}</strong>
              </>
            ) : null}
            . Apri quel link ed entri: è il modo sicuro, quel messaggio lo ricevi solo tu.
          </p>

          <p className="mt-4 rounded-xl bg-menta-tenue/60 px-4 py-3 text-[0.9rem] leading-relaxed text-verde-scuro">
            Non la trovi? Guarda anche nello spam. Arriva entro un minuto.
          </p>

          <p className="mt-6 text-[0.85rem] text-fumo-2">
            La ricevuta del pagamento te la manda Stripe, sempre per email.
          </p>
        </div>
      </main>
    </div>
  );
}
