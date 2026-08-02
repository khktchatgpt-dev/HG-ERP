/**
 * ĐVT CHUẨN — 55 nhãn, khớp `catalog_items` type='unit' (migration 0111).
 *
 * Bảng duyệt: `docs/dvt-chuan-hoa.md`. Danh mục thật của phòng Cung ứng có 131
 * cách viết cho chừng này đơn vị; phần lớn chỉ khác hoa/thường.
 */
export const CANONICAL_UNITS = [
  'Cái',
  'Chiếc',
  'Bộ',
  'Con',
  'Kg',
  'Tấm',
  'Mét',
  'M²',
  'M³',
  'Cây',
  'Thanh',
  'Khúc',
  'Sợi',
  'Dây',
  'Cuộn',
  'Vòng',
  'Lô',
  'Lố',
  'Thùng',
  'Hộp',
  'Bao',
  'Bì',
  'Bịch',
  'Túi',
  'Vỉ',
  'Lon',
  'Chai',
  'Lọ',
  'Bình',
  'Can',
  'Xô',
  'Phuy',
  'Lít',
  'Tờ',
  'Quyển',
  'Nhãn',
  'Tem',
  'Thẻ',
  'Mũi',
  'Lưỡi',
  'Viên',
  'Cục',
  'Miếng',
  'Lá',
  'Hột',
  'Bánh',
  'Chụp',
  'Ổ',
  'Ống',
  'Bó',
  'Cặp',
  'Đôi',
  'PCS',
  'Yard',
  'Inch',
] as const

const BY_KEY = new Map(
  CANONICAL_UNITS.map((u) => [u.toLowerCase().normalize('NFC'), u] as const),
)

/**
 * Chuẩn hoá ĐVT người dùng gõ: gọn khoảng trắng, dựng sẵn dấu (NFC), rồi khớp
 * KHÔNG phân biệt hoa/thường với danh mục — trùng thì trả về đúng nhãn chuẩn.
 *
 * Vì sao NFC quan trọng hơn vẻ ngoài của nó: danh mục từng có HAI chuỗi "cái"
 * trông y hệt nhau — `63 e1 69` (á dựng sẵn) và `63 61 301 69` (a + dấu sắc
 * rời). 5 vật tư mang chuỗi thứ hai. Lọc theo ĐVT là mất đúng 5 dòng đó, và
 * không ai nhìn ra được bằng mắt.
 *
 * Không khớp danh mục thì GIỮ NGUYÊN (đã gọn + NFC): xưởng có ĐVT thật nằm
 * ngoài danh sách, ép về "Cái" là sai dữ liệu.
 */
export function normalizeUnit(raw: string | null | undefined): string {
  const s = String(raw ?? '')
    .normalize('NFC')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return s
  return BY_KEY.get(s.toLowerCase()) ?? s
}
