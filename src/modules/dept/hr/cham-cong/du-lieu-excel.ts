import ExcelJS from 'exceljs'
import { tinhCoMat } from '@/lib/cham-cong/co-mat'
import type { DuLieu } from './cham-cong.service'

const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const thuIdx = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()

const NEN_DAU = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF3F5F8' },
} as const
const NEN_CN = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE9ECF1' },
} as const
const NEN_CAM = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFDF1E3' },
} as const
const NEN_DO = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFBECEB' },
} as const

/**
 * Excel bước ① Dữ liệu — HAI tờ, đúng hai cách xem trên màn (cùng `chamCongService.duLieu`
 * và cùng hàm `tinhCoMat`, nên số trong file = số trên màn):
 *   1. "Lượt quẹt": mỗi dòng một người một ngày, đủ mọi lượt — không tính công.
 *   2. "Có mặt theo tổ": số người có ít nhất 1 lượt mỗi ngày, theo tổ.
 */
export async function buildDuLieuExcel(d: DuLieu, homNay: string): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  luotQuet(wb, d)
  coMatTheoTo(wb, d, homNay)
  return Buffer.from(await wb.xlsx.writeBuffer())
}

function luotQuet(wb: ExcelJS.Workbook, d: DuLieu) {
  const ws = wb.addWorksheet('Lượt quẹt')
  ws.addRow([
    `Lượt quẹt từ máy chấm công · ${dmy(d.khoang.tu)} → ${dmy(d.khoang.den)} · chưa tính công`,
  ]).font = { bold: true }
  ws.addRow([])
  const head = ws.addRow([
    'Ngày',
    'Thứ',
    'Mã NV',
    'Họ tên',
    'Bộ phận',
    'Máy',
    'Số lượt',
    'Các lượt (giờ · máy)',
    'Để ý',
  ])
  head.font = { bold: true }
  head.eachCell((c) => (c.fill = NEN_DAU))
  for (const r of d.dong) {
    const may = [...new Set(r.luot.map((l) => l.may))]
    const de: string[] = []
    if (r.luot.length >= 3) de.push('nhiều đoạn')
    if (r.soLuotTho > r.luot.length) de.push(`bấm lặp ${r.soLuotTho - r.luot.length}`)
    if (may.length > 1) de.push('2 máy')
    if (!r.daGhep) de.push('mã chưa ghép người')
    const row = ws.addRow([
      dmy(r.ngay),
      THU[thuIdx(r.ngay)],
      r.ma,
      r.ten,
      r.boPhan ?? '',
      may.join(' '),
      r.luot.length,
      r.luot.map((l) => `${l.gio.slice(0, 5)} ${l.may}`).join(' · '),
      de.join(', '),
    ])
    if (thuIdx(r.ngay) === 0) row.getCell(2).fill = NEN_CN
  }
  ws.addRow([])
  ws.addRow([
    `${d.dong.length} dòng người-ngày · "Số lượt" đã gộp lượt bấm lặp trong 2 phút · bày đủ mọi lượt, chưa tính công`,
  ])
  ws.columns.forEach((c, i) => {
    c.width = [12, 5, 9, 26, 24, 10, 8, 60, 26][i]
  })
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 9 } }
  ws.views = [{ state: 'frozen', ySplit: 3 }]
}

function coMatTheoTo(wb: ExcelJS.Workbook, d: DuLieu, homNay: string) {
  const m = tinhCoMat({ theoNgay: d.theoNgay, dong: d.dong, nhanSu: d.nhanSu, homNay })
  const ws = wb.addWorksheet('Có mặt theo tổ')
  ws.addRow([
    `Có mặt theo ngày × tổ · ${dmy(d.khoang.tu)} → ${dmy(d.khoang.den)} · ô = số người có ít nhất 1 lượt quẹt`,
  ]).font = { bold: true }
  ws.addRow([])
  const head = ws.addRow([
    'Tổ / bộ phận',
    'Người',
    ...m.ngays.map((x) => `${Number(x.slice(8))} ${THU[thuIdx(x)]}`),
    'TB ngày thường',
  ])
  head.font = { bold: true }
  head.eachCell((c, i) => {
    const x = m.ngays[i - 3]
    c.fill = x && thuIdx(x) === 0 ? NEN_CN : NEN_DAU
    c.alignment = { horizontal: i <= 1 ? 'left' : 'center' }
  })
  const dongSo = (
    ten: string,
    nguoi: number,
    vals: (number | null)[],
    tb: number | null,
  ) => {
    const row = ws.addRow([ten, nguoi, ...vals.map((v) => v ?? ''), tb == null ? '' : tb])
    vals.forEach((v, i) => {
      const c = row.getCell(i + 3)
      c.alignment = { horizontal: 'center' }
      if (thuIdx(m.ngays[i]) === 0) c.fill = NEN_CN
      else if (v != null && nguoi) {
        const r = v / nguoi
        if (r < 0.6) c.fill = NEN_DO
        else if (r < 0.85) c.fill = NEN_CAM
      }
    })
    row.getCell(vals.length + 3).numFmt = '0%'
    return row
  }
  for (const t of m.tos) dongSo(t.to, t.ds.length, t.ngay, t.tb)
  dongSo('Toàn công ty', m.tongNguoi, m.tong, m.tbTong).font = { bold: true }
  ws.addRow([])
  ws.addRow([
    `Không gồm ${d.khongCham} người Không chấm công · không gồm lượt của mã máy chưa ghép người · ô trống = ngày chưa lấy dữ liệu · TB bỏ chủ nhật · màu: cam 60–85%, đỏ < 60%`,
  ])
  ws.getColumn(1).width = 28
  ws.getColumn(2).width = 7
  for (let i = 0; i < m.ngays.length; i++) ws.getColumn(i + 3).width = 6
  ws.getColumn(m.ngays.length + 3).width = 14
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 3 }]
}
