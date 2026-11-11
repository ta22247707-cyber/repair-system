-- 報修登記系統：Supabase / PostgreSQL 建表腳本。
-- 僅供人工檢閱與日後部署；產生本檔案不會執行任何 SQL。
-- 適用全新建置；若資料表已存在，應另寫遷移，不會覆寫既有資料。
-- 示範資料必須使用虛構姓名及地點，勿輸入個資、密碼或金鑰。
-- 本版不實作登入、管理員更新狀態或通知功能。

-- 交易：所有建表與安全設定一起完成，任何錯誤皆不提交。
begin;

-- CHECK：限制選項與文字長度，並拒絕僅含一般空白字元的文字。
-- 本次設計上限：姓名80字元、地點160字元、問題說明2000字元。
create table public.repair_requests (
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
create index repair_requests_created_at_id_idx
  on public.repair_requests (created_at desc, id desc);

-- RLS：啟用資料列安全；政策僅授予本次使用的匿名角色 anon。
alter table public.repair_requests enable row level security;

-- GRANT：不依賴自動授權；先移除一般角色權限，再明確授予 anon 最小權限。
-- 不授予 authenticated；本次不實作登入後的操作。
revoke all privileges on table public.repair_requests
  from public, anon, authenticated;

grant usage on schema public to anon;
grant select on table public.repair_requests to anon;

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
