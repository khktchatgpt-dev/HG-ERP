-- 0181 — Tài liệu hồ sơ SP: bản ĐANG DÙNG + ghi chú + số phiên bản
--
-- LÀM GÌ: thêm 3 cột vào `files`:
--   · is_current boolean not null default false — bản ĐANG DÙNG của loại đó
--   · rev        text  — ký hiệu phiên bản do người dùng gõ ("Rev 3", "v2.1")
--   · note       text  — ghi chú ngắn ("bản sửa theo mail khách 12/8")
--
-- VÌ SAO `is_current` NẰM Ở FILE, KHÔNG PHẢI CỘT TRÊN SẢN PHẨM: 0140 làm bản
-- đầu bằng `technical_products.bom_file_id` — một cột cho MỘT loại. Nay có 11
-- loại tài liệu (0180), đi tiếp lối đó là 11 cột FK trên bảng sản phẩm. Đánh dấu
-- trên chính file thì thêm loại không tốn cột nào.
--
-- MỘT bản đang dùng cho mỗi (sản phẩm, loại) — ép bằng UNIQUE index có điều
-- kiện, không để tầng ứng dụng tự giữ. Hai người cùng bấm "Dùng bản này" trên
-- hai file cùng loại là chuyện xảy ra thật, và khi đó DB phải là chỗ nói không.
--
-- `rev`/`note` là TEXT TỰ DO có chủ ý: xưởng gọi phiên bản đủ kiểu — "Rev 3",
-- "v2.1", "bản 12/8", "sau khi khách duyệt". Ép số nguyên là người dùng phải bịa
-- ra một con số rồi ghi cách gọi thật vào ghi chú. Khác `technical_products.
-- bom_rev` (số, thuộc biểu mẫu ISO HG-QT-07/M02) — cái đó nói về HỒ SƠ, cái này
-- nói về TỪNG FILE.
--
-- BACKFILL: file BOM đang được `technical_products.bom_file_id` trỏ tới thì
-- chuyển thành `is_current` — giữ lại dấu "bản dùng" mà 0140 đã đánh, không bắt
-- Kỹ thuật đánh lại. Cột `bom_file_id` KHÔNG xoá: ảnh chụp phiên bản hồ sơ
-- (0143) có tham chiếu nó, xoá là hỏng lịch sử.
--
-- RLS: `files` đã bật RLS không policy từ migration tạo bảng — thêm cột/index
-- không đụng tới tư thế đó. Không tạo bảng/view mới.

alter table public.files
  add column if not exists is_current boolean not null default false,
  add column if not exists rev text,
  add column if not exists note text;

comment on column public.files.is_current is
  'Ban DANG DUNG cua (product_id, doc_type). Chi co nghia voi file gan san pham.';

-- Chỉ tính file còn sống và có cả parent lẫn phân loại: file đã xoá mềm không
-- được giữ chỗ, và "đang dùng" mà không biết dùng cho loại nào thì vô nghĩa.
create unique index if not exists files_current_per_product_doc_idx
  on public.files (product_id, doc_type)
  where is_current
    and deleted_at is null
    and product_id is not null
    and doc_type is not null;

update public.files f
set is_current = true
from public.technical_products p
where p.bom_file_id = f.id
  and f.deleted_at is null
  and f.product_id = p.id
  and f.doc_type = 'bom'
  and not f.is_current;
