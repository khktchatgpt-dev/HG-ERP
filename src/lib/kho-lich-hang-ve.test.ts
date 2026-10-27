import { describe, expect, it } from 'vitest'
import {
  bayNgayToi,
  docHen,
  dungLich,
  khopO,
  ngayChoXacNhan,
  nhanO,
  oCoHangGanNhat,
  oCua,
  thuNgay,
  thuTuO,
} from './kho-lich-hang-ve'
import type { IncomingBucket } from './supply-watch'

// Hôm nay thật lúc dựng (27/10/2026, thứ Ba) — số theo DB cùng ngày.
const TODAY = '2026-10-27'
const m = (bucket: IncomingBucket, expected_at: string | null = null) => ({ bucket, expected_at }) // prettier-ignore

const DANG_VE = [
  ...Array.from({ length: 16 }, () => m('overdue', '2026-10-20')),
  ...Array.from({ length: 6 }, () => m('week', '2026-10-30')),
  m('week', '2026-10-31'),
  m('week', '2026-11-01'),
  m('week', '2026-11-01'),
  ...Array.from({ length: 10 }, () => m('later', '2026-11-10')),
]
const SAP_DAT = [
  m('week', '2026-10-28'),
  m('week', '2026-10-29'),
  m('week', '2026-10-29'),
  m('week', '2026-10-29'),
  m('week', '2026-10-30'),
  m('later', '2026-11-05'),
]

describe('thuNgay / bayNgayToi', () => {
  it('thứ theo lịch: 27/10/2026 là thứ Ba, 01/11 là Chủ nhật', () => {
    expect(thuNgay(TODAY)).toBe('T3 27/10')
    expect(thuNgay('2026-11-01')).toBe('CN 01/11')
  })

  it('7 ngày SAU hôm nay — khớp rổ "week" (hết ngày thứ 7)', () => {
    expect(bayNgayToi(TODAY)).toEqual([
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
      '2026-11-03',
    ])
  })
})

describe('dungLich', () => {
  it('số chính = đơn đang về, 7 ô ngày cộng lại đúng rổ 7 ngày; sắp đặt đếm riêng', () => {
    const l = dungLich(DANG_VE, SAP_DAT, TODAY)
    expect(l.map((o) => [o.nhan, o.n, o.sapDat])).toEqual([
      ['Quá hẹn', 16, 0],
      ['Hôm nay 27/10', 0, 0],
      ['T4 28/10', 0, 1],
      ['T5 29/10', 0, 3],
      ['T6 30/10', 6, 1],
      ['T7 31/10', 1, 0],
      ['CN 01/11', 2, 0],
      ['T2 02/11', 0, 0],
      ['T3 03/11', 0, 0],
      ['Sau đó', 10, 1],
      ['Tất cả', 35, 6],
    ])
    const ngay = l.filter((o) => o.loai === 'ngay').reduce((s, o) => s + o.n, 0)
    expect(ngay).toBe(DANG_VE.filter((r) => r.bucket === 'week').length)
  })

  it('ô Chưa hẹn chỉ có khi có đơn (kể cả đơn sắp đặt)', () => {
    expect(dungLich(DANG_VE, SAP_DAT, TODAY).some((o) => o.key === 'no_eta')).toBe(false)
    const l = dungLich(DANG_VE, [...SAP_DAT, m('no_eta')], TODAY)
    expect(l.find((o) => o.key === 'no_eta')).toMatchObject({ n: 0, sapDat: 1 })
  })
})

describe('khopO / oCua', () => {
  it('ô ngày chỉ khớp đơn rổ 7 ngày đúng ngày đó', () => {
    expect(oCua('week', '2026-10-30T00:00:00Z')).toBe('d:2026-10-30')
    expect(khopO('d:2026-10-30', m('week', '2026-10-30'))).toBe(true)
    expect(khopO('d:2026-10-30', m('week', '2026-10-31'))).toBe(false)
    // Đơn quá hẹn trùng ngày cũ không lọt vào ô ngày.
    expect(khopO('d:2026-10-20', m('overdue', '2026-10-20'))).toBe(false)
  })

  it('?hen=week (trang Hôm nay) = cả 7 ô ngày; tat_ca khớp hết', () => {
    expect(khopO('week', m('week', '2026-11-03'))).toBe(true)
    expect(khopO('week', m('later', '2026-11-10'))).toBe(false)
    expect(khopO('tat_ca', m('no_eta'))).toBe(true)
  })
})

describe('nhãn, thứ tự, ô gần nhất, ngày chờ, đọc URL', () => {
  it('nhãn nhóm và thứ tự: quá hẹn → hôm nay → từng ngày → sau đó → chưa hẹn', () => {
    expect(nhanO('today', TODAY)).toBe('Hôm nay · T3 27/10')
    expect(nhanO('d:2026-10-30', TODAY)).toBe('T6 30/10')
    const keys = [
      'no_eta',
      'later',
      'd:2026-11-01',
      'today',
      'd:2026-10-30',
      'overdue',
    ] as const
    expect([...keys].sort((a, b) => thuTuO(a).localeCompare(thuTuO(b)))).toEqual([
      'overdue',
      'today',
      'd:2026-10-30',
      'd:2026-11-01',
      'later',
      'no_eta',
    ])
  })

  it('ô gần nhất có hàng (bỏ ô đang đứng, bỏ quá hẹn)', () => {
    const l = dungLich(DANG_VE, SAP_DAT, TODAY)
    expect(oCoHangGanNhat(l, 'd:2026-10-28')?.nhan).toBe('T6 30/10')
    expect(oCoHangGanNhat(l, 'd:2026-10-30')?.nhan).toBe('T7 31/10')
  })

  it('ngày chờ NCC xác nhận đếm từ ngày GĐ duyệt (Kimpack duyệt 17/10 → 10 ngày)', () => {
    expect(ngayChoXacNhan('2026-10-17', TODAY)).toBe(10)
    expect(ngayChoXacNhan('2026-10-27T08:00:00Z', TODAY)).toBe(0)
    expect(ngayChoXacNhan(null, TODAY)).toBeNull()
  })

  it('đọc ?hen=: nhận rổ cũ + ô ngày, bỏ giá trị lạ', () => {
    expect(docHen('week')).toBe('week')
    expect(docHen('d:2026-10-30')).toBe('d:2026-10-30')
    expect(docHen('d:30/10')).toBeNull()
    expect(docHen('abc')).toBeNull()
    expect(docHen(null)).toBeNull()
  })
})
