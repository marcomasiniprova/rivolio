-- Polar estinto (22/08). L'ultima traccia di Polar nel modello dati era il
-- nome di una colonna: la sessione/ordine del pagamento stava in
-- `pratiche.polar_ordine`. Rinominata a un nome neutro, che descrive cosa
-- contiene davvero (l'id dell'ordine del pagamento, oggi la sessione Stripe).
-- Il rename preserva i dati esistenti.
--
-- Applicata sul database vero il 22/08 col connettore Supabase.

alter table public.pratiche rename column polar_ordine to ordine_pagamento;

comment on column public.pratiche.ordine_pagamento is
  'Id dell''ordine del pagamento (la sessione Stripe). Era polar_ordine.';
