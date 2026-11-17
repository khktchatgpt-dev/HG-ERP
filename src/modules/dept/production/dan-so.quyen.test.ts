import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@/modules/core/users/users.repo'

/**
 * QUYỀN của màn Dán sổ Excel đối với vai THỐNG KÊ (17/11/2026).
 *
 * Bộ quyền của vai `production_stat` + `production_staff` (đo trên DB thật 17/11):
 * production.member · production.output.record · production.components.edit.
 * Test dựng đúng bộ đó qua RBAC THẬT (chỉ giả lớp truy vấn DB) rồi kiểm:
 *   - có đủ ba quyền  → xem trước chạy được, thêm chi tiết mới được;
 *   - thiếu ghi sổ    → bị từ chối ngay (Forbidden);
 *   - thiếu sửa bảng chi tiết → vẫn xem trước được nhưng dòng "mới" bị chặn kèm lý do.
 */
const perms = vi.hoisted(() => ({ keys: new Set<string>() }))

vi.mock('@/modules/core/rbac/rbac.repo', () => ({
  rbacRepo: {
    permissionKeysForUser: vi.fn(async () => [...perms.keys]),
    roleKeysForUser: vi.fn(async () => ['production_staff', 'production_stat']),
  },
  rbacAuditRepo: { insert: vi.fn(), listRecent: vi.fn() },
}))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: {
    list: vi.fn(async () => [{ id: 't1', name: 'Tổ Phôi', workspace_id: 'production' }]),
  },
}))
vi.mock('@/events/bus', () => ({ emit: vi.fn() }))
vi.mock('./entries.service', () => ({ entriesService: { record: vi.fn() } }))
vi.mock('./components.repo', () => ({
  componentsRepo: {
    listByLsx: vi.fn(async () => []),
    insertMany: vi.fn(),
    insertOne: vi.fn(),
  },
}))
vi.mock('./jobs.repo', () => ({ jobsRepo: { listByLsx: vi.fn(async () => []) } }))
vi.mock('./day-locks.repo', () => ({ dayLocksRepo: { find: vi.fn(async () => null) } }))
vi.mock('./entries.repo', () => ({ entriesRepo: { listByLsx: vi.fn(async () => []) } }))
vi.mock('./lsx-lines.repo', () => ({
  lsxLinesRepo: {
    listLines: vi.fn(async () => [LINE]),
    listLinesBulk: vi.fn(async () => [LINE]),
  },
}))
vi.mock('./production.repo', () => ({
  productionRepo: {
    findById: vi.fn(async () => ({
      id: 'L1',
      code: '01/26-27 - TEST',
      status: 'approved',
    })),
    listActive: vi.fn(async () => [{ id: 'L1', code: '01/26-27 - TEST' }]),
    listStages: vi.fn(async () => [
      { code: 'phoi', label: 'Phôi', meta: null },
      { code: 'han', label: 'Hàn', meta: null },
    ]),
  },
}))

const LINE = {
  id: 'D1',
  production_order_id: 'L1',
  product_code: 'SP1',
  customer_item_code: null,
  name_vi: 'Sản phẩm 1',
  name_foreign: null,
  ship_label: null,
  ship_date: null,
  sort_order: 0,
  qty: 100,
}

import { danSoService } from './dan-so.service'

const thongKe = {
  id: 'u-tk',
  role: 'employee',
  department_id: 't1',
  name: 'Thống kê',
} as unknown as User
const BO_QUYEN_THONG_KE = [
  'production.member',
  'production.output.record',
  'production.components.edit',
]

const input = (rows: unknown[]) =>
  ({
    lsx_id: 'L1',
    line_id: null,
    stage: 'phoi',
    team_id: 't1',
    cot: ['2026-11-10'],
    rows,
  }) as never

const dongMoi = {
  hang: 1,
  cum: 'CỤM A',
  ten: 'Chi tiết chưa có',
  ma_sp: 'SP1',
  ct_sp: 2,
  o: { '2026-11-10': 5 },
  sai: [],
}

beforeEach(() => {
  perms.keys = new Set(BO_QUYEN_THONG_KE)
})

describe('Dán sổ Excel — quyền của vai thống kê', () => {
  it('đủ bộ quyền thống kê: mở màn được và được phép thêm chi tiết', async () => {
    const o = await danSoService.tuyChon(thongKe)
    expect(o.can_khai).toBe(true)
    expect(o.lenh).toHaveLength(1)
    expect(o.teams.map((t) => t.name)).toContain('Tổ Phôi')
  })

  it('đủ bộ quyền: xem trước dòng chi tiết MỚI không bị chặn vì quyền', async () => {
    const r = await danSoService.xem(thongKe, input([dongMoi]))
    expect(r.dong[0].kieu).toBe('moi')
    expect(r.dong[0].van_de).toEqual([])
    expect(r.tom_tat.moi).toBe(1)
  })

  it('thiếu quyền ghi sổ: bị từ chối ngay ở cả mở màn lẫn xem trước', async () => {
    perms.keys = new Set(['production.member', 'production.components.edit'])
    await expect(danSoService.tuyChon(thongKe)).rejects.toThrow(/Không có quyền/)
    await expect(danSoService.xem(thongKe, input([dongMoi]))).rejects.toThrow(
      /Không có quyền/,
    )
  })

  it('thiếu quyền sửa bảng chi tiết: dòng mới bị chặn kèm lý do, không thêm được', async () => {
    perms.keys = new Set(['production.member', 'production.output.record'])
    const o = await danSoService.tuyChon(thongKe)
    expect(o.can_khai).toBe(false)
    const r = await danSoService.xem(thongKe, input([dongMoi]))
    expect(r.dong[0].van_de.join(' ')).toMatch(/không có quyền thêm vào bảng chi tiết/)
    expect(r.tom_tat.chan).toBe(1)
  })

  it('người ngoài xưởng (không quyền nào) không vào được', async () => {
    perms.keys = new Set()
    await expect(danSoService.tuyChon(thongKe)).rejects.toThrow(/Không có quyền/)
  })
})
