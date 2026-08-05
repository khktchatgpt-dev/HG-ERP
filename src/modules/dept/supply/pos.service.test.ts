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
// 0086: director = manager THUỘC PHÒNG BGĐ (workspace exec).
const boss = { id: 'u-boss', role: 'manager', department_id: 'd-bgd' } as unknown as User

const DEPTS: Record<string, DeptInfo> = {
  'd-bgd': { name: 'Ban Giám Đốc', workspace_id: 'exec' },
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
  it('tạo PO (0116): kiểm NCC + LSX tồn tại, lưu NHÁP, CHƯA notify GĐ', async () => {
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

    await posService.create(staff, {
      production_order_id: 'lsx1',
      supplier_id: 's1',
      currency: 'VND',
      price_includes_vat: true,
      lines: [{ material_id: 'm1', qty_ordered: 150, unit_price: 77000, unit2: 'kg' }],
    })

    // Nháp: chưa tới bàn duyệt, KHÔNG bắn po.submitted lúc tạo (chuyển sang submit()).
    const row = vi.mocked(posRepo.insert).mock.calls[0][0] as { status: string }
    expect(row.status).toBe('draft')
    expect(emit).not.toHaveBeenCalled()
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

  it('PO ngoài LSX (0076): không gắn LSX — bỏ qua tra LSX, lưu null', async () => {
    vi.mocked(suppliersRepo.findById).mockResolvedValue({
      id: 's1',
      name: 'Nhôm Tiến Đạt',
      is_active: true,
    } as never)
    vi.mocked(posRepo.nextCode).mockResolvedValue('PO-2026-0002')
    vi.mocked(posRepo.insert).mockResolvedValue({
      ...PO,
      production_order_id: null,
    } as never)

    await posService.create(staff, {
      production_order_id: null,
      supplier_id: 's1',
      currency: 'VND',
      price_includes_vat: true,
      lines: [{ material_id: 'm1', qty_ordered: 5 }],
    })

    expect(productionRepo.findById).not.toHaveBeenCalled()
    const row = vi.mocked(posRepo.insert).mock.calls[0][0] as {
      production_order_id: string | null
    }
    expect(row.production_order_id).toBeNull()
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

describe('posService.submit — 0116: gửi GĐ duyệt mới notify', () => {
  const DRAFT = { ...PO, status: 'draft' }

  it('draft → pending_approval + emit po.submitted cho người duyệt', async () => {
    vi.mocked(posRepo.findById).mockResolvedValue(DRAFT as never)
    vi.mocked(posRepo.listLines).mockResolvedValue([{ id: 'l1' }] as never)
    vi.mocked(suppliersRepo.findById).mockResolvedValue({
      id: 's1',
      name: 'Nhôm Tiến Đạt',
    } as never)
    vi.mocked(productionRepo.findById).mockResolvedValue({
      id: 'lsx1',
      code: 'LSX-2026-0001',
    } as never)
    vi.mocked(posRepo.patch).mockResolvedValue({
      ...PO,
      status: 'pending_approval',
    } as never)
    vi.mocked(usersRepo.list).mockResolvedValue([
      { id: 'u-boss', role: 'manager' },
      { id: 'u-sup', role: 'employee' },
    ] as never)

    await posService.submit(staff, 'po1')

    const patch = vi.mocked(posRepo.patch).mock.calls[0][1] as Record<string, unknown>
    expect(patch.status).toBe('pending_approval')
    const evt = vi.mocked(emit).mock.calls[0][0] as {
      name: string
      approver_ids: string[]
      lsx_code: string | null
    }
    expect(evt.name).toBe('po.submitted')
    expect(evt.approver_ids).toEqual(['u-boss'])
    expect(evt.lsx_code).toBe('LSX-2026-0001')
  })

  it('đơn không còn là nháp → chặn', async () => {
    vi.mocked(posRepo.findById).mockResolvedValue(PO as never)
    await expect(posService.submit(staff, 'po1')).rejects.toMatchObject({ status: 400 })
  })

  it('nháp rỗng (0 dòng) → chặn gửi duyệt', async () => {
    vi.mocked(posRepo.findById).mockResolvedValue(DRAFT as never)
    vi.mocked(posRepo.listLines).mockResolvedValue([] as never)
    await expect(posService.submit(staff, 'po1')).rejects.toMatchObject({ status: 400 })
    expect(posRepo.patch).not.toHaveBeenCalled()
  })
})

describe('posService.remove — chỉ xoá hẳn được NHÁP', () => {
  it('draft → xoá hẳn (dòng cascade theo)', async () => {
    vi.mocked(posRepo.findById).mockResolvedValue({ ...PO, status: 'draft' } as never)
    await posService.remove(staff, 'po1')
    expect(posRepo.delete).toHaveBeenCalledWith('po1')
  })

  it.each(['pending_approval', 'approved', 'received'] as const)(
    'đơn "%s" không xoá được — phải dùng huỷ',
    async (st) => {
      vi.mocked(posRepo.findById).mockResolvedValue({ ...PO, status: st } as never)
      await expect(posService.remove(staff, 'po1')).rejects.toMatchObject({
        status: 400,
      })
      expect(posRepo.delete).not.toHaveBeenCalled()
    },
  )
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
