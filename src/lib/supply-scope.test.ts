import { describe, expect, it } from 'vitest'
import {
  defaultScope,
  inferSupplierBuyer,
  isMyPo,
  myLsxIds,
  mySupplierIds,
  parseScope,
} from './supply-scope'

describe('supply-scope — một nghĩa "của tôi" cho mọi màn Cung ứng', () => {
  it('phạm vi mặc định theo vai: người duyệt nhìn cả phòng, người mua nhìn của mình', () => {
    expect(defaultScope({ canApprove: true })).toBe('phong')
    expect(defaultScope({ canApprove: false })).toBe('toi')
  })

  it('đọc ?pham_vi= — rác thì null để mặc định quyết', () => {
    expect(parseScope('toi')).toBe('toi')
    expect(parseScope('phong')).toBe('phong')
    expect(parseScope('abc')).toBeNull()
    expect(parseScope(undefined)).toBeNull()
  })

  it('đơn của tôi: người phụ trách, rỗng thì người tạo (cùng luật assertPoOwner)', () => {
    expect(isMyPo({ assigned_to: 'u1', created_by: 'u2' }, 'u1')).toBe(true)
    expect(isMyPo({ assigned_to: 'u1', created_by: 'u2' }, 'u2')).toBe(false)
    expect(isMyPo({ assigned_to: null, created_by: 'u2' }, 'u2')).toBe(true)
    expect(isMyPo({ assigned_to: 'u1' }, null)).toBe(false)
  })

  it('lệnh của tôi gồm cả lệnh GỘP, bỏ đơn đã huỷ', () => {
    const ids = myLsxIds(
      [
        {
          status: 'approved',
          assigned_to: 'u1',
          production_order_id: 'L9',
          extra_lsx_ids: ['L10'],
        },
        { status: 'cancelled', assigned_to: 'u1', production_order_id: 'L7' },
        { status: 'ordered', assigned_to: 'u2', production_order_id: 'L8' },
      ],
      'u1',
    )
    expect([...ids].sort()).toEqual(['L10', 'L9'])
  })

  it('NCC của tôi: gán tay thắng lịch sử; chưa gán thì suy từ đơn', () => {
    const sup = [
      { id: 'A', buyer_id: null }, // tôi từng đặt → của tôi
      { id: 'B', buyer_id: 'u2' }, // tôi từng đặt nhưng đã gán người khác → không
      { id: 'C', buyer_id: 'u1' }, // gán cho tôi dù chưa đặt → của tôi
      { id: 'D', buyer_id: null }, // chưa ai đặt → không
    ]
    const pos = [
      { supplier_id: 'A', assigned_to: 'u1' },
      { supplier_id: 'B', assigned_to: 'u1' },
    ]
    expect([...mySupplierIds(sup, pos, 'u1')].sort()).toEqual(['A', 'C'])
  })

  it('suy người phụ trách NCC: nhiều đơn nhất, hoà thì người đặt gần nhất', () => {
    const m = inferSupplierBuyer([
      { supplier_id: 'A', assigned_to: 'u1', created_at: '2026-08-01' },
      { supplier_id: 'A', assigned_to: 'u1', created_at: '2026-08-05' },
      { supplier_id: 'A', assigned_to: 'u2', created_at: '2026-09-20' },
      { supplier_id: 'B', assigned_to: 'u1', created_at: '2026-08-01' },
      { supplier_id: 'B', assigned_to: 'u2', created_at: '2026-09-01' },
    ])
    expect(m.get('A')).toBe('u1')
    expect(m.get('B')).toBe('u2')
  })
})
