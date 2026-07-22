import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from '@/modules/core/users/users.repo'

vi.mock('./rbac.repo', () => ({
  rbacRepo: {
    permissionKeysForUser: vi.fn(),
    listRoles: vi.fn(),
    listPermissions: vi.fn(),
    listRolePermissions: vi.fn(),
    listUserRoles: vi.fn(),
  },
}))

import { rbacRepo } from './rbac.repo'
import { hasPermission, assertPermission, rbacService } from './rbac.service'

const admin = { id: 'a1', role: 'admin' } as unknown as User
const staff = { id: 'u1', role: 'employee' } as unknown as User
const manager = { id: 'm1', role: 'manager' } as unknown as User

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(rbacRepo.permissionKeysForUser).mockResolvedValue([])
})

describe('hasPermission', () => {
  it('admin luôn true, không cần query DB', async () => {
    expect(await hasPermission(admin, 'production.lsx.approve')).toBe(true)
    expect(rbacRepo.permissionKeysForUser).not.toHaveBeenCalled()
  })

  it('employee: true nếu key nằm trong tập quyền', async () => {
    vi.mocked(rbacRepo.permissionKeysForUser).mockResolvedValue([
      'sales.member',
      'production.lsx.issue',
    ])
    expect(await hasPermission(staff, 'production.lsx.issue')).toBe(true)
  })

  it('employee: false nếu key không có', async () => {
    vi.mocked(rbacRepo.permissionKeysForUser).mockResolvedValue(['sales.member'])
    expect(await hasPermission(staff, 'production.lsx.approve')).toBe(false)
  })
})

describe('assertPermission', () => {
  it('ném 403 khi thiếu quyền', async () => {
    vi.mocked(rbacRepo.permissionKeysForUser).mockResolvedValue([])
    await expect(assertPermission(staff, 'warehouse.edit')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('không ném khi có quyền', async () => {
    vi.mocked(rbacRepo.permissionKeysForUser).mockResolvedValue(['warehouse.edit'])
    await expect(assertPermission(staff, 'warehouse.edit')).resolves.toBeUndefined()
  })
})

describe('rbacService.matrix', () => {
  it('chỉ admin đọc được', async () => {
    await expect(rbacService.matrix(manager)).rejects.toMatchObject({ status: 403 })
    await expect(rbacService.matrix(staff)).rejects.toMatchObject({ status: 403 })
  })

  it('admin nhận đủ 4 phần dữ liệu', async () => {
    vi.mocked(rbacRepo.listRoles).mockResolvedValue([])
    vi.mocked(rbacRepo.listPermissions).mockResolvedValue([])
    vi.mocked(rbacRepo.listRolePermissions).mockResolvedValue([])
    vi.mocked(rbacRepo.listUserRoles).mockResolvedValue([])
    const m = await rbacService.matrix(admin)
    expect(m).toEqual({
      roles: [],
      permissions: [],
      rolePermissions: [],
      userRoles: [],
    })
  })
})
