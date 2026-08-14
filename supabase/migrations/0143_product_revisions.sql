-- LỊCH SỬ PHIÊN BẢN HỒ SƠ SẢN PHẨM — sinh ra từ nhịp KHOÁ/MỞ KHOÁ đã có.
--
-- Tài liệu ERP đòi "Revision History": mỗi phiên bản có người tạo, ngày, người
-- duyệt, lý do thay đổi, nội dung thay đổi, BOM tương ứng. Cái thiếu ở HG-ERP
-- không phải chỗ chứa — mà là MỐC để chốt một phiên bản.
--
-- Mốc đó ĐÃ CÓ SẴN: 0140 bắt mọi sửa đổi phải đi qua vòng "mở khoá (ghi lý do)
-- → sửa → khoá lại". Nên phiên bản không cần thao tác mới nào cả: mỗi lần KHOÁ
-- là chốt một bản (rev tăng dần, kèm ẢNH CHỤP thuộc tính + toàn bộ định mức tại
-- thời điểm đó), mỗi lần MỞ KHOÁ là một dòng ghi vết kèm lý do đã bắt nhập.
-- Người dùng không phải học gì thêm — lịch sử rơi ra từ thứ họ đang bấm.
--
-- Vì sao KHÔNG tách bảng Product / ProductVersion như tài liệu gợi ý: `product_id`
-- đang là FK ở báo giá, dòng đơn, dòng lệnh, định mức, phương án đóng gói, file,
-- chuyển giao tổ. Tách bảng nghĩa là mọi chỗ đó phải chọn "trỏ SP hay trỏ phiên
-- bản nào" — đại phẫu toàn hệ thống. Thứ thật sự cần từ việc tách (số liệu quá
-- khứ không tự đổi) đã lấy được bằng 0142 (chụp định mức vào lệnh) + bảng này
-- (chụp hồ sơ tại mỗi lần chốt).
--
--   `rev`             số bản, tăng dần theo từng SP, chỉ tăng ở hành động 'lock'
--   `action`          'lock' = chốt bản mới · 'unlock' = mở bản đang chốt ra sửa
--   `reason`          ghi chú khoá / LÝ DO mở khoá (0140 đã bắt nhập)
--   `changed_fields`  trường đổi so với bản chốt trước ('parts' = định mức đổi)
--   `fields_snapshot` ảnh chụp thuộc tính hồ sơ lúc chốt
--   `parts_snapshot`  ảnh chụp TOÀN BỘ bảng định mức lúc chốt
--
-- KHÔNG đụng `bom_rev`: đó là ô "Lần sửa đổi (Rev.)" người dùng tự gõ để in lên
-- biểu mẫu ISO HG-QT-07/M02, không phải bộ đếm hệ thống. Hai số sống song song,
-- UI gọi số của bảng này là "Bản #N".
--
-- RLS: bảng mới → enable RLS, KHÔNG policy (anon chặn, secret key bypass).
-- Idempotent.

create table if not exists public.technical_product_revisions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.technical_products (id) on delete cascade,
  rev integer not null,
  action text not null check (action in ('lock', 'unlock')),
  reason text,
  changed_fields text[] not null default '{}',
  fields_snapshot jsonb not null default '{}'::jsonb,
  parts_snapshot jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid references public.users (id) on delete set null,
  unique (product_id, rev, action)
);

comment on table public.technical_product_revisions is
  'Lịch sử phiên bản hồ sơ SP (0143) — mỗi lần khoá là một bản chốt kèm ảnh chụp thuộc tính + định mức; mỗi lần mở khoá là một dòng ghi vết kèm lý do';

create index if not exists technical_product_revisions_product_idx
  on public.technical_product_revisions (product_id, rev desc);

alter table public.technical_product_revisions enable row level security;

-- Hồ sơ ĐANG KHOÁ từ trước 0143 chưa có dòng lịch sử nào. Dựng bản #1 cho chúng
-- từ chính cột `locked_*` (ảnh chụp để rỗng — dữ liệu tại thời điểm khoá đó
-- không dựng lại được; từ lần khoá sau là có đủ).
insert into public.technical_product_revisions
  (product_id, rev, action, reason, created_at, created_by)
select
  tp.id, 1, 'lock', tp.lock_note, tp.locked_at, tp.locked_by
from public.technical_products tp
where tp.locked_at is not null
  and not exists (
    select 1 from public.technical_product_revisions r where r.product_id = tp.id
  );
