-- 0287: CẤU HÌNH CÔNG ĐOẠN — bậc đếm + ô lõi khai bằng DỮ LIỆU trên
-- catalog_items.meta (type = 'production_stage'), không thêm bảng, không thêm cột.
--
-- Bước B1 của docs/san-xuat-cau-hinh-thiet-ke.md (chủ dự án duyệt 03/11/2026).
--
-- VẤN ĐỀ. Ba bậc đếm chi tiết / cụm / bộ đang GHI CỨNG trong mã:
-- `lib/default-assembly.ts` JOIN_STAGE = 'han' (từ hàn trở đi đếm cụm) và
-- `lib/finish-stages.ts` FINISH_STAGES = lắp ráp → hoàn thiện (đếm bộ). Thêm
-- một công đoạn mới hay đổi cách đếm của "đan" là phải sửa mã. Bản tư vấn
-- 03/11 (mục 5 "mỗi công đoạn một đơn vị thống kê") đòi khai được.
--
-- THIẾT KẾ. Mỗi mục production_stage mang `meta`:
--   count_level  'part' | 'cluster' | 'unit'   — chi tiết · cụm · bộ (cái)
--   core         { defect, rework, kg, worker } mỗi ô 'off' | 'on' | 'required'
--                — ô LÕI của phiếu ghi sổ hiện / bắt buộc theo công đoạn.
--                `qty` (SL đạt) luôn hiện và luôn bắt buộc, không khai.
--   input_from   mã công đoạn cấp đầu vào (null = đầu chuỗi / để máy suy)
-- Ô RIÊNG (production_stage_fields, 0207), MÃ LỖI (production_defect_codes) và
-- TỔ (departments.stage_code, 0064) đã có bảng riêng — màn cấu hình bày chung,
-- không chép sang đây.
--
-- Mã đọc: `lib/stage-config.ts` parse meta (thiếu / sai thì rơi về mặc định
-- THEO MÃ, đúng hành vi trước migration này). Công đoạn GHÉP = công đoạn đầu
-- tiên đếm 'cluster'; CHẶNG THÀNH PHẨM = các công đoạn đếm 'unit'.
--
-- SEED ĐÚNG HÀNH VI HÔM NAY — sổ không đổi nghĩa sau khi áp:
--   phôi · gỗ · đan · may            → chi tiết
--   hàn · nguội · mài · sơn          → cụm
--   lắp ráp · bao bì · đóng gói · hoàn thiện → bộ
-- Chỉ ghi khi meta CHƯA có count_level (jsonb merge) → chạy lại không đè
-- cấu hình người đã sửa trên màn.
--
-- RLS: không đổi (catalog_items đã enable, no policies — anon chặn, secret
-- bypass). Idempotent: update có điều kiện, không DDL.

update public.catalog_items
set meta = coalesce(meta, '{}'::jsonb) || jsonb_build_object(
  'count_level',
  case code
    when 'phoi' then 'part'
    when 'moc' then 'part'
    when 'dan' then 'part'
    when 'may' then 'part'
    when 'han' then 'cluster'
    when 'nguoi' then 'cluster'
    when 'mai' then 'cluster'
    when 'son' then 'cluster'
    when 'lap_rap' then 'unit'
    when 'bao_bi' then 'unit'
    when 'dong_goi' then 'unit'
    when 'hoan_thien' then 'unit'
    else 'part'
  end,
  'core',
  jsonb_build_object('defect', 'on', 'rework', 'on', 'kg', 'on', 'worker', 'on'),
  'input_from',
  null
)
where type = 'production_stage'
  and (meta is null or meta->>'count_level' is null);

comment on column public.catalog_items.meta is
  'Thuộc tính phụ theo type. material_group: po_template, needs_inspection. production_stage (0287): count_level part|cluster|unit, core {defect,rework,kg,worker: off|on|required}, input_from.';
