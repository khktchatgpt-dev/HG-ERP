import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { chiTietNgay, nhanTc, tongCong } from '@/lib/cham-cong/chi-tiet-cong'
import { THAM_SO_MAC_DINH as T } from '@/lib/cham-cong/gio-khung'
import { tinhKyGioCong } from '@/lib/cham-cong/ky-gio-cong'
import { buildChiTietExcel, buildTongHopExcel, type BangXuat } from './bang-cong-excel'

const l = (...g: string[]) => g.map((gio) => ({ gio: `${gio}:00`, may: '.201' }))
const NGAY = ['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']

/** Hai người tổ Phôi, 4 ngày: CN có làm · ngày thường đủ + TC · 1 lượt · vắng. */
function bang(): BangXuat {
  const nguoi = tinhKyGioCong({
    tu: '2026-09-26',
    den: '2026-10-25',
    nhanSu: [
      { ma: '132', ten: 'Lê Văn Bảy', boPhan: 'Tổ Phôi' },
      { ma: '59', ten: 'Lê Thị Phúc', boPhan: 'Tổ Phôi' },
    ],
    dong: [
      { ngay: '2026-10-04', ma: '132', daGhep: true, luot: l('06:40', '16:03') },
      { ngay: '2026-10-05', ma: '132', daGhep: true, luot: l('06:47', '21:02') },
      { ngay: '2026-10-06', ma: '132', daGhep: true, luot: l('06:35') },
      { ngay: '2026-10-05', ma: '59', daGhep: true, luot: l('07:45', '16:00') },
    ],
    dieuChinh: [],
    trua: {},
    cachTinh: {},
  })
  return {
    tu: '2026-10-04',
    den: '2026-10-07',
    nhom: 'Tổ Phôi',
    congTy: { ten: 'CÔNG TY TNHH SX-TM HOÀNG GIA', diaChi: 'Lô C3 CCN Cát Nhơn' },
    nhanTc: nhanTc(T),
    phutMotCong: 480,
    tinhTrang: 'kỳ đang mở — số tạm tính',
    nguoi: nguoi.map((n) => {
      const ds = NGAY.map((d) =>
        chiTietNgay(
          d,
          n.ngay.find((x) => x.ngay === d),
          T,
          'khung',
          {},
        ),
      )
      return {
        ma: n.ma,
        ten: n.ten,
        boPhan: 'Tổ Phôi',
        chucVu: null,
        ngayVao: '2017-07-28',
        ngay: ds,
        may: { '2026-10-05': ['Máy 201'] },
        tong: tongCong(ds, () => true),
      }
    }),
  }
}

async function doc(buf: Buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  const ws = wb.worksheets[0]
  const rows: unknown[][] = []
  ws.eachRow(
    { includeEmpty: true },
    (r, i) => (rows[i] = (r.values as unknown[]).slice(1)),
  )
  return { ws, rows }
}

describe('Excel chi tiết chấm công (mẫu "tổ X.xlsx")', () => {
  it('mỗi người một khối: tiêu đề, dòng mã-tên, tổng, các loại vắng, ngày', async () => {
    const { ws, rows } = await doc(await buildChiTietExcel(bang()))
    expect(ws.name).toBe('Chi Tiet')
    const khoi = rows
      .map((r, i) => (r?.[0] === 'BẢNG CHI TIẾT CHẤM CÔNG' ? i : -1))
      .filter((i) => i > 0)
    expect(khoi).toHaveLength(2)
    expect(String(rows[khoi[0] + 1][0])).toMatch(
      /^Mã nhân viên: 132 {3}Tên nhân viên: Lê Văn Bảy {3}Bộ phận: Tổ Phôi/,
    )
    const ngay5 = rows.find((r) => r?.[0] === '05/10/2026')!
    // Ngày, Thứ, Vào1, Ra1, Vào2, Ra2, Vào3, Ra3, Trễ, Sớm, Công, T.Giờ, TC1, TC2, TC3, Máy
    expect(ngay5.slice(0, 16)).toEqual([
      '05/10/2026',
      'Hai',
      '06:47',
      '21:02',
      '',
      '',
      '',
      '',
      0,
      0,
      1,
      8,
      3,
      2,
      0,
      'Máy 201',
    ])
    const ngay6 = rows.find((r) => r?.[0] === '06/10/2026')!
    expect(ngay6.slice(2, 4)).toEqual(['06:35', '?'])
    expect(ngay6[16]).toContain('1 lượt — cần bổ sung')
    // Khối người thứ hai: vào 07:45 → trễ 45 phút
    const tre = rows.filter((r) => r?.[0] === '05/10/2026')[1]
    expect(tre[8]).toBe(45)
  })
})

describe('Excel tổng hợp (mẫu "tổng hợp tổ X.xlsx")', () => {
  it('đầu tờ đơn vị + kỳ, mỗi người một dòng, dòng Cộng bằng công thức', async () => {
    const { rows, ws } = await doc(await buildTongHopExcel(bang()))
    expect(ws.name).toBe('Xuất tổng')
    expect(rows[1][0]).toBe('Đơn vị: CÔNG TY TNHH SX-TM HOÀNG GIA')
    expect(rows[3][0]).toBe('TỔNG HỢP CHẤM CÔNG')
    expect(String(rows[4][0])).toMatch(/^Từ ngày 04\/10\/2026 đến ngày 07\/10\/2026/)
    expect(rows[7].slice(6, 9)).toEqual(['Thường', 'C.Nhật', 'Lễ'])
    // 132: thường 1 công (05/10), CN 1 công (04/10), TC1 3 · TC2 2, thiếu 1, vắng 1 (07/10)
    expect(rows[8].slice(0, 4)).toEqual([1, '132', 'Lê Văn Bảy', 'Tổ Phôi'])
    expect(rows[8][5]).toBe('28/07/2017')
    expect(rows[8].slice(6, 9)).toEqual([1, 1, 0])
    expect(rows[8].slice(16, 21)).toEqual([3, 2, 0, 1, 1])
    // 59: trễ 1 lần 45 phút
    expect(rows[9].slice(12, 14)).toEqual([1, 45])
    const cong = ws.getRow(10)
    expect(cong.getCell(3).value).toBe('Cộng 2 người')
    expect(cong.getCell(7).value).toEqual({ formula: 'SUM(G8:G9)' })
  })
})

describe('chia theo tổ — một file, mỗi tổ một tờ', () => {
  const haiTo = (): BangXuat => {
    const b = bang()
    b.nhom = 'Cả công ty'
    b.nguoi[1] = { ...b.nguoi[1], boPhan: 'Khoán Nguội A/B' }
    return b
  }
  it('chi tiết: mỗi tổ một tờ mang tên tổ (ký tự cấm thay bằng khoảng trắng)', async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load((await buildChiTietExcel(haiTo())) as unknown as ArrayBuffer)
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Tổ Phôi', 'Khoán Nguội A B'])
    const ten = (i: number) => String(wb.worksheets[i].getCell('A2').value)
    expect(ten(0)).toContain('Lê Văn Bảy')
    expect(ten(1)).toContain('Lê Thị Phúc')
  })
  it('tổng hợp: tờ đầu cả nhóm, sau đó mỗi tổ một tờ chỉ có người tổ đó', async () => {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load((await buildTongHopExcel(haiTo())) as unknown as ArrayBuffer)
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Cả công ty',
      'Tổ Phôi',
      'Khoán Nguội A B',
    ])
    const [ca, phoi] = wb.worksheets
    expect(ca.getRow(10).getCell(3).value).toBe('Cộng 2 người')
    expect(phoi.getRow(8).getCell(3).value).toBe('Lê Văn Bảy')
    expect(phoi.getRow(9).getCell(3).value).toBe('Cộng 1 người')
    expect(String(phoi.getCell('A4').value)).toContain('· Tổ Phôi ·')
  })
})
