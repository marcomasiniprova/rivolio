import { readFile } from "node:fs/promises";
import { ImageResponse } from "next/og";

/**
 * L'immagine social (Open Graph): quello che si vede quando si incolla il
 * link di rivolio.it su Instagram, WhatsApp, Telegram, Facebook o X.
 *
 * Scelta di Valerio (25/08): fondo BIANCO, pulito, dritto, col logo a posto.
 * Prima era una cartolina verde con la card del verdetto: in miniatura si
 * affastellava. Adesso logo + tagline + una riga onesta, e un solo numero
 * grande (fino a 600€) come gancio. Niente prezzo del check qui dentro: i
 * prezzi cambiano, e la cache di Instagram tiene l'immagine per settimane.
 */
export const alt = "Rivolio: riprenditi i soldi che ti devono";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * 🔴 I BYTE SI CONTROLLANO PRIMA DI USARLI. `readFile` non lancia se il file
 * si legge a metà: torna dei byte che non sono più un PNG, e il guasto salta
 * fuori dopo, dentro il disegno, con un 500 al posto della cartolina. Un PNG
 * comincia sempre con la stessa firma di otto byte: se non c'è, si fa finta
 * che il marchio non ci sia (cartolina senza lente, valida lo stesso).
 */
const FIRMA_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function leggiMarchio(): Promise<string | null> {
  try {
    const dati = await readFile(new URL("./marchio-og.png", import.meta.url));
    if (dati.length < 1024 || !dati.subarray(0, 8).equals(FIRMA_PNG)) {
      console.warn("[og] il marchio non è un PNG valido: cartolina senza logo");
      return null;
    }
    return `data:image/png;base64,${dati.toString("base64")}`;
  } catch {
    return null;
  }
}

export default async function Anteprima() {
  const segno = await leggiMarchio();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        {/* la firma di identità: una lama verde in alto */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 12,
            background: "linear-gradient(90deg,#0a9d5c,#14c06e)",
          }}
        />

        <div style={{ display: "flex", flex: 1, alignItems: "center", gap: 56, padding: "80px 84px" }}>
          {/* colonna sinistra: marchio, tagline, riga di servizio */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 40 }}>
              {segno && <img src={segno} width={82} height={82} alt="" />}
              <span style={{ fontSize: 40, fontWeight: 700, color: "#0a2a1e", letterSpacing: -1 }}>
                Rivo<span style={{ color: "#0a9d5c" }}>lio</span>
              </span>
            </div>

            <span style={{ fontSize: 70, fontWeight: 800, lineHeight: 1.03, letterSpacing: -3, color: "#0a1f17" }}>
              Riprenditi i soldi
            </span>
            <span style={{ fontSize: 70, fontWeight: 800, lineHeight: 1.03, letterSpacing: -3, color: "#0a9d5c" }}>
              che ti devono.
            </span>

            <span style={{ fontSize: 27, color: "#5b6b64", marginTop: 28, lineHeight: 1.45 }}>
              Voli in ritardo o cancellati. Scopri in 30 secondi quanto ti
              spetta, senza account. Reg. CE 261/2004.
            </span>
          </div>

          {/* accento a destra: un numero solo, il gancio */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              background: "#0a9d5c",
              borderRadius: 32,
              padding: "48px 36px",
              width: 290,
            }}
          >
            <span style={{ fontSize: 25, color: "#bff0d6", fontWeight: 600 }}>fino a</span>
            <span style={{ fontSize: 98, fontWeight: 800, color: "#ffffff", lineHeight: 1, letterSpacing: -3 }}>
              600€
            </span>
            <span style={{ fontSize: 22, color: "#bff0d6", marginTop: 10 }}>a passeggero</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
