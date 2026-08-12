import { describe, expect, it } from 'vitest'
import {
  checkReceiptAgainstPo,
  describeOverReceipt,
  type ReceiptPoLine,
} from './po-receipt'

const line = (over: Partial<ReceiptPoLine> = {}): ReceiptPoLine => ({
  id: 'L1',
  material_id: 'M1',
  qty_missing: 100,
  material_name: 'Thép hộp 25x50',
  material_unit: 'cây',
  ...over,
})

describe('checkReceiptAgainstPo', () => {
  it('nhận đúng phần còn thiếu là hợp lệ', () => {
    const r = checkReceiptAgainstPo(
      [{ material_id: 'M1', qty: 100, po_line_id: 'L1' }],
      [line()],
    )
    expect(r).toEqual({ ok: true, over: [] })
  })

  it('nhận thiếu vẫn hợp lệ (giao nhiều đợt)', () => {
    const r = checkReceiptAgainstPo(
      [{ material_id: 'M1', qty: 40, po_line_id: 'L1' }],
      [line()],
    )
    expect(r.ok && r.over).toEqual([])
  })

  it('chặn dòng không thuộc PO đang nhập', () => {
    const r = checkReceiptAgainstPo(
      [{ material_id: 'M1', qty: 10, po_line_id: 'L-cua-PO-khac' }],
      [line()],
    )
    expect(r).toEqual({ ok: false, reason: 'unknown_line' })
  })

  it('chặn dòng thiếu po_line_id', () => {
    const r = checkReceiptAgainstPo(
      [{ material_id: 'M1', qty: 10, po_line_id: null }],
      [line()],
    )
    expect(r).toEqual({ ok: false, reason: 'unknown_line' })
  })

  it('chặn nhập vật tư khác vào dòng PO', () => {
    const r = checkReceiptAgainstPo(
      [{ material_id: 'M-go', qty: 10, po_line_id: 'L1' }],
      [line()],
    )
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toBe('material_mismatch')
  })

  it('nêu phần vượt khi nhận quá số còn thiếu', () => {
    const r = checkReceiptAgainstPo(
      [{ material_id: 'M1', qty: 1000, po_line_id: 'L1' }],
      [line()],
    )
    expect(r.ok && r.over).toEqual([
      {
        po_line_id: 'L1',
        material_name: 'Thép hộp 25x50',
        material_unit: 'cây',
        qty_received: 1000,
        qty_missing: 100,
      },
    ])
  })

  it('QC loại vẫn tính là NCC đã giao (đúng công thức view 0080)', () => {
    // Đặt còn thiếu 100: nhận 90 đạt + 20 loại = NCC đã giao 110 → vượt.
    const r = checkReceiptAgainstPo(
      [{ material_id: 'M1', qty: 90, qty_rejected: 20, po_line_id: 'L1' }],
      [line()],
    )
    expect(r.ok && r.over[0]?.qty_received).toBe(110)
  })

  it('cộng dồn nhiều dòng phiếu cùng trỏ một dòng PO', () => {
    // Tách 2 kệ, mỗi kệ 60 — từng dòng đều dưới 100 nhưng tổng thì vượt.
    const r = checkReceiptAgainstPo(
      [
        { material_id: 'M1', qty: 60, po_line_id: 'L1' },
        { material_id: 'M1', qty: 60, po_line_id: 'L1' },
      ],
      [line()],
    )
    expect(r.ok && r.over).toHaveLength(1)
    expect(r.ok && r.over[0]?.qty_received).toBe(120)
  })

  it('dòng PO đã về đủ thì nhận thêm là vượt', () => {
    const r = checkReceiptAgainstPo(
      [{ material_id: 'M1', qty: 5, po_line_id: 'L1' }],
      [line({ qty_missing: 0 })],
    )
    expect(r.ok && r.over).toHaveLength(1)
  })

  it('bỏ qua lệch số thực li ti (0.1 + 0.2)', () => {
    const r = checkReceiptAgainstPo(
      [
        { material_id: 'M1', qty: 0.1, po_line_id: 'L1' },
        { material_id: 'M1', qty: 0.2, po_line_id: 'L1' },
      ],
      [line({ qty_missing: 0.3 })],
    )
    expect(r.ok && r.over).toEqual([])
  })

  it('chỉ nêu đúng dòng vượt khi phiếu có nhiều dòng', () => {
    const r = checkReceiptAgainstPo(
      [
        { material_id: 'M1', qty: 50, po_line_id: 'L1' },
        { material_id: 'M2', qty: 99, po_line_id: 'L2' },
      ],
      [
        line(),
        line({ id: 'L2', material_id: 'M2', qty_missing: 10, material_name: 'Ốc vít' }),
      ],
    )
    expect(r.ok && r.over.map((o) => o.po_line_id)).toEqual(['L2'])
  })
})

describe('describeOverReceipt', () => {
  it('ghép câu đọc được cho thông báo lỗi', () => {
    const msg = describeOverReceipt([
      {
        po_line_id: 'L1',
        material_name: 'Thép hộp 25x50',
        material_unit: 'cây',
        qty_received: 1000,
        qty_missing: 100,
      },
    ])
    expect(msg).toContain('Thép hộp 25x50')
    expect(msg).toContain('còn thiếu')
  })
})
