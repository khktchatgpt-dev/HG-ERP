import ExcelJS from 'exceljs'
import { poStatusLabel } from '@/lib/po-status'
import type { TgKetQua } from '@/lib/tra-gia'
import { gomTheoNcc, type PhuongAn } from '@/lib/tra-gia-chon'
import {
  applyWidths,
  dateCell,
  finishTable,
  headerRow,
  noteRow,
  numberCells,
  numberCols,
  stampWorkbook,
  titleRow,
  totalRow,
  dateCols,
} from './excel-kit'

/**
 * FILE EXCEL "TRA GIÁ VẬT TƯ" (28/10/2026, bước 3) — bảng so sánh báo giá để
 * trình duyệt, theo ĐÚNG NCC người mua đang chọn trên màn.
 *
 *   1. So sánh giá  — mỗi món một dòng, NCC xếp rẻ → đắt sang phải, NCC chọn +
 *                     thành tiền, ghi chú vì sao (đắt hơn rẻ nhất, giá hỏi…);
 *                     cuối tờ có dòng ký Người lập · TP Cung ứng · Giám đốc.
 *   2. Theo NCC     — câu ngược lại, đếm bằng `gomTheoNcc` như lưới trên màn.
 *   3. Chi tiết lần mua — nguồn của từng ô giá (đơn, ngày, mã VT của NCC, phép
 *                     quy đổi) để người duyệt kiểm lại được.
 *
 * Số chỉ đi qua `lib/tra-gia-chon` — file và màn là MỘT con số.
 */

const XANH = 'FFE5F3EA'
const CHU_XAM = 'FF6B7280'
const SO_NCC = 4

export type TraGiaExcelMon = {
  text: string
  /** Quy cách khớp, không có thì chữ người gõ. */
  nhan: string
  sl: number | null
  dvt: string | null
  /** Kết quả tra (+ mã danh mục đoán theo chữ khi món không khớp đơn nào — `TraGiaMon`). */
  kq: TgKetQua & { danh_muc?: { group_name: string | null } | null }
  ds: PhuongAn[]
  re: number | null
  dv: string | null
  chon: PhuongAn | null
  tien: number | null
}

export type TraGiaExcelInput = {
  mons: TraGiaExcelMon[]
  nguoiLap: string
  /** yyyy-mm-dd */
  ngayLap: string
  tuNgay: string | null
  denNgay: string
  soDong: number
}

const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
const pct = (x: number) =>
  `${(x * 100).toLocaleString('vi-VN', { maximumFractionDigits: x < 0.01 ? 2 : 1 })}%`

/** Ghi chú của một món trên tờ 1 — nói vì sao, để người duyệt khỏi phải hỏi lại. */
export function ghiChuMon(m: TraGiaExcelMon): string {
  const kq = m.kq
  const c = m.chon
  const ra: string[] = []
  if (kq.trang_thai === 'mo_ho')
    ra.push(`Chưa chọn quy cách — khớp ${kq.so_ung_vien}: ${kq.ung_vien.map((u) => u.label).join(' / ')}`) // prettier-ignore
  else if (c?.tham_khao)
    ra.push(`Chưa mua quy cách này — giá tham khảo cùng loại “${kq.goi_y_theo ?? ''}”`)
  else if (!c && kq.goi_y.length)
    ra.push(`Chưa mua — NCC cùng loại: ${kq.goi_y.map((g) => g.supplier_name).join(', ')}`)
  else if (!c)
    ra.push(`Chưa có giá${kq.danh_muc?.group_name ? ` (nhóm ${kq.danh_muc.group_name})` : ''}`) // prettier-ignore
  if (c?.nguon === 'hoi')
    ra.push(`Giá hỏi ${dmy(c.hoi!.at)}${c.hoi!.ghi_chu ? `: ${c.hoi!.ghi_chu}` : ''}`)
  if (c?.so_duoc && m.re != null && c.gia > m.re)
    ra.push(`Đắt hơn rẻ nhất ${pct(c.gia / m.re - 1)}`)
  const soDuoc = m.ds.filter((p) => p.so_duoc).length
  if (c && !c.tham_khao && soDuoc === 1) ra.push('Mới 1 NCC — chưa so được')
  if (soDuoc > SO_NCC) ra.push(`+${soDuoc - SO_NCC} NCC nữa ở tờ “Chi tiết lần mua”`)
  return ra.join(' · ')
}

/** Tờ 1 — SO SÁNH GIÁ. */
function toSoSanh(wb: ExcelJS.Workbook, x: TraGiaExcelInput): void {
  const ws = wb.addWorksheet('So sánh giá')
  const cols = [
    'STT',
    'Món (quy cách)',
    'Bạn gõ',
    'SL',
    'ĐVT',
    'Đ/v giá',
    ...Array.from({ length: SO_NCC }, (_, i) => [`NCC ${i + 1}`, `Giá ${i + 1}`]).flat(),
    'NCC chọn',
    'Đơn giá chọn',
    'Thành tiền',
    'Ghi chú',
  ]
  applyWidths(ws, [5, 32, 22, 10, 7, 8, ...Array(SO_NCC).fill([22, 11]).flat(), 24, 12, 14, 46]) // prettier-ignore
  titleRow(ws, 'BẢNG SO SÁNH GIÁ VẬT TƯ')
  const ky = x.tuNgay ? `${dmy(x.tuNgay)} – ${dmy(x.denNgay)}` : 'mọi lúc'
  noteRow(ws, `Ngày lập: ${dmy(x.ngayLap)} · Người lập: ${x.nguoiLap} · Giá lấy từ đơn mua Đã duyệt trở đi, ${ky} (${x.soDong.toLocaleString('vi-VN')} dòng đơn) · giá chưa VAT`) // prettier-ignore
  noteRow(ws, 'Ô nền xanh = NCC đang chọn. Nhôm, thép quy về đ/kg (cả dòng mua theo cây). Nguồn từng giá ở tờ “Chi tiết lần mua”.') // prettier-ignore
  const head = headerRow(ws, cols)
  const cNccChon = 7 + SO_NCC * 2
  const cTien = cNccChon + 2
  numberCols(ws, [4, ...Array.from({ length: SO_NCC }, (_, i) => 8 + i * 2), cNccChon + 1, cTien]) // prettier-ignore

  let tong = 0
  x.mons.forEach((m, i) => {
    const xep = m.ds.filter((p) => p.so_duoc).slice(0, SO_NCC)
    const o: ExcelJS.CellValue[] = [i + 1, m.nhan, m.text, m.sl, m.dvt ?? m.dv ?? '', m.dv ? `đ/${m.dv}` : ''] // prettier-ignore
    for (let k = 0; k < SO_NCC; k++) o.push(xep[k]?.ten ?? null, xep[k] ? Math.round(xep[k].gia) : null) // prettier-ignore
    const c = m.chon
    o.push(c ? `${c.ten}${c.tham_khao ? ' (tham khảo)' : ''}` : '', c ? Math.round(c.gia) : null, m.tien, ghiChuMon(m)) // prettier-ignore
    if (m.tien != null) tong += m.tien
    const r = ws.addRow(o)
    r.getCell(2).font = { bold: true }
    r.getCell(3).font = { color: { argb: CHU_XAM }, size: 10 }
    r.getCell(cNccChon + 3).alignment = { wrapText: true, vertical: 'top' }
    const k = c ? xep.findIndex((p) => p.key === c.key) : -1
    if (k >= 0)
      for (const col of [7 + k * 2, 8 + k * 2])
        r.getCell(col).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: XANH },
        }
    if (c?.tham_khao)
      r.getCell(cNccChon).font = { italic: true, color: { argb: CHU_XAM } }
  })
  const cuoi = ws.rowCount
  numberCells(ws, [4], { from: head.number + 1, to: cuoi })
  finishTable(ws, { head, lastRow: cuoi, freezeCols: 2 })
  totalRow(ws, 'Tổng cộng (chưa VAT) — không gồm món chưa có giá chốt và giá tham khảo', { [cTien]: tong }) // prettier-ignore

  // Dòng ký — chỉ khi đem trình (câu Q5 bản vẽ). Ba ô cách đều trên bề ngang bảng.
  ws.addRow([])
  const ky1 = ws.addRow([])
  const vt = [2, 9, cNccChon]
  ;['NGƯỜI LẬP', 'TRƯỞNG PHÒNG CUNG ỨNG', 'GIÁM ĐỐC'].forEach((t, i) => {
    ky1.getCell(vt[i]).value = t
    ky1.getCell(vt[i]).font = { bold: true }
    ky1.getCell(vt[i]).alignment = { horizontal: 'center' }
  })
  const ky2 = ws.addRow([])
  for (const c of vt) {
    ky2.getCell(c).value = '(Ký, ghi rõ họ tên)'
    ky2.getCell(c).font = { italic: true, size: 9, color: { argb: CHU_XAM } }
    ky2.getCell(c).alignment = { horizontal: 'center' }
  }
  ws.addRow([])
  ws.addRow([])
  ws.addRow([])
  const ten = ws.addRow([])
  ten.getCell(2).value = x.nguoiLap
  ten.getCell(2).alignment = { horizontal: 'center' }
}

/** Tờ 2 — THEO NHÀ CUNG CẤP. */
function toTheoNcc(wb: ExcelJS.Workbook, x: TraGiaExcelInput): void {
  const ws = wb.addWorksheet('Theo NCC')
  applyWidths(ws, [5, 34, 10, 10, 10, 48, 48, 12, 16])
  titleRow(ws, 'THEO NHÀ CUNG CẤP — các món trong danh sách')
  noteRow(ws, 'Một NCC bán được bao nhiêu món, rẻ nhất ở mấy món, các món đang chọn họ thành bao nhiêu tiền. Không gồm giá tham khảo và đơn nháp.') // prettier-ignore
  const head = headerRow(ws, ['STT', 'Nhà cung cấp', 'Món có giá', 'Rẻ nhất ở', 'Đang chọn', 'Các món đang chọn', 'Các món khác có giá', 'Lần gần nhất', 'Tiền các món đang chọn']) // prettier-ignore
  numberCols(ws, [3, 4, 5, 9])
  dateCols(ws, [8])
  const rows = gomTheoNcc(x.mons)
  rows.forEach((h, i) => {
    const r = ws.addRow([
      i + 1,
      h.id ? h.ten : `${h.ten} (giá hỏi)`,
      h.mon.length,
      h.re,
      h.chon.length,
      h.chon.join(' · '),
      h.mon.filter((m) => !h.chon.includes(m)).join(' · '),
      dateCell(h.last),
      h.tien,
    ])
    for (const c of [6, 7]) r.getCell(c).alignment = { wrapText: true, vertical: 'top' }
    if (h.chon.length) r.getCell(2).font = { bold: true }
  })
  finishTable(ws, { head, lastRow: ws.rowCount, freezeCols: 2 })
  totalRow(ws, `Cộng ${rows.length} NCC`, { 9: rows.reduce((s, h) => s + h.tien, 0) })
}

const NGUON = (p: PhuongAn): string =>
  p.nguon === 'hoi'
    ? 'Giá hỏi'
    : p.nguon === 'goi_y'
      ? 'Tham khảo cùng loại'
      : p.ncc?.chot
        ? 'Đơn mua'
        : 'Đơn nháp (chưa chốt)'

/** Tờ 3 — CHI TIẾT LẦN MUA: nguồn của từng ô giá. */
function toChiTiet(wb: ExcelJS.Workbook, x: TraGiaExcelInput): void {
  const ws = wb.addWorksheet('Chi tiết lần mua')
  applyWidths(ws, [6, 30, 32, 18, 12, 8, 26, 11, 15, 13, 26, 40, 9])
  titleRow(ws, 'CHI TIẾT LẦN MUA — nguồn của từng giá')
  noteRow(ws, 'Mỗi NCC lấy lần mua CHỐT gần nhất trong kỳ; NCC chỉ có đơn nháp thì ghi rõ. Giá hỏi chỉ nằm trong file này, không lưu ở hệ thống.') // prettier-ignore
  const head = headerRow(ws, ['Món số', 'Món (quy cách)', 'Nhà cung cấp', 'Nguồn', 'Giá', 'Đ/v giá', 'Quy đổi', 'Ngày', 'Đơn mua', 'Trạng thái đơn', 'Mã VT của NCC', 'Tên trên đơn / ghi chú', 'Đang chọn']) // prettier-ignore
  numberCols(ws, [5])
  dateCols(ws, [8])
  x.mons.forEach((m, i) => {
    for (const p of m.ds) {
      const n = p.ncc
      const q = n?.quy
      ws.addRow([
        i + 1,
        m.nhan,
        p.ten,
        NGUON(p),
        Math.round(p.gia),
        `đ/${p.dv}`,
        q ? `${Math.round(q.gia_goc).toLocaleString('vi-VN')} đ/${q.dv_goc} ÷ ${q.moi.toLocaleString('vi-VN', { maximumFractionDigits: 3 })} ${q.dv_moi}/${q.dv_goc}` : '', // prettier-ignore
        dateCell(n?.at ?? p.hoi?.at ?? p.goi_y?.at ?? null),
        n?.po_code ?? '',
        n ? poStatusLabel(n.status) : '',
        n?.ma.join(', ') ?? '',
        n?.ten ??
          p.hoi?.ghi_chu ??
          (p.goi_y ? `cỡ đã mua: ${p.goi_y.mau.join(' · ')}` : ''),
        m.chon?.key === p.key ? '✓' : '',
      ])
    }
    // NCC cùng loại không kèm giá (món theo cái) — vẫn ghi để người mua biết gọi ai.
    if (m.kq.trang_thai === 'moi')
      for (const g of m.kq.goi_y.filter((g) => g.gia == null))
        ws.addRow([i + 1, m.nhan, g.supplier_name, 'NCC cùng loại (không giá)', null, '', '', dateCell(g.at), '', '', '', `đã bán: ${g.mau.join(' · ')}`, '']) // prettier-ignore
  })
  finishTable(ws, { head, lastRow: ws.rowCount, freezeCols: 3 })
}

export async function buildTraGiaExcel(x: TraGiaExcelInput): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  stampWorkbook(wb, 'Bảng so sánh giá vật tư')
  toSoSanh(wb, x)
  toTheoNcc(wb, x)
  toChiTiet(wb, x)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

export const traGiaExcelFilename = (ngay: string) => `Tra-gia-vat-tu_${dmy(ngay).replace(/\//g, '-')}.xlsx` // prettier-ignore
