import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./day-locks.repo', () => ({
  dayLocksRepo: {
    find: vi.fn(),
    listByDate: vi.fn(),
    insert: vi.fn(),
    deleteByTeamDate: vi.fn(),
  },
}))
vi.mock('./production.service', () => ({ isProductionStaff: vi.fn() }))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { findById: vi.fn() },
}))

import { dayLocksService } from './day-locks.service'
import { dayLocksRepo } from './day-locks.repo'
import { isProductionStaff } from './production.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import type { User } from '@/modules/core/users/users.repo'

const toHan = { id: 'u-th', role: 'employee', department_id: 'd-han' } as unknown as User
const manager = { id: 'u-gd', role: 'manager', department_id: null } as unknown as User
const outsider = { id: 'u-x', role: 'employee', department_id: 'd-x' } as unknown as User
const unbound = { id: 'u-ub', role: 'employee', department_id: null } as unknown as User

const LOCK = {
  id: 'lock1',
  team_department_id: 'd-han',
  entry_date: '2026-07-20',
  locked_by: 'u-th',
  locked_at: '2026-07-20T10:00:00Z',
  team_name: 'Tổ Hàn',
  locked_by_name: 'Thống kê Tổ Hàn',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isProductionStaff).mockImplementation(
    async (u: User) => u.department_id === 'd-han',
  )
  vi.mocked(departmentsRepo.findById).mockImplementation(async (id: string) =>
    id === 'd-han'
      ? ({ id, name: 'Tổ Hàn', workspace_id: 'production' } as never)
      : id === 'd-x'
        ? ({ id, name: 'Sales', workspace_id: 'sales' } as never)
        : null,
  )
  vi.mocked(dayLocksRepo.insert).mockResolvedValue({ lock: LOCK, duplicate: false })
  vi.mocked(dayLocksRepo.find).mockResolvedValue(LOCK as never)
})

describe('dayLocksService.lock — chốt sổ tổ + ngày', () => {
  it('NV xưởng chốt tổ mình — team lạ gửi lên bị BỎ QUA (ép tổ mình)', async () => {
    await dayLocksService.lock(toHan, {
      entry_date: '2026-07-20',
      team_department_id: 'd-khac', // cố lách
    })
    expect(dayLocksRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ team_department_id: 'd-han', locked_by: 'u-th' }),
    )
  })

  it('manager chốt hộ tổ chỉ định', async () => {
    await dayLocksService.lock(manager, {
      entry_date: '2026-07-20',
      team_department_id: 'd-han',
    })
    expect(dayLocksRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ team_department_id: 'd-han' }),
    )
  })

  it('NV ngoài xưởng → 403; NV xưởng chưa gán tổ → 400', async () => {
    await expect(
      dayLocksService.lock(outsider, { entry_date: '2026-07-20' }),
    ).rejects.toMatchObject({ status: 403 })
    vi.mocked(isProductionStaff).mockResolvedValue(true)
    await expect(
      dayLocksService.lock(unbound, { entry_date: '2026-07-20' }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('tổ không thuộc xưởng → 400', async () => {
    await expect(
      dayLocksService.lock(manager, {
        entry_date: '2026-07-20',
        team_department_id: 'd-x',
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('chốt trùng → 409 Conflict', async () => {
    vi.mocked(dayLocksRepo.insert).mockResolvedValue({ lock: null, duplicate: true })
    await expect(
      dayLocksService.lock(toHan, { entry_date: '2026-07-20' }),
    ).rejects.toMatchObject({ status: 409 })
  })
})

describe('dayLocksService.unlock — chỉ GĐ/Ban quản lý', () => {
  it('manager mở khoá được', async () => {
    await dayLocksService.unlock(manager, 'd-han', '2026-07-20')
    expect(dayLocksRepo.deleteByTeamDate).toHaveBeenCalledWith('d-han', '2026-07-20')
  })

  it('NV xưởng (kể cả người chốt) → 403', async () => {
    await expect(
      dayLocksService.unlock(toHan, 'd-han', '2026-07-20'),
    ).rejects.toMatchObject({ status: 403 })
  })

  it('chưa chốt → 404', async () => {
    vi.mocked(dayLocksRepo.find).mockResolvedValue(null)
    await expect(
      dayLocksService.unlock(manager, 'd-han', '2026-07-20'),
    ).rejects.toMatchObject({ status: 404 })
  })
})
