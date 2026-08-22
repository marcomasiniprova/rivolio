-- Affiliate marketing: i creator e le commissioni che maturano.
-- Applicata sul database vero il 22/08 col connettore Supabase.
-- Pagamento ai creator a mano (scelta di Valerio): il pannello somma il non
-- pagato, Valerio salda con bonifico. Niente Stripe Connect.

create table if not exists public.affiliati (
  id uuid primary key default gen_random_uuid(),
  codice text not null unique,
  nome text not null,
  commissione_percento integer not null default 40 check (commissione_percento between 0 and 100),
  sconto_percento integer not null default 10 check (sconto_percento between 0 and 90),
  attivo boolean not null default true,
  note text,
  creato_il timestamptz not null default now(),
  constraint affiliati_codice_forma check (codice ~ '^[A-Z0-9]{3,20}$')
);

comment on table public.affiliati is 'I creator dell''affiliate marketing: codice (link ?ref= e codice sconto), commissione e sconto al cliente. Letti solo dal server.';

create table if not exists public.commissioni (
  id uuid primary key default gen_random_uuid(),
  affiliato_id uuid not null references public.affiliati(id) on delete restrict,
  tipo text not null check (tipo in ('check','pratica')),
  prezzo_pagato numeric(10,2) not null,
  commissione numeric(10,2) not null,
  riferimento text not null unique,
  pagata_il timestamptz,
  creato_il timestamptz not null default now()
);

comment on table public.commissioni is 'Il libro mastro di quanto Rivolio deve a ogni creator. Una riga per pagamento attribuito. riferimento = id sessione Stripe (idempotenza).';

create index if not exists commissioni_affiliato_idx on public.commissioni (affiliato_id);
create index if not exists commissioni_da_pagare_idx on public.commissioni (pagata_il) where pagata_il is null;

-- Solo il server (chiave di servizio) legge e scrive: nessuna policy pubblica.
alter table public.affiliati enable row level security;
alter table public.commissioni enable row level security;
