import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./orders.repo', () => ({
  ordersRepo: {
    nextCode: vi.fn(),
    list: vi.fn(),
    findById: vi.fn(),
    listLines: vi.fn(),
    insert: vi.fn(),
    replaceLines: vi.fn(),
    patch: vi.fn(),
    insertChange: vi.fn(),
    listChanges: vi.fn(),
  },
}))
vi.mock('./quotes.repo', () => ({ quotesRepo: { listLines: vi.fn() } }))
vi.mock('./quotes.service', () => ({
  quotesService: { assertApproved: vi.fn() },
  isSalesStaff: vi.fn(),
}))

import { ordersService } from './orders.service'
import { ordersRepo } from './orders.repo'
import { quotesRepo } from './quotes.repo'
import { quotesService, isSalesStaff } from './quotes.service'
import { BadRequest } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'

const sales = {
  id: 'u-sales',
  role: 'employee',
  department_id: 'd-sales',
} as unknown as User

const ORDER = {
  id: 'o1',
  code: 'DH-2026-0001',
  quote_id: 'q1',
  customer_id: 'c1',
  customer_po_no: null,
  status: 'confirmed',
  currency: 'USD',
  due_date: null,
  deposit_percent: null,
  price_term: null,
  payment_terms: null,
  container_summary: null,
  note: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isSalesStaff).mockResolvedValue(true)
})

describe('ordersService.create — BR-04: chỉ từ báo giá đã duyệt', () => {
  it('báo giá chưa duyệt → assertApproved chặn, không insert', async () => {
    vi.mocked(quotesService.assertApproved).mockRejectedValue(
      BadRequest('BR-04: chỉ báo giá đã được Giám đốc duyệt mới tạo được đơn hàng'),
    )
    await expect(ordersService.create(sales, { quote_id: 'q1' })).rejects.toMatchObject({
      status: 400,
    })
    expect(ordersRepo.insert).not.toHaveBeenCalled()
  })

  it('báo giá approved → snapshot dòng + copy điều khoản từ quote', async () => {
    vi.mocked(quotesService.assertApproved).mockResolvedValue({
      id: 'q1',
      customer_id: 'c1',
      currency: 'USD',
      price_term: 'FOB Quy Nhon',
      payment_terms: 'L/C at sight',
    } as never)
    vi.mocked(quotesRepo.listLines).mockResolvedValue([
      { product_id: 'p1', qty: 48, unit_price: 301.72, note: '1 set/ctn' },
    ] as never)
    vi.mocked(ordersRepo.nextCode).mockResolvedValue('DH-2026-0001')
    vi.mocked(ordersRepo.insert).mockResolvedValue(ORDER as never)

    await ordersService.create(sales, { quote_id: 'q1', customer_po_no: '31032191120' })

    const [row, lines] = vi.mocked(ordersRepo.insert).mock.calls[0]
    expect(row.customer_id).toBe('c1') // denorm đúng từ quote, không nhận từ input
    expect(row.price_term).toBe('FOB Quy Nhon')
    expect(row.customer_po_no).toBe('31032191120')
    expect(lines).toEqual([
      { product_id: 'p1', qty: 48, unit_price: 301.72, note: '1 set/ctn' },
    ])
  })

  it('báo giá approved nhưng 0 dòng → chặn', async () => {
    vi.mocked(quotesService.assertApproved).mockResolvedValue({ id: 'q1' } as never)
    vi.mocked(quotesRepo.listLines).mockResolvedValue([])
    await expect(ordersService.create(sales, { quote_id: 'q1' })).rejects.toMatchObject({
      status: 400,
    })
  })
})

describe('ordersService.update — FR-SAL-05: mọi thay đổi có vết', () => {
  it('đổi header → patch + ghi sales_order_changes với diff from/to', async () => {
    vi.mocked(ordersRepo.findById).mockResolvedValue(ORDER as never)
    vi.mocked(ordersRepo.patch).mockResolvedValue({
      ...ORDER,
      due_date: '2026-08-01',
    } as never)

    await ordersService.update(sales, 'o1', {
      due_date: '2026-08-01',
      change_note: 'Khách dời hạn',
    })

    expect(ordersRepo.patch).toHaveBeenCalledWith('o1', { due_date: '2026-08-01' })
    const change = vi.mocked(ordersRepo.insertChange).mock.calls[0][0]
    expect(change.note).toBe('Khách dời hạn')
    expect(change.change).toMatchObject({
      type: 'update',
      fields: { due_date: { from: null, to: '2026-08-01' } },
    })
  })

  it('không có gì đổi → KHÔNG ghi lịch sử rác', async () => {
    vi.mocked(ordersRepo.findById).mockResolvedValue(ORDER as never)
    await ordersService.update(sales, 'o1', { due_date: null })
    expect(ordersRepo.insertChange).not.toHaveBeenCalled()
    expect(ordersRepo.patch).not.toHaveBeenCalled()
  })

  it('đổi dòng SP → replaceLines + lịch sử chứa before/after', async () => {
    vi.mocked(ordersRepo.findById).mockResolvedValue(ORDER as never)
    vi.mocked(ordersRepo.listLines).mockResolvedValue([
      { product_id: 'p1', qty: 48, unit_price: 300, product_code: 'SP1' },
    ] as never)

    await ordersService.update(sales, 'o1', {
      lines: [{ product_id: 'p1', qty: 60, unit_price: 300 }],
    })

    expect(ordersRepo.replaceLines).toHaveBeenCalled()
    const change = vi.mocked(ordersRepo.insertChange).mock.calls[0][0]
    expect(change.change).toHaveProperty('lines')
  })

  it.each(['delivered', 'cancelled'] as const)('đơn %s bất biến', async (st) => {
    vi.mocked(ordersRepo.findById).mockResolvedValue({ ...ORDER, status: st } as never)
    await expect(
      ordersService.update(sales, 'o1', { due_date: '2026-08-01' }),
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('ordersService.cancel', () => {
  it('huỷ đơn chưa giao: set cancelled + ghi lịch sử kèm lý do', async () => {
    vi.mocked(ordersRepo.findById).mockResolvedValue(ORDER as never)
    vi.mocked(ordersRepo.patch).mockResolvedValue({
      ...ORDER,
      status: 'cancelled',
    } as never)

    await ordersService.cancel(sales, 'o1', 'Khách huỷ PO')

    expect(ordersRepo.patch).toHaveBeenCalledWith('o1', { status: 'cancelled' })
    const change = vi.mocked(ordersRepo.insertChange).mock.calls[0][0]
    expect(change.note).toBe('Khách huỷ PO')
  })

  it('đơn đã giao không huỷ được', async () => {
    vi.mocked(ordersRepo.findById).mockResolvedValue({
      ...ORDER,
      status: 'delivered',
    } as never)
    await expect(ordersService.cancel(sales, 'o1', 'x')).rejects.toMatchObject({
      status: 400,
    })
  })
})
