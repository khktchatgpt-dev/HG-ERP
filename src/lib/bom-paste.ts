import { parseShape } from './bom-calc'

/**
 * Đọc một vùng dán từ Excel thành các dòng định mức nháp.
 *
 * Hai bố cục được nhận:
 *  - **Biểu mẫu BOM gốc** (≥ 12 cột) — dán trực tiếp từ file HG-QT-07/M02:
 *    Stt · Tên chi tiết · Loại · Dày · Rộng · Dài · Phí hao · Số lượng ·
 *    Tổng chiều dài · Trọng lượng · Diện tích sơn · Dày vật liệu · Ghi chú
 *  - **Gọn** (< 12 cột) — đúng thứ tự cột của lưới nhập:
 *    Tên · Loại · Dày(A) · Rộng(B) · Dày thành · Dài cắt · SL · ĐVT · Ghi chú
 *
 * Cột tính được (tổng dài, diện tích sơn) BỎ QUA — app tự tính lại từ hình học.
 * Trọng lượng thì GIỮ vì có thể là số theo bảng cân nhà cung cấp.
 */
export type DraftPart = {
  part_no: number | null
  part_name: string
  profile_shape: string | null
  dim_a_mm: number | null
  dim_b_mm: number | null
  wall_thickness_mm: number | null
  cut_length_mm: number | null
  qty: number | null
  unit: string | null
  weight_kg: number | null
  note: string | null
}

export type PasteResult = {
  rows: DraftPart[]
  /** Dòng bị bỏ và lý do — hiện cho người dán biết, không im lặng nuốt. */
  skipped: { line: number; text: string; reason: string }[]
  layout: 'bom-form' | 'compact'
}

const num = (v: string | undefined): number | null => {
  if (v == null) return null
  // Excel VN hay dùng dấu phẩy thập phân và dấu chấm phân nhóm nghìn.
  const s = v
    .replace(/\s/g, '')
    .replace(/\.(?=\d{3}\b)/g, '')
    .replace(',', '.')
  const cleaned = s.replace(/[^\d.-]/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}
const txt = (v: string | undefined): string | null => {
  const s = String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
  return s || null
}
const noAccent = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[đĐ]/g, 'd').toLowerCase()

/** Dòng tiêu đề hoặc dòng tổng — không phải chi tiết. */
function isNoise(cells: string[]): string | null {
  const joined = noAccent(cells.join(' ')).trim()
  if (!joined) return 'dòng trống'
  if (/^(stt|tt)\b/.test(joined) && /ten|chi tiet/.test(joined)) return 'dòng tiêu đề'
  if (/ten chi tiet/.test(joined)) return 'dòng tiêu đề'
  if (/^tong cong|^tong\b|^total\b/.test(joined)) return 'dòng tổng cộng'
  if (/^(day|rong|dai)\b/.test(joined) && cells.filter(Boolean).length <= 4)
    return 'dòng tiêu đề phụ'
  return null
}

export function parseBomPaste(text: string): PasteResult {
  const lines = String(text ?? '').split(/\r?\n/)
  // Tách theo Tab (Excel) — nếu không có Tab thì thử nhiều khoảng trắng / dấu ;
  const split = (l: string) =>
    l.includes('\t') ? l.split('\t') : l.includes(';') ? l.split(';') : l.split(/ {2,}/)

  const grids = lines.map(split)
  const widths = grids.filter((c) => c.filter(Boolean).length > 1).map((c) => c.length)
  const maxWidth = widths.length ? Math.max(...widths) : 0
  const layout: PasteResult['layout'] = maxWidth >= 12 ? 'bom-form' : 'compact'

  const rows: DraftPart[] = []
  const skipped: PasteResult['skipped'] = []

  grids.forEach((cells, i) => {
    const reason = isNoise(cells)
    if (reason) {
      if (cells.some(Boolean))
        skipped.push({ line: i + 1, text: cells.join(' | ').slice(0, 80), reason })
      return
    }

    const row: DraftPart =
      layout === 'bom-form'
        ? {
            part_no: num(cells[0]) != null ? Math.trunc(num(cells[0])!) : null,
            part_name: txt(cells[1]) ?? '',
            profile_shape: parseShape(cells[2]),
            dim_a_mm: num(cells[3]),
            dim_b_mm: num(cells[4]),
            cut_length_mm: num(cells[5]),
            qty: num(cells[7]),
            weight_kg: num(cells[9]),
            wall_thickness_mm: num(cells[11]),
            note: txt(cells[12]),
            unit: null,
          }
        : {
            part_no: null,
            part_name: txt(cells[0]) ?? '',
            profile_shape: parseShape(cells[1]),
            dim_a_mm: num(cells[2]),
            dim_b_mm: num(cells[3]),
            wall_thickness_mm: num(cells[4]),
            cut_length_mm: num(cells[5]),
            qty: num(cells[6]),
            unit: txt(cells[7]),
            note: txt(cells[8]),
            weight_kg: null,
          }

    if (!row.part_name) {
      skipped.push({
        line: i + 1,
        text: cells.join(' | ').slice(0, 80),
        reason: 'không có tên chi tiết',
      })
      return
    }
    rows.push(row)
  })

  return { rows, skipped, layout }
}
