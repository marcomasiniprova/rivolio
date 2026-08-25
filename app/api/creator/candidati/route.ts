import { NextResponse } from "next/server";
import { ipDi, oltreIlLimite } from "@/lib/api/limite";
import { controllaIndirizzo } from "@/lib/email/dominio";
import { tin } from "@/lib/eventi/telegram";

/**
 * LA CANDIDATURA CREATOR. Chi vuole promuovere Rivolio col suo link si
 * candida qui. Non crea niente sul database dei soldi: manda ad admin (a
 * Valerio, su Telegram) i dati, e lui crea il codice dal pannello
 * /admin/affiliati. Vetting umano: al lancio è meglio che i codici li
 * apra una persona, non chiunque riempia un modulo.
 */
export async function POST(req: Request) {
  if (oltreIlLimite("creator-candidati", ipDi(req), 6)) {
    return NextResponse.json(
      { errore: "Troppe candidature di fila. Riprova fra un minuto." },
      { status: 429 },
    );
  }

  let corpo: unknown;
  try {
    corpo = await req.json();
  } catch {
    return NextResponse.json({ errore: "Richiesta non leggibile." }, { status: 400 });
  }
  const { nome, email, canale, profilo } = (corpo ?? {}) as {
    nome?: string;
    email?: string;
    canale?: string;
    profilo?: string;
  };

  const n = (nome ?? "").trim();
  const c = (canale ?? "").trim();
  const p = (profilo ?? "").trim();
  if (n.length < 2) return NextResponse.json({ errore: "Scrivi il tuo nome." }, { status: 400 });
  if (!p) return NextResponse.json({ errore: "Dicci dove pubblichi (il link o l'@)." }, { status: 400 });

  const esito = await controllaIndirizzo(email ?? "", { insisto: true });
  if (!esito.ok) {
    return NextResponse.json({ errore: esito.messaggio }, { status: 400 });
  }

  await tin(
    `🎬 NUOVA CANDIDATURA CREATOR\nNome: ${n}\nEmail: ${esito.email}\nCanale: ${c || "non detto"}\nProfilo: ${p}\n\nApri /admin/affiliati e crea il suo codice.`,
  );

  return NextResponse.json({ ok: true });
}
