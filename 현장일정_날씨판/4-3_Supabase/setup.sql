-- 현장 일정 날씨판 · Supabase 표 만들기 (SQL Editor 에 붙여 넣고 Run)
-- 여러 번 실행해도 기존 일정은 삭제하지 않음

create table if not exists public.wx_tasks (
  id         bigint generated always as identity primary key,
  title      text not null check (length(trim(title)) > 0),
  region     text not null constraint wx_tasks_region_allowed check (region in ('세종', '대전', '태안', '보령')),
  kind       text not null constraint wx_tasks_kind_allowed check (kind in ('야외', '고소', '실내')),
  owner      text not null check (length(trim(owner)) > 0),
  created_at timestamptz not null default now()
);

-- 기존 표에도 허용값 규칙을 보장
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'wx_tasks_region_allowed' and conrelid = 'public.wx_tasks'::regclass
  ) then
    alter table public.wx_tasks
      add constraint wx_tasks_region_allowed check (region in ('세종', '대전', '태안', '보령'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'wx_tasks_kind_allowed' and conrelid = 'public.wx_tasks'::regclass
  ) then
    alter table public.wx_tasks
      add constraint wx_tasks_kind_allowed check (kind in ('야외', '고소', '실내'));
  end if;
end $$;

-- 표마다 출입 규칙(RLS)을 켬 : 규칙에 적힌 것만 허용
alter table public.wx_tasks enable row level security;

-- 교육용 : 누구나 보기 · 추가 가능 (수정 · 삭제는 규칙이 없으므로 막힘)
drop policy if exists "wx_tasks 보기" on public.wx_tasks;
drop policy if exists "wx_tasks 추가" on public.wx_tasks;
create policy "wx_tasks 보기" on public.wx_tasks for select to anon, authenticated using (true);
create policy "wx_tasks 추가" on public.wx_tasks for insert to anon, authenticated with check (true);

-- 표 권한을 직접 줌 (프로젝트의 '새 표 자동 공개' 설정이 꺼져 있어도 동작하게)
revoke all on public.wx_tasks from anon, authenticated;
grant select on public.wx_tasks to anon, authenticated;
grant insert (title, region, kind, owner) on public.wx_tasks to anon, authenticated;

-- 표가 비어 있을 때만 처음 보이는 가상 일정 6건을 넣음
do $$
begin
  if not exists (select 1 from public.wx_tasks) then
    insert into public.wx_tasks (title, region, kind, owner) values
      ('다중이용시설 안전점검',   '세종', '야외', '김안전'),
      ('시민 안전체험 행사 운영', '보령', '야외', '이행사'),
      ('옥상 태양광 설비 점검',   '태안', '고소', '박설비'),
      ('하천 수위계 확인',        '대전', '야외', '최현장'),
      ('청사 외벽 간판 보수',     '세종', '고소', '정시설'),
      ('비상연락 훈련',           '대전', '실내', '한상황');
  end if;
end $$;
