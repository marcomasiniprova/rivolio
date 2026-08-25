"use client";

import { useState, type FormEvent } from "react";

/**
 * Il modulo di candidatura creator. Manda i dati a /api/creator/candidati,
 * che avvisa l'admin. Nessun dato sensibile, nessun pagamento: è un "fatti
 * vedere", non un login.
 */
export default function ModuloCandidatura() {
  const [stato, setStato] = useState<"fermo" | "invio" | "fatto">("fermo");
  const [errore, setErrore] = useState<string | null>(null);

  async function invia(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrore(null);
    setStato("invio");
    const f = new FormData(e.currentTarget);
    try {
      const r = await fetch("/api/creator/candidati", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          nome: f.get("nome"),
          email: f.get("email"),
          canale: f.get("canale"),
          profilo: f.get("profilo"),
        }),
      });
      const dati = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErrore(dati.errore ?? "Non è andata. Riprova fra un attimo.");
        setStato("fermo");
        return;
      }
      setStato("fatto");
    } catch {
      setErrore("Manca la rete. Riprova.");
      setStato("fermo");
    }
  }

  if (stato === "fatto") {
    return (
      <div className="rounded-2xl border border-verde/25 bg-menta-tenue/50 px-6 py-8 text-center">
        <p className="font-display text-[1.3rem] text-inchiostro">Ci sei.</p>
        <p className="mt-2 text-[0.98rem] leading-relaxed text-fumo">
          Ti abbiamo ricevuto. Ti scriviamo noi col tuo link e il tuo codice, di solito entro un
          giorno. Nel frattempo pensa a un paio di idee per il primo video.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={invia} className="flex flex-col gap-3">
      <input
        name="nome"
        required
        placeholder="Il tuo nome"
        className="rounded-xl border border-bordo bg-white px-4 py-3 text-[0.98rem] outline-none focus:border-verde"
      />
      <input
        name="email"
        type="email"
        required
        placeholder="La tua email"
        className="rounded-xl border border-bordo bg-white px-4 py-3 text-[0.98rem] outline-none focus:border-verde"
      />
      <select
        name="canale"
        defaultValue=""
        className="rounded-xl border border-bordo bg-white px-4 py-3 text-[0.98rem] text-inchiostro outline-none focus:border-verde"
      >
        <option value="" disabled>
          Dove pubblichi?
        </option>
        <option>TikTok</option>
        <option>Instagram</option>
        <option>YouTube</option>
        <option>Altro</option>
      </select>
      <input
        name="profilo"
        required
        placeholder="Il tuo profilo (link o @)"
        className="rounded-xl border border-bordo bg-white px-4 py-3 text-[0.98rem] outline-none focus:border-verde"
      />
      {errore && <p className="text-[0.9rem] text-red-600">{errore}</p>}
      <button
        type="submit"
        disabled={stato === "invio"}
        className="mt-1 rounded-xl bg-verde px-5 py-3 font-medium text-white transition-colors hover:bg-verde-scuro disabled:opacity-60"
      >
        {stato === "invio" ? "Invio..." : "Candidati"}
      </button>
      <p className="text-[0.8rem] leading-relaxed text-fumo-2">
        Nessun costo e nessun impegno. Guardiamo chi sei e ti diamo il tuo link.
      </p>
    </form>
  );
}
