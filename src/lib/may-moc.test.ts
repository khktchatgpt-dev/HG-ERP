import { describe, expect, it } from 'vitest'
import {
  acceptGoesTo,
  addMonthsIso,
  assetCode,
  assetOnDone,
  assetOnReport,
  assetOnStart,
  canIssue,
  codeFromScan,
  docNo,
  dueTxt,
  everyTxt,
  agoTxt,
  hoursStale,
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
    expect(dueTxt(d)).toBe('quá hạn 6 ngày')
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
    expect(dueTxt(over)).toBe(`quá hạn ${-over.days} ngày · vượt 140 h`)
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
    expect(everyTxt(14, 'd')).toBe('14 ngày')
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

describe('codeFromScan — chữ đọc từ tem QR → mã máy', () => {
  it('tem in đường dẫn tuyệt đối tới hồ sơ máy', () => {
    expect(codeFromScan('https://erp.hg.vn/may-moc/may/TS-HAN-001')).toBe('TS-HAN-001')
    expect(codeFromScan('http://localhost:3100/may-moc/may/TS-HAN-001?muc=tem')).toBe(
      'TS-HAN-001',
    )
  })
  it('mã có ký tự đã mã hoá trong đường dẫn', () => {
    expect(codeFromScan('https://x/may-moc/may/CC%2DDC%2D002#a')).toBe('CC-DC-002')
  })
  it('gõ tay mã trần, chữ thường, thừa khoảng trắng', () => {
    expect(codeFromScan('  ts-khi-002 ')).toBe('TS-KHI-002')
  })
  it('rỗng thì trả rỗng để màn báo "gõ mã"', () => {
    expect(codeFromScan('   ')).toBe('')
  })
})

describe('giờ chạy chưa cập nhật', () => {
  const m = {
    kind: 'machine' as const,
    status: 'dang_dung' as const,
    hours_per_day: 8,
    hours_updated_on: '2026-10-07',
  }
  it('đúng 14 ngày chưa tính, 15 ngày thì tính', () => {
    expect(hoursStale(m, TODAY)).toBe(false)
    expect(hoursStale({ ...m, hours_updated_on: '2026-10-06' }, TODAY)).toBe(true)
  })
  it('chưa đọc lần nào thì tính', () => {
    expect(hoursStale({ ...m, hours_updated_on: null }, TODAY)).toBe(true)
  })
  it('máy không có đồng hồ giờ, chưa đưa vào dùng, dụng cụ, đã thanh lý thì không', () => {
    const old = { ...m, hours_updated_on: null }
    expect(hoursStale({ ...old, hours_per_day: 0 }, TODAY)).toBe(false)
    expect(hoursStale({ ...old, status: 'chua_dung' }, TODAY)).toBe(false)
    expect(hoursStale({ ...old, kind: 'tool' }, TODAY)).toBe(false)
    expect(hoursStale({ ...old, status: 'thanh_ly' }, TODAY)).toBe(false)
  })
})

describe('lúc báo, kể tương đối như demo', () => {
  // 10:00 ngày 21/10/2026 giờ VN = 03:00Z
  const now = new Date('2026-10-21T03:00:00Z')
  it('phút, giờ trong ngày', () => {
    expect(agoTxt('2026-10-21T02:59:40Z', now)).toBe('vừa xong')
    expect(agoTxt('2026-10-21T02:35:00Z', now)).toBe('25 phút trước')
    expect(agoTxt('2026-10-20T18:00:00Z', now)).toBe('9 giờ trước') // 01:00 sáng nay giờ VN
  })
  it('qua nửa đêm giờ VN là hôm qua, không theo UTC', () => {
    expect(agoTxt('2026-10-20T16:30:00Z', now)).toBe('hôm qua') // 23:30 hôm qua giờ VN
    expect(agoTxt('2026-10-16T03:00:00Z', now)).toBe('5 ngày trước')
  })
  it('quá 30 ngày thì ghi ngày', () => {
    expect(agoTxt('2026-09-01T03:00:00Z', now)).toBe('01/09/2026')
  })
})
