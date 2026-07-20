import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./routes.repo', () => ({
  routesRepo: {
    listByLsx: vi.fn(),
    replaceAll: vi.fn(),
    productDefaults: vi.fn(),
    countsByLsx: vi.fn(),
    saveProductDefault: vi.fn(),
  },
}))
vi.mock('./production.repo', () => ({
  productionRepo: { findById: vi.fn(), listStages: vi.fn() },
}))
vi.mock('./components.repo', () => ({ componentsRepo: { listByLsx: vi.fn() } }))
vi.mock('./outputs.repo', () => ({ outputsRepo: { listByLsx: vi.fn() } }))
vi.mock('./perms', () => ({ canEditComponents: vi.fn() }))
vi.mock('@/modules/dept/sales/orders.repo', () => ({
  ordersRepo: { listLines: vi.fn() },
}))

import {
  nextStagesAfter,
  normalizeRoute,
  routeSaveSchema,
  routesService,
} from './routes.service'
import { routesRepo } from './routes.repo'
import { productionRepo } from './production.repo'
import { componentsRepo } from './components.repo'
import { outputsRepo } from './outputs.repo'
import { canEditComponents } from './perms'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import type { User } from '@/modules/core/users/users.repo'

const CATALOG = ['phoi', 'han', 'nguoi', 'son', 'dan', 'dong_goi']

describe('normalizeRoute', () => {
  it('giữ đúng thứ tự danh mục dù người dùng gửi lộn xộn', () => {
    // Lộ trình là TẬP CON của chuỗi chuẩn — client gửi thứ tự nào cũng về đúng.
    expect(normalizeRoute(['son', 'phoi', 'han'], CATALOG)).toEqual([
      'phoi',
      'han',
      'son',
    ])
  })

  it('loại code không có trong danh mục và code trùng', () => {
    expect(normalizeRoute(['phoi', 'phoi', 'la_gi_day', 'son'], CATALOG)).toEqual([
      'phoi',
      'son',
    ])
  })

  it('rỗng vào → rỗng ra (service sẽ chặn ở tầng trên)', () => {
    expect(normalizeRoute([], CATALOG)).toEqual([])
  })
})

describe('nextStagesAfter — công đoạn kế tiếp cho bàn giao tổ (tách vai 07/2026)', () => {
  it('giữa lộ trình → công đoạn ngay sau', () => {
    expect(nextStagesAfter('han', [['phoi', 'han', 'son']])).toEqual(['son'])
  })

  it('công đoạn cuối mọi dòng → rỗng', () => {
    expect(nextStagesAfter('son', [['phoi', 'son'], ['son']])).toEqual([])
  })

  it('dòng không đi qua công đoạn → bỏ qua dòng đó', () => {
    expect(
      nextStagesAfter('han', [
        ['phoi', 'dan'],
        ['phoi', 'han', 'son'],
      ]),
    ).toEqual(['son'])
  })

  it('2 dòng rẽ khác nhau → union khử trùng', () => {
    expect(
      nextStagesAfter('han', [
        ['han', 'son'],
        ['han', 'mai'],
        ['phoi', 'han', 'son'],
      ]),
    ).toEqual(['son', 'mai'])
  })

  it('không lộ trình nào → rỗng', () => {
    expect(nextStagesAfter('han', [])).toEqual([])
  })
})

describe('routesService.save — validate chéo với dữ liệu đã có (0041/0039)', () => {
  const planner = { id: 'u1', role: 'employee', department_id: 'd1' } as unknown as User
  const uuid = '00000000-0000-4000-8000-00000000000a'

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(canEditComponents).mockResolvedValue(true)
    vi.mocked(productionRepo.findById).mockResolvedValue({
      id: 'lsx1',
      status: 'in_progress',
      sales_order_id: 'o1',
    } as never)
    vi.mocked(productionRepo.listStages).mockResolvedValue([
      { code: 'phoi', label: 'Phôi' },
      { code: 'han', label: 'Hàn' },
      { code: 'son', label: 'Sơn' },
    ])
    vi.mocked(ordersRepo.listLines).mockResolvedValue([
      { id: uuid, product_id: 'p1', product_code: 'SP1' },
    ] as never)
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue([] as never)
    vi.mocked(outputsRepo.listByLsx).mockResolvedValue([] as never)
  })

  it('chặn lộ trình bỏ mất công đoạn cuối của chi tiết', async () => {
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue([
      { id: 'c1', order_line_id: uuid, name: 'CHÂN BÀN', final_stage: 'son' },
    ] as never)
    await expect(
      routesService.save(planner, 'lsx1', {
        routes: [{ order_line_id: uuid, stages: ['phoi', 'han'] }],
      }),
    ).rejects.toThrow(/công đoạn cuối.*CHÂN BÀN/)
  })

  it('chặn lộ trình bỏ giai đoạn ĐÃ CÓ sản lượng — lịch sử không được mồ côi', async () => {
    vi.mocked(componentsRepo.listByLsx).mockResolvedValue([
      { id: 'c1', order_line_id: uuid, name: 'CHÂN BÀN', final_stage: null },
    ] as never)
    vi.mocked(outputsRepo.listByLsx).mockResolvedValue([
      { component_id: 'c1', stage: 'han', qty: 100 },
    ] as never)
    await expect(
      routesService.save(planner, 'lsx1', {
        routes: [{ order_line_id: uuid, stages: ['phoi', 'son'] }],
      }),
    ).rejects.toThrow(/Đã có sản lượng/)
  })

  it('hợp lệ → ghi lộ trình đã chuẩn hoá thứ tự danh mục', async () => {
    await routesService.save(planner, 'lsx1', {
      routes: [{ order_line_id: uuid, stages: ['son', 'phoi'] }],
    })
    expect(vi.mocked(routesRepo.replaceAll)).toHaveBeenCalledWith('lsx1', [
      { order_line_id: uuid, stages: ['phoi', 'son'] },
    ])
  })
})

describe('routeSaveSchema', () => {
  const uuid = '00000000-0000-4000-8000-000000000001'

  it('nhận lộ trình hợp lệ + cờ save_as_default', () => {
    const r = routeSaveSchema.safeParse({
      routes: [{ order_line_id: uuid, stages: ['phoi', 'han'], save_as_default: true }],
    })
    expect(r.success).toBe(true)
  })

  it('chặn order_line_id không phải uuid', () => {
    expect(
      routeSaveSchema.safeParse({ routes: [{ order_line_id: 'abc', stages: ['phoi'] }] })
        .success,
    ).toBe(false)
  })

  it('chặn stage rỗng', () => {
    expect(
      routeSaveSchema.safeParse({ routes: [{ order_line_id: uuid, stages: [''] }] })
        .success,
    ).toBe(false)
  })
})
