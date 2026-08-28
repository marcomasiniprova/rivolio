import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";

/**
 * Gli iscritti a cui si PUÒ scrivere la newsletter: hanno confermato
 * (doppio opt-in) e non hanno disdetto. È l'unica lista da cui parte
 * l'Osservatorio settimanale.
 *
 * ⚠️ FAIL-CLOSED, al contrario dei lettori dei ritardi. Se il database
 * non risponde si torna una lista VUOTA: non mandare niente è un fastidio,
 * mandare a chi non ha confermato è spam che brucia la reputazione del
 * dominio (e fa finire in posta indesiderata anche le email che contano).
 */
export async function iscrittiConfermati(): Promise<string[]> {
  if (!SERVIZIO_ATTIVO) return [];
  try {
    const { data, error } = await supabaseServizio()
      .from("iscritti")
      .select("email")
      .not("confermato_il", "is", null)
      .is("disdetto_il", null);
    if (error || !data) return [];
    return (data as { email: string }[]).map((r) => r.email).filter(Boolean);
  } catch {
    return [];
  }
}
