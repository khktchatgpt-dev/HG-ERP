import ExcelJS from 'exceljs'
import { soCong, tcGon, tinhBangTo } from '@/lib/cham-cong/bang-to'
import type { DuLieu } from './cham-cong.service'

const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const thuIdx = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay()
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const nen = (argb: string) =>
  ({ type: 'pattern', pattern: 'solid', fgColor: { argb } }) as const

/**
 * Excel "Bảng chấm công theo tổ" v2 — đúng lưới trang bày (cùng `tinhBangTo`): ô ghi
 * công (X · ½ · CN · V · ?) kèm giờ tăng ca (X+5), cột tổng Công · Công CN · Giờ TC ·
 * Nghỉ có lý do · Vắng · Cần xử lý.
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
  const ws = wb.addWorksheet(to.replace(/[\\/?*[\]:]/g, ' ').slice(0, 31) || 'To')
  ws.addRow([
    `Bảng chấm công ${to} · tháng ${d.khoang.tu.slice(5, 7)}/${d.khoang.tu.slice(0, 4)}`,
  ]).font = { bold: true, size: 13 }
  ws.addRow([
    'X đủ công · ½ nửa công · CN công chủ nhật · V vắng · ? thiếu lượt cần xử lý · số sau dấu + là giờ tăng ca · hôm nay chưa tính',
  ])
  for (const x of b.loiNgay)
    ws.addRow([
      `Lưu ý ${THU[thuIdx(x.ngay)]} ${dm(x.ngay)}: ${x.so}/${x.diLam} người đi làm chỉ có 1 lượt hoặc thiếu giờ — có thể máy lỗi hoặc làm nửa buổi`,
    ]).font = { color: { argb: 'FF9A4A06' } }
  ws.addRow([])
  const dongDau = ws.rowCount + 1
  const head = ws.addRow([
    'Mã',
    'Họ tên',
    ...b.ngays.map((n) => `${Number(n.ngay.slice(8))} ${THU[thuIdx(n.ngay)]}`),
    'Công',
    'Công CN',
    'Giờ TC',
    'Nghỉ có lý do',
    'Vắng',
    'Cần xử lý',
  ])
  head.font = { bold: true }
  head.eachCell((c, i) => {
    c.fill = b.ngays[i - 3]?.cn ? nen('FFE4E8F0') : nen('FFF3F5F8')
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
  })
  const n = b.nguoi.length
  ws.addRow([
    '',
    'Đi làm',
    ...b.ngays.map((x) => (x.daLay ? `${x.diLam}/${n}` : '')),
  ]).font = {
    italic: true,
  }
  for (const p of b.nguoi) {
    const row = ws.addRow([
      p.ma,
      p.khongQuet ? `${p.ten} (cả tháng không quẹt)` : p.ten,
      ...p.o.map((o) => (o.ky ? `${o.ky}${o.tc ? `+${tcGon(o.tc)}` : ''}` : '')),
      p.cong,
      p.congCN,
      Math.round((p.tc / 60) * 10) / 10,
      p.nghi,
      p.vang,
      p.canXuLy,
    ])
    p.o.forEach((o, i) => {
      const c = row.getCell(i + 3)
      c.alignment = { horizontal: 'center' }
      if (o.ky === '½' || o.ky === '?' || o.ky === 'CN½') c.fill = nen('FFFDF1E3')
      else if (o.ky === 'V') c.fill = nen('FFFBECEB')
      else if (b.ngays[i].cn) c.fill = nen('FFE4E8F0')
    })
  }
  ws.addRow([
    '',
    `Cộng ${n} người`,
    ...b.ngays.map((x) => (x.daLay && !x.homNay ? soCong(x.cong) : '')),
    b.tong.cong,
    b.tong.congCN,
    Math.round((b.tong.tc / 60) * 10) / 10,
    b.tong.nghi,
    b.tong.vang,
    b.tong.canXuLy,
  ]).font = { bold: true }
  ws.getColumn(1).width = 7
  ws.getColumn(2).width = 28
  for (let i = 0; i < b.ngays.length; i++) ws.getColumn(i + 3).width = 6
  for (let i = 0; i < 6; i++) ws.getColumn(b.ngays.length + 3 + i).width = 9
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: dongDau + 1 }]
  return Buffer.from(await wb.xlsx.writeBuffer())
}
