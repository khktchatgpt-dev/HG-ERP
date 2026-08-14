import { describe, it, expect } from 'vitest'
import { orderGate, GATE_ORDER, type GateInput } from './order-gate'

/** Đơn "khoẻ mạnh" đã ký lệnh, định mức xong, vật tư về đủ, đang chạy. */
const base: GateInput = {
  status: 'lsx_issued',
  production_order_id: 'lsx1',
  lsx_status: 'approved',
  lines_bom_pending: 0,
  pos_open: 0,
  pos_unsent: 0,
  pos_total: 2,
  materials_received_at: '2026-08-01T00:00:00Z',
  jobs_total: 10,
  jobs_done: 4,
}
const at = (over: Partial<GateInput>) => orderGate({ ...base, ...over })

describe('orderGate — trước khi lệnh được ký', () => {
  it('chưa phát lệnh → Kinh doanh giữ bóng', () => {
    const g = at({ production_order_id: null, status: 'confirmed' })
    expect(g.key).toBe('lsx_none')
    expect(g.owner).toBe('Kinh doanh')
  })

  it('lệnh đang chờ ký → Ban Giám đốc', () => {
    expect(at({ lsx_status: 'pending_approval' }).owner).toBe('Ban Giám đốc')
  })

  it('lệnh bị trả → về lại Kinh doanh sửa', () => {
    const g = at({ lsx_status: 'rejected' })
    expect(g.key).toBe('lsx_rejected')
    expect(g.owner).toBe('Kinh doanh')
  })
})

describe('orderGate — đoạn SAU khi ký lệnh (chỗ orderProgress gộp làm một)', () => {
  it('còn SP chưa chốt định mức → Kỹ thuật, nói rõ còn bao nhiêu', () => {
    const g = at({ lines_bom_pending: 16, materials_received_at: null, pos_total: 0 })
    expect(g.key).toBe('bom')
    expect(g.owner).toBe('Kỹ thuật')
    expect(g.detail).toContain('16 sản phẩm')
  })

  it('định mức xong mà chưa lập đơn mua nào → Cung ứng', () => {
    const g = at({ pos_total: 0, materials_received_at: null })
    expect(g.key).toBe('po_none')
    expect(g.owner).toBe('Cung ứng')
  })

  it('đơn mua còn nháp/chờ ký → Cung ứng, KHÔNG phải nhà cung cấp', () => {
    // Phân biệt này là lý do 0133 tách pos_unsent: đơn chưa gửi thì giục mình,
    // không phải giục NCC.
    const g = at({ pos_unsent: 2, pos_total: 2, materials_received_at: null })
    expect(g.key).toBe('po_unsent')
    expect(g.owner).toBe('Cung ứng')
  })

  it('đơn mua đã gửi, đang chờ hàng → Nhà cung cấp', () => {
    const g = at({ pos_open: 3, pos_total: 3, materials_received_at: null })
    expect(g.key).toBe('material')
    expect(g.owner).toBe('Nhà cung cấp')
  })

  it('chưa gửi thắng đang-về khi có cả hai — giục mình trước khi giục người', () => {
    const g = at({
      pos_open: 1,
      pos_unsent: 1,
      pos_total: 2,
      materials_received_at: null,
    })
    expect(g.key).toBe('po_unsent')
  })

  it('vật tư về đủ mà chưa có lộ trình → Kế hoạch SX', () => {
    const g = at({ jobs_total: 0, jobs_done: 0 })
    expect(g.key).toBe('plan')
    expect(g.owner).toBe('Kế hoạch SX')
  })

  it('đang chạy công đoạn → Xưởng, kèm số công đoạn đã xong', () => {
    const g = at({})
    expect(g.key).toBe('production')
    expect(g.owner).toBe('Xưởng')
    expect(g.detail).toContain('4/10')
  })

  it('PO đã nhận hết nhưng Kho chưa bấm xác nhận → vẫn đi tiếp, không kẹt giả', () => {
    // pos_total>0, không còn open/unsent, materials_received_at null.
    const g = at({ materials_received_at: null, pos_total: 2, jobs_total: 0 })
    expect(g.key).toBe('plan')
  })
})

describe('orderGate — điểm cuối', () => {
  it('hoàn thành → chờ giao (Kho); đã giao / đã huỷ → done', () => {
    expect(at({ status: 'completed' }).key).toBe('to_deliver')
    expect(at({ status: 'delivered' }).done).toBe(true)
    expect(at({ status: 'cancelled' }).done).toBe(true)
  })

  it('đơn đã huỷ không bị suy theo lệnh còn dở', () => {
    const g = at({ status: 'cancelled', lines_bom_pending: 9 })
    expect(g.key).toBe('cancelled')
  })
})

describe('orderGate — bất biến', () => {
  it('mọi bậc trả về đều nằm trong GATE_ORDER (trừ cancelled)', () => {
    const keys = [
      at({ production_order_id: null }),
      at({ lsx_status: 'pending_approval' }),
      at({ lsx_status: 'rejected' }),
      at({ lines_bom_pending: 1, materials_received_at: null }),
      at({ pos_total: 0, materials_received_at: null }),
      at({ pos_unsent: 1, materials_received_at: null }),
      at({ pos_open: 1, materials_received_at: null }),
      at({ jobs_total: 0 }),
      at({}),
      at({ status: 'completed' }),
      at({ status: 'delivered' }),
    ].map((g) => g.key)
    for (const k of keys) expect(GATE_ORDER).toContain(k)
  })

  it('step tăng dần đúng thứ tự chuỗi', () => {
    const steps = GATE_ORDER.filter((k) => k !== 'lsx_rejected').map((k) => {
      switch (k) {
        case 'lsx_none':
          return at({ production_order_id: null }).step
        case 'lsx_pending':
          return at({ lsx_status: 'pending_approval' }).step
        case 'bom':
          return at({ lines_bom_pending: 1, materials_received_at: null }).step
        case 'po_none':
          return at({ pos_total: 0, materials_received_at: null }).step
        case 'po_unsent':
          return at({ pos_unsent: 1, materials_received_at: null }).step
        case 'material':
          return at({ pos_open: 1, materials_received_at: null }).step
        case 'plan':
          return at({ jobs_total: 0 }).step
        case 'production':
          return at({}).step
        case 'to_deliver':
          return at({ status: 'completed' }).step
        default:
          return at({ status: 'delivered' }).step
      }
    })
    const sorted = [...steps].sort((a, b) => a - b)
    expect(steps).toEqual(sorted)
  })
})
