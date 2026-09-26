import { describe, expect, it } from 'vitest'
import {
  allocateCost,
  canCarryCost,
  carrierLedgerEntries,
  costMoney,
  costPayeeRole,
  samePlace,
} from './po-cost'
import { buildLedger } from './ap-ledger'

describe('allocateCost — chia phí một chuyến xe cho nhiều đơn theo tiền hàng', () => {
  it('chia theo tỷ lệ tiền hàng, tổng khớp tuyệt đối với tiền phiếu', () => {
    // Chuyến xe Hùng Vịnh 27/08: 3 đơn cùng về một chuyến, phí 1.500.000.
    const r = allocateCost(1_500_000, [
      { po_id: 'a', base: 10_000_000 },
      { po_id: 'b', base: 20_000_000 },
      { po_id: 'c', base: 30_000_000 },
    ])
    expect(r.map((x) => x.amount)).toEqual([250_000, 500_000, 750_000])
    expect(r.reduce((s, x) => s + x.amount, 0)).toBe(1_500_000)
  })

  it('số lẻ làm tròn về đồng, phần dư dồn vào đơn tiền hàng LỚN NHẤT', () => {
    const r = allocateCost(1_000_000, [
      { po_id: 'a', base: 1 },
      { po_id: 'b', base: 1 },
      { po_id: 'c', base: 1 },
    ])
    // 333.333,33 ×3 → 333.333 ×3 = 999.999, dư 1 đồng vào đơn đầu (bằng nhau thì lấy đơn đầu).
    expect(r.map((x) => x.amount)).toEqual([333_334, 333_333, 333_333])
    const r2 = allocateCost(100, [
      { po_id: 'a', base: 1 },
      { po_id: 'b', base: 2 },
    ])
    expect(r2.map((x) => x.amount)).toEqual([33, 67])
  })

  it('một đơn thì nhận trọn phiếu', () => {
    expect(allocateCost(850_000, [{ po_id: 'a', base: 51_955_680 }])).toEqual([
      { po_id: 'a', base: 51_955_680, amount: 850_000 },
    ])
  })

  it('mọi đơn tiền hàng 0 (đơn gia công chưa có giá) → chia đều, không chia cho 0', () => {
    const r = allocateCost(90_000, [
      { po_id: 'a', base: 0 },
      { po_id: 'b', base: 0 },
      { po_id: 'c', base: 0 },
    ])
    expect(r.map((x) => x.amount)).toEqual([30_000, 30_000, 30_000])
  })

  it('USD làm tròn về cent', () => {
    const r = allocateCost(100, [
      { po_id: 'a', base: 1 },
      { po_id: 'b', base: 2 },
    ], 'USD') // prettier-ignore
    expect(r.map((x) => x.amount)).toEqual([33.33, 66.67])
  })

  it('không đơn nào → rỗng', () => {
    expect(allocateCost(100, [])).toEqual([])
  })
})

describe('costMoney — VAT riêng của phí', () => {
  it('VAT tính trên tiền chưa VAT, làm tròn về đồng', () => {
    expect(costMoney(1_234_567, 8)).toEqual({
      amount: 1_234_567,
      vat_amount: 98_765,
      total: 1_333_332,
    })
  })
  it('nhà xe không xuất hoá đơn → VAT 0', () => {
    expect(costMoney(500_000, null)).toEqual({
      amount: 500_000,
      vat_amount: 0,
      total: 500_000,
    })
  })
})

describe('canCarryCost — đơn nào nhận phí được', () => {
  it.each(['approved', 'ordered', 'confirmed', 'in_transit', 'partial', 'received'])(
    '%s → được',
    (s) => expect(canCarryCost(s).ok).toBe(true),
  )
  it.each(['draft', 'pending_approval', 'cancelled'])('%s → không', (s) => {
    const g = canCarryCost(s)
    expect(g.ok).toBe(false)
    if (!g.ok) expect(g.reason.length).toBeGreaterThan(10)
  })
})

describe('samePlace — gợi ý đơn cùng chuyến theo nơi giao', () => {
  it('ba cách ghi thật của cùng bãi xe Hùng Vịnh khớp nhau', () => {
    const a = 'Nhà xe Hùng vịnh, QL 1A, Q12, Bãi xe miền nam.'
    const b = 'Nhà xe hùng Vịnh, QL 1A, Q12, Tp.HCM'
    const c = 'Chành xe hùng vịnh, QL 1A, Q12, Bãi xe m'
    expect(samePlace(a, b)).toBe(true)
    expect(samePlace(a, c)).toBe(true)
    expect(samePlace(b, c)).toBe(true)
  })
  it('khác bãi → không khớp dù cùng chữ "nhà xe"', () => {
    expect(samePlace('Nhà xe Hùng Vịnh, QL 1A, Q12', 'Nhà xe Phương Trang, Q5')).toBe(
      false,
    )
  })
  it('trống hoặc chỉ toàn chữ chung → không khớp', () => {
    expect(samePlace(null, 'Nhà xe Hùng Vịnh')).toBe(false)
    expect(samePlace('Tp.HCM', 'Tp.HCM')).toBe(false)
  })
  it('giao tận xưởng giống nhau vẫn khớp', () => {
    expect(samePlace('Xưởng Hoàng Gia, Bình Dương', 'xưởng hoàng gia - bình dương')).toBe(
      true,
    )
  })
})

describe('costPayeeRole — phiếu vào sổ 331 thẳng hay chờ hoá đơn NCC', () => {
  it('người nhận tiền KHÔNG phải NCC của đơn nào → nhà xe, vào sổ 331 ngay', () => {
    expect(costPayeeRole('nha-xe', ['vipora', 'vipora', 'cao-dat'])).toBe('carrier')
  })
  it('người nhận tiền là NCC của một đơn trong phiếu → chờ hoá đơn NCC (tránh ghi nợ hai lần)', () => {
    expect(costPayeeRole('vipora', ['vipora', 'cao-dat'])).toBe('po_supplier')
  })
})

describe('carrierLedgerEntries — huỷ phiếu nhà xe không được sửa ngược kỳ cũ', () => {
  const cost = {
    payee_supplier_id: 'xe1',
    kind: 'van_chuyen' as const,
    cost_date: '2026-08-20',
    doc_no: 'PX-01',
    currency: 'VND',
    total: 1_080_000,
    note: null,
    po_codes: ['PO-2026-0080', 'PO-2026-0081'],
    voided_on: null as string | null,
    void_reason: null as string | null,
  }

  it('phiếu còn hiệu lực = một dòng phát sinh tăng ở ngày phiếu', () => {
    const [e, ...rest] = carrierLedgerEntries(cost, 'Xe Minh')
    expect(rest).toEqual([])
    expect(e).toMatchObject({
      kind: 'invoice',
      date: '2026-08-20',
      amount: 1_080_000,
      label: 'Phiếu phí nhà xe',
    })
    expect(e.note).toContain('PO-2026-0080, PO-2026-0081')
  })

  it('phiếu huỷ tháng sau: tháng 8 GIỮ NGUYÊN số đã chốt, tháng 9 có dòng đảo', () => {
    const entries = carrierLedgerEntries(
      { ...cost, voided_on: '2026-09-05', void_reason: 'ghi trùng chuyến' },
      'Xe Minh',
    )
    expect(entries[1]).toMatchObject({ kind: 'payment', date: '2026-09-05', doc_no: 'Huỷ Vận chuyển PX-01', label: 'Huỷ phiếu phí' }) // prettier-ignore
    const aug = buildLedger(entries, '2026-08-01', '2026-08-31')
    expect(aug[0]).toMatchObject({ increase: 1_080_000, decrease: 0, closing: 1_080_000 })
    const sep = buildLedger(entries, '2026-09-01', '2026-09-30')
    expect(sep[0]).toMatchObject({ opening: 1_080_000, decrease: 1_080_000, closing: 0 })
  })

  it('ngày huỷ sớm hơn ngày phiếu thì đảo ĐÚNG ngày phiếu — sổ không âm giữa chừng', () => {
    const entries = carrierLedgerEntries({ ...cost, voided_on: '2026-08-18' }, 'Xe Minh')
    expect(entries[1].date).toBe('2026-08-20')
  })
})
