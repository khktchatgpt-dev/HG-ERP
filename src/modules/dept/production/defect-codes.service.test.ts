import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./defect-codes.repo', () => ({
  defectCodesRepo: {
    listActive: vi.fn(),
    listAll: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  },
}))
vi.mock('./production.repo', () => ({ productionRepo: { listStages: vi.fn() } }))

import { defectCodesService } from './defect-codes.service'
import { defectCodesRepo } from './defect-codes.repo'
import { productionRepo } from './production.repo'
import type { User } from '@/modules/core/users/users.repo'

const admin = { id: 'u-admin', role: 'admin' } as unknown as User
const manager = { id: 'u-gd', role: 'manager' } as unknown as User

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productionRepo.listStages).mockResolvedValue([
    { code: 'han', label: 'Hàn' },
    { code: 'son', label: 'Sơn' },
  ])
  vi.mocked(defectCodesRepo.insert).mockResolvedValue({
    item: { id: 'dc1', code: 'han_ro' } as never,
    duplicate: false,
  })
})

describe('defectCodesService — ghi chỉ admin, stage phải thuộc danh mục', () => {
  it('non-admin (kể cả manager) → 403', async () => {
    await expect(
      defectCodesService.create(manager, { code: 'x', label: 'X', sort_order: 0 }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(
      defectCodesService.update(manager, 'dc1', { label: 'Y' }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(defectCodesService.listAll(manager)).rejects.toMatchObject({
      status: 403,
    })
  })

  it('stage_code lạ → 400; null (mọi công đoạn) → OK', async () => {
    await expect(
      defectCodesService.create(admin, {
        code: 'x',
        label: 'X',
        stage_code: 'la_gi',
        sort_order: 0,
      }),
    ).rejects.toMatchObject({ status: 400 })
    await defectCodesService.create(admin, {
      code: 'x',
      label: 'X',
      stage_code: null,
      sort_order: 0,
    })
    expect(defectCodesRepo.insert).toHaveBeenCalled()
  })

  it('code trùng → 409', async () => {
    vi.mocked(defectCodesRepo.insert).mockResolvedValue({ item: null, duplicate: true })
    await expect(
      defectCodesService.create(admin, { code: 'khac', label: 'X', sort_order: 0 }),
    ).rejects.toMatchObject({ status: 409 })
  })
})
