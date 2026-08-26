-- Cruscotto affiliati (brief creator del 26/08): il modello economico completo
-- (bonus a soglie, accordo ibrido col fisso una-tantum), il conteggio dei clic
-- del link, e la variante (singola/famiglia) sulla commissione per poter
-- separare i bonus. Da applicare sul Supabase vero.

alter table public.affiliati
  add column if not exists tipo_accordo text not null default 'performance'
    check (tipo_accordo in ('performance', 'ibrido')),
  add column if not exists bonus_fisso numeric(10,2) not null default 0,
  add column if not exists bonus_fisso_pagato_il timestamptz,
  add column if not exists bonus_pagato numeric(10,2) not null default 0,
  add column if not exists seguito integer,
  add column if not exists click integer not null default 0;

comment on column public.affiliati.tipo_accordo is 'performance = solo 40% + bonus; ibrido = anche un fisso una-tantum al primo contenuto (creator grandi).';
comment on column public.affiliati.bonus_pagato is 'Quanto bonus a soglie e'' gia'' stato saldato: il maturato meno questo e'' il bonus da pagare.';
comment on column public.affiliati.click is 'Quante volte e'' stato aperto il link ?ref= del creator. Contato dal beacon della landing.';

-- La variante serve a separare i bonus singole/famiglia. Le righe vecchie
-- restano a null: la lettura le deduce dal prezzo pagato.
alter table public.commissioni
  add column if not exists variante text check (variante in ('singola', 'famiglia'));

-- Incremento atomico del contatore clic. security definer + revoke: la puo'
-- chiamare solo il server con la chiave di servizio (come da nota sicurezza).
create or replace function public.segna_clic_affiliato(p_codice text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.affiliati set click = click + 1
  where codice = p_codice and attivo = true;
$$;

revoke all on function public.segna_clic_affiliato(text) from public;
revoke all on function public.segna_clic_affiliato(text) from anon, authenticated;
grant execute on function public.segna_clic_affiliato(text) to service_role;
