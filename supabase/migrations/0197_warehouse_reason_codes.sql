-- 0197 — MÃ LÝ DO KHO: một bộ từ vựng cho cả nhập, xuất và chuyển.
--
-- BỐI CẢNH (Đợt 3 §2.1 của `docs/thiet-ke-kho.md`). Hôm nay "vì sao có dòng sổ
-- này" tán ra BA CHỖ RỜI NHAU: `warehouse_docs.kind` (4 giá trị) +
-- `warehouse_movements.ref_type` (6 giá trị) + ô `reason` văn bản tự do. Không
-- chỗ nào ràng buộc nổi "xuất huỷ thì bắt buộc có lý do", và báo cáo kế toán
-- đếm "cấp SX" với "xuất cho tổ phôi" thành hai loại vì chúng là chữ người gõ.
--
-- Ý đáng chép của movement type SAP không phải con số 300 mã, mà là MỘT MÃ
-- QUYẾT ĐỊNH BA THỨ CÙNG LÚC: trường đối ứng nào bắt buộc (`requires`) · có
-- phải duyệt không (`needs_approval`) · tiền có vào giá thành lệnh không
-- (`affects_cost`). Cột thứ tư — lưới soạn phiếu hiện cột nào — suy ra từ
-- `requires`, không cần cột riêng.
--
-- ĐẶT TRÊN DÒNG SỔ, KHÔNG TRÊN PHIẾU. Chủ dự án chốt 15/09/2026.
--
-- ĐÍNH CHÍNH (bổ sung cùng ngày, sau khi viết test). Lý do đưa ra lúc chốt là
-- "phiếu nhập hôm nay đã trộn được dòng theo đơn và dòng ngoài đơn". SAI:
-- `createReceiptDoc` có HAI GUARD ĐỐI XỨNG chặn đúng việc đó — có `po_id` thì
-- mọi dòng phải gắn dòng PO, không có `po_id` thì không dòng nào được gắn. Trên
-- đường nhập, một phiếu chỉ mang một mã.
--
-- BẰNG CHỨNG THẬT là PHIẾU KIỂM KÊ: một đợt duyệt sinh cả dòng thừa (N4, vào)
-- lẫn dòng thiếu (X5, ra) trong CÙNG một phiếu — không chỉ hai mã mà hai HƯỚNG
-- ngược nhau. Mã trên phiếu không biểu diễn nổi, và đây là đường đang chạy
-- thật chứ không phải khả năng lý thuyết. Có test canh (`stock.service.test.ts`
-- → 'kiểm kê: thừa → N4, thiếu → X5').
--
-- Chuẩn ngoài đồng ý: SAP đặt BWART trên MSEG (dòng), header MKPF không có;
-- Dynamics đặt trên journal line.
--
-- VA CHẠM ĐÃ BIẾT: một phiên khác đã thêm `warehouse_docs.reason_code` (7 mã,
-- chỉ cho xuất) lên cùng DB này. Migration NÀY KHÔNG GỠ CỘT ĐÓ — nhánh kia
-- đang chạy trên nó, và drop một cột đang có code đọc là làm hỏng worktree
-- người khác. Việc gỡ đi một migration riêng SAU khi nhánh kia merge và chỗ
-- đọc đã chuyển sang dòng sổ. Đến lúc đó `warehouse_docs.reason_code` là cột
-- chết, không phải đường thứ hai đang sống.
--
-- BỘ 12 MÃ NUỐT TRỌN 7 MÃ CỦA NHÁNH KIA, không vứt đi:
--   sx → X1 · bu-hao → X2 (cắt chỗ ngoài định mức) · sua-may, mau, noi-bo → X6
--   huy → X4 · khac → X7. Hai mã X6/X7 là phần bộ 12 gốc thiếu mà bộ 7 có:
--   "dùng nội bộ" và "khác" không phải cấp cho lệnh, không phải huỷ, và nhét
--   chúng vào X2 là mất đúng chỗ kế toán cần tách (chi phí chung vs giá thành).
--
-- `ref_type` GIỮ NGUYÊN và KHÔNG BACKFILL. Sổ kho chỉ cộng thêm, không sửa lùi
-- (cùng luật với 0194). 265 dòng cũ để `reason_code` null; chỗ đọc suy mã từ
-- `ref_type` + `direction` qua `lib/kho-ma-ly-do.ts`, nên bộ lọc "tháng này có
-- bao nhiêu phiếu huỷ" vẫn đếm được lịch sử mà không ai viết lại lịch sử.
--
-- CỘT NULLABLE, KHÔNG `not null`. Bắt buộc là việc của zod ở biên API: dòng MỚI
-- phải có mã, dòng CŨ không có. Một `not null` ở đây thì migration không chạy
-- nổi trên bảng đã có dữ liệu, còn `not null default 'X7'` thì dán nhãn "Khác"
-- lên 265 dòng mà ta biết rõ chúng là gì.
--
-- RLS: cả hai bảng bật RLS không policy — anon bị chặn, secret key bypass, mọi
-- đường đọc đi qua API route. `warehouse_reason_codes` là danh mục đọc-nhiều
-- nhưng KHÔNG mở cho anon: kho là dữ liệu nội bộ, và không có màn public nào
-- cần nó.

create table if not exists public.warehouse_reason_codes (
  code            text primary key,
  name            text not null,
  direction       text not null check (direction in ('in', 'out', 'move')),
  -- 'po_line' | 'lsx' | 'supplier' | 'bin_from' | 'stocktake' | 'department' | 'reason'
  requires        text[] not null default '{}',
  needs_approval  boolean not null default false,
  affects_cost    boolean not null default false,
  active          boolean not null default true,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists set_updated_at on public.warehouse_reason_codes;
create trigger set_updated_at
  before update on public.warehouse_reason_codes
  for each row execute function public.set_updated_at();

-- `on conflict (code) do nothing`: chạy lại không đè tên/luật người dùng đã sửa
-- trên bản ghi có sẵn. Muốn đổi luật của một mã thì sửa bằng một migration nói
-- rõ nó đang đổi cái gì, không đi ké lượt seed.
insert into public.warehouse_reason_codes
  (code, name, direction, requires, needs_approval, affects_cost, sort_order)
values
  ('N1', 'Nhập mua theo đơn',            'in',   '{po_line}',          false, true,  10),
  ('N2', 'Nhập mua ngoài đơn',           'in',   '{supplier,reason}',  false, true,  20),
  ('N3', 'Nhập lại vật tư thừa từ SX',   'in',   '{lsx}',              false, true,  30),
  ('N4', 'Nhập thừa sau kiểm kê',        'in',   '{stocktake}',        true,  false, 40),
  ('X1', 'Cấp cho lệnh SX',              'out',  '{lsx}',              false, true,  50),
  ('X2', 'Cấp bù hao ngoài định mức',    'out',  '{lsx,reason}',       false, true,  60),
  ('X3', 'Trả hàng NCC',                 'out',  '{po_line,reason}',   false, true,  70),
  ('X4', 'Xuất huỷ · phế liệu',          'out',  '{reason}',           true,  false, 80),
  ('X5', 'Xuất thiếu sau kiểm kê',       'out',  '{stocktake}',        true,  false, 90),
  ('X6', 'Xuất dùng chung · sửa chữa',   'out',  '{department}',       false, false, 100),
  ('X7', 'Xuất khác',                    'out',  '{reason}',           false, false, 110),
  ('C1', 'Chuyển vị trí',                'move', '{bin_from}',         false, false, 120),
  ('C2', 'Mở khoá sau kiểm hàng',        'move', '{}',                 false, false, 130),
  ('C3', 'Khoá hàng hỏng · sai quy cách','move', '{reason}',           true,  false, 140)
on conflict (code) do nothing;

alter table public.warehouse_movements
  add column if not exists reason_code text
  references public.warehouse_reason_codes(code);

-- Bộ lọc CHÍNH của sổ phiếu là mã lý do, không phải ngày (người đi soát hỏi
-- "tháng này có bao nhiêu phiếu huỷ"). Index một phần: dòng cũ null không cần
-- nằm trong cây.
create index if not exists warehouse_movements_reason_code_idx
  on public.warehouse_movements (reason_code)
  where reason_code is not null;

comment on table public.warehouse_reason_codes is
  'Mã lý do kho (Đợt 3, docs/thiet-ke-kho.md §2c). Nguồn LUẬT cho UI/service nằm ở lib/kho-ma-ly-do.ts — có test canh hai bên khớp nhau.';

comment on column public.warehouse_movements.reason_code is
  'Mã lý do của DÒNG sổ. Null = dòng trước Đợt 3; chỗ đọc suy từ ref_type+direction qua lib/kho-ma-ly-do.ts, không backfill.';

alter table public.warehouse_reason_codes enable row level security;
