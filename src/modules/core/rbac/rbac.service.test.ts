import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User } from '@/modules/core/users/users.repo'

vi.mock('./rbac.repo', () => ({
  rbacRepo: {
    permissionKeysForUser: vi.fn(),
    listRoles: vi.fn(),
    listPermissions: vi.fn(),
    listRolePermissions: vi.fn(),
    listUserRoles: vi.fn(),
    findRoleById: vi.fn(),
    findRoleByKey: vi.fn(),
    insertRole: vi.fn(),
    updateRole: vi.fn(),
    permissionKeysForRole: vi.fn(),
    setRolePermissions: vi.fn(),
    listManualRoleIds: vi.fn(),
    addManualRoles: vi.fn(),
    removeManualRoles: vi.fn(),
  },
  rbacAuditRepo: { insert: vi.fn(), listRecent: vi.fn() },
}))
vi.mock('@/modules/core/users/users.repo', () => ({
  usersRepo: { list: vi.fn(), findById: vi.fn() },
}))
vi.mock('@/events/bus', () => ({ emit: vi.fn() }))

import { rbacRepo } from './rbac.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import { hasPermission, assertPermission, rbacService } from './rbac.service'

const admin = { id: 'a1', role: 'admin' } as unknown as User
const staff = { id: 'u1', role: 'employee' } as unknown as User
const manager = { id: 'm1', role: 'manager' } as unknown as User

const role = (over: Partial<Record<string, unknown>> = {}) =>
  ({
    id: 'r1',
    key: 'qc_lead',
    label: 'Tổ trưởng QC',
    description: null,
    is_system: false,
    is_active: true,
    sort_order: 100,
    ...over,
  }) as never

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

  it('admin nhận đủ dữ liệu (kèm danh sách user)', async () => {
    vi.mocked(rbacRepo.listRoles).mockResolvedValue([])
    vi.mocked(rbacRepo.listPermissions).mockResolvedValue([])
    vi.mocked(rbacRepo.listRolePermissions).mockResolvedValue([])
    vi.mocked(rbacRepo.listUserRoles).mockResolvedValue([])
    vi.mocked(usersRepo.list).mockResolvedValue([
      { id: 'u1', name: 'Nam', email: 'nam@hg.com' },
    ] as never)
    const m = await rbacService.matrix(admin)
    expect(m).toEqual({
      roles: [],
      permissions: [],
      rolePermissions: [],
      userRoles: [],
      users: [{ id: 'u1', name: 'Nam', email: 'nam@hg.com' }],
    })
  })
})

describe('rbacService — ghi (Phase 3): authz + self-lock', () => {
  it('mọi write chặn không phải admin → 403', async () => {
    await expect(
      rbacService.createRole(manager, { key: 'x', label: 'X' }),
    ).rejects.toMatchObject({ status: 403 })
    await expect(rbacService.setRolePermissions(staff, 'r1', [])).rejects.toMatchObject({
      status: 403,
    })
    await expect(rbacService.setUserManualRoles(manager, 'u1', [])).rejects.toMatchObject(
      { status: 403 },
    )
  })

  it('createRole: key trùng → 409', async () => {
    vi.mocked(rbacRepo.findRoleByKey).mockResolvedValue(role())
    await expect(
      rbacService.createRole(admin, { key: 'qc_lead', label: 'QC' }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('createRole: OK → insert + emit role.created', async () => {
    vi.mocked(rbacRepo.findRoleByKey).mockResolvedValue(null)
    vi.mocked(rbacRepo.insertRole).mockResolvedValue(role())
    await rbacService.createRole(admin, { key: 'qc_lead', label: 'Tổ trưởng QC' })
    expect(rbacRepo.insertRole).toHaveBeenCalled()
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'rbac.role.created', role_key: 'qc_lead' }),
    )
  })

  it('updateRole: CHẶN vô hiệu hoá vai hệ thống', async () => {
    vi.mocked(rbacRepo.findRoleById).mockResolvedValue(role({ is_system: true }))
    await expect(
      rbacService.updateRole(admin, 'r1', { is_active: false }),
    ).rejects.toMatchObject({ status: 403 })
    expect(rbacRepo.updateRole).not.toHaveBeenCalled()
  })

  it('setRolePermissions: key không tồn tại → 400', async () => {
    vi.mocked(rbacRepo.findRoleById).mockResolvedValue(role())
    vi.mocked(rbacRepo.listPermissions).mockResolvedValue([
      { key: 'sales.member', label: '', domain: 'sales', sort_order: 1 },
    ])
    await expect(
      rbacService.setRolePermissions(admin, 'r1', ['sales.member', 'khong.co']),
    ).rejects.toMatchObject({ status: 400 })
    expect(rbacRepo.setRolePermissions).not.toHaveBeenCalled()
  })

  it('setRolePermissions: tính delta + emit added/removed', async () => {
    vi.mocked(rbacRepo.findRoleById).mockResolvedValue(role())
    vi.mocked(rbacRepo.listPermissions).mockResolvedValue([
      { key: 'a.x', label: '', domain: 'a', sort_order: 1 },
      { key: 'a.y', label: '', domain: 'a', sort_order: 2 },
    ])
    vi.mocked(rbacRepo.permissionKeysForRole).mockResolvedValue(['a.x'])
    await rbacService.setRolePermissions(admin, 'r1', ['a.y'])
    expect(rbacRepo.setRolePermissions).toHaveBeenCalledWith('r1', ['a.y'])
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'rbac.role.permissions_changed',
        added: ['a.y'],
        removed: ['a.x'],
      }),
    )
  })

  it('setUserManualRoles: chỉ đụng role manual + emit assigned/revoked', async () => {
    vi.mocked(usersRepo.findById).mockResolvedValue({
      id: 'u1',
      name: 'Nam',
      email: 'nam@hg.com',
    } as never)
    vi.mocked(rbacRepo.listRoles).mockResolvedValue([
      role({ id: 'r1', key: 'k1', label: 'Vai 1' }),
      role({ id: 'r2', key: 'k2', label: 'Vai 2' }),
    ])
    vi.mocked(rbacRepo.listManualRoleIds).mockResolvedValue(['r1']) // đang có r1
    await rbacService.setUserManualRoles(admin, 'u1', ['r2']) // muốn: r2 (bỏ r1)
    expect(rbacRepo.addManualRoles).toHaveBeenCalledWith('u1', ['r2'], 'a1')
    expect(rbacRepo.removeManualRoles).toHaveBeenCalledWith('u1', ['r1'])
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'rbac.role.assigned', role_id: 'r2' }),
    )
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'rbac.role.revoked', role_id: 'r1' }),
    )
  })
})
