import { describe, expect, it } from 'vitest'
import {
  acceptGoesTo,
  addMonthsIso,
  assetCode,
  assetOnDone,
  assetOnReport,
  assetOnStart,
  canIssue,
  docNo,
  dueTxt,
  everyTxt,
  inspectionSoon,
  planDue,
  planState,
  repairStats,
  shortMoney,
  woCost,
} from './may-moc'

const TODAY = '2026-10-21'

describe('hạn bảo trì', () => {
  it('theo tháng: lần trước + chu kỳ, chốt cuối tháng', () => {
    expect(addMonthsIso('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonthsIso('2024-01-31', 1)).toBe('2024-02-29')
    const d = planDue(
      { every_n: 1, unit: 'm', last_date: '2026-09-15', last_hours: null },
      { hours: 0, hours_per_day: 0 },
      TODAY,
    )
    expect(d).toEqual({ date: '2026-10-15', days: -6, hoursLeft: null })
    expect(dueTxt(d)).toBe('quá 6 ngày')
  })

  it('theo ngày', () => {
    const d = planDue(
      { every_n: 14, unit: 'd', last_date: '2026-10-11', last_hours: null },
      { hours: 0, hours_per_day: 0 },
      TODAY,
    )
    expect(d.days).toBe(4)
    expect(dueTxt(d)).toBe('còn 4 ngày')
  })

  it('theo giờ chạy: giờ lần trước + chu kỳ − đồng hồ, quy ra ngày theo 6/7 giờ/ngày', () => {
    // 29.405 + 2.000 − 31.545 = −140 h → đã vượt
    const over = planDue(
      { every_n: 2000, unit: 'h', last_date: '2026-07-14', last_hours: 29405 },
      { hours: 31545, hours_per_day: 18 },
      TODAY,
    )
    expect(over.hoursLeft).toBe(-140)
    expect(over.days).toBeLessThan(0)
    expect(dueTxt(over)).toBe('vượt 140 h')
    // còn 14 h, 14 giờ/ngày → 12 giờ/ngày lịch → 1 ngày
    const soon = planDue(
      { every_n: 40, unit: 'h', last_date: '2026-10-16', last_hours: 6842 },
      { hours: 6868, hours_per_day: 14 },
      TODAY,
    )
    expect(soon.hoursLeft).toBe(14)
    expect(soon.days).toBe(1)
  })

  it('trạng thái và chu kỳ', () => {
    expect([planState(-1), planState(0), planState(7), planState(8)]).toEqual([
      'od',
      'soon',
      'soon',
      'ok',
    ])
    expect([inspectionSoon(30), inspectionSoon(31), inspectionSoon(-1)]).toEqual([
      true,
      false,
      false,
    ])
    expect(everyTxt(2000, 'h')).toBe('2.000 giờ chạy')
    expect(everyTxt(14, 'd')).toBe('2 tuần')
    expect(everyTxt(5, 'd')).toBe('5 ngày')
    expect(everyTxt(36, 'm')).toBe('3 năm')
    expect(everyTxt(3, 'm')).toBe('3 tháng')
  })
})

describe('báo hỏng', () => {
  it('nhận việc: dự toán vượt hạn mức thì chờ GĐ, bằng hạn mức thì sửa luôn', () => {
    expect(acceptGoesTo(18_500_000, 10_000_000)).toBe('cho_duyet')
    expect(acceptGoesTo(10_000_000, 10_000_000)).toBe('dang_sua')
    expect(acceptGoesTo(null, 10_000_000)).toBe('dang_sua')
  })

  it('hành động theo trạng thái', () => {
    expect(canIssue('accept', 'moi')).toBe(true)
    expect(canIssue('accept', 'cho_duyet')).toBe(false)
    expect(canIssue('approve', 'cho_duyet')).toBe(true)
    expect(canIssue('done', 'dang_sua')).toBe(true)
    expect(canIssue('cancel', 'dang_sua')).toBe(false)
  })

  it('trạng thái máy đi theo phiếu', () => {
    expect(assetOnReport('dung_may', 'dang_dung')).toBe('hong')
    expect(assetOnReport('van_chay', 'dang_dung')).toBe('dang_dung')
    expect(assetOnStart('van_chay', 'dang_dung')).toBe('dang_dung')
    expect(assetOnStart('van_chay', 'hong')).toBe('sua_chua')
    expect(assetOnStart('dung_may', 'hong')).toBe('sua_chua')
    expect(assetOnDone('sua_chua')).toBe('dang_dung')
    expect(assetOnDone('chua_dung')).toBe('chua_dung')
  })

  it('chi phí phiếu = vật tư + công', () => {
    expect(
      woCost(
        [
          { name: 'Đầu đốt', qty: 1, price: 1_950_000 },
          { name: 'Can nhiệt', qty: 2, price: 225_000 },
        ],
        0,
      ),
    ).toBe(2_400_000)
    expect(woCost([], 350_000)).toBe(350_000)
  })
})

describe('đánh số + thống kê', () => {
  it('mã tem và số chứng từ', () => {
    expect(assetCode('machine', 'HAN', 4)).toBe('TS-HAN-004')
    expect(assetCode('tool', 'DC', 14)).toBe('CC-DC-014')
    expect(docNo('BH', 7)).toBe('BH-0007')
  })

  it('thống kê chỉ tính phiếu từ mốc', () => {
    const r = repairStats(
      [
        { kind: 'SC', done_on: '2026-08-03', cost: 3_400_000, downtime_hours: 9 },
        { kind: 'BD', done_on: '2026-10-11', cost: 120_000, downtime_hours: 1 },
        { kind: 'KD', done_on: '2025-01-01', cost: 2_000_000, downtime_hours: 0 },
      ],
      '2025-10-21',
    )
    expect(r).toEqual({
      nBD: 1,
      nSC: 1,
      nKD: 0,
      cost: 3_520_000,
      costSC: 3_400_000,
      down: 10,
    })
  })

  it('tiền gọn', () => {
    expect(shortMoney(18_500_000)).toBe('18,5 tr')
    expect(shortMoney(1_200_000_000)).toBe('1,2 tỷ')
    expect(shortMoney(450_000)).toBe('450k')
  })
})
