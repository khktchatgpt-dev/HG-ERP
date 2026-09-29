import { describe, expect, it, vi, beforeEach } from 'vitest'

vi.mock('./supply.repo', () => ({
  suppliersRepo: {
    allCodes: vi.fn(),
    withTaxNo: vi.fn(async () => []),
    insert: vi.fn(),
    findById: vi.fn(),
    update: vi.fn(),
    patch: vi.fn(async (_id: string, row: unknown) => row),
  },
  materialGroupsRepo: { listBySupplier: vi.fn(), replaceForSupplier: vi.fn() },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  hasPermission: vi.fn(),
  assertAction: vi.fn(),
  canAction: vi.fn(),
}))

import { suppliersService } from './suppliers.service'
import { suppliersRepo } from './supply.repo'
import type { User } from '@/modules/core/users/users.repo'

const user = { id: 'u1', role: 'employee' } as unknown as User

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(suppliersRepo.allCodes).mockResolvedValue(['AHP', 'ATP'])
  vi.mocked(suppliersRepo.insert).mockImplementation(
    async (row) => ({ id: 's1', ...row }) as never,
  )
})

/**
 * Mã NCC tự cấp (03/09/2026). Đo được 120/157 NCC không có mã vì ô đó bỏ trống
 * lúc tạo và không ai quay lại đặt — nên server phải tự cấp, và phải cấp ở
 * SERVICE để mọi đường ghi (form, API, script nạp) cùng một luật.
 */
describe('suppliersService.create — mã NCC', () => {
  it('bỏ trống mã → tự cấp theo tên', async () => {
    await suppliersService.create(user, {
      name: 'CÔNG TY TNHH SX TM ĐỨC THẮNG PHÁT',
    } as never)
    expect(suppliersRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'DTP' }),
    )
  })

  it('mã tự cấp trùng mã đang có → nối số, không đụng mã cũ', async () => {
    await suppliersService.create(user, {
      name: 'CÔNG TY TNHH TM VÀ DỊCH VỤ ÂN HOÀN PHÁT', // → AHP, đã có
    } as never)
    expect(suppliersRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'AHP2' }),
    )
  })

  it('người dùng gõ mã thì TÔN TRỌNG, không cấp đè', async () => {
    await suppliersService.create(user, {
      name: 'CÔNG TY TNHH SX TM ĐỨC THẮNG PHÁT',
      code: ' TD-01 ',
    } as never)
    expect(suppliersRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ code: 'TD-01' }),
    )
  })

  it('tên không rút được chữ nào → để trống, không ghi mã rác', async () => {
    await suppliersService.create(user, { name: '???' } as never)
    expect(suppliersRepo.insert).toHaveBeenCalledWith(
      expect.objectContaining({ code: null }),
    )
  })
})

describe('suppliersService.update — khoá đặt hàng phải LƯU được (27/09/2026)', () => {
  it('bật khoá: can_order=false đi xuống repo cùng lý do', async () => {
    vi.mocked(suppliersRepo.findById).mockResolvedValue({ id: 's1' } as never)
    await suppliersService.update(user, 's1', {
      can_order: false,
      lock_reason: 'Giao sai quy cách',
    })
    expect(vi.mocked(suppliersRepo.patch).mock.calls[0][1]).toMatchObject({ can_order: false, lock_reason: 'Giao sai quy cách' }) // prettier-ignore
  })
  it('mở khoá: can_order=true cũng đi xuống — không bị lọc như chữ', async () => {
    vi.mocked(suppliersRepo.findById).mockResolvedValue({ id: 's1' } as never)
    await suppliersService.update(user, 's1', { can_order: true })
    expect(vi.mocked(suppliersRepo.patch).mock.calls[0][1]).toMatchObject({
      can_order: true,
    })
  })
})

/**
 * MST ĐÃ CÓ CHỦ THÌ CHẶN (29/09/2026). Đo được 3 cặp NCC cùng MST, cả 3 đều
 * là gõ nhầm — nên chặn ở SERVICE (mọi đường ghi), chuẩn hoá trước khi so.
 */
describe('suppliersService — chống trùng MST', () => {
  const VY = { id: 'vy', code: 'VY', name: 'Công ty TNHH Nhôm Việt Ý', tax_no: '0107595790' }

  it('thêm NCC với MST đã có chủ (gõ kèm khoảng trắng) → 409, không ghi', async () => {
    vi.mocked(suppliersRepo.withTaxNo).mockResolvedValue([VY])
    await expect(
      suppliersService.create(user, { name: 'Nhôm Hoàng Gia', tax_no: '0107 595 790' } as never),
    ).rejects.toMatchObject({ status: 409, code: 'TAX_NO_TAKEN' })
    expect(suppliersRepo.insert).not.toHaveBeenCalled()
  })

  it('MST mới thì ghi dạng đã chuẩn hoá', async () => {
    vi.mocked(suppliersRepo.withTaxNo).mockResolvedValue([VY])
    await suppliersService.create(user, { name: 'Phúc Thịnh', tax_no: ' 0316.482.915 ' } as never) // prettier-ignore
    expect(suppliersRepo.insert).toHaveBeenCalledWith(expect.objectContaining({ tax_no: '0316482915' })) // prettier-ignore
  })

  it('sửa ô khác của NCC đang trùng MST cũ → vẫn lưu được (MST không đổi thì không soát)', async () => {
    vi.mocked(suppliersRepo.findById).mockResolvedValue({ id: 'hg', tax_no: '0107595790' } as never)
    vi.mocked(suppliersRepo.withTaxNo).mockResolvedValue([VY])
    await suppliersService.update(user, 'hg', { tax_no: '0107595790', phone: '028' })
    expect(suppliersRepo.patch).toHaveBeenCalled()
  })

  it('đổi MST sang MST của NCC khác → 409', async () => {
    vi.mocked(suppliersRepo.findById).mockResolvedValue({ id: 'hg', tax_no: null } as never)
    vi.mocked(suppliersRepo.withTaxNo).mockResolvedValue([VY])
    await expect(suppliersService.update(user, 'hg', { tax_no: '0107595790' })).rejects.toMatchObject({ status: 409 }) // prettier-ignore
    expect(suppliersRepo.patch).not.toHaveBeenCalled()
  })
})
