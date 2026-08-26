import { NextResponse } from "next/server";
import { salvaIscritto } from "@/lib/archivio";
import { controllaIndirizzo } from "@/lib/email/dominio";
import { chiediConferma } from "@/lib/email/messaggi";
import { traccia } from "@/lib/eventi/registra";
import { ipDi, oltreIlLimite } from "@/lib/api/limite";

/* Stesso controllo del resto del sito (lib/email/indirizzo.ts). Qui il
   guadagno è diverso ma reale: un indirizzo morto in lista è una email
   che rimbalza, e i rimbalzi rovinano la reputazione del mittente per
   TUTTI gli altri iscritti. */

export async function POST(req: Request) {
  /* 🔴 IL FRENO MANCAVA, ed era l'unica rotta di INVIO email senza tetto.
     Ogni chiamata manda una email di conferma via Resend a qualsiasi
     indirizzo ben formato: 100 POST al minuto verso la stessa vittima
     sono 100 email e altrettanti reclami, che bruciano la reputazione del
     dominio da cui parte ANCHE il link di accesso alla pratica pagata.
     Cinque al minuto per IP: una persona si iscrive una volta.
     Trovato dall'audit del pannello (26/08). */
  if (oltreIlLimite("iscriviti", ipDi(req), 5)) {
    return NextResponse.json(
      { errore: "Hai riprovato troppe volte. Aspetta un minuto." },
      { status: 429 },
    );
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ errore: "Richiesta non leggibile." }, { status: 400 });
  }

  const { email, comune, insisto } = (corpo ?? {}) as {
    email?: string;
    comune?: string;
    insisto?: boolean;
  };

  const esito = await controllaIndirizzo(email ?? "", { insisto: insisto === true });
  if (!esito.ok) {
    return NextResponse.json(
      { errore: esito.messaggio, motivo: esito.motivo, suggerimento: esito.suggerimento ?? null },
      { status: 400 },
    );
  }
  const pulita = esito.email;

  try {
    await salvaIscritto({
      email: pulita,
      comune: (comune ?? "").trim() || null,
      creatoIl: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[iscriviti] salvataggio fallito:", e);
    return NextResponse.json(
      { errore: "Non sono riuscito a salvarti. Riprova fra un attimo." },
      { status: 500 },
    );
  }

  /* DOPPIO OPT-IN (scelta di Valerio, 9/08): qui NON parte il benvenuto,
     parte la richiesta di conferma. L'iscritto è salvato ma non è ancora
     iscritto: lo diventa quando clicca, in /api/iscriviti/conferma.

     L'invio si ASPETTA prima di rispondere. Non è pignoleria: su Netlify
     la funzione viene congelata nell'istante in cui risponde, e un invio
     lanciato senza await muore lì. È il motivo per cui la newsletter
     "funzionava" senza che arrivasse mai niente (trovato l'8/08 col test
     di Valerio). Se Resend fallisce, l'indirizzo resta salvato e la
     risposta lo dice, senza fingere. */
  const invio = await chiediConferma(pulita);
  if (!invio.ok) console.warn("[iscriviti] richiesta di conferma non spedita:", invio.motivo);

  /* ⚠️ L'indirizzo NON entra nel registro: chi si iscrive lo sa già la
     tabella degli iscritti, e qui teniamo fatti, non persone. */
  traccia(req, { tipo: "iscritto", extra: invio.ok ? null : { emailNonPartita: true } });

  return NextResponse.json({ ok: true, email: invio.ok });
}
