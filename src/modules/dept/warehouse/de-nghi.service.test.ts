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
  },
}))
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
  created_by: 'u-hao',
  created_at: '2026-10-13T06:12:00Z',
  updated_at: '2026-10-13T06:12:00Z',
  requested_by_name: 'Lê Khắc Hào',
  approved_by_name: null,
  rejected_by_name: null,
  lsx_code: null,
  lines: [
    { id: 'l1', line_no: 1, material_id: 'm-keo', name: 'Băng keo trong 4F7', unit: 'Cuộn', qty: 200, approved_qty: null, unit_price: 5500, purpose: 'Đóng gói', note: null, po_line_id: null }, // prettier-ignore
  ],
  ...p,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(deNghiRepo.update).mockResolvedValue(true)
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

describe('deNghiService.goiY', () => {
  it('tồn + giá mua gần nhất; giá đơn USD không gợi ý', async () => {
    vi.mocked(deNghiRepo.tonDungDuoc).mockResolvedValue(new Map([['m-keo', 36]]))
    vi.mocked(pricesRepo.lastPurchases).mockResolvedValue([
      { material_id: 'm-keo', unit_price: 5500, currency: 'VND', po_code: 'PO-2026-0140', supplier_id: 's1', supplier_name: 'Phước Khang', at: '2026-10-06T00:00:00Z' }, // prettier-ignore
      { material_id: 'm-usd', unit_price: 2, currency: 'USD', po_code: 'PO-2026-0136', supplier_id: 's2', supplier_name: 'An Khánh', at: '2026-10-06T00:00:00Z' }, // prettier-ignore
    ])
    const r = await deNghiService.goiY(hao, ['m-keo', 'm-usd'])
    expect(r['m-keo']).toEqual({ ton: 36, gia: { unit_price: 5500, po_code: 'PO-2026-0140', supplier_name: 'Phước Khang', at: '2026-10-06T00:00:00Z' } }) // prettier-ignore
    expect(r['m-usd']).toEqual({ ton: 0, gia: null })
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
