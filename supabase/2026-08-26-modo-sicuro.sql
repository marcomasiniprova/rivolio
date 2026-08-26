-- 🔴 IL MODO SICURO (audit 26/08, scelta di Valerio: un interruttore globale)
--
-- Un unico interruttore d'emergenza. Quando è ACCESO mette in pausa le due
-- cose che parlano da sole al cliente e possono fare danno se qualcosa gira
-- storto: la sequenza di email automatiche (i promemoria della pratica e il
-- recupero) e la replica scritta dall'AI (che torna al testo fisso verificato).
--
-- ⚠️ NON tocca il cuore che incassa: check, verdetto, pagamento e apertura
-- della pratica restano vivi. Serve a fermare gli automatismi, non le vendite.
--
-- La leggono/scrivono il motore e il pannello con la chiave di servizio. La
-- tabella è generica (chiave/valore) apposta: domani un altro interruttore è
-- una riga, non una migrazione.
--
-- ⚠️ Già APPLICATA sul database vero il 26/08. Si può rilanciare.

create table if not exists public.impostazioni (
  chiave        text primary key,
  valore        text,
  aggiornata_il timestamptz not null default now()
);

-- RLS accesa SENZA policy: la tabella la legge e la scrive solo la chiave di
-- servizio (è voluto, come le altre tabelle server-only). Un client con la
-- chiave pubblica non la vede.
alter table public.impostazioni enable row level security;

-- Il modo sicuro nasce spento. `do nothing` così un rilancio non lo riazzera
-- se nel frattempo qualcuno l'ha acceso.
insert into public.impostazioni (chiave, valore)
values ('modo_sicuro', '0')
on conflict (chiave) do nothing;
