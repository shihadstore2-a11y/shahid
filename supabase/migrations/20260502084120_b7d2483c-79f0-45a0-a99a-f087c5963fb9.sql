-- ============= Pricing Funnel Tracking =============

-- 1. enum أنواع الأحداث
do $$ begin
  if not exists (select 1 from pg_type where typname = 'pricing_event_type') then
    create type public.pricing_event_type as enum (
      'page_view',
      'annual_toggled',
      'plan_clicked',
      'cta_clicked',
      'converted'
    );
  end if;
end $$;

-- 2. جدول الأحداث
create table if not exists public.pricing_experiments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  session_id text,
  event_type public.pricing_event_type not null,
  plan_id text,
  billing_cycle text check (billing_cycle in ('monthly', 'yearly')),
  variant text default 'control',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_pricing_experiments_created on public.pricing_experiments (created_at desc);
create index if not exists idx_pricing_experiments_event on public.pricing_experiments (event_type, created_at desc);
create index if not exists idx_pricing_experiments_user on public.pricing_experiments (user_id) where user_id is not null;

alter table public.pricing_experiments enable row level security;

-- أي زائر يقدر يُدخل (مجهول أو مسجّل)
drop policy if exists "anyone can insert pricing event" on public.pricing_experiments;
create policy "anyone can insert pricing event"
on public.pricing_experiments
for insert
to anon, authenticated
with check (
  -- لو user_id موجود لازم يطابق المستخدم الحالي
  (user_id is null) or (auth.uid() = user_id)
);

-- الأدمن فقط يقرأ
drop policy if exists "admin can read pricing events" on public.pricing_experiments;
create policy "admin can read pricing events"
on public.pricing_experiments
for select
to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- 3. دالة الـ funnel للأدمن
create or replace function public.get_pricing_funnel(_days int default 7)
returns table (
  total_views bigint,
  annual_toggles bigint,
  plan_clicks bigint,
  cta_clicks bigint,
  conversions bigint,
  cta_click_rate_pct numeric,
  annual_share_pct numeric,
  top_plan text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  _since timestamptz := now() - make_interval(days => _days);
  _views bigint;
  _annual bigint;
  _plan_clicks bigint;
  _cta bigint;
  _conv bigint;
  _top text;
begin
  -- صلاحية الأدمن فقط
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden';
  end if;

  select count(*) into _views
    from public.pricing_experiments
    where event_type = 'page_view' and created_at >= _since;

  select count(*) into _annual
    from public.pricing_experiments
    where event_type = 'annual_toggled'
      and (metadata->>'yearly')::boolean = true
      and created_at >= _since;

  select count(*) into _plan_clicks
    from public.pricing_experiments
    where event_type = 'plan_clicked' and created_at >= _since;

  select count(*) into _cta
    from public.pricing_experiments
    where event_type = 'cta_clicked' and created_at >= _since;

  select count(*) into _conv
    from public.pricing_experiments
    where event_type = 'converted' and created_at >= _since;

  select plan_id into _top
    from public.pricing_experiments
    where event_type in ('plan_clicked', 'cta_clicked')
      and created_at >= _since
      and plan_id is not null
    group by plan_id
    order by count(*) desc
    limit 1;

  return query select
    _views,
    _annual,
    _plan_clicks,
    _cta,
    _conv,
    case when _views > 0 then round((_cta::numeric / _views) * 100, 1) else 0 end,
    case when _views > 0 then round((_annual::numeric / _views) * 100, 1) else 0 end,
    coalesce(_top, '—');
end;
$$;

grant execute on function public.get_pricing_funnel(int) to authenticated;