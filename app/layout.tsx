import type { Metadata } from "next";
import { Geist, Instrument_Serif, Poppins } from "next/font/google";
import AntiCopia from "@/components/AntiCopia";
import IndirizzoPulito from "@/components/IndirizzoPulito";
import ScrollPesante from "@/components/ScrollPesante";
import Visita from "@/components/Visita";
import ContaClic from "@/components/creator/ContaClic";
import AncoreLisce from "@/components/AncoreLisce";
import "./globals.css";

import { PREZZO_LANCIO, seSiPaga } from "@/lib/check/ingresso";
import { euro } from "@/lib/prezzi";
// Geist per i titoli, Poppins per il testo.
const geist = Geist({ variable: "--font-geist", subsets: ["latin"], display: "swap" });
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

/**
 * La terza voce: un serif in corsivo, solo per la parola che deve restare
 * in testa. Serve a spezzare la riga del titolo con un cambio di carattere
 * invece che con un colore o un grassetto. È il trucco che fa sembrare
 * scritto a mano un titolo altrimenti da modello.
 * Si usa POCO: una frase per sezione al massimo, mai per un paragrafo.
 */
const serif = Instrument_Serif({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: "italic",
  display: "swap",
});

/**
 * L'indirizzo di casa del sito. Serve a rendere assoluto il link
 * dell'immagine social: senza, Facebook e WhatsApp cercano l'anteprima su
 * localhost e non trovano niente.
 * Su Netlify arriva da sola in URL; in locale ripiega su localhost.
 */
const CASA = new URL(
  process.env.NEXT_PUBLIC_SITO ?? process.env.URL ?? "http://localhost:3000",
);

export const metadata: Metadata = {
  metadataBase: CASA,
  title: "Rivolio | Riprenditi i soldi che ti devono.",
  description:
    seSiPaga(
      `Scopri in 30 secondi se una compagnia ti deve dei soldi. L'analisi del volo costa ${euro(PREZZO_LANCIO)} col dato oggettivo; se ti spetta, il reclamo te lo prepariamo noi e tieni il 100%.`,
      "Scopri in 30 secondi se una compagnia ti deve dei soldi. Check gratuito col dato oggettivo del volo; se ti spetta, il reclamo te lo prepariamo noi e tieni il 100%.",
    ),
  openGraph: {
    title: "Rivolio",
    description:
      /* Il gancio è "ti è appena successo", non più "gli ultimi 5 anni":
         il check verifica 12 mesi indietro, e un volo più vecchio torna
         incerto, che per regola non si vende. Promettere 5 anni portava
         traffico che non poteva convertire per costruzione. */
      seSiPaga(
        `Volo in ritardo o cancellato? Forse ti devono fino a 600€. Controlla in 30 secondi per ${euro(PREZZO_LANCIO)}, col dato ufficiale del tuo volo.`,
        "Volo in ritardo o cancellato? Forse ti devono fino a 600€. Controlla gratis in 30 secondi, col dato ufficiale del tuo volo.",
      ),
    locale: "it_IT",
    type: "website",
  },
};

/**
 * I dati strutturati (JSON-LD): dicono ai motori e alle AI chi siamo.
 * Solo Organization e WebSite: FAQPage è riservato da Google a siti
 * governativi e sanitari, HowTo è morto nel 2023. Niente forzature.
 */
const DATI_STRUTTURATI = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${CASA.href}#organizzazione`,
      name: "Rivolio",
      url: CASA.href,
      logo: `${CASA.href}icon.png`,
      description:
        seSiPaga(
          "Lo scanner dei rimborsi: analisi dei voli in ritardo col dato ufficiale e reclamo pronto da inviare. CE 261/2004.",
          "Lo scanner dei rimborsi: verifica gratuita dei voli in ritardo e reclamo pronto da inviare. CE 261/2004.",
        ),
    },
    {
      "@type": "WebSite",
      "@id": `${CASA.href}#sito`,
      name: "Rivolio",
      url: CASA.href,
      inLanguage: "it-IT",
      publisher: { "@id": `${CASA.href}#organizzazione` },
    },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      className={`${geist.variable} ${poppins.variable} ${serif.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-nebbia text-inchiostro">
        <script
          type="application/ld+json"
          /* Il "<" si scrive escapato: un dato che contenesse "</script>"
             non potrebbe chiudere il tag. Qui i dati sono nostri, ma è
             l'abitudine giusta ovunque un valore finisca dentro uno script. */
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(DATI_STRUTTURATI).replace(/</g, "\\u003c"),
          }}
        />
        <AntiCopia />
        <IndirizzoPulito />
        <ScrollPesante />
        <Visita />
        <ContaClic />
        <AncoreLisce />
        {children}
      </body>
    </html>
  );
}
