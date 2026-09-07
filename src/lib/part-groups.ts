/**
 * LOẠI VẬT TƯ THEO ĐỊNH MỨC — `technical_product_parts.group_code`.
 *
 * Đây là trục phân loại mà Cung ứng thật sự dùng: sổ tay của phòng tách hẳn
 * "BẢNG KÊ VẬT TƯ NGŨ KIM" khỏi "VẬT TƯ BAO BÌ" khỏi khối gỗ/nệm/vải (đọc từ
 * 4 file sổ ngày 07/09/2026). Khác với `warehouse_materials.group_name` — nhóm
 * của KHO, dùng để xếp kệ và chọn mẫu đơn, quá thô để chia bảng kê: một lệnh
 * 107 mã thì 66 mã dồn vào đúng một nhóm "Bu lông - vít - đinh - liên kết".
 *
 * Độ phủ đo 07/09/2026: 100% dòng định mức có `group_code`.
 *
 * Nhãn lấy đúng chữ đang dùng ở màn định hình (`DinhHinhScreen`) và tiêu đề
 * khối của biểu mẫu định mức (`part-layouts.ts`) — ba chỗ gọi khác nhau cùng
 * một loại thì người đọc tưởng là ba thứ.
 */

export const PART_GROUP_LABEL: Record<string, string> = {
  FRAME: 'Khung sắt/nhôm',
  WOOD: 'Gỗ',
  PANEL: 'Tấm',
  POLYWOOD: 'Polywood',
  NGU_KIM: 'Ngũ kim',
  // Hồ sơ cũ dùng HARDWARE cho cùng một thứ — gộp về một nhãn, đừng đẻ khối thứ hai.
  HARDWARE: 'Ngũ kim',
  CUSHION: 'Nệm',
  FABRIC: 'Vải',
  RATTAN: 'Mây/đan',
  DAY_DAN: 'Dây đan',
  SON_HC: 'Sơn & hoá chất',
  PACKAGING: 'Bao bì',
  LABEL: 'Tem nhãn',
  ZIPPER: 'Dây kéo',
  OTHER: 'Khác',
}

/**
 * Thứ tự bày khối trên bảng kê: đi từ RUỘT sản phẩm ra ngoài — khung, rồi phần
 * thô (gỗ/tấm), rồi thứ lắp vào (ngũ kim), rồi phần mềm (nệm/vải/dây), rồi sơn,
 * cuối cùng là thứ bọc ngoài (bao bì, tem). Cùng trật tự với biểu mẫu định mức
 * nên người đã quen tờ giấy không phải học lại.
 */
export const PART_GROUP_ORDER: string[] = [
  'FRAME',
  'WOOD',
  'PANEL',
  'POLYWOOD',
  'NGU_KIM',
  'HARDWARE',
  'CUSHION',
  'FABRIC',
  'RATTAN',
  'DAY_DAN',
  'SON_HC',
  'PACKAGING',
  'LABEL',
  'ZIPPER',
  'OTHER',
]

/** Nhãn tiếng Việt của một mã loại; mã lạ thì trả về chính nó, không nuốt. */
export function partGroupLabel(code: string | null | undefined): string | null {
  if (!code) return null
  const k = code.trim().toUpperCase()
  if (!k) return null
  return PART_GROUP_LABEL[k] ?? k
}

/**
 * Khoá xếp thứ tự khối. Loại không nằm trong bảng thứ tự (mã lạ, hoặc dòng chỉ
 * có nhóm kho) rơi xuống cuối chứ không chen vào giữa.
 */
export function partGroupRank(code: string | null | undefined): number {
  if (!code) return PART_GROUP_ORDER.length + 1
  const i = PART_GROUP_ORDER.indexOf(code.trim().toUpperCase())
  return i < 0 ? PART_GROUP_ORDER.length : i
}
