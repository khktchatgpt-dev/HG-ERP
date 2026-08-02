-- NHÓM PHỤ CHO VẬT TƯ + NẠP ĐỦ DANH MỤC ĐVT / NHÓM VẬT TƯ.
--
-- Bối cảnh: 02/08/2026 danh mục đi từ 1.320 lên 13.064 vật tư sau khi nạp bộ sổ
-- của phòng Cung ứng (14 nhóm chính, 109 NHÓM PHỤ). Nhóm phụ hiện bị nhét vào
-- `note` dạng "Nhóm phụ: Vòng bi - bạc đạn · ..." — nạp thì được, LỌC thì không,
-- mà 828 vật tư trong nhóm "Cơ khí - vòng bi - khuôn" không lọc nổi theo nhóm
-- phụ thì người soạn đơn phải cuộn tay qua cả nghìn dòng.
--
-- 1) warehouse_materials.sub_group — tầng phân loại thứ hai.
--    Text tự do có chủ đích: nhóm phụ do phòng Cung ứng đặt và còn đẻ thêm;
--    khoá ngoại sang catalog_items là mỗi lần thêm nhóm phụ phải qua quản trị.
--    Ràng buộc thật nằm ở UI (chọn từ danh sách, cho thêm mới).
--
-- 2) catalog_items type='unit' — nạp đủ 55 nhãn ĐVT chuẩn.
--    Bảng này có từ 0011 với 14 nhãn và CHƯA MÀN HÌNH NÀO ĐỌC. Sổ Cung ứng có
--    131 cách viết ĐVT (`docs/dvt-chuan-hoa.md`), gom lại còn 55. Nạp vào đây
--    để form tạo vật tư gợi ý thay vì đưa ô trống.
--
-- 3) catalog_items type='material_group' — 14 nhóm chuẩn.
--    Ô "Nhóm" trên form đang là text tự do; gõ tay là đẻ nhóm thứ 16 ngay hôm
--    sau, mà nhóm quyết định phạm vi so trùng tên khi chặn tạo trùng.
--
-- RLS: không tạo bảng mới, tư thế của warehouse_materials và catalog_items giữ
-- nguyên (bật RLS, không policy). Idempotent: add column if not exists +
-- on conflict do nothing.

alter table public.warehouse_materials
  add column if not exists sub_group text;

comment on column public.warehouse_materials.sub_group is
  'Nhóm phụ trong nhóm chính (109 nhóm của sổ Cung ứng). Text tự do — UI chọn từ danh sách nhưng cho thêm mới.';

create index if not exists warehouse_materials_group_sub_idx
  on public.warehouse_materials (group_name, sub_group);

-- ── ĐVT chuẩn (docs/dvt-chuan-hoa.md) ───────────────────────────────────────
insert into public.catalog_items (type, code, label, sort_order) values
  ('unit', 'cai',    'Cái',    1),
  ('unit', 'chiec',  'Chiếc',  2),
  ('unit', 'bo',     'Bộ',     3),
  ('unit', 'con',    'Con',    4),
  ('unit', 'kg',     'Kg',     5),
  ('unit', 'tam',    'Tấm',    6),
  ('unit', 'm',      'Mét',    7),
  ('unit', 'm2',     'M²',     8),
  ('unit', 'm3',     'M³',     9),
  ('unit', 'cay',    'Cây',   10),
  ('unit', 'thanh',  'Thanh', 11),
  ('unit', 'khuc',   'Khúc',  12),
  ('unit', 'soi',    'Sợi',   13),
  ('unit', 'day',    'Dây',   14),
  ('unit', 'cuon',   'Cuộn',  15),
  ('unit', 'vong',   'Vòng',  16),
  ('unit', 'lo',     'Lô',    17),
  ('unit', 'lo_don', 'Lố',    18),
  ('unit', 'thung',  'Thùng', 19),
  ('unit', 'hop',    'Hộp',   20),
  ('unit', 'bao',    'Bao',   21),
  ('unit', 'bi',     'Bì',    22),
  ('unit', 'bich',   'Bịch',  23),
  ('unit', 'tui',    'Túi',   24),
  ('unit', 'vi',     'Vỉ',    25),
  ('unit', 'lon',    'Lon',   26),
  ('unit', 'chai',   'Chai',  27),
  ('unit', 'lo_thuy','Lọ',    28),
  ('unit', 'binh',   'Bình',  29),
  ('unit', 'can',    'Can',   30),
  ('unit', 'xo',     'Xô',    31),
  ('unit', 'phuy',   'Phuy',  32),
  ('unit', 'lit',    'Lít',   33),
  ('unit', 'to',     'Tờ',    34),
  ('unit', 'quyen',  'Quyển', 35),
  ('unit', 'nhan',   'Nhãn',  36),
  ('unit', 'tem',    'Tem',   37),
  ('unit', 'the',    'Thẻ',   38),
  ('unit', 'mui',    'Mũi',   39),
  ('unit', 'luoi',   'Lưỡi',  40),
  ('unit', 'vien',   'Viên',  41),
  ('unit', 'cuc',    'Cục',   42),
  ('unit', 'mieng',  'Miếng', 43),
  ('unit', 'la',     'Lá',    44),
  ('unit', 'hot',    'Hột',   45),
  ('unit', 'banh',   'Bánh',  46),
  ('unit', 'chup',   'Chụp',  47),
  ('unit', 'o_bi',   'Ổ',     48),
  ('unit', 'ong',    'Ống',   49),
  ('unit', 'bo_bua', 'Bó',    50),
  ('unit', 'cap',    'Cặp',   51),
  ('unit', 'doi',    'Đôi',   52),
  ('unit', 'pcs',    'PCS',   53),
  ('unit', 'yard',   'Yard',  54),
  ('unit', 'inch',   'Inch',  55)
on conflict (type, code) do nothing;

-- ── 14 nhóm vật tư chuẩn của sổ Cung ứng ────────────────────────────────────
insert into public.catalog_items (type, code, label, sort_order) values
  ('material_group', 'g01', 'Bao bì - đóng gói - tem nhãn',      1),
  ('material_group', 'g02', 'Bu lông - vít - đinh - liên kết',   2),
  ('material_group', 'g03', 'Phụ kiện nội thất',                 3),
  ('material_group', 'g04', 'Dụng cụ - máy móc - mài',           4),
  ('material_group', 'g05', 'Văn phòng - nội bộ - bảo hộ',       5),
  ('material_group', 'g06', 'Điện - chiếu sáng - điều khiển',    6),
  ('material_group', 'g07', 'Cơ khí - vòng bi - khuôn',          7),
  ('material_group', 'g08', 'Sơn - dầu - keo - hoá chất',        8),
  ('material_group', 'g09', 'Gỗ - kính - nhựa tấm',              9),
  ('material_group', 'g10', 'Ống - van - khí nén - thủy lực',   10),
  ('material_group', 'g11', 'Vật tư hàn - cắt',                 11),
  ('material_group', 'g12', 'Sắt thép - inox - nhôm - tôn',     12),
  ('material_group', 'g13', 'Vải - mây - chỉ - sợi',            13),
  ('material_group', 'g14', 'Mút - xốp - nệm - gòn',            14)
on conflict (type, code) do nothing;
