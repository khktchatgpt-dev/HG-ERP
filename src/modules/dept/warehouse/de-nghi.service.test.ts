import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./de-nghi.repo', () => ({
  deNghiRepo: {
    findById: vi.fn(),
    nextCode: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    replaceLines: vi.fn(),
    vatTu: vi.fn(),
    tonDungDuoc: vi.fn(),
    list: vi.fn(),
    setApprovedQty: vi.fn(),
    soKho: vi.fn(),
    ganMa: vi.fn(),
    lanMuaKho: vi.fn(),
    daTheoDoi: vi.fn(),
    dongDeNghiMo: vi.fn(),
    dangVe: vi.fn(),
  },
}))
vi.mock('./stock.service', () => ({ stockService: { createReceiptDoc: vi.fn() } }))
vi.mock('@/events/bus', () => ({ emit: vi.fn() }))
vi.mock('@/events/register', () => ({}))
vi.mock('@/modules/core/rbac/rbac.repo', () => ({
  rbacRepo: { userIdsWithPermission: vi.fn().mockResolvedValue(['u-alex', 'u-hao']) },
}))
vi.mock('@/modules/core/users/users.repo', () => ({
  usersRepo: { list: vi.fn().mockResolvedValue([{ id: 'u-admin', role: 'admin' }]) },
}))
vi.mock('@/modules/dept/supply/prices.repo', () => ({
  pricesRepo: { lastPurchases: vi.fn() },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({
  assertAction: vi.fn(),
  canAction: vi.fn().mockResolvedValue(true),
}))
vi.mock('./warehouse.service', () => ({
  canViewWarehouse: vi.fn().mockResolvedValue(true),
}))

import { deNghiService } from './de-nghi.service'
import { deNghiRepo, type DeNghiDay } from './de-nghi.repo'
import { stockService } from './stock.service'
import { pricesRepo } from '@/modules/dept/supply/prices.repo'
import { emit } from '@/events/bus'
import type { User } from '@/modules/core/users/users.repo'

/** Tờ đề nghị 13/10 của anh Hào (rút gọn) — 0236 · Đ1. */
const hao = { id: 'u-hao', role: 'employee' } as unknown as User
const phieu = (p: Partial<DeNghiDay> = {}): DeNghiDay => ({
  id: 'dn1',
  code: 'DNM-2026-0001',
  status: 'draft',
  department: 'Kho vật tư',
  requested_by: 'u-hao',
  need_by: null,
  note: null,
  production_order_id: null,
  submitted_at: null,
  approved_at: null,
  rejected_at: null,
  rejected_reason: null,
  cancelled_at: null,
  cancel_reason: null,
  closed_at: null,
  closed_reason: null,
  shipping_fee: 0,
  approve_note: null,
  created_by: 'u-hao',
  created_at: '2026-10-13T06:12:00Z',
  updated_at: '2026-10-13T06:12:00Z',
  requested_by_name: 'Lê Khắc Hào',
  approved_by_name: null,
  rejected_by_name: null,
  closed_by_name: null,
  lsx_code: null,
  lines: [
    { id: 'l1', line_no: 1, material_id: 'm-keo', name: 'Băng keo trong 4F7', unit: 'Cuộn', qty: 200, approved_qty: null, unit_price: 5500, vat_rate: 0, purpose: 'Đóng gói', note: null, po_line_id: null }, // prettier-ignore
  ],
  ...p,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(deNghiRepo.update).mockResolvedValue(true)
  vi.mocked(deNghiRepo.soKho).mockResolvedValue(new Map())
  vi.mocked(deNghiRepo.lanMuaKho).mockResolvedValue(new Map())
  vi.mocked(deNghiRepo.daTheoDoi).mockResolvedValue(new Set())
  vi.mocked(deNghiRepo.dongDeNghiMo).mockResolvedValue(new Map())
  vi.mocked(deNghiRepo.dangVe).mockResolvedValue(new Map())
  vi.mocked(deNghiRepo.vatTu).mockResolvedValue(
    new Map([['m-keo', { code: 'KEO0030', name: 'Băng keo trong 4F7', unit: 'Cuộn' }]]),
  )
})

describe('deNghiService.create / save', () => {
  it('dòng có mã lấy tên + ĐVT từ danh mục (không tin client); dòng trống bị bỏ; dòng tự do giữ nguyên', async () => {
    vi.mocked(deNghiRepo.nextCode).mockResolvedValue('DNM-2026-0001')
    vi.mocked(deNghiRepo.insert).mockResolvedValue({ id: 'dn1' })
    const r = await deNghiService.create(hao, {
      department: 'Kho vật tư',
      lines: [
        {
          material_id: 'm-keo',
          name: 'gõ sai tên',
          unit: 'cái',
          qty: 200,
          unit_price: 5500,
        },
        { material_id: null, name: 'Giẻ lau', unit: 'Kg', qty: 20 },
        { material_id: null, name: ' ', unit: '', qty: 0 },
      ],
    } as never)
    expect(r).toEqual({ id: 'dn1', code: 'DNM-2026-0001' })
    const dong = vi.mocked(deNghiRepo.replaceLines).mock.calls[0][1]
    expect(dong.map((d) => [d.material_id, d.name, d.unit, d.qty])).toEqual([
      ['m-keo', 'Băng keo trong 4F7', 'Cuộn', 200],
      [null, 'Giẻ lau', 'Kg', 20],
    ])
    expect(vi.mocked(deNghiRepo.insert).mock.calls[0][0]).toMatchObject({ requested_by: 'u-hao', created_by: 'u-hao' }) // prettier-ignore
  })

  it('không sửa được phiếu đã gửi — bảo rút về nháp', async () => {
    vi.mocked(deNghiRepo.findById).mockResolvedValue(phieu({ status: 'pending' }))
    await expect(deNghiService.save(hao, 'dn1', { department: 'Kho vật tư', lines: [] } as never)).rejects.toThrow(/rút về nháp/) // prettier-ignore
    expect(deNghiRepo.replaceLines).not.toHaveBeenCalled()
  })

  it('mã vật tư không còn trong danh mục → báo rõ dòng', async () => {
    vi.mocked(deNghiRepo.findById).mockResolvedValue(phieu())
    vi.mocked(deNghiRepo.vatTu).mockResolvedValue(new Map())
    await expect(
      deNghiService.save(hao, 'dn1', { department: 'Kho vật tư', lines: [{ material_id: 'm-mat', name: 'Que hàn', unit: 'Kg', qty: 1 }] } as never), // prettier-ignore
    ).rejects.toThrow(/Que hàn/)
  })
})

describe('deNghiService.submit / withdraw / cancel', () => {
  it('gửi duyệt: nháp → chờ duyệt, chỉ khi còn nháp (chặn hai người bấm cùng lúc)', async () => {
    vi.mocked(deNghiRepo.findById).mockResolvedValue(phieu())
    await deNghiService.submit(hao, 'dn1')
    const [, patch, khiDang] = vi.mocked(deNghiRepo.update).mock.calls[0]
    expect(patch).toMatchObject({ status: 'pending', submitted_by: 'u-hao' })
    expect(khiDang).toEqual(['draft'])
  })

  it('phiếu rỗng / dòng thiếu số không gửi được — cùng câu với nút trên màn', async () => {
    vi.mocked(deNghiRepo.findById).mockResolvedValue(phieu({ lines: [] }))
    await expect(deNghiService.submit(hao, 'dn1')).rejects.toThrow(
      'Phiếu chưa có dòng vật tư nào',
    )
  })

  it('rút về chỉ khi đang chờ duyệt; huỷ không được khi đã duyệt', async () => {
    vi.mocked(deNghiRepo.findById).mockResolvedValue(phieu({ status: 'draft' }))
    await expect(deNghiService.withdraw(hao, 'dn1')).rejects.toThrow(/chờ duyệt/)
    vi.mocked(deNghiRepo.findById).mockResolvedValue(phieu({ status: 'approved' }))
    await expect(deNghiService.cancel(hao, 'dn1', 'lập trùng')).rejects.toThrow(
      /đã duyệt/,
    )
  })

  it('cập nhật trượt (người khác vừa đổi trạng thái) → báo tải lại', async () => {
    vi.mocked(deNghiRepo.findById).mockResolvedValue(phieu({ status: 'pending' }))
    vi.mocked(deNghiRepo.update).mockResolvedValue(false)
    await expect(deNghiService.withdraw(hao, 'dn1')).rejects.toThrow(/tải lại/)
  })
})

describe('deNghiService.goiY (Đ6 · thông tin dòng)', () => {
  it('tồn + giá mua gần nhất; giá đơn USD không gợi ý; mã chưa từng có giao dịch = chưa theo dõi', async () => {
    vi.mocked(deNghiRepo.tonDungDuoc).mockResolvedValue(new Map([['m-keo', 36]]))
    vi.mocked(deNghiRepo.daTheoDoi).mockResolvedValue(new Set(['m-keo']))
    vi.mocked(pricesRepo.lastPurchases).mockResolvedValue([
      { material_id: 'm-keo', unit_price: 5500, currency: 'VND', po_code: 'PO-2026-0140', supplier_id: 's1', supplier_name: 'Phước Khang', at: '2026-10-06T00:00:00Z' }, // prettier-ignore
      { material_id: 'm-usd', unit_price: 2, currency: 'USD', po_code: 'PO-2026-0136', supplier_id: 's2', supplier_name: 'An Khánh', at: '2026-10-06T00:00:00Z' }, // prettier-ignore
    ])
    const r = await deNghiService.goiY(hao, ['m-keo', 'm-usd'])
    expect(r['m-keo']).toEqual({ ton: 36, theo_doi: true, gia: { unit_price: 5500, po_code: 'PO-2026-0140', supplier_name: 'Phước Khang', at: '2026-10-06T00:00:00Z', nguon: 'po' }, trung: [], dang_ve: [] }) // prettier-ignore
    expect(r['m-usd']).toMatchObject({ ton: 0, theo_doi: false, gia: null })
  })

  it('giá lần trước: lần Kho tự mua MỚI HƠN đơn Cung ứng thì lấy lần Kho mua (nơi mua theo phiếu nhập)', async () => {
    vi.mocked(pricesRepo.lastPurchases).mockResolvedValue([
      { material_id: 'm-keo', unit_price: 5500, currency: 'VND', po_code: 'PO-2026-0140', supplier_id: 's1', supplier_name: 'Phước Khang', at: '2026-10-06T00:00:00Z' }, // prettier-ignore
    ])
    vi.mocked(deNghiRepo.lanMuaKho).mockResolvedValue(new Map([['m-keo', { unit_price: 5200, at: '2026-10-13', noi_mua: 'Tiệm Tân Hưng', doc_code: 'PNK-2026-0121' }]])) // prettier-ignore
    const r = await deNghiService.goiY(hao, ['m-keo'])
    expect(r['m-keo'].gia).toEqual({ unit_price: 5200, po_code: 'PNK-2026-0121', supplier_name: 'Tiệm Tân Hưng', at: '2026-10-13', nguon: 'kho' }) // prettier-ignore
  })

  it('trùng đề nghị khác + đơn mua còn về đi kèm; phiếu đang sửa không tự báo trùng chính nó', async () => {
    vi.mocked(deNghiRepo.dongDeNghiMo).mockResolvedValue(new Map([['m-keo', [{ code: 'DNM-2026-0005', status: 'pending', qty: 20 }]]])) // prettier-ignore
    vi.mocked(deNghiRepo.dangVe).mockResolvedValue(new Map([['m-keo', [{ po_code: 'PO-2026-0174', qty_open: 50 }]]])) // prettier-ignore
    const r = await deNghiService.goiY(hao, ['m-keo'], 'dn1')
    expect(deNghiRepo.dongDeNghiMo).toHaveBeenCalledWith(['m-keo'], 'dn1')
    expect(r['m-keo']).toMatchObject({ trung: [{ code: 'DNM-2026-0005' }], dang_ve: [{ po_code: 'PO-2026-0174', qty_open: 50 }] }) // prettier-ignore
  })
})

describe('deNghiService.get — phiếu trước của Kho (Đ6 · DN-8)', () => {
  it('lấy phiếu cùng bộ phận đã duyệt TRƯỚC phiếu đang xem, có mua; dự kiến theo số duyệt vs chi thật', async () => {
    const cur = phieu({ id: 'dn2', code: 'DNM-2026-0002', status: 'pending', submitted_at: '2026-10-13T01:00:00Z' }) // prettier-ignore
    vi.mocked(deNghiRepo.findById).mockResolvedValue(cur)
    vi.mocked(deNghiRepo.list).mockResolvedValue([
      cur,
      phieu({ id: 'dn1', status: 'done', approved_at: '2026-10-02T03:00:00Z' }),
      phieu({ id: 'dn0', status: 'done', approved_at: '2026-09-20T03:00:00Z', code: 'DNM-2026-0000' }), // prettier-ignore
      phieu({
        id: 'dnx',
        status: 'done',
        approved_at: '2026-10-14T03:00:00Z',
        code: 'DNM-2026-0009',
      }), // sau phiếu đang xem
    ])
    vi.mocked(deNghiRepo.soKho).mockResolvedValue(new Map([['l1', { daNhap: 200, tien: 1_040_000, phieu: [] }]])) // prettier-ignore
    const { phieu: p } = await deNghiService.get(hao, 'dn2')
    expect(p.phieu_truoc).toEqual({ id: 'dn1', code: 'DNM-2026-0001', approved_at: '2026-10-02T03:00:00Z', du_kien: 1_100_000, thuc_chi: 1_040_000, du_dong: 1, mua_dong: 1 }) // prettier-ignore
  })
})

describe('Đ2 · gửi duyệt báo ai + lãnh đạo quyết', () => {
  const alex = { id: 'u-alex', role: 'employee' } as unknown as User

  it('gửi duyệt báo người có quyền duyệt + admin, TRỪ chính người gửi', async () => {
    vi.mocked(deNghiRepo.findById).mockResolvedValue(phieu())
    await deNghiService.submit(hao, 'dn1')
    const e = vi.mocked(emit).mock.calls[0][0] as { name: string; approver_ids: string[]; tong: number } // prettier-ignore
    expect(e.name).toBe('de_nghi.submitted')
    expect(e.approver_ids.sort()).toEqual(['u-admin', 'u-alex'])
    expect(e.tong).toBe(1_100_000)
  })

  it('duyệt: ghi số duyệt dòng bị sửa (trùng số đề nghị → null), báo người đề nghị', async () => {
    vi.mocked(deNghiRepo.findById).mockResolvedValue(phieu({ status: 'pending' }))
    await deNghiService.decide(alex, 'dn1', { decision: 'approve', lines: [{ id: 'l1', approved_qty: 150 }, { id: 'la-ngoai', approved_qty: 1 }] }) // prettier-ignore
    expect(vi.mocked(deNghiRepo.setApprovedQty).mock.calls[0][0]).toEqual([{ id: 'l1', approved_qty: 150 }]) // prettier-ignore
    const [, patch, khiDang] = vi.mocked(deNghiRepo.update).mock.calls[0]
    expect(patch).toMatchObject({ status: 'approved', approved_by: 'u-alex' })
    expect(khiDang).toEqual(['pending'])
    expect(vi.mocked(emit).mock.calls[0][0]).toMatchObject({ name: 'de_nghi.decided', decision: 'approved', requester_id: 'u-hao' }) // prettier-ignore
  })

  it('từ chối: về nháp + lý do; không tự duyệt phiếu mình; duyệt 0 hết bị chặn', async () => {
    vi.mocked(deNghiRepo.findById).mockResolvedValue(phieu({ status: 'pending' }))
    await deNghiService.decide(alex, 'dn1', {
      decision: 'reject',
      reason: 'Kiểm lại tồn',
    })
    expect(vi.mocked(deNghiRepo.update).mock.calls[0][1]).toMatchObject({ status: 'draft', rejected_reason: 'Kiểm lại tồn', rejected_by: 'u-alex' }) // prettier-ignore
    await expect(deNghiService.decide(hao, 'dn1', { decision: 'approve' })).rejects.toThrow(/Không tự duyệt/) // prettier-ignore
    await expect(deNghiService.decide(alex, 'dn1', { decision: 'approve', lines: [{ id: 'l1', approved_qty: 0 }] })).rejects.toThrow(/Từ chối/) // prettier-ignore
  })

  it('phiếu không còn chờ duyệt (Kho vừa rút về) → báo rõ, không ghi gì', async () => {
    vi.mocked(deNghiRepo.findById).mockResolvedValue(phieu({ status: 'draft' }))
    await expect(deNghiService.decide(alex, 'dn1', { decision: 'approve' })).rejects.toThrow(/không còn chờ duyệt/) // prettier-ignore
    expect(deNghiRepo.update).not.toHaveBeenCalled()
  })
})

describe('Đ3/Đ4 · Kho nhập hàng đã mua + khép phiếu (0238)', () => {
  const duyet = (p: Partial<DeNghiDay> = {}) =>
    phieu({
      status: 'approved',
      approved_by_name: 'Alex',
      lines: [
        { id: 'l1', line_no: 1, material_id: 'm-keo', name: 'Băng keo trong 4F7', unit: 'Cuộn', qty: 200, approved_qty: 150, unit_price: 5500, vat_rate: 0, purpose: null, note: null, po_line_id: null }, // prettier-ignore
        { id: 'l2', line_no: 2, material_id: null, name: 'Giẻ lau', unit: 'Kg', qty: 20, approved_qty: null, unit_price: null, vat_rate: 0, purpose: null, note: null, po_line_id: null }, // prettier-ignore
      ],
      ...p,
    })
  const vao = {
    noi_mua: 'Tiệm Tân Hưng',
    supplier_doc_no: 'BN 0457',
    doc_date: null,
    backdate_reason: null,
    note: null,
  }

  beforeEach(() => {
    vi.mocked(stockService.createReceiptDoc).mockResolvedValue({ id: 'doc1', code: 'PNK-2026-0121', po_status: null, stock_after: [] }) // prettier-ignore
    vi.mocked(deNghiRepo.vatTu).mockResolvedValue(new Map([['m-gie', { code: 'GIE0001', name: 'Giẻ lau trắng', unit: 'Kg' }]])) // prettier-ignore
  })

  it('ghi PNK N2 có đơn giá thật, mỗi dòng sổ trỏ dòng đề nghị; dòng chưa có mã được gắn SAU khi ghi sổ', async () => {
    vi.mocked(deNghiRepo.findById).mockResolvedValue(duyet())
    const r = await deNghiService.nhapKho(hao, 'dn1', {
      ...vao,
      lines: [
        { line_id: 'l1', qty: 150, unit_price: 5200, note: null },
        { line_id: 'l2', material_id: 'm-gie', qty: 20, unit_price: 18000, note: null },
      ],
    })
    expect(r.code).toBe('PNK-2026-0121')
    const arg = vi.mocked(stockService.createReceiptDoc).mock.calls[0][1]
    expect(arg).toMatchObject({ po_id: null, counterparty: 'Tiệm Tân Hưng', reason: 'Mua theo đề nghị DNM-2026-0001', supplier_doc_no: 'BN 0457', purchase_request_id: 'dn1' }) // prettier-ignore
    expect(arg.lines).toEqual([
      { material_id: 'm-keo', qty: 150, unit_cost: 5200, purchase_request_line_id: 'l1', note: null }, // prettier-ignore
      { material_id: 'm-gie', qty: 20, unit_cost: 18000, purchase_request_line_id: 'l2', note: null }, // prettier-ignore
    ])
    expect(deNghiRepo.ganMa).toHaveBeenCalledWith('l2', { material_id: 'm-gie', name: 'Giẻ lau trắng', unit: 'Kg' }) // prettier-ignore
  })

  it('chặn đúng câu của màn: dòng có số mà chưa gắn mã → không ghi sổ, không gắn gì', async () => {
    vi.mocked(deNghiRepo.findById).mockResolvedValue(duyet())
    await expect(
      deNghiService.nhapKho(hao, 'dn1', { ...vao, lines: [{ line_id: 'l2', qty: 20, unit_price: 18000 }] }), // prettier-ignore
    ).rejects.toThrow(/Dòng 1 \(Giẻ lau\) chưa gắn mã/)
    expect(stockService.createReceiptDoc).not.toHaveBeenCalled()
    expect(deNghiRepo.ganMa).not.toHaveBeenCalled()
  })

  it('vượt > 10% số duyệt (đã nhập cộng dồn) bắt lý do; có lý do thì dòng sổ mang vết vượt', async () => {
    vi.mocked(deNghiRepo.findById).mockResolvedValue(duyet({ status: 'ordering' }))
    vi.mocked(deNghiRepo.soKho).mockResolvedValue(
      new Map([['l1', { daNhap: 100, tien: 0, phieu: [] }]]),
    )
    await expect(
      deNghiService.nhapKho(hao, 'dn1', { ...vao, lines: [{ line_id: 'l1', qty: 70, unit_price: 5500 }] }), // prettier-ignore
    ).rejects.toThrow(/vượt số duyệt 13%/)
    await deNghiService.nhapKho(hao, 'dn1', { ...vao, lines: [{ line_id: 'l1', qty: 70, unit_price: 5500, note: 'bán theo thùng' }] }) // prettier-ignore
    expect(vi.mocked(stockService.createReceiptDoc).mock.calls[0][1].lines[0].note).toBe('bán theo thùng · [Vượt 13% số duyệt]') // prettier-ignore
  })

  it('không đổi được mã của dòng đã có mã; dòng lạ bị chặn; phiếu chưa duyệt / đã xong không nhập', async () => {
    vi.mocked(deNghiRepo.findById).mockResolvedValue(duyet())
    await expect(deNghiService.nhapKho(hao, 'dn1', { ...vao, lines: [{ line_id: 'l1', material_id: 'm-khac', qty: 1, unit_price: 1 }] })).rejects.toThrow(/không đổi mã/) // prettier-ignore
    await expect(deNghiService.nhapKho(hao, 'dn1', { ...vao, lines: [{ line_id: 'la', qty: 1, unit_price: 1 }] })).rejects.toThrow(/không thuộc/) // prettier-ignore
    vi.mocked(deNghiRepo.findById).mockResolvedValue(duyet({ status: 'pending' }))
    await expect(deNghiService.nhapKho(hao, 'dn1', { ...vao, lines: [{ line_id: 'l1', qty: 1, unit_price: 1 }] })).rejects.toThrow(/chưa được duyệt/) // prettier-ignore
    vi.mocked(deNghiRepo.findById).mockResolvedValue(duyet({ status: 'done' }))
    await expect(deNghiService.nhapKho(hao, 'dn1', { ...vao, lines: [{ line_id: 'l1', qty: 1, unit_price: 1 }] })).rejects.toThrow(/đã xong/) // prettier-ignore
    expect(stockService.createReceiptDoc).not.toHaveBeenCalled()
  })

  it('sau khi nhập: trạng thái tính lại từ sổ kho — một phần → Đang nhập, đủ → Xong', async () => {
    vi.mocked(deNghiRepo.findById).mockResolvedValue(duyet())
    vi.mocked(deNghiRepo.soKho).mockResolvedValueOnce(new Map()) // trước khi ghi
    vi.mocked(deNghiRepo.soKho).mockResolvedValueOnce(
      new Map([['l1', { daNhap: 150, tien: 0, phieu: [] }]]),
    ) // sau khi ghi
    await deNghiService.nhapKho(hao, 'dn1', { ...vao, lines: [{ line_id: 'l1', qty: 150, unit_price: 5500 }] }) // prettier-ignore
    expect(vi.mocked(deNghiRepo.update).mock.calls.at(-1)?.slice(1)).toEqual([{ status: 'ordering' }, ['approved', 'ordering', 'done']]) // prettier-ignore

    vi.mocked(deNghiRepo.update).mockClear()
    vi.mocked(deNghiRepo.findById).mockResolvedValue(duyet({ status: 'ordering' }))
    vi.mocked(deNghiRepo.soKho).mockResolvedValueOnce(
      new Map([['l1', { daNhap: 150, tien: 0, phieu: [] }]]),
    )
    vi.mocked(deNghiRepo.soKho).mockResolvedValueOnce(new Map([['l1', { daNhap: 150, tien: 0, phieu: [] }], ['l2', { daNhap: 20, tien: 0, phieu: [] }]])) // prettier-ignore
    await deNghiService.nhapKho(hao, 'dn1', { ...vao, lines: [{ line_id: 'l2', material_id: 'm-gie', qty: 20, unit_price: 18000 }] }) // prettier-ignore
    expect(vi.mocked(deNghiRepo.update).mock.calls.at(-1)?.[1]).toEqual({
      status: 'done',
    })
  })

  it('Chốt xong: chỉ khi đã duyệt / đang nhập, ghi người + lý do; phiếu nháp không chốt được', async () => {
    vi.mocked(deNghiRepo.findById).mockResolvedValue(duyet({ status: 'ordering' }))
    await deNghiService.chot(hao, 'dn1', 'tiệm hết hàng, không mua nữa')
    const [, patch, khiDang] = vi.mocked(deNghiRepo.update).mock.calls[0]
    expect(patch).toMatchObject({ status: 'done', closed_by: 'u-hao', closed_reason: 'tiệm hết hàng, không mua nữa' }) // prettier-ignore
    expect(khiDang).toEqual(['approved', 'ordering'])
    vi.mocked(deNghiRepo.findById).mockResolvedValue(duyet({ status: 'draft' }))
    await expect(deNghiService.chot(hao, 'dn1', 'abc')).rejects.toThrow(/Chỉ chốt được/)
  })
})

describe('Đ5 · danhSachDuyet — danh sách cho lãnh đạo', () => {
  const alex = { id: 'u-alex', role: 'employee' } as unknown as User

  it('chỉ người duyệt xem được; nháp chưa gửi bị loại; tiến độ + tiền thật đếm từ sổ kho', async () => {
    vi.mocked(deNghiRepo.list).mockResolvedValue([
      phieu({ id: 'a', status: 'pending', submitted_at: '2026-10-11T01:00:00Z' }),
      phieu({ id: 'b', status: 'ordering', submitted_at: '2026-10-10T01:00:00Z', approved_at: new Date().toISOString(), lines: [
        { id: 'l1', line_no: 1, material_id: 'm-keo', name: 'Băng keo', unit: 'Cuộn', qty: 200, approved_qty: 150, unit_price: 5500, vat_rate: 0, purpose: null, note: null, po_line_id: null }, // prettier-ignore
        { id: 'l2', line_no: 2, material_id: null, name: 'Giẻ lau', unit: 'Kg', qty: 20, approved_qty: null, unit_price: 15000, vat_rate: 0, purpose: null, note: null, po_line_id: null }, // prettier-ignore
      ] }), // prettier-ignore
      phieu({ id: 'c', status: 'draft', submitted_at: null }),
    ])
    vi.mocked(deNghiRepo.soKho).mockResolvedValue(new Map([['l1', { daNhap: 150, tien: 780_000, phieu: [{ doc_id: 'd1', code: 'PNK-2026-0121', doc_date: '2026-10-13', qty: 150 }] }]])) // prettier-ignore
    const { rows, thang } = await deNghiService.danhSachDuyet(alex)
    expect(rows.map((r) => [r.id, r.ro])).toEqual([
      ['a', 'cho'],
      ['b', 'mua'],
    ])
    expect(rows[1]).toMatchObject({ du_kien: 825_000 + 300_000, mua_dong: 2, du_dong: 1, thuc_chi: 780_000, phieu_nhap: ['PNK-2026-0121'] }) // prettier-ignore
    expect(thang).toMatchObject({ so_phieu: 1, du_kien: 1_125_000, thuc_chi: 780_000 })
  })

  it('không có quyền duyệt → chặn', async () => {
    const { canAction } = await import('@/modules/core/rbac/rbac.service')
    vi.mocked(canAction).mockResolvedValueOnce(false)
    await expect(deNghiService.danhSachDuyet(alex)).rejects.toThrow(/người duyệt/)
  })
})

describe('Đ7 · VAT từng dòng, vận chuyển, lời dặn (0239)', () => {
  it('lưu VAT theo DÒNG (dòng có VAT + dòng không VAT cùng phiếu) và phí vận chuyển của phiếu', async () => {
    vi.mocked(deNghiRepo.nextCode).mockResolvedValue('DNM-2026-0002')
    vi.mocked(deNghiRepo.insert).mockResolvedValue({ id: 'dn2' })
    await deNghiService.create(hao, {
      department: 'Kho vật tư',
      shipping_fee: 30_000,
      lines: [
        {
          material_id: 'm-keo',
          name: 'x',
          unit: 'x',
          qty: 200,
          unit_price: 5500,
          vat_rate: 8,
        },
        {
          material_id: null,
          name: 'Giẻ lau',
          unit: 'Kg',
          qty: 20,
          unit_price: 15000,
          vat_rate: 0,
        },
      ],
    } as never)
    expect(vi.mocked(deNghiRepo.insert).mock.calls[0][0]).toMatchObject({
      shipping_fee: 30_000,
    })
    expect(vi.mocked(deNghiRepo.replaceLines).mock.calls[0][1].map((d) => d.vat_rate)).toEqual([8, 0]) // prettier-ignore
  })

  it('duyệt kèm lời dặn → lưu approve_note; tổng gửi người duyệt gồm VAT + vận chuyển', async () => {
    const alex = { id: 'u-alex', role: 'employee' } as unknown as User
    vi.mocked(deNghiRepo.findById).mockResolvedValue(phieu({ status: 'pending' }))
    await deNghiService.decide(alex, 'dn1', { decision: 'approve', reason: ' que hàn chờ PO-0174 ' }) // prettier-ignore
    expect(vi.mocked(deNghiRepo.update).mock.calls[0][1]).toMatchObject({ status: 'approved', approve_note: 'que hàn chờ PO-0174' }) // prettier-ignore

    vi.mocked(deNghiRepo.update).mockClear()
    vi.mocked(emit).mockClear()
    vi.mocked(deNghiRepo.findById).mockResolvedValue(
      phieu({ shipping_fee: 30_000, lines: [{ ...phieu().lines[0], vat_rate: 8 }] }),
    )
    await deNghiService.submit(hao, 'dn1')
    expect((vi.mocked(emit).mock.calls[0][0] as { tong: number }).tong).toBe(1_100_000 + 88_000 + 30_000) // prettier-ignore
  })
})
