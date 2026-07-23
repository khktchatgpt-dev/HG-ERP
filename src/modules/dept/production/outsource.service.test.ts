import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./outsource.repo', () => ({
  outsourceRepo: {
    listByLsx: vi.fn(),
    insert: vi.fn(),
    findById: vi.fn(),
    delete: vi.fn(),
  },
}))
vi.mock('./components.repo', () => ({ componentsRepo: { listByLsx: vi.fn() } }))
vi.mock('./production.repo', () => ({ productionRepo: { findById: vi.fn() } }))
vi.mock('./production.service', () => ({ isProductionStaff: vi.fn() }))
vi.mock('@/modules/dept/supply/supply.repo', () => ({
  suppliersRepo: { findById: vi.fn() },
}))
vi.mock('@/modules/dept/supply/suppliers.service', () => ({ isSupplyStaff: vi.fn() }))
vi.mock('@/modules/core/rbac/rbac.service', () => ({ hasPermission: vi.fn(), assertAction: vi.fn() }))

import { outsourceService } from './outsource.service'
import { outsourceRepo } from './outsource.repo'
import { componentsRepo } from './components.repo'
import { productionRepo } from './production.repo'
import { isProductionStaff } from './production.service'
import { suppliersRepo } from '@/modules/dept/supply/supply.repo'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { hasPermission, assertAction } from '@/modules/core/rbac/rbac.service'
import { makeFakeHasPermission, makeFakeAssertAction, type DeptInfo } from '@/test-utils/rbac'
import { Forbidden } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'

const worker = {
  id: 'u-to',
  role: 'employee',
  department_id: 'd-to',
} as unknown as User

const DEPTS: Record<string, DeptInfo> = {
  'd-to': { name: 'Tổ Phôi', workspace_id: 'production' },
}

const LSX = { id: 'lsx1', code: 'LSX-01', status: 'in_progress' }
const COMPONENT = { id: 'c1', name: 'TAY+TỰA' }
const TTP = { id: 's-ttp', name: 'TTP', is_active: true }

const SEND = {
  component_id: 'c1',
  supplier_id: 's-ttp',
  direction: 'send' as const,
  entry_date: '2026-07-11',
  qty: 50,
  defect_qty: 0,
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isProductionStaff).mockResolvedValue(true)
  vi.mocked(isSupplyStaff).mockResolvedValue(false)
  vi.mocked(hasPermission).mockImplementation(
    makeFakeHasPermission((id) => DEPTS[id] ?? null),
  )
  vi.mocked(assertAction).mockImplementation(
    makeFakeAssertAction((id) => DEPTS[id] ?? null),
  )
  vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never)
  vi.mocked(componentsRepo.listByLsx).mockResolvedValue([COMPONENT] as never)
  vi.mocked(suppliersRepo.findById).mockResolvedValue(TTP as never)
  vi.mocked(outsourceRepo.listByLsx).mockResolvedValue([] as never)
})

describe('outsourceService.record — giao/nhận gia công (FR-OS-01/02)', () => {
  it('ghi đợt giao — insert đúng LSX/chi tiết/đơn vị', async () => {
    const { warnings } = await outsourceService.record(worker, 'lsx1', SEND)
    expect(warnings).toEqual([])
    expect(outsourceRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        production_order_id: 'lsx1',
        component_id: 'c1',
        supplier_id: 's-ttp',
        direction: 'send',
        qty: 50,
        created_by: worker.id,
      }),
    )
  })

  it('nhận về VƯỢT tổng đã giao → cảnh báo nhưng vẫn ghi', async () => {
    vi.mocked(outsourceRepo.listByLsx).mockResolvedValue([
      {
        component_id: 'c1',
        supplier_id: 's-ttp',
        direction: 'send',
        qty: 50,
        defect_qty: 0,
        supplier_name: 'TTP',
      },
    ] as never)
    const { warnings } = await outsourceService.record(worker, 'lsx1', {
      ...SEND,
      direction: 'receive',
      qty: 60,
    })
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toContain('nhận 60 > đã giao 50')
    expect(outsourceRepo.insert).toHaveBeenCalled()
  })

  it('đơn vị ngừng giao dịch → 400; chi tiết lạ → 400; LSX chưa duyệt → 400', async () => {
    vi.mocked(suppliersRepo.findById).mockResolvedValue({
      ...TTP,
      is_active: false,
    } as never)
    await expect(outsourceService.record(worker, 'lsx1', SEND)).rejects.toMatchObject({
      status: 400,
    })

    vi.mocked(suppliersRepo.findById).mockResolvedValue(TTP as never)
    await expect(
      outsourceService.record(worker, 'lsx1', { ...SEND, component_id: 'c-la' }),
    ).rejects.toMatchObject({ status: 400 })

    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'pending_approval',
    } as never)
    await expect(outsourceService.record(worker, 'lsx1', SEND)).rejects.toMatchObject({
      status: 400,
    })
  })

  it('NV ngoài xưởng/KH-CƯ/QL → 403', async () => {
    vi.mocked(assertAction).mockRejectedValue(Forbidden('x'))
    await expect(outsourceService.record(worker, 'lsx1', SEND)).rejects.toMatchObject({
      status: 403,
    })
  })
})

describe('outsourceService.summary — đối chiếu per (chi tiết × đơn vị)', () => {
  it('gộp giao/nhận đúng cặp', async () => {
    vi.mocked(outsourceRepo.listByLsx).mockResolvedValue([
      {
        component_id: 'c1',
        supplier_id: 's-ttp',
        direction: 'send',
        qty: 50,
        defect_qty: 0,
        supplier_name: 'TTP',
      },
      {
        component_id: 'c1',
        supplier_id: 's-ttp',
        direction: 'receive',
        qty: 30,
        defect_qty: 2,
        supplier_name: 'TTP',
      },
    ] as never)

    const out = await outsourceService.summary(worker, 'lsx1')
    expect(out.pairs[0]).toMatchObject({
      component_name: 'TAY+TỰA',
      supplier_name: 'TTP',
      sent: 50,
      received: 30,
      missing: 20,
      defect: 2,
      pct: 0.6,
    })
  })
})
