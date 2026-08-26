-- APPLICATA sul Supabase vero il 26/08 col connettore (migrazione
-- 2026-08-26-profili-colonne-sicure).
--
-- 🔴 ESCALATION A ADMIN, chiusa. Trovata dall'audit del pannello (26/08).
--
-- Il permesso UPDATE su `profili` era dato ad `authenticated` su TUTTE le
-- colonne, `ruolo` compresa (grant della migrazione 2026-08-16). La policy
-- RLS «modifico solo il mio profilo» controlla che la riga sia la propria
-- (auth.uid()=id), NON quali colonne si toccano. Le due serrature messe in
-- fila lasciavano un buco enorme: un utente che ha solo fatto un check e
-- creato l'account poteva, dalla console del browser con la chiave
-- publishable già nel bundle, lanciare
--     update profili set ruolo='admin' where id = auth.uid()
-- e passare `soloAdmin()` ovunque: incassi, vendite, affiliati, commissioni.
-- Un takeover completo del pannello a partire da un account gratuito. Erano
-- auto-modificabili anche creator (gratis a vita), crediti, tetto
-- settimanale, email.
--
-- IL FIX è la restrizione di COLONNA, che la policy da sola non dà: si
-- toglie il permesso su tutte le colonne e lo si ridà SOLO su quelle che un
-- utente cambia davvero del proprio profilo:
--   - nickname, classifica_optin  (web app: app/app/azioni.ts)
--   - expo_push_token             (app sul telefono: mobile/src/lib/notifiche.ts)
--   - comune, lat, lng            (città di partenza dell'Osservatorio)
-- Da qui in poi un UPDATE che tocca `ruolo` (o creator, crediti, email...)
-- viene respinto da Postgres con «permission denied for column». Le
-- promozioni ad admin/creator restano solo via chiave di servizio (admin).
-- La policy RLS resta invariata.

revoke update on public.profili from authenticated;
grant update (nickname, classifica_optin, expo_push_token, comune, lat, lng)
  on public.profili to authenticated;

-- Controllo: authenticated deve vedere SOLO le sei colonne sicure.
--   select column_name from information_schema.column_privileges
--   where table_schema='public' and table_name='profili'
--     and grantee='authenticated' and privilege_type='UPDATE'
--   order by column_name;
