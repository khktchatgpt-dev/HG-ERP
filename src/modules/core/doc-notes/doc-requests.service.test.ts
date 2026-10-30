import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocRequest } from '@/lib/doc-requests'
import type { User } from '@/modules/core/users/users.repo'

// vi.mock được kéo lên đầu file — đồ giả phải tạo trong vi.hoisted mới tới kịp.
const { repo, notes, users, depts, ref, emit } = vi.hoisted(() => ({
  repo: {
    create: vi.fn(),
    findById: vi.fn(),
    applyPatch: vi.fn(),
    listForUser: vi.fn(),
    listByDoc: vi.fn(),
    closeOpenByDoc: vi.fn(),
  },
  notes: { create: vi.fn(), addFollowers: vi.fn() },
  users: { findById: vi.fn(), list: vi.fn() },
  depts: { list: vi.fn() },
  ref: { loadDocRef: vi.fn(), docCodesByIds: vi.fn() },
  emit: vi.fn(),
}))

vi.mock('./doc-requests.repo', () => ({ docRequestsRepo: repo }))
vi.mock('./doc-notes.repo', () => ({ docNotesRepo: notes }))
vi.mock('./doc-ref', () => ({
  loadDocRef: (...a: unknown[]) => ref.loadDocRef(...a),
  docCodesByIds: (...a: unknown[]) => ref.docCodesByIds(...a),
}))
vi.mock('@/modules/core/users/users.repo', () => ({ usersRepo: users }))
vi.mock('@/modules/core/departments/departments.repo', () => ({ departmentsRepo: depts }))
vi.mock('@/events/bus', () => ({ emit: (...a: unknown[]) => emit(...a), on: vi.fn() }))
vi.mock('@/events/register', () => ({}))
vi.mock('@/lib/date-vn', async (orig) => ({
  ...(await orig<typeof import('@/lib/date-vn')>()),
  todayVn: () => '2026-10-29',
}))

import { docRequestsService } from './doc-requests.service'

/*
  Ca bám bản vẽ duyệt 29/10: Thảo (quản lý Cung ứng) giao Phương (Bán hàng) bổ
  sung ảnh trên lệnh 01/26-27 - LAURA. UUID thật — Zod 4 kiểm bit phiên bản.
*/
const LSX = '3a1ec4a4-83c7-4f94-bb36-74b204ee6311'
const PHUONG_ID = 'c658703c-1f39-4c28-9223-5dfd6062345b'
const HANG_ID = '7ed21761-226a-49dc-8f0f-8838f92b3080'

const user = (over: Partial<User>): User =>
  ({
    id: 'u',
    name: null,
    role: 'employee',
    is_active: true,
    deleted_at: null,
    ...over,
  }) as User
const THAO = user({ id: 'u-thao', name: 'Vũ Phương Thảo', role: 'manager' })
const PHUONG = user({ id: PHUONG_ID, name: 'Nguyễn Phạm Thanh Phương' })
const HANG = user({ id: HANG_ID, name: 'Nguyễn T.Minh Hằng' })
const NGA = user({ id: 'u-nga', name: 'Nga' })

const REQ = (over: Partial<DocRequest> = {}): DocRequest => ({
  id: 'r1',
  doc_type: 'lsx',
  doc_id: LSX,
  author_id: THAO.id,
  author_name: 'Thảo',
  audience: 'internal',
  body: 'Bổ sung ảnh SP cho 55 dòng còn trống',
  reply_to: null,
  created_at: '2026-10-29T02:12:00Z',
  deleted_at: null,
  kind: 'request',
  assignee_id: PHUONG_ID,
  assignee_name: 'Phương',
  due_on: '2026-10-31',
  resolved_at: null,
  resolved_by: null,
  resolved_how: null,
  ...over,
})

const NEW = { doc_type: 'lsx', doc_id: LSX, assignee_id: PHUONG_ID, due_on: '2026-10-31', body: 'Bổ sung ảnh SP cho 55 dòng còn trống' } // prettier-ignore

beforeEach(() => {
  for (const f of [...Object.values(repo), ...Object.values(notes), users.findById, ref.loadDocRef, ref.docCodesByIds, emit]) f.mockReset() // prettier-ignore
  ref.loadDocRef.mockResolvedValue({ code: '01/26-27 - LAURA', watchers: { created_by: 'u-sale', assigned_to: 'u-sale', approved_by: 'u-gd' } }) // prettier-ignore
  ref.docCodesByIds.mockResolvedValue(new Map([[LSX, '01/26-27 - LAURA']]))
  users.findById.mockImplementation(async (id: string) => [PHUONG, HANG].find((u) => u.id === id) ?? null) // prettier-ignore
  repo.create.mockImplementation(async (i: Record<string, unknown>) =>
    REQ({ ...i, id: 'r1' }),
  )
})

describe('create — giao việc', () => {
  it('ghi yêu cầu, gắn người nhận theo dõi chứng từ, chuông cho người nhận', async () => {
    const r = await docRequestsService.create(THAO, NEW)
    expect(repo.create).toHaveBeenCalledWith({ doc_type: 'lsx', doc_id: LSX, author_id: 'u-thao', assignee_id: PHUONG_ID, due_on: '2026-10-31', body: NEW.body }) // prettier-ignore
    expect(notes.addFollowers).toHaveBeenCalledWith('lsx', LSX, ['u-sale', 'u-gd', 'u-thao', PHUONG_ID]) // prettier-ignore
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ name: 'doc.request.created', doc_code: '01/26-27 - LAURA', recipient_ids: [PHUONG_ID] })) // prettier-ignore
    expect(r.id).toBe('r1')
  })
  it('hạn đã qua → 400, chưa ghi gì', async () => {
    await expect(docRequestsService.create(THAO, { ...NEW, due_on: '2026-10-28' })).rejects.toMatchObject({ status: 400 }) // prettier-ignore
    expect(repo.create).not.toHaveBeenCalled()
  })
  it('chứng từ không có → 404; người nhận đã khoá → 400 nói rõ tên', async () => {
    ref.loadDocRef.mockResolvedValueOnce(null)
    await expect(docRequestsService.create(THAO, NEW)).rejects.toMatchObject({
      status: 404,
    })
    users.findById.mockResolvedValueOnce({ ...PHUONG, is_active: false })
    await expect(docRequestsService.create(THAO, NEW)).rejects.toMatchObject({ status: 400, message: 'Nguyễn Phạm Thanh Phương không còn hoạt động — chọn người khác' }) // prettier-ignore
    expect(repo.create).not.toHaveBeenCalled()
  })
})

describe('act — một bước trên yêu cầu', () => {
  beforeEach(() => repo.findById.mockResolvedValue(REQ()))

  it('người nhận báo xong: ghi có điều kiện, vết "Xong: …" trả lời yêu cầu, chuông cho người giao', async () => {
    // prettier-ignore
    repo.applyPatch.mockResolvedValue(REQ({ resolved_how: 'done', resolved_at: 'now' }))
    await docRequestsService.act(PHUONG, 'r1', { action: 'done', text: 'Đã tải ảnh 55 SP lên hồ sơ' }) // prettier-ignore
    expect(repo.applyPatch).toHaveBeenCalledWith('r1', 'open', expect.objectContaining({ resolved_how: 'done', resolved_by: PHUONG_ID })) // prettier-ignore
    expect(notes.create).toHaveBeenCalledWith(expect.objectContaining({ body: 'Xong: Đã tải ảnh 55 SP lên hồ sơ', reply_to: 'r1', doc_type: 'lsx', doc_id: LSX }), 'Nguyễn Phạm Thanh Phương') // prettier-ignore
    expect(emit).toHaveBeenCalledWith(expect.objectContaining({ name: 'doc.request.changed', action: 'done', recipient_ids: ['u-thao'], text: 'Đã tải ảnh 55 SP lên hồ sơ' })) // prettier-ignore
  })
  it('người ngoài cuộc → 403, không ghi', async () => {
    await expect(docRequestsService.act(NGA, 'r1', { action: 'done', text: 'xong' })).rejects.toMatchObject({ status: 403 }) // prettier-ignore
    expect(repo.applyPatch).not.toHaveBeenCalled()
  })
  it('báo xong thiếu câu kết quả → lỗi kiểm dữ liệu, không tới DB', async () => {
    await expect(docRequestsService.act(PHUONG, 'r1', { action: 'done', text: '' })).rejects.toThrow() // prettier-ignore
    expect(repo.findById).not.toHaveBeenCalled()
  })
  it('hai người bấm cùng lúc → 409, không ghi vết', async () => {
    repo.applyPatch.mockResolvedValue(null)
    await expect(docRequestsService.act(THAO, 'r1', { action: 'cancel', text: 'Khách đổi mẫu' })).rejects.toMatchObject({ status: 409 }) // prettier-ignore
    expect(notes.create).not.toHaveBeenCalled()
    expect(emit).not.toHaveBeenCalled()
  })
  it('chuyển người: báo cả người cũ lẫn người mới, người mới theo dõi chứng từ', async () => {
    repo.applyPatch.mockResolvedValue(REQ({ assignee_id: HANG_ID }))
    await docRequestsService.act(THAO, 'r1', { action: 'reassign', assignee_id: HANG_ID, text: 'Phương nghỉ phép' }) // prettier-ignore
    expect(repo.applyPatch).toHaveBeenCalledWith('r1', 'open', { assignee_id: HANG_ID })
    expect(notes.create.mock.calls[0][0].body).toBe('Chuyển yêu cầu cho Nguyễn T.Minh Hằng — Phương nghỉ phép') // prettier-ignore
    expect(notes.addFollowers).toHaveBeenCalledWith('lsx', LSX, [HANG_ID])
    expect(emit.mock.calls[0][0].recipient_ids).toEqual([PHUONG_ID, HANG_ID])
  })
  it('chuyển cho chính người đang giữ → 400', async () => {
    await expect(docRequestsService.act(THAO, 'r1', { action: 'reassign', assignee_id: PHUONG_ID })).rejects.toMatchObject({ status: 400 }) // prettier-ignore
  })
  it('đã xong mà người nhận bấm báo xong lần nữa → 400 (sai lúc, không phải sai người)', async () => {
    repo.findById.mockResolvedValue(REQ({ resolved_at: 'x', resolved_how: 'done' }))
    await expect(docRequestsService.act(PHUONG, 'r1', { action: 'done', text: 'lại' })).rejects.toMatchObject({ status: 400 }) // prettier-ignore
  })
  it('không thấy yêu cầu → 404', async () => {
    repo.findById.mockResolvedValue(null)
    await expect(docRequestsService.act(THAO, 'r9', { action: 'cancel', text: 'x' })).rejects.toMatchObject({ status: 404 }) // prettier-ignore
  })
})

describe('listMine', () => {
  it('chip đếm trên toàn bộ, danh sách chỉ phần đã lọc, kèm mã chứng từ + nút bấm được', async () => {
    repo.listForUser.mockResolvedValue([
      REQ({ id: 'mo', due_on: '2026-10-31' }),
      REQ({ id: 'qua', due_on: '2026-10-27' }),
      REQ({ id: 'xong', resolved_at: '2026-10-28T03:00:00Z', resolved_how: 'done' }),
    ])
    const out = await docRequestsService.listMine(PHUONG, {
      tab: 'assigned',
      filter: 'open',
    })
    expect(repo.listForUser.mock.calls[0][0]).toBe('assigned')
    expect(out.summary).toEqual({ open: 2, overdue: 1, done: 1, cancelled: 0 })
    expect(out.items.map((r) => [r.id, r.overdue_days, r.doc_code, r.actions])).toEqual([
      ['qua', 2, '01/26-27 - LAURA', ['done', 'reassign']],
      ['mo', 0, '01/26-27 - LAURA', ['done', 'reassign']],
    ])
  })
  it('mặc định tab "giao cho tôi", chip "đang mở"', async () => {
    repo.listForUser.mockResolvedValue([])
    const out = await docRequestsService.listMine(PHUONG, {})
    expect([out.tab, out.filter]).toEqual(['assigned', 'open'])
  })
})

describe('closeByDoc — chứng từ bị huỷ', () => {
  it('đóng yêu cầu còn mở, ghi vết, báo người nhận', async () => {
    repo.closeOpenByDoc.mockResolvedValue([{ id: 'r1', author_id: 'u-thao', assignee_id: PHUONG_ID, body: 'Bổ sung ảnh' }]) // prettier-ignore
    await docRequestsService.closeByDoc('lsx', LSX, '01/26-27 - LAURA', 'u-sale')
    expect(notes.create.mock.calls[0][0]).toMatchObject({ body: 'Đóng yêu cầu: chứng từ đã huỷ', reply_to: 'r1' }) // prettier-ignore
    expect(emit.mock.calls[0][0]).toMatchObject({ action: 'closed', recipient_ids: ['u-thao', PHUONG_ID] }) // prettier-ignore
  })
  it('lỗi DB thì NUỐT — không được chặn việc huỷ chứng từ', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    repo.closeOpenByDoc.mockRejectedValue(new Error('mất kết nối'))
    await expect(docRequestsService.closeByDoc('po', LSX, 'PO-2026-0183', 'u-truyen')).resolves.toBeUndefined() // prettier-ignore
    spy.mockRestore()
  })
})

describe('listByDoc + people (B2 — khối trên chứng từ)', () => {
  it('yêu cầu của một chứng từ: xếp quá hạn lên đầu, kèm mã + nút theo quyền NGƯỜI XEM', async () => {
    repo.listByDoc.mockResolvedValue([
      REQ({ id: 'mo', due_on: '2026-10-31' }),
      REQ({ id: 'qua', due_on: '2026-10-27' }),
    ])
    const out = await docRequestsService.listByDoc(NGA, 'lsx', LSX, '01/26-27 - LAURA')
    expect(repo.listByDoc).toHaveBeenCalledWith('lsx', LSX)
    expect(out.map((r) => [r.id, r.overdue_days, r.doc_code, r.actions])).toEqual([
      ['qua', 2, '01/26-27 - LAURA', []],
      ['mo', 0, '01/26-27 - LAURA', []],
    ])
    const thao = await docRequestsService.listByDoc(THAO, 'lsx', LSX, 'x')
    expect(thao[0].actions).toEqual(['done', 'reassign', 'cancel'])
  })
  it('người nhận: chỉ tên + phòng (không email / điện thoại), bỏ tài khoản không tên', async () => {
    users.list.mockResolvedValue([
      { ...PHUONG, email: 'p@hg.com', phone: '090', department_id: 'd-bh' },
      { ...HANG, department_id: null },
      user({ id: 'u-x', name: '  ' }),
    ])
    depts.list.mockResolvedValue([{ id: 'd-bh', name: 'Bán Hàng' }])
    expect(await docRequestsService.people()).toEqual([
      { id: PHUONG_ID, name: 'Nguyễn Phạm Thanh Phương', department: 'Bán Hàng' },
      { id: HANG_ID, name: 'Nguyễn T.Minh Hằng', department: null },
    ])
    expect(users.list).toHaveBeenCalledWith({ active_only: true })
  })
})
