-- 🔴 DEDUP DEI WEBHOOK STRIPE (audit 26/08)
--
-- Stripe consegna i webhook "at-least-once": lo stesso pagamento (stesso
-- evt_...) può arrivare due volte, e ritenta per 3 giorni. Senza un fermo, due
-- consegne dello stesso evento provano a lavorare lo stesso pagamento in
-- parallelo. L'evasione della PRATICA è già idempotente (vincolo unico sulla
-- verifica), ma il webhook fa anche altro (email, commissione del creator):
-- questa tabella «prende» l'evento scrivendo il suo id, così il secondo arrivo
-- si riconosce e si salta.
--
-- Il codice degrada da solo se la tabella non c'è (legge l'errore "does not
-- exist" e procede, contando sull'idempotenza dell'evasione). Applicarla la
-- rende completa. Si può rilanciare quante volte si vuole.
--
-- ⚠️ Già APPLICATA sul database vero il 26/08 col connettore Supabase.

-- Il registro degli eventi già visti. `event_id` è la chiave: un doppione
-- viola la primary key (23505) ed è così che si riconosce.
create table if not exists public.webhook_eventi_stripe (
  event_id    text primary key,
  tipo        text,
  ricevuto_il timestamptz not null default now()
);

-- La pulizia settimanale cancella le righe oltre i 7 giorni (Stripe ritenta
-- per 3): l'indice sulla data rende quel taglio veloce anche a tabella piena.
create index if not exists webhook_eventi_stripe_ricevuto
  on public.webhook_eventi_stripe (ricevuto_il);

-- La rete di sicurezza a valle: due pagamenti diversi non possono generare due
-- pratiche sullo STESSO ordine Stripe. Parziale (solo dove l'ordine c'è) così
-- le pratiche vecchie senza ordine non danno fastidio.
create unique index if not exists pratiche_ordine_pagamento_unico
  on public.pratiche (ordine_pagamento)
  where ordine_pagamento is not null;
