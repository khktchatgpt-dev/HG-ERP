-- 0176: PHIẾU GHI NHẬN có trạng thái — thực hiện Bước 2 (đối tượng dữ liệu).
--
-- Mô hình chốt 26/08/2026:
--   1 phiếu = 1 lệnh SX + 1 công đoạn + 1 tổ + 1 ngày, CHỨA NHIỀU DÒNG chi tiết.
--   (Tài liệu tư vấn đề xuất 1 phiếu = 1 đầu ra; chốt giữ header-detail vì chị
--    thống kê chép từ sổ giấy của tổ — một ngày nhiều chi tiết, tách phiếu là
--    nhân số thao tác lên.)
--
-- BA QUYẾT ĐỊNH KHÔNG SINH CỘT (ghi lại để sau khỏi đào lại):
--
-- 1) "Đầu ra công đoạn" KHÔNG thành thực thể riêng. Đo dữ liệu thật: 996 chi
--    tiết đang chạy có 0 cụm, 0 hệ số quy đổi, 0 mốc công đoạn — mọi công đoạn
--    thao tác trên cùng một danh sách chi tiết phẳng. Đầu ra = cặp
--    (component_id × stage) đã lưu sẵn ở production_entries. Dựng bảng đầu ra
--    lúc này = 996 × 12 ≈ 12.000 bản ghi rỗng, không thêm thông tin nào.
--    Cấu trúc cụm (kind/cluster/qty_per_assembly) vẫn còn — bật khi xưởng thật
--    sự đếm theo cụm ở khâu hàn.
--
-- 2) CA: user chốt "tạm 1 ca" → không thêm cột. Nếu sau này chạy 2 ca:
--    `alter table production_entry_docs add column shift text;` rồi sửa chỗ gộp
--    phiếu ở service. KHÔNG có khoá unique nào theo (lệnh, công đoạn, tổ, ngày)
--    nên thêm ca không phá ràng buộc nào — đây là lý do để trống lúc này rẻ.
--
-- 3) "Sản lượng thực hiện" KHÔNG thành cột. Thống kê nhập ĐẠT + LỖI; thực hiện
--    = đạt + lỗi, tính khi đọc. Lưu cả ba là mở đường cho ba số lệch nhau.
--
-- CÁI MIGRATION NÀY THÊM: trạng thái phiếu, cho luồng
--    Nháp → Chờ xác nhận → Đã xác nhận, nhánh lỗi → Từ chối → (sửa) → gửi lại.
-- Luật CHUYỂN trạng thái (ai được bấm gì) thuộc Bước 4 — migration này chỉ khai
-- hình dạng dữ liệu, chưa gác gì.
--
-- 'tu_choi' gộp luôn "cần điều chỉnh" của tài liệu: hai trạng thái cùng nghĩa
-- "phiếu bị trả về cho thống kê sửa" — tách ra chỉ thêm nhánh chết.
--
-- RLS: bảng đã enable row level security (no policies) từ 0172 — không đổi.
-- Idempotent: add column if not exists + drop/add constraint.
-- Sau khi apply: sync types (schema đổi).

alter table public.production_entry_docs
  add column if not exists status text not null default 'nhap',
  add column if not exists confirmed_by uuid references public.users (id) on delete set null,
  add column if not exists confirmed_at timestamptz,
  add column if not exists reject_reason text;

comment on column public.production_entry_docs.status is
  'nhap | cho_xac_nhan | da_xac_nhan | tu_choi — luồng xác nhận của tổ trưởng (Bước 4 gác luật chuyển).';
comment on column public.production_entry_docs.reject_reason is
  'Lý do tổ trưởng trả phiếu về; thống kê đọc để biết sửa gì rồi gửi lại.';

alter table public.production_entry_docs
  drop constraint if exists production_entry_docs_status_check;

alter table public.production_entry_docs
  add constraint production_entry_docs_status_check
  check (status in ('nhap', 'cho_xac_nhan', 'da_xac_nhan', 'tu_choi'));

-- Phiếu đã xác nhận thì phải biết AI xác nhận, LÚC NÀO — không cho trạng thái
-- "đã xác nhận" trôi nổi không chủ (số liệu này là căn cứ tính tiến độ).
alter table public.production_entry_docs
  drop constraint if exists production_entry_docs_confirmed_check;

alter table public.production_entry_docs
  add constraint production_entry_docs_confirmed_check
  check (
    status <> 'da_xac_nhan'
    or (confirmed_by is not null and confirmed_at is not null)
  );

-- Phiếu bị trả về phải có lý do — thống kê không đoán mò phải sửa gì.
alter table public.production_entry_docs
  drop constraint if exists production_entry_docs_reject_check;

alter table public.production_entry_docs
  add constraint production_entry_docs_reject_check
  check (status <> 'tu_choi' or reject_reason is not null);

-- Truy vấn nóng của tổ trưởng: "phiếu tổ tôi đang chờ tôi xác nhận".
create index if not exists production_entry_docs_status_idx
  on public.production_entry_docs (team_department_id, status, entry_date desc);
