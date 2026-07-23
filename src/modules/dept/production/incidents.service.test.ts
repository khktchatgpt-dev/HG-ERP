import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./incidents.repo', () => ({
  incidentsRepo: { list: vi.fn(), findById: vi.fn(), insert: vi.fn(), resolve: vi.fn() },
}))
vi.mock('./production.repo', () => ({ productionRepo: { findById: vi.fn() } }))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { findById: vi.fn() },
}))
vi.mock('@/modules/core/users/users.repo', () => ({ usersRepo: { list: vi.fn() } }))
// on: register.ts (import side-effect của service) đăng ký handler lúc import.
vi.mock('@/events/bus', () => ({ emit: vi.fn(), on: vi.fn() }))
vi.mock('@/modules/core/rbac/rbac.service', () => ({ hasPermission: vi.fn(), assertAction: vi.fn() }))

import { incidentsService } from './incidents.service'
import { incidentsRepo } from './incidents.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import { hasPermission, assertAction } from '@/modules/core/rbac/rbac.service'
import { makeFakeHasPermission, makeFakeAssertAction, type DeptInfo } from '@/test-utils/rbac'
import type { User } from '@/modules/core/users/users.repo'

const toHan = { id: 'u-th', role: 'employee', department_id: 'd-han' } as unknown as User
const manager = { id: 'u-gd', role: 'manager', department_id: null } as unknown as User
const outsider = { id: 'u-x', role: 'employee', department_id: 'd-x' } as unknown as User

const DEPTS: Record<string, DeptInfo> = {
  'd-han': { name: 'Tổ Hàn', workspace_id: 'production' },
  'd-x': { name: 'Sales', workspace_id: 'sales' },
}

const INCIDENT = {
  id: 'i1',
  production_order_id: null,
  stage: 'han',
  department_id: 'd-han',
  reported_by: 'u-th',
  message: 'Máy hàn số 2 hỏng',
  status: 'open',
  resolved_by: null,
  resolved_at: null,
  created_at: '2026-07-20T00:00:00Z',
  lsx_code: null,
  department_name: 'Tổ Hàn',
  reported_by_name: 'Thợ Hàn',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(hasPermission).mockImplementation(
    makeFakeHasPermission((id) => DEPTS[id] ?? null),
  )
  vi.mocked(assertAction).mockImplementation(
    makeFakeAssertAction((id) => DEPTS[id] ?? null),
  )
  vi.mocked(departmentsRepo.findById).mockResolvedValue({
    id: 'd-han',
    name: 'Tổ Hàn',
  } as never)
  vi.mocked(usersRepo.list).mockResolvedValue([
    { id: 'u-gd', role: 'manager' },
    { id: 'u-admin', role: 'admin' },
    { id: 'u-th', role: 'employee' },
  ] as never)
  vi.mocked(incidentsRepo.insert).mockResolvedValue(INCIDENT as never)
  vi.mocked(incidentsRepo.findById).mockResolvedValue(INCIDENT as never)
  vi.mocked(incidentsRepo.resolve).mockResolvedValue({
    ...INCIDENT,
    status: 'resolved',
  } as never)
})

describe('incidentsService.report — tổ báo sự cố', () => {
  it('NV xưởng báo được → insert theo tổ mình + emit báo quản đốc (admin/manager)', async () => {
    await incidentsService.report(toHan, { message: 'Máy hàn số 2 hỏng' })
    expect(incidentsRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ department_id: 'd-han', reported_by: 'u-th' }),
    )
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'production.incident.reported',
        department_name: 'Tổ Hàn',
        notify_ids: ['u-gd', 'u-admin'], // trừ chính người báo
      }),
    )
  })

  it('NV ngoài xưởng → 403', async () => {
    await expect(
      incidentsService.report(outsider, { message: 'x' }),
    ).rejects.toMatchObject({ status: 403 })
    expect(incidentsRepo.insert).not.toHaveBeenCalled()
  })
})

describe('incidentsService.resolve — chỉ quản đốc (GĐ/QL)', () => {
  it('manager đóng được → emit báo người báo cáo', async () => {
    const out = await incidentsService.resolve(manager, 'i1')
    expect(out.status).toBe('resolved')
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'production.incident.resolved',
        notify_ids: ['u-th'],
      }),
    )
  })

  it('đã resolved → trả nguyên, không emit lại', async () => {
    vi.mocked(incidentsRepo.findById).mockResolvedValue({
      ...INCIDENT,
      status: 'resolved',
    } as never)
    await incidentsService.resolve(manager, 'i1')
    expect(incidentsRepo.resolve).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it('NV xưởng (employee) → 403', async () => {
    await expect(incidentsService.resolve(toHan, 'i1')).rejects.toMatchObject({
      status: 403,
    })
  })
})
