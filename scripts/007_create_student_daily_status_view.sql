-- Creates / replaces the student_daily_status view with security_invoker so
-- base table RLS still applies. Status is derived for current_date only.

begin;

-- Drop existing view if present (no error if absent)
drop view if exists public.student_daily_status;

create or replace view public.student_daily_status
  with (security_invoker = on) as
select
  s.id as student_id,
  s.first_name,
  s.last_name,
  c.name as class_name,
  case
    when exists (
      select 1 from public.sign_out_records r
      where r.student_id = s.id
        and r.signed_out_at::date = current_date
        and r.signed_back_in_at is null
    ) then 'Signed Out'
    else 'Present'
  end as status,
  (
    select r2.signed_out_at
    from public.sign_out_records r2
    where r2.student_id = s.id
      and r2.signed_out_at::date = current_date
    order by r2.signed_out_at desc
    limit 1
  ) as last_signed_out_at
from public.students s
join public.classes c on c.id = s.class_id;

commit;

-- Grants (adjust as desired)
grant select on public.student_daily_status to anon;
grant select on public.student_daily_status to authenticated;
