/**
 * LA SVEGLIA DEL RIEPILOGO DELLA SERA.
 *
 * Come le altre sveglie: qui c'è solo l'orologio, il lavoro sta dentro
 * il sito (`/api/motore/riepilogo`). Così la logica è una sola e si può
 * lanciare anche a mano.
 *
 * 🔴 L'ORARIO ERA SBAGLIATO, E DI NUOVO PER META' ANNO. Il primo giro
 * (12/08) mise `0 18,19 * * *` con la nota «18 UTC sono le 21 in ora
 * solare». È FALSO: l'Italia d'inverno è UTC+1, quindi le 21 locali sono
 * le **20 UTC**, non le 18. Con 18 e 19 UTC il riepilogo non capitava mai
 * alle 21 d'inverno (19 e 20 locali) e per tutto l'inverno NON PARTIVA.
 * L'auto-spegnimento su «non sono le 21» lo faceva sparire in silenzio.
 * Trovato dall'audit del pannello (26/08).
 *
 * Le 21 italiane sono le 19 UTC d'estate (UTC+2) e le 20 UTC d'inverno
 * (UTC+1). Il cron di Netlify conosce solo l'UTC, quindi la sveglia suona
 * a ENTRAMBE (19 e 20 UTC) e la funzione si spegne da sola se in Italia
 * non sono le 21: il messaggio parte una volta e sempre alle 21, estate
 * e inverno.
 *
 * MOTORE_SEGRETO: senza, la rotta risponde 401 e qui si legge nel
 * registro di Netlify.
 */

/** Che ore sono in Italia adesso, ora legale compresa. */
const oraItaliana = () =>
  Number(
    new Intl.DateTimeFormat("it-IT", {
      hour: "2-digit",
      hour12: false,
      timeZone: "Europe/Rome",
    }).format(new Date()),
  );

/** L'ora in cui Valerio vuole il riepilogo. Una sola, dichiarata. */
const ORA_DEL_RIEPILOGO = 21;

const sveglia = async () => {
  const ora = oraItaliana();
  if (ora !== ORA_DEL_RIEPILOGO) {
    console.log(`[riepilogo] in Italia sono le ${ora}, non le ${ORA_DEL_RIEPILOGO}: salto.`);
    return new Response("non è l'ora", { status: 200 });
  }

  const casa = process.env.URL ?? process.env.DEPLOY_PRIME_URL;
  if (!casa) {
    console.error("[riepilogo] manca l'indirizzo del sito (URL): giro saltato.");
    return new Response("URL assente", { status: 500 });
  }

  const risposta = await fetch(`${casa}/api/motore/riepilogo`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.MOTORE_SEGRETO ? { "x-motore-segreto": process.env.MOTORE_SEGRETO } : {}),
    },
  });

  const corpo = await risposta.text();
  console.log(`[riepilogo] ${risposta.status}: ${corpo}`);
  return new Response(corpo, { status: risposta.status });
};

export default sveglia;

/* Due sveglie, un solo messaggio: 19 UTC sono le 21 in ora legale, 20 UTC
   sono le 21 in ora solare. Quella che casca nell'ora sbagliata si spegne
   da sola sopra. */
export const config = { schedule: "0 19,20 * * *" };
