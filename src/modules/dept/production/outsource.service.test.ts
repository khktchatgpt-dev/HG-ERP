import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./outsource.repo', () => ({
  outsourceRepo: {
    insert: vi.fn(),
    findById: vi.fn(),
    listByLsx: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('./components.repo', () => ({
  componentsRepo: { listByLsx: vi.fn() },
}))
vi.mock('./production.repo', () => ({
  productionRepo: { findById: vi.fn() },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({ assertAction: vi.fn() }))

import { outsourceService } from './outsource.service'
import { outsourceRepo } from './outsource.repo'
import { componentsRepo } from './components.repo'
import { productionRepo } from './production.repo'
import type { User } from '@/modules/core/users/users.repo'

const user = { id: 'u1', role: 'admin' } as unknown as User

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productionRepo.findById).mockResolvedValue({
    id: 'lsx1',
    status: 'in_progress',
  } as never)
  vi.mocked(componentsRepo.listByLsx).mockResolvedValue([
    { id: 'c1', dm_kg: 0.5 },
  ] as never)
})

describe('outsourceService.record — backflush kg như sổ thường (GĐ5.1)', () => {
  const base = {
    component_id: 'c1',
    supplier_id: 's1',
    direction: 'send' as const,
    entry_date: '2026-08-23',
    qty: 100,
  }

  it('kg bỏ trống → tự tính ĐM × SL', async () => {
    await outsourceService.record(user, 'lsx1', base)
    expect(outsourceRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ kg: 50 }))
  })

  it('người nhập ghi đè kg → giữ nguyên', async () => {
    await outsourceService.record(user, 'lsx1', { ...base, kg: 42 })
    expect(outsourceRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ kg: 42 }))
  })

  it('chi tiết không có định mức kg → null (không đoán)', async () => {
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue([
      { id: 'c1', dm_kg: null },
    ] as never)
    await outsourceService.record(user, 'lsx1', base)
    expect(outsourceRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ kg: null }),
    )
  })

  it('chi tiết không thuộc lệnh → 400', async () => {
    await expect(
      outsourceService.record(user, 'lsx1', { ...base, component_id: 'la' }),
    ).rejects.toMatchObject({ status: 400 })
  })
})
