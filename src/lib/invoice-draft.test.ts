import { describe, expect, it } from 'vitest'
import {
  draftBlockers,
  dueDateFrom,
  invoiceTotals,
  suggestInvoiceLines,
  type DraftSource,
} from './invoice-draft'

const S = (o: Partial<DraftSource> = {}): DraftSource => ({
  po_line_id: 'l1',
  material_code: 'VT-01',
  material_name: 'Nhôm hộp 20x40',
  unit: 'cây',
  qty_ordered: 100,
  amount_ordered: 5_000_000,
  qty_received: 0,
  qty_invoiced: 0,
  closed_short: false,
  ...o,
})

describe('suggestInvoiceLines — mồi số lượng', () => {
  /** Nợ phải trả gắn với hàng ĐÃ VỀ; đã có phiếu nhập thì lấy theo phiếu nhập. */
  it('có hàng đã nhận → lấy phần đã nhận chưa có hoá đơn', () => {
    const [l] = suggestInvoiceLines([S({ qty_received: 60, qty_invoiced: 10 })])
    expect(l.qty).toBe(50)
    expect(l.basis).toBe('da_nhan')
    expect(l.selected).toBe(true)
  })

  /** Kho HG chưa vào nhịp — rơi về "đã đặt", nhưng PHẢI báo ra bằng `basis`. */
  it('chưa nhận gì → lấy phần đã đặt, và nói rõ cơ sở là ĐÃ ĐẶT', () => {
    const [l] = suggestInvoiceLines([S({ qty_received: 0 })])
    expect(l.qty).toBe(100)
    expect(l.basis).toBe('da_dat')
  })

  it('đã có hoá đơn đủ → không mồi gì, không tích sẵn', () => {
    const [l] = suggestInvoiceLines([S({ qty_received: 100, qty_invoiced: 100 })])
    expect(l.qty).toBe(0)
    expect(l.basis).toBe('du_roi')
    expect(l.selected).toBe(false)
  })

  /**
   * Chốt thiếu = phần còn lại KHÔNG bao giờ về. Mồi theo số đã đặt ở đây là mời
   * người ta trả tiền cho hàng đã tuyên bố không nhận nữa.
   */
  it('dòng ĐÃ CHỐT THIẾU chỉ lấy theo phần đã nhận, không theo đã đặt', () => {
    const [a] = suggestInvoiceLines([S({ qty_received: 0, closed_short: true })])
    expect(a.qty).toBe(0)
    expect(a.selected).toBe(false)

    const [b] = suggestInvoiceLines([S({ qty_received: 30, closed_short: true })])
    expect(b.qty).toBe(30)
    expect(b.basis).toBe('da_nhan')
  })

  it('NCC đã đòi nhiều hơn hàng về → remaining_received âm, không mồi thêm', () => {
    const [l] = suggestInvoiceLines([S({ qty_received: 20, qty_invoiced: 50 })])
    expect(l.remaining_received).toBe(-30)
    // Còn 50 chưa có hoá đơn so với số ĐẶT, nên vẫn mồi được theo cơ sở đã đặt.
    expect(l.remaining_ordered).toBe(50)
    expect(l.basis).toBe('da_dat')
  })

  /**
   * Dòng nhôm tính theo tổng kg (`price_basis: 'unit2'`) có tiền dòng KHÔNG bằng
   * qty × đơn giá đặt. Quy giá về ĐVT đặt hàng để `qty × giá` ra đúng tiền dòng
   * — nếu không, hoá đơn in ra có phép cộng sai ngay trên mặt giấy.
   */
  it('đơn giá quy về ĐVT đặt hàng, kể cả dòng tính theo kg', () => {
    const [l] = suggestInvoiceLines([S({ qty_ordered: 8, amount_ordered: 1_000_000 })])
    expect(l.unit_price).toBe(125_000)
    expect(l.qty * l.unit_price).toBe(1_000_000)
  })

  it('đơn mua chưa có giá → đơn giá 0, không chia cho 0', () => {
    const [l] = suggestInvoiceLines([S({ qty_ordered: 0, amount_ordered: 0 })])
    expect(l.unit_price).toBe(0)
    expect(Number.isFinite(l.unit_price)).toBe(true)
  })
})

describe('invoiceTotals', () => {
  it('cộng tiền hàng, VAT và tổng', () => {
    const t = invoiceTotals([{ qty: 10, unit_price: 1000 }, { qty: 2, unit_price: 500 }], 10) // prettier-ignore
    expect(t.subtotal).toBe(11_000)
    expect(t.vat).toBe(1_100)
    expect(t.total).toBe(12_100)
  })

  /** Tiền một dòng là số được IN và được TRẢ — làm tròn từng dòng rồi mới cộng. */
  it('làm tròn TỪNG DÒNG trước khi cộng', () => {
    const t = invoiceTotals([{ qty: 3, unit_price: 0.335 }, { qty: 3, unit_price: 0.335 }], 0) // prettier-ignore
    // mỗi dòng 1,005 → 1,01 ; tổng 2,02 (không phải 2,01 của cách cộng thô)
    expect(t.subtotal).toBe(2.02)
  })

  it('VAT 0% thì tổng bằng tiền hàng', () => {
    const t = invoiceTotals([{ qty: 1, unit_price: 250 }], 0)
    expect(t).toEqual({ subtotal: 250, vat: 0, total: 250 })
  })

  it('không dòng nào → toàn số 0, không NaN', () => {
    expect(invoiceTotals([], 10)).toEqual({ subtotal: 0, vat: 0, total: 0 })
  })
})

describe('dueDateFrom', () => {
  it('cộng đúng số ngày, qua tháng và qua năm', () => {
    expect(dueDateFrom('2026-09-11', 30)).toBe('2026-10-11')
    expect(dueDateFrom('2026-12-20', 30)).toBe('2027-01-19')
    expect(dueDateFrom('2024-02-01', 29)).toBe('2024-03-01')
  })

  it('không có điều khoản → để TRỐNG, không tự đặt hạn hôm nay', () => {
    expect(dueDateFrom('2026-09-11', null)).toBeNull()
  })

  it('ngày hỏng → null chứ không ra Invalid Date', () => {
    expect(dueDateFrom('khong-phai-ngay', 30)).toBeNull()
  })
})

describe('draftBlockers — nói vướng gì VÀ cách gỡ', () => {
  const ok = {
    invoice_no: 'HD-001',
    invoice_date: '2026-09-11',
    lines: [{ qty: 1, unit_price: 100, description: 'Nhôm' }],
    total_typed: 100,
    total_computed: 100,
  }

  it('đủ điều kiện → không chặn', () => {
    expect(draftBlockers(ok)).toEqual([])
  })

  it('thiếu số hoá đơn → chặn, và câu chặn chỉ ra việc phải làm', () => {
    const [msg] = draftBlockers({ ...ok, invoice_no: '  ' })
    expect(msg).toContain('số hoá đơn')
    expect(msg).toContain('tờ giấy')
  })

  it('chưa tích dòng nào → chặn', () => {
    expect(draftBlockers({ ...ok, lines: [] })[0]).toContain('Chưa chọn dòng nào')
  })

  it('dòng số lượng 0 → chặn', () => {
    const msgs = draftBlockers({
      ...ok,
      lines: [{ qty: 0, unit_price: 100, description: 'Nhôm' }],
    })
    expect(msgs.some((m) => m.includes('số lượng bằng 0'))).toBe(true)
  })

  /**
   * Lệch giữa tổng gõ tay và tổng cộng từ dòng KHÔNG chặn: số phải trả là số
   * trên tờ giấy, NCC làm tròn kiểu của họ. Màn bày ra chênh lệch để mắt soát,
   * chứ không âm thầm sửa và cũng không cấm lưu.
   */
  it('tổng gõ tay lệch tổng máy cộng → KHÔNG chặn', () => {
    expect(draftBlockers({ ...ok, total_typed: 101, total_computed: 100 })).toEqual([])
  })
})
