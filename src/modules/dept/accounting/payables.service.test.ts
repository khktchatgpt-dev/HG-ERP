import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./payables.repo', () => ({
  payablesRepo: {
    receiptValues: vi.fn(),
    receiptsMissingPrice: vi.fn(),
    listPayments: vi.fn(),
    findPayment: vi.fn(),
    insertPayment: vi.fn(),
    deletePayment: vi.fn(),
    poSupplier: vi.fn(),
  },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({ assertAction: vi.fn() }))

import { payablesService, summarizePayables } from './payables.service'
import { payablesRepo, type ReceiptValueRow } from './payables.repo'
import type { User } from '@/modules/core/users/users.repo'

const keToan = { id: 'u-kt', role: 'employee' } as unknown as User
const admin = { id: 'u-adm', role: 'admin' } as unknown as User

const receipt = (over: Partial<ReceiptValueRow>): ReceiptValueRow => ({
  qty: 100,
  unit_cost: 10,
  direction: 'in',
  created_at: '2026-08-20T00:00:00Z',
  doc_code: 'PNK-001',
  doc_date: '2026-08-20',
  supplier_doc_no: null,
  po_id: 'po1',
  po_code: 'PO-01',
  currency: 'VND',
  supplier_id: 's1',
  supplier_name: 'Thép Việt',
  payment_terms: '30 ngày',
  ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('summarizePayables — cấn trừ, tách tiền tệ, trừ đã trả (GĐ C.1)', () => {
  it('phiếu đảo (out) cấn trừ; đã trả trừ ra còn nợ', () => {
    const rows = summarizePayables(
      [
        receipt({}), // +1.000
        receipt({ direction: 'out', qty: 20, doc_code: 'PNK-001D' }), // −200 (đảo)
      ],
      [{ supplier_id: 's1', amount: 300, currency: 'VND' }],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].totals).toEqual([
      { currency: 'VND', incurred: 800, paid: 300, balance: 500 },
    ])
    expect(rows[0].last_receipt_at).toBe('2026-08-20')
  })

  it('USD và VND KHÔNG cộng lẫn — mỗi tiền tệ một dòng', () => {
    const rows = summarizePayables(
      [receipt({}), receipt({ currency: 'USD', qty: 5, unit_cost: 100, po_id: 'po2' })],
      [],
    )
    expect(rows[0].totals).toHaveLength(2)
    expect(rows[0].totals.find((t) => t.currency === 'USD')).toMatchObject({
      incurred: 500,
      balance: 500,
    })
  })

  it('trả trước (chưa có phiếu nhận) → balance ÂM, không bị nuốt', () => {
    const rows = summarizePayables(
      [],
      [{ supplier_id: 's9', amount: 1000, currency: 'VND' }],
    )
    expect(rows[0].totals[0]).toMatchObject({ incurred: 0, paid: 1000, balance: -1000 })
  })

  it('NCC chỉ dính phiếu THIẾU GIÁ vẫn hiện để đi đòi giá', () => {
    const rows = summarizePayables(
      [],
      [],
      [{ supplier_id: 's2', supplier_name: 'Sơn ABC', count: 3 }],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ supplier_name: 'Sơn ABC', missing_price_count: 3 })
  })

  it('sắp theo |còn nợ| lớn trước', () => {
    const rows = summarizePayables(
      [
        receipt({ supplier_id: 's1', supplier_name: 'A', qty: 10 }), // 100
        receipt({ supplier_id: 's2', supplier_name: 'B', qty: 500, po_id: 'po2' }), // 5.000
      ],
      [],
    )
    expect(rows.map((r) => r.supplier_name)).toEqual(['B', 'A'])
  })
})

describe('payablesService — guard ghi/xoá thanh toán', () => {
  it('gắn PO của NCC KHÁC → 400', async () => {
    vi.mocked(payablesRepo.poSupplier).mockResolvedValue('s-khac')
    await expect(
      payablesService.recordPayment(keToan, {
        supplier_id: 's1',
        po_id: 'po1',
        amount: 100,
        currency: 'VND',
        paid_on: '2026-08-23',
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(payablesRepo.insertPayment).not.toHaveBeenCalled()
  })

  it('không gắn PO → ghi thẳng, created_by là người ghi', async () => {
    await payablesService.recordPayment(keToan, {
      supplier_id: 's1',
      amount: 100,
      currency: 'VND',
      paid_on: '2026-08-23',
    })
    expect(payablesRepo.insertPayment).toHaveBeenCalledWith(
      expect.objectContaining({ supplier_id: 's1', po_id: null, created_by: 'u-kt' }),
    )
  })

  it('xoá: người khác (không phải người ghi/QL) → 403; admin xoá được', async () => {
    vi.mocked(payablesRepo.findPayment).mockResolvedValue({
      id: 'pay1',
      created_by: 'nguoi-khac',
    } as never)
    await expect(payablesService.deletePayment(keToan, 'pay1')).rejects.toMatchObject({
      status: 403,
    })
    await payablesService.deletePayment(admin, 'pay1')
    expect(payablesRepo.deletePayment).toHaveBeenCalledWith('pay1')
  })
})
