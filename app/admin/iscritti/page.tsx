import { Scheda } from "@/components/admin/Grafici";
import { Avviso, Kpi, Vuoto } from "@/components/admin/Pezzi";
import ElencoIscritti, { type RigaIscritto } from "@/components/admin/iscritti/ElencoIscritti";
import { soloAdmin } from "@/lib/admin/guardia";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";

/**
 * GLI ISCRITTI ALL'OSSERVATORIO (rifatta il 26/08, giro #96).
 *
 * Il numero che conta non è «quanti si sono iscritti» ma quanti hanno
 * CONFERMATO: l'iscrizione è a doppio consenso, e chi non ha cliccato il
 * link nella posta non riceverà mai niente. Contarlo fra gli iscritti
 * gonfierebbe una lista che poi non apre nessuno.
 *
 * ⚠️ Chi disdice NON viene cancellato: la riga resta come prova del consenso
 * e come promemoria di non riscrivergli. Qui si vede, marcato.
 *
 * ⚠️ I TRE NUMERI IN CIMA LI CONTA IL DATABASE su TUTTA la lista, non sulle
 * 200 righe lette per l'elenco: al 201esimo iscritto smetterebbero di
 * crescere senza dirlo (difetto trovato il 12/08).
 */
export const dynamic = "force-dynamic";

export default async function PaginaIscritti() {
  /* Prima riga, sempre. Vedi lib/admin/guardia.ts. */
  await soloAdmin();

  let righe: RigaIscritto[] = [];
  let nonLetto = !SERVIZIO_ATTIVO;
  let nVivi: number | null = null;
  let nAttesa: number | null = null;
  let nUsciti: number | null = null;

  if (SERVIZIO_ATTIVO) {
    const partenza = () =>
      supabaseServizio().from("iscritti").select("id", { count: "exact", head: true });
    const [
      { data, error },
      { count: cVivi, error: eVivi },
      { count: cAttesa, error: eAttesa },
      { count: cUsciti, error: eUsciti },
    ] = await Promise.all([
      supabaseServizio()
        .from("iscritti")
        .select("id, email, comune, creato_il, confermato_il, disdetto_il")
        .order("creato_il", { ascending: false })
        .limit(200),
      partenza().not("confermato_il", "is", null).is("disdetto_il", null),
      partenza().is("confermato_il", null).is("disdetto_il", null),
      partenza().not("disdetto_il", "is", null),
    ]);
    for (const e of [error, eVivi, eAttesa, eUsciti]) {
      if (e) console.error("[pannello] iscritti non letti:", e.message);
    }
    nonLetto = Boolean(error);
    righe = (data ?? []) as RigaIscritto[];
    nVivi = eVivi ? null : (cVivi ?? 0);
    nAttesa = eAttesa ? null : (cAttesa ?? 0);
    nUsciti = eUsciti ? null : (cUsciti ?? 0);
  }

  const q = (v: number | null) => (v === null ? "non letto" : String(v));

  /* La salute della lista: quanti, fra chi si è iscritto, hanno poi
     confermato. Solo con un denominatore vero (vivi + in attesa): le
     disdette sono gente che aveva già confermato, non le contiamo qui. */
  const perConferma =
    nVivi !== null && nAttesa !== null && nVivi + nAttesa > 0
      ? Math.round((nVivi / (nVivi + nAttesa)) * 100)
      : null;

  return (
    <div className="flex flex-col gap-5">
      {!SERVIZIO_ATTIVO ? (
        <Avviso titolo="Senza chiave del database gli iscritti non si leggono." tono="rosso">
          Manca <code>SUPABASE_SECRET_KEY</code> nell&apos;ambiente.
        </Avviso>
      ) : (
        nonLetto && (
          <Avviso titolo="La lista non si è letta." tono="rosso">
            Il database non ha risposto. Qui sotto non c&apos;è &quot;nessun iscritto&quot;: c&apos;è
            &quot;non lo so&quot;.
          </Avviso>
        )
      )}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
        <Kpi
          forte
          etichetta="Iscritti veri"
          valore={q(nVivi)}
          nota="Hanno confermato e non hanno disdetto: gli unici a cui si può scrivere."
        />
        <Kpi
          etichetta="In attesa di conferma"
          valore={q(nAttesa)}
          nota="Hanno lasciato l'email ma non hanno cliccato il link. Non ricevono niente."
        />
        <Kpi
          etichetta="Disdette"
          valore={q(nUsciti)}
          nota="La riga resta come prova del consenso."
        />
      </div>

      {/* La salute della lista: la barra di chi ha confermato. */}
      {perConferma !== null && (
        <div className="rounded-[14px] border border-bordo bg-white p-4 sm:p-5">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[13.5px] font-medium text-inchiostro">
              Su 100 iscritti, <strong className="text-verde-scuro">{perConferma}</strong> hanno
              confermato
            </p>
            <span className="numeri text-[12.5px] text-fumo-2">
              {nVivi} su {nVivi! + nAttesa!}
            </span>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-nebbia-2">
            <div
              className="h-full rounded-full bg-verde transition-[width] duration-500"
              style={{ width: `${perConferma}%` }}
            />
          </div>
          <p className="mt-2 text-[12px] leading-relaxed text-fumo-2">
            È il doppio consenso: chi non clicca il link nella posta resta in attesa e non riceve
            l&apos;email dell&apos;Osservatorio.
          </p>
        </div>
      )}

      <Scheda titolo="La lista" sotto="Le ultime 200, dalla più recente. Filtra per stato o cerca.">
        {righe.length === 0 ? (
          <Vuoto
            titolo={nonLetto ? "Non letto." : "Nessuna iscrizione, ancora."}
            spiega={
              nonLetto
                ? undefined
                : "Il modulo dell'Osservatorio sta sulla landing e in fondo agli articoli del Tabellone."
            }
          />
        ) : (
          <ElencoIscritti righe={righe} />
        )}
      </Scheda>

      <p className="pb-2 text-[12.5px] leading-relaxed text-fumo-2">
        Le email partono solo verso chi ha confermato. Finché il dominio non è verificato su Resend,
        partono comunque verso il solo indirizzo con cui è stato aperto l&apos;account: lo decide
        Resend, non il nostro codice.
      </p>
    </div>
  );
}
