-- 0199 — ĐỢT KIỂM KÊ: có phạm vi lưu được, sổ đóng băng, và đếm mù.
--
-- BỐI CẢNH (Đợt 3 §2.2 của `docs/thiet-ke-kho.md`). Hôm nay kiểm kê là MỘT
-- PHIẾU: mở form, gõ số đếm, gửi duyệt. Ba thứ thiếu, và mỗi thứ đều làm con
-- số cuối cùng không kiểm được:
--
--   ① PHẠM VI không lưu được. Đợt 1 đã chặn đường "đếm cả 13.229 mã" bằng
--     cách bắt chọn bộ lọc trước, nhưng đó là một hàng rào trên URL — đóng
--     tab là mất, và không ai trả lời được "đợt này lẽ ra phải đếm những mã
--     nào" sau khi đếm xong.
--
--   ② SỔ KHÔNG ĐÓNG BĂNG. Người đếm mất hai tiếng; trong khoảng đó có phiếu
--     nhập. Chênh lệch tính ra so với tồn LÚC DUYỆT, nên một phần chênh là
--     hàng mới về chứ không phải đếm sai — và không ai phát hiện. Đây là lỗi
--     nguy hiểm nhất của cả phân hệ vì nó tạo ra một con số SAI TRÔNG NHƯ
--     ĐÚNG, rồi con số đó đi thẳng vào bút toán sửa tồn.
--
--   ③ ĐẾM MỞ. Người đếm nhìn thấy số sổ trong lúc đếm. Chủ dự án chốt
--     15/09/2026: ĐẾM MÙ. Kiểm kê mà không mù thì số liệu chỉ tự xác nhận
--     chính nó — đếm 380 vì sổ ghi 380, không vì ngoài kệ có 380.
--
-- ĐỢT LÀ CHỨNG TỪ CHA, PHIẾU KK LÀ CON. Không gộp vào `warehouse_docs`: một
-- đợt có vòng đời riêng (mở → đang đếm → đối chiếu → đã duyệt), có người được
-- phân đếm, và khi duyệt nó SINH RA phiếu điều chỉnh. Nhét cả hai vào một
-- bảng là lại một chứng từ mang hai vòng đời — thứ `tieu-chi-workflow-erp.md`
-- §2.1 cấm.
--
-- `freeze_at` LÀ MỘT MỐC THỜI GIAN, không phải một cờ. Tồn đóng băng = cộng
-- dồn mọi dòng sổ có `created_at <= freeze_at`. Nhờ vậy sổ vẫn chỉ-cộng-thêm
-- (luật 0194): không sao chép số dư đi đâu cả, chỉ ghi nhớ CẮT Ở ĐÂU. Số đóng
-- băng của từng dòng vẫn được lưu vào `book_qty_frozen` để đọc nhanh và để
-- biên bản in ra không đổi số khi in lại sau ba tháng.
--
-- `blind_count` MẶC ĐỊNH TRUE theo lựa chọn của chủ dự án, nhưng để ở CỘT chứ
-- không hằng số hoá: có đợt kiểm đột xuất một khu nhỏ mà quản lý kho muốn đếm
-- mở cho nhanh, và đó là quyết định của người mở đợt, không phải của lập trình.
--
-- `warehouse_stocktake_lines` MỞ RỘNG chứ không thay: bảng 0077 đang gắn với
-- `doc_id` và mã hiện tại đọc nó. Hai cột mới đều NULLABLE nên biên bản cũ
-- không gãy, và một dòng có thể thuộc đợt (mới) hoặc chỉ thuộc phiếu (cũ).
--
-- RLS: cả hai bảng bật RLS không policy — anon chặn, secret key bypass.

create table if not exists public.warehouse_stocktakes (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  -- 'bin' = theo khu kệ · 'group' = theo nhóm vật tư · 'list' = danh sách mã.
  -- KHÔNG có giá trị 'all': không có đường nào đếm cả danh mục, đó là điểm
  -- của việc bắt chọn phạm vi.
  scope_kind    text not null check (scope_kind in ('bin', 'group', 'list')),
  -- {bin_ids:[…]} | {groups:[…]} | {material_ids:[…]}
  scope_ref     jsonb not null default '{}'::jsonb,
  -- Số mã phạm vi bao gồm, CHỐT LÚC MỞ ĐỢT. Danh mục đổi về sau thì đợt này
  -- vẫn nói đúng nó đã hứa đếm bao nhiêu mã.
  scope_count   int not null default 0,
  -- Mốc chốt sổ. Null = chưa mở đếm.
  freeze_at     timestamptz,
  blind_count   boolean not null default true,
  status        text not null default 'open'
                check (status in ('open', 'counting', 'review', 'approved', 'cancelled')),
  assigned_to   uuid references public.users(id) on delete set null,
  -- Phiếu KK sinh ra lúc duyệt (kind='stocktake'). Null cho tới khi duyệt.
  doc_id        uuid references public.warehouse_docs(id) on delete set null,
  note          text,
  reject_reason text,
  approved_by   uuid references public.users(id) on delete set null,
  approved_at   timestamptz,
  created_by    uuid not null references public.users(id) on delete restrict,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.warehouse_stocktakes;
create trigger set_updated_at
  before update on public.warehouse_stocktakes
  for each row execute function public.set_updated_at();

create index if not exists warehouse_stocktakes_status_idx
  on public.warehouse_stocktakes (status, created_at desc);
create index if not exists warehouse_stocktakes_assigned_idx
  on public.warehouse_stocktakes (assigned_to)
  where assigned_to is not null;

-- Dòng đếm: gắn ĐỢT (mới) thay vì chỉ gắn phiếu (cũ).
--
-- `doc_id` của bảng 0077 là NOT NULL nên dòng của một đợt CHƯA duyệt không
-- dùng được bảng đó — bỏ ràng buộc not null thay vì đẻ bảng thứ hai, để
-- "biên bản của đợt" và "biên bản của phiếu" không thành hai nguồn một sự thật.
alter table public.warehouse_stocktake_lines
  alter column doc_id drop not null;

alter table public.warehouse_stocktake_lines
  add column if not exists stocktake_id uuid
    references public.warehouse_stocktakes(id) on delete cascade,
  -- Tồn sổ TẠI `freeze_at`. Khác `system_qty` (0077) vốn là tồn lúc gõ dòng:
  -- cột cũ giữ nguyên để biên bản cũ không đổi nghĩa, cột mới là số dùng để
  -- tính chênh của đợt.
  add column if not exists book_qty_frozen numeric(18, 4),
  -- Người đếm dòng này (một đợt chia nhiều người) + lúc đếm xong.
  add column if not exists counted_by uuid references public.users(id) on delete set null,
  add column if not exists counted_at timestamptz;

-- `counted_qty` phải cho phép NULL: dòng CHƯA ĐẾM khác hẳn dòng đếm được 0.
-- Gộp hai cái là mất đúng thông tin "còn bao nhiêu mã chưa ai sờ tới".
alter table public.warehouse_stocktake_lines
  alter column counted_qty drop not null;
alter table public.warehouse_stocktake_lines
  alter column diff drop not null;

create index if not exists warehouse_stocktake_lines_stocktake_idx
  on public.warehouse_stocktake_lines (stocktake_id)
  where stocktake_id is not null;

-- Một mã chỉ nằm MỘT LẦN trong một đợt — không thì hai người đếm cùng một mã
-- và chênh lệch cộng đôi.
create unique index if not exists warehouse_stocktake_lines_uniq_in_take
  on public.warehouse_stocktake_lines (stocktake_id, material_id)
  where stocktake_id is not null;

comment on table public.warehouse_stocktakes is
  'Đợt kiểm kê (0199): phạm vi lưu được + sổ đóng băng tại freeze_at + đếm mù. Duyệt xong sinh phiếu KK với mã lý do N4/X5.';
comment on column public.warehouse_stocktakes.freeze_at is
  'Mốc chốt sổ. Tồn đóng băng = cộng dồn dòng sổ có created_at <= mốc này. Sổ không bị sao chép đi đâu, chỉ ghi nhớ cắt ở đâu.';
comment on column public.warehouse_stocktake_lines.book_qty_frozen is
  'Tồn sổ TẠI freeze_at của đợt. Chênh của đợt = counted_qty − cột này, KHÔNG phải trừ tồn lúc duyệt.';

alter table public.warehouse_stocktakes enable row level security;
