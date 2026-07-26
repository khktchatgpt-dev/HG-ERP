-- Kỹ thuật: giữ lại thông tin của KHỐI ĐỊNH MỨC trong file BOM gốc.
--
-- Bối cảnh: file BOM (biểu mẫu HG-QT-07/M02) chia định mức thành từng khối, mỗi
-- khối có một dòng tiêu đề. Đợt nạp đầu bỏ qua dòng tiêu đề này — mất thật sự,
-- vì nó KHÔNG phải nhãn trang trí mà mang thông số:
--   "Quy cách nệm: D23"              mật độ mút
--   "Quy cách mặt bàn: Acacia - NON FSC"  loại gỗ + trạng thái FSC (56 dòng)
--   "VẬT TƯ ĐÓNG GÓI : 6A"           mã/định lượng bao bì
--   "Quy cách nhôm : 1 ghế"          ĐƠN VỊ TÍNH CỦA KHỐI
--
-- Cái cuối là lỗi số liệu, không chỉ thiếu thông tin: 535 dòng thuộc 43 SP (26
-- trong đó là BỘ) có định mức tính cho 1 ghế / 1 bàn / 1 cái chứ không phải cho
-- cả sản phẩm. Nếu hiểu nhầm là "trên 1 SP" thì đặt mua sẽ THIẾU vật tư.
--
--   section_title  tiêu đề khối, giữ nguyên văn (điền 100% ở nguồn)
--   unit_basis     đơn vị tính của khối, tách từ tiêu đề: '1 ghế', '1 bàn'…
--                  null = tính trên 1 sản phẩm (mặc định, phần lớn)
--   material_note  cột "Vật liệu" trên dòng: 'Nhựa', '7 màu' (1.438 dòng)
--   tenon          cột "Mộng" (77 dòng)
--
-- CỐ Ý KHÔNG tự nhân qty theo unit_basis: suy ra số ghế trong bộ từ tiêu đề là
-- việc cần người xác nhận. Lưu nguyên trạng + đánh dấu để UI cảnh báo.
--
-- RLS: không đổi (bảng đã enable, no policies). Chỉ ADD COLUMN IF NOT EXISTS nên
-- idempotent, không đụng dữ liệu cũ. Apply xong: "sync types".

alter table public.technical_product_parts
  add column if not exists section_title text,
  add column if not exists unit_basis text,
  add column if not exists material_note text,
  add column if not exists tenon text;

comment on column public.technical_product_parts.section_title is
  'Tiêu đề khối định mức trong file BOM gốc, giữ nguyên văn.';
comment on column public.technical_product_parts.unit_basis is
  'Đơn vị tính của khối ("1 ghế", "1 bàn"). null = tính trên 1 sản phẩm.';

-- Lọc nhanh các dòng cần rà vì định mức không tính trên 1 sản phẩm.
create index if not exists technical_product_parts_unit_basis_idx
  on public.technical_product_parts (product_id)
  where unit_basis is not null;
