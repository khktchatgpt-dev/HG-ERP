import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./production.repo', () => ({
  productionRepo: {
    findById: vi.fn(),
    patch: vi.fn(),
    insertProgress: vi.fn(),
    insert: vi.fn(),
    existsByCode: vi.fn(),
    list: vi.fn(),
    listProgress: vi.fn(),
    listTracking: vi.fn(),
  },
  saveLsxLineSpecs: vi.fn(),
}))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: {
    findById: vi.fn(),
    patch: vi.fn(),
    insertChange: vi.fn(),
    listLines: vi.fn(),
  },
}))
vi.mock('@/modules/dept/sales/quotes.service', () => ({ isSalesStaff: vi.fn() }))
vi.mock('@/modules/dept/supply/suppliers.service', () => ({ isSupplyStaff: vi.fn() }))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { list: vi.fn() },
}))
vi.mock('@/modules/core/users/users.repo', () => ({ usersRepo: { list: vi.fn() } }))
vi.mock('@/events/bus', () => ({ emit: vi.fn() }))

import { productionService } from './production.service'
import { productionRepo } from './production.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import type { User } from '@/modules/core/users/users.repo'

const manager = { id: 'u-gd', role: 'manager' } as unknown as User
const supply = {
  id: 'u-cu',
  role: 'employee',
  department_id: 'd-supply',
} as unknown as User
const outsider = {
  id: 'u-x',
  role: 'employee',
  department_id: 'd-other',
} as unknown as User

const LSX = {
  id: 'lsx1',
  code: 'LSX-2026-01',
  sales_order_id: 'o1',
  status: 'approved',
  current_stage: null,
  issued_by: 'u-sales',
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never)
  vi.mocked(productionRepo.patch).mockImplementation(
    async (_id, p) => ({ ...LSX, ...p }) as never,
  )
})

describe('updateStage — GĐ/QL hoặc Kế hoạch - Cung ứng (FR-SUP-08)', () => {
  it('NV Cung ứng cập nhật được giai đoạn: LSX approved → in_progress, đơn → in_production', async () => {
    vi.mocked(isSupplyStaff).mockResolvedValue(true)
    const out = await productionService.updateStage(supply, 'lsx1', {
      stage: 'han',
      action: 'done',
    })
    expect(productionRepo.insertProgress).toHaveBeenCalledWith(
      expect.objectContaining({ stage: 'han', updated_by: supply.id }),
    )
    expect(ordersRepo.patch).toHaveBeenCalledWith('o1', { status: 'in_production' })
    expect(out.status).toBe('in_progress')
  })

  it('NV phòng khác → 403, không ghi tiến độ', async () => {
    vi.mocked(isSupplyStaff).mockResolvedValue(false)
    await expect(
      productionService.updateStage(outsider, 'lsx1', { stage: 'han', action: 'done' }),
    ).rejects.toMatchObject({ status: 403 })
    expect(productionRepo.insertProgress).not.toHaveBeenCalled()
  })

  it('LSX chưa duyệt → 400 kể cả với GĐ/QL', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'pending_approval',
    } as never)
    await expect(
      productionService.updateStage(manager, 'lsx1', { stage: 'han', action: 'done' }),
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('complete — GĐ/QL hoặc Kế hoạch - Cung ứng', () => {
  it('NV Cung ứng báo hoàn thành được: LSX + đơn → completed', async () => {
    vi.mocked(isSupplyStaff).mockResolvedValue(true)
    const out = await productionService.complete(supply, 'lsx1')
    expect(out.status).toBe('completed')
    expect(ordersRepo.patch).toHaveBeenCalledWith('o1', { status: 'completed' })
  })

  it('NV phòng khác → 403', async () => {
    vi.mocked(isSupplyStaff).mockResolvedValue(false)
    await expect(productionService.complete(outsider, 'lsx1')).rejects.toMatchObject({
      status: 403,
    })
  })
})

describe('confirmMaterialsReceived — xác nhận nhận vật tư (G-3, FR-PROD-02)', () => {
  it('NV Cung ứng xác nhận được: log action received, KHÔNG đổi trạng thái/giai đoạn', async () => {
    vi.mocked(isSupplyStaff).mockResolvedValue(true)
    await productionService.confirmMaterialsReceived(supply, 'lsx1', 'Đủ theo PXK-0001')
    expect(productionRepo.insertProgress).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'received', note: 'Đủ theo PXK-0001' }),
    )
    expect(productionRepo.patch).not.toHaveBeenCalled()
  })

  it('LSX chưa duyệt → 400', async () => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'pending_approval',
    } as never)
    await expect(
      productionService.confirmMaterialsReceived(manager, 'lsx1'),
    ).rejects.toMatchObject({ status: 400 })
  })

  it('NV phòng khác → 403', async () => {
    vi.mocked(isSupplyStaff).mockResolvedValue(false)
    await expect(
      productionService.confirmMaterialsReceived(outsider, 'lsx1'),
    ).rejects.toMatchObject({ status: 403 })
  })
})

describe('approve/reject — vẫn chỉ GĐ/Ban quản lý (không nới cho Cung ứng)', () => {
  it('NV Cung ứng duyệt LSX → 403', async () => {
    vi.mocked(isSupplyStaff).mockResolvedValue(true)
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: 'pending_approval',
    } as never)
    await expect(productionService.approve(supply, 'lsx1')).rejects.toMatchObject({
      status: 403,
    })
    await expect(productionService.reject(supply, 'lsx1', 'lý do')).rejects.toMatchObject(
      { status: 403 },
    )
  })
})
