-- Kỹ thuật: bổ sung NHÓM ĐỊNH MỨC và các trường QUY ĐỔI SANG ĐƠN VỊ MUA.
--
-- Nguồn: quét 187 file BOM thật ở `E:\All BOM_Thức` (11/08/2026) — chi tiết ở
-- `docs/dinh-muc-nhom-theo-bom-187-file.md`. Bản thiết kế trước
-- (`dinh-muc-redesign-plan.md`) dựng trục KHỐI→CỤM→CHI TIẾT từ 2 file khung
-- nhôm; quét toàn bộ cho thấy còn 5 nhóm chưa có chỗ và một mắt xích thiếu.
--
-- ── 1. Năm nhóm mới (đếm được trong file, không suy diễn) ───────────────────
--   POLYWOOD  45 file / 54 dòng   "Quy cách Nan Polywood" — user chốt để NHÓM
--                                  RIÊNG (mua theo TẤM, không theo m³ như gỗ)
--   PANEL     14 file / 40 dòng   "Quy cách Kính/Mặt đá/Mặt bàn"
--   FABRIC     7 file / 17 dòng   "VẢI", "QUY CÁCH VẢI TEXTILEN"
--   LABEL      4 file / 66 dòng   "TEM"       (con của PACKAGING)
--   ZIPPER     4 file / 26 dòng   "ĐẦU DÂY KÉO YKK" (con của FABRIC — phụ liệu may)
--
-- CUSHION đổi nhãn "Nệm & vải" → "Nệm / mút / gòn": vải tách sang FABRIC vì
-- tính theo MÉT KHỔ + % hao hụt, không phải m³ như nệm — hai cơ chế khác hẳn.
--
-- ── 2. Trường quy đổi sang ĐƠN VỊ MUA ───────────────────────────────────────
-- Định mức trả lời "tốn bao nhiêu mét/kg/m³", còn đơn đặt hàng cần "mua bao
-- nhiêu CÂY/TẤM/CUỘN". Thiếu cầu nối này nên Cung ứng vẫn phải nhập lại bảng
-- chi tiết cho từng LSX dù hồ sơ SP đã có định mức.
--
--   bar_length_m   chiều dài cây tiêu chuẩn (nhôm/inox/sắt) — 6.0, 5.9, 5.82…
--   pcs_per_bar    số chi tiết cắt được trên 1 cây  → số cây = SL ÷ pcs_per_bar
--   wood_species   loại gỗ (keo/teck/bạch đàn/ván ép) — trong file nằm ở TIÊU ĐỀ
--                  khối ("Quy cách Gỗ: Gỗ Teck"), không phải một cột; giá ba
--                  loại khác nhau nên Cung ứng không gộp chung được
--   roll_width_m   khổ vải (1.6…) — không có khổ thì không ra được số mét
--   waste_pct      % hao hụt khi cắt (file ghi 2% vải thường, 3% textilene).
--                  0097 từng bỏ một cột cùng tên mang nghĩa hao hụt chung; cột
--                  này định nghĩa hẹp: hao hụt CẮT của vải/tấm, đơn vị phần trăm
--   sheet_w_mm     quy cách TẤM (polywood, ván ép, kính, mặt đá) → số tấm cần
--   sheet_l_mm
--   m3_per_sheet   m³ của 1 tấm mút (file ghi sẵn "0.0222") → số tấm mút
--
-- Tất cả đều NULL-able: mỗi nhóm chỉ dùng vài cột của mình, dòng cũ không đụng.
--
-- RLS: không tạo bảng mới — `technical_product_parts` và `technical_part_groups`
-- đã enable RLS no-policies từ 0092/0093 (anon chặn, secret key bypass).
-- Idempotent: insert ... on conflict do nothing · add column if not exists.
-- Apply xong: "sync types".

-- ── Nhóm mới ────────────────────────────────────────────────────────────────
insert into public.technical_part_groups (code, label, parent_code, sort_order) values
  ('POLYWOOD', 'Polywood / ván ép',        null,        25),
  ('FABRIC',   'Vải / textilene',          null,        32),
  ('ZIPPER',   'Dây kéo, nhám gai',        'FABRIC',    33),
  ('PANEL',    'Kính / mặt đá / mặt bàn',  null,        35),
  ('LABEL',    'Tem / nhãn',               'PACKAGING', 51)
on conflict (code) do nothing;

update public.technical_part_groups
   set label = 'Nệm / mút / gòn'
 where code = 'CUSHION'
   and label <> 'Nệm / mút / gòn';

-- Hai nhãn cũ nay chồng lấn nhóm mới: WOOD không còn ôm polywood, DAY_DAN không
-- còn ôm textilene (đã sang FABRIC).
update public.technical_part_groups
   set label = 'Gỗ tự nhiên' where code = 'WOOD' and label <> 'Gỗ tự nhiên';
update public.technical_part_groups
   set label = 'Dây đan / mây' where code = 'DAY_DAN' and label <> 'Dây đan / mây';

-- ── Trường quy đổi đơn vị mua ───────────────────────────────────────────────
alter table public.technical_product_parts
  add column if not exists wood_species  text,
  add column if not exists bar_length_m  numeric,
  add column if not exists pcs_per_bar   numeric,
  add column if not exists roll_width_m  numeric,
  add column if not exists waste_pct     numeric,
  add column if not exists sheet_w_mm    numeric,
  add column if not exists sheet_l_mm    numeric,
  add column if not exists m3_per_sheet  numeric;

comment on column public.technical_product_parts.bar_length_m is
  'Chiều dài cây tiêu chuẩn (m). Cùng một mã vật tư nhưng khác chiều dài cây thì Cung ứng đặt RIÊNG — khoá gộp mua là (mã vật tư, chiều dài cây).';
comment on column public.technical_product_parts.pcs_per_bar is
  'Số chi tiết cắt được trên 1 cây → số cây cần = ceil(SL chi tiết / pcs_per_bar).';
comment on column public.technical_product_parts.waste_pct is
  'Hao hụt CẮT tính theo phần trăm (vải 2, textilene 3). Khác cột waste_pct chung đã bỏ ở 0097.';

-- Ràng buộc nhẹ: số đo phải dương nếu có khai (chặn gõ 0 hay số âm).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'technical_product_parts_purchase_units_positive'
  ) then
    alter table public.technical_product_parts
      add constraint technical_product_parts_purchase_units_positive check (
        (bar_length_m is null or bar_length_m > 0) and
        (pcs_per_bar  is null or pcs_per_bar  > 0) and
        (roll_width_m is null or roll_width_m > 0) and
        (waste_pct    is null or (waste_pct >= 0 and waste_pct < 100)) and
        (sheet_w_mm   is null or sheet_w_mm   > 0) and
        (sheet_l_mm   is null or sheet_l_mm   > 0) and
        (m3_per_sheet is null or m3_per_sheet > 0)
      );
  end if;
end $$;
