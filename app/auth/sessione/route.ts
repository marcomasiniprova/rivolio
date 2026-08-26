import { NextResponse, type NextRequest } from "next/server";
import { percorsoInterno } from "@/lib/api/percorso";
import { supabaseServer } from "@/lib/supabase/server";
import { SUPABASE_CONFIGURATO } from "@/lib/supabase/chiavi";
import { versoCasa } from "@/lib/sito";

/**
 * L'ultimo pezzo del rimbalzo vecchio stile.
 *
 * Supabase, in quella forma, mette i dati della sessione nel FRAMMENTO
 * dell'indirizzo (`#access_token=...`). Il frammento non viaggia mai fino al
 * server: lo vede solo il browser. La paginetta in `/auth/conferma` lo legge
 * e lo rimanda qui come parametri normali; qui si trasforma in un cookie
 * vero, che è l'unica forma che i Server Component sanno leggere.
 *
 * Perché non fare tutto nel browser: una sessione che vive solo lato client
 * non protegge `/app`, perché il controllo lo fa il server. Il giro sembra
 * lungo ma è l'unico che chiude davvero la porta.
 */
export async function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const access_token = p.get("access_token");
  const refresh_token = p.get("refresh_token");

  const grezzo = p.get("poi") ?? "/app";
  /* 🔴 QUESTA PORTA LASCIAVA PASSARE L'OPEN REDIRECT.
     `percorsoInterno` NON torna un sì/no: torna già il percorso ripulito
     (o "/app" se è ostile). Scritto `percorsoInterno(grezzo) ? grezzo :
     "/app"`, il ternario era sempre vero (la funzione torna sempre una
     stringa non vuota) e usava il valore GREZZO: la ripulitura veniva
     buttata. Così `poi=//sito-cattivo.it` con i due gettoni di sessione
     validi nell'indirizzo rimbalzava fuori subito dopo il login. Adesso
     si usa il valore ripulito, come nelle altre tre porte.
     Trovato dall'audit del pannello (26/08). */
  const poi = percorsoInterno(grezzo);

  if (!SUPABASE_CONFIGURATO || !access_token || !refresh_token) {
    const u = versoCasa("/entra", request);
    u.searchParams.set("errore", "link");
    return NextResponse.redirect(u);
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.setSession({ access_token, refresh_token });

  if (error) {
    console.error("[sessione] setSession:", error.message);
    const u = versoCasa("/entra", request);
    u.searchParams.set("errore", /expired/i.test(error.message) ? "scaduto" : "link");
    return NextResponse.redirect(u);
  }

  /* Indirizzo pulito, come in /auth/conferma: qui nella richiesta ci sono
     ADDIRITTURA i due gettoni di sessione, e non devono restare scritti
     nella barra del browser di nessuno. */
  const destinazione = versoCasa(poi, request);
  destinazione.search = "";
  return NextResponse.redirect(destinazione);
}
