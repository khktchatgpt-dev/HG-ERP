/**
 * SỨC KHOẺ ĐỊNH MỨC — chấm từng dòng BOM xem có dùng được để mua/tính giá chưa.
 *
 * Luật ở đây KHÔNG mới: chép đúng `scripts/bom-derived-fix.mjs` (đợt vá 19/08)
 * và `bom-calc.ts`. Cố ý vậy — script dò tay và màn hình phải nói CÙNG một con
 * số, không thì Kỹ thuật sửa theo màn rồi chạy script lại thấy khác, và mất
 * lòng tin vào cả hai. Sửa ngưỡng ở đây thì sửa cả script.
 *
 * Thuần tính toán, không đụng DB, để test được — đây là số đi vào quyết định
 * mua hàng và giá thành.
 */
import { calcPartDerived, deviation, type PartGeometry } from './bom-calc'

/** Tiết diện RỖNG. `crossSectionM2` coi thiếu δ là ĐẶC → kg sai tới ~8,6 lần. */
export const HOLLOW_SHAPES = ['HOP', 'TRON', 'VUONG'] as const

/**
 * Ngưỡng coi là "người nhập lệch hình học". 15% lấy từ `bom-derived-fix.mjs`:
 * dưới mức đó phần lớn là sai số làm tròn / bo mép, không đáng gọi người ta ra
 * sửa. Chỉ so khi dòng ĐÃ đủ δ — thiếu δ thì số hình học mới là số sai.
 */
export const KG_DEVIATION_LIMIT = 0.15

export const BOM_ISSUES = [
  'thieu_sl',
  'thieu_delta',
  'thieu_dan_xuat',
  'lech_kg',
] as const
export type BomIssue = (typeof BOM_ISSUES)[number]

export const BOM_ISSUE_LABEL: Record<BomIssue, string> = {
  thieu_sl: 'Thiếu số lượng',
  thieu_delta: 'Thiếu độ dày thành (δ)',
  thieu_dan_xuat: 'Trống số dẫn xuất',
  lech_kg: 'Khối lượng lệch hình học',
}

/** Vì sao mỗi lỗi là lỗi — hiện ở tooltip, để người sửa không phải đoán. */
export const BOM_ISSUE_WHY: Record<BomIssue, string> = {
  thieu_sl:
    'Không có SL thì không ra được tổng dài, kg hay m³ — dòng vô dụng khi đi mua.',
  thieu_delta:
    'Ống/hộp không khai độ dày thành bị tính như thanh ĐẶC, kg vọt lên nhiều lần.',
  thieu_dan_xuat:
    'Đủ dữ liệu hình học nhưng ô kết quả còn trống — bảng tự ẩn cột, thẻ tổng hợp ra rỗng.',
  lech_kg: `Số nhập lệch số tính trên ${Math.round(KG_DEVIATION_LIMIT * 100)}% — một trong hai sai, phải người xem.`,
}

/** Ô kết quả do `calcPartDerived` sinh — trống mà tính được nghĩa là đang nợ. */
const DERIVED_KEYS = [
  'total_length_m',
  'weight_kg',
  'paint_area_m2',
  'volume_m3',
] as const

export type HealthPart = PartGeometry & {
  profile_shape?: string | null
  total_length_m?: number | null
  weight_kg?: number | null
  paint_area_m2?: number | null
  volume_m3?: number | null
}

/** Ống rỗng chưa khai δ — vừa là lỗi, vừa là lý do KHÔNG đem kg ra so lệch. */
export function isHollowWithoutWall(p: HealthPart): boolean {
  const shape = (p.profile_shape ?? '') as (typeof HOLLOW_SHAPES)[number]
  return HOLLOW_SHAPES.includes(shape) && p.wall_thickness_mm == null
}

/**
 * Chấm MỘT dòng định mức. Trả danh sách lỗi (rỗng = dòng sạch).
 *
 * Thứ tự có ý nghĩa: `thieu_sl` đứng trước vì thiếu SL thì mọi ô dẫn xuất đều
 * không tính được — báo thêm `thieu_dan_xuat` chỉ là nhiễu, người sửa vẫn chỉ
 * cần điền đúng một ô.
 */
export function classifyPart(p: HealthPart): BomIssue[] {
  const issues: BomIssue[] = []
  const hollowNoWall = isHollowWithoutWall(p)

  if (p.qty == null) issues.push('thieu_sl')
  if (hollowNoWall) issues.push('thieu_delta')

  // Thiếu SL thì `calcPartDerived` trả null hết — không có gì để so.
  if (p.qty == null) return issues

  const d = calcPartDerived(p)

  // Ô nào TÍNH ĐƯỢC mà đang trống thì là nợ. Ô tính không ra (không đủ hình
  // học) KHÔNG tính là nợ — nhiều nhóm (ngũ kim, bao bì) vốn không có kg/m³.
  const owed = DERIVED_KEYS.some((k) => {
    // Ống thiếu δ: kg hình học là số SAI, đừng đòi điền vào.
    if (k === 'weight_kg' && hollowNoWall) return false
    return d[k] != null && p[k] == null
  })
  if (owed) issues.push('thieu_dan_xuat')

  if (!hollowNoWall && p.weight_kg != null && d.weight_kg != null) {
    const off = deviation(p.weight_kg, d.weight_kg)
    if (off != null && off > KG_DEVIATION_LIMIT) issues.push('lech_kg')
  }

  return issues
}

export type ProductHealth = {
  /** Số dòng định mức. 0 = hồ sơ chưa có BOM. */
  parts: number
  /** Số dòng có ÍT NHẤT một lỗi. */
  dirtyParts: number
  /** Đếm theo từng loại lỗi — một dòng có thể góp vào nhiều ô. */
  counts: Record<BomIssue, number>
  /** 0–100. 100 = sạch. Hồ sơ chưa có BOM tính 0, không phải 100. */
  score: number
}

const zeroCounts = (): Record<BomIssue, number> => ({
  thieu_sl: 0,
  thieu_delta: 0,
  thieu_dan_xuat: 0,
  lech_kg: 0,
})

/**
 * Gộp điểm sức khoẻ của một hồ sơ SP.
 *
 * Hồ sơ 0 dòng được điểm 0 chứ không phải 100: "chưa nhập gì" là trạng thái tệ
 * nhất để đi mua hàng, cho nó điểm tuyệt đối thì nó tụt xuống cuối danh sách
 * cần làm — đúng chỗ không ai nhìn.
 */
export function summarizeProduct(parts: HealthPart[]): ProductHealth {
  const counts = zeroCounts()
  let dirtyParts = 0

  for (const p of parts) {
    const issues = classifyPart(p)
    if (issues.length) dirtyParts++
    for (const i of issues) counts[i]++
  }

  const score =
    parts.length === 0
      ? 0
      : Math.round((100 * (parts.length - dirtyParts)) / parts.length)

  return { parts: parts.length, dirtyParts, counts, score }
}
