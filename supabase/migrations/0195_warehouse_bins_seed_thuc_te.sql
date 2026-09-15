-- 0195 — Nạp 13 KHU THẬT cho kho vật tư chính.
--
-- BỐI CẢNH. 0193 chỉ nạp ba khu ẢO (TIEP-NHAN / KHOA-01 / PHE-Z) vì tên khu
-- thật phải khớp biển hiệu ngoài xưởng, và nạp hộ tên đoán mò là đẻ dữ liệu
-- người dùng phải đi dọn. Chủ dự án chốt 15/09/2026: cứ nạp trước, sửa sau —
-- không có khu thật thì hàng nhận về nằm mãi ở khu tiếp nhận và màn Cất hàng
-- không cất đi đâu được.
--
-- TÊN KHU DỰNG TỪ NHÓM VẬT TƯ THẬT, không bịa. Danh mục có 21 nhóm đang hoạt
-- động (đọc 15/09/2026); 20 nhóm là hàng để được, nhóm "Dịch vụ - gia công -
-- vận chuyển" (239 mã) không có gì để cất nên không có khu.
--
-- Gộp 20 nhóm thành 13 khu theo cách một xưởng nội thất nhôm thật sự xếp kho:
-- thứ nào nằm cạnh nhau ngoài bãi thì chung một khu, chứ không một-nhóm-một-khu
-- (thành 20 tấm biển cho một nhà kho).
--
--   NHOM-A  Nhôm định hình - tấm                              705 mã
--   SAT-B   Sắt thép - tôn - tấm · Inox                     1.113 mã
--   PK-C    Bu lông - vít - đinh - liên kết · Phụ kiện nội thất 2.562 mã
--   NEM-D   Mút - xốp - nệm - gòn                             804 mã
--   VAI-E   Vải - da - chỉ - phụ liệu may                     332 mã
--   MAY-F   Dây mây - vật liệu đan                            254 mã
--   SON-G   Sơn - keo - hoá chất · Dầu - nhớt - mỡ bôi trơn   620 mã
--   BB-H    Bao bì - đóng gói - tem nhãn                    1.696 mã
--   GO-K    Gỗ - ván · Kính - mica - nhựa tấm                 359 mã
--   CK-L    Cơ khí - vòng bi - khuôn · Ống - van - khí nén   1.762 mã
--   DC-M    Dụng cụ cầm tay - lưỡi mũi - nhám · Vật tư hàn - cắt 1.305 mã
--   DIEN-N  Điện - chiếu sáng - điều khiển · Máy móc - thiết bị 1.263 mã
--   VP-P    Văn phòng - nội bộ - bảo hộ                       213 mã
--
-- ĐÂY LÀ ĐIỂM BẮT ĐẦU, KHÔNG PHẢI SỰ THẬT. Tên và cách gộp là suy ra từ danh
-- mục, không phải đo ngoài xưởng. Sửa ở /warehouse/ke: đổi tên, thêm khu, hoặc
-- ngừng dùng khu không có thật — màn đó chặn ngừng khu đang giữ hàng nên không
-- dọn nhầm được.
--
-- `on conflict do nothing` theo (warehouse_id, code): chạy lại không đẻ trùng,
-- và KHÔNG ghi đè tên người dùng đã sửa.
--
-- RLS: bảng đã enable ở 0193, không policy. Idempotent.

insert into public.warehouse_bins (warehouse_id, code, name, kind)
select w.id, v.code, v.name, 'store'
from public.warehouses w
cross join (values
  ('NHOM-A', 'Nhôm định hình, tấm nhôm'),
  ('SAT-B',  'Sắt thép, tôn, tấm, inox'),
  ('PK-C',   'Bu lông, vít, đinh, phụ kiện nội thất'),
  ('NEM-D',  'Mút, xốp, nệm, gòn'),
  ('VAI-E',  'Vải, da, chỉ, phụ liệu may'),
  ('MAY-F',  'Dây mây, vật liệu đan'),
  ('SON-G',  'Sơn, keo, hoá chất, dầu nhớt'),
  ('BB-H',   'Bao bì, đóng gói, tem nhãn'),
  ('GO-K',   'Gỗ, ván, kính, mica, nhựa tấm'),
  ('CK-L',   'Cơ khí, vòng bi, khuôn, ống van khí nén'),
  ('DC-M',   'Dụng cụ cầm tay, lưỡi mũi, nhám, vật tư hàn cắt'),
  ('DIEN-N', 'Điện, chiếu sáng, điều khiển, máy móc thiết bị'),
  ('VP-P',   'Văn phòng, nội bộ, bảo hộ')
) as v(code, name)
where w.is_active
on conflict (warehouse_id, code) do nothing;
