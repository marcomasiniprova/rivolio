import { NextResponse } from "next/server";
import { ipDi, oltreIlLimite } from "@/lib/api/limite";
import { controllaIndirizzo } from "@/lib/email/dominio";
import { SERVIZIO_ATTIVO, supabaseServizio } from "@/lib/supabase/servizio";
import { POSTA_ATTIVA } from "@/lib/email/posta";
import { verdettoIdoneo } from "@/lib/email/verdetto";
import { formattaMinuti } from "@/lib/regole/eu261";
import { aeroporto } from "@/lib/voli/distanza";
import { inItaliano } from "@/lib/voli/aeroporti";
import { voloDimostrativo } from "@/lib/voli/fornitori/demo";

/**
 * POST /api/verifica/email  {id, email}
 *
 * La cattura DOPO il reveal (SPEC §3, passo 4: prima il verdetto, POI
 * l'email "ti salvo la pratica"). Aggancia l'indirizzo alla verifica già
 * fatta: chi conosce l'id (un UUID casuale che riceve solo chi ha fatto
 * il check) può scriverci sopra la propria email, nient'altro.
 */

/* 🔴 QUI C'ERA UN CONTROLLO "VOLUTAMENTE PERMISSIVO", e il commento che
   lo giustificava diceva: meglio un'email strana che perderne una buona.
   Era sbagliato, e Valerio l'ha scoperto provando (13/08): passavano
   `pippo@gmial.com`, `x@mailinator.com` e qualsiasi dominio inesistente.
   Su questo indirizzo poi NASCE L'ACCOUNT della pratica: un'email strana
   non è un'email in più, è un cliente che paga e non entra.
   Il controllo vero sta in lib/email/indirizzo.ts, uno solo per tutto il
   sito. */
const UUID_OK = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RigaVerifica = {
  id: string;
  esito: string;
  importo: number | null;
  ritardo_minuti: number | null;
  volo_iata: string;
  volo_id: string | null;
};

/**
 * Manda l'email del verdetto, se c'è qualcosa da dire.
 *
 * La tratta ("Bergamo → Lanzarote") si prende dalla riga del volo e si
 * scrive in italiano: nel titolo dell'email il codice del volo non lo
 * riconosce nessuno, la città sì.
 * Non lancia mai: qualunque cosa vada storta resta nei log del server e
 * l'utente non se ne accorge, perché il verdetto ce l'ha già davanti.
 */
async function inviaVerdetto(
  sb: ReturnType<typeof supabaseServizio>,
  riga: RigaVerifica,
  a: string,
): Promise<void> {
  try {
    if (!POSTA_ATTIVA) return;
    if (riga.esito !== "idoneo" || !riga.importo) return;

    let tratta: string | null = null;
    if (riga.volo_id) {
      const { data: volo } = await sb
        .from("voli")
        .select("partenza_iata, arrivo_iata")
        .eq("id", riga.volo_id)
        .maybeSingle();
      const da = aeroporto((volo as { partenza_iata?: string | null } | null)?.partenza_iata);
      const a2 = aeroporto((volo as { arrivo_iata?: string | null } | null)?.arrivo_iata);
      if (da && a2) {
        tratta = `${inItaliano(da.citta) ?? da.citta} → ${inItaliano(a2.citta) ?? a2.citta}`;
      }
    }

    const esito = await verdettoIdoneo(a, {
      idVerifica: riga.id,
      volo: riga.volo_iata,
      tratta,
      importo: riga.importo,
      ritardo: riga.ritardo_minuti ? formattaMinuti(riga.ritardo_minuti) : null,
      /* Il bollo "esempio" arriva dal numero del volo e non dalla riga
         del volo in archivio: i dimostrativi in quell'archivio non ci
         entrano proprio (restano deterministici), quindi cercare lì la
         fonte "demo" non troverebbe niente. */
      demo: voloDimostrativo(riga.volo_iata),
    });
    if (!esito.ok) console.error("[verifica/email] email del verdetto non partita:", esito.motivo);
  } catch (e) {
    console.error("[verifica/email] email del verdetto fallita:", e);
  }
}

export async function POST(req: Request) {
  /* Il freno: ogni chiamata fa una risoluzione DNS (fino a 2,5s) e può
     far partire l'email del verdetto. Senza tetto, un ciclo la martella.
     Dieci al minuto per IP: chi ha appena fatto il check lascia un
     indirizzo una volta. Trovato dall'audit del pannello (26/08). */
  if (oltreIlLimite("verifica-email", ipDi(req), 10)) {
    return NextResponse.json(
      { ok: false, errore: "Hai riprovato troppe volte. Aspetta un minuto." },
      { status: 429 },
    );
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ ok: false, errore: "Richiesta non leggibile." }, { status: 400 });
  }

  const { id, email, insisto } = (corpo ?? {}) as {
    id?: unknown;
    email?: unknown;
    insisto?: unknown;
  };
  if (typeof id !== "string" || !UUID_OK.test(id)) {
    return NextResponse.json(
      { ok: false, errore: "Manca l'identificativo della verifica." },
      { status: 400 },
    );
  }
  /* I quattro cancelli: forma, casella temporanea, refuso di un dominio
     famoso, e il DNS che dice se quel dominio riceve posta davvero.
     `insisto` arriva dal bottone "no, è giusto così" del suggerimento:
     un dominio legittimo che assomiglia a Gmail deve poter passare. */
  const esito = await controllaIndirizzo(typeof email === "string" ? email : "", {
    insisto: insisto === true,
  });
  if (!esito.ok) {
    return NextResponse.json(
      {
        ok: false,
        errore: esito.messaggio,
        motivo: esito.motivo,
        /* Il client lo mostra come bottone: correggere un refuso deve
           costare un tocco, non una ridigitazione. */
        suggerimento: esito.suggerimento ?? null,
      },
      { status: 400 },
    );
  }
  const pulita = esito.email;

  if (!SERVIZIO_ATTIVO) {
    return NextResponse.json(
      { ok: false, errore: "Il salvataggio ora non è disponibile. Riprova fra poco." },
      { status: 503 },
    );
  }

  try {
    const sb = supabaseServizio();
    const { data, error } = await sb
      .from("verifiche")
      .update({ email: pulita })
      .eq("id", id)
      /* ⚠️ SI SCRIVE UNA VOLTA SOLA. Prima bastava conoscere l'id per
         RIscrivere l'email agganciata a una verifica, e quell'id gira
         (sta nell'indirizzo /verifica/<id>, che si condivide e finisce
         nella cronologia del browser). Chi ne avesse trovato uno poteva
         sostituire l'indirizzo di quella persona col proprio e
         intercettare gli avvisi sulla sua pratica.
         Adesso l'email si aggiunge se non c'e'; per cambiarla si rifa'
         il check, che e' un'operazione di mezzo minuto. Trovato
         dall'ispezione del 12/08.
         ⚠️ Qui prima c'era scritto anche quanto costa, e una prova l'ha
         bocciato avendo ragione: il prezzo dell'analisi segue
         l'interruttore e non si scrive a mano da nessuna parte, nemmeno
         in un commento. Il giorno che l'interruttore si accende, una
         riga che dice il contrario e' il modo in cui l'errore rientra
         dalla finestra. */
      .is("email", null)
      .select("id, esito, importo, ritardo_minuti, volo_iata, volo_id");
    if (error) throw new Error(error.message);
    if (data && data.length === 1) {
      /* 🔴 QUI PRIMA NON SUCCEDEVA NIENTE. Si salvava l'indirizzo e si
         rispondeva ok: chi apriva la posta non trovava nulla e pensava,
         legittimamente, che il sito fosse finto (Valerio, 12/08).
         Adesso l'email parte, ma SOLO sugli idonei: su un incerto
         scriveremmo per dire "non lo so", e non è un'email che qualcuno
         vuole ricevere.
         ⚠️ Se la spedizione fallisce non fallisce la richiesta: il
         verdetto è già sullo schermo dell'utente, e rispondere "errore"
         per un'email non partita gli farebbe credere di aver perso il
         risultato. */
      void inviaVerdetto(sb, data[0] as RigaVerifica, pulita);
    }
    if (!data || data.length === 0) {
      /* Zero righe aggiornate vuol dire due cose: la verifica non
         esiste, oppure un'email c'era gia'. Non si distinguono nella
         risposta di proposito: dire "c'e' gia' un'email" a chi prova un
         id a caso gli conferma che quella verifica esiste. */
      return NextResponse.json(
        {
          ok: false,
          /* ⚠️ Prima diceva solo "non ho potuto": chi aveva sbagliato una
             lettera restava fermo senza sapere cosa fare. Adesso dice la
             mossa. La rotta scrive una volta sola di proposito (vedi
             sopra), quindi la strada è rifare il check. */
          errore:
            "Su questa analisi c'è già un'email, oppure il link non è più valido. Se hai sbagliato a scriverla, rifai il check: ci vogliono trenta secondi.",
        },
        { status: 404 },
      );
    }
  } catch (e) {
    console.error("[verifica/email] salvataggio fallito:", e);
    return NextResponse.json(
      { ok: false, errore: "Non sono riuscito a salvare l'email. Riprova fra un attimo." },
      { status: 503 },
    );
  }

  return NextResponse.json({ ok: true });
}
