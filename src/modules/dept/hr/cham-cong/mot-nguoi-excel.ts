import ExcelJS from 'exceljs'
import { deYNgay, laChuNhat, tomTatMotNguoi } from '@/lib/cham-cong/mot-nguoi'
import type { MotNguoi } from './cham-cong.service'

const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const nen = (argb: string) =>
  ({ type: 'pattern', pattern: 'solid', fgColor: { argb } }) as const

/** Excel "Chấm công một người" theo khoảng — đúng các dòng ngăn kéo bày (cùng hàm tóm tắt). */
export async function buildMotNguoiExcel(d: MotNguoi): Promise<Buffer> {
  const t = tomTatMotNguoi(d.ngay)
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Chấm công')
  ws.addRow([`Chấm công của ${d.nguoi.ma} · ${d.nguoi.ten}`]).font = {
    bold: true,
    size: 13,
  }
  ws.addRow([
    `${d.nguoi.boPhan ?? '(chưa có bộ phận)'} · ca thường làm ${d.nguoi.ca} · mã máy ${d.nguoi.maMay.join(', ') || '—'}${d.nguoi.khongChamCong ? ' · KHÔNG CHẤM CÔNG' : ''}`,
  ])
  ws.addRow([
    `${dmy(d.khoang.tu)} → ${dmy(d.khoang.den)} · có quẹt ${t.coQuet}/${t.ngayThuong} ngày thường · không quẹt ${t.khongQuet} · chỉ 1 lượt ${t.motLuot} · từ 3 lượt ${t.tuBaLuot} · quẹt CN ${t.quetChuNhat}${t.chuaLay ? ` · ${t.chuaLay} ngày chưa lấy dữ liệu` : ''}`,
  ])
  ws.addRow([])
  const head = ws.addRow(['Ngày', 'Thứ', 'Số lượt', 'Các lượt (giờ · máy)', 'Để ý'])
  head.font = { bold: true }
  head.eachCell((c) => (c.fill = nen('FFF3F5F8')))
  for (const n of d.ngay) {
    const de = deYNgay(n)
    const row = ws.addRow([
      dmy(n.ngay),
      THU[new Date(`${n.ngay}T00:00:00Z`).getUTCDay()],
      n.daLay ? n.luot.length : '',
      n.luot.map((l) => `${l.gio.slice(0, 5)} ${l.may}`).join(' · '),
      de.map((x) => x.text).join(', '),
    ])
    if (laChuNhat(n.ngay))
      row.eachCell({ includeEmpty: true }, (c) => (c.fill = nen('FFF1F3F6')))
    else if (de.some((x) => x.tone === 'stop'))
      row.eachCell({ includeEmpty: true }, (c) => (c.fill = nen('FFFBECEB')))
    else if (de.some((x) => x.tone === 'warn'))
      row.eachCell({ includeEmpty: true }, (c) => (c.fill = nen('FFFDF1E3')))
  }
  ws.addRow([])
  ws.addRow([
    `${d.ngay.length} ngày · ${t.tongLuot} lượt (đã gộp lượt bấm lặp trong 2 phút) · chỉ bày lượt quẹt, chưa tính công`,
  ])
  ws.columns.forEach((c, i) => {
    c.width = [12, 5, 8, 48, 30][i]
  })
  ws.views = [{ state: 'frozen', ySplit: 5 }]
  return Buffer.from(await wb.xlsx.writeBuffer())
}
