import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import BoxCheck from "@/components/tabellone/BoxCheck";
import SezioneNewsletter from "@/components/tabellone/SezioneNewsletter";
import {
  CosaTiSpettaComunque,
  DaLeggere,
  FontiEvento,
  SchedaSciopero,
  Semaforo,
  TabellaTipiSciopero,
  TestataEvento,
} from "@/components/eventi/Pezzi";
import { FONTI_SCIOPERO } from "@/lib/eventi/significato";
import { dataInItaliano, giorniDa, giornoEData } from "@/lib/date";
import { oggiInItalia, scioperiDelGiorno } from "@/lib/scioperi/scioperi";
import { CASA, datiBriciole, scriptDati } from "@/lib/tabellone/seo";

import { seSiPaga } from "@/lib/check/ingresso";
/**
 * LA PAGINA DI UN SINGOLO GIORNO DI SCIOPERO.
 *
 * Nasce da sola per ogni data che sta in tabella. Vive tre vite:
 * prima del giorno serve a chi ha il biglietto e si preoccupa, il giorno
 * stesso a chi è bloccato, dopo a chi vuole i soldi. Il testo cambia
 * di conseguenza: è la stessa pagina, ma non dice la stessa cosa.
 *
 * Niente `generateStaticParams`: le date le sa solo il database, e una
 * build senza database (la sandbox) non deve fallire. Le pagine si
 * costruiscono alla prima visita e restano in cache un quarto d'ora.
 */

export const revalidate = 900;

type Parametri = { params: Promise<{ data: string }> };

const DATA_OK = /^\d{4}-\d{2}-\d{2}$/;

/* La forma non basta: "2026-02-30" ha la forma giusta ma non esiste. Una data
   impossibile deve dare 404 SUBITO, senza nemmeno interrogare il database: una
   pagina vuota su una data che non c'e' e' solo un buco SEO, e senza chiave
   Supabase la lettura alzerebbe un 500 invece del 404 giusto. */
function dataReale(iso: string): boolean {
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export async function generateMetadata({ params }: Parametri): Promise<Metadata> {
  const { data } = await params;
  if (!DATA_OK.test(data) || !dataReale(data)) return {};
  const quando = dataInItaliano(data);
  return {
    title: `Sciopero aerei ${quando}: i voli e cosa ti spetta | Rivolio`,
    description: `Chi si ferma il ${quando}, quali voli sono a rischio e cosa ti spetta se il tuo salta. ${seSiPaga("Con l'analisi del volo sul dato ufficiale.", "Con il controllo gratuito del volo.")}`,
    alternates: { canonical: `/sciopero-aerei/${data}` },
    openGraph: {
      title: `Sciopero aerei ${quando}`,
      description: `Chi si ferma, quali voli sono a rischio e cosa ti spetta se il tuo salta.`,
      locale: "it_IT",
      type: "article",
    },
  };
}

export default async function PaginaGiornoSciopero({ params }: Parametri) {
  const { data } = await params;
  if (!DATA_OK.test(data) || !dataReale(data)) notFound();

  const scioperi = await scioperiDelGiorno(data);
  if (scioperi.length === 0) notFound();

  const oggi = oggiInItalia();
  const giorni = giorniDa(data, oggi);
  const quando = dataInItaliano(data);

  /* Tre vite, tre testate. */
  const semaforo =
    giorni > 0
      ? {
          stato: "attenzione" as const,
          titolo: `Mancano ${giorni} ${giorni === 1 ? "giorno" : "giorni"}`,
          testo:
            "Se hai un volo quel giorno, la cosa più utile che puoi fare adesso è controllare che la compagnia non ti abbia già spostato: la comunicazione arriva spesso via email e finisce nella posta indesiderata. E salva la prenotazione, ti servirà.",
        }
      : giorni === 0
        ? {
            stato: "brutto" as const,
            titolo: "È oggi",
            testo:
              "Se sei in aeroporto: non uscire senza aver chiesto per iscritto il motivo, fotografa il tabellone e conserva la carta d'imbarco. Sotto trovi cosa ti spetta comunque.",
          }
        : {
            stato: "calmo" as const,
            titolo: `È passato da ${Math.abs(giorni)} ${Math.abs(giorni) === 1 ? "giorno" : "giorni"}`,
            testo:
              "Serve ancora: la finestra per scrivere alla compagnia non si chiude il giorno dopo. Se il tuo volo di quel giorno è saltato o è arrivato tardi, controllalo qui sotto.",
          };

  const sottotitolo =
    scioperi.length === 1
      ? `${scioperi[0].settore}. Cosa vuol dire per il tuo volo, e cosa ti spetta comunque.`
      : `${scioperi.length} agitazioni proclamate nello stesso giorno. Cosa vogliono dire per il tuo volo, e cosa ti spetta comunque.`;

  const datiEvento = {
    "@context": "https://schema.org",
    "@type": "Event",
    name: `Sciopero del trasporto aereo del ${quando}`,
    startDate: data,
    endDate: data,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    description: scioperi.map((s) => s.descrizione).join(" "),
    url: `${CASA}/sciopero-aerei/${data}`,
    location: {
      "@type": "Place",
      name: "Aeroporti italiani",
      address: { "@type": "PostalAddress", addressCountry: "IT" },
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={scriptDati(datiEvento)} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={scriptDati(
          datiBriciole([
            { nome: "Rivolio", percorso: "/" },
            { nome: "Sciopero aerei", percorso: "/sciopero-aerei" },
            { nome: quando, percorso: `/sciopero-aerei/${data}` },
          ]),
        )}
      />
      <Nav />
      <main>
        <TestataEvento
          occhiello={giornoEData(data)}
          titolo="Sciopero aerei"
          corsivo={`del ${quando}`}
          sottotitolo={sottotitolo}
          briciole={[
            { nome: "Rivolio", dove: "/" },
            { nome: "Sciopero aerei", dove: "/sciopero-aerei" },
          ]}
        />

        <div className="px-5 pb-24 pt-10 sm:px-8">
          <div className="mx-auto flex max-w-[860px] flex-col gap-14">
            <Semaforo {...semaforo} />

            <section>
              <h2 className="font-display text-[24px] font-semibold tracking-[-0.03em] text-inchiostro">
                {scioperi.length === 1 ? "Chi si ferma" : "Chi si ferma, agitazione per agitazione"}
              </h2>
              <div className="mt-5 flex flex-col gap-4">
                {scioperi.map((s) => (
                  <SchedaSciopero key={s.id} sciopero={s} conLink={false} />
                ))}
              </div>
            </section>

            <BoxCheck
              titolo={
                giorni < 0
                  ? "Il tuo volo di quel giorno: controlla cosa dicono i dati"
                  : seSiPaga("Analizza il tuo volo", "Controlla il tuo volo, gratis")
              }
              testo="Senza account e senza carta. Guardiamo l'orario di arrivo effettivo registrato dal tracciamento e ti diciamo se il caso regge. Nei giorni di sciopero restiamo prudenti per costruzione: se l'esito dipende da chi si è fermato, non ti vendiamo niente."
            />

            <CosaTiSpettaComunque />
            <TabellaTipiSciopero />

            <DaLeggere
              voci={[
                {
                  titolo: "Cosa fare mentre sei in aeroporto",
                  dove: "/tabellone/sciopero-aerei-cosa-fare-in-aeroporto",
                  testo: "Cinque mosse in ordine, da leggere in piedi.",
                },
                {
                  titolo: "Tutte le date degli scioperi",
                  dove: "/sciopero-aerei",
                  testo: "Il calendario aggiornato, con le pagine di ogni giornata.",
                },
                {
                  titolo: "Volo cancellato: i primi 60 minuti",
                  dove: "/tabellone/volo-cancellato-primi-60-minuti",
                  testo: "Le prove da salvare prima di uscire dall'aeroporto.",
                },
                {
                  titolo: "Quando ti spettano 250, 400 o 600 euro",
                  dove: "/tabellone/volo-in-ritardo-250-400-600-euro",
                  testo: "La soglia, le fasce e i casi in cui non spetta niente.",
                },
              ]}
            />

            <FontiEvento
              fonti={FONTI_SCIOPERO}
              nota="Ogni scheda qui sopra porta il link alla proclamazione da cui viene la data. Le regole vengono dall'ENAC e dalle pronunce citate."
            />
          </div>
        </div>

        <SezioneNewsletter />
      </main>
      <Footer />
    </>
  );
}
