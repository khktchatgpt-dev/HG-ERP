import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./quotes.repo', () => ({
  quotesRepo: {
    nextCode: vi.fn(),
    list: vi.fn(),
    findById: vi.fn(),
    listLines: vi.fn(),
    insert: vi.fn(),
    replaceLines: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
    countLines: vi.fn(),
  },
}))
vi.mock('./sales.repo', () => ({ customersRepo: { findById: vi.fn(), list: vi.fn() } }))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { findById: vi.fn() },
}))
vi.mock('@/modules/core/users/users.repo', () => ({ usersRepo: { list: vi.fn() } }))
vi.mock('@/events/bus', () => ({ emit: vi.fn() }))

import { quotesService } from './quotes.service'
import { quotesRepo } from './quotes.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import type { User } from '@/modules/core/users/users.repo'

const admin = { id: 'u-admin', role: 'admin', department_id: null } as unknown as User
const manager = { id: 'u-mgr', role: 'manager', department_id: 'd-x' } as unknown as User
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
      ? ({ id, name: 'Kinh Doanh' } as never)
      : ({ id, name: name ?? 'Kỹ Thuật' } as never),
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDept(null)
  vi.mocked(usersRepo.list).mockResolvedValue([])
})

describe('quotesService.submit — luồng gửi duyệt (FR-SAL-03)', () => {
  it('NV ngoài Kinh doanh không gửi được', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue(QUOTE as never)
    await expect(quotesService.submit(otherNv, 'q1')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('báo giá 0 dòng không gửi duyệt được', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue(QUOTE as never)
    vi.mocked(quotesRepo.countLines).mockResolvedValue(0)
    await expect(quotesService.submit(salesNv, 'q1')).rejects.toMatchObject({
      status: 400,
    })
  })

  it('draft có dòng → pending + emit quote.submitted cho GĐ', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue(QUOTE as never)
    vi.mocked(quotesRepo.countLines).mockResolvedValue(2)
    vi.mocked(quotesRepo.patch).mockResolvedValue({
      ...QUOTE,
      status: 'pending',
    } as never)
    vi.mocked(usersRepo.list).mockResolvedValue([
      { id: 'u-mgr', role: 'manager' },
      { id: 'u-admin', role: 'admin' },
      { id: 'u-nv', role: 'employee' },
    ] as never)

    await quotesService.submit(salesNv, 'q1')

    expect(quotesRepo.patch).toHaveBeenCalledWith('q1', { status: 'pending' })
    const evt = vi.mocked(emit).mock.calls[0][0] as {
      name: string
      approver_ids: string[]
    }
    expect(evt.name).toBe('quote.submitted')
    expect(evt.approver_ids).toEqual(['u-mgr', 'u-admin']) // employee không nhận
  })

  it('đã pending thì không gửi lại được', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue({
      ...QUOTE,
      status: 'pending',
    } as never)
    await expect(quotesService.submit(salesNv, 'q1')).rejects.toMatchObject({
      status: 400,
    })
  })
})

describe('quotesService.decide — GĐ duyệt (BR-04 nửa đầu)', () => {
  it('nhân viên thường không duyệt được', async () => {
    await expect(quotesService.decide(salesNv, 'q1', 'approve')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('chỉ duyệt được khi đang pending', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue(QUOTE as never) // draft
    await expect(quotesService.decide(manager, 'q1', 'approve')).rejects.toMatchObject({
      status: 400,
    })
  })

  it('approve: set approved_by/at + emit quote.decided về người lập', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue({
      ...QUOTE,
      status: 'pending',
    } as never)
    vi.mocked(quotesRepo.patch).mockResolvedValue({
      ...QUOTE,
      status: 'approved',
    } as never)

    await quotesService.decide(manager, 'q1', 'approve')

    const patch = vi.mocked(quotesRepo.patch).mock.calls[0][1] as Record<string, unknown>
    expect(patch.status).toBe('approved')
    expect(patch.approved_by).toBe('u-mgr')
    expect(patch.approved_at).toBeTruthy()
    const evt = vi.mocked(emit).mock.calls[0][0] as { name: string; created_by: string }
    expect(evt.name).toBe('quote.decided')
    expect(evt.created_by).toBe('u-sales')
  })

  it('reject: lưu lý do', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue({
      ...QUOTE,
      status: 'pending',
    } as never)
    vi.mocked(quotesRepo.patch).mockResolvedValue({
      ...QUOTE,
      status: 'rejected',
    } as never)

    await quotesService.decide(admin, 'q1', 'reject', 'Giá thấp quá')

    const patch = vi.mocked(quotesRepo.patch).mock.calls[0][1] as Record<string, unknown>
    expect(patch.status).toBe('rejected')
    expect(patch.rejected_reason).toBe('Giá thấp quá')
  })
})

describe('quotesService.update/remove — báo giá bất biến sau khi gửi', () => {
  const input = { customer_id: 'c1', currency: 'USD', lines: [] }

  it.each(['pending', 'approved', 'rejected'] as const)(
    'không sửa được khi %s',
    async (st) => {
      vi.mocked(quotesRepo.findById).mockResolvedValue({ ...QUOTE, status: st } as never)
      await expect(quotesService.update(salesNv, 'q1', input)).rejects.toMatchObject({
        status: 400,
      })
    },
  )

  it('không xoá được báo giá đã gửi duyệt', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue({
      ...QUOTE,
      status: 'pending',
    } as never)
    await expect(quotesService.remove(salesNv, 'q1')).rejects.toMatchObject({
      status: 400,
    })
  })
})

describe('quotesService.assertApproved — BR-04 nửa sau (S2 dùng khi tạo đơn)', () => {
  it.each(['draft', 'pending', 'rejected'] as const)(
    'chặn tạo đơn từ báo giá %s',
    async (st) => {
      vi.mocked(quotesRepo.findById).mockResolvedValue({ ...QUOTE, status: st } as never)
      await expect(quotesService.assertApproved('q1')).rejects.toMatchObject({
        status: 400,
      })
    },
  )

  it('cho qua khi approved', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue({
      ...QUOTE,
      status: 'approved',
    } as never)
    const q = await quotesService.assertApproved('q1')
    expect(q.status).toBe('approved')
  })
})
