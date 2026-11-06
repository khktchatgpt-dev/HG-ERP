import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./pos.repo', () => ({
  posRepo: {
    findById: vi.fn(),
    patchFrom: vi.fn(),
    list: vi.fn(),
    lineCountsByPoIds: vi.fn(),
  },
}))
vi.mock('./supply.repo', () => ({
  suppliersRepo: { findById: vi.fn(async () => ({ id: 's1', name: 'Tân Hoàng Long' })) },
}))
vi.mock('./pos.service', () => ({
  approverIds: vi.fn(async () => ['u-boss']),
  leadIds: vi.fn(async () => ['u-lead']),
  traceReason: vi.fn(async () => undefined),
  assertGuiDuyetDuoc: vi.fn(async () => undefined),
  assertPoOwner: vi.fn(async () => undefined),
  posService: { submit: vi.fn(async () => ({})) },
}))
vi.mock('@/modules/core/approvals/approvals.repo', () => ({
  approvalEventsRepo: { log: vi.fn(), listByEntity: vi.fn(), listForEntities: vi.fn() },
}))
vi.mock('@/modules/core/doc-notes/doc-notes.repo', () => ({
  docNotesRepo: { resolveQuestions: vi.fn(async () => []) },
}))
vi.mock('@/modules/core/rbac/rbac.service', () => ({ assertAction: vi.fn() }))
vi.mock('@/modules/core/users/users.repo', () => ({
  usersRepo: {
    displayNamesByIds: vi.fn(async () => new Map([['u-lead', 'đỗ ngọc hiếu']])),
  },
}))
vi.mock('@/events/bus', () => ({ emit: vi.fn(), on: vi.fn() }))
vi.mock('@/events/register', () => ({}))

import { poReviewService } from './po-review.service'
import { posRepo } from './pos.repo'
import { suppliersRepo } from './supply.repo'
import { assertGuiDuyetDuoc, leadIds, posService, traceReason } from './pos.service'
import { approvalEventsRepo } from '@/modules/core/approvals/approvals.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { emit } from '@/events/bus'
import { Forbidden } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'

const hieu = { id: 'u-lead', role: 'manager', name: 'Đỗ Ngọc Hiếu' } as unknown as User
const PO = {
  id: 'po1',
  code: 'PO-2026-0243',
  status: 'pending_approval',
  supplier_id: 's1',
  assigned_to: 'u-sup',
  created_by: 'u-sup',
}
const gui = { action: 'submitted', actor_id: 'u-sup', reason: null, created_at: '2026-11-04T08:37:00Z' } // prettier-ignore
const xem = { action: 'reviewed', actor_id: 'u-lead', actor_name: 'Đỗ Ngọc Hiếu', reason: 'Giá giữ như 0228', created_at: '2026-11-05T02:15:00Z' } // prettier-ignore
const rut = { action: 'withdrawn', actor_id: 'u-sup', actor_name: 'Đặng Thị Thanh Nga', reason: null, created_at: '2026-11-05T02:18:00Z' } // prettier-ignore

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(assertAction).mockResolvedValue(undefined as never)
  vi.mocked(posRepo.findById).mockResolvedValue(PO as never)
})

describe('poReviewService.review — "Đã xem — trình GĐ"', () => {
  it('chưa ai xem → ghi vết reviewed kèm ghi chú, báo người duyệt', async () => {
    vi.mocked(approvalEventsRepo.listByEntity)
      .mockResolvedValueOnce([gui] as never)
      .mockResolvedValueOnce([gui, xem] as never)
    const out = await poReviewService.review(hieu, 'po1', '  Giá giữ như 0228 ')
    expect(approvalEventsRepo.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'reviewed', actor_id: 'u-lead', reason: 'Giá giữ như 0228' }), // prettier-ignore
    )
    expect(out.already).toBe(false)
    expect(out.mark.note).toBe('Giá giữ như 0228')
    expect(vi.mocked(emit).mock.calls[0][0]).toMatchObject({
      name: 'po.reviewed',
      approver_ids: ['u-boss'],
      supplier_name: 'Tân Hoàng Long',
    })
  })

  it('ghi chú để trống → không bắt (Q3), lưu null', async () => {
    vi.mocked(approvalEventsRepo.listByEntity)
      .mockResolvedValueOnce([gui] as never)
      .mockResolvedValueOnce([gui, { ...xem, reason: null }] as never)
    await poReviewService.review(hieu, 'po1', '   ')
    expect(vi.mocked(approvalEventsRepo.log).mock.calls[0][0].reason).toBeNull()
  })

  it('đã có người xem (bấm trùng) → trả dấu cũ, không ghi thêm, không báo lại', async () => {
    vi.mocked(approvalEventsRepo.listByEntity).mockResolvedValue([gui, xem] as never)
    const out = await poReviewService.review(hieu, 'po1')
    expect(out.already).toBe(true)
    expect(approvalEventsRepo.log).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })

  it('đơn không còn chờ duyệt → 409 nói ai làm gì lúc nào', async () => {
    vi.mocked(posRepo.findById).mockResolvedValue({ ...PO, status: 'draft' } as never)
    vi.mocked(approvalEventsRepo.listByEntity).mockResolvedValue([gui, rut] as never)
    await expect(poReviewService.review(hieu, 'po1')).rejects.toMatchObject({
      status: 409,
      message: 'PO-2026-0243 vừa được Đặng Thị Thanh Nga rút về nháp lúc 09:18',
    })
    expect(approvalEventsRepo.log).not.toHaveBeenCalled()
  })

  it('NV rút về nháp đúng lúc vừa ghi → đọc lại thấy dấu vô hiệu → 409, không báo GĐ', async () => {
    vi.mocked(approvalEventsRepo.listByEntity)
      .mockResolvedValueOnce([gui] as never)
      .mockResolvedValueOnce([
        gui,
        rut,
        { ...xem, created_at: '2026-11-05T02:18:01Z' },
      ] as never)
    await expect(poReviewService.review(hieu, 'po1')).rejects.toMatchObject({
      status: 409,
    })
    expect(emit).not.toHaveBeenCalled()
  })

  it('không phải trưởng phòng → 403 trước khi đọc đơn', async () => {
    vi.mocked(assertAction).mockRejectedValue(Forbidden())
    await expect(poReviewService.review(hieu, 'po1')).rejects.toMatchObject({
      status: 403,
    })
    expect(assertAction).toHaveBeenCalledWith(hieu, 'supply.po.manage_any')
    expect(posRepo.findById).not.toHaveBeenCalled()
  })
})

describe('poReviewService.returnForEdit — trưởng phòng trả lại để sửa', () => {
  it('chờ duyệt → nháp có điều kiện; lý do vào Trao đổi nội bộ; báo người phụ trách', async () => {
    vi.mocked(posRepo.patchFrom).mockResolvedValue({ ...PO, status: 'draft' } as never)
    await poReviewService.returnForEdit(hieu, 'po1', 'Thiếu khổ xốp 670×110')
    expect(posRepo.patchFrom).toHaveBeenCalledWith('po1', ['pending_approval'], { status: 'draft' }) // prettier-ignore
    expect(vi.mocked(traceReason).mock.calls[0][2]).toBe('[Trả lại để sửa] Thiếu khổ xốp 670×110') // prettier-ignore
    expect(vi.mocked(emit).mock.calls[0][0]).toMatchObject({
      name: 'po.returned',
      owner_id: 'u-sup',
      reason: 'Thiếu khổ xốp 670×110',
    })
  })

  it('GĐ vừa duyệt cùng lúc → không kéo đơn đã duyệt về nháp, 409 nói thật', async () => {
    vi.mocked(posRepo.patchFrom).mockResolvedValue(null)
    vi.mocked(approvalEventsRepo.listByEntity).mockResolvedValue([
      gui,
      { action: 'approved', actor_id: 'u-boss', actor_name: 'Alex', reason: null, created_at: '2026-11-05T04:02:00Z' }, // prettier-ignore
    ] as never)
    await expect(
      poReviewService.returnForEdit(hieu, 'po1', 'Thiếu khổ xốp'),
    ).rejects.toMatchObject({
      status: 409,
      message: 'PO-2026-0243 vừa được Alex duyệt lúc 11:02',
    })
    expect(traceReason).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })
})

describe('poReviewService.truongPhongCho — dữ liệu cho hộp ký GĐ (B3)', () => {
  it('chưa ai giữ vai trưởng phòng → null, không đọc sổ vết', async () => {
    vi.mocked(leadIds).mockResolvedValueOnce([])
    expect(await poReviewService.truongPhongCho(['po1'])).toBeNull()
    expect(approvalEventsRepo.listForEntities).not.toHaveBeenCalled()
  })
  it('tên viết hoa đúng + dấu đã xem theo đơn (đơn chưa xem không có dấu)', async () => {
    vi.mocked(approvalEventsRepo.listForEntities).mockResolvedValue([
      { ...gui, entity_id: 'po1' },
      { ...xem, actor_name: 'đỗ ngọc hiếu', entity_id: 'po1' },
      { ...gui, entity_id: 'po2' },
    ] as never)
    const ctx = await poReviewService.truongPhongCho(['po1', 'po2'])
    expect(ctx?.ten).toBe('Đỗ Ngọc Hiếu')
    expect(ctx?.ids).toEqual(['u-lead'])
    expect(ctx?.marks.get('po1')).toMatchObject({
      by_name: 'Đỗ Ngọc Hiếu',
      note: 'Giá giữ như 0228',
    })
    expect(ctx?.marks.has('po2')).toBe(false)
  })
})

describe('nháp — trưởng phòng xem rồi trình GĐ (05/11/2026 chiều, không có mốc gửi)', () => {
  const nhap = { ...PO, status: 'draft', supplier_name: 'Tân Hoàng Long', lsx_code: null }

  it('"Đã xem — trình GĐ" trên nháp = gửi duyệt do trưởng phòng gọi, kèm ghi chú', async () => {
    vi.mocked(posRepo.findById).mockResolvedValue(nhap as never)
    vi.mocked(approvalEventsRepo.listByEntity).mockResolvedValueOnce([gui, xem] as never)
    const out = await poReviewService.review(hieu, 'po1', 'Giá giữ như 0228', 'draft')
    expect(posService.submit).toHaveBeenCalledWith(hieu, 'po1', {
      note: 'Giá giữ như 0228',
    })
    expect(out.mark.by).toBe('u-lead')
  })

  it('màn thấy nháp mà NV vừa gửi thẳng GĐ → 409 nói ai vừa gửi, không ghi gì', async () => {
    vi.mocked(posRepo.findById).mockResolvedValue({
      ...PO,
      status: 'pending_approval',
    } as never)
    vi.mocked(approvalEventsRepo.listByEntity).mockResolvedValue([
      { ...gui, actor_name: 'Nguyễn Đình Huy', created_at: '2026-11-05T02:30:00Z' },
    ] as never)
    await expect(
      poReviewService.review(hieu, 'po1', null, 'draft'),
    ).rejects.toMatchObject({
      status: 409,
      message: 'PO-2026-0243 vừa được Nguyễn Đình Huy gửi duyệt lúc 09:30',
    })
    expect(posService.submit).not.toHaveBeenCalled()
    expect(approvalEventsRepo.log).not.toHaveBeenCalled()
  })

  it('trả lại nháp: không đổi trạng thái, lý do vào Trao đổi, báo NV', async () => {
    vi.mocked(posRepo.findById).mockResolvedValue(nhap as never)
    await poReviewService.returnForEdit(hieu, 'po1', 'Thiếu khổ xốp 670×110', 'draft')
    expect(posRepo.patchFrom).not.toHaveBeenCalled()
    expect(vi.mocked(traceReason).mock.calls[0][2]).toBe('[Trả lại để sửa] Thiếu khổ xốp 670×110') // prettier-ignore
    expect(vi.mocked(emit).mock.calls[0][0]).toMatchObject({ name: 'po.returned', owner_id: 'u-sup' }) // prettier-ignore
  })
})

describe('poReviewService.choXemCount — số đỏ menu = việc làm được ngay (Q7, bản 2)', () => {
  const don = (id: string, status: string, them: Record<string, unknown> = {}) => ({
    id,
    code: `PO-2026-${id}`,
    status,
    supplier_id: 's1',
    production_order_id: 'lsx1',
    expected_at: '2026-11-20',
    updated_at: '2026-11-03T02:00:00Z',
    ...them,
  })
  const tra = (id: string, at: string) => ({ entity_id: id, action: 'returned', actor_id: 'u-lead', actor_name: 'Đỗ Ngọc Hiếu', reason: 'Thiếu khổ', created_at: at }) // prettier-ignore

  it('đếm nháp trình được + nháp đã sửa sau trả lại + đơn NV gửi thẳng chưa xem; bỏ nháp thiếu, bị trả lại chưa sửa, đơn đã xem', async () => {
    vi.mocked(suppliersRepo.findById).mockResolvedValue({ id: 's1', name: 'Sơn Nam Việt', is_active: true, can_order: true } as never) // prettier-ignore
    vi.mocked(posRepo.list)
      .mockResolvedValueOnce({
        rows: [
          don('A', 'draft'), // trình được
          don('B', 'draft', { expected_at: null }), // thiếu hẹn giao
          don('C', 'draft'), // trả lại SAU lần sửa cuối → chờ người lập
          don('D', 'draft', { updated_at: '2026-11-05T03:00:00Z' }), // sửa sau trả lại
          don('G', 'draft'), // chưa có dòng hàng
        ],
      } as never)
      .mockResolvedValueOnce({
        rows: [don('E', 'pending_approval'), don('F', 'pending_approval')],
      } as never)
    vi.mocked(posRepo.lineCountsByPoIds).mockResolvedValue(
      new Map([
        ['A', 2],
        ['B', 1],
        ['C', 1],
        ['D', 3],
      ]),
    )
    vi.mocked(approvalEventsRepo.listForEntities).mockResolvedValue([
      tra('C', '2026-11-04T02:00:00Z'),
      tra('D', '2026-11-04T02:00:00Z'),
      { ...gui, entity_id: 'E' },
      { ...gui, entity_id: 'F' },
      { ...xem, entity_id: 'F' },
    ] as never)
    expect(await poReviewService.choXemCount()).toBe(3) // A · D · E
  })

  it('không có nháp, không có đơn chờ duyệt → 0, không đọc sổ vết', async () => {
    vi.mocked(posRepo.list).mockResolvedValue({ rows: [] } as never)
    expect(await poReviewService.choXemCount()).toBe(0)
    expect(approvalEventsRepo.listForEntities).not.toHaveBeenCalled()
  })
})
