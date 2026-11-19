import ExcelJS from 'exceljs'
import { chuan, docNgay } from '@/lib/dan-so'
import { docSo, laSoSai } from '@/lib/so-o-luoi'

/**
 * ĐỌC FILE MẪU NHẬP LIỆU đã điền (bản vẽ v2, 19/11/2026) — thuần, không chạm DB.
 * Tin MÃ KHOÁ ở ô F2 của mỗi tờ (`LSX:<id>|CD:<mã>|v1`), không tin tên tờ. Cột cố định 1–6
 * (Mã SP · Cụm · Chi tiết · CT/SP · Cần · Đã làm), từ cột 7 là ngày (hàng 4). Ô tổ ở H1.
 * Cần / Đã làm bỏ qua (chỉ để đối chiếu). Ô ngày có sẵn số của hệ thống cứ để nguyên — lúc xem
 * trước nó thành "trùng" và bị bỏ qua.
 */
export type TaiLenTo = {
  ten_to: string
  stage: string
  /** Tên tổ ở ô H1 (rỗng nếu thống kê chưa chọn). */
  to_ten: string
  cot: string[]
  rows: {
    hang: number
    cum: string
    ten: string
    ma_sp: string | null
    ct_sp: number | null
    o: Record<string, number>
    sai: { iso: string; raw: string }[]
  }[]
}

export type TaiLen = {
  lsx_id: string | null
  to: TaiLenTo[]
  /** Tờ không đọc được (không phải file mẫu, thiếu mã khoá…) — báo người dùng thay vì lặng lẽ bỏ. */
  bo_qua: { ten_to: string; ly_do: string }[]
}

const KHOA = /^LSX:([0-9a-f-]{36})\|CD:([a-z0-9_]+)\|v(\d+)$/i

const chuoi = (v: ExcelJS.CellValue | undefined): string => {
  if (v == null) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  if (typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: unknown }
    if (o.richText)
      return o.richText
        .map((t) => t.text)
        .join('')
        .trim()
    if (o.result != null) return chuoi(o.result as ExcelJS.CellValue)
    if (o.text != null) return String(o.text).trim()
    return ''
  }
  return String(v).trim()
}

export function docFileMau(wb: ExcelJS.Workbook, nam: number): TaiLen {
  const out: TaiLen = { lsx_id: null, to: [], bo_qua: [] }
  for (const ws of wb.worksheets) {
    if (ws.name.startsWith('_')) continue
    const m = KHOA.exec(chuoi(ws.getCell('F2').value))
    if (!m) {
      out.bo_qua.push({
        ten_to: ws.name,
        ly_do: 'Không có mã khoá ở ô F2 — không phải tờ của file mẫu',
      })
      continue
    }
    if (out.lsx_id && out.lsx_id !== m[1]) {
      out.bo_qua.push({
        ten_to: ws.name,
        ly_do: 'Thuộc lệnh khác với các tờ còn lại của file',
      })
      continue
    }
    out.lsx_id = m[1]

    // Cột ngày: hàng 4 từ cột 7; ô ngày đọc được (chữ dd/mm/yyyy hoặc ngày thật của Excel).
    const hr = ws.getRow(4)
    const cot: { col: number; iso: string }[] = []
    for (let c = 7; c <= ws.columnCount; c++) {
      const raw = hr.getCell(c).value
      const iso =
        raw instanceof Date ? raw.toISOString().slice(0, 10) : docNgay(chuoi(raw), nam)
      if (iso) cot.push({ col: c, iso })
    }
    if (cot.length === 0) {
      out.bo_qua.push({ ten_to: ws.name, ly_do: 'Không thấy cột ngày ở hàng 4' })
      continue
    }

    const rows: TaiLenTo['rows'] = []
    for (let r = 5; r <= ws.rowCount; r++) {
      const row = ws.getRow(r)
      const ten = chuoi(row.getCell(3).value)
      const o: Record<string, number> = {}
      const sai: { iso: string; raw: string }[] = []
      for (const { col, iso } of cot) {
        const cell = row.getCell(col).value
        const raw = chuoi(cell)
        if (raw === '') continue
        const n = typeof cell === 'number' ? cell : docSo(raw)
        if (laSoSai(raw) && typeof cell !== 'number') sai.push({ iso, raw })
        else if (n == null || n < 0) sai.push({ iso, raw })
        else if (n > 0) o[iso] = n
      }
      const coSo = Object.keys(o).length > 0 || sai.length > 0
      if (!coSo) continue
      if (!ten) continue // có số mà không có tên chi tiết: bỏ (dòng trống do người dùng gõ nhầm)
      const ctRaw = row.getCell(4).value
      const ct = typeof ctRaw === 'number' ? ctRaw : docSo(chuoi(ctRaw))
      rows.push({
        hang: r,
        cum: chuoi(row.getCell(2).value),
        ten,
        ma_sp: chuoi(row.getCell(1).value) || null,
        ct_sp: ct != null && ct > 0 ? ct : null,
        o,
        sai,
      })
    }
    out.to.push({
      ten_to: ws.name,
      stage: m[2].toLowerCase(),
      to_ten: chuoi(ws.getCell('H1').value),
      cot: cot.map((c) => c.iso),
      rows,
    })
  }
  return out
}

/** Tên tổ trong file → id tổ sản xuất (không phân biệt hoa thường / dấu). */
export function timTo(ten: string, ds: { id: string; name: string }[]): string | null {
  const k = chuan(ten)
  return k ? (ds.find((d) => chuan(d.name) === k)?.id ?? null) : null
}
