import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./stocktakes.repo', () => ({
  stocktakesRepo: {
    insert: vi.fn(),
    patch: vi.fn(),
    findById: vi.fn(),
    list: vi.fn(),
    countOpen: vi.fn(),
    insertLines: vi.fn(),
    listLines: vi.fn(),
    patchLine: vi.fn(),
    attachDoc: vi.fn(),
  },
  bookQtyAt: vi.fn(),
  materialsInScope: vi.fn(),
}))
vi.mock('./stock.repo', () => ({
  docsRepo: { nextCode: vi.fn(), insert: vi.fn() },
  warehousesRepo: { mainId: vi.fn() },
  insertMovements: vi.fn(),
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({ assertAction: vi.fn() }))
vi.mock('./stock.service', () => ({ stockService: { createIssueDoc: vi.fn() } }))
vi.mock('@/modules/core/departments/departments.repo', () => ({
  departmentsRepo: { list: vi.fn() },
}))
vi.mock('@/modules/dept/production/production.repo', () => ({
  productionRepo: { findById: vi.fn() },
}))

import { stocktakesService } from './stocktakes.service'
import { stockService } from './stock.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { productionRepo } from '@/modules/dept/production/production.repo'
import {
  stocktakesRepo,
  bookQtyAt,
  materialsInScope,
  type Stocktake,
  type TakeLine,
} from './stocktakes.repo'
import { docsRepo, warehousesRepo, insertMovements } from './stock.repo'
import type { User } from '@/modules/core/users/users.repo'

const admin = { id: 'u1', role: 'admin', department_id: null } as unknown as User

function take(over: Partial<Stocktake> = {}): Stocktake {
  return {
    id: 'dot1',
    code: 'KK-2026-0010',
    scope_kind: 'group',
    scope_ref: { groups: ['Nhôm định hình - tấm'] },
    scope_count: 2,
    freeze_at: '2026-09-15T02:00:00.000Z',
    blind_count: true,
    status: 'counting',
    assigned_to: null,
    assigned_to_name: null,
    doc_id: null,
    doc_code: null,
    note: null,
    reject_reason: null,
    approved_by: null,
    approved_at: null,
    created_by: 'u1',
    created_by_name: 'Quản trị viên',
    created_at: '2026-09-15T01:00:00.000Z',
    ...over,
  }
}

function line(over: Partial<TakeLine> = {}): TakeLine {
  return {
    id: 'l1',
    material_id: 'm1',
    material_code: 'NH-01',
    material_name: 'Nhôm hộp',
    material_unit: 'cây',
    material_shelf: null,
    book_qty_frozen: 100,
    counted_qty: null,
    counted_by: null,
    counted_at: null,
    note: null,
    ...over,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(warehousesRepo.mainId).mockResolvedValue('wh-main')
  vi.mocked(docsRepo.nextCode).mockResolvedValue('KK-2026-0011')
  vi.mocked(docsRepo.insert).mockResolvedValue({ id: 'doc-kk', code: 'KK-2026-0011' })
})

describe('mở đợt — phạm vi chốt lúc mở', () => {
  it('phạm vi rỗng bị chặn, và nói cách gỡ', async () => {
    vi.mocked(materialsInScope).mockResolvedValue([])
    await expect(
      stocktakesService.open(admin, { scope: { kind: 'group', groups: ['Không có'] } }),
    ).rejects.toMatchObject({ status: 400 })
    expect(stocktakesRepo.insert).not.toHaveBeenCalled()
  })

  it('lưu scope_count CHỐT LÚC MỞ, và mặc định đếm mù', async () => {
    vi.mocked(materialsInScope).mockResolvedValue(['m1', 'm2', 'm3'])
    vi.mocked(stocktakesRepo.insert).mockResolvedValue({
      id: 'dot1',
      code: 'KK-2026-0011',
    })
    const r = await stocktakesService.open(admin, {
      scope: { kind: 'bin', bin_ids: ['b1'] },
    })
    expect(r.scope_count).toBe(3)
    const row = vi.mocked(stocktakesRepo.insert).mock.calls[0][0]
    expect(row).toMatchObject({ scope_kind: 'bin', scope_count: 3, blind_count: true })
    expect(row.scope_ref).toEqual({ bin_ids: ['b1'] })
  })

  /** Mở đợt CHƯA chốt sổ — quản lý lập chiều nay, đếm sáng mai. */
  it('mở đợt không đụng freeze_at và không sinh dòng nào', async () => {
    vi.mocked(materialsInScope).mockResolvedValue(['m1'])
    vi.mocked(stocktakesRepo.insert).mockResolvedValue({ id: 'dot1', code: 'KK-1' })
    await stocktakesService.open(admin, { scope: { kind: 'list', material_ids: ['m1'] } })
    expect(stocktakesRepo.insertLines).not.toHaveBeenCalled()
    expect(stocktakesRepo.patch).not.toHaveBeenCalled()
  })
})

describe('chốt sổ', () => {
  it('lấy giờ SERVER, sinh dòng với tồn tại mốc đó', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(
      take({ status: 'open', freeze_at: null }),
    )
    vi.mocked(materialsInScope).mockResolvedValue(['m1', 'm2'])
    vi.mocked(bookQtyAt).mockResolvedValue(new Map([['m1', 100]]))

    const r = await stocktakesService.startCounting(admin, 'dot1')
    expect(r.lines).toBe(2)

    const rows = vi.mocked(stocktakesRepo.insertLines).mock.calls[0][0]
    // m2 không có dòng sổ nào trước mốc → 0, không phải bỏ qua.
    expect(rows).toEqual([
      { stocktake_id: 'dot1', material_id: 'm1', system_qty: 100, book_qty_frozen: 100 },
      { stocktake_id: 'dot1', material_id: 'm2', system_qty: 0, book_qty_frozen: 0 },
    ])

    const patch = vi.mocked(stocktakesRepo.patch).mock.calls[0][1]
    expect(patch.status).toBe('counting')
    expect(patch.freeze_at).toBeTruthy()
    // Mốc phải là giờ truyền vào RPC — một nguồn, không hai.
    expect(vi.mocked(bookQtyAt).mock.calls[0][0]).toBe(patch.freeze_at)
  })

  it('đợt đã chốt sổ rồi thì không chốt lại', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'counting' }))
    await expect(stocktakesService.startCounting(admin, 'dot1')).rejects.toMatchObject({
      status: 409,
    })
  })
})

describe('đếm mù thực thi ở SERVER', () => {
  it('đang đếm + đợt mù → số sổ KHÔNG rời server', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'counting' }))
    vi.mocked(stocktakesRepo.listLines).mockResolvedValue([line()])
    const out = await stocktakesService.detail(admin, 'dot1')
    expect(out.lines[0].book_qty_frozen).toBeNull()
  })

  it('số DÒNG LỆCH cũng bị giấu — nếu không nó là kênh rò rỉ số sổ', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'counting' }))
    vi.mocked(stocktakesRepo.listLines).mockResolvedValue([line({ counted_qty: 95 })])
    const out = await stocktakesService.detail(admin, 'dot1')
    expect(out.progress.diff_count).toBeNull()
    // Tiến độ thì vẫn nói được — nó không tiết lộ gì về số sổ.
    expect(out.progress).toMatchObject({ total: 1, counted: 1, remaining: 0 })
  })

  it('sang bước đối chiếu → mở số sổ ra cho người duyệt', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'review' }))
    vi.mocked(stocktakesRepo.listLines).mockResolvedValue([line({ counted_qty: 95 })])
    const out = await stocktakesService.detail(admin, 'dot1')
    expect(out.lines[0].book_qty_frozen).toBe(100)
    expect(out.progress.diff_count).toBe(1)
  })

  it('đợt khai đếm MỞ thì bày số sổ ngay lúc đếm', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(
      take({ status: 'counting', blind_count: false }),
    )
    vi.mocked(stocktakesRepo.listLines).mockResolvedValue([line()])
    const out = await stocktakesService.detail(admin, 'dot1')
    expect(out.lines[0].book_qty_frozen).toBe(100)
  })
})

describe('ghi số đếm', () => {
  it('diff tính lại ở SERVER so với sổ đóng băng, không nhận từ client', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'counting' }))
    vi.mocked(stocktakesRepo.listLines).mockResolvedValue([
      line({ book_qty_frozen: 100 }),
    ])
    await stocktakesService.saveCounts(admin, 'dot1', [
      { line_id: 'l1', counted_qty: 95 },
    ])
    expect(vi.mocked(stocktakesRepo.patchLine).mock.calls[0][1]).toMatchObject({
      counted_qty: 95,
      diff: -5,
      counted_by: 'u1',
    })
  })

  it('đợt chưa chốt sổ → chặn, và nói phải bấm gì', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'open' }))
    await expect(
      stocktakesService.saveCounts(admin, 'dot1', [{ line_id: 'l1', counted_qty: 1 }]),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('dòng không thuộc đợt thì bỏ qua, không ném', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'counting' }))
    vi.mocked(stocktakesRepo.listLines).mockResolvedValue([line({ id: 'l1' })])
    const r = await stocktakesService.saveCounts(admin, 'dot1', [
      { line_id: 'l-la', counted_qty: 5 },
    ])
    expect(r.saved).toBe(0)
    expect(stocktakesRepo.patchLine).not.toHaveBeenCalled()
  })
})

describe('gửi đối chiếu', () => {
  /**
   * Coi "chưa đếm" như "đếm được 0" là biến một chỗ bỏ sót thành bút toán xoá
   * sạch tồn của mã đó — đúng hạng lỗi kiểm kê phải chống, không phải tạo ra.
   */
  it('còn mã chưa đếm → chặn, nói rõ còn bao nhiêu', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'counting' }))
    vi.mocked(stocktakesRepo.listLines).mockResolvedValue([
      line({ id: 'l1', counted_qty: 100 }),
      line({ id: 'l2', material_id: 'm2', counted_qty: null }),
    ])
    await expect(stocktakesService.submitReview(admin, 'dot1')).rejects.toMatchObject({
      status: 400,
    })
    expect(stocktakesRepo.patch).not.toHaveBeenCalled()
  })

  it('đếm được 0 KHÁC chưa đếm — 0 cho qua', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'counting' }))
    vi.mocked(stocktakesRepo.listLines).mockResolvedValue([line({ counted_qty: 0 })])
    await stocktakesService.submitReview(admin, 'dot1')
    expect(vi.mocked(stocktakesRepo.patch).mock.calls[0][1]).toMatchObject({
      status: 'review',
    })
  })
})

describe('duyệt — chênh áp là DELTA, không phải đặt tồn = số đếm', () => {
  /**
   * Ca quan trọng nhất của cả file. Sổ chốt 100, đếm 95 (thiếu 5); trong lúc
   * đếm nhập thêm 20 nên tồn hiện 120. Áp delta −5 → 115, đúng. Đặt tồn = 95
   * là xoá mất 20 cây vừa nhập — và không ai phát hiện, vì con số 95 trông
   * hoàn toàn hợp lý.
   */
  it('áp đúng delta so với sổ đóng băng', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'review' }))
    vi.mocked(stocktakesRepo.listLines).mockResolvedValue([
      line({ book_qty_frozen: 100, counted_qty: 95 }),
    ])
    const r = await stocktakesService.approve(admin, 'dot1')
    expect(r.applied).toBe(1)
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0]).toMatchObject({ direction: 'out', qty: 5, reason_code: 'X5' })
  })

  it('thừa → N4 vào, thiếu → X5 ra, trong cùng một phiếu', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'review' }))
    vi.mocked(stocktakesRepo.listLines).mockResolvedValue([
      line({ id: 'l1', material_id: 'm1', book_qty_frozen: 100, counted_qty: 104 }),
      line({ id: 'l2', material_id: 'm2', book_qty_frozen: 50, counted_qty: 47 }),
    ])
    await stocktakesService.approve(admin, 'dot1')
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows.map((r) => [r.direction, r.qty, r.reason_code])).toEqual([
      ['in', 4, 'N4'],
      ['out', 3, 'X5'],
    ])
  })

  it('dòng KHỚP SỔ không sinh bút toán nào', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'review' }))
    vi.mocked(stocktakesRepo.listLines).mockResolvedValue([
      line({ book_qty_frozen: 100, counted_qty: 100 }),
    ])
    const r = await stocktakesService.approve(admin, 'dot1')
    expect(r.applied).toBe(0)
    expect(insertMovements).not.toHaveBeenCalled()
    // Phiếu VẪN sinh: biên bản "đã đếm, khớp hết" là một sự kiện đáng lưu.
    expect(docsRepo.insert).toHaveBeenCalled()
  })

  it('chỉ duyệt được đợt đang chờ đối chiếu', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'counting' }))
    await expect(stocktakesService.approve(admin, 'dot1')).rejects.toMatchObject({
      status: 409,
    })
  })
})

describe('từ chối và huỷ', () => {
  it('từ chối đưa về ĐANG ĐẾM, không đóng đợt', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'review' }))
    await stocktakesService.reject(admin, 'dot1', 'Đếm lại khu A-03')
    expect(vi.mocked(stocktakesRepo.patch).mock.calls[0][1]).toMatchObject({
      status: 'counting',
      reject_reason: 'Đếm lại khu A-03',
    })
  })

  it('từ chối không lý do bị chặn', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'review' }))
    await expect(stocktakesService.reject(admin, 'dot1', '  ')).rejects.toMatchObject({
      status: 400,
    })
  })

  it('đợt ĐÃ DUYỆT không huỷ được — tồn đã đổi theo', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'approved' }))
    await expect(stocktakesService.cancel(admin, 'dot1', 'nhầm')).rejects.toMatchObject({
      status: 409,
    })
  })
})

describe('thêm tay một mã vào đợt đang đếm (B7b, Q1)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('chỉ khi đợt đang đếm', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(
      take({ status: 'open', freeze_at: null }),
    )
    await expect(stocktakesService.themDong(admin, 'dot1', 'm9')).rejects.toThrow(
      /đang đếm/,
    )
    expect(stocktakesRepo.insertLines).not.toHaveBeenCalled()
  })

  it('mã đã có trong phiếu thì trả dòng cũ, không thêm trùng', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'counting', freeze_at: '2026-10-31T09:05:00.000Z' })) // prettier-ignore
    vi.mocked(stocktakesRepo.listLines).mockResolvedValue([
      line({ id: 'l7', material_id: 'm9' }),
    ])
    expect(await stocktakesService.themDong(admin, 'dot1', 'm9')).toEqual({
      line_id: 'l7',
    })
    expect(stocktakesRepo.insertLines).not.toHaveBeenCalled()
  })

  it('số sổ của dòng mới lấy TẠI freeze_at của đợt, không phải bây giờ', async () => {
    const freeze = '2026-10-31T09:05:00.000Z'
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'counting', freeze_at: freeze })) // prettier-ignore
    vi.mocked(stocktakesRepo.listLines)
      .mockResolvedValueOnce([line()])
      .mockResolvedValueOnce([line(), line({ id: 'l9', material_id: 'm9' })])
    vi.mocked(bookQtyAt).mockResolvedValue(new Map([['m9', 12]]))
    expect(await stocktakesService.themDong(admin, 'dot1', 'm9')).toEqual({
      line_id: 'l9',
    })
    expect(bookQtyAt).toHaveBeenCalledWith(freeze, ['m9'])
    expect(stocktakesRepo.insertLines).toHaveBeenCalledWith([
      { stocktake_id: 'dot1', material_id: 'm9', system_qty: 12, book_qty_frozen: 12 },
    ])
  })
})

describe('Q2 — người đếm không tự duyệt (B7c)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('người đã ghi số đếm bị chặn, không sinh phiếu', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'review' }))
    vi.mocked(stocktakesRepo.listLines).mockResolvedValue([line({ counted_qty: 90, counted_by: 'u1' })]) // prettier-ignore
    await expect(stocktakesService.approve(admin, 'dot1')).rejects.toThrow(
      /không tự duyệt/,
    )
    expect(docsRepo.insert).not.toHaveBeenCalled()
    expect(insertMovements).not.toHaveBeenCalled()
  })

  it('người được phân đếm cũng bị chặn', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(take({ status: 'review', assigned_to: 'u1' })) // prettier-ignore
    vi.mocked(stocktakesRepo.listLines).mockResolvedValue([line({ counted_qty: 100, counted_by: 'u2' })]) // prettier-ignore
    await expect(stocktakesService.approve(admin, 'dot1')).rejects.toThrow(/phân đếm/)
  })
})

describe('cập nhật số thực tế (B1 "Kho cho người mới", Q2/Q3)', () => {
  const hao = { id: 'u-hao', role: 'employee', department_id: 'd-kho' } as unknown as User
  const nu = { id: 'u-nu', role: 'employee', department_id: 'd-kho' } as unknown as User
  const lenh9 = { id: 'l-mx9', code: '09/26-27 - MX', status: 'approved' }
  /** Dữ liệu thật 27/10: NH-0513 753 cây của 09-MX; NH-0606 290 cây tồn chung. */
  const dongNhanh = [
    line({ id: 'a', material_id: 'm513', book_qty_frozen: 753, counted_qty: 745, counted_by: 'u-hao' }), // prettier-ignore
    line({ id: 'b', material_id: 'm606', book_qty_frozen: 290, counted_qty: 300, counted_by: 'u-hao' }), // prettier-ignore
  ]
  const input = {
    ly_do_chung: 'giao_kho' as const,
    lines: [
      { material_id: 'm513', counted_qty: 745, xuat_bu_lsx_id: 'l-mx9' },
      { material_id: 'm606', counted_qty: 300, ly_do: 'hang_cu' as const },
    ],
  }

  beforeEach(() => {
    vi.mocked(departmentsRepo.list).mockResolvedValue([
      { id: 'd-kho', workspace_id: 'warehouse', head_user_id: 'u-hao' },
    ] as never)
    vi.mocked(bookQtyAt).mockResolvedValue(
      new Map([
        ['m513', 753],
        ['m606', 290],
      ]),
    )
    vi.mocked(productionRepo.findById).mockResolvedValue(lenh9 as never)
    vi.mocked(docsRepo.nextCode).mockResolvedValueOnce('KK-2026-0009').mockResolvedValue('KK-2026-0010') // prettier-ignore
    vi.mocked(stocktakesRepo.insert).mockResolvedValue({
      id: 'dot9',
      code: 'KK-2026-0009',
    })
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(
      take({
        id: 'dot9',
        code: 'KK-2026-0009',
        scope_kind: 'list',
        scope_ref: { nhanh: true, xuat_bu: { m513: 'l-mx9' } },
        status: 'review',
        created_by: 'u-hao',
        assigned_to: 'u-hao',
      }),
    )
    vi.mocked(stocktakesRepo.listLines).mockResolvedValue(dongNhanh)
    vi.mocked(stockService.createIssueDoc).mockResolvedValue({ id: 'pxk', code: 'PXK-2026-0031' }) // prettier-ignore
  })

  it('trưởng kho: đổi tồn NGAY — "tổ đã lấy" thành phiếu xuất cho lệnh, phần thừa N4', async () => {
    const r = await stocktakesService.capNhatNhanh(hao, input)
    expect(r).toMatchObject({
      trang_thai: 'da_ghi',
      code: 'KK-2026-0009',
      applied: 1,
      xuat_bu: [{ code: 'PXK-2026-0031', lsx_code: '09/26-27 - MX' }],
    })
    // Đợt theo danh sách, không đếm mù, nhớ PHẦN của lệnh xuất bù cho lúc duyệt.
    // (Client cũ gửi `xuat_bu_lsx_id` = cả phần hụt 8 cho một lệnh.)
    expect(vi.mocked(stocktakesRepo.insert).mock.calls[0][0]).toMatchObject({
      scope_kind: 'list',
      blind_count: false,
      scope_ref: { nhanh: true, xuat_bu: { m513: [{ lsx_id: 'l-mx9', qty: 8 }] } },
    })
    const dong = vi.mocked(stocktakesRepo.insertLines).mock.calls[0][0]
    expect(dong[0]).toMatchObject({ book_qty_frozen: 753, counted_qty: 745, diff: -8, counted_by: 'u-hao' }) // prettier-ignore
    expect(dong[0].note).toBe(
      'Đếm lại khi giao kho · tổ đã lấy → xuất bù cho 09/26-27 - MX',
    )
    expect(dong[1].note).toBe('Hàng cũ chưa có trên máy')
    // 8 cây ra bằng PHIẾU XUẤT X1 cho lệnh, không phải X5.
    expect(vi.mocked(stockService.createIssueDoc).mock.calls[0][1]).toMatchObject({
      kind: 'lsx',
      production_order_id: 'l-mx9',
      override_reserved: true,
      lines: [{ material_id: 'm513', qty: 8 }],
    })
    const mv = vi.mocked(insertMovements).mock.calls[0][0]
    expect(mv.map((m) => [m.material_id, m.direction, m.qty, m.reason_code])).toEqual([
      ['m606', 'in', 10, 'N4'],
    ])
  })

  it('người khác có vai Kho: chỉ gửi — chờ trưởng kho duyệt, chưa đổi tồn', async () => {
    const r = await stocktakesService.capNhatNhanh(nu, input)
    expect(r).toEqual({ trang_thai: 'cho_duyet', id: 'dot9', code: 'KK-2026-0009' })
    expect(vi.mocked(stocktakesRepo.patch).mock.calls[0][1]).toMatchObject({
      status: 'review',
    })
    expect(stockService.createIssueDoc).not.toHaveBeenCalled()
    expect(insertMovements).not.toHaveBeenCalled()
  })

  it('duyệt cập nhật nhanh: chỉ trưởng kho; trưởng kho duyệt thì áp cả phiếu xuất bù', async () => {
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(
      take({
        id: 'dot9',
        scope_kind: 'list',
        scope_ref: { nhanh: true, xuat_bu: { m513: 'l-mx9' } },
        status: 'review',
        created_by: 'u-nu',
        assigned_to: 'u-nu',
      }),
    )
    vi.mocked(stocktakesRepo.listLines).mockResolvedValue(
      dongNhanh.map((l) => ({ ...l, counted_by: 'u-nu' })),
    )
    await expect(stocktakesService.approve(nu, 'dot9')).rejects.toThrow(
      /trưởng kho duyệt/,
    )
    const r = await stocktakesService.approve(hao, 'dot9')
    expect(r.xuat_bu).toHaveLength(1)
    expect(r.applied).toBe(1)
  })

  /* K6 (28/10/2026): phần hụt chia cho NHIỀU lệnh, phần không lệnh nào nhận → X5. */
  it('phần hụt chia hai lệnh: mỗi lệnh một phiếu xuất bù, phần dư ghi thiếu X5', async () => {
    const lenh10 = { id: 'l-mx10', code: '10/26-27 - MX', status: 'approved' }
    vi.mocked(productionRepo.findById).mockImplementation(
      async (id: string) => (id === 'l-mx10' ? lenh10 : lenh9) as never,
    )
    const phan = [
      { lsx_id: 'l-mx9', qty: 5 },
      { lsx_id: 'l-mx10', qty: 2 },
    ]
    vi.mocked(stocktakesRepo.findById).mockResolvedValue(
      take({ id: 'dot9', code: 'KK-2026-0009', scope_kind: 'list', scope_ref: { nhanh: true, xuat_bu: { m513: phan } }, status: 'review', created_by: 'u-hao', assigned_to: 'u-hao' }), // prettier-ignore
    )
    vi.mocked(stockService.createIssueDoc)
      .mockResolvedValueOnce({ id: 'p1', code: 'PXK-2026-0031' })
      .mockResolvedValueOnce({ id: 'p2', code: 'PXK-2026-0032' })
    const r = await stocktakesService.capNhatNhanh(hao, {
      ly_do_chung: 'giao_kho',
      lines: [
        { material_id: 'm513', counted_qty: 745, xuat_bu: phan },
        { material_id: 'm606', counted_qty: 300, ly_do: 'hang_cu' },
      ],
    })
    expect(vi.mocked(stocktakesRepo.insert).mock.calls[0][0].scope_ref).toMatchObject({
      xuat_bu: { m513: phan },
    })
    expect(vi.mocked(stocktakesRepo.insertLines).mock.calls[0][0][0].note).toBe(
      'Đếm lại khi giao kho · tổ đã lấy → xuất bù 5 cho 09/26-27 - MX, 2 cho 10/26-27 - MX; 1 ghi thiếu',
    )
    const phieu = vi
      .mocked(stockService.createIssueDoc)
      .mock.calls.map((c) => [c[1].production_order_id, c[1].lines.map((l) => l.qty)])
    expect(phieu).toEqual([
      ['l-mx9', [5]],
      ['l-mx10', [2]],
    ])
    expect(r).toMatchObject({
      xuat_bu: [
        { code: 'PXK-2026-0031', lsx_code: '09/26-27 - MX' },
        { code: 'PXK-2026-0032', lsx_code: '10/26-27 - MX' },
      ],
    })
    const mv = vi.mocked(insertMovements).mock.calls[0][0]
    expect(mv.map((m) => [m.material_id, m.direction, m.qty, m.reason_code])).toEqual([
      ['m513', 'out', 1, 'X5'],
      ['m606', 'in', 10, 'N4'],
    ])
  })

  it('client gửi xuất bù nhiều hơn phần hụt → cắt về phần hụt tính ở server', async () => {
    await stocktakesService.capNhatNhanh(hao, {
      ly_do_chung: 'giao_kho',
      lines: [{ material_id: 'm513', counted_qty: 745, xuat_bu: [{ lsx_id: 'l-mx9', qty: 20 }] }], // prettier-ignore
    })
    expect(vi.mocked(stocktakesRepo.insert).mock.calls[0][0].scope_ref).toMatchObject({
      xuat_bu: { m513: [{ lsx_id: 'l-mx9', qty: 8 }] },
    })
  })

  it('dòng không GIẢM thì không xuất bù dù client gửi lệnh', async () => {
    await stocktakesService.capNhatNhanh(hao, {
      ly_do_chung: 'giao_kho',
      lines: [{ material_id: 'm513', counted_qty: 760, xuat_bu_lsx_id: 'l-mx9' }],
    })
    expect(vi.mocked(stocktakesRepo.insert).mock.calls[0][0].scope_ref).toMatchObject({
      xuat_bu: {},
    })
  })

  it('"Khác" thiếu ghi chú, lệnh đã huỷ → chặn trước khi ghi gì', async () => {
    await expect(
      stocktakesService.capNhatNhanh(hao, {
        ly_do_chung: 'khac',
        lines: [{ material_id: 'm606', counted_qty: 300 }],
      }),
    ).rejects.toThrow(/cần ghi chú/)
    vi.mocked(productionRepo.findById).mockResolvedValue({ ...lenh9, status: 'cancelled' } as never) // prettier-ignore
    await expect(stocktakesService.capNhatNhanh(hao, input)).rejects.toThrow(/không ở trạng thái/) // prettier-ignore
    expect(stocktakesRepo.insert).not.toHaveBeenCalled()
  })

  it('trưởng kho ghi mà áp hỏng → huỷ đợt vừa tạo kèm lý do, không để rác chờ duyệt', async () => {
    vi.mocked(stockService.createIssueDoc).mockRejectedValue(new Error('Không đủ tồn'))
    await expect(stocktakesService.capNhatNhanh(hao, input)).rejects.toThrow(
      /Không đủ tồn/,
    )
    const cuoi = vi.mocked(stocktakesRepo.patch).mock.calls.at(-1)!
    expect(cuoi[1]).toMatchObject({
      status: 'cancelled',
      reject_reason: 'Ghi không thành: Không đủ tồn',
    })
    expect(insertMovements).not.toHaveBeenCalled()
  })
})
