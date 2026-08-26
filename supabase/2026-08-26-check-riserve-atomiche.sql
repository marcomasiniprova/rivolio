-- APPLICATA sul Supabase vero il 26/08 col connettore (migrazione
-- 2026-08-26-check-riserve-atomiche) e PROVATA: riservato/gia/finito, poi
-- rilascio e di nuovo riservato.
--
-- 🔴 IL MURO DEL CHECK SI POTEVA SCAVALCARE IN PARALLELO (audit del pannello).
-- Il controllo del credito (creditoFinito) e il consumo (segnaConsumo) non
-- erano atomici, e in mezzo girava verificaVolo (fino a 8 secondi): con un
-- pass da 1 sola analisi, sparando 20 richieste in parallelo su voli DIVERSI
-- passavano tutte il cancello prima che una scrivesse il consumo. Una spesa
-- da 1,99 produceva 20 analisi complete e 20 chiamate al fornitore.
--
-- Fix: la riserva del posto diventa ATOMICA. Un lock consultivo per ordine
-- serializza le richieste dello stesso pass, e il posto si prende (o no) in
-- un colpo solo, PRIMA dell'analisi. Su un verdetto "incerto" il posto si
-- rilascia (non si paga per un "non lo so"). La chiave è "volo|data", così lo
-- stesso volo resta gratis quante volte lo si riapre.

create table if not exists public.check_riserve (
  ordine text not null,
  chiave text not null,               -- volo|data
  riservato_il timestamptz not null default now(),
  primary key (ordine, chiave)
);
alter table public.check_riserve enable row level security;
-- nessuna policy: la legge e scrive solo il server con la chiave di servizio.

create or replace function public.riserva_check(p_ordine text, p_quanti int, p_chiave text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare v_conta int;
begin
  perform pg_advisory_xact_lock(hashtext(p_ordine));
  if exists (select 1 from public.check_riserve where ordine = p_ordine and chiave = p_chiave) then
    return 'gia';
  end if;
  select count(*) into v_conta from public.check_riserve where ordine = p_ordine;
  if v_conta >= p_quanti then
    return 'finito';
  end if;
  insert into public.check_riserve(ordine, chiave) values (p_ordine, p_chiave);
  return 'riservato';
end;
$$;

create or replace function public.rilascia_check(p_ordine text, p_chiave text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.check_riserve where ordine = p_ordine and chiave = p_chiave;
$$;

revoke all on function public.riserva_check(text,int,text) from public, anon, authenticated;
revoke all on function public.rilascia_check(text,text) from public, anon, authenticated;
