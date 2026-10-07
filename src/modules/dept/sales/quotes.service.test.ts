import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./quotes.repo', () => ({
  quotesRepo: {
    list: vi.fn(),
    findById: vi.fn(),
    listLines: vi.fn(),
    insert: vi.fn(),
    replaceLines: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    countLines: vi.fn(),
    nextCode: vi.fn(async () => 'BG-2026-0099'),
    listRevisions: vi.fn(async () => []),
    ordersByQuoteIds: vi.fn(async () => new Map()),
  },
}))
// Giá thành KH (0220/0225) — mock: p1 có giá 100, p2 không có.
vi.mock('@/modules/dept/technical/plan-cost.service', () => ({
  planCostService: {
    pricesFor: vi.fn(
      async (ids: string[]) =>
        new Map(
          ids
            .filter((id) => id === 'p1')
            .map((id) => [id, { price: 100, currency: 'USD' }]),
        ),
    ),
  },
}))
vi.mock('./sales.repo', () => ({ customersRepo: { findById: vi.fn(), list: vi.fn() } }))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { findById: vi.fn() },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  hasPermission: vi.fn(),
  assertAction: vi.fn(),
  canAction: vi.fn(async () => true),
}))

import { quotesService, quoteLineMargin } from './quotes.service'
import { canAction } from '@/modules/core/rbac/rbac.service'
import { quotesRepo } from './quotes.repo'
import { customersRepo } from './sales.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { hasPermission, assertAction } from '@/modules/core/rbac/rbac.service'
import {
  makeFakeHasPermission,
  makeFakeAssertAction,
  type DeptInfo,
} from '@/test-utils/rbac'
import type { User } from '@/modules/core/users/users.repo'

const DEPTS: Record<string, DeptInfo> = {
  'd-sales': { name: 'Bán Hàng', workspace_id: 'sales' },
  'd-tech': { name: 'Kỹ Thuật', workspace_id: 'technical' },
}

const admin = { id: 'u-admin', role: 'admin', department_id: null } as unknown as User
const salesNv = {
  id: 'u-sales',
  role: 'employee',
  department_id: 'd-sales',
} as unknown as User
const otherNv = {
  id: 'u-other',
  role: 'employee',
  department_id: 'd-tech',
} as unknown as User

const QUOTE = {
  id: 'q1',
  code: 'BG-2026-0001',
  customer_id: 'c1',
  customer_name: 'MARE BLU',
  status: 'draft',
  created_by: 'u-sales',
}

function mockDept(name: string | null) {
  vi.mocked(departmentsRepo.findById).mockImplementation(async (id: string) =>
    id === 'd-sales'
      ? ({ id, name: 'Bán Hàng' } as never)
      : ({ id, name: name ?? 'Kỹ Thuật' } as never),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDept(null)
  vi.mocked(hasPermission).mockImplementation(
    makeFakeHasPermission((id) => DEPTS[id] ?? null),
  )
  vi.mocked(assertAction).mockImplementation(
    makeFakeAssertAction((id) => DEPTS[id] ?? null),
  )
})

describe('quotesService.send — sale tự chốt & gửi khách (FR-SAL-03)', () => {
  it('NV ngoài Kinh doanh không chốt được', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue(QUOTE as never)
    await expect(quotesService.send(otherNv, 'q1')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('báo giá 0 dòng không chốt được', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue(QUOTE as never)
    vi.mocked(quotesRepo.listLines).mockResolvedValue([])
    await expect(quotesService.send(salesNv, 'q1')).rejects.toMatchObject({
      status: 400,
    })
  })

  it('draft có dòng → sent (không cần ai duyệt)', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue(QUOTE as never)
    vi.mocked(quotesRepo.listLines).mockResolvedValue([
      { unit_price: 10 },
      { unit_price: 20 },
    ] as never)
    vi.mocked(quotesRepo.patch).mockResolvedValue({ ...QUOTE, status: 'sent' } as never)

    await quotesService.send(salesNv, 'q1')

    expect(quotesRepo.patch).toHaveBeenCalledWith('q1', { status: 'sent' })
  })

  // 07/10/2026: gửi khách giá 0 là gửi tờ giấy trắng; hết hiệu lực là giá đã chết.
  it('còn dòng giá 0 → 400, không gửi', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue(QUOTE as never)
    vi.mocked(quotesRepo.listLines).mockResolvedValue([
      { unit_price: 10 },
      { unit_price: 0 },
    ] as never)
    await expect(quotesService.send(salesNv, 'q1')).rejects.toMatchObject({ status: 400 })
    expect(quotesRepo.patch).not.toHaveBeenCalled()
  })

  it('hết hiệu lực (valid_to < hôm nay) → 400, không gửi', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue({
      ...QUOTE,
      valid_to: '2020-01-01',
    } as never)
    vi.mocked(quotesRepo.listLines).mockResolvedValue([{ unit_price: 10 }] as never)
    await expect(quotesService.send(salesNv, 'q1')).rejects.toMatchObject({ status: 400 })
    expect(quotesRepo.patch).not.toHaveBeenCalled()
  })

  it('đã sent thì không chốt lại được', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue({
      ...QUOTE,
      status: 'sent',
    } as never)
    await expect(quotesService.send(salesNv, 'q1')).rejects.toMatchObject({
      status: 400,
    })
  })
})

describe('quotesService.update/remove — báo giá bất biến sau khi chốt', () => {
  const input = { customer_id: 'c1', currency: 'USD', lines: [] }

  it('không sửa được khi đã sent', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue({
      ...QUOTE,
      status: 'sent',
    } as never)
    await expect(quotesService.update(salesNv, 'q1', input)).rejects.toMatchObject({
      status: 400,
    })
  })

  it('không xoá được báo giá đã chốt', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue({
      ...QUOTE,
      status: 'sent',
    } as never)
    await expect(quotesService.remove(salesNv, 'q1')).rejects.toMatchObject({
      status: 400,
    })
  })
})

describe('quotesService.assertSent — cổng tạo đơn hàng', () => {
  it('chặn tạo đơn từ báo giá còn nháp', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue({
      ...QUOTE,
      status: 'draft',
    } as never)
    await expect(quotesService.assertSent('q1')).rejects.toMatchObject({
      status: 400,
    })
  })

  it('cho qua khi đã sent', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue({
      ...QUOTE,
      status: 'sent',
    } as never)
    const q = await quotesService.assertSent('q1')
    expect(q.status).toBe('sent')
  })

  it('không tồn tại → 404', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue(null as never)
    await expect(quotesService.assertSent('nope')).rejects.toMatchObject({
      status: 404,
    })
  })
})

// admin cũng được coi là sales staff (isSalesStaff trả true) — chốt được.
describe('quotesService.send — admin', () => {
  it('admin chốt được báo giá', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue(QUOTE as never)
    vi.mocked(quotesRepo.listLines).mockResolvedValue([{ unit_price: 1 }] as never)
    vi.mocked(quotesRepo.patch).mockResolvedValue({ ...QUOTE, status: 'sent' } as never)
    await quotesService.send(admin, 'q1')
    expect(quotesRepo.patch).toHaveBeenCalledWith('q1', { status: 'sent' })
  })
})

/*
 * 0225 (07/10/2026): bản sửa đổi · nhân bản · kết cục · chụp giá thành lúc chào.
 * Lý do: 6 báo giá, mới nhất 09/08, 0/53 đơn từ báo giá — màn không sửa được bản
 * đã gửi, không có kết cục, không thấy giá thành.
 */
describe('quotesService — bản sửa đổi / nhân bản / kết cục (0225)', () => {
  const SENT = {
    ...QUOTE,
    status: 'sent',
    revision_no: 1,
    revision_of: null,
    currency: 'USD',
  }
  const LINES = [
    { product_id: 'p1', qty: 10, unit_price: 150, discount_pct: 5, note: null },
    { product_id: 'p2', qty: null, unit_price: 80, discount_pct: null, note: 'x' },
  ]
  beforeEach(() => {
    vi.mocked(quotesRepo.findById).mockResolvedValue(SENT as never)
    vi.mocked(quotesRepo.listLines).mockResolvedValue(LINES as never)
    vi.mocked(quotesRepo.insert).mockImplementation(
      async (row) => ({ ...row, id: 'q-new' }) as never,
    )
    vi.mocked(quotesRepo.patch).mockImplementation(
      async (id, patch) => ({ ...SENT, id, ...patch }) as never,
    )
  })

  it('revise: nháp mới bản 2 trỏ bản 1, chép dòng (giữ SL · giá · CK), chụp giá thành KH', async () => {
    const q = await quotesService.revise(salesNv, 'q1')
    expect(q.id).toBe('q-new')
    const [row, lines] = vi.mocked(quotesRepo.insert).mock.calls[0]
    expect(row).toMatchObject({
      revision_no: 2,
      revision_of: 'q1',
      customer_id: 'c1',
      currency: 'USD',
    })
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({
      product_id: 'p1',
      qty: 10,
      unit_price: 150,
      discount_pct: 5,
      plan_price_snapshot: 100,
    })
    expect(lines[1]).toMatchObject({ product_id: 'p2', plan_price_snapshot: null })
  })

  it('revise từ nháp → 400 (nháp thì sửa thẳng)', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue({
      ...SENT,
      status: 'draft',
    } as never)
    await expect(quotesService.revise(salesNv, 'q1')).rejects.toMatchObject({
      status: 400,
    })
  })

  it('không có quyền xem giá thành → KHÔNG chụp snapshot (bí mật không rò qua dòng)', async () => {
    vi.mocked(canAction).mockResolvedValueOnce(false)
    await quotesService.revise(salesNv, 'q1')
    const [, lines] = vi.mocked(quotesRepo.insert).mock.calls[0]
    expect(lines[0]).not.toHaveProperty('plan_price_snapshot')
  })

  it('gửi bản 2 → bản 1 (đang sent) sang superseded', async () => {
    vi.mocked(quotesRepo.findById)
      .mockResolvedValueOnce({
        ...SENT,
        id: 'q2',
        status: 'draft',
        revision_no: 2,
        revision_of: 'q1',
        valid_to: '2099-01-01',
      } as never) // before
      .mockResolvedValueOnce({ ...SENT, id: 'q1', status: 'sent' } as never) // prev
    vi.mocked(quotesRepo.listLines).mockResolvedValue([{ unit_price: 10 }] as never)
    await quotesService.send(salesNv, 'q2')
    expect(quotesRepo.patch).toHaveBeenCalledWith('q2', { status: 'sent' })
    expect(quotesRepo.patch).toHaveBeenCalledWith('q1', { status: 'superseded' })
  })

  it('copy sang khách khác → nháp bản 1, điều khoản lấy mặc định khách mới', async () => {
    vi.mocked(customersRepo.findById).mockResolvedValue({ id: 'c9', is_active: true, default_currency: 'EUR', default_price_term: 'FOB HCM', default_payment_terms: 'T/T' } as never) // prettier-ignore
    await quotesService.copy(salesNv, 'q1', 'c9')
    const [row, lines] = vi.mocked(quotesRepo.insert).mock.calls[0]
    expect(row).toMatchObject({
      customer_id: 'c9',
      currency: 'EUR',
      price_term: 'FOB HCM',
    })
    expect(lines).toHaveLength(2)
  })

  it('markLost: chỉ từ sent, lưu lý do; cancel: từ draft/sent; markWon: sent → won', async () => {
    const lost = await quotesService.markLost(salesNv, 'q1', 'Đối thủ rẻ hơn')
    expect(lost).toMatchObject({ status: 'lost', lost_reason: 'Đối thủ rẻ hơn' })
    vi.mocked(quotesRepo.findById).mockResolvedValue({ ...SENT, status: 'won' } as never)
    await expect(quotesService.markLost(salesNv, 'q1', 'x')).rejects.toMatchObject({
      status: 400,
    })
    await expect(quotesService.cancel(salesNv, 'q1')).rejects.toMatchObject({
      status: 400,
    })

    vi.mocked(quotesRepo.findById).mockResolvedValue(SENT as never)
    await quotesService.markWon('q1')
    expect(quotesRepo.patch).toHaveBeenCalledWith('q1', { status: 'won' })
  })

  it('assertSent: won vẫn tạo được đơn tiếp (nhiều đơn một báo giá)', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue({ ...SENT, status: 'won' } as never)
    await expect(quotesService.assertSent('q1')).resolves.toBeTruthy()
  })

  it('create: hiệu lực trống → hôm nay + 30 ngày; chụp giá thành KH vào dòng', async () => {
    vi.mocked(customersRepo.findById).mockResolvedValue({
      id: 'c1',
      is_active: true,
    } as never)
    await quotesService.create(salesNv, {
      customer_id: 'c1',
      currency: 'USD',
      lines: LINES,
    })
    const [row, lines] = vi.mocked(quotesRepo.insert).mock.calls[0]
    expect(row.valid_from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(row.valid_to).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(row.valid_to! > row.valid_from!).toBe(true)
    expect(lines[0]).toMatchObject({ plan_price_snapshot: 100 })
  })

  it('quoteLineMargin: (net − giá thành) / net; thiếu một vế → null', () => {
    expect(quoteLineMargin(150, 5, 100)).toBe(29.8)
    expect(quoteLineMargin(100, null, 120)).toBe(-20)
    expect(quoteLineMargin(100, null, null)).toBeNull()
    expect(quoteLineMargin(0, null, 50)).toBeNull()
  })
})
