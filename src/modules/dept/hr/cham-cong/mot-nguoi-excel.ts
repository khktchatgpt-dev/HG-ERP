import ExcelJS from 'exceljs'
import {
  deYNgay,
  gioPhut,
  laChuNhat,
  tachLuot,
  tenMay,
  tomTatMotNguoi,
} from '@/lib/cham-cong/mot-nguoi'
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
    `${d.nguoi.boPhan ?? '(chưa có bộ phận)'} · ca thường làm ${d.nguoi.ca} · quẹt ở ${[...new Set(d.nguoi.maMay.map((x) => tenMay(x.split(' ')[0])))].join(', ') || '—'} (mã ${d.nguoi.ma})${d.nguoi.khongChamCong ? ' · KHÔNG CHẤM CÔNG' : ''}`,
  ])
  ws.addRow([
    `${dmy(d.khoang.tu)} → ${dmy(d.khoang.den)} · có quẹt ${t.coQuet}/${t.ngayThuong} ngày thường · không quẹt ${t.khongQuet} · chỉ 1 lượt ${t.motLuot} · từ 3 lượt ${t.tuBaLuot} · quẹt CN ${t.quetChuNhat}${t.chuaLay ? ` · ${t.chuaLay} ngày chưa lấy dữ liệu` : ''}`,
  ])
  ws.addRow([])
  const head = ws.addRow([
    'Ngày',
    'Thứ',
    'Giờ vào',
    'Giờ ra',
    'Lượt giữa',
    'Tổng thời gian (vào → ra)',
    'Máy',
    'Số lượt',
    'Để ý',
  ])
  head.font = { bold: true }
  head.eachCell((c) => (c.fill = nen('FFF3F5F8')))
  for (const n of d.ngay) {
    const de = deYNgay(n)
    const lu = tachLuot(n.luot)
    const row = ws.addRow([
      dmy(n.ngay),
      THU[new Date(`${n.ngay}T00:00:00Z`).getUTCDay()],
      lu.vao ?? '',
      lu.ra ?? '',
      lu.giua.join(' · '),
      lu.coMatPhut != null ? gioPhut(lu.coMatPhut) : '',
      lu.may.join(', '),
      n.daLay ? n.luot.length : '',
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
    c.width = [12, 5, 9, 9, 18, 12, 18, 8, 30][i]
  })
  ws.views = [{ state: 'frozen', ySplit: 5 }]
  return Buffer.from(await wb.xlsx.writeBuffer())
}
