import { describe, expect, it } from 'vitest'
import { orderProgress, type OrderProgressInput, type Stage } from './order-progress'

const STAGES: Stage[] = [
  { code: 'cnc', label: 'CNC' },
  { code: 'assembly', label: 'Lắp ráp' },
  { code: 'qc', label: 'QC kiểm tra' },
  { code: 'pack', label: 'Đóng gói' },
]

const TODAY = '2026-07-21'

function row(partial: Partial<OrderProgressInput>): OrderProgressInput {
  return {
    status: 'in_production',
    due_date: null,
    lines_bom_pending: 0,
    pos_open: 0,
    production_order_id: 'po-1',
    lsx_status: 'in_progress',
    jobs_total: 0,
    jobs_done: 0,
    ...partial,
  }
}

describe('orderProgress', () => {
  it('đơn huỷ → 0% xám, không xét rủi ro', () => {
    const p = orderProgress(row({ status: 'cancelled' }), STAGES, TODAY)
    expect(p).toEqual({ label: 'Đã huỷ', pct: 0, tone: 'bg-zinc-300' })
  })

  it('đã giao → 100% xanh', () => {
    const p = orderProgress(row({ status: 'delivered' }), STAGES, TODAY)
    expect(p.pct).toBe(100)
    expect(p.tone).toBe('bg-green-500')
  })

  it('chưa phát LSX → 5%', () => {
    const p = orderProgress(
      row({ status: 'confirmed', production_order_id: null, lsx_status: null }),
      STAGES,
      TODAY,
    )
    expect(p).toMatchObject({ label: 'Chưa phát LSX', pct: 5 })
  })

  it('LSX chờ duyệt → 10% + nhãn GĐ', () => {
    const p = orderProgress(
      row({ status: 'lsx_pending', lsx_status: 'pending_approval' }),
      STAGES,
      TODAY,
    )
    expect(p).toMatchObject({ label: 'Chờ GĐ duyệt LSX', pct: 10 })
  })

  it('LSX bị từ chối → đỏ dù không trễ', () => {
    const p = orderProgress(row({ lsx_status: 'rejected' }), STAGES, TODAY)
    expect(p.tone).toBe('bg-red-500')
  })

  it('% tăng theo số công đoạn đã xong (0084)', () => {
    const early = orderProgress(
      row({ lsx_status: 'in_progress', jobs_total: 4, jobs_done: 1 }),
      STAGES,
      TODAY,
    )
    const late = orderProgress(
      row({ lsx_status: 'in_progress', jobs_total: 4, jobs_done: 4 }),
      STAGES,
      TODAY,
    )
    expect(early.pct).toBeLessThan(late.pct)
    // xong 4/4 công đoạn: 15 + 75*4/4 = 90
    expect(late.pct).toBe(90)
  })

  it('nhãn kèm tiến độ công đoạn; chưa lên KH → nhãn chung', () => {
    expect(
      orderProgress(
        row({ lsx_status: 'in_progress', jobs_total: 4, jobs_done: 2 }),
        STAGES,
        TODAY,
      ).label,
    ).toBe('Đang sản xuất (2/4 công đoạn)')
    expect(
      orderProgress(
        row({ lsx_status: 'in_progress', jobs_total: 0, jobs_done: 0 }),
        STAGES,
        TODAY,
      ).label,
    ).toBe('Đang sản xuất')
  })

  it('quá hạn giao → tone đỏ (overdue)', () => {
    const p = orderProgress(
      row({
        lsx_status: 'in_progress',
        jobs_total: 4,
        jobs_done: 1,
        due_date: '2026-07-01',
      }),
      STAGES,
      TODAY,
    )
    expect(p.tone).toBe('bg-red-500')
  })

  it('sát hạn (≤7 ngày) → tone hổ phách (at_risk)', () => {
    const p = orderProgress(
      row({
        lsx_status: 'in_progress',
        jobs_total: 4,
        jobs_done: 1,
        due_date: '2026-07-25',
      }),
      STAGES,
      TODAY,
    )
    expect(p.tone).toBe('bg-amber-500')
  })
})
