-- Hanlog: 노래 예약·카테고리·서재 책 표
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

-- 서재 책: "책" 검색 창에서 고른 책 (카카오 책 검색 결과). 첫 화면 Library 칸에 표지로 보임
create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  isbn text,
  title text not null,
  authors text not null default '',
  publisher text not null default '',
  year text not null default '',
  cover text not null default '',
  category text not null default 'Library', -- 표지가 붙을 랜딩 줄 (책 추가 창에서 고름)
  spine text not null default '', -- 책등 사진 주소 (Storage book-spines)
  created_at timestamptz not null default now()
);
-- 예전에 만든 표에는 category 칸을 더함
alter table public.books add column if not exists category text not null default 'Library';
-- 책등 사진 주소 (책장 페이지에서 주인이 직접 올림, 비어 있으면 회색 칸)
alter table public.books add column if not exists spine text not null default '';
create unique index if not exists books_isbn on public.books (isbn) where isbn <> '';

alter table public.books enable row level security;
grant select on public.books to anon, authenticated;
grant insert, update, delete on public.books to authenticated;

drop policy if exists "누구나 읽기" on public.books;
drop policy if exists "주인만 추가" on public.books;
drop policy if exists "주인만 수정" on public.books;
drop policy if exists "주인만 삭제" on public.books;
create policy "누구나 읽기" on public.books for select to anon, authenticated using (true);
create policy "주인만 추가" on public.books for insert to authenticated with check ((select public.is_owner()));
create policy "주인만 수정" on public.books for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "주인만 삭제" on public.books for delete to authenticated using ((select public.is_owner()));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'books') then
    alter publication supabase_realtime add table public.books;
  end if;
end $$;

-- 책 목차 (주인이 구절 쓰기 화면에서 붙여 넣음. 줄마다 "1장 …", "1.1 …", "부록 A …" 등)
alter table public.books add column if not exists toc text not null default '';

-- 책 구절: 책에서 기억하고 싶은 구절 + 왜 인상적이었나 (책 페이지 /book/<책 id>)
create table if not exists public.book_quotes (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books (id) on delete cascade,
  position int not null default 0, -- 보이는 순서
  quote text not null default '',
  page text not null default '', -- 쪽수
  comment text not null default '',
  author_name text not null default '', -- 쓴 사람 별명 (쓸 때의 이름을 그대로 남김)
  author_id uuid default auth.uid(),
  created_at timestamptz not null default now()
);
-- 구절이 속한 목차 자리 ("장 › 절 › 항", 쓰기 화면에서 고름)
alter table public.book_quotes add column if not exists section text not null default '';
create index if not exists book_quotes_book on public.book_quotes (book_id, position);

alter table public.book_quotes enable row level security;
grant select on public.book_quotes to anon, authenticated;
grant insert, update, delete on public.book_quotes to authenticated;

drop policy if exists "누구나 읽기" on public.book_quotes;
drop policy if exists "주인만 추가" on public.book_quotes;
drop policy if exists "주인만 수정" on public.book_quotes;
drop policy if exists "주인만 삭제" on public.book_quotes;
create policy "누구나 읽기" on public.book_quotes for select to anon, authenticated using (true);
create policy "주인만 추가" on public.book_quotes for insert to authenticated with check ((select public.is_owner()));
create policy "주인만 수정" on public.book_quotes for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "주인만 삭제" on public.book_quotes for delete to authenticated using ((select public.is_owner()));

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'book_quotes') then
    alter publication supabase_realtime add table public.book_quotes;
  end if;
end $$;

-- ↓ 계정을 만든 뒤(Authentication → Users → Add user) 이메일을 바꿔서 이 줄만 따로 한 번 실행
-- insert into public.owners (user_id) select id from auth.users where email = '내 이메일' on conflict do nothing;

-- 책등 사진 보관함 (Storage): 누구나 보기, 올리기·바꾸기·지우기는 주인만
insert into storage.buckets (id, name, public)
values ('book-spines', 'book-spines', true)
on conflict (id) do update set public = true;

drop policy if exists "책등 주인만 올리기" on storage.objects;
drop policy if exists "책등 주인만 바꾸기" on storage.objects;
drop policy if exists "책등 주인만 지우기" on storage.objects;
create policy "책등 주인만 올리기" on storage.objects for insert to authenticated
  with check (bucket_id = 'book-spines' and (select public.is_owner()));
create policy "책등 주인만 바꾸기" on storage.objects for update to authenticated
  using (bucket_id = 'book-spines' and (select public.is_owner()))
  with check (bucket_id = 'book-spines' and (select public.is_owner()));
create policy "책등 주인만 지우기" on storage.objects for delete to authenticated
  using (bucket_id = 'book-spines' and (select public.is_owner()));

-- 사이트 설정 (key → value). 지금은 음악 아일랜드의 기본 곡(island_song)만
-- 주인이 검색한 곡을 재생하면 그 곡이 기본 곡이 되어 모든 방문자에게 처음 올라감
create table if not exists public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_settings enable row level security;
grant select on public.site_settings to anon, authenticated;
grant insert, update on public.site_settings to authenticated;

drop policy if exists "누구나 읽기" on public.site_settings;
drop policy if exists "주인만 추가" on public.site_settings;
drop policy if exists "주인만 수정" on public.site_settings;
create policy "누구나 읽기" on public.site_settings for select to anon, authenticated using (true);
create policy "주인만 추가" on public.site_settings for insert to authenticated with check ((select public.is_owner()));
create policy "주인만 수정" on public.site_settings for update to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
