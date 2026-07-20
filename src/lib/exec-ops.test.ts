import { describe, expect, it } from 'vitest'
import {
  bucketByWeek,
  defectByTeam,
  defectStats,
  isBigApproval,
  orderSyncPct,
  teamStatusColor,
  topDefectReasons,
  weekStartIso,
  wipBetweenStages,
  UNCLASSIFIED_REASON,
  type SlimOutputEntry,
} from './exec-ops'

describe('isBigApproval — ngưỡng 50 triệu', () => {
  it('biên đúng tại 50_000_000', () => {
    expect(isBigApproval(49_999_999)).toBe(false)
    expect(isBigApproval(50_000_000)).toBe(true)
    expect(isBigApproval(120_000_000)).toBe(true)
  })
})

describe('weekStartIso — thứ Hai đầu tuần (UTC)', () => {
  it('thứ Hai trả chính nó; Chủ nhật trả thứ Hai TRƯỚC đó', () => {
    expect(weekStartIso('2026-07-20')).toBe('2026-07-20') // 20/07/2026 = thứ Hai
    expect(weekStartIso('2026-07-26')).toBe('2026-07-20') // Chủ nhật
    expect(weekStartIso('2026-07-22')).toBe('2026-07-20') // thứ Tư
  })

  it('qua ranh giới tháng/năm', () => {
    expect(weekStartIso('2026-08-01')).toBe('2026-07-27') // thứ Bảy đầu tháng 8
    expect(weekStartIso('2026-01-01')).toBe('2025-12-29') // đầu năm lùi về năm trước
  })
})

describe('bucketByWeek — gộp tuần cho chart', () => {
  const E = (d: string, qty: number, defect = 0) => ({
    entry_date: d,
    qty,
    defect_qty: defect,
  })

  it('đủ N tuần kể cả tuần trống, cũ → mới, cộng dồn đúng', () => {
    const out = bucketByWeek(
      [E('2026-07-20', 100), E('2026-07-22', 50, 3), E('2026-07-07', 30)],
      3,
      '2026-07-20',
    )
    expect(out).toHaveLength(3)
    expect(out.map((b) => b.week_start)).toEqual([
      '2026-07-06',
      '2026-07-13',
      '2026-07-20',
    ])
    expect(out[0]).toMatchObject({ qty: 30 })
    expect(out[1]).toMatchObject({ qty: 0 }) // tuần trống vẫn có mặt
    expect(out[2]).toMatchObject({ qty: 150, defect: 3 })
  })

  it('entry ngoài khoảng bị bỏ', () => {
    const out = bucketByWeek([E('2026-05-01', 999)], 2, '2026-07-20')
    expect(out.every((b) => b.qty === 0)).toBe(true)
  })
})

describe('wipBetweenStages — BTP ứ giữa 2 công đoạn kế tiếp', () => {
  const ORDER = ['phoi', 'han', 'son']

  it('done trước > sau → dương; sau > trước → 0 (không âm); cộng dồn nhiều chi tiết', () => {
    const out = wipBetweenStages(
      [
        {
          stages: [
            { stage: 'phoi', done: 1000 },
            { stage: 'han', done: 200 },
            { stage: 'son', done: 300 },
          ],
        },
        {
          stages: [
            { stage: 'phoi', done: 50 },
            { stage: 'han', done: 40 },
            { stage: 'son', done: 0 },
          ],
        },
      ],
      ORDER,
    )
    expect(out).toEqual([
      { from: 'phoi', to: 'han', wip: 810 }, // 800 + 10
      { from: 'han', to: 'son', wip: 40 }, // max(0, 200-300)=0 + 40
    ])
  })

  it('chi tiết thiếu 1 trong 2 công đoạn → bỏ qua cặp đó', () => {
    const out = wipBetweenStages(
      [
        {
          stages: [
            { stage: 'phoi', done: 100 },
            { stage: 'son', done: 0 },
          ],
        },
      ],
      ORDER,
    )
    expect(out).toEqual([
      { from: 'phoi', to: 'han', wip: 0 },
      { from: 'han', to: 'son', wip: 0 },
    ])
  })

  it('5 công đoạn → 4 cặp', () => {
    expect(wipBetweenStages([], ['a', 'b', 'c', 'd', 'e'])).toHaveLength(4)
  })
})

describe('teamStatusColor — màu ô tổ trên sơ đồ xưởng', () => {
  it('sự cố mở thắng mọi thứ → red', () => {
    expect(
      teamStatusColor({ hasOpenIncident: true, doing: 0, todayQty: 100, wipBefore: 0 }),
    ).toBe('red')
  })

  it('đang có việc mà hôm nay chưa ghi sản lượng → yellow', () => {
    expect(
      teamStatusColor({ hasOpenIncident: false, doing: 2, todayQty: 0, wipBefore: 0 }),
    ).toBe('yellow')
  })

  it('BTP ứ trước tổ vượt ngưỡng → yellow', () => {
    expect(
      teamStatusColor({ hasOpenIncident: false, doing: 0, todayQty: 0, wipBefore: 51 }),
    ).toBe('yellow')
    expect(
      teamStatusColor({
        hasOpenIncident: false,
        doing: 0,
        todayQty: 0,
        wipBefore: 51,
        wipAlert: 100,
      }),
    ).toBe('green') // ngưỡng tuỳ chỉnh
  })

  it('tổ rảnh (không việc, không sản lượng) → green — rảnh không phải lỗi', () => {
    expect(
      teamStatusColor({ hasOpenIncident: false, doing: 0, todayQty: 0, wipBefore: 0 }),
    ).toBe('green')
    expect(
      teamStatusColor({ hasOpenIncident: false, doing: 1, todayQty: 30, wipBefore: 0 }),
    ).toBe('green')
  })
})

describe('defectStats — tỷ lệ phế chia 0 an toàn', () => {
  it('SL 0 → rate 0', () => {
    expect(defectStats([])).toEqual({ qty: 0, defect: 0, rate: 0 })
  })

  it('tính đúng tỷ lệ', () => {
    const s = defectStats([
      { qty: 90, defect_qty: 5 },
      { qty: 10, defect_qty: 5 },
    ])
    expect(s).toMatchObject({ qty: 100, defect: 10, rate: 0.1 })
  })
})

const SLIM = (
  team: string | null,
  qty: number,
  defect: number,
  reason: string | null,
): SlimOutputEntry => ({
  production_order_id: 'lsx1',
  component_id: 'c1',
  stage: 'han',
  team_department_id: team,
  entry_date: '2026-07-20',
  qty,
  defect_qty: defect,
  defect_reason: reason,
})

describe('defectByTeam + topDefectReasons — root cause drill-down', () => {
  it('gộp theo tổ, null gộp riêng', () => {
    const m = defectByTeam([
      SLIM('t1', 100, 2, null),
      SLIM('t1', 50, 1, null),
      SLIM(null, 10, 0, null),
    ])
    expect(m.get('t1')).toEqual({ qty: 150, defect: 3 })
    expect(m.get(null)).toEqual({ qty: 10, defect: 0 })
  })

  it('top nguyên nhân: đúng tổ, sort desc, null → Chưa phân loại, code lạ → raw', () => {
    const labels = new Map([['han_nut', 'Nứt mối hàn']])
    const out = topDefectReasons(
      [
        SLIM('t1', 100, 5, 'han_nut'),
        SLIM('t1', 100, 8, null), // bản ghi cũ trước 0067
        SLIM('t1', 100, 2, 'code_da_xoa'),
        SLIM('t2', 100, 99, 'han_nut'), // tổ khác — không tính
        SLIM('t1', 100, 0, 'han_nut'), // phế 0 — không tạo dòng
      ],
      't1',
      labels,
    )
    expect(out).toEqual([
      { code: null, label: UNCLASSIFIED_REASON, count: 8 },
      { code: 'han_nut', label: 'Nứt mối hàn', count: 5 },
      { code: 'code_da_xoa', label: 'code_da_xoa', count: 2 },
    ])
  })
})

describe('orderSyncPct — %HT đồng bộ của đơn', () => {
  it('không dòng nào có bảng chi tiết → 0; qty 0 → 0', () => {
    expect(orderSyncPct([{ qty: 10, synced_sets: 5, has_components: false }])).toBe(0)
    expect(orderSyncPct([{ qty: 0, synced_sets: 0, has_components: true }])).toBe(0)
  })

  it('tính đúng + cap 1 khi nhập dư', () => {
    expect(
      orderSyncPct([
        { qty: 100, synced_sets: 25, has_components: true },
        { qty: 100, synced_sets: 75, has_components: true },
        { qty: 999, synced_sets: 0, has_components: false }, // bỏ qua
      ]),
    ).toBe(0.5)
    expect(orderSyncPct([{ qty: 10, synced_sets: 99, has_components: true }])).toBe(1)
  })
})
