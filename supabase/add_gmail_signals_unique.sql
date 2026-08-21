-- Prevents the daily Gmail scan's overlapping 5-day lookback from creating duplicate
-- notification entries every time it re-finds the same email (which it does by design —
-- each run is a fresh pass with no memory). Lets future merges use upsert/on-conflict
-- instead of plain insert, making the merge idempotent.
create unique index if not exists gmail_signals_dedup_idx
  on gmail_signals (user_id, company, signal_date, subject);
