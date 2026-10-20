import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('./blocked.repo', () => ({ blockedLots: vi.fn() }))
vi.mock('./stock.repo', () => ({
  docsRepo: { nextCode: vi.fn(), insert: vi.fn() },
  warehousesRepo: { mainId: vi.fn() },
  insertMovements: vi.fn(),
  stockByBin: vi.fn(),
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({ assertAction: vi.fn() }))

import { blockedService, mucGap, tuoiNgay } from './blocked.service'
import { docsRepo, insertMovements, stockByBin, warehousesRepo } from './stock.repo'
import type { User } from '@/modules/core/users/users.repo'

const admin = { id: 'u1', role: 'admin', department_id: null } as unknown as User
const thuKho = { id: 'u2', role: 'employee', department_id: 'd-kho' } as unknown as User

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(warehousesRepo.mainId).mockResolvedValue('wh-main')
  vi.mocked(docsRepo.nextCode).mockResolvedValue('DCK-2026-0001')
  vi.mocked(docsRepo.insert).mockResolvedValue({ id: 'doc1', code: 'DCK-2026-0001' })
  vi.mocked(stockByBin).mockResolvedValue([
    { material_id: 'm1', bin_id: 'b1', bin_code: 'KHOA-01', bin_name: null, bin_kind: 'blocked', stock_status: 'blocked', qty: 50 }, // prettier-ignore
  ])
})

describe('tuổi và mức gấp', () => {
  const now = new Date('2026-09-15T10:00:00Z')

  it('đếm theo ngày trọn', () => {
    expect(tuoiNgay('2026-09-15T09:00:00Z', now)).toBe(0)
    expect(tuoiNgay('2026-09-12T10:00:00Z', now)).toBe(3)
    expect(tuoiNgay(null, now)).toBeNull()
  })

  /** Quá 3 ngày warn, quá 7 ngày stop — sổ §2.3. */
  it('mức gấp theo đúng hai mốc của sổ', () => {
    expect(mucGap(0)).toBe('neutral')
    expect(mucGap(3)).toBe('neutral')
    expect(mucGap(4)).toBe('warn')
    expect(mucGap(7)).toBe('warn')
    expect(mucGap(8)).toBe('stop')
    expect(mucGap(null)).toBe('neutral')
  })
})

describe('đổi trạng thái — đường ghi đầu tiên của C2/C3', () => {
  it('mở khoá → cặp dòng out blocked + in ok, cùng kệ, mã C2', async () => {
    await blockedService.changeStatus(admin, {
      material_id: 'm1',
      bin_id: 'b1',
      qty: 20,
      from: 'blocked',
      to: 'ok',
      reason: 'Kiểm lại thấy đúng quy cách',
    })
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ direction: 'out', stock_status: 'blocked', reason_code: 'C2', bin_id: 'b1' }) // prettier-ignore
    expect(rows[1]).toMatchObject({ direction: 'in', stock_status: 'ok', reason_code: 'C2', bin_id: 'b1' }) // prettier-ignore
    // Hai chân phải nối bằng CÙNG một transfer_group, nếu không tra ngược
    // sau này không biết chúng là một lần chuyển.
    expect(rows[0].transfer_group).toBe(rows[1].transfer_group)
    expect(rows[0].transfer_group).toBeTruthy()
  })

  it('khoá lại → mã C3, suy từ CHIỀU chứ không nhận từ client', async () => {
    vi.mocked(stockByBin).mockResolvedValue([
      { material_id: 'm1', bin_id: 'b1', bin_code: 'A-01', bin_name: null, bin_kind: 'store', stock_status: 'ok', qty: 100 }, // prettier-ignore
    ])
    await blockedService.changeStatus(admin, {
      material_id: 'm1',
      bin_id: 'b1',
      qty: 10,
      from: 'ok',
      to: 'blocked',
      reason: 'Phát hiện cong vênh',
    })
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    expect(rows[0].reason_code).toBe('C3')
    expect(rows[1].reason_code).toBe('C3')
  })

  /**
   * Lý do bắt buộc CẢ HAI CHIỀU. Mở khoá là nói "tôi đã kiểm lại và hàng này
   * dùng được" — câu đó phải có người ký tên, nếu không thì trạng thái khoá
   * chỉ là một nút ai bấm cũng được.
   */
  it('thiếu lý do bị chặn TRƯỚC khi ghi dòng nào', async () => {
    await expect(
      blockedService.changeStatus(admin, {
        material_id: 'm1',
        bin_id: 'b1',
        qty: 5,
        from: 'blocked',
        to: 'ok',
        reason: '   ',
      }),
    ).rejects.toMatchObject({ status: 400 })
    expect(insertMovements).not.toHaveBeenCalled()
  })

  it('chuyển quá lượng đang có Ở ĐÚNG Ô → chặn, nói còn bao nhiêu', async () => {
    await expect(
      blockedService.changeStatus(admin, {
        material_id: 'm1',
        bin_id: 'b1',
        qty: 999,
        from: 'blocked',
        to: 'ok',
        reason: 'Mở hết',
      }),
    ).rejects.toMatchObject({ status: 409, code: 'STATUS_SHORT' })
    expect(insertMovements).not.toHaveBeenCalled()
  })

  it('trạng thái đi và đến trùng nhau → chặn', async () => {
    await expect(
      blockedService.changeStatus(admin, {
        material_id: 'm1',
        bin_id: 'b1',
        qty: 5,
        from: 'ok',
        to: 'ok',
        reason: 'x',
      }),
    ).rejects.toMatchObject({ status: 400 })
  })
})

describe('xuất huỷ — X4', () => {
  it('dòng ra mang trạng thái BLOCKED, không phải ok', async () => {
    vi.mocked(docsRepo.nextCode).mockResolvedValue('PXK-2026-0100')
    vi.mocked(docsRepo.insert).mockResolvedValue({ id: 'doc9', code: 'PXK-2026-0100' })
    await blockedService.scrap(admin, {
      material_id: 'm1',
      bin_id: 'b1',
      qty: 50,
      reason: 'Ẩm mốc không dùng được',
    })
    const rows = vi.mocked(insertMovements).mock.calls[0][0]
    // Ghi 'ok' là rút từ một rổ không có hàng và làm rổ khoá âm vĩnh viễn.
    expect(rows[0]).toMatchObject({
      direction: 'out',
      qty: 50,
      reason_code: 'X4',
      stock_status: 'blocked',
    })
  })

  /**
   * Quyền THAY CHO vòng duyệt — nợ đã biết, không phải thiết kế: `canDuyet('X4')`
   * là true nhưng đường duyệt phiếu xuất chưa có.
   */
  it('nhân viên kho KHÔNG huỷ được, dù có quyền ghi kho', async () => {
    await expect(
      blockedService.scrap(thuKho, {
        material_id: 'm1',
        bin_id: 'b1',
        qty: 5,
        reason: 'hỏng',
      }),
    ).rejects.toMatchObject({ status: 403 })
    expect(insertMovements).not.toHaveBeenCalled()
  })

  it('huỷ quá lượng đang khoá → chặn', async () => {
    await expect(
      blockedService.scrap(admin, {
        material_id: 'm1',
        bin_id: 'b1',
        qty: 999,
        reason: 'hỏng',
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('huỷ không lý do → chặn', async () => {
    await expect(
      blockedService.scrap(admin, {
        material_id: 'm1',
        bin_id: 'b1',
        qty: 5,
        reason: '',
      }),
    ).rejects.toMatchObject({ status: 400 })
  })
})
