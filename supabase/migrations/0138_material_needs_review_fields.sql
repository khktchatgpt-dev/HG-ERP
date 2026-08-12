-- Kho rà vật tư khai vội THEO TỪNG TRƯỜNG — needs_review_fields (đợt 2 cải
-- thiện thiết kế vật tư, docs/vat-tu-ke-hoach-cai-thien-thiet-ke.md).
--
-- Vì sao: 0136 chỉ có cờ needs_review chung — Kho thấy chip "chờ rà" nhưng
-- không biết người khai vội đã bỏ trống quy cách, thiếu barem hay chưa chọn
-- nhóm phụ; phải rà cả bản ghi nên "rà xong" dễ thành đóng dấu hình thức.
-- Cột này ghi DANH SÁCH KEY trường đáng ngờ (form khai nhanh tự chấm bằng
-- `quickReviewFields` — src/lib/material-group-fields.ts), màn Kho hiện chip
-- từng trường; "Đã rà xong" (needs_review=false) thì service xoá luôn danh sách.
--
-- RLS: warehouse_materials đã enable RLS no-policies từ 0009 (anon chặn,
-- secret key server bypass) — thêm cột không đổi tư thế. Idempotent.

alter table public.warehouse_materials
  add column if not exists needs_review_fields text[] not null default '{}';

comment on column public.warehouse_materials.needs_review_fields is
  'Key các trường khai vội cần Kho rà (spec, kg_per_m…) — chỉ có nghĩa khi needs_review=true; Kho bấm "Đã rà xong" là về {}';
