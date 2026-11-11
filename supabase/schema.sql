-- Hanlog: 노래 예약·카테고리 표
-- Supabase 대시보드 → SQL Editor 에 통째로 붙여넣고 Run.
-- 읽기는 누구나(블로그 방문자), 쓰기는 owners 표에 등록된 계정만.
-- 여러 번 실행해도 괜찮게 만들어 둠.

-- 쓰기 권한이 있는 계정
create table if not exists public.owners (
  user_id uuid primary key references auth.users (id) on delete cascade
);
alter table public.owners enable row level security; -- 규칙이 없으니 브라우저에서는 아무도 못 읽음

-- 지금 로그인한 계정이 주인인지 (owners 를 직접 못 읽으니 이 함수로만 확인)
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.owners where user_id = (select auth.uid()));
$$;

-- 노래 예약: at 은 재생 시각(밀리초), track 은 곡 정보(iTunes)
create table if not exists public.schedules (
  id text primary key,
  at bigint not null,
  color text,
  track jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists schedules_at on public.schedules (at);

-- 카테고리: hidden = true 면 "−"로 숨긴 기본 카테고리, false 면 "+"로 추가한 카테고리
create table if not exists public.categories (
  name text primary key,
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.schedules enable row level security;
alter table public.categories enable row level security;

-- "새 표 자동 공개"를 껐으니 Data API 권한을 직접 줌 (실제 허용 여부는 아래 RLS 규칙이 정함)
grant select on public.schedules, public.categories to anon, authenticated;
grant insert, update, delete on public.schedules, public.categories to authenticated;

drop policy if exists "누구나 읽기" on public.schedules;
drop policy if exists "주인만 추가" on public.schedules;
drop policy if exists "주인만 수정" on public.schedules;
drop policy if exists "주인만 삭제" on public.schedules;
create policy "누구나 읽기" on public.schedules for select to anon, authenticated using (true);
create policy "주인만 추가" on public.schedules for insert to authenticated with check ((select public.is_owner()));
create policy "주인만 수정" on public.schedules for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "주인만 삭제" on public.schedules for delete to authenticated using ((select public.is_owner()));

drop policy if exists "누구나 읽기" on public.categories;
drop policy if exists "주인만 추가" on public.categories;
drop policy if exists "주인만 수정" on public.categories;
drop policy if exists "주인만 삭제" on public.categories;
create policy "누구나 읽기" on public.categories for select to anon, authenticated using (true);
create policy "주인만 추가" on public.categories for insert to authenticated with check ((select public.is_owner()));
create policy "주인만 수정" on public.categories for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "주인만 삭제" on public.categories for delete to authenticated using ((select public.is_owner()));

-- 다른 컴퓨터에서 바꾸면 바로 따라가도록 실시간 알림 켜기
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'schedules') then
    alter publication supabase_realtime add table public.schedules;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'categories') then
    alter publication supabase_realtime add table public.categories;
  end if;
end $$;

-- ↓ 계정을 만든 뒤(Authentication → Users → Add user) 이메일을 바꿔서 이 줄만 따로 한 번 실행
-- insert into public.owners (user_id) select id from auth.users where email = '내 이메일' on conflict do nothing;
