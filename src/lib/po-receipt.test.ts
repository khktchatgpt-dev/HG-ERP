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
    expect(r).toEqual({ ok: true, over: [], within: [] })
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

/*
 * DUNG SAI NHẬN VƯỢT (0156 — GĐ B): pct đặt trên vật tư, ngưỡng tính trên SL
 * đặt CỘNG DỒN. pct=0/thiếu trường = hành vi cũ nguyên vẹn (regression).
 */
describe('checkReceiptAgainstPo — dung sai (0156)', () => {
  const tolLine = (over: Partial<ReceiptPoLine> = {}) =>
    line({ qty_ordered: 1000, qty_missing: 1000, over_tolerance_pct: 5, ...over })

  it('pct=0 (mặc định): vượt 0.5 đơn vị vẫn chặn — hành vi cũ nguyên vẹn', () => {
    const r = checkReceiptAgainstPo(
      [{ material_id: 'M1', qty: 100.5, po_line_id: 'L1' }],
      [line({ qty_ordered: 100 })], // không khai pct
    )
    expect(r.ok && r.over).toHaveLength(1)
    expect(r.ok && r.within).toEqual([])
  })

  it('vượt TRONG dung sai: cho qua, báo within kèm % vượt', () => {
    // Đặt 1000, pct 5% → trần 1050. Nhận 1018 → vượt 1,8%, trong ngưỡng.
    const r = checkReceiptAgainstPo(
      [{ material_id: 'M1', qty: 1018, po_line_id: 'L1' }],
      [tolLine()],
    )
    expect(r.ok && r.over).toEqual([])
    expect(r.ok && r.within).toHaveLength(1)
    expect(r.ok && r.within[0].over_pct).toBeCloseTo(1.8, 5)
  })

  it('đúng biên ngưỡng (1050/1000, 5%) vẫn trong dung sai', () => {
    const r = checkReceiptAgainstPo(
      [{ material_id: 'M1', qty: 1050, po_line_id: 'L1' }],
      [tolLine()],
    )
    expect(r.ok && r.over).toEqual([])
    expect(r.ok && r.within[0]?.over_pct).toBeCloseTo(5, 5)
  })

  it('quá ngưỡng 1 đơn vị → chặn như cũ', () => {
    const r = checkReceiptAgainstPo(
      [{ material_id: 'M1', qty: 1051, po_line_id: 'L1' }],
      [tolLine()],
    )
    expect(r.ok && r.over).toHaveLength(1)
    expect(r.ok && r.within).toEqual([])
  })

  it('dung sai tính CỘNG DỒN — đợt trước đã ăn gần hết ngưỡng thì đợt sau không được thêm suất mới', () => {
    // Đặt 1000, đã về 1040 (missing = -40), trần 1050: chỉ còn nhận thêm 10.
    const r = checkReceiptAgainstPo(
      [{ material_id: 'M1', qty: 11, po_line_id: 'L1' }],
      [tolLine({ qty_missing: -40 })],
    )
    expect(r.ok && r.over).toHaveLength(1)
    const r2 = checkReceiptAgainstPo(
      [{ material_id: 'M1', qty: 10, po_line_id: 'L1' }],
      [tolLine({ qty_missing: -40 })],
    )
    expect(r2.ok && r2.over).toEqual([])
    expect(r2.ok && r2.within[0]?.over_pct).toBeCloseTo(5, 5)
  })

  it('QC loại tính vào tổng nhận khi so dung sai (cùng công thức BR-08)', () => {
    // 1030 đạt + 25 loại = 1055 > trần 1050 → chặn.
    const r = checkReceiptAgainstPo(
      [{ material_id: 'M1', qty: 1030, qty_rejected: 25, po_line_id: 'L1' }],
      [tolLine()],
    )
    expect(r.ok && r.over).toHaveLength(1)
  })

  it('trong định mức thì không dính within (không ghi note oan)', () => {
    const r = checkReceiptAgainstPo(
      [{ material_id: 'M1', qty: 990, po_line_id: 'L1' }],
      [tolLine()],
    )
    expect(r.ok && r.within).toEqual([])
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
