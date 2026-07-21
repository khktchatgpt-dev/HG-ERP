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
    current_stage: null,
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

  it('% tăng theo vị trí công đoạn', () => {
    const cnc = orderProgress(row({ current_stage: 'cnc' }), STAGES, TODAY)
    const pack = orderProgress(row({ current_stage: 'pack' }), STAGES, TODAY)
    expect(cnc.pct).toBeLessThan(pack.pct)
    // pack là công đoạn cuối (idx 3/4): 15 + 75*4/4 = 90
    expect(pack.pct).toBe(90)
  })

  it('nhãn thân thiện theo tên công đoạn (QC / đóng gói)', () => {
    expect(orderProgress(row({ current_stage: 'qc' }), STAGES, TODAY).label).toBe(
      'Đang QC',
    )
    expect(orderProgress(row({ current_stage: 'pack' }), STAGES, TODAY).label).toBe(
      'Đang đóng gói',
    )
  })

  it('quá hạn giao → tone đỏ (overdue)', () => {
    const p = orderProgress(
      row({ current_stage: 'cnc', due_date: '2026-07-01' }),
      STAGES,
      TODAY,
    )
    expect(p.tone).toBe('bg-red-500')
  })

  it('sát hạn (≤7 ngày) → tone hổ phách (at_risk)', () => {
    const p = orderProgress(
      row({ current_stage: 'cnc', due_date: '2026-07-25' }),
      STAGES,
      TODAY,
    )
    expect(p.tone).toBe('bg-amber-500')
  })
})
