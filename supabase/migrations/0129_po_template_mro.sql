-- 0129: Thêm mẫu đơn MRO (phụ tùng / bảo trì / bảo hộ) vào danh sách hợp lệ.
--
-- Vì sao: rà cả danh mục 13.168 mã thì 6.892 (52%) đang mang mẫu 'simple', và
-- bóc ra thấy hơn 4.300 mã trong đó là MỘT HỌ RIÊNG chứ không phải hàng hỗn
-- tạp — dụng cụ/máy/mài 1.320 · điện 979 · ống-van-khí nén 856 · cơ khí-vòng
-- bi-khuôn 667 · văn phòng-bảo hộ 468. Chúng mua LẺ ngoài LSX, không có định
-- mức/sp, nên hai cột "SL đơn hàng · Tồn kho" của các mẫu sản xuất vô nghĩa;
-- thứ cần ghi lại là model/mã hãng, lắp cho máy nào, bảo hành bao lâu.
--
-- 1) Nới check constraint nhận 'mro' (giữ nguyên 9 giá trị cũ).
-- 2) Gán 'mro' cho các NHÓM chắc chắn là phụ tùng/bảo trì, và CHỈ cho dòng đang
--    để 'simple' — không đụng vào mã đã được phân loại đúng ở 0122/0123.
--
-- Lưu ý phạm vi: `warehouse_materials.po_template` hiện KHÔNG quyết định gì lúc
-- soạn đơn (mẫu là thuộc tính của ĐƠN, chọn ở đầu form — xem chú thích trong
-- `po-materials.repo.ts`). Backfill này để metadata danh mục nói đúng sự thật
-- và sẵn sàng cho việc gợi ý mẫu theo vật tư sau này.
--
-- RLS: không đổi. Idempotent. Không cần sync types (cột text).

alter table public.warehouse_materials
  drop constraint if exists warehouse_materials_po_template_check;

alter table public.warehouse_materials
  add constraint warehouse_materials_po_template_check
  check (po_template is null
         or po_template in ('accessory', 'aluminium', 'metal_kg', 'carton',
                            'rattan', 'paint', 'chemical', 'foam', 'mro',
                            'simple'));

update public.warehouse_materials set po_template = 'mro'
where po_template = 'simple'
  and group_name in (
    'Dụng cụ - máy móc - mài',
    'Điện - chiếu sáng - điều khiển',
    'Ống - van - khí nén - thủy lực',
    'Cơ khí - vòng bi - khuôn',
    'Văn phòng - nội bộ - bảo hộ'
  );
