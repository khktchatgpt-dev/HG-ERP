import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./payables.repo', () => ({
  payablesRepo: {
    receiptValues: vi.fn(),
    receiptsMissingPrice: vi.fn(),
    listPayments: vi.fn(),
    findPayment: vi.fn(),
    insertPayment: vi.fn(),
    deletePayment: vi.fn(),
    markReimbursed: vi.fn(async () => true),
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

describe('summarizePayables — phí mua hàng (0211, bước 3)', () => {
  it('nhà xe KHÔNG có phiếu nhập vẫn hiện: phí là khoản nợ, trả đủ thì về 0', () => {
    const rows = summarizePayables(
      [receipt({})],
      [{ supplier_id: 'xe', amount: 3_888_000, currency: 'VND' }],
      [],
      [{ supplier_id: 'xe', supplier_name: 'Nhà xe Hùng Vịnh', currency: 'VND', amount: 3_888_000 }],
    )
    const xe = rows.find((r) => r.supplier_id === 'xe')!
    expect(xe.supplier_name).toBe('Nhà xe Hùng Vịnh')
    expect(xe.totals).toEqual([{ currency: 'VND', incurred: 3_888_000, paid: 3_888_000, balance: 0 }])
  })

  it('phí NCC tính cộng vào nợ của chính NCC đó', () => {
    const rows = summarizePayables(
      [receipt({})],
      [],
      [],
      [{ supplier_id: 's1', supplier_name: 'Thép Việt', currency: 'VND', amount: 150 }],
    )
    expect(rows[0].totals[0]).toMatchObject({ incurred: 1_150, balance: 1_150 })
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

describe('mua trên sàn (0278) — phiếu hoàn tiền & nhân viên ứng', () => {
  it('phiếu hoàn TRỪ vào đã trả: trả trước 500, sàn hoàn 120, hàng về 380 → còn nợ 0', () => {
    const rows = summarizePayables(
      [receipt({ qty: 38, unit_cost: 10 })], // +380
      [
        { supplier_id: 's1', amount: 500, currency: 'VND', kind: 'payment' },
        { supplier_id: 's1', amount: 120, currency: 'VND', kind: 'refund' },
      ],
    )
    expect(rows[0].totals[0]).toMatchObject({ incurred: 380, paid: 380, balance: 0 })
  })

  it('ghi phiếu: mặc định kind payment, người ứng null; truyền thì ghi đúng', async () => {
    await payablesService.recordPayment(keToan, {
      supplier_id: 's1',
      amount: 100,
      currency: 'VND',
      paid_on: '2026-10-26',
    })
    expect(payablesRepo.insertPayment).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'payment', paid_by_user_id: null }),
    )
    await payablesService.recordPayment(keToan, {
      supplier_id: 's1',
      amount: 40,
      currency: 'VND',
      paid_on: '2026-10-26',
      kind: 'refund',
      paid_by_user_id: 'u-nga',
    })
    expect(payablesRepo.insertPayment).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'refund', paid_by_user_id: 'u-nga' }),
    )
  })
})

describe('payablesService.markReimbursed — hoàn ứng cho nhân viên (0278)', () => {
  it('phiếu công ty trả / đã hoàn / phiếu hoàn tiền → 400; phiếu ứng chưa hoàn → đóng dấu', async () => {
    const find = vi.mocked(payablesRepo.findPayment)
    find.mockResolvedValueOnce({ id: 'p1', paid_by_user_id: null } as never)
    await expect(payablesService.markReimbursed(keToan, 'p1')).rejects.toMatchObject({ status: 400 })
    find.mockResolvedValueOnce({ id: 'p2', paid_by_user_id: 'u-nga', reimbursed_at: '2026-10-20T00:00:00Z' } as never) // prettier-ignore
    await expect(payablesService.markReimbursed(keToan, 'p2')).rejects.toMatchObject({ status: 400 })
    find.mockResolvedValueOnce({ id: 'p3', paid_by_user_id: 'u-nga', reimbursed_at: null, kind: 'refund' } as never) // prettier-ignore
    await expect(payablesService.markReimbursed(keToan, 'p3')).rejects.toMatchObject({ status: 400 })
    find.mockResolvedValueOnce({ id: 'p4', paid_by_user_id: 'u-nga', reimbursed_at: null, kind: 'payment' } as never) // prettier-ignore
    await payablesService.markReimbursed(keToan, 'p4')
    expect(payablesRepo.markReimbursed).toHaveBeenCalledWith('p4', expect.any(String))
  })
})
