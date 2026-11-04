import ExcelJS from 'exceljs'
import { quyCach } from '@/lib/bom-chua-ma'
import { partGroupLabel, partGroupRank } from '@/lib/part-groups'
import type { LsxBomNeeds } from './lsx-bom-needs.repo'
import { aiGo } from './lsx-bang-ke-excel'
import {
  NUM_FMT_LE,
  applyWidths,
  finishTable,
  groupRow,
  headerRow,
  noteRow,
  stampWorkbook,
  titleRow,
} from './excel-kit'

/**
 * EXCEL ĐỊNH MỨC THEO SP CỦA LỆNH (04/11/2026, bản vẽ GTwUMER4sxSA8dHyZb8uRN, B2).
 *
 * Cung ứng cầm định mức của CẢ lệnh trong một file thay vì mở từng hồ sơ SP:
 *   Tổng hợp     · gom theo MÃ VẬT TƯ, cần cho cả lệnh (ĐV mua) + SP nào dùng.
 *                  Cùng nguồn số với bảng kê (`lsxBomNeeds`) — hai file không
 *                  được nói khác nhau về cùng một mã.
 *   Chưa gắn mã  · dòng định mức chưa có mã kho (hoặc mã lạ) + dòng chưa quy
 *                  đổi được ĐV mua. Đặt NGAY sau Tổng hợp: lệnh 13 MX có 229/273
 *                  dòng chưa mã (đo 04/11), để cuối 8 tờ SP là không ai thấy.
 *   <mã SP>      · mỗi SP một tờ: mọi dòng định mức NHƯ KỸ THUẬT GHI trên hồ sơ
 *                  (đơn vị của dòng, chưa quy đổi), gom theo khối khung · gỗ ·
 *                  ngũ kim · bao bì…; Cần = ĐM/SP × SL lệnh là CÔNG THỨC.
 *
 * Đọc ĐỊNH MỨC ĐANG LƯU trên hồ sơ SP × SL dòng lệnh — không đọc file BOM gốc.
 * Thuần: nhận dữ liệu đã nạp, không chạm DB.
 */

export type DmProduct = {
  id: string
  code: string
  name: string
  qty: number
  unit: string
  /** Kỹ thuật đã kiểm BOM (`bom_checked_at`) hoặc hồ sơ đã khoá. */
  confirmed: boolean
}

export type DmPart = {
  product_id: string
  group_code: string | null
  part_name: string | null
  material_code: string | null
  /** Tên trong danh mục kho; null = chưa gắn mã hoặc mã không có trong danh mục. */
  material_name: string | null
  material_note: string | null
  /** "Nhôm hộp dày 1" từ hệ vật liệu + dạng profile — cho dòng chưa gắn mã. */
  vat_lieu?: string | null
  dims: (number | null)[]
  unit: string | null
  qty: number | null
}

export type DinhMucData = {
  lsx: { code: string; customer_name: string; ship_date: string | null }
  products: DmProduct[]
  parts: DmPart[]
  needs: Pick<LsxBomNeeds, 'lines' | 'blocked' | 'chua_ma'>
}

const RED = 'FFB42318'
const fmtD = (d: string | null) =>
  d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('vi-VN') : '—'
const vn = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 3 })

/** Tên sheet Excel: bỏ ký tự cấm, tối đa 31 ký tự, không trùng (không phân biệt hoa/thường). */
export function tenSheet(raw: string, used: Set<string>): string {
  const base = (
    raw
      .replace(/[[\]:*?/\\]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^'+|'+$/g, '') || 'SP'
  ).slice(0, 31)
  let name = base
  for (let n = 2; used.has(name.toLowerCase()); n++) {
    const suffix = ` (${n})`
    name = base.slice(0, 31 - suffix.length) + suffix
  }
  used.add(name.toLowerCase())
  return name
}

/** Gom định mức đã quy đổi theo vật tư cho cả lệnh — tờ Tổng hợp. */
export function tongHopTheoMa(lines: LsxBomNeeds['lines']) {
  const by = new Map<
    string,
    {
      code: string
      name: string
      unit: string
      kind: string | null
      total: number
      products: { code: string; qty: number; per: number }[]
      unconfirmed: boolean
    }
  >()
  for (const l of lines) {
    let cur = by.get(l.material_id)
    if (!cur) {
      cur = {
        code: l.material_code,
        name: l.material_name,
        unit: l.unit,
        kind: l.kind,
        total: 0,
        products: [],
        unconfirmed: false,
      }
      by.set(l.material_id, cur)
    }
    cur.total = Math.round((cur.total + l.qty_needed) * 10_000) / 10_000
    cur.products.push({ code: l.product_code, qty: l.product_qty, per: l.qty_per_unit })
    if (!l.bom_confirmed) cur.unconfirmed = true
  }
  return [...by.values()].sort(
    (a, b) =>
      partGroupRank(a.kind) - partGroupRank(b.kind) || a.code.localeCompare(b.code, 'vi'),
  )
}

function rightNum(row: ExcelJS.Row, cols: number[]) {
  for (const c of cols) {
    row.getCell(c).numFmt = NUM_FMT_LE
    row.getCell(c).alignment = { horizontal: 'right', vertical: 'top' }
  }
}

function wrap(row: ExcelJS.Row, cols: number[]) {
  for (const c of cols) row.getCell(c).alignment = { wrapText: true, vertical: 'top' }
}

function byKind<T extends { kind: string | null }>(items: T[]) {
  const m = new Map<string, T[]>()
  for (const it of items) {
    const k = it.kind?.trim().toUpperCase() || ''
    m.set(k, [...(m.get(k) ?? []), it])
  }
  return [...m.entries()].sort((a, b) => partGroupRank(a[0]) - partGroupRank(b[0]))
}

export async function buildDinhMucExcel(d: DinhMucData, today: string): Promise<Buffer> {
  const { lsx, products, parts, needs } = d
  const wb = new ExcelJS.Workbook()
  stampWorkbook(wb, `Định mức theo SP — LSX ${lsx.code}`)
  const used = new Set<string>()
  const chuaKiem = products.filter((p) => !p.confirmed)
  const partsOf = new Map<string, DmPart[]>()
  for (const p of parts)
    partsOf.set(p.product_id, [...(partsOf.get(p.product_id) ?? []), p])

  // ── Tổng hợp ───────────────────────────────────────────────────────────
  const s0 = wb.addWorksheet(tenSheet('Tổng hợp', used))
  const C0 = 7
  applyWidths(s0, [5, 13, 40, 9, 14, 7, 60])
  titleRow(s0, `ĐỊNH MỨC THEO SP — LSX ${lsx.code} · ${lsx.customer_name}`)
  noteRow(
    s0,
    `Xuất ${fmtD(lsx.ship_date)} · lập ${fmtD(today)} · ${products.length} SP · định mức đang lưu trên hồ sơ SP × SL lệnh`,
  )
  noteRow(
    s0,
    'Cần = định mức/SP đã QUY ĐỔI sang ĐV mua × SL lệnh (cùng số với Bảng kê vật tư). Tờ từng SP ghi định mức đúng đơn vị Kỹ thuật ghi.',
  )
  if (chuaKiem.length)
    noteRow(
      s0,
      `Kỹ thuật CHƯA kiểm định mức ${chuaKiem.length}/${products.length} SP (${chuaKiem.map((p) => p.code).join(', ')}) — số để chuẩn bị, chưa phải số chốt. Mã dính SP đó ghi "chưa kiểm".`,
      'warn',
    )
  const nChuaMa = needs.chua_ma.items.length + needs.chua_ma.frame_lines
  if (nChuaMa || needs.blocked.length)
    noteRow(
      s0,
      `Còn ${needs.chua_ma.items.length} vật tư chưa gắn mã kho${needs.chua_ma.frame_lines ? ` + ${needs.chua_ma.frame_lines} dòng khung chưa mã` : ''}${needs.blocked.length ? ` + ${needs.blocked.length} dòng chưa quy đổi được ĐV mua` : ''} — KHÔNG có trong bảng dưới, xem tờ "Chưa gắn mã".`,
      'warn',
    )
  const h0 = headerRow(s0, [
    'STT',
    'Mã VT',
    'Tên vật tư',
    'ĐVT mua',
    'Cần cả lệnh',
    'Số SP',
    'SP dùng (SL lệnh × định mức/SP)',
  ])
  const tong = tongHopTheoMa(needs.lines)
  let stt = 0
  for (const [kind, items] of byKind(tong)) {
    groupRow(s0, `${partGroupLabel(kind) ?? 'Chưa phân loại'} · ${items.length} mã`, C0)
    for (const it of items) {
      const r = s0.addRow([
        ++stt,
        it.code,
        it.name,
        it.unit,
        it.total,
        it.products.length,
        it.products.map((p) => `${p.code} ×${vn(p.qty)} (${vn(p.per)}/SP)`).join(' · ') +
          (it.unconfirmed ? ' — chưa kiểm' : ''),
      ])
      rightNum(r, [5, 6])
      wrap(r, [3, 7])
      r.getCell(5).font = { bold: true }
    }
  }
  if (!tong.length) noteRow(s0, 'Chưa có dòng định mức nào gắn mã kho.', 'warn')
  finishTable(s0, { head: h0, freezeCols: 2 })

  // Danh sách SP nối cuối tờ — ghim đầu bảng mã ở trên nên không đặt lên đầu.
  s0.addRow([])
  titleRow(s0, 'SẢN PHẨM CỦA LỆNH', 11)
  const hp = headerRow(s0, [
    'STT',
    'Mã SP',
    'Tên',
    'ĐVT',
    'SL lệnh',
    'Dòng ĐM',
    'Kỹ thuật',
  ])
  products.forEach((p, i) => {
    const n = partsOf.get(p.id)?.length ?? 0
    const r = s0.addRow([
      i + 1,
      p.code,
      p.name,
      p.unit,
      p.qty,
      n,
      n === 0
        ? 'CHƯA CÓ ĐỊNH MỨC — chờ Kỹ thuật nạp'
        : p.confirmed
          ? 'đã kiểm'
          : 'chưa kiểm',
    ])
    rightNum(r, [5, 6])
    wrap(r, [3])
    if (n === 0 || !p.confirmed) r.getCell(7).font = { color: { argb: RED } }
  })
  hp.font = { bold: true, size: 10 }

  // ── Chưa gắn mã ────────────────────────────────────────────────────────
  const s1 = wb.addWorksheet(tenSheet('Chưa gắn mã', used))
  applyWidths(s1, [5, 32, 14, 18, 12, 8, 12, 50, 14])
  titleRow(s1, `ĐỊNH MỨC CHƯA GẮN MÃ KHO — LSX ${lsx.code}`)
  noteRow(
    s1,
    'Bảng kê và tờ Tổng hợp không tính được những dòng này. Có thể là vật tư MỚI (kho chưa có mã) hoặc chỉ là quên gắn mã — nhìn tên để biết đi đường nào.',
  )
  if (needs.chua_ma.frame_lines)
    noteRow(
      s1,
      `${needs.chua_ma.frame_lines} dòng KHUNG chưa mã không liệt kê ở đây (khung mua theo quy cách cắt, không theo tên) — xem trong tờ từng SP.`,
    )
  const h1 = headerRow(s1, [
    'STT',
    'Tên (như Kỹ thuật ghi)',
    'Quy cách',
    'Ghi chú VL',
    'Mã ghi sai',
    'ĐVT',
    'Cần cả lệnh',
    'SP dùng (SL lệnh × định mức/SP)',
    'Loại',
  ])
  stt = 0
  for (const it of needs.chua_ma.items) {
    const r = s1.addRow([
      ++stt,
      it.name + (it.aliases.length ? ` (còn ghi: ${it.aliases.join(', ')})` : ''),
      it.quy_cach,
      it.note,
      it.bad_code,
      it.unit,
      it.qty_total,
      it.products
        .map((p) => `${p.code} ×${vn(p.qty)} (${p.per == null ? '?' : vn(p.per)}/SP)`)
        .join(' · '),
      partGroupLabel(it.kind),
    ])
    rightNum(r, [7])
    wrap(r, [2, 4, 8])
    if (it.bad_code) r.getCell(5).font = { color: { argb: RED } }
  }
  if (!needs.chua_ma.items.length)
    noteRow(s1, 'Không có — mọi dòng định mức đã gắn mã kho.')
  finishTable(s1, { head: h1, freezeCols: 2 })

  if (needs.blocked.length) {
    s1.addRow([])
    titleRow(s1, `CHƯA QUY ĐỔI ĐƯỢC SANG ĐV MUA (${needs.blocked.length})`, 11)
    headerRow(s1, [
      'STT',
      'Vật tư',
      'Mã VT',
      'Mã SP',
      'Chi tiết',
      'ĐVT',
      '',
      'Vướng',
      'Ai gỡ',
    ])
    needs.blocked.forEach((b, i) => {
      const r = s1.addRow([
        i + 1,
        b.material_name,
        b.material_code,
        b.product_code,
        b.part_name,
        b.unit,
        null,
        b.reason,
        aiGo(b.reason),
      ])
      wrap(r, [2, 5, 8, 9])
    })
  }

  // ── Mỗi SP một tờ ──────────────────────────────────────────────────────
  const C2 = 10
  for (const p of products) {
    const ws = wb.addWorksheet(tenSheet(p.code || p.name, used))
    applyWidths(ws, [5, 26, 13, 34, 14, 18, 8, 10, 10, 12])
    titleRow(ws, `${p.code} — ${p.name}`)
    noteRow(
      ws,
      `LSX ${lsx.code} · SL lệnh ${vn(p.qty)} ${p.unit} · Kỹ thuật ${p.confirmed ? 'đã kiểm' : 'CHƯA kiểm'} định mức`,
      p.confirmed ? 'muted' : 'warn',
    )
    const rows = (partsOf.get(p.id) ?? []).map((x) => ({ ...x, kind: x.group_code }))
    if (!rows.length) {
      noteRow(ws, 'CHƯA CÓ ĐỊNH MỨC trên hồ sơ SP — chờ Kỹ thuật nạp BOM.', 'warn')
      continue
    }
    noteRow(
      ws,
      'Định mức đúng như Kỹ thuật ghi trên hồ sơ SP (đơn vị của dòng, chưa quy đổi ĐV mua). Cần = ĐM/SP × SL lệnh là công thức.',
    )
    const h = headerRow(ws, [
      'STT',
      'Chi tiết',
      'Mã VT',
      'Tên vật tư (danh mục kho / vật liệu)',
      'Quy cách',
      'Ghi chú VL',
      'ĐVT',
      'ĐM/SP',
      'SL lệnh',
      'Cần',
    ])
    let n = 0
    for (const [kind, items] of byKind(rows)) {
      groupRow(
        ws,
        `${partGroupLabel(kind) ?? 'Chưa phân loại'} · ${items.length} dòng`,
        C2,
      )
      for (const x of items) {
        const r = ws.addRow([
          ++n,
          x.part_name,
          x.material_code ?? 'chưa gắn mã',
          x.material_name ??
            (x.material_code
              ? `mã không có trong danh mục${x.vat_lieu ? ` · ${x.vat_lieu}` : ''}`
              : (x.vat_lieu ?? null)),
          quyCach(x.dims),
          x.material_note,
          x.unit,
          x.qty,
          p.qty,
          null,
        ])
        const rn = r.number
        r.getCell(10).value =
          x.qty == null
            ? null
            : {
                formula: `H${rn}*I${rn}`,
                result: Math.round(x.qty * p.qty * 10_000) / 10_000,
              }
        rightNum(r, [8, 9, 10])
        wrap(r, [2, 4, 6])
        r.getCell(10).font = { bold: true }
        if (!x.material_name) r.getCell(3).font = { color: { argb: RED } }
      }
    }
    finishTable(ws, { head: h, freezeCols: 3 })
  }

  return Buffer.from(await wb.xlsx.writeBuffer())
}
