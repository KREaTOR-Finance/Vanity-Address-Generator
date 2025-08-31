create extension if not exists "pgcrypto";

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  wallet_address text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  create type payment_status as enum ('pending','created','signed','submitted','validated','failed','expired');
exception when duplicate_object then null; end $$;

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  payload_uuidv4 text unique,
  wallet_address text,
  mode text check (mode in ('XRP','IOU')),
  amount_drops bigint,
  iou_currency text,
  iou_issuer text,
  destination text,
  memo jsonb,
  status payment_status not null default 'pending',
  tx_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.payments enable row level security;

