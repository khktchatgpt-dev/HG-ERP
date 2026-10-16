import ExcelJS from 'exceljs'
import { chuO, tinhBangTo } from '@/lib/cham-cong/bang-to'
import type { DuLieu } from './cham-cong.service'

const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const thuIdx = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()
const nen = (argb: string) =>
  ({ type: 'pattern', pattern: 'solid', fgColor: { argb } }) as const

/**
 * Excel "Bảng chấm công theo tổ" — đúng lưới trang bày (cùng `tinhBangTo`): mỗi dòng
 * một người, mỗi cột một ngày, ô = tổng giờ vào → ra; dòng "Đi làm" = số người có
 * quẹt. Chưa tính công.
 */
export async function buildBangToExcel(
  d: DuLieu,
  to: string,
  homNay: string,
): Promise<Buffer> {
  const b = tinhBangTo({
    to,
    theoNgay: d.theoNgay,
    dong: d.dong,
    nhanSu: d.nhanSu,
    homNay,
  })
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(to.replace(/[\/?*[\]:]/g, ' ').slice(0, 31) || 'To')
  ws.addRow([
    `Bảng chấm công ${to} · tháng ${d.khoang.tu.slice(5, 7)}/${d.khoang.tu.slice(0, 4)}`,
  ]).font = {
    bold: true,
    size: 13,
  }
  ws.addRow([
    'Ô = tổng giờ từ lượt đầu tới lượt cuối (làm tròn xuống) · ! chỉ 1 lượt · V không quẹt · • hôm nay mới vào · chưa phải công',
  ])
  ws.addRow([])
  const head = ws.addRow([
    'Mã',
    'Họ tên',
    ...b.ngays.map((n) => `${Number(n.ngay.slice(8))} ${THU[thuIdx(n.ngay)]}`),
    'Ngày đi làm',
    'Thiếu lượt',
    'Vắng',
    'Tổng giờ',
  ])
  head.font = { bold: true }
  head.eachCell((c, i) => {
    const n = b.ngays[i - 3]
    c.fill = n?.cn ? nen('FFE9ECF1') : nen('FFF3F5F8')
    c.alignment = { horizontal: 'center', wrapText: true }
  })
  const n = b.nguoi.length
  const diLam = ws.addRow([
    '',
    'Đi làm',
    ...b.ngays.map((x) => (x.daLay ? `${x.diLam}/${n}` : '')),
  ])
  diLam.font = { italic: true }
  for (const p of b.nguoi) {
    const row = ws.addRow([
      p.ma,
      p.ten,
      ...p.o.map(chuO),
      p.diLam,
      p.thieu,
      p.vang,
      Math.round(p.phut / 60),
    ])
    p.o.forEach((o, i) => {
      const c = row.getCell(i + 3)
      c.alignment = { horizontal: 'center' }
      if (o.kieu === 'mot') c.fill = nen('FFFDF1E3')
      else if (o.kieu === 'vang') c.fill = nen('FFFBECEB')
      else if (b.ngays[i].cn) c.fill = nen('FFF1F3F6')
    })
  }
  ws.addRow([
    '',
    `Cộng ${n} người`,
    ...b.ngays.map((x) => (x.daLay ? x.diLam : '')),
    b.tong.diLam,
    b.tong.thieu,
    b.tong.vang,
    Math.round(b.tong.phut / 60),
  ]).font = { bold: true }
  ws.getColumn(1).width = 7
  ws.getColumn(2).width = 26
  for (let i = 0; i < b.ngays.length; i++) ws.getColumn(i + 3).width = 5
  for (let i = 0; i < 4; i++) ws.getColumn(b.ngays.length + 3 + i).width = 9
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: 5 }]
  return Buffer.from(await wb.xlsx.writeBuffer())
}
