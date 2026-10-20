import ExcelJS from 'exceljs'
import { tenMay } from '@/lib/cham-cong/mot-nguoi'
import { SO_CAP, ghiChuNgay, tongCong } from '@/lib/cham-cong/chi-tiet-cong'
import { TEN_NGHI } from '@/lib/cham-cong/dieu-chinh'
import type { MotNguoiCong } from './gio-cong.service'

const THU = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`
const nen = (argb: string) =>
  ({ type: 'pattern', pattern: 'solid', fgColor: { argb } }) as const
const r2 = (x: number) => Math.round(x * 100) / 100
const COT = 18
/** Cặp Vào/Ra bày thành cột, như tờ "Chi tiết" phần mềm cũ. */
const CAP = Array.from({ length: SO_CAP }, (_, i) => i)

/**
 * Excel "BẢNG CHI TIẾT CHẤM CÔNG" một người — bố cục tờ "Chi tiết" của phần mềm chấm
 * công cũ (bản vẽ duyệt 20/10/2026, Q6): khối tổng đầu tờ, mỗi ngày một dòng, chỗ ký
 * cuối tờ. Số lấy đúng dữ liệu màn bày (cùng `tongCong` / `ghiChuNgay`).
 */
export async function buildMotNguoiExcel(d: MotNguoiCong): Promise<Buffer> {
  const tinh = 'loi' in d.tinh ? null : d.tinh
  const cong = new Map(tinh?.ngay.map((x) => [x.ngay, x]) ?? [])
  const daLay = new Set(d.ngay.filter((n) => n.daLay).map((n) => n.ngay))
  const t = tinh ? tongCong(tinh.ngay, (iso) => daLay.has(iso)) : null
  const p1 = tinh?.phutMotCong ?? 480
  const nhan = tinh?.nhanTc ?? { tc1: '', tc2: '', tc3: '' }

  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Chi tiết')
  const gop = (row: number, text: string, opt: Partial<ExcelJS.Font> = {}) => {
    ws.mergeCells(row, 1, row, COT)
    const c = ws.getCell(row, 1)
    c.value = text
    c.font = opt
  }
  gop(1, 'BẢNG CHI TIẾT CHẤM CÔNG', { bold: true, size: 14 })
  ws.getCell(1, 1).alignment = { horizontal: 'center' }
  gop(
    2,
    `Mã nhân viên: ${d.nguoi.ma}    Tên nhân viên: ${d.nguoi.ten}    Bộ phận: ${d.nguoi.boPhan ?? '(chưa có)'}    Kỳ: ${dmy(d.khoang.tu)} → ${dmy(d.khoang.den)}`,
    { bold: true },
  )

  let dong = 4
  if (t) {
    const kv = (cot: number, nhanO: string, gt: number | string) => {
      ws.getCell(dong, cot).value = nhanO
      ws.getCell(dong, cot).font = { color: { argb: 'FF5D6675' } }
      ws.getCell(dong, cot + 1).value = gt
      ws.getCell(dong, cot + 1).font = { bold: true }
    }
    const hcT = t.hcThuong + t.hcCn + t.hcLe
    const khoi: [string, number, string, number, string, number | string][] = [
      [
        'Công ngày thường',
        r2(t.hcThuong / p1),
        `Tăng ca 1 (${nhan.tc1})`,
        r2(t.tc1 / 60),
        'Đi trễ — số lần',
        t.lanTre,
      ],
      [
        'Công chủ nhật',
        r2(t.hcCn / p1),
        `Tăng ca 2 (${nhan.tc2})`,
        r2(t.tc2 / 60),
        'Đi trễ — số phút',
        t.phutTre,
      ],
      [
        'Công lễ',
        r2(t.hcLe / p1),
        `Tăng ca 3 (${nhan.tc3})`,
        r2(t.tc3 / 60),
        'Về sớm — số lần',
        t.lanSom,
      ],
      [
        'TỔNG CÔNG',
        r2(hcT / p1),
        'Tổng tăng ca (giờ)',
        r2((t.tc1 + t.tc2 + t.tc3) / 60),
        'Về sớm — số phút',
        t.phutSom,
      ],
      [
        'Thiếu lượt (ngày)',
        t.thieu,
        'Vắng (ngày thường)',
        t.vang,
        'Nghỉ có lý do',
        Object.entries(t.nghi)
          .map(([k, v]) => `${TEN_NGHI[k as keyof typeof TEN_NGHI]} ${v}`)
          .join(', ') || '—',
      ],
    ]
    for (const [a, av, b, bv, c, cv] of khoi) {
      kv(1, a, av)
      kv(5, b, bv)
      kv(9, c, cv)
      dong++
    }
    dong++
  } else {
    gop(dong, `Chưa tính công: ${'loi' in d.tinh ? d.tinh.loi : ''}`, { italic: true })
    dong += 2
  }

  const dauBang = dong
  const head = ws.getRow(dong++)
  head.values = [
    'Ngày',
    'Thứ',
    ...CAP.flatMap((i) => [`Vào ${i + 1}`, `Ra ${i + 1}`]),
    'Giờ được tính',
    'Trễ (phút)',
    'Sớm (phút)',
    'Công',
    'Giờ HC',
    `TC1 ${nhan.tc1}`,
    `TC2 ${nhan.tc2}`,
    `TC3 ${nhan.tc3}`,
    'Máy',
    'Ghi chú',
  ]
  head.font = { bold: true }
  head.alignment = { wrapText: true, vertical: 'middle' }
  head.eachCell((c) => (c.fill = nen('FFF3F5F8')))

  for (const n of d.ngay) {
    const x = cong.get(n.ngay)
    const ghi = ghiChuNgay(n, x)
    const coGio = !!x?.tinhDuoc
    const row = ws.getRow(dong++)
    row.values = [
      dmy(n.ngay),
      THU[new Date(`${n.ngay}T00:00:00Z`).getUTCDay()],
      ...CAP.flatMap((i) => {
        const p = x?.cap[i]
        return [p?.vao ?? '', p ? (p.ra ?? (x?.thieu ? '?' : '')) : '']
      }),
      x?.cap.some((p) => p.vaoTinh)
        ? x.cap.map((p) => `${p.vaoTinh} → ${p.raTinh}`).join(' · ')
        : coGio
          ? 'có quẹt'
          : '',
      x?.tre || '',
      x?.som || '',
      coGio ? r2(x!.hc / p1) : '',
      coGio ? r2(x!.hc / 60) : '',
      x?.tc1 ? r2(x.tc1 / 60) : '',
      x?.tc2 ? r2(x.tc2 / 60) : '',
      x?.tc3 ? r2(x.tc3 / 60) : '',
      [...new Set(n.luot.map((l) => tenMay(l.may)))].join(', '),
      ghi.map((g) => g.text).join(', '),
    ]
    const to = x?.thieu
      ? 'FFFBECEB'
      : x?.loai === 'le'
        ? 'FFFBF2E2'
        : x?.loai === 'cn' ||
            (!x && THU[new Date(`${n.ngay}T00:00:00Z`).getUTCDay()] === 'CN')
          ? 'FFF1EEF6'
          : null
    if (to) for (let i = 1; i <= COT; i++) row.getCell(i).fill = nen(to)
  }

  if (t) {
    const hcT = t.hcThuong + t.hcCn + t.hcLe
    const row = ws.getRow(dong++)
    row.values = [
      `Cộng ${d.ngay.length} ngày`,
      '',
      t.thieu ? `không gồm ${t.thieu} ngày thiếu lượt` : '',
      ...CAP.flatMap(() => ['', '']).slice(1),
      '',
      t.phutTre || '',
      t.phutSom || '',
      r2(hcT / p1),
      r2(hcT / 60),
      r2(t.tc1 / 60),
      r2(t.tc2 / 60),
      r2(t.tc3 / 60),
      '',
      '',
    ]
    row.font = { bold: true }
    row.eachCell({ includeEmpty: true }, (c) => (c.fill = nen('FFF3F5F8')))
  }
  for (const c of [10, 11, 12, 13, 14, 15, 16]) {
    ws.getColumn(c).numFmt = '#,##0.##'
    ws.getColumn(c).alignment = { horizontal: 'right' }
  }

  dong += 2
  ws.getCell(dong, 2).value = 'Người lao động ký tên'
  ws.getCell(dong, 9).value = 'Tổ trưởng xác nhận'
  ws.getCell(dong, 15).value = 'Phòng Nhân sự'
  for (const c of [2, 9, 15]) ws.getCell(dong, c).font = { bold: true }
  ws.getCell(dong + 4, 2).value = d.nguoi.ten

  ws.columns.forEach((c, i) => {
    c.width = [11, 5, 7, 7, 7, 7, 7, 7, 14, 8, 8, 7, 7, 9, 9, 9, 10, 30][i]
  })
  ws.views = [{ state: 'frozen', ySplit: dauBang }]
  return Buffer.from(await wb.xlsx.writeBuffer())
}
