import ExcelJS from 'exceljs'
import type { DuLieu } from './cham-cong.service'

const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const thu = (iso: string) => THU[new Date(`${iso}T00:00:00Z`).getUTCDay()]

/**
 * Excel LƯỢT THÔ — đúng các dòng trang Lấy dữ liệu bày (cùng `chamCongService.duLieu`),
 * để Nhân sự đối chiếu với máy / sổ giấy. Không có cột công: file này không tính gì.
 */
export async function buildDuLieuExcel(d: DuLieu): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Lượt quẹt')
  ws.addRow([
    `Lượt quẹt từ máy chấm công · ${dmy(d.khoang.tu)} → ${dmy(d.khoang.den)} · chưa tính công`,
  ])
  ws.getRow(1).font = { bold: true }
  ws.addRow([])
  const head = ws.addRow([
    'Ngày',
    'Thứ',
    'Mã',
    'Tên',
    'Máy',
    'Lượt đầu',
    'Lượt cuối',
    'Số lượt',
    'Các lượt',
    'Để ý',
  ])
  head.font = { bold: true }
  head.eachCell((c) => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F5F8' } }
  })
  for (const r of d.dong) {
    const may = [...new Set(r.luot.map((l) => l.may))]
    const de: string[] = []
    if (r.luot.length < 2) de.push('1 lượt')
    if (r.soLuotTho > r.luot.length) de.push(`bấm lặp ${r.soLuotTho - r.luot.length}`)
    if (may.length > 1) de.push('2 máy')
    if (!r.daGhep) de.push('mã chưa ghép người')
    ws.addRow([
      dmy(r.ngay),
      thu(r.ngay),
      r.ma,
      r.ten,
      may.join(' '),
      r.luot[0].gio.slice(0, 5),
      r.luot.length > 1 ? r.luot[r.luot.length - 1].gio.slice(0, 5) : '',
      r.soLuotTho,
      r.luot.map((l) => `${l.gio} ${l.may}`).join(' · '),
      de.join(', '),
    ])
  }
  ws.addRow([])
  ws.addRow([
    `${d.dong.length} dòng người-ngày · "Số lượt" gồm cả lượt bấm lặp trong 2 phút`,
  ])
  ws.columns.forEach((c, i) => {
    c.width = [12, 5, 9, 24, 10, 9, 9, 8, 60, 28][i]
  })
  ws.views = [{ state: 'frozen', ySplit: 3 }]
  return Buffer.from(await wb.xlsx.writeBuffer())
}
