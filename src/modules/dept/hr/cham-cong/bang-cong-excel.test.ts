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
      /^Mã nhân viên: 00132 {3}Tên nhân viên: Lê Văn Bảy {3}Bộ phận: Tổ Phôi/,
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

describe('Excel tổng hợp — đúng cột file TH tháng 9 (KT VLOOKUP theo vị trí)', () => {
  it('tiêu đề, cột A–AE, mã đệm số 0, 4 cột quy đổi bằng công thức', async () => {
    const { rows, ws } = await doc(await buildTongHopExcel(bang()))
    expect(ws.name).toBe('Xuất tổng')
    expect(rows[1][0]).toBe('Đơn vị: CÔNG TY TNHH SX-TM HOÀNG GIA')
    expect(rows[2][0]).toBe('Địa chỉ: Lô C3 CCN Cát Nhơn')
    expect(rows[3][0]).toBe('TỔNG HỢP CHẤM CÔNG')
    expect(rows[4][0]).toBe('Từ ngày 04/10/2026 đến ngày 07/10/2026')
    const c = (a: string) => ws.getCell(a).value
    // Dòng 6–7 đúng chữ, đúng cột như file TH tổ Phôi
    expect([c('A6'), c('B6'), c('C6'), c('D6'), c('E6'), c('F6')]).toEqual([
      'STT',
      'Mã nhân viên',
      'Tên nhân viên',
      'Phòng ban',
      'Chức vụ',
      'Ngày vào làm',
    ])
    expect([c('G6'), c('J6'), c('M6'), c('O6'), c('Q6'), c('T6'), c('U6')]).toEqual([
      'Ngày công',
      'Giờ công',
      'Vào trễ',
      'Ra sớm',
      'Tăng ca',
      'Vắng KP',
      'Ngày nghỉ',
    ])
    expect([c('G7'), c('H7'), c('I7'), c('Q7'), c('R7'), c('S7')]).toEqual([
      'Thường',
      'C.Tuần',
      'Q.Đêm',
      'TC1',
      'TC2',
      'TC3',
    ])
    expect([c('U7'), c('V7'), c('W7'), c('X7'), c('Y7'), c('Z7'), c('AA7')]).toEqual([
      'OM',
      'TS',
      'R',
      'Ro',
      'F',
      'CO',
      'CT',
    ])
    expect([c('AB6'), c('AC6'), c('AD6'), c('AE6')]).toEqual([
      'TCA 16h-19h',
      'TCA 19h-22h',
      'TC 22h-6h',
      'TỔNG CÔNG',
    ])
    // Lê Văn Bảy (mã 132 → "00132"): 04/10 CN 1 công + 05/10 1 công (TC1 3, TC2 2);
    // 06/10 thiếu lượt; 07/10 vắng.
    expect([c('A8'), c('B8'), c('C8'), c('D8')]).toEqual([
      1,
      '00132',
      'Lê Văn Bảy',
      'Tổ Phôi',
    ])
    expect(c('G8')).toBe(2) // cột 6 của VLOOKUP B:AE — ngày công gồm cả CN
    expect([c('H8'), c('I8')]).toEqual([null, null])
    expect(c('J8')).toBe(16)
    expect([c('Q8'), c('R8'), c('T8')]).toEqual([3, 2, 1])
    expect(c('AB8')).toEqual({ formula: 'ROUND((Q8*0.5/3),2)', result: 0.5 }) // cột 27
    expect(c('AC8')).toEqual({ formula: 'ROUND((R8*0.5/3),2)', result: 0.33 }) // cột 28
    // cột 29 — kết quả 0 không được lưu sẵn, Excel tự tính khi mở (fullCalcOnLoad)
    expect(c('AD8')).toMatchObject({ formula: 'ROUND(S8/8*2.1,2)' })
    expect(c('AE8')).toEqual({
      formula: 'ROUND(G8+H8+I8+AB8+AC8+AD8,2)',
      result: 2.83,
    })
    // Lê Thị Phúc (59 → "00059"): vào 07:45 → trễ 1 lần 45 phút
    expect([c('B9'), c('M9'), c('N9')]).toEqual(['00059', 1, 45])
    // Không có dòng cộng (file TH không có); ghi chú sau một dòng trống, nêu người thiếu lượt
    expect(c('B11')).toBe('Ghi chú:')
    const ghi = [12, 13, 14, 15, 16, 17]
      .map((r) => String(ws.getCell(r, 3).value))
      .join(' ')
    expect(ghi).toContain('00132 Lê Văn Bảy 1 ngày')
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
    expect([ca.getCell('C8').value, ca.getCell('C9').value]).toEqual([
      'Lê Văn Bảy',
      'Lê Thị Phúc',
    ])
    expect(phoi.getCell('C8').value).toBe('Lê Văn Bảy')
    expect(phoi.getCell('C9').value).toBeNull()
    expect(String(phoi.getCell(15, 3).value)).toContain('Tổ Phôi')
  })
})
