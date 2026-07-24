import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./orders.repo', () => ({
  ordersRepo: {
    nextCode: vi.fn(),
    existsByCode: vi.fn(),
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
vi.mock('./quotes.service', () => ({
  quotesService: { assertSent: vi.fn() },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({ assertAction: vi.fn() }))
vi.mock('./sales.repo', () => ({ customersRepo: { findById: vi.fn() } }))
vi.mock('@/modules/dept/production/production.repo', () => ({
  productionRepo: { findByOrder: vi.fn(), patch: vi.fn() },
}))
vi.mock('@/modules/dept/supply/pos.repo', () => ({
  posRepo: { list: vi.fn(), patch: vi.fn() },
}))
vi.mock('@/modules/dept/supply/suppliers.service', () => ({
  SUPPLY_DEPT_NAMES: new Set(['Kế Hoạch Sản Xuất-cung ứng']),
}))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { list: vi.fn() },
}))
vi.mock('@/modules/core/users/users.repo', () => ({ usersRepo: { list: vi.fn() } }))
vi.mock('@/events/bus', () => ({ emit: vi.fn() }))

import { ordersService } from './orders.service'
import { ordersRepo } from './orders.repo'
import { quotesService } from './quotes.service'
import { customersRepo } from './sales.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { posRepo } from '@/modules/dept/supply/pos.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { makeFakeAssertAction, type DeptInfo } from '@/test-utils/rbac'
import { BadRequest } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'

const DEPTS: Record<string, DeptInfo> = {
  'd-sales': { name: 'Bán Hàng', workspace_id: 'sales' },
}

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
  vi.mocked(assertAction).mockImplementation(
    makeFakeAssertAction((id) => DEPTS[id] ?? null),
  )
  vi.mocked(ordersRepo.existsByCode).mockResolvedValue(false)
  vi.mocked(productionRepo.findByOrder).mockResolvedValue(null)
  vi.mocked(posRepo.list).mockResolvedValue({ rows: [], total: 0 } as never)
  vi.mocked(departmentsRepo.list).mockResolvedValue([] as never)
  vi.mocked(usersRepo.list).mockResolvedValue([] as never)
})

describe('ordersService.create — chỉ từ báo giá đã chốt (sent)', () => {
  it('báo giá chưa chốt → assertSent chặn, không insert', async () => {
    vi.mocked(quotesService.assertSent).mockRejectedValue(
      BadRequest('Chỉ tạo được đơn hàng từ báo giá đã chốt (gửi khách)'),
    )
    await expect(
      ordersService.create(sales, { code: 'DH-T', quote_id: 'q1' }),
    ).rejects.toMatchObject({
      status: 400,
    })
    expect(ordersRepo.insert).not.toHaveBeenCalled()
  })

  it('báo giá đã chốt → khách+tiền tệ+điều khoản từ quote, dòng+SL từ client', async () => {
    vi.mocked(quotesService.assertSent).mockResolvedValue({
      id: 'q1',
      customer_id: 'c1',
      currency: 'USD',
      price_term: 'FOB Quy Nhon',
      payment_terms: 'L/C at sight',
    } as never)
    vi.mocked(ordersRepo.nextCode).mockResolvedValue('DH-2026-0001')
    vi.mocked(ordersRepo.insert).mockResolvedValue(ORDER as never)

    // Báo giá không có SL — client nhập SL ở bước tạo đơn.
    await ordersService.create(sales, {
      code: 'DH-T2',
      quote_id: 'q1',
      customer_po_no: '31032191120',
      lines: [{ product_id: 'p1', qty: 48, unit_price: 301.72, note: '1 set/ctn' }],
    })

    const [row, lines] = vi.mocked(ordersRepo.insert).mock.calls[0]
    expect(row.customer_id).toBe('c1') // denorm đúng từ quote, không nhận từ input
    expect(row.price_term).toBe('FOB Quy Nhon')
    expect(row.currency).toBe('USD')
    expect(row.customer_po_no).toBe('31032191120')
    expect(lines).toEqual([
      { product_id: 'p1', qty: 48, unit_price: 301.72, note: '1 set/ctn' },
    ])
  })

  it('báo giá đã chốt nhưng client không gửi dòng → chặn', async () => {
    vi.mocked(quotesService.assertSent).mockResolvedValue({
      id: 'q1',
      customer_id: 'c1',
      currency: 'USD',
    } as never)
    await expect(
      ordersService.create(sales, { code: 'DH-T', quote_id: 'q1', lines: [] }),
    ).rejects.toMatchObject({
      status: 400,
    })
  })
})

describe('ordersService.create — trực tiếp, KHÔNG cần báo giá', () => {
  it('có khách + dòng SP → insert với quote_id null, không đụng tới báo giá', async () => {
    vi.mocked(customersRepo.findById).mockResolvedValue({
      id: 'c9',
      is_active: true,
    } as never)
    vi.mocked(ordersRepo.nextCode).mockResolvedValue('DH-2026-0002')
    vi.mocked(ordersRepo.insert).mockResolvedValue(ORDER as never)

    await ordersService.create(sales, {
      code: 'DH-T3',
      customer_id: 'c9',
      currency: 'VND',
      price_term: 'EXW',
      lines: [{ product_id: 'p2', qty: 10, unit_price: 250 }],
    })

    expect(quotesService.assertSent).not.toHaveBeenCalled()
    const [row, lines] = vi.mocked(ordersRepo.insert).mock.calls[0]
    expect(row.quote_id).toBeNull()
    expect(row.customer_id).toBe('c9')
    expect(row.currency).toBe('VND')
    expect(row.price_term).toBe('EXW')
    expect(lines).toEqual([{ product_id: 'p2', qty: 10, unit_price: 250 }])
  })

  it('không chọn khách → chặn', async () => {
    await expect(
      ordersService.create(sales, {
        code: 'DH-T4',
        lines: [{ product_id: 'p2', qty: 1, unit_price: 1 }],
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(ordersRepo.insert).not.toHaveBeenCalled()
  })

  it('khách ngừng giao dịch → chặn', async () => {
    vi.mocked(customersRepo.findById).mockResolvedValue({
      id: 'c9',
      is_active: false,
    } as never)
    await expect(
      ordersService.create(sales, {
        code: 'DH-T5',
        customer_id: 'c9',
        lines: [{ product_id: 'p2', qty: 1, unit_price: 1 }],
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('không có dòng SP → chặn', async () => {
    vi.mocked(customersRepo.findById).mockResolvedValue({
      id: 'c9',
      is_active: true,
    } as never)
    await expect(
      ordersService.create(sales, { code: 'DH-T6', customer_id: 'c9', lines: [] }),
    ).rejects.toMatchObject({ status: 400 })
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

describe('ordersService.update — báo Cung ứng khi sửa sau phát LSX (P2)', () => {
  const LSX = { id: 'lsx1', code: 'LSX-01', status: 'in_progress' }

  it('đơn in_production đổi dòng SP → emit order.changed_after_lsx', async () => {
    vi.mocked(ordersRepo.findById).mockResolvedValue({
      ...ORDER,
      status: 'in_production',
    } as never)
    vi.mocked(ordersRepo.listLines).mockResolvedValue([
      { product_id: 'p1', qty: 48, unit_price: 300, product_code: 'SP1' },
    ] as never)
    vi.mocked(productionRepo.findByOrder).mockResolvedValue(LSX as never)

    await ordersService.update(sales, 'o1', {
      lines: [{ product_id: 'p1', qty: 60, unit_price: 300 }],
    })

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'order.changed_after_lsx',
        lsx_code: 'LSX-01',
        lines_changed: true,
      }),
    )
  })

  it('đổi hạn giao lúc lsx_issued → emit với changed_fields chứa due_date', async () => {
    vi.mocked(ordersRepo.findById).mockResolvedValue({
      ...ORDER,
      status: 'lsx_issued',
    } as never)
    vi.mocked(ordersRepo.patch).mockResolvedValue({ ...ORDER } as never)
    vi.mocked(productionRepo.findByOrder).mockResolvedValue(LSX as never)

    await ordersService.update(sales, 'o1', { due_date: '2026-09-01' })

    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'order.changed_after_lsx',
        changed_fields: ['due_date'],
        lines_changed: false,
      }),
    )
  })

  it('đơn confirmed (chưa phát LSX) đổi dòng → KHÔNG emit', async () => {
    vi.mocked(ordersRepo.findById).mockResolvedValue(ORDER as never)
    vi.mocked(ordersRepo.listLines).mockResolvedValue([
      { product_id: 'p1', qty: 48, unit_price: 300, product_code: 'SP1' },
    ] as never)

    await ordersService.update(sales, 'o1', {
      lines: [{ product_id: 'p1', qty: 60, unit_price: 300 }],
    })

    expect(emit).not.toHaveBeenCalled()
  })

  it('đơn lsx_issued đổi ghi chú (không phải dòng/hạn giao) → KHÔNG emit', async () => {
    vi.mocked(ordersRepo.findById).mockResolvedValue({
      ...ORDER,
      status: 'lsx_issued',
    } as never)
    vi.mocked(ordersRepo.patch).mockResolvedValue({ ...ORDER } as never)

    await ordersService.update(sales, 'o1', { note: 'ghi chú mới' })

    expect(emit).not.toHaveBeenCalled()
  })
})

describe('ordersService.cancel — khép chuỗi LSX/PO (P3)', () => {
  beforeEach(() => {
    vi.mocked(ordersRepo.findById).mockResolvedValue({
      ...ORDER,
      status: 'in_production',
    } as never)
    vi.mocked(ordersRepo.patch).mockResolvedValue({
      ...ORDER,
      status: 'cancelled',
    } as never)
  })

  it('LSX đang SX → cancelled + log; PO chưa gửi tự huỷ; PO đã gửi NCC giữ nguyên', async () => {
    vi.mocked(productionRepo.findByOrder).mockResolvedValue({
      id: 'lsx1',
      code: 'LSX-01',
      status: 'in_progress',
      current_stage: 'han',
    } as never)
    vi.mocked(posRepo.list).mockResolvedValue({
      rows: [
        { id: 'po1', code: 'PO-1', status: 'pending_approval', note: null },
        { id: 'po2', code: 'PO-2', status: 'ordered', note: null },
      ],
      total: 2,
    } as never)

    await ordersService.cancel(sales, 'o1', 'Khách huỷ')

    // Lý do huỷ ghi vào note LSX (production_progress đã bỏ — 0084).
    expect(productionRepo.patch).toHaveBeenCalledWith(
      'lsx1',
      expect.objectContaining({
        status: 'cancelled',
        note: expect.stringContaining('Khách huỷ'),
      }),
    )
    expect(posRepo.patch).toHaveBeenCalledTimes(1)
    expect(posRepo.patch).toHaveBeenCalledWith(
      'po1',
      expect.objectContaining({ status: 'cancelled' }),
    )
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'order.cancelled',
        lsx_cancelled: true,
        pos_cancelled: ['PO-1'],
        pos_manual: ['PO-2'],
      }),
    )
  })

  it('LSX đã hoàn thành → không đụng LSX', async () => {
    vi.mocked(productionRepo.findByOrder).mockResolvedValue({
      id: 'lsx1',
      code: 'LSX-01',
      status: 'completed',
    } as never)

    await ordersService.cancel(sales, 'o1', 'x')

    expect(productionRepo.patch).not.toHaveBeenCalled()
  })

  it('bước phụ lỗi → đơn vẫn huỷ + vẫn emit (best-effort)', async () => {
    vi.mocked(productionRepo.findByOrder).mockRejectedValue(new Error('db down'))

    const out = await ordersService.cancel(sales, 'o1', 'x')

    expect(out.status).toBe('cancelled')
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'order.cancelled' }),
    )
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

describe('ordersService.deliver — khép chuỗi (completed → delivered)', () => {
  it('đơn hoàn thành → delivered + ghi lịch sử', async () => {
    vi.mocked(ordersRepo.findById).mockResolvedValue({
      ...ORDER,
      status: 'completed',
    } as never)
    vi.mocked(ordersRepo.patch).mockResolvedValue({
      ...ORDER,
      status: 'delivered',
    } as never)

    const out = await ordersService.deliver(sales, 'o1')

    expect(ordersRepo.patch).toHaveBeenCalledWith('o1', { status: 'delivered' })
    const change = vi.mocked(ordersRepo.insertChange).mock.calls[0][0]
    expect(change.change).toMatchObject({ type: 'delivered' })
    expect(out.status).toBe('delivered')
  })

  it.each(['confirmed', 'lsx_pending', 'lsx_issued', 'in_production'] as const)(
    'đơn %s (chưa hoàn thành SX) → 400',
    async (st) => {
      vi.mocked(ordersRepo.findById).mockResolvedValue({ ...ORDER, status: st } as never)
      await expect(ordersService.deliver(sales, 'o1')).rejects.toMatchObject({
        status: 400,
      })
      expect(ordersRepo.patch).not.toHaveBeenCalled()
    },
  )

  it('NV ngoài Sales (không phải GĐ/QL) → 403', async () => {
    const outsider = { id: 'u-x', role: 'employee' } as never
    await expect(ordersService.deliver(outsider, 'o1')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('GĐ/Ban quản lý xác nhận giao được dù không thuộc Sales', async () => {
    vi.mocked(ordersRepo.findById).mockResolvedValue({
      ...ORDER,
      status: 'completed',
    } as never)
    vi.mocked(ordersRepo.patch).mockResolvedValue({
      ...ORDER,
      status: 'delivered',
    } as never)
    const manager = { id: 'u-gd', role: 'manager' } as never
    const out = await ordersService.deliver(manager, 'o1')
    expect(out.status).toBe('delivered')
  })
})
