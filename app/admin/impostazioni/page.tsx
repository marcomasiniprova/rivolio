import type { Metadata } from "next";
import { Suspense } from "react";
import { soloAdmin } from "@/lib/admin/guardia";
import QuandoArrivaIlDominio from "@/components/admin/QuandoArrivaIlDominio";
import { chatIdDaScoprire } from "@/lib/eventi/telegram";

/**
 * LE IMPOSTAZIONI, SPIEGATE DA SOLE (richiesta di Valerio, 11/08).
 *
 * Il problema, con le sue parole: «ogni volta mi dici aggiungi variables
 * nomi strani non si capisce un cazzo, ne mancano alcune, è un casino».
 * Aveva ragione: su Netlify si vede un elenco di nomi in maiuscolo senza
 * nessuna spiegazione, e per sapere se ne manca una bisogna aprire il
 * codice.
 *
 * Questa pagina guarda le variabili VERE del server e per ognuna dice
 * tre cose in italiano: a cosa serve, se c'è, e **cosa succede se
 * manca**. Non è un elenco: è una diagnosi.
 *
 * ⚠️ NON MOSTRA MAI IL VALORE. Solo se c'è o non c'è. Una pagina che
 * stampa le chiavi è una pagina che, il giorno che qualcuno ci finisce
 * dentro o ne fa uno screenshot, regala tutto. Sta comunque dietro
 * `/admin`, che il proxy chiude a chi non è collegato.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Impostazioni | Rivolio",
  robots: { index: false, follow: false },
};

type Voce = {
  nome: string;
  /** A cosa serve, in una riga, senza gergo. */
  serve: string;
  /** Cosa succede se non c'è. È la parte che conta. */
  seManca: string;
  /** Serve per forza, oppure il sito gira lo stesso? */
  peso: "obbligatoria" | "importante" | "facoltativa";
  /** Il valore c'è? Calcolato sul server, mai mostrato. */
  ceSta: boolean;
};

function stato(): Voce[] {
  const c = (v: string | undefined) => Boolean(v && v.trim());
  return [
    {
      nome: "SUPABASE_SECRET_KEY",
      serve: "La chiave che fa scrivere il sito sul database: verifiche, pratiche, iscritti.",
      seManca:
        "Il check funziona ma non ricorda niente: nessuna cache dei voli (quindi si paga il fornitore ogni volta), nessuna pratica, nessuna iscrizione salvata.",
      peso: "obbligatoria",
      ceSta: c(process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    {
      nome: "NEXT_PUBLIC_SUPABASE_URL",
      serve: "L'indirizzo del database. Serve anche nel browser, per il login.",
      seManca: "Login e area personale non funzionano.",
      peso: "obbligatoria",
      ceSta: c(process.env.NEXT_PUBLIC_SUPABASE_URL),
    },
    {
      nome: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      serve:
        "La chiave pubblica del database: quella che può stare nel browser. Va bene anche col nome vecchio, NEXT_PUBLIC_SUPABASE_ANON_KEY.",
      seManca: "Login e area personale non funzionano.",
      peso: "obbligatoria",
      ceSta: c(
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      ),
    },
    {
      nome: "AERODATABOX_API_KEY",
      serve: "Gli orari veri dei voli. È la fonte del verdetto.",
      seManca:
        "🔴 Il sito passa ai voli DIMOSTRATIVI: risponde solo ai voli che iniziano per ZZ e ogni risposta esce marcata demo. Un vero utente non ottiene niente.",
      peso: "obbligatoria",
      ceSta: c(process.env.AERODATABOX_API_KEY),
    },
    {
      nome: "RESEND_API_KEY",
      serve: "Spedisce le email: conferma iscrizione, benvenuto, avvisi sulla pratica.",
      seManca: "Nessuna email parte. Il resto del sito funziona.",
      peso: "importante",
      ceSta: c(process.env.RESEND_API_KEY),
    },
    {
      nome: "RESEND_MITTENTE",
      serve:
        'Da chi arrivano le email. Il valore esatto è: Valerio di Rivolio <valerio@send.rivolio.it>. ⚠️ SEND.rivolio.it, col "send" davanti: è quello il dominio che Resend ha verificato, e da un altro non spedisce.',
      seManca:
        "Le email partono da un indirizzo di prova di Resend, e SOLO verso l'indirizzo con cui ti sei registrato. ⚠️ E se ci scrivi il dominio nudo (valerio@rivolio.it) è peggio che non metterla: Resend rifiuta ogni invio e non riceve più nessuno, in silenzio.",
      peso: "importante",
      ceSta: c(process.env.RESEND_MITTENTE),
    },
    {
      nome: "RESEND_RISPOSTA_A",
      serve:
        "L'indirizzo dove arriva la risposta di chi preme «Rispondi» su un'email di Rivolio. Mettici una casella che leggi davvero (per esempio valerio@artecai.it).",
      seManca:
        "🔴 Le risposte dei clienti tornano indietro. Il sottodominio da cui spediamo NON riceve posta, e la pagina della lettera dice testualmente «scrivici rispondendo a una qualsiasi email della pratica»: senza questa, quel canale non esiste.",
      peso: "importante",
      ceSta: c(process.env.RESEND_RISPOSTA_A),
    },
    {
      nome: "MISTRAL_API_KEY",
      serve: "Legge la foto della carta d'imbarco e ne ricava volo e data.",
      seManca: "Il pulsante della foto dice che non è disponibile. Gli altri due modi funzionano.",
      peso: "facoltativa",
      ceSta: c(process.env.MISTRAL_API_KEY),
    },
    {
      nome: "NEXT_PUBLIC_CHECK_PREZZO_ATTIVO",
      serve: 'Il muro del check. Vale "1" per farlo pagare, qualsiasi altra cosa lo spegne.',
      seManca: "Il check torna gratuito per tutti, e i testi del sito tornano a dire gratis da soli.",
      peso: "facoltativa",
      ceSta: process.env.NEXT_PUBLIC_CHECK_PREZZO_ATTIVO === "1",
    },
    {
      nome: "STRIPE_SECRET_KEY",
      serve:
        "La chiave della cassa. Con questa il check e la pratica si pagano davvero con Stripe. In prova comincia con sk_test_, dal vivo con sk_live_.",
      seManca:
        "🔴 Niente cassa: il muro del check porta ai prezzi e il bottone della pratica dice «pagamento non attivo». Nessuno può pagare.",
      peso: "obbligatoria",
      ceSta: c(process.env.STRIPE_SECRET_KEY),
    },
    {
      nome: "STRIPE_WEBHOOK_SECRET",
      serve:
        "La firma con cui Stripe ci avvisa che un pagamento è andato a buon fine (whsec_...). È come Stripe ci dice «questo ha pagato davvero, apri la pratica».",
      seManca:
        "🔴 Il cliente paga ma la sua pratica non nasce da sola: rifiutiamo l'avviso di Stripe perché non riusciamo a verificarne la firma.",
      peso: "obbligatoria",
      ceSta: c(process.env.STRIPE_WEBHOOK_SECRET),
    },
    {
      nome: "TELEGRAM_BOT_TOKEN",
      serve:
        "Il gettone del bot che ti manda le notifiche (te lo dà @BotFather). Identifica il BOT, non te.",
      seManca:
        "Niente TIN sul telefono: né i soldi, né i guasti, né il riepilogo della sera. La Panoramica del pannello funziona lo stesso.",
      peso: "facoltativa",
      ceSta: c(process.env.TELEGRAM_BOT_TOKEN),
    },
    {
      nome: "TELEGRAM_ADMIN_CHAT",
      serve:
        "Il numero che identifica TE, cioè a chi scrivere. È diverso dal gettone: se il gettone c'è e questo manca, qui sopra compare il riquadro che te lo trova.",
      seManca: "Come sopra: nessuna notifica parte.",
      peso: "facoltativa",
      ceSta: c(process.env.TELEGRAM_ADMIN_CHAT),
    },
    {
      nome: "MOTORE_SEGRETO",
      serve:
        "Chiude i lavori automatici a chi non è Netlify: gli scioperi di notte, gli avvisi del mattino e, dal 13/08, i PROMEMORIA delle pratiche (il sollecito al giorno 42, l'ente al 56, «com'è andata?» al 90).",
      seManca:
        "In produzione quelle rotte non si aprono. Gli scioperi non si aggiornano e, quel che è peggio, NESSUN promemoria parte: i clienti restano fermi e non se ne accorge nessuno.",
      peso: "importante",
      ceSta: c(process.env.MOTORE_SEGRETO),
    },
    {
      nome: "UPSTASH_REDIS_REST_URL",
      serve:
        "Il freno anti-abuso condiviso. Senza, il tetto di richieste al minuto vive nella memoria di ogni singola copia della funzione: Netlify ne accende molte insieme e il tetto smette di essere un tetto. È il pezzo che impedisce a un estraneo di farci bruciare i soldi dei dati di volo.",
      seManca:
        "Si ripiega sul contatore in memoria, cioè su quello di oggi: ferma un curioso, non chi ci prende di mira. Nessuno resta bloccato per sbaglio.",
      peso: "importante",
      ceSta: c(process.env.UPSTASH_REDIS_REST_URL),
    },
    {
      nome: "UPSTASH_REDIS_REST_TOKEN",
      serve: "La password del freno qui sopra. Servono tutte e due o non si accende.",
      seManca: "Come sopra: freno in memoria.",
      peso: "importante",
      ceSta: c(process.env.UPSTASH_REDIS_REST_TOKEN),
    },
    {
      nome: "TETTO_FORNITORE_ORA",
      serve:
        "Quante chiamate al fornitore dei dati di volo si fanno in un'ora, in tutto il sito. È il tetto sulla SPESA, e funziona già adesso senza configurare niente: il conto lo tiene il database. Sopra il tetto i check escono incerti fino all'ora dopo, e ti arriva un TIN.",
      seManca:
        "Vale mille all'ora, che è molto sopra il traffico di oggi e molto sotto quello che serve a chi vuole farci male. Si scrive un numero qui solo per alzarlo o abbassarlo.",
      peso: "facoltativa",
      ceSta: c(process.env.TETTO_FORNITORE_ORA),
    },
    {
      nome: "NEXT_PUBLIC_SITO",
      serve:
        "L'indirizzo del sito, usato nelle email e nella mappa per Google. ⚠️ Si può TOGLIERE: senza, il sito legge l'indirizzo che Netlify gli dà da solo, e quello non diventa mai vecchio.",
      seManca: "Niente: si usa l'indirizzo di Netlify. È il comportamento consigliato.",
      peso: "facoltativa",
      ceSta: c(process.env.NEXT_PUBLIC_SITO),
    },
    {
      nome: "SHADOW_MODE",
      serve:
        'Riempie l\'elenco "Verdetti da guardare": ogni analisi idonea ci finisce dentro finché non la marchi. ⚠️ NON blocca nessun pagamento (non lo fa più dal 12 agosto): è un controllo a campione sul motore. Si può TOGLIERE: in produzione è acceso da solo.',
      seManca:
        "Niente: in produzione resta acceso lo stesso. Con SHADOW_MODE=0 l'elenco del campione resta sempre vuoto e il motore non lo controlla più nessuno.",
      peso: "facoltativa",
      ceSta: process.env.SHADOW_MODE !== "0",
    },
  ];
}

/* ⚠️ `text-errore` non colorava NIENTE: in app/globals.css il token
   `--color-errore` non esiste, quindi Tailwind non genera quella classe e
   la scritta "MANCA" usciva del colore del testo intorno. Trovato
   guardando il codice mentre si rifaceva il pannello. Il marchio non ha
   un rosso (ha l'oro per gli avvisi), quindi si usa quello che il
   retrobottega usava già altrove. */
const COLORE = {
  obbligatoria: "text-red-600",
  importante: "text-inchiostro",
  facoltativa: "text-fumo",
} as const;

/**
 * Il riquadro del chat id, in un confine suo.
 *
 * Si mostra SOLO quando serve davvero: gettone messo, destinatario
 * ancora no.
 * 🔴 Prima era scritto in modo che il riquadro comparisse anche col chat
 * id già a posto, e allora diceva "Manca il tuo chat id" tre righe sopra
 * la riga che dice "c'è". Due frasi contraddittorie sulla stessa pagina
 * fanno dubitare di tutto il resto, ed è quello che è successo (visto da
 * Valerio, 11/08).
 */
async function RiquadroChatId() {
  const chatDaTrovare = await chatIdDaScoprire();
  return (
    <div className="mt-6 rounded-[14px] border border-bordo bg-white p-5">
      <p className="font-display text-[1.15rem] tracking-[-0.02em]">
        {chatDaTrovare ? "Il tuo chat id è questo" : "Manca il tuo chat id"}
      </p>
      {chatDaTrovare ? (
        <>
          <p className="mt-2 text-[14px] leading-relaxed text-fumo">
            Copialo su Netlify in <code className="text-inchiostro">TELEGRAM_ADMIN_CHAT</code>, poi{" "}
            <em>Trigger deploy</em>. È il numero di {chatDaTrovare.nome || "chi ha scritto al bot"}.
          </p>
          <p className="mt-3 font-mono text-[1.5rem] font-medium text-verde">{chatDaTrovare.id}</p>
        </>
      ) : (
        <p className="mt-2 text-[14px] leading-relaxed text-fumo">
          Il gettone del bot c&apos;è, ma Telegram non sa ancora a chi scrivere. Apri Telegram,
          manda una parola qualsiasi al bot, e <strong>ricarica questa pagina</strong>: il numero
          comparirà qui, da copiare.
        </p>
      )}
    </div>
  );
}

function ChatIdSeManca() {
  if (!process.env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_ADMIN_CHAT) return null;
  return (
    <Suspense
      fallback={
        <div className="mt-6 rounded-[14px] border border-bordo bg-white p-5">
          <p className="font-display text-[1.15rem] tracking-[-0.02em]">Manca il tuo chat id</p>
          <p className="mt-2 text-[14px] leading-relaxed text-fumo">
            Sto chiedendo a Telegram se qualcuno ha scritto al bot…
          </p>
        </div>
      }
    >
      <RiquadroChatId />
    </Suspense>
  );
}

export default async function PaginaImpostazioni() {
  /* ⚠️ Prima riga, sempre: questa pagina dice QUALI segreti sono
     configurati, e non è un elenco da lasciare a chiunque abbia un
     account. Vedi lib/admin/guardia.ts. */
  await soloAdmin();
  const voci = stato();
  const mancanti = voci.filter((v) => !v.ceSta && v.peso !== "facoltativa");

  return (
    /* Il titolo e il ritorno al pannello adesso stanno nella testata e
       nella barra laterale del guscio: ripeterli qui vorrebbe dire due
       titoli uno sopra l'altro. I contenuti sono gli stessi di prima. */
    <div className="w-full max-w-3xl">
      {/* Il paragrafo che stava qui diceva parola per parola quello che
          la testata scrive già sotto il titolo: due volte la stessa frase
          a tre centimetri di distanza. */}
      <div
        className={`rounded-[14px] border p-5 ${
          mancanti.length === 0
            ? "border-verde/30 bg-verde/5"
            : "border-red-200 bg-red-50"
        }`}
      >
        <p className="font-display text-[1.15rem] tracking-[-0.02em]">
          {mancanti.length === 0
            ? "Non manca niente di importante."
            : `Mancano ${mancanti.length} cose che servono.`}
        </p>
        {mancanti.length > 0 && (
          <ul className="mt-2 space-y-1 text-[14px] text-fumo">
            {mancanti.map((v) => (
              <li key={v.nome}>
                <code className="text-inchiostro">{v.nome}</code> · {v.seManca}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* ⚠️ IL PEZZO CHE BLOCCA TUTTI: il gettone del bot e il chat id si
          somigliano, e chi li vede per la prima volta passa il primo
          credendo di passare il secondo (successo l'11/08). Qui il numero
          si scopre da soli: si scrive al bot e si ricarica la pagina.
          Compare SOLO se il chat id manca davvero. */}
      <ChatIdSeManca />
      {/* 🔴 E PRIMA QUESTO PEZZO TENEVA FERMA TUTTA LA PAGINA. La chiamata
          a Telegram sta dentro il suo confine con `Suspense`: se Telegram
          non risponde, l'attesa è di sei secondi, e finché era in linea col
          resto nessuno vedeva NIENTE per sei secondi, nemmeno l'elenco
          delle variabili, che è la ragione per cui si apre questa pagina.
          Adesso il resto compare subito e questo riquadro arriva dopo.
          Trovato dall'ispezione del 12/08. */}

      <div className="mt-8 space-y-3">
        {voci.map((v) => (
          <div key={v.nome} className="rounded-[14px] border border-bordo bg-white p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <code className="text-[13.5px] font-medium text-inchiostro">{v.nome}</code>
              <span
                className={`text-[12.5px] font-medium ${v.ceSta ? "text-verde" : COLORE[v.peso]}`}
              >
                {v.ceSta ? "c'è" : v.peso === "facoltativa" ? "non c'è (va bene)" : "MANCA"}
              </span>
            </div>
            <p className="mt-2 text-[14px] leading-relaxed text-fumo">{v.serve}</p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-fumo-2">
              <span className="font-medium text-inchiostro">Se manca:</span> {v.seManca}
            </p>
          </div>
        ))}
      </div>

      <p className="mt-8 text-[13px] leading-relaxed text-fumo-2">
        Si cambiano su Netlify, in <em>Project configuration → Environment
        variables</em>. ⚠️ Dopo ogni cambio serve un deploy nuovo (<em>Deploys →
        Trigger deploy → Clear cache and deploy site</em>): questi valori
        entrano nel sito quando viene costruito, non quando qualcuno lo apre.
      </p>

      <QuandoArrivaIlDominio />
    </div>
  );
}
