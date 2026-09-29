import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./po-costs.repo', async () => {
  const actual =
    await vi.importActual<typeof import('./po-costs.repo')>('./po-costs.repo')
  return {
    PoCostDbError: actual.PoCostDbError,
    poCostsRepo: {
      create: vi.fn(),
      findById: vi.fn(),
      listByPo: vi.fn(),
      void: vi.fn(),
      invoicesCarrying: vi.fn(async () => []),
      posForCost: vi.fn(),
      eligiblePos: vi.fn(),
      lastReceivedOn: vi.fn(),
      carriers: vi.fn(),
      supplierCodes: vi.fn(),
      insertCarrier: vi.fn(),
      carrierById: vi.fn(),
      patchCarrier: vi.fn(),
      listAll: vi.fn(),
      listByPayee: vi.fn(),
    },
  }
})
vi.mock('@/modules/core/rbac/rbac.service', () => ({ assertAction: vi.fn() }))

import { PoCostDbError, poCostsRepo, type PoForCost } from './po-costs.repo'
import { poCostsService } from './po-costs.service'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import type { User } from '@/modules/core/users/users.repo'

const user = { id: 'u-1', role: 'employee' } as unknown as User
const HV = 'Nhà xe Hùng vịnh, QL 1A, Q12, Bãi xe miền nam.'
// Một dòng: SL × đơn giá = tiền hàng.
const po = (id: string, amount: number, over: Partial<PoForCost> = {}): PoForCost => ({
  id,
  code: `PO-${id}`,
  status: 'ordered',
  currency: 'VND',
  vat_rate: 8,
  price_includes_vat: false,
  discount_amount: 0,
  supplier_id: `s-${id}`,
  supplier_name: `NCC ${id}`,
  place: HV,
  lines: [{ qty_ordered: 1, unit_price: amount }],
  ...over,
})

const input = {
  transport_mode: 'nha_xe' as const,
  payee_supplier_id: '00000000-0000-0000-0000-00000000000a',
  kind: 'van_chuyen' as const,
  cost_date: '2026-09-26',
  amount: 1_500_000,
  vat_rate: 8,
  po_ids: ['a', 'b'],
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(poCostsRepo.create).mockResolvedValue('cost-1')
  vi.mocked(poCostsRepo.findById).mockResolvedValue({ id: 'cost-1' } as never)
})

describe('poCostsService.create', () => {
  it('chia theo tiền hàng CHƯA VAT của mỗi đơn, VAT tính riêng trên phí, giữ thứ tự người chọn', async () => {
    // Repo trả NGƯỢC thứ tự — bảng phân bổ vẫn theo thứ tự po_ids (đơn đang mở đầu).
    vi.mocked(poCostsRepo.posForCost).mockResolvedValue([
      po('b', 20_000_000),
      po('a', 10_000_000),
    ])
    await poCostsService.create(user, input)
    expect(assertAction).toHaveBeenCalledWith(user, 'supply.po_cost.manage')
    const arg = vi.mocked(poCostsRepo.create).mock.calls[0][0]
    expect(arg.cost).toMatchObject({ amount: 1_500_000, vat_amount: 120_000, total: 1_620_000, currency: 'VND' }) // prettier-ignore
    expect(arg.allocations).toEqual([
      { po_id: 'a', base: 10_000_000, amount: 500_000 },
      { po_id: 'b', base: 20_000_000, amount: 1_000_000 },
    ])
  })

  it('đơn giá đã gồm VAT → gốc chia là tiền đã tách VAT', async () => {
    vi.mocked(poCostsRepo.posForCost).mockResolvedValue([
      po('a', 10_800_000, { price_includes_vat: true, vat_rate: 8 }),
    ])
    await poCostsService.create(user, { ...input, po_ids: ['a'] })
    expect(vi.mocked(poCostsRepo.create).mock.calls[0][0].allocations[0].base).toBe(
      10_000_000,
    )
  })

  it('đơn nháp / chờ duyệt / huỷ → chặn, nói đúng mã đơn', async () => {
    vi.mocked(poCostsRepo.posForCost).mockResolvedValue([
      po('a', 1),
      po('b', 1, { status: 'draft' }),
    ])
    await expect(poCostsService.create(user, input)).rejects.toThrow(
      /PO-b: Đơn chưa duyệt/,
    )
    expect(poCostsRepo.create).not.toHaveBeenCalled()
  })

  it('đơn khác tiền tệ → bắt tách phiếu', async () => {
    vi.mocked(poCostsRepo.posForCost).mockResolvedValue([
      po('a', 1),
      po('b', 1, { currency: 'USD' }),
    ])
    await expect(poCostsService.create(user, input)).rejects.toThrow(/khác tiền tệ/)
  })

  it('đơn không tồn tại → 404', async () => {
    vi.mocked(poCostsRepo.posForCost).mockResolvedValue([po('a', 1)])
    await expect(poCostsService.create(user, input)).rejects.toThrow(/không tồn tại/)
  })

  it('nhà xe mà không chọn đơn vị trong danh mục → chặn', async () => {
    vi.mocked(poCostsRepo.posForCost).mockResolvedValue([po('a', 1), po('b', 1)])
    await expect(
      poCostsService.create(user, { ...input, payee_supplier_id: null }),
    ).rejects.toThrow(/Chọn nhà xe/)
  })

  it('ship lẻ gõ tay, CHƯA trả, không lưu danh mục → chặn: Kế toán không biết trả ai', async () => {
    vi.mocked(poCostsRepo.posForCost).mockResolvedValue([po('a', 1), po('b', 1)])
    await expect(
      poCostsService.create(user, {
        ...input,
        transport_mode: 'ship_le',
        payee_supplier_id: null,
        payee_name: 'Grab — anh Tuấn',
      }),
    ).rejects.toThrow(/Chưa trả thì Kế toán phải biết trả cho ai/)
    expect(poCostsRepo.create).not.toHaveBeenCalled()
  })

  it('ship lẻ ĐÃ trả tại chỗ → ghi tên gõ tay + người trả, không cần danh mục', async () => {
    vi.mocked(poCostsRepo.posForCost).mockResolvedValue([po('a', 1)])
    await poCostsService.create(user, {
      ...input,
      po_ids: ['a'],
      transport_mode: 'ship_le',
      payee_supplier_id: null,
      payee_name: ' Grab — anh Tuấn ',
      payee_phone: '0903',
      paid: { by: 'u-1', on: '2026-09-18', method: 'tien_mat' },
    })
    expect(vi.mocked(poCostsRepo.create).mock.calls[0][0].cost).toMatchObject({
      transport_mode: 'ship_le',
      payee_supplier_id: null,
      payee_name: 'Grab — anh Tuấn',
      payee_phone: '0903',
      paid_by: 'u-1',
      paid_on: '2026-09-18',
      paid_method: 'tien_mat',
    })
  })

  it('ship lẻ + "lưu vào danh mục" → thành đơn vị (tài xế lẻ), phiếu trỏ vào id đó', async () => {
    vi.mocked(poCostsRepo.posForCost).mockResolvedValue([po('a', 1)])
    vi.mocked(poCostsRepo.carriers).mockResolvedValue([])
    vi.mocked(poCostsRepo.supplierCodes).mockResolvedValue([])
    vi.mocked(poCostsRepo.insertCarrier).mockResolvedValue({ id: 'c-new', name: 'Xe tải Anh Bảy' } as never) // prettier-ignore
    await poCostsService.create(user, {
      ...input,
      po_ids: ['a'],
      transport_mode: 'ship_le',
      payee_supplier_id: null,
      payee_name: 'Xe tải Anh Bảy',
      save_to_catalog: true,
    })
    expect(poCostsRepo.insertCarrier).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Xe tải Anh Bảy', carrier_kind: 'tai_xe_le' }),
    )
    expect(vi.mocked(poCostsRepo.create).mock.calls[0][0].cost).toMatchObject({
      payee_supplier_id: 'c-new',
      payee_name: null,
      paid_by: null,
    })
  })

  it('NCC tự giao mà người thu không phải NCC của đơn nào trong phiếu → chặn', async () => {
    vi.mocked(poCostsRepo.posForCost).mockResolvedValue([po('a', 1)])
    await expect(
      poCostsService.create(user, { ...input, po_ids: ['a'], transport_mode: 'ncc' }),
    ).rejects.toThrow(/NCC của một đơn trong phiếu/)
  })

  it('lỗi nghiệp vụ từ hàm DB → 400 với câu của hàm', async () => {
    vi.mocked(poCostsRepo.posForCost).mockResolvedValue([po('a', 1), po('b', 1)])
    vi.mocked(poCostsRepo.create).mockRejectedValue(
      new PoCostDbError('đơn vừa bị huỷ: PO-a'),
    )
    await expect(poCostsService.create(user, input)).rejects.toMatchObject({
      status: 400,
      message: 'đơn vừa bị huỷ: PO-a',
    })
  })
})

describe('poCostsService.candidates — gợi ý đơn cùng chuyến', () => {
  it('cùng nơi giao + nhập kho trong ±3 ngày; khác bãi hoặc lệch ngày thì không gợi ý', async () => {
    vi.mocked(poCostsRepo.posForCost).mockResolvedValue([po('me', 100)])
    vi.mocked(poCostsRepo.eligiblePos).mockResolvedValue([
      po('near', 200),
      po('far', 300),
      po('other', 400, { place: 'Nhà xe Phương Trang, Q5' }),
      po('norecv', 500),
    ])
    vi.mocked(poCostsRepo.lastReceivedOn).mockResolvedValue(
      new Map([
        ['me', '2026-09-11'],
        ['near', '2026-09-13'],
        ['far', '2026-09-20'],
        ['other', '2026-09-11'],
      ]),
    )
    const r = await poCostsService.candidates(user, 'me')
    expect(r.po).toMatchObject({ id: 'me', base: 100, received_on: '2026-09-11' })
    // Đơn chưa nhập kho vẫn gợi ý — có thể hàng vừa về, kho chưa ghi.
    expect(r.suggested.map((x) => x.id)).toEqual(['near', 'norecv'])
    expect(r.found).toEqual([])
  })

  it('ô tìm khớp mã đơn hoặc tên NCC, không phân biệt dấu', async () => {
    vi.mocked(poCostsRepo.posForCost).mockResolvedValue([po('me', 100)])
    vi.mocked(poCostsRepo.eligiblePos).mockResolvedValue([
      po('x1', 1, { supplier_name: 'Vipora Long An' }),
      po('x2', 1, { supplier_name: 'Cao Đạt' }),
    ])
    vi.mocked(poCostsRepo.lastReceivedOn).mockResolvedValue(new Map())
    expect((await poCostsService.candidates(user, 'me', 'cao dat')).found.map((x) => x.id)).toEqual(['x2']) // prettier-ignore
    expect((await poCostsService.candidates(user, 'me', 'PO-x1')).found.map((x) => x.id)).toEqual(['x1']) // prettier-ignore
  })
})

describe('poCostsService.addCarrier', () => {
  it('trùng tên (không phân biệt dấu / hoa thường) → trả nhà xe có sẵn, không thêm', async () => {
    vi.mocked(poCostsRepo.carriers).mockResolvedValue([{ id: 'c1', name: 'Nhà xe Hùng Vịnh', phone: null } as never]) // prettier-ignore
    const r = await poCostsService.addCarrier(user, { name: 'nha xe hung vinh', carrier_kind: 'nha_xe' }) // prettier-ignore
    expect(r.id).toBe('c1')
    expect(poCostsRepo.insertCarrier).not.toHaveBeenCalled()
  })

  it('tên mới → thêm vào danh mục, gác bằng quyền ghi phí', async () => {
    vi.mocked(poCostsRepo.carriers).mockResolvedValue([])
    vi.mocked(poCostsRepo.supplierCodes).mockResolvedValue([])
    vi.mocked(poCostsRepo.insertCarrier).mockResolvedValue({ id: 'c2', name: 'Nhà xe Hùng Vịnh', phone: '0909' } as never) // prettier-ignore
    await poCostsService.addCarrier(user, { name: ' Nhà xe Hùng Vịnh ', phone: ' 0909 ', carrier_kind: 'nha_xe' }) // prettier-ignore
    expect(assertAction).toHaveBeenCalledWith(user, 'supply.po_cost.manage')
    expect(poCostsRepo.insertCarrier).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Nhà xe Hùng Vịnh', phone: '0909', carrier_kind: 'nha_xe', userId: 'u-1' }), // prettier-ignore
    )
  })
})

describe('poCostsService.void', () => {
  it('phí đã nằm trên hoá đơn NCC thì KHÔNG cho huỷ phiếu — nêu số hoá đơn', async () => {
    vi.mocked(poCostsRepo.invoicesCarrying).mockResolvedValueOnce(['HD-0012'])
    await expect(poCostsService.void(user, 'z', 'ghi nhầm số tiền')).rejects.toThrow(
      /HD-0012/,
    )
    expect(poCostsRepo.void).not.toHaveBeenCalledWith(
      'z',
      expect.anything(),
      expect.anything(),
    )
  })

  it('phiếu đã huỷ rồi → 400, không tồn tại → 404', async () => {
    vi.mocked(poCostsRepo.void).mockResolvedValue(false)
    vi.mocked(poCostsRepo.findById).mockResolvedValueOnce({ id: 'x' } as never)
    await expect(poCostsService.void(user, 'x', 'ghi nhầm số tiền')).rejects.toThrow(
      /đã huỷ/,
    )
    vi.mocked(poCostsRepo.findById).mockResolvedValueOnce(null)
    await expect(poCostsService.void(user, 'y', 'ghi nhầm số tiền')).rejects.toThrow(
      /không tồn tại/,
    )
  })

  it('Kế toán đã hoàn chi hộ → không huỷ được, bảo đảo phiếu hoàn trước', async () => {
    vi.mocked(poCostsRepo.findById).mockResolvedValueOnce({ id: 'z', reimbursed_at: '2026-09-20T00:00:00Z' } as never) // prettier-ignore
    await expect(poCostsService.void(user, 'z', 'ghi nhầm số tiền')).rejects.toThrow(
      /đã hoàn/,
    )
    expect(poCostsRepo.void).not.toHaveBeenCalled()
  })
})
