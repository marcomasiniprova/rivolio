import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";

/**
 * IL MODO SICURO: l'interruttore d'emergenza globale (audit 26/08).
 *
 * Un solo flag sul database (`impostazioni.modo_sicuro`). Quando è ACCESO
 * mette in pausa le due cose che parlano da sole al cliente:
 *  - la sequenza di email automatiche (il cron dei promemoria e il recupero);
 *  - la replica scritta dall'AI, che torna al testo fisso verificato.
 *
 * ⚠️ NON tocca il cuore che incassa: check, verdetto, pagamento e apertura
 * della pratica restano vivi. È il freno degli automatismi, non delle vendite.
 *
 * Perché sul DATABASE e non una variabile di Netlify: una variabile si cambia
 * solo con un deploy, cioè minuti, ed è l'ultima cosa che vuoi quando qualcosa
 * sta andando storto. Questo si accende con un clic dal pannello e vale subito.
 */

const CHIAVE = "modo_sicuro";

/* Una piccola cache: il cron e la replica non devono chiedere al database a
   ogni riga. 15 secondi è niente per un giro giornaliero, ed è il ritardo
   massimo con cui l'interruttore fa effetto dopo un clic. */
const CACHE_MS = 15_000;
let cache: { valore: boolean; fino: number } | null = null;

/**
 * Il modo sicuro è acceso? Chi lo chiede sospende gli automatismi.
 *
 * ⚠️ Se il database non risponde si torna NORMALI (fail-open sulla feature):
 * il flag non si può leggere, e un automatismo bloccato da un flag illeggibile
 * sarebbe peggio del guasto. Il cancello deterministico della replica AI resta
 * comunque attivo, quindi «normale» non vuol dire «pericoloso».
 */
export async function modoSicuroAttivo(): Promise<boolean> {
  if (cache && Date.now() < cache.fino) return cache.valore;
  if (!SERVIZIO_ATTIVO) return false;
  try {
    const { data, error } = await supabaseServizio()
      .from("impostazioni")
      .select("valore")
      .eq("chiave", CHIAVE)
      .maybeSingle();
    if (error) {
      /* tabella assente o database giù: si prosegue come normale, senza
         inchiodare la cache su un valore mai letto. */
      return cache?.valore ?? false;
    }
    const on = data?.valore === "1";
    cache = { valore: on, fino: Date.now() + CACHE_MS };
    return on;
  } catch {
    return cache?.valore ?? false;
  }
}

/**
 * Accende o spegne il modo sicuro. Lo chiama SOLO l'azione admin, dopo aver
 * ricontrollato che chi preme sia admin. Vero se salvato.
 */
export async function impostaModoSicuro(on: boolean): Promise<boolean> {
  if (!SERVIZIO_ATTIVO) return false;
  try {
    const { error } = await supabaseServizio()
      .from("impostazioni")
      .upsert({ chiave: CHIAVE, valore: on ? "1" : "0", aggiornata_il: new Date().toISOString() });
    if (error) return false;
    /* La cache di QUESTA macchina si aggiorna subito; le altre istanze
       Netlify la rileggono entro CACHE_MS. */
    cache = { valore: on, fino: Date.now() + CACHE_MS };
    return true;
  } catch {
    return false;
  }
}
