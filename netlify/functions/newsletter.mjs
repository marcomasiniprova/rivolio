/**
 * LA SVEGLIA DELLA NEWSLETTER SETTIMANALE (28/08).
 *
 * Ogni lunedì mattina bussa alla rotta che compone e manda l'Osservatorio
 * agli iscritti confermati (`/api/motore/newsletter`). La logica sta nel
 * sito, qui c'è solo l'orologio: così la si può anche lanciare a mano dal
 * pannello o da un indirizzo, con la stessa porta.
 *
 * Orario: 7:00 UTC del lunedì, cioè le 9 in Italia d'estate e le 8
 * d'inverno. Lunedì mattina, come chiesto.
 *
 * ⚠️ NON MANDA DUE VOLTE. La rotta "prenota" la settimana con un insert
 * atomico: se questo giro rifà partire per un ritentativo, la seconda
 * chiamata trova la settimana già presa e non manda niente.
 *
 * MOTORE_SEGRETO: senza, la rotta risponde 401 e non parte nulla.
 */
const sveglia = async () => {
  const casa = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  if (!casa) {
    console.error("[newsletter] manca l'indirizzo del sito (URL): giro saltato.");
    return new Response("URL assente", { status: 500 });
  }

  const risposta = await fetch(`${casa}/api/motore/newsletter`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.MOTORE_SEGRETO ? { "x-motore-segreto": process.env.MOTORE_SEGRETO } : {}),
    },
  });

  const corpo = await risposta.text();
  console.log(`[newsletter] ${risposta.status}: ${corpo}`);
  return new Response(corpo, { status: risposta.status });
};

export default sveglia;

/* 07:30 del lunedi', NON le 07:00: alle 07:00 gira gia' il cron dei follow-up
   (segui.mjs), e due sveglie alla stessa ora si contendono database e budget
   di 8 secondi. Trovato dalla prova reggere.spec.ts (30/08). */
export const config = { schedule: "30 7 * * 1" };
