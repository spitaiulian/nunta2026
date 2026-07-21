-- Rulează întregul fișier în Supabase → SQL Editor → New query → Run.
-- IMPORTANT: schimbă adresa de e-mail de mai jos dacă administratorul folosește alt cont.

create extension if not exists pgcrypto;

create table if not exists public.rsvps (
  id uuid primary key default gen_random_uuid(),
  family text not null check (char_length(family) between 2 and 120),
  status text not null check (status in ('Confirmat', 'Refuzat', 'În așteptare')),
  adults integer not null default 0 check (adults between 0 and 20),
  children integer not null default 0 check (children between 0 and 20),
  phone text not null default '' check (char_length(phone) <= 40),
  accommodation text not null default '' check (char_length(accommodation) <= 500),
  created_at timestamptz not null default now()
);

alter table public.rsvps enable row level security;

drop policy if exists "Invitatii pot trimite RSVP" on public.rsvps;
create policy "Invitatii pot trimite RSVP"
on public.rsvps
for insert
to anon
with check (
  status in ('Confirmat', 'Refuzat')
  and char_length(family) between 2 and 120
  and adults between 0 and 20
  and children between 0 and 20
  and char_length(phone) between 6 and 40
  and accommodation = ''
);

drop policy if exists "Administratorul poate citi RSVP" on public.rsvps;
create policy "Administratorul poate citi RSVP"
on public.rsvps
for select
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'spita_iulian@yahoo.com');

drop policy if exists "Administratorul poate adauga RSVP" on public.rsvps;
create policy "Administratorul poate adauga RSVP"
on public.rsvps
for insert
to authenticated
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'spita_iulian@yahoo.com');

drop policy if exists "Administratorul poate modifica RSVP" on public.rsvps;
create policy "Administratorul poate modifica RSVP"
on public.rsvps
for update
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'spita_iulian@yahoo.com')
with check (lower(coalesce(auth.jwt() ->> 'email', '')) = 'spita_iulian@yahoo.com');

drop policy if exists "Administratorul poate sterge RSVP" on public.rsvps;
create policy "Administratorul poate sterge RSVP"
on public.rsvps
for delete
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'spita_iulian@yahoo.com');

grant usage on schema public to anon, authenticated;
grant insert on table public.rsvps to anon;
grant select, insert, update, delete on table public.rsvps to authenticated;
