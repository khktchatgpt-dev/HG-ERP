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

import { stocktakesService } from './stocktakes.service'
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
