-- APPLICATA sul Supabase vero il 26/08 col connettore e PROVATA (i numeri
-- combaciano con quelli contati a mano).
--
-- I NUMERI DEL PANNELLO CONTATI DAL DATABASE (audit 26/08).
-- Prima leggiCruscotto/leggiSerie caricavano fino a 20.000 righe in memoria e
-- sommavano in JS: oltre quel tetto i totali (incassi, conversione del muro,
-- provenienze, serie per giorno) si accorciavano in SILENZIO, dominati dal
-- flusso delle visite. Qui conta e somma il database, esatto a qualsiasi
-- volume. La conversione del muro usa gli sblocchi DISTINTI per ordine, così
-- un reload della pagina di successo non la gonfia più oltre il 100%.

-- 1) i numeri di oggi e della settimana, gli incassi, il muro e gli sblocchi.
create or replace function public.cruscotto_numeri(p_da timestamptz, p_now timestamptz)
returns jsonb
language sql stable security definer set search_path = public
as $$
  with e as (
    select tipo, importo, extra,
           (creato_il at time zone 'Europe/Rome')::date as giorno_it
    from public.eventi
    where creato_il >= p_da
  ),
  oggi_it as (select (p_now at time zone 'Europe/Rome')::date as g)
  select jsonb_build_object(
    'settimana', jsonb_build_object(
      'visita',    count(*) filter (where tipo='visita'),
      'check',     count(*) filter (where tipo='check'),
      'muro',      count(*) filter (where tipo='muro'),
      'sbloccato', count(*) filter (where tipo='sbloccato'),
      'verdetto',  count(*) filter (where tipo='verdetto'),
      'pratica',   count(*) filter (where tipo='pratica'),
      'pagato',    count(*) filter (where tipo='pagato'),
      'iscritto',  count(*) filter (where tipo='iscritto'),
      'invito',    count(*) filter (where tipo='invito'),
      'guasto',    count(*) filter (where tipo='guasto')
    ),
    'oggi', jsonb_build_object(
      'visita',    count(*) filter (where tipo='visita'    and giorno_it=(select g from oggi_it)),
      'check',     count(*) filter (where tipo='check'     and giorno_it=(select g from oggi_it)),
      'muro',      count(*) filter (where tipo='muro'      and giorno_it=(select g from oggi_it)),
      'sbloccato', count(*) filter (where tipo='sbloccato' and giorno_it=(select g from oggi_it)),
      'verdetto',  count(*) filter (where tipo='verdetto'  and giorno_it=(select g from oggi_it)),
      'pratica',   count(*) filter (where tipo='pratica'   and giorno_it=(select g from oggi_it)),
      'pagato',    count(*) filter (where tipo='pagato'    and giorno_it=(select g from oggi_it)),
      'iscritto',  count(*) filter (where tipo='iscritto'  and giorno_it=(select g from oggi_it)),
      'invito',    count(*) filter (where tipo='invito'    and giorno_it=(select g from oggi_it)),
      'guasto',    count(*) filter (where tipo='guasto'    and giorno_it=(select g from oggi_it))
    ),
    'incasso_settimana', coalesce(sum(importo) filter (where tipo='pagato'), 0),
    'incasso_oggi',      coalesce(sum(importo) filter (where tipo='pagato' and giorno_it=(select g from oggi_it)), 0),
    'muri',      count(*) filter (where tipo='muro' and not coalesce((extra->>'prova')::boolean, false)),
    'sbloccati', count(distinct extra->>'ordine') filter (where tipo='sbloccato' and not coalesce((extra->>'prova')::boolean, false))
  )
  from e;
$$;

-- 2) provenienze (top 100: le prime 8 si mostrano, tutte servono ai motori AI)
--    e paesi (top 8).
create or replace function public.cruscotto_gruppi(p_da timestamptz)
returns jsonb
language sql stable security definer set search_path = public
as $$
  select jsonb_build_object(
    'provenienze', (
      select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'quanti', q)), '[]'::jsonb)
      from (select provenienza nome, count(*) q from public.eventi
            where creato_il >= p_da and provenienza is not null
            group by provenienza order by count(*) desc limit 100) a
    ),
    'paesi', (
      select coalesce(jsonb_agg(jsonb_build_object('nome', nome, 'quanti', q)), '[]'::jsonb)
      from (select paese nome, count(*) q from public.eventi
            where creato_il >= p_da and paese is not null
            group by paese order by count(*) desc limit 8) b
    )
  );
$$;

-- 3) la serie giorno per giorno, in giorni italiani, col conteggio per tipo.
drop function if exists public.serie_giorni(timestamptz);
create function public.serie_giorni(p_da timestamptz)
returns table(giorno date, per jsonb, idonei int, euro numeric)
language sql stable security definer set search_path = public
as $$
  select (creato_il at time zone 'Europe/Rome')::date as giorno,
    jsonb_build_object(
      'visita',    count(*) filter (where tipo='visita'),
      'check',     count(*) filter (where tipo='check'),
      'muro',      count(*) filter (where tipo='muro'),
      'sbloccato', count(*) filter (where tipo='sbloccato'),
      'verdetto',  count(*) filter (where tipo='verdetto'),
      'pratica',   count(*) filter (where tipo='pratica'),
      'pagato',    count(*) filter (where tipo='pagato'),
      'iscritto',  count(*) filter (where tipo='iscritto'),
      'invito',    count(*) filter (where tipo='invito'),
      'guasto',    count(*) filter (where tipo='guasto')
    ) as per,
    count(*) filter (where tipo='verdetto' and esito='idoneo')::int as idonei,
    coalesce(sum(importo) filter (where tipo='pagato'), 0) as euro
  from public.eventi where creato_il >= p_da
  group by 1 order by 1;
$$;

revoke all on function public.cruscotto_numeri(timestamptz,timestamptz) from public, anon, authenticated;
revoke all on function public.cruscotto_gruppi(timestamptz) from public, anon, authenticated;
revoke all on function public.serie_giorni(timestamptz) from public, anon, authenticated;
