import { redirect } from "next/navigation";
import { soloAdmin } from "@/lib/admin/guardia";

/**
 * I Verdetti sono diventati mezza sezione dentro Pratiche (scelta di
 * Valerio, 26/08). Questo indirizzo resta vivo per i vecchi segnalibri:
 * controlla il ruolo (come ogni pagina del pannello) e porta alle
 * Pratiche, dove ora sta il controllo a campione.
 */
export default async function VerdettiSpostati() {
  await soloAdmin();
  redirect("/admin/pratiche");
}
