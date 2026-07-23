import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./components.repo', () => ({
  componentsRepo: {
    listByLsx: vi.fn(),
    replaceAll: vi.fn(),
    listPreviousByProducts: vi.fn(),
    countsByLsx: vi.fn(),
  },
}))
vi.mock('./production.repo', () => ({ productionRepo: { findById: vi.fn() } }))
vi.mock('./outputs.repo', () => ({ outputsRepo: { existsForLsx: vi.fn() } }))
vi.mock('./routes.repo', () => ({
  routesRepo: {
    listByLsx: vi.fn(),
    replaceAll: vi.fn(),
    productDefaults: vi.fn(),
    countsByLsx: vi.fn(),
    saveProductDefault: vi.fn(),
  },
}))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: { listLines: vi.fn() },
}))
vi.mock('@/modules/dept/technical/technical.repo', () => ({
  bomLinesRepo: { listWithMaterials: vi.fn() },
}))
vi.mock('@/modules/dept/supply/suppliers.service', () => ({ isSupplyStaff: vi.fn() }))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { findById: vi.fn() },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({ hasPermission: vi.fn() }))

import { componentsService } from './components.service'
import { componentsRepo } from './components.repo'
import { outputsRepo } from './outputs.repo'
import { routesRepo } from './routes.repo'
import { productionRepo } from './production.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { isSupplyStaff } from '@/modules/dept/supply/suppliers.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { hasPermission } from '@/modules/core/rbac/rbac.service'
import { makeFakeHasPermission, type DeptInfo } from '@/test-utils/rbac'
import type { User } from '@/modules/core/users/users.repo'

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

const DEPTS: Record<string, DeptInfo> = {
  'd-supply': { name: 'Kế Hoạch Sản Xuất-cung ứng', workspace_id: 'planning' },
}

const LSX = { id: 'lsx1', code: 'LSX-01', sales_order_id: 'o1', status: 'approved' }
const ORDER_LINES = [
  { id: 'ol1', product_id: 'p1', product_code: 'SP1', product_name: 'Ghế Hali', qty: 48 },
]
const LINE = { order_line_id: 'ol1', name: 'TAY+TỰA', qty_per_unit: 2 }

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(isSupplyStaff).mockResolvedValue(true)
  // canEditComponents (perms.ts) giờ đọc permission production.components.edit;
  // d-supply = vai Kế hoạch (planner) → có quyền định hình.
  vi.mocked(hasPermission).mockImplementation(
    makeFakeHasPermission((id) => DEPTS[id] ?? null),
  )
  vi.mocked(departmentsRepo.findById).mockImplementation(async (id: string) =>
    id === 'd-supply'
      ? ({ id, name: 'Kế Hoạch Sản Xuất-cung ứng', workspace_id: 'planning' } as never)
      : null,
  )
  vi.mocked(productionRepo.findById).mockResolvedValue(LSX as never)
  vi.mocked(ordersRepo.listLines).mockResolvedValue(ORDER_LINES as never)
  vi.mocked(outputsRepo.existsForLsx).mockResolvedValue(false)
  // Mặc định: lệnh chưa chốt lộ trình → final_stage tự do (lệnh cũ).
  vi.mocked(routesRepo.listByLsx).mockResolvedValue([])
})

describe('componentsService.save — Kế hoạch nhập tay, ghi đè trọn bộ', () => {
  it('KH-CƯ lưu được — replaceAll đúng LSX', async () => {
    await componentsService.save(supply, 'lsx1', [LINE])
    expect(componentsRepo.replaceAll).toHaveBeenCalledWith('lsx1', [LINE])
  })

  it('chặn công đoạn cuối NGOÀI lộ trình đã chốt (0063 × 0041)', async () => {
    vi.mocked(routesRepo.listByLsx).mockResolvedValue([
      { order_line_id: 'ol1', stages: ['phoi', 'han'] },
    ])
    await expect(
      componentsService.save(supply, 'lsx1', [{ ...LINE, final_stage: 'son' }]),
    ).rejects.toThrow(/công đoạn cuối/)
    // Thuộc lộ trình thì lưu bình thường.
    await componentsService.save(supply, 'lsx1', [{ ...LINE, final_stage: 'han' }])
    expect(componentsRepo.replaceAll).toHaveBeenCalled()
  })

  it('NV phòng khác → 403, không ghi', async () => {
    vi.mocked(isSupplyStaff).mockResolvedValue(false)
    await expect(componentsService.save(outsider, 'lsx1', [LINE])).rejects.toMatchObject({
      status: 403,
    })
    expect(componentsRepo.replaceAll).not.toHaveBeenCalled()
  })

  it.each(['completed', 'cancelled'])('LSX %s → 400 (chỉ còn tra cứu)', async (st) => {
    vi.mocked(productionRepo.findById).mockResolvedValue({
      ...LSX,
      status: st,
    } as never)
    await expect(componentsService.save(supply, 'lsx1', [LINE])).rejects.toMatchObject({
      status: 400,
    })
  })

  it('dòng gắn order_line không thuộc lệnh → 400', async () => {
    await expect(
      componentsService.save(supply, 'lsx1', [{ ...LINE, order_line_id: 'ol-la' }]),
    ).rejects.toMatchObject({ status: 400 })
    expect(componentsRepo.replaceAll).not.toHaveBeenCalled()
  })

  it('LSX đã có sổ sản lượng → 400, không cho ghi đè (cascade sẽ mất sổ)', async () => {
    vi.mocked(outputsRepo.existsForLsx).mockResolvedValue(true)
    await expect(componentsService.save(supply, 'lsx1', [LINE])).rejects.toMatchObject({
      status: 400,
    })
    expect(componentsRepo.replaceAll).not.toHaveBeenCalled()
  })
})

describe('componentsService.suggest — gợi ý điền sẵn, KHÔNG ghi DB', () => {
  it("'previous': remap order_line theo product + chỉ lấy LSX mới nhất per SP", async () => {
    vi.mocked(componentsRepo.listPreviousByProducts).mockResolvedValue([
      // sort created_at desc — lsx9 mới hơn lsx5
      {
        production_order_id: 'lsx9',
        product_id: 'p1',
        order_line_id: 'ol-old',
        cluster: 'CỤM TỰA',
        name: 'TAY+TỰA',
        material_id: 'm1',
        qty_per_unit: 2,
        dm_kg: 0.85,
        pcs_per_bar: 6,
      },
      {
        production_order_id: 'lsx5',
        product_id: 'p1',
        order_line_id: 'ol-older',
        name: 'BẢN CŨ HƠN',
        qty_per_unit: 1,
      },
    ] as never)

    const out = await componentsService.suggest(supply, 'lsx1', 'previous')

    expect(out).toHaveLength(1) // bản lsx5 bị bỏ — chỉ lấy LSX mới nhất
    expect(out[0]).toMatchObject({
      order_line_id: 'ol1', // remap sang dòng của lệnh hiện tại
      name: 'TAY+TỰA',
      dm_kg: 0.85,
      pcs_per_bar: 6,
    })
    expect(componentsRepo.replaceAll).not.toHaveBeenCalled()
  })

  it('NV phòng khác → 403', async () => {
    vi.mocked(isSupplyStaff).mockResolvedValue(false)
    await expect(
      componentsService.suggest(outsider, 'lsx1', 'previous'),
    ).rejects.toMatchObject({ status: 403 })
  })
})
