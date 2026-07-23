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
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  hasPermission: vi.fn(),
  assertAction: vi.fn(),
}))

import { quotesService } from './quotes.service'
import { quotesRepo } from './quotes.repo'
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
    vi.mocked(quotesRepo.countLines).mockResolvedValue(0)
    await expect(quotesService.send(salesNv, 'q1')).rejects.toMatchObject({
      status: 400,
    })
  })

  it('draft có dòng → sent (không cần ai duyệt)', async () => {
    vi.mocked(quotesRepo.findById).mockResolvedValue(QUOTE as never)
    vi.mocked(quotesRepo.countLines).mockResolvedValue(2)
    vi.mocked(quotesRepo.patch).mockResolvedValue({ ...QUOTE, status: 'sent' } as never)

    await quotesService.send(salesNv, 'q1')

    expect(quotesRepo.patch).toHaveBeenCalledWith('q1', { status: 'sent' })
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
    vi.mocked(quotesRepo.countLines).mockResolvedValue(1)
    vi.mocked(quotesRepo.patch).mockResolvedValue({ ...QUOTE, status: 'sent' } as never)
    await quotesService.send(admin, 'q1')
    expect(quotesRepo.patch).toHaveBeenCalledWith('q1', { status: 'sent' })
  })
})
