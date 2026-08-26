import type { ReactNode } from "react";
import { codiceDaGettone } from "@/lib/affiliati/accesso";
import { leggiAffiliati } from "@/lib/affiliati/lettura";
import { SERVIZIO_ATTIVO } from "@/lib/supabase/servizio";
import { casa } from "@/lib/sito";
import { euro } from "@/lib/prezzi";
import { GIORNI_PAGAMENTO, PREZZO_SINGOLA, PREZZO_FAMIGLIA } from "@/lib/affiliati/modello";
import CruscottoCopia from "@/components/creator/CruscottoCopia";

/**
 * IL CRUSCOTTO DEL CREATOR (brief del 26/08).
 *
 * Trasparente: il creator vede i SUOI numeri veri, quanto ha guadagnato e
 * quanto gli manca al prossimo bonus. NON vede i margini interni (IVA,
 * commissione della cassa): quelli sono di Valerio. Si apre col link
 * privato firmato, senza account e senza password.
 */
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Il tuo cruscotto | Rivolio",
  robots: { index: false, follow: false },
};

const numIt = (n: number) => n.toLocaleString("it-IT");

function Schermo({ titolo, children }: { titolo: string; children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="font-display text-[1.6rem] tracking-[-0.02em] text-inchiostro">{titolo}</h1>
      <p className="mt-3 text-[15px] leading-relaxed text-fumo">{children}</p>
    </main>
  );
}

export default async function CruscottoCreator({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const codice = codiceDaGettone(t);

  if (!codice) {
    return (
      <Schermo titolo="Link non valido.">
        Questo indirizzo non apre nessun cruscotto. Chiedi a Rivolio il tuo link giusto.
      </Schermo>
    );
  }
  if (!SERVIZIO_ATTIVO) {
    return (
      <Schermo titolo="Torna fra poco.">
        Non riusciamo a leggere i tuoi numeri in questo momento. Riprova più tardi.
      </Schermo>
    );
  }

  const tutti = await leggiAffiliati();
  const c = tutti?.find((x) => x.codice === codice) ?? null;
  if (!c) {
    return (
      <Schermo titolo="Non ti troviamo.">
        Il tuo codice non risulta attivo. Scrivi a Rivolio e lo sistemiamo in un minuto.
      </Schermo>
    );
  }

  const link = `${casa()}/?ref=${c.codice}`;
  const ibrido = c.tipo_accordo === "ibrido";
  const totaleMaturato = c.baseMaturato + c.bonus.totale + (ibrido ? c.bonusFisso : 0);
  const prox = [
    { nome: "singole", ...c.prossimi.singola },
    { nome: "pratiche famiglia", ...c.prossimi.famiglia },
    { nome: "check", ...c.prossimi.check },
  ].sort((a, b) => a.mancano - b.mancano)[0];

  return (
    <main className="mx-auto w-full max-w-2xl px-5 py-10 sm:py-14">
      <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-verde">
        Rivolio · programma creator
      </p>
      <h1 className="mt-2 font-display text-[2rem] leading-tight tracking-[-0.03em] text-inchiostro">
        Ciao {c.nome.split(" ")[0]}
      </h1>
      <p className="mt-1 text-[15px] text-fumo">
        Questo è il tuo cruscotto. Numeri veri, aggiornati man mano che porti gente.
      </p>

      {/* IL LINK */}
      <section className="mt-7 rounded-[16px] border border-verde/30 bg-menta-tenue p-5">
        <p className="text-[13px] font-medium text-verde-scuro">Il tuo link</p>
        <p className="mt-1.5 break-all font-mono text-[14px] text-inchiostro">{link}</p>
        <div className="mt-3">
          <CruscottoCopia testo={link} />
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-fumo">
          Chi lo apre trova <b className="text-inchiostro">{c.sconto_percento}% di sconto</b>. Ogni
          pratica che parte da qui ti fa guadagnare.
        </p>
      </section>

      {/* I RISULTATI */}
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Mini etichetta="Clic sul link" valore={numIt(c.click)} />
        <Mini etichetta="Check portati" valore={numIt(c.nCheck)} />
        <Mini etichetta="Pratiche singole" valore={numIt(c.nSingola)} />
        <Mini etichetta="Pratiche famiglia" valore={numIt(c.nFamiglia)} />
      </section>

      {/* I SOLDI */}
      <section className="mt-4 rounded-[16px] border border-bordo bg-white p-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[14px] font-medium text-inchiostro">Hai guadagnato finora</span>
          <span className="numeri text-[30px] font-semibold text-verde">{euro(totaleMaturato)}</span>
        </div>
        <ul className="mt-4 space-y-1.5 border-t border-bordo pt-4 text-[13.5px] text-fumo">
          <li className="flex justify-between">
            <span>Commissioni (40% su ogni pratica)</span>
            <span className="numeri text-inchiostro">{euro(c.baseMaturato)}</span>
          </li>
          <li className="flex justify-between">
            <span>Bonus a soglie</span>
            <span className="numeri text-inchiostro">{euro(c.bonus.totale)}</span>
          </li>
          {ibrido && (
            <li className="flex justify-between">
              <span>Fisso una-tantum {c.fissoPagatoIl ? "(pagato)" : "(al primo contenuto)"}</span>
              <span className="numeri text-inchiostro">{euro(c.bonusFisso)}</span>
            </li>
          )}
        </ul>
        <div className="mt-4 flex items-baseline justify-between gap-3 rounded-[12px] bg-menta-tenue px-4 py-3">
          <span className="text-[13px] font-medium text-verde-scuro">Da ricevere al prossimo pagamento</span>
          <span className="numeri text-[18px] font-semibold text-verde-scuro">{euro(c.daPagareTotale)}</span>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-fumo-2">
          Paghiamo ogni {GIORNI_PAGAMENTO} giorni, con bonifico, sulle pratiche ormai consolidate.
          Se una pratica non va a buon fine il cliente riceve un credito, non un rimborso in
          contanti: la tua commissione resta.
        </p>
      </section>

      {/* IL PROSSIMO BONUS */}
      {prox.premio > 0 && (
        <section className="mt-4 rounded-[16px] border border-sole/40 bg-sole/10 p-5">
          <p className="text-[14px] leading-relaxed text-inchiostro">
            <b>Ci sei quasi.</b> Ancora <b className="numeri">{prox.mancano}</b> {prox.nome} e sono{" "}
            <b className="numeri text-verde-scuro">{euro(prox.premio)}</b> di bonus in più.
          </p>
        </section>
      )}

      {/* COME FUNZIONA, per intero */}
      <section className="mt-4 rounded-[16px] border border-bordo bg-white p-5">
        <p className="text-[14px] font-medium text-inchiostro">Come si guadagna, per intero</p>
        <ul className="mt-3 space-y-2 text-[13.5px] leading-relaxed text-fumo">
          <li>
            <b className="text-inchiostro">40%</b> su ogni pratica pagata che arriva dal tuo link.
          </li>
          <li>
            Bonus pratiche singole ({euro(PREZZO_SINGOLA)}):{" "}
            <b className="text-inchiostro">20€</b> alle 10, poi <b className="text-inchiostro">50€</b>{" "}
            ogni 25.
          </li>
          <li>
            Bonus pratiche famiglia ({euro(PREZZO_FAMIGLIA)}):{" "}
            <b className="text-inchiostro">50€</b> ogni 10.
          </li>
          <li>
            Bonus check pagati: <b className="text-inchiostro">50€</b> ogni 100.
          </li>
          {ibrido && (
            <li>
              Il tuo accordo ha anche un <b className="text-inchiostro">fisso una-tantum</b> al primo
              contenuto pubblicato.
            </li>
          )}
        </ul>
        <p className="mt-4 border-t border-bordo pt-3 text-[12.5px] text-fumo-2">
          Domande, o vuoi cambiare qualcosa? Scrivi a Rivolio, rispondiamo noi.
        </p>
      </section>
    </main>
  );
}

function Mini({ etichetta, valore }: { etichetta: string; valore: string }) {
  return (
    <div className="rounded-[14px] border border-bordo bg-white p-4">
      <p className="text-[11px] uppercase tracking-[0.1em] text-fumo-2">{etichetta}</p>
      <p className="numeri mt-1 text-[24px] font-semibold text-inchiostro">{valore}</p>
    </div>
  );
}
