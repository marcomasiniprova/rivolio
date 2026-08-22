-- Creator "gratis a vita": un flag sull'account, non un codice.
--
-- Un account con creator=true fa check e pratiche senza pagare, per sempre.
-- Lo alza SOLO l'admin dal pannello (con la chiave di servizio), e il muro
-- del check e la cassa della pratica lo leggono lato server. Un utente non
-- se lo puo' dare da solo.
--
-- Diverso dal codice affiliato (?ref=CODICE), che serve a chi PORTA clienti:
-- quello sconta al cliente e paga una commissione al creator; questo azzera
-- il prezzo per il creator stesso.
--
-- Applicata sul database vero il 22/08 col connettore Supabase.

alter table public.profili
  add column if not exists creator boolean not null default false;

comment on column public.profili.creator is
  'Gratis a vita: check e pratiche senza pagare. Lo alza solo l''admin, letto solo dal server.';
