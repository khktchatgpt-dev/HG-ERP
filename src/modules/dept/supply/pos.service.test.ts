import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./pos.repo', () => ({
  posRepo: {
    nextCode: vi.fn(),
    list: vi.fn(),
    findById: vi.fn(),
    listLines: vi.fn(),
    insert: vi.fn(),
    replaceLines: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('./supply.repo', () => ({ suppliersRepo: { findById: vi.fn() } }))
vi.mock('@/modules/dept/production/production.repo', () => ({
  productionRepo: { findById: vi.fn() },
}))
vi.mock('@/modules/core/users/users.repo', () => ({ usersRepo: { list: vi.fn() } }))
// on: pos.service nay import '@/events/register' → registerEventHandlers gọi on().
vi.mock('@/events/bus', () => ({ emit: vi.fn(), on: vi.fn() }))
vi.mock('@/modules/core/rbac/rbac.service', () => ({ assertAction: vi.fn() }))

import { posService } from './pos.service'
import { posRepo } from './pos.repo'
import { suppliersRepo } from './supply.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import { usersRepo } from '@/modules/core/users/users.repo'
import { emit } from '@/events/bus'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { makeFakeAssertAction, type DeptInfo } from '@/test-utils/rbac'
import { Forbidden } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'

const staff = { id: 'u-sup', role: 'employee', department_id: 'd-sup' } as unknown as User
const boss = { id: 'u-boss', role: 'manager', department_id: null } as unknown as User

const DEPTS: Record<string, DeptInfo> = {
  'd-sup': { name: 'Cung Ứng - Mua Hàng', workspace_id: 'planning' },
}

const PO = {
  id: 'po1',
  code: 'PO-2026-0001',
  production_order_id: 'lsx1',
  supplier_id: 's1',
  status: 'pending_approval',
  created_by: 'u-sup',
  note: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(usersRepo.list).mockResolvedValue([])
  vi.mocked(assertAction).mockImplementation(
    makeFakeAssertAction((id) => DEPTS[id] ?? null),
  )
})

describe('posService.create — BR-06: đúng 1 LSX + 1 NCC', () => {
  it('tạo PO: kiểm NCC + LSX tồn tại, notify GĐ', async () => {
    vi.mocked(suppliersRepo.findById).mockResolvedValue({
      id: 's1',
      name: 'Nhôm Tiến Đạt',
      is_active: true,
    } as never)
    vi.mocked(productionRepo.findById).mockResolvedValue({
      id: 'lsx1',
      code: 'LSX-2026-0001',
      status: 'approved',
    } as never)
    vi.mocked(posRepo.nextCode).mockResolvedValue('PO-2026-0001')
    vi.mocked(posRepo.insert).mockResolvedValue(PO as never)
    vi.mocked(usersRepo.list).mockResolvedValue([
      { id: 'u-boss', role: 'manager' },
    ] as never)

    await posService.create(staff, {
      production_order_id: 'lsx1',
      supplier_id: 's1',
      currency: 'VND',
      price_includes_vat: true,
      lines: [{ material_id: 'm1', qty_ordered: 150, unit_price: 77000, unit2: 'kg' }],
    })

    const evt = vi.mocked(emit).mock.calls[0][0] as {
      name: string
      approver_ids: string[]
    }
    expect(evt.name).toBe('po.submitted')
    expect(evt.approver_ids).toEqual(['u-boss'])
  })

  it('NCC ngừng giao dịch → chặn', async () => {
    vi.mocked(suppliersRepo.findById).mockResolvedValue({
      id: 's1',
      is_active: false,
    } as never)
    await expect(
      posService.create(staff, {
        production_order_id: 'lsx1',
        supplier_id: 's1',
        currency: 'VND',
        price_includes_vat: true,
        lines: [{ material_id: 'm1', qty_ordered: 1 }],
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('LSX chưa được GĐ duyệt → chặn đặt vật tư', async () => {
    vi.mocked(suppliersRepo.findById).mockResolvedValue({
      id: 's1',
      is_active: true,
    } as never)
    vi.mocked(productionRepo.findById).mockResolvedValue({
      id: 'lsx1',
      status: 'pending_approval',
    } as never)
    await expect(
      posService.create(staff, {
        production_order_id: 'lsx1',
        supplier_id: 's1',
        currency: 'VND',
        price_includes_vat: true,
        lines: [{ material_id: 'm1', qty_ordered: 1 }],
      }),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('ngoài phòng Cung ứng không tạo được', async () => {
    vi.mocked(assertAction).mockRejectedValue(Forbidden('x'))
    await expect(
      posService.create(staff, {
        production_order_id: 'lsx1',
        supplier_id: 's1',
        currency: 'VND',
        price_includes_vat: true,
        lines: [{ material_id: 'm1', qty_ordered: 1 }],
      }),
    ).rejects.toMatchObject({ status: 403 })
  })
})

describe('posService.decide — GĐ duyệt (BR-05 nửa đầu)', () => {
  it('nhân viên thường không duyệt được', async () => {
    await expect(posService.decide(staff, 'po1', 'approve')).rejects.toMatchObject({
      status: 403,
    })
  })

  it('approve: set approved_by/at + emit po.decided', async () => {
    vi.mocked(posRepo.findById).mockResolvedValue(PO as never)
    vi.mocked(posRepo.patch).mockResolvedValue({ ...PO, status: 'approved' } as never)

    await posService.decide(boss, 'po1', 'approve')

    const patch = vi.mocked(posRepo.patch).mock.calls[0][1] as Record<string, unknown>
    expect(patch.status).toBe('approved')
    expect(patch.approved_by).toBe('u-boss')
    const evt = vi.mocked(emit).mock.calls[0][0] as { name: string }
    expect(evt.name).toBe('po.decided')
  })

  it('reject → cancelled kèm lý do trong note', async () => {
    vi.mocked(posRepo.findById).mockResolvedValue(PO as never)
    vi.mocked(posRepo.patch).mockResolvedValue({ ...PO, status: 'cancelled' } as never)

    await posService.decide(boss, 'po1', 'reject', 'Giá cao hơn NCC khác')

    const patch = vi.mocked(posRepo.patch).mock.calls[0][1] as Record<string, unknown>
    expect(patch.status).toBe('cancelled')
    expect(String(patch.note)).toContain('Giá cao hơn NCC khác')
  })

  it('chỉ duyệt được đơn pending_approval', async () => {
    vi.mocked(posRepo.findById).mockResolvedValue({ ...PO, status: 'approved' } as never)
    await expect(posService.decide(boss, 'po1', 'approve')).rejects.toMatchObject({
      status: 400,
    })
  })
})

describe('posService.advance — ⭐ BR-05: chưa duyệt không gửi NCC được', () => {
  it.each(['pending_approval', 'cancelled', 'received'] as const)(
    'từ "%s" KHÔNG chuyển sang ordered được',
    async (st) => {
      vi.mocked(posRepo.findById).mockResolvedValue({ ...PO, status: st } as never)
      await expect(posService.advance(staff, 'po1', 'ordered')).rejects.toMatchObject({
        status: 400,
      })
      expect(posRepo.patch).not.toHaveBeenCalled()
    },
  )

  it('approved → ordered: đóng dấu ordered_at (gửi NCC)', async () => {
    vi.mocked(posRepo.findById).mockResolvedValue({ ...PO, status: 'approved' } as never)
    vi.mocked(posRepo.patch).mockResolvedValue({ ...PO, status: 'ordered' } as never)

    await posService.advance(staff, 'po1', 'ordered')

    const patch = vi.mocked(posRepo.patch).mock.calls[0][1] as Record<string, unknown>
    expect(patch.status).toBe('ordered')
    expect(patch.ordered_at).toBeTruthy()
  })

  it('ordered → confirmed → không đi ngược', async () => {
    vi.mocked(posRepo.findById).mockResolvedValue({ ...PO, status: 'ordered' } as never)
    vi.mocked(posRepo.patch).mockResolvedValue({ ...PO, status: 'confirmed' } as never)
    await posService.advance(staff, 'po1', 'confirmed')
    expect(posRepo.patch).toHaveBeenCalled()

    vi.mocked(posRepo.findById).mockResolvedValue({ ...PO, status: 'confirmed' } as never)
    await expect(posService.advance(staff, 'po1', 'ordered')).rejects.toMatchObject({
      status: 400,
    })
  })
})

describe('posService.update — chỉ đơn chờ duyệt sửa được', () => {
  it.each(['approved', 'ordered', 'received'] as const)('chặn sửa khi %s', async (st) => {
    vi.mocked(posRepo.findById).mockResolvedValue({ ...PO, status: st } as never)
    await expect(
      posService.update(staff, 'po1', {
        production_order_id: 'lsx1',
        supplier_id: 's1',
        currency: 'VND',
        price_includes_vat: true,
        lines: [{ material_id: 'm1', qty_ordered: 1 }],
      }),
    ).rejects.toMatchObject({ status: 400 })
  })
})
