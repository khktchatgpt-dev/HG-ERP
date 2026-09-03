-- 0183: catalog_items.meta — thuộc tính phụ của mục danh mục (jsonb).
--
-- Việc đầu tiên dùng nó: MẪU ĐƠN MUA MẶC ĐỊNH THEO NHÓM VẬT TƯ
-- (`meta.po_template` trên type = material_group). Kế hoạch phân nhóm 03/09/2026
-- gắn mỗi nhóm chính một mẫu đơn (Nhôm định hình → aluminium, Gỗ → wood…), nhưng
-- mẫu vẫn nằm trên TỪNG vật tư; vật tư mới khai vào nhóm Nhôm chưa tự nhận mẫu
-- nhôm, người khai phải nhớ chọn. Mặc định theo nhóm là mồi cho create + gợi ý
-- trên form; vật tư vẫn giữ mẫu riêng nếu đã có (mẫu là của vật tư/đơn, nhóm
-- chỉ cho giá trị khởi đầu).
--
-- jsonb thay vì thêm cột riêng: catalog_items là bảng chung cho 5 loại danh mục
-- (unit, material_group, product_category, production_stage, contract_type);
-- mỗi loại sẽ có thuộc tính riêng, thêm cột cho từng loại là bảng thưa dần.
-- Ứng dụng đọc/ghi qua service, khoá hợp lệ do zod ở biên API.
--
-- RLS: bảng đã bật RLS không policy từ 0011 (anon chặn, secret key đi vòng);
-- migration này chỉ thêm cột, tư thế không đổi. Idempotent.

alter table public.catalog_items
  add column if not exists meta jsonb not null default '{}'::jsonb;

comment on column public.catalog_items.meta is
  'Thuộc tính phụ theo loại mục. material_group: { po_template?: string } — mẫu đơn mua mặc định cho vật tư mới của nhóm.';
