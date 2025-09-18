-- Normalize sign_out_archives schema to ensure a `data jsonb` column exists
-- and contains an object with a `records` array. Safe to run multiple times.

do $$
declare
  has_day boolean;
  has_created_at boolean;
  has_data boolean;
  has_records boolean;
begin
  -- If table doesn't exist, nothing to do (006 script will create it)
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'sign_out_archives'
  ) then
    return;
  end if;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='sign_out_archives' and column_name='day'
  ) into has_day;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='sign_out_archives' and column_name='created_at'
  ) into has_created_at;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='sign_out_archives' and column_name='data'
  ) into has_data;

  select exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='sign_out_archives' and column_name='records'
  ) into has_records;

  -- Ensure created_at exists for deriving day if needed
  if not has_created_at then
    alter table public.sign_out_archives add column created_at timestamptz not null default now();
  end if;

  -- Ensure data column exists BEFORE any statement that references it
  if not has_data then
    alter table public.sign_out_archives add column data jsonb;
    -- refresh flag
    has_data := true;
  end if;

  -- Add day column if missing and derive values
  if not has_day then
    alter table public.sign_out_archives add column day date;
    -- Derive day: prefer JSON data.day if parsable, else created_at::date, else today
    update public.sign_out_archives
    set day = coalesce(
      nullif((case when has_data then (data->>'day') else null end),'')::date,
      created_at::date,
      current_date
    );
    alter table public.sign_out_archives alter column day set not null;
  end if;

  -- If legacy `records` column exists, migrate it into `data.records`
  if has_records then
    update public.sign_out_archives
    set data = coalesce(data, jsonb_build_object('day', day, 'records', records))
    where (data is null or jsonb_typeof(data) is distinct from 'object');
  end if;

  -- For any rows with array-in-data (older format), wrap into {records: ...}
  update public.sign_out_archives
  set data = jsonb_build_object('day', day, 'records', data)
  where jsonb_typeof(data) = 'array';

  -- Ensure not null going forward
  alter table public.sign_out_archives alter column data set default jsonb_build_object('day', current_date, 'records', '[]'::jsonb);
  update public.sign_out_archives set data = jsonb_build_object('day', day, 'records', '[]'::jsonb) where data is null;
  alter table public.sign_out_archives alter column data drop default;
  alter table public.sign_out_archives alter column data set not null;

  -- Ensure day index for performance (non-unique to avoid migration failures)
  if not exists (
    select 1 from pg_indexes where schemaname='public' and tablename='sign_out_archives' and indexname='idx_sign_out_archives_day'
  ) then
    create index idx_sign_out_archives_day on public.sign_out_archives(day desc);
  end if;
end$$;
