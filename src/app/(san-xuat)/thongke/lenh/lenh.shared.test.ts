import { describe, expect, it } from 'vitest'
import { daysBetween, dueText, snagOf, stripOf } from './lenh.shared'
import type { OverviewRow } from '@/modules/dept/production/jobs.service'

const row = (over: Partial<OverviewRow> = {}): OverviewRow =>
  ({
    qty_needed: 100,
    qty_done: 10,
    sets_needed: 100,
    sets_done: 10,
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
    jobs_no_end: 0,
    materials: null,
    ...over,
  }) as OverviewRow

describe('Lệnh sản xuất — phần thuần (bản vẽ 1, 06/11/2026)', () => {
  it('ngày tới hạn tính từ hai chuỗi ngày, không đọc đồng hồ máy', () => {
    expect(daysBetween('2026-11-06', '2026-10-10')).toBe(-27)
    expect(daysBetween('2026-11-06', '2026-11-06')).toBe(0)
    expect(daysBetween('2026-11-06', '2026-11-29')).toBe(23)
    expect(dueText(-27)).toEqual({ text: 'trễ 27đ', tone: 'stop' })
    expect(dueText(0)).toEqual({ text: 'HÔM NAY', tone: 'warn' })
    expect(dueText(5)).toEqual({ text: 'còn 5đ', tone: 'warn' })
    expect(dueText(23)).toEqual({ text: 'còn 23đ', tone: null })
  })

  it('vướng gì: một câu, thứ cấp nhất, kèm màn gỡ', () => {
    const m = (missing_count: number, due_overdue_days: number | null) => ({
      missing_count,
      missing_names: [],
      due_overdue_days,
    })
    expect(snagOf(row({ materials: m(8, 7), component_count: 0 }), true)).toMatchObject({
      text: 'vật tư quá hẹn 7 ngày · thiếu 8 mã',
      tone: 'stop',
      go: 'vat-tu',
    })
    // Thiếu vật tư + chưa định hình → chỉ nói thiếu vật tư (chip vẫn đếm).
    expect(
      snagOf(row({ materials: m(16, null), component_count: 0 }), true),
    ).toMatchObject({
      text: 'thiếu 16 mã vật tư',
      go: 'vat-tu',
    })
    expect(snagOf(row({ component_count: 0 }), true)).toMatchObject({
      text: 'chưa có bảng chi tiết (chờ Kỹ thuật)',
      go: 'lo-trinh',
    })
    expect(snagOf(row({ jobs_total: 0 }), true)).toMatchObject({
      text: 'chưa giao tổ & hạn',
      go: 'giao-to',
    })
    expect(snagOf(row({ plan_overdue: 3 }), true)).toMatchObject({
      text: '3 việc quá hạn kế hoạch',
      go: 'mo',
    })
    expect(snagOf(row({ jobs_total: 4 }), true)).toMatchObject({
      text: 'không vướng · 4 việc đã giao tổ',
      tone: 'done',
      go: 'ghi-so',
    })
    // Không được ghi sổ → đường gỡ là Mở, không chào nút người này không bấm được.
    expect(snagOf(row({ jobs_total: 4 }), false).go).toBe('mo')
  })

  it('dải công đoạn theo thứ tự danh mục: ô sọc ≠ ô 0%, tóm tắt chỉ kể lộ trình', () => {
    const stages = [
      { code: 'phoi', label: 'Phôi' },
      { code: 'han', label: 'Hàn' },
      { code: 'may', label: 'May' },
    ]
    const { cells, summary } = stripOf(
      [
        { stage: 'han', label: 'Hàn', total: 40, done: 10, doing: 2 },
        { stage: 'phoi', label: 'Phôi', total: 40, done: 40, doing: 0 },
      ],
      stages,
    )
    expect(cells.map((c) => c.pct)).toEqual([100, 25, null])
    expect(cells[1].title).toBe('Hàn: 10/40 · 2 đang làm')
    expect(cells[2].title).toBe('May: không trong lộ trình')
    expect(summary).toBe('Tiến độ công đoạn — Phôi 100%, Hàn 25%')
    expect(stripOf([], stages).summary).toBe(
      'Chưa có công đoạn nào trong lộ trình của lệnh này',
    )
  })
})
