import { describe, it, expect } from 'vitest'
import { assessLateRisk, assessPoLate } from './late-risk'

const base = {
  status: 'in_production',
  due_date: '2026-07-15',
  lines_bom_pending: 0,
  pos_open: 0,
  production_order_id: 'lsx1',
  lsx_status: 'in_progress',
}
const TODAY = '2026-07-09'

describe('assessLateRisk (FR-SAL-09)', () => {
  it('trong horizon 7 ngày → at_risk; quá hạn → overdue', () => {
    expect(assessLateRisk(base, TODAY)?.level).toBe('at_risk')
    expect(assessLateRisk({ ...base, due_date: '2026-07-08' }, TODAY)?.level).toBe(
      'overdue',
    )
  })

  it('còn xa hạn (> horizon) / không có hạn giao / trạng thái cuối → null', () => {
    expect(assessLateRisk({ ...base, due_date: '2026-08-01' }, TODAY)).toBeNull()
    expect(assessLateRisk({ ...base, due_date: null }, TODAY)).toBeNull()
    for (const status of ['completed', 'delivered', 'cancelled']) {
      expect(
        assessLateRisk({ ...base, status, due_date: '2026-07-01' }, TODAY),
      ).toBeNull()
    }
  })

  it('gom đủ lý do: chưa LSX / BOM / vật tư', () => {
    const risk = assessLateRisk(
      {
        ...base,
        production_order_id: null,
        lsx_status: null,
        lines_bom_pending: 2,
        pos_open: 1,
      },
      TODAY,
    )
    expect(risk?.reasons).toEqual([
      'Chưa phát LSX',
      '2 dòng SP chưa xong BOM',
      '1 đơn vật tư chưa về đủ',
    ])
  })

  it('LSX chờ duyệt / chưa vào SX được nêu đúng lý do', () => {
    expect(
      assessLateRisk({ ...base, lsx_status: 'pending_approval' }, TODAY)?.reasons,
    ).toContain('LSX chờ GĐ duyệt')
    expect(assessLateRisk({ ...base, lsx_status: 'approved' }, TODAY)?.reasons).toContain(
      'Chưa vào sản xuất',
    )
  })

  it('đúng biên: hạn = hôm nay → at_risk; hạn = hôm nay + 7 → at_risk; +8 → null', () => {
    expect(assessLateRisk({ ...base, due_date: '2026-07-09' }, TODAY)?.level).toBe(
      'at_risk',
    )
    expect(assessLateRisk({ ...base, due_date: '2026-07-16' }, TODAY)?.level).toBe(
      'at_risk',
    )
    expect(assessLateRisk({ ...base, due_date: '2026-07-17' }, TODAY)).toBeNull()
  })
})

describe('assessPoLate — PO quá hẹn giao NCC (thu mua)', () => {
  it('quá hẹn → overdue; trong horizon → due_soon; còn xa → null', () => {
    expect(assessPoLate({ status: 'ordered', expected_at: '2026-07-08' }, TODAY)).toBe(
      'overdue',
    )
    expect(assessPoLate({ status: 'in_transit', expected_at: '2026-07-12' }, TODAY)).toBe(
      'due_soon',
    )
    expect(
      assessPoLate({ status: 'ordered', expected_at: '2026-08-01' }, TODAY),
    ).toBeNull()
  })

  it('PO đã về đủ / đã huỷ / không hẹn giao → null dù quá ngày', () => {
    expect(
      assessPoLate({ status: 'received', expected_at: '2026-07-01' }, TODAY),
    ).toBeNull()
    expect(
      assessPoLate({ status: 'cancelled', expected_at: '2026-07-01' }, TODAY),
    ).toBeNull()
    expect(assessPoLate({ status: 'ordered', expected_at: null }, TODAY)).toBeNull()
  })

  it('về một phần (partial) quá hẹn vẫn cảnh báo — phần thiếu là nghẽn SX', () => {
    expect(assessPoLate({ status: 'partial', expected_at: '2026-07-01' }, TODAY)).toBe(
      'overdue',
    )
  })

  it('đúng biên: hẹn = hôm nay → due_soon (chưa quá); hôm nay + 7 → due_soon; +8 → null', () => {
    expect(assessPoLate({ status: 'ordered', expected_at: '2026-07-09' }, TODAY)).toBe(
      'due_soon',
    )
    expect(assessPoLate({ status: 'ordered', expected_at: '2026-07-16' }, TODAY)).toBe(
      'due_soon',
    )
    expect(
      assessPoLate({ status: 'ordered', expected_at: '2026-07-17' }, TODAY),
    ).toBeNull()
  })
})
