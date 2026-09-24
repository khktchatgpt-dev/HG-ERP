import { describe, expect, it } from 'vitest'
import { VIEWS, VIEW_IDS, resolveView } from './views'
import type { OverviewRow } from '@/modules/dept/production/jobs.service'

const row = (over: Partial<OverviewRow> = {}): OverviewRow =>
  ({
    qty_needed: 100,
    qty_done: 10,
    forecast_date: null,
    lsx: {
      id: 'l1',
      code: 'LSX-01',
      order_codes: [],
      customer_name: 'K',
      status: 'approved',
      priority: 0,
      ship_date: null,
      materials_received_at: null,
      late: null,
    },
    chips: [],
    component_count: 5,
    holder: { who: 'Cung ứng', what: '', since: null, days: 0, closed: false },
    jobs_total: 2,
    jobs_done: 0,
    plan_overdue: 0,
    materials: null,
    ...over,
  }) as OverviewRow

describe('VIEWS — khung nhìn của màn Lệnh sản xuất', () => {
  it('"Tất cả" nhận mọi dòng và luôn đứng đầu', () => {
    expect(VIEWS[0].id).toBe('all')
    expect(VIEWS[0].test(row())).toBe(true)
  })

  it('id không trùng nhau', () => {
    expect(new Set(VIEW_IDS).size).toBe(VIEW_IDS.length)
  })

  it('"Chưa định hình" đếm theo SỐ CHI TIẾT, không theo kế hoạch', () => {
    // Bẫy đã dính 18/09: dùng `qty_needed` (tính từ jobs) thì lệnh đã định hình
    // 306 chi tiết vẫn bị đếm là "chưa định hình" chỉ vì chưa lên lộ trình.
    const test = VIEWS.find((v) => v.id === 'noshape')!.test
    expect(test(row({ component_count: 0, qty_needed: 999 }))).toBe(true)
    expect(test(row({ component_count: 306, qty_needed: 0 }))).toBe(false)
  })

  it('"Chưa lên kế hoạch" là câu hỏi KHÁC, đếm theo jobs', () => {
    const test = VIEWS.find((v) => v.id === 'noplan')!.test
    expect(test(row({ jobs_total: 0, component_count: 306 }))).toBe(true)
    expect(test(row({ jobs_total: 4 }))).toBe(false)
  })

  it('"Trễ hạn xuất" chỉ nhận overdue, KHÔNG nhận at_risk', () => {
    const test = VIEWS.find((v) => v.id === 'late')!.test
    expect(test(row({ lsx: { ...row().lsx, late: 'overdue' } }))).toBe(true)
    expect(test(row({ lsx: { ...row().lsx, late: 'at_risk' } }))).toBe(false)
  })

  it('"Thiếu vật tư" bỏ qua lệnh Kho đã xác nhận về đủ (materials = null)', () => {
    const test = VIEWS.find((v) => v.id === 'short')!.test
    expect(test(row({ materials: null }))).toBe(false)
    expect(
      test(
        row({
          materials: { missing_count: 3, missing_names: [], due_overdue_days: null },
        }),
      ),
    ).toBe(true)
    // Đã bóc nhu cầu mà không thiếu gì → không vào khung nhìn này.
    expect(
      test(
        row({
          materials: { missing_count: 0, missing_names: [], due_overdue_days: null },
        }),
      ),
    ).toBe(false)
  })

  it('"Đã đủ số" không nhận lệnh chưa có mẫu số (qty_needed = 0)', () => {
    // 0/0 không phải là "đã đủ" — nó là "chưa biết".
    const test = VIEWS.find((v) => v.id === 'done')!.test
    expect(test(row({ qty_needed: 0, qty_done: 0 }))).toBe(false)
    expect(test(row({ qty_needed: 100, qty_done: 100 }))).toBe(true)
  })
})

describe('resolveView — lọc tham số ?view= từ ô việc', () => {
  it('nhận id hợp lệ', () => {
    expect(resolveView('late')).toBe('late')
    expect(resolveView('stale')).toBe('stale')
  })

  it('id lạ / rỗng → undefined, màn rơi về "Tất cả" chứ không nổ', () => {
    expect(resolveView('xoa-het')).toBeUndefined()
    expect(resolveView('')).toBeUndefined()
    expect(resolveView(undefined)).toBeUndefined()
  })
})
