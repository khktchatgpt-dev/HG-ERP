import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./sales.repo', () => ({
  customersRepo: {
    list: vi.fn(),
    findById: vi.fn(),
    existsByCode: vi.fn(),
    usageCounts: vi.fn(),
    counts: vi.fn(),
    activityByCustomers: vi.fn(),
    insert: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  assertAction: vi.fn(),
  hasPermission: vi.fn(),
}))

import { salesService } from './sales.service'
import { customersRepo } from './sales.repo'
import { HttpError } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'

const sale = { id: 'u-sale', role: 'employee' } as unknown as User
const manager = { id: 'u-mgr', role: 'manager' } as unknown as User

const CUSTOMER = {
  id: 'c1',
  code: 'KH-001',
  name: 'Möbel Hali GmbH',
  owner_id: 'u-sale',
  is_active: true,
}

const repo = customersRepo as unknown as Record<string, ReturnType<typeof vi.fn>>

beforeEach(() => {
  vi.clearAllMocks()
  repo.findById.mockResolvedValue(CUSTOMER)
  repo.existsByCode.mockResolvedValue(false)
  repo.usageCounts.mockResolvedValue({ quotes: 0, orders: 0 })
  repo.insert.mockImplementation(async (row: unknown) => row)
  repo.patch.mockImplementation(async (_id: string, p: unknown) => p)
  repo.delete.mockResolvedValue(undefined)
})

describe('salesService.list — bộ lọc trạng thái giao dịch', () => {
  beforeEach(() => repo.list.mockResolvedValue({ rows: [], total: 0 }))

  it('mặc định chỉ KH đang giao dịch', async () => {
    await salesService.list(sale, { page: 1, page_size: 20 })
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'active' }))
  })

  it('xem được KH ĐÃ NGỪNG (trước đây bị ẩn vĩnh viễn)', async () => {
    await salesService.list(sale, { page: 1, page_size: 20, status: 'inactive' })
    expect(repo.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'inactive' }),
    )
  })

  it('lọc KH chưa gán phụ trách đi xuống repo, không lọc ở app sau phân trang', async () => {
    await salesService.list(sale, { page: 1, page_size: 20, unassigned: true })
    expect(repo.list).toHaveBeenCalledWith(expect.objectContaining({ unassigned: true }))
  })
})

describe('salesService.create — mã KH là duy nhất', () => {
  it('mã đã có khách khác dùng → 409 CODE_TAKEN (không để DB ném lỗi thô)', async () => {
    repo.existsByCode.mockResolvedValue(true)
    await expect(
      salesService.create(sale, { name: 'KH mới', code: 'KH-001' }),
    ).rejects.toMatchObject({ status: 409, code: 'CODE_TAKEN' })
    expect(repo.insert).not.toHaveBeenCalled()
  })

  it('không gõ mã thì khỏi kiểm (mã là tuỳ chọn)', async () => {
    await salesService.create(sale, { name: 'KH không mã' })
    expect(repo.existsByCode).not.toHaveBeenCalled()
    expect(repo.insert).toHaveBeenCalled()
  })

  it('không nêu phụ trách → gán cho chính người tạo', async () => {
    await salesService.create(sale, { name: 'KH mới' })
    expect(repo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ owner_id: 'u-sale' }),
    )
  })
})

describe('salesService.update', () => {
  it('đổi sang mã đang bị dùng → 409; giữ nguyên mã cũ thì không kiểm', async () => {
    repo.existsByCode.mockResolvedValue(true)
    await expect(
      salesService.update(sale, 'c1', { code: 'KH-999' }),
    ).rejects.toMatchObject({ status: 409, code: 'CODE_TAKEN' })

    repo.existsByCode.mockClear()
    await salesService.update(sale, 'c1', { code: 'KH-001', name: 'Tên mới' })
    expect(repo.existsByCode).not.toHaveBeenCalled()
  })

  it('sale KHÔNG sửa được KH của người khác; manager thì được', async () => {
    repo.findById.mockResolvedValue({ ...CUSTOMER, owner_id: 'u-khac' })
    await expect(salesService.update(sale, 'c1', { name: 'X' })).rejects.toMatchObject({
      status: 403,
    })
    await expect(salesService.update(manager, 'c1', { name: 'X' })).resolves.toBeDefined()
  })

  it('ngừng giao dịch = patch is_active, KH vẫn còn trong DB', async () => {
    await salesService.update(sale, 'c1', { is_active: false })
    expect(repo.patch).toHaveBeenCalledWith('c1', { is_active: false })
    expect(repo.delete).not.toHaveBeenCalled()
  })
})

describe('salesService.remove — chặn xoá KH đã có lịch sử', () => {
  it('KH có báo giá / đơn → 409 kèm gợi ý "Ngừng giao dịch" (FK là on delete restrict)', async () => {
    repo.usageCounts.mockResolvedValue({ quotes: 2, orders: 3 })
    const err = await salesService.remove(sale, 'c1').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(HttpError)
    expect(err).toMatchObject({ status: 409, code: 'CUSTOMER_IN_USE' })
    expect((err as HttpError).message).toContain('2 báo giá')
    expect((err as HttpError).message).toContain('3 đơn hàng')
    expect((err as HttpError).message).toContain('Ngừng giao dịch')
    expect(repo.delete).not.toHaveBeenCalled()
  })

  it('chỉ có báo giá (chưa có đơn) → vẫn chặn, thông điệp không nhắc đơn', async () => {
    repo.usageCounts.mockResolvedValue({ quotes: 1, orders: 0 })
    const err = (await salesService
      .remove(sale, 'c1')
      .catch((e: unknown) => e)) as HttpError
    expect(err.message).toContain('1 báo giá')
    expect(err.message).not.toContain('đơn hàng')
  })

  it('KH sạch lịch sử → xoá được', async () => {
    await salesService.remove(sale, 'c1')
    expect(repo.delete).toHaveBeenCalledWith('c1')
  })

  it('kiểm quyền sở hữu TRƯỚC khi đếm lịch sử', async () => {
    repo.findById.mockResolvedValue({ ...CUSTOMER, owner_id: 'u-khac' })
    await expect(salesService.remove(sale, 'c1')).rejects.toMatchObject({ status: 403 })
    expect(repo.usageCounts).not.toHaveBeenCalled()
  })
})
