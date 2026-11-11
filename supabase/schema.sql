-- 報修登記系統：Supabase / PostgreSQL 建表腳本。
-- 僅供人工檢閱與日後部署；產生本檔案不會執行任何 SQL。
-- 支援初次建置與既有資料表，可重複執行；不刪表、不覆寫既有資料。
-- 欄位型態、主鍵或資料不相容時，整筆交易停止並回復，須先處理資料。
-- 示範資料必須使用虛構姓名及地點，勿輸入個資、密碼或金鑰。
-- 本版不實作登入、管理員更新狀態或通知功能。

-- 交易：所有建表與安全設定一起完成，任何錯誤皆不提交。
begin;

-- CHECK：限制選項與文字長度，並拒絕僅含一般空白字元的文字。
-- 本次設計上限：姓名80字元、地點160字元、問題說明2000字元。
create table if not exists public.repair_requests (
  id uuid primary key default gen_random_uuid(),
  reporter_name text not null
    constraint repair_requests_reporter_name_nonempty
    check (char_length(reporter_name) between 1 and 80
      and char_length(btrim(reporter_name, E' \t\n\r')) > 0),
  location text not null
    constraint repair_requests_location_nonempty
    check (char_length(location) between 1 and 160
      and char_length(btrim(location, E' \t\n\r')) > 0),
  category text not null
    constraint repair_requests_category_valid
    check (category in ('設備', '網路', '環境', '其他')),
  description text not null
    constraint repair_requests_description_nonempty
    check (char_length(description) between 1 and 2000
      and char_length(btrim(description, E' \t\n\r')) > 0),
  urgency text not null default '中'
    constraint repair_requests_urgency_valid
    check (urgency in ('低', '中', '高')),
  status text not null default '待處理'
    constraint repair_requests_status_valid
    check (status in ('待處理', '處理中', '已完成')),
  created_at timestamptz not null default now()
);

-- 既有結構升級：舊欄位只在尚無 location 時改名，原值完整保留。
-- 若新舊欄位同時存在則停止，避免誤判哪一欄才是正確資料。
do $$
begin
  if exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'repair_requests'
      and column_name = 'location_or_department') then
    if exists (select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'repair_requests'
        and column_name = 'location') then
      raise exception 'location 與 location_or_department 同時存在，請先確認欄位對應；未變更資料。';
    end if;
    alter table public.repair_requests rename column location_or_department to location;
  end if;
end;
$$;

-- 補上缺少欄位，但不替既有資料虛構姓名、狀態或建立時間。
-- 若已有資料且缺欄位，後續 NOT NULL 會拒絕不完整資料並回復交易。
alter table public.repair_requests
  add column if not exists id uuid,
  add column if not exists created_at timestamptz,
  add column if not exists reporter_name text,
  add column if not exists location text,
  add column if not exists category text,
  add column if not exists description text,
  add column if not exists urgency text,
  add column if not exists status text;

-- 確認既有型態及主鍵；不自動轉型，以免時間或識別碼意義改變。
do $$
declare
  field record;
  id_number smallint;
begin
  for field in select * from (values
    ('id', 'uuid'), ('created_at', 'timestamp with time zone'),
    ('reporter_name', 'text'), ('location', 'text'), ('category', 'text'),
    ('description', 'text'), ('urgency', 'text'), ('status', 'text')
  ) as expected(column_name, data_type) loop
    if not exists (select 1 from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = 'repair_requests'
        and c.column_name = field.column_name and c.data_type = field.data_type
        and c.is_generated = 'NEVER' and c.is_identity = 'NO') then
      raise exception '欄位 % 的型態或產生方式不相容，預期 %；請另行遷移。', field.column_name, field.data_type;
    end if;
  end loop;
  select attnum into id_number from pg_attribute
    where attrelid = 'public.repair_requests'::regclass and attname = 'id';
  if exists (select 1 from pg_constraint
    where conrelid = 'public.repair_requests'::regclass and contype = 'p') then
    if not exists (select 1 from pg_constraint
      where conrelid = 'public.repair_requests'::regclass and contype = 'p'
        and conkey = array[id_number]::smallint[]) then
      raise exception '現有主鍵不是單一 id 欄位；請另行遷移。';
    end if;
  else
    alter table public.repair_requests add primary key (id);
  end if;
end;
$$;

-- 統一預設值與必填限制；不會更新既有資料列的欄位值。
alter table public.repair_requests
  alter column id set default gen_random_uuid(),
  alter column created_at set default now(),
  alter column urgency set default '中',
  alter column status set default '待處理',
  alter column reporter_name drop default,
  alter column location drop default,
  alter column category drop default,
  alter column description drop default,
  alter column id set not null,
  alter column created_at set not null,
  alter column reporter_name set not null,
  alter column location set not null,
  alter column category set not null,
  alter column description set not null,
  alter column urgency set not null,
  alter column status set not null;

-- 重建本腳本管理的 CHECK，既有資料也須通過驗證；不移除其他業務限制。
alter table public.repair_requests
  drop constraint if exists repair_requests_reporter_name_nonempty,
  drop constraint if exists repair_requests_location_nonempty,
  drop constraint if exists repair_requests_description_nonempty,
  drop constraint if exists repair_requests_category_valid,
  drop constraint if exists repair_requests_urgency_valid,
  drop constraint if exists repair_requests_status_valid;
alter table public.repair_requests
  add constraint repair_requests_reporter_name_nonempty
    check (char_length(reporter_name) between 1 and 80
      and char_length(btrim(reporter_name, E' \t\n\r')) > 0),
  add constraint repair_requests_location_nonempty
    check (char_length(location) between 1 and 160
      and char_length(btrim(location, E' \t\n\r')) > 0),
  add constraint repair_requests_description_nonempty
    check (char_length(description) between 1 and 2000
      and char_length(btrim(description, E' \t\n\r')) > 0),
  add constraint repair_requests_category_valid
    check (category in ('設備', '網路', '環境', '其他')),
  add constraint repair_requests_urgency_valid
    check (urgency in ('低', '中', '高')),
  add constraint repair_requests_status_valid
    check (status in ('待處理', '處理中', '已完成'));

-- 欄位說明：提供繁體中文資料字典。
comment on table public.repair_requests is
  '虛構報修示範：公開新增及讀取，不提供前端修改或刪除權限。';
comment on column public.repair_requests.id is '系統產生的報修識別碼。';
comment on column public.repair_requests.reporter_name is '報修人姓名；示範僅使用虛構姓名。';
comment on column public.repair_requests.location is '地點或部門；示範僅使用虛構地點。';
comment on column public.repair_requests.category is '類別：設備、網路、環境、其他。';
comment on column public.repair_requests.description is '問題說明，不可空白。';
comment on column public.repair_requests.urgency is '緊急程度：低、中、高；預設中。';
comment on column public.repair_requests.status is '處理狀態；新增時由系統預設為待處理。';
comment on column public.repair_requests.created_at is
  '系統自動產生的登記時間，儲存為含時區時間；介面可轉換為臺北時間。';

-- 清單可依時間與識別碼倒序顯示，供後續分頁使用。
create index if not exists repair_requests_created_at_id_idx
  on public.repair_requests (created_at desc, id desc);

-- RLS：啟用資料列安全；政策僅授予本次使用的匿名角色 anon。
alter table public.repair_requests enable row level security;

-- GRANT：不依賴自動授權；先移除一般角色權限，再明確授予 anon 最小權限。
-- 不授予 authenticated；本次不實作登入後的操作。
revoke all privileges on table public.repair_requests
  from public, anon, authenticated;

-- 資料表 REVOKE 不會清除舊欄位授權，因此逐欄清除一般角色的授權。
do $$
declare
  field record;
begin
  for field in select attname from pg_attribute
    where attrelid = 'public.repair_requests'::regclass
      and attnum > 0 and not attisdropped loop
    execute format('revoke all privileges (%I) on table public.repair_requests from public, anon, authenticated', field.attname);
  end loop;
end;
$$;

-- 明確列出可讀欄位，避免舊表其他額外欄位意外被公開。
grant usage on schema public to anon;
grant select (id, created_at, reporter_name, location, category, description, urgency, status)
  on table public.repair_requests to anon;

-- 前端只可提交下列五個欄位；請省略 id、status、created_at，
-- 由資料庫產生識別碼、初始狀態及登記時間，避免使用者自行指定。
-- urgency 可省略以採用預設值「中」。
grant insert (
  reporter_name,
  location,
  category,
  description,
  urgency
) on table public.repair_requests to anon;

-- 清除本表所有既有政策，避免舊的寬鬆政策與新政策以 OR 合併而繞過限制。
-- 這會取代原有自訂政策，其他角色的業務權限須另行設計。
do $$
declare
  old_policy record;
begin
  for old_policy in select policyname from pg_policies
    where schemaname = 'public' and tablename = 'repair_requests' loop
    execute format('drop policy %I on public.repair_requests', old_policy.policyname);
  end loop;
end;
$$;

-- 讀取政策：任何人可透過 anon 角色讀取清單。
create policy repair_requests_public_read
  on public.repair_requests
  for select
  to anon
  using (true);

-- 新增政策：新資料狀態只允許待處理，不提供修改或刪除政策。
create policy repair_requests_public_insert
  on public.repair_requests
  for insert
  to anon
  with check (status = '待處理');

-- 不建立 UPDATE / DELETE 政策，也不授予相關權限。
-- RLS 限制一般 API 角色；資料庫擁有者與 service_role 等特權角色
-- 可繞過 RLS，服務角色金鑰不得放入前端或公開儲存庫。

-- 完成初次建置交易；此檔本次僅產生，不執行。
commit;
