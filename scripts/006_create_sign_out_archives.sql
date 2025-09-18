-- Simple archive table (one row per day)
create table if not exists public.sign_out_archives (
  id uuid primary key default gen_random_uuid(),
  day date not null unique,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_sign_out_archives_day on public.sign_out_archives(day desc);

alter table public.sign_out_archives enable row level security;

-- Read policy
do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='sign_out_archives' and policyname='sign_out_archives_select'
  ) then
    execute 'create policy sign_out_archives_select on public.sign_out_archives for select using (true)';
  end if;
end$$;

-- Function: archive ALL current sign_out_records into today's snapshot then clear table.
create or replace function public.reset_day_archive()
returns void
language plpgsql
security definer
set search_path = public as $$
declare
  today date := current_date;
  snapshot jsonb;
begin
  -- If no rows, skip (prevents overwriting existing non-empty history with empty set)
  if not exists (select 1 from public.sign_out_records) then
    return;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', sor.id,
      'student_id', sor.student_id,
      'signed_out_at', sor.signed_out_at,
      'signed_back_in_at', sor.signed_back_in_at,
      'signer_name', sor.signer_name,
      'signature_data', sor.signature_data,
      'signature_url', sor.signature_url,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'class_name', c.name
    ) order by sor.signed_out_at
  ), '[]'::jsonb) into snapshot
  from public.sign_out_records sor
  left join public.students s on s.id = sor.student_id
  left join public.classes c on c.id = s.class_id;

  insert into public.sign_out_archives (day, data)
  values (today, jsonb_build_object('day', today, 'records', snapshot))
  on conflict (day) do nothing; -- keep first snapshot of the day

  delete from public.sign_out_records; -- clear live data
end;
$$;

grant execute on function public.reset_day_archive() to authenticated;
