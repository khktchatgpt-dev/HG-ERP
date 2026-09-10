import { MATERIAL_KIND_OPTIONS, SHAPE_OPTIONS } from '@/lib/bom-calc'
import { fmtMm } from './format'
import { specKey, type CutLine } from './types'

/**
 * ĐỊNH MỨC (BOM) → DÒNG QUY CẮT. Thuần, không DB — service chỉ lấy dữ liệu rồi
 * gọi vào đây, nên luật ánh xạ có test.
 *
 * Một dòng định mức thành một dòng cắt khi nó có `cut_length_mm` và `qty`:
 *  · chiều dài phôi = dài cắt + phi hao uốn (`bend_waste_mm`, cùng công thức
 *    tổng mét của `bom-calc`),
 *  · số lượng = định mức × số sản phẩm của đợt, làm tròn lên,
 *  · quy cách = vật liệu + dạng profile + tiết diện ("Nhôm hộp 20×40×1,2"),
 *    không có tiết diện thì lấy mã profile ("Sắt TD-HG04"),
 *  · cây tiêu chuẩn gợi ý = `bar_length_m` × 1000 nếu BOM có ghi.
 * Dòng không có dài cắt (ốc vít, nệm, bao bì…) bị bỏ và đếm vào `dropped`.
 */
export type BomPartForCut = {
  part_name: string
  group_code: string
  cluster_name?: string | null
  material_kind: string | null
  profile_shape: string | null
  profile_code: string | null
  dim_a_mm: number | null
  dim_b_mm: number | null
  wall_thickness_mm: number | null
  cut_length_mm: number | null
  bend_waste_mm: number | null
  bar_length_m: number | null
  qty: number | null
}

export type BomSpecSummary = {
  key: string
  spec: string
  /** Cây tiêu chuẩn BOM gợi ý (mm) — null nếu BOM không ghi `bar_length_m`. */
  stock_length_mm: number | null
  lines: number
  pieces: number
}

export type BomToCutResult = {
  lines: Omit<CutLine, 'key'>[]
  specs: BomSpecSummary[]
  /** Số dòng định mức không có dài cắt / SL — không phải chi tiết cắt phôi. */
  dropped: number
}

const MATERIAL_LABEL = Object.fromEntries(
  MATERIAL_KIND_OPTIONS.map((o) => [o.code, o.label]),
)
const SHAPE_LABEL = Object.fromEntries(
  SHAPE_OPTIONS.map((o) => [o.code, o.label.toLowerCase()]),
)

const pos = (v: number | null | undefined): v is number => typeof v === 'number' && v > 0

/** "Nhôm hộp 20×40×1,2" / "Sắt tròn 25×1,2" / "Sắt TD-HG04" / "" khi không có gì. */
export function specLabel(p: BomPartForCut): string {
  const mat = p.material_kind ? (MATERIAL_LABEL[p.material_kind] ?? p.material_kind) : ''
  const shape = p.profile_shape
    ? (SHAPE_LABEL[p.profile_shape] ?? p.profile_shape.toLowerCase())
    : ''
  const dims = [p.dim_a_mm, p.dim_b_mm, p.wall_thickness_mm]
    .filter(pos)
    .map((v) => fmtMm(v))
    .join('×')
  const section = dims || (p.profile_code ?? '')
  return [mat, shape, section].filter(Boolean).join(' ').trim()
}

export function bomToCutLines(
  parts: BomPartForCut[],
  qtyProducts: number,
  groupLabels: Record<string, string> = {},
): BomToCutResult {
  const n = Math.max(1, Math.ceil(qtyProducts))
  const lines: Omit<CutLine, 'key'>[] = []
  const specs = new Map<string, BomSpecSummary>()
  let dropped = 0
  for (const p of parts) {
    if (!pos(p.cut_length_mm) || !pos(p.qty)) {
      dropped += 1
      continue
    }
    const spec = specLabel(p)
    const key = specKey(spec)
    const length =
      Math.round((p.cut_length_mm + (pos(p.bend_waste_mm) ? p.bend_waste_mm : 0)) * 10) /
      10
    const qty = Math.ceil(p.qty * n)
    const note = [groupLabels[p.group_code] ?? p.group_code, p.cluster_name ?? '']
      .filter(Boolean)
      .join(' · ')
    lines.push({ part_name: p.part_name, length_mm: length, qty, spec, note })
    let s = specs.get(key)
    if (!s) {
      s = { key, spec, stock_length_mm: null, lines: 0, pieces: 0 }
      specs.set(key, s)
    }
    s.lines += 1
    s.pieces += qty
    if (s.stock_length_mm == null && pos(p.bar_length_m)) {
      s.stock_length_mm = Math.round(p.bar_length_m * 1000)
    }
  }
  return { lines, specs: [...specs.values()], dropped }
}
