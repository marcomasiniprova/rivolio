-- Cruscotto affiliati (brief creator del 26/08). APPLICATA sul Supabase vero
-- il 26/08 col connettore (due migrazioni: affiliati_dashboard e ultimo_clic).
-- Il modello economico completo (bonus a soglie, accordo ibrido col fisso),
-- il link corto e privato (token), il conteggio clic con la data dell'ultimo,
-- e la variante (singola/famiglia) sulla commissione per separare i bonus.

alter table public.affiliati
  add column if not exists tipo_accordo text not null default 'performance'
    check (tipo_accordo in ('performance', 'ibrido')),
  add column if not exists bonus_fisso numeric(10,2) not null default 0,
  add column if not exists bonus_fisso_pagato_il timestamptz,
  add column if not exists bonus_pagato numeric(10,2) not null default 0,
  add column if not exists seguito integer,
  add column if not exists click integer not null default 0,
  add column if not exists ultimo_clic timestamptz,
  add column if not exists token text unique;

comment on column public.affiliati.tipo_accordo is 'performance = solo 40% + bonus; ibrido = anche un fisso una-tantum al primo contenuto (creator grandi).';
comment on column public.affiliati.bonus_pagato is 'Quanto bonus a soglie e'' gia'' stato saldato: il maturato meno questo e'' il bonus da pagare.';
comment on column public.affiliati.token is 'Sigla corta del link privato del cruscotto: rivolio.it/creator/<token>.';
comment on column public.affiliati.ultimo_clic is 'Quando e'' stato aperto l''ultima volta il link del creator. Serve al segnale di attivita''.';

-- La variante separa i bonus singole/famiglia. Le righe vecchie a null: la
-- lettura le deduce dal prezzo pagato.
alter table public.commissioni
  add column if not exists variante text check (variante in ('singola', 'famiglia'));

-- Sigla corta per i creator gia' esistenti (12 cifre esadecimali, non indovinabile).
update public.affiliati
  set token = substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)
  where token is null;

-- Incremento atomico del contatore clic + timbro dell'ora. security definer +
-- revoke: la chiama solo il server con la chiave di servizio.
create or replace function public.segna_clic_affiliato(p_codice text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.affiliati set click = click + 1, ultimo_clic = now()
  where codice = p_codice and attivo = true;
$$;

revoke all on function public.segna_clic_affiliato(text) from public;
revoke all on function public.segna_clic_affiliato(text) from anon, authenticated;
grant execute on function public.segna_clic_affiliato(text) to service_role;
