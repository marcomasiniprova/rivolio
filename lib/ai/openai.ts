/**
 * IL CLIENT OPENAI, uno per tutto il progetto.
 *
 * Dal 27/08 il cervello dell'AI è OpenAI (scelta di Valerio), al posto di
 * Mistral: la controrisposta alla compagnia (testo) e la lettura delle
 * immagini (vision, l'OCR della carta d'imbarco e degli screenshot)
 * girano sullo stesso modello, `gpt-5.6-terra`, che fa tutte e due.
 *
 * ⚠️ IL MODELLO NON DECIDE MAI IL VERDETTO. Qui l'AI legge e scrive
 * DENTRO i paletti. Il cancello deterministico resta identico e vive dove
 * viveva: `controlla()` in lib/ai/replica.ts (boccia sentenze e cifre
 * inventate) ed `estraiCampi()`/`confrontaConVerifica()` in
 * lib/ocr/carta-imbarco.ts (l'estrazione è a regex, il confronto è
 * deterministico). Un modello più bravo non ha più libertà di inventare:
 * ha solo più comprensione.
 *
 * La chiave sta in OPENAI_API_KEY (mai nel repo: solo su Netlify e in
 * .env.development.local). Il modello sta in OPENAI_MODELLO, così il
 * giorno di un modello nuovo si cambia una variabile, non il codice.
 */

const ENDPOINT = "https://api.openai.com/v1/chat/completions";

/** Il modello di punta, sovrascrivibile da variabile senza toccare il codice. */
export const MODELLO_OPENAI = process.env.OPENAI_MODELLO || "gpt-5.6-terra";

/** C'è la chiave? Se no, chi chiama ripiega (Mistral finché c'è, o testo fisso). */
export function openAIAttivo(): boolean {
  return !!process.env.OPENAI_API_KEY;
}

type ParteTesto = { type: "text"; text: string };
type ParteImmagine = { type: "image_url"; image_url: { url: string } };
type Messaggio =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "user"; content: (ParteTesto | ParteImmagine)[] };

/** La chiamata grezza. Torna il contenuto del primo messaggio, o null. */
async function chiama(
  messaggi: Messaggio[],
  opz: { json?: boolean; maxTokens?: number; timeoutMs?: number },
): Promise<string | null> {
  const chiave = process.env.OPENAI_API_KEY;
  if (!chiave) return null;
  try {
    const corpo: Record<string, unknown> = {
      model: MODELLO_OPENAI,
      /* ⚠️ NIENTE temperature. gpt-5.6-terra accetta SOLO il valore di
         default (1): con `temperature: 0` risponde 400 e la chiamata cade
         (verificato dal vivo il 27/08, l'errore diceva "does not support 0
         with this model"). La determinismo che serve non lo dà la
         temperatura: lo dà il cancello a valle (controlla(), estraiCampi()),
         che boccia sentenze, cifre e campi inventati qualunque cosa scriva
         il modello. */
      /* La famiglia GPT-5 vuole max_completion_tokens, non max_tokens. */
      max_completion_tokens: opz.maxTokens ?? 1500,
      messages: messaggi,
    };
    if (opz.json) corpo.response_format = { type: "json_object" };
    const r = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${chiave}`,
      },
      body: JSON.stringify(corpo),
      /* ⚠️ Il tetto sta SOTTO i 26s della funzione Netlify (netlify.toml):
         se l'AI è lenta scatta questo timeout, la chiamata torna null e chi
         la usa degrada in modo pulito (testo fisso, oppure "scrivi a mano"
         sull'OCR), invece di farsi uccidere dalla piattaforma con un 502
         PRIMA che il ripiego parta. Un timeout più lungo del tetto è un
         ripiego che non viene mai eseguito. */
      signal: AbortSignal.timeout(opz.timeoutMs ?? 15_000),
    });
    if (!r.ok) {
      /* Vistoso: se la chiave o il modello sono sbagliati, si vede subito
         nel log invece di degradare in silenzio. */
      console.warn("[openai] ha risposto", r.status, (await r.text().catch(() => "")).slice(0, 300));
      return null;
    }
    const dati = (await r.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return dati.choices?.[0]?.message?.content?.trim() || null;
  } catch (e) {
    console.warn("[openai] chiamata fallita:", e);
    return null;
  }
}

/**
 * TESTO: un sistema e un utente, con JSON mode opzionale.
 * La usa la controrisposta (lib/ai/replica.ts) e l'autopilota scioperi.
 */
export async function completaOpenAI(opz: {
  sistema: string;
  utente: string;
  json?: boolean;
  maxTokens?: number;
  timeoutMs?: number;
}): Promise<string | null> {
  return chiama(
    [
      { role: "system", content: opz.sistema },
      { role: "user", content: opz.utente },
    ],
    { json: opz.json, maxTokens: opz.maxTokens, timeoutMs: opz.timeoutMs },
  );
}

/**
 * VISION: legge un'immagine (o un PDF fotografato) e la TRASCRIVE in testo
 * grezzo, esattamente com'è. Non interpreta: l'estrazione dei campi resta
 * a regex, deterministica, in lib/ocr/carta-imbarco.ts. Sostituisce l'OCR
 * di Mistral.
 */
export async function trascriviImmagineOpenAI(
  base64: string,
  tipoMime: string,
  istruzione: string,
  timeoutMs = 15_000,
): Promise<string | null> {
  return chiama(
    [
      {
        role: "user",
        content: [
          { type: "text", text: istruzione },
          { type: "image_url", image_url: { url: `data:${tipoMime};base64,${base64}` } },
        ],
      },
    ],
    { maxTokens: 2000, timeoutMs },
  );
}
