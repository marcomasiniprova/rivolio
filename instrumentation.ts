import * as Sentry from "@sentry/nextjs";

/**
 * L'AGGANCIO DI SENTRY AL SERVER (audit 26/08).
 *
 * Next chiama `register()` una volta all'avvio: qui si carica la
 * configurazione giusta a seconda del motore (Node o edge). E
 * `onRequestError` è il gancio, nuovo di Next 15/16, che cattura OGNI errore
 * non gestito che esplode dal server: rotte, server component, server action,
 * middleware. È il modo raccomandato, non una scorciatoia.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

export const onRequestError = Sentry.captureRequestError;
