import type { Metadata } from "next";
import Link from "next/link";
import Logo from "@/components/Logo";
import ModuloCandidatura from "./ModuloCandidatura";

export const metadata: Metadata = {
  title: "Diventa creator di Rivolio · guadagna il 40%",
  description:
    "Racconta Rivolio ai tuoi follower: loro risparmiano il 10%, tu prendi il 40% su ogni pratica. Ai voli in ritardo pensiamo noi.",
};

function Passo({ n, titolo, testo }: { n: number; titolo: string; testo: string }) {
  return (
    <div className="flex gap-4">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-menta-tenue font-display text-[1.05rem] text-verde-scuro">
        {n}
      </span>
      <div>
        <p className="font-medium text-inchiostro">{titolo}</p>
        <p className="mt-1 text-[0.96rem] leading-relaxed text-fumo">{testo}</p>
      </div>
    </div>
  );
}

export default function PaginaCreator() {
  return (
    <div className="min-h-dvh bg-nebbia">
      <header className="border-b border-bordo bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <Link href="/" className="text-sm text-fumo transition-colors hover:text-inchiostro">
            Torna al sito
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="font-medium uppercase tracking-[0.14em] text-verde">Programma creator</p>
        <h1 className="mt-3 font-display text-[2.3rem] leading-[1.08] tracking-[-0.03em] text-inchiostro sm:text-[3rem]">
          Fai guadagnare i tuoi follower.
          <br />
          E prendi il <span className="text-verde">40%</span>.
        </h1>
        <p className="mt-5 max-w-2xl text-[1.08rem] leading-relaxed text-fumo">
          Rivolio recupera i soldi dei voli in ritardo o cancellati. Tu lo racconti, il tuo pubblico
          paga il 10% in meno col tuo link, e tu prendi il 40% su ogni pratica che parte da lì.
        </p>
        <a
          href="#candidati"
          className="mt-7 inline-flex rounded-xl bg-verde px-6 py-3 font-medium text-white transition-colors hover:bg-verde-scuro"
        >
          Candidati
        </a>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            { big: "40%", t: "a te", d: "Su ogni pratica che porti. Su una da 16,90€ sono circa 6€ in tasca tua." },
            { big: "10%", t: "di sconto al tuo pubblico", d: "Chi arriva col tuo link o codice paga meno. È un regalo che fai tu." },
            { big: "0€", t: "di costi e di rischi", d: "Ti candidi e basta. Niente da pagare, niente da anticipare." },
          ].map((c) => (
            <div key={c.t} className="rounded-2xl border border-bordo bg-white px-6 py-7">
              <p className="font-display text-[2.4rem] leading-none text-verde">{c.big}</p>
              <p className="mt-2 font-medium text-inchiostro">{c.t}</p>
              <p className="mt-2 text-[0.94rem] leading-relaxed text-fumo">{c.d}</p>
            </div>
          ))}
        </div>

        <div className="mt-16">
          <h2 className="font-display text-[1.7rem] tracking-[-0.02em] text-inchiostro">Come funziona</h2>
          <div className="mt-6 flex flex-col gap-6">
            <Passo n={1} titolo="Ti candidi qui sotto" testo="Ci dici chi sei e dove pubblichi. Guardiamo e ti rispondiamo, di solito entro un giorno." />
            <Passo n={2} titolo="Ti diamo il tuo link e il tuo codice" testo="Tipo rivolio.it/?ref=ILTUONOME. Chi ci arriva ha lo sconto, e la vendita resta tua per 60 giorni dal clic." />
            <Passo n={3} titolo="Lo metti nei tuoi contenuti" testo="Nei video, in bio, nelle storie. Ogni pratica che parte da lì ti frutta il 40%." />
          </div>
        </div>

        <div className="mt-16 rounded-2xl border border-verde/20 bg-menta-tenue/40 px-6 py-8 sm:px-9">
          <h2 className="font-display text-[1.5rem] tracking-[-0.02em] text-inchiostro">
            Perché si racconta da solo
          </h2>
          <ul className="mt-4 flex flex-col gap-3 text-[0.98rem] leading-relaxed text-fumo">
            <li>
              <span className="font-medium text-inchiostro">È onesto.</span> Il check dice la verità, e
              diciamo pure che uno potrebbe farlo gratis da sé. Questo fa fiducia, e la fiducia converte.
            </li>
            <li>
              <span className="font-medium text-inchiostro">C'è la garanzia.</span> Se la compagnia non
              paga, il cliente non paga. Difficile trovare un motivo per non provarci.
            </li>
            <li>
              <span className="font-medium text-inchiostro">Il numero fa il video.</span> "Ti devono
              400€ per quel volo" è un gancio che gira da solo su TikTok e sui Reels.
            </li>
          </ul>
        </div>

        <p className="mt-12 text-[0.96rem] leading-relaxed text-fumo">
          <span className="font-medium text-inchiostro">Come ti paghiamo:</span> a mano, dopo aver
          verificato le vendite, e ti diciamo quanto hai maturato. Niente conteggi finti. Presto avrai
          anche una pagina tua dove vedere tutto in tempo reale, ci stiamo lavorando.
        </p>

        <div id="candidati" className="mt-16 scroll-mt-20 rounded-2xl border border-bordo bg-white px-6 py-8 sm:px-9">
          <h2 className="font-display text-[1.7rem] tracking-[-0.02em] text-inchiostro">Candidati</h2>
          <p className="mt-2 mb-6 text-[0.98rem] leading-relaxed text-fumo">
            Due minuti. Ti scriviamo noi col tuo link.
          </p>
          <ModuloCandidatura />
        </div>
      </main>
    </div>
  );
}
