import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { modoSicuroAttivo } from "@/lib/motore/modo-sicuro";
import { casa } from "@/lib/email/posta";
import { aeroporto } from "@/lib/voli/distanza";
import { inItaliano } from "@/lib/voli/aeroporti";
import { linkStopRecupero } from "@/lib/iscritti/gettone";
import { recuperoIdoneo, recuperoIncerto } from "@/lib/email/recupero";
import { FINESTRA_RECUPERO_GIORNI, passoDaMandare } from "./scelta";

/**
 * IL GIRO DI RECUPERO. Lo chiama il cron una volta al giorno.
 *
 * ⚠️ SPENTO DI DEFAULT (scelta di Valerio): senza `RECUPERO_ATTIVO=1` non
 * parte niente. Mandare questi promemoria prima che ci sia una cassa che
 * incassa porterebbe la gente a un pagamento che non funziona. Si accende
 * il giorno del gestore di pagamento, con una variabile su Netlify.
 *
 * Sbaglia sempre dalla parte prudente: se qualcosa non torna, salta quella
 * riga e va avanti; non manda mai due volte lo stesso passo (lo segna sul
 * database dopo aver spedito), e non tocca chi ha già aperto la pratica o
 * si è disiscritto.
 */

export const RECUPERO_ATTIVO = process.env.RECUPERO_ATTIVO === "1";

/** Quante righe al massimo per giro: un tetto di sicurezza. */
const TETTO = 300;

type RigaVerifica = {
  id: string;
  esito: string;
  email: string | null;
  creata_il: string;
  recupero_passo: number;
  recupero_stop: boolean;
  importo: number | null;
  volo_iata: string;
  volo_id: string | null;
};

async function trattaDi(
  sb: ReturnType<typeof supabaseServizio>,
  voloId: string | null,
): Promise<string | null> {
  if (!voloId) return null;
  try {
    const { data } = await sb
      .from("voli")
      .select("partenza_iata, arrivo_iata")
      .eq("id", voloId)
      .maybeSingle();
    const da = aeroporto((data as { partenza_iata?: string | null } | null)?.partenza_iata);
    const a = aeroporto((data as { arrivo_iata?: string | null } | null)?.arrivo_iata);
    if (da && a) return `${inItaliano(da.citta) ?? da.citta} → ${inItaliano(a.citta) ?? a.citta}`;
  } catch {
    /* la tratta è un di più: senza, l'email nomina il volo */
  }
  return null;
}

export type EsitoRecupero = {
  ok: boolean;
  spento?: boolean;
  guardate: number;
  mandate: number;
  motivo?: string;
};

export async function eseguiRecupero(): Promise<EsitoRecupero> {
  if (!RECUPERO_ATTIVO) return { ok: true, spento: true, guardate: 0, mandate: 0 };
  if (!SERVIZIO_ATTIVO)
    return { ok: false, guardate: 0, mandate: 0, motivo: "SUPABASE_SECRET_KEY assente" };

  /* 🔴 MODO SICURO: l'interruttore d'emergenza ferma anche i recuperi via
     email. Non è un guasto, è una pausa: nessuna riga guardata, nessuna
     mandata. */
  if (await modoSicuroAttivo())
    return { ok: true, spento: true, guardate: 0, mandate: 0, motivo: "modo sicuro acceso" };

  const sb = supabaseServizio();
  const dalGiorno = new Date(
    Date.now() - FINESTRA_RECUPERO_GIORNI * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await sb
    .from("verifiche")
    .select(
      "id, esito, email, creata_il, recupero_passo, recupero_stop, importo, volo_iata, volo_id",
    )
    .in("esito", ["idoneo", "incerto"])
    .not("email", "is", null)
    .eq("recupero_stop", false)
    .lt("recupero_passo", 2)
    .gte("creata_il", dalGiorno)
    .order("creata_il", { ascending: true })
    .limit(TETTO);

  if (error) return { ok: false, guardate: 0, mandate: 0, motivo: error.message };

  const righe = (data ?? []) as RigaVerifica[];
  let mandate = 0;

  for (const r of righe) {
    if (!r.email) continue;

    // Ha già aperto una pratica per questa verifica? Allora non è da recuperare.
    const { data: prat } = await sb.from("pratiche").select("id").eq("verifica_id", r.id).limit(1);
    const haPratica = Boolean(prat && prat.length > 0);

    const passo = passoDaMandare({
      esito: r.esito,
      email: r.email,
      creataIl: r.creata_il,
      recuperoPasso: r.recupero_passo,
      recuperoStop: r.recupero_stop,
      haPratica,
    });
    if (!passo) continue;

    const tratta = await trattaDi(sb, r.volo_id);
    const linkStop = linkStopRecupero(casa(), r.email);

    const esito =
      r.esito === "idoneo" && r.importo
        ? await recuperoIdoneo(r.email, {
            passo,
            idVerifica: r.id,
            volo: r.volo_iata,
            tratta,
            importo: r.importo,
            linkStop,
          })
        : await recuperoIncerto(r.email, {
            passo,
            idVerifica: r.id,
            volo: r.volo_iata,
            tratta,
            linkStop,
          });

    if (esito.ok) {
      /* Il passo si segna SOLO dopo aver spedito: se l'email non parte, la
         prossima volta ci riproviamo invece di darla per mandata. */
      await sb
        .from("verifiche")
        .update({ recupero_passo: passo, recupero_ultimo_il: new Date().toISOString() })
        .eq("id", r.id);
      mandate++;
    }
  }

  return { ok: true, guardate: righe.length, mandate };
}
