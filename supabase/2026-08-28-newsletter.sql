-- La newsletter settimanale dell'Osservatorio: il registro delle uscite.
-- Serve a non mandarla due volte nella stessa settimana: una riga per
-- settimana (il lunedì, in formato AAAA-MM-GG). La rotta fa un insert
-- atomico prima di spedire; se la riga c'è già (23505), il giro è stato
-- fatto e ci si ferma.
--
-- Additiva e isolata: la scrive e la legge SOLO /api/motore/newsletter col
-- ruolo di servizio. Nessun'altra parte del sistema la tocca.
create table if not exists public.newsletter_uscite (
  settimana text primary key,
  inviata_il timestamptz not null default now()
);

-- Nessun accesso pubblico: la tocca solo il server con la chiave di servizio
-- (che salta le policy). Niente policy = nessuno legge o scrive dal browser.
alter table public.newsletter_uscite enable row level security;
