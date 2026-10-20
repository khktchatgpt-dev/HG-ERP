import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import { chiTietNgay } from '@/lib/cham-cong/chi-tiet-cong'
import { THAM_SO_MAC_DINH as T } from '@/lib/cham-cong/gio-khung'
import { tinhKyGioCong } from '@/lib/cham-cong/ky-gio-cong'
import { buildMotNguoiExcel } from './mot-nguoi-excel'
import type { MotNguoiCong } from './gio-cong.service'

const luot = (...g: string[]) =>
  g.map((gio) => ({ gio: `${gio}:00`, may: '.201', lap: 1 }))

describe('Excel tờ Chi tiết một người', () => {
  it('cặp Vào/Ra thành cột riêng, ngày hai đoạn có Vào 2 / Ra 2, tổng ở dòng Cộng', async () => {
    const ngays = [
      { ngay: '2026-10-05', luot: luot('06:47', '21:02') },
      { ngay: '2026-10-06', luot: luot('06:49', '11:29', '13:05', '19:10') },
    ]
    const [a] = tinhKyGioCong({
      tu: '2026-09-26',
      den: '2026-10-25',
      nhanSu: [{ ma: '132', ten: 'Lê Văn Bảy', boPhan: 'Tổ Phôi' }],
      dong: ngays.map((n) => ({ ngay: n.ngay, ma: '132', daGhep: true, luot: n.luot })),
      dieuChinh: [],
      trua: {},
      cachTinh: {},
    })
    const d: MotNguoiCong = {
      nguoi: {
        ma: '132',
        ten: 'Lê Văn Bảy',
        boPhan: 'Tổ Phôi',
        ca: 'Xưởng',
        khongChamCong: false,
        maMay: ['.201 132'],
      },
      khoang: { tu: '2026-10-05', den: '2026-10-06' },
      ngay: ngays.map((n) => ({ ...n, soLuotTho: n.luot.length, daLay: true })),
      dieuChinh: [],
      quyen: { gui: false, duyet: false } as MotNguoiCong['quyen'],
      tinh: {
        cachTinh: 'khung',
        nhanTc: { tc1: '16–19h', tc2: '19–22h', tc3: 'sau 22h' },
        phutMotCong: 480,
        ban: 1,
        daChot: false,
        ngay: ngays.map((n) =>
          chiTietNgay(
            n.ngay,
            a.ngay.find((x) => x.ngay === n.ngay),
            T,
            'khung',
            {},
          ),
        ),
      },
    }
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load((await buildMotNguoiExcel(d)) as unknown as ArrayBuffer)
    const ws = wb.getWorksheet('Chi tiết')!
    const rows: unknown[][] = []
    ws.eachRow((r) => rows.push((r.values as unknown[]).slice(1)))
    const head = rows.find((r) => r[0] === 'Ngày')!
    expect(head.slice(2, 9)).toEqual([
      'Vào 1',
      'Ra 1',
      'Vào 2',
      'Ra 2',
      'Vào 3',
      'Ra 3',
      'Giờ được tính',
    ])
    const r1 = rows.find((r) => r[0] === '05/10/2026')!
    expect(r1.slice(2, 4)).toEqual(['06:47', '21:02'])
    expect(r1.slice(11, 16)).toEqual([1, 8, 3, 2, ''])
    const r2 = rows.find((r) => r[0] === '06/10/2026')!
    expect(r2.slice(2, 6)).toEqual(['06:49', '11:29', '13:05', '19:10'])
    const cong = rows.find((r) => String(r[0]).startsWith('Cộng'))!
    // 05/10: 1 công; 06/10 hai đoạn 07:00→11:30 (trừ trưa) + 13:00→16:00 = 7 giờ = 0,875
    expect(cong[11]).toBe(1.88)
  })
})
