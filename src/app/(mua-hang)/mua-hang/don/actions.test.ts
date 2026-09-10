import { describe, expect, it } from 'vitest'
import { PO_STATUSES } from '@/lib/po-status'
import { actionsFor, bulkActionFor } from './actions'

const own = { own: true, approve: false }
const boss = { own: true, approve: true }
const other = { own: false, approve: false }

describe('actionsFor — mỗi bước đúng một nút chính, luôn có đường mở đơn', () => {
  for (const s of PO_STATUSES) {
    it(`bước ${s}`, () => {
      const acts = actionsFor(s, boss)
      expect(acts.filter((a) => a.primary)).toHaveLength(1)
      expect(acts.some((a) => a.id === 'open' || a.id === 'edit')).toBe(true)
      // Nút chính đứng đầu — người dùng học vị trí.
      expect(acts[0].primary).toBe(true)
    })
  }
})

describe('khoá kèm lý do, không giấu', () => {
  it('không phải người phụ trách thì nút vẫn CÓ, chỉ bị khoá', () => {
    const acts = actionsFor('draft', other)
    const submit = acts.find((a) => a.id === 'submit')!
    expect(submit.blocked).toMatch(/người khác phụ trách/)
    expect(acts.find((a) => a.id === 'delete')!.blocked).toBeTruthy()
  })

  it('không có quyền duyệt thì Duyệt và Từ chối bị khoá, Rút về nháp thì không', () => {
    const acts = actionsFor('pending_approval', own)
    expect(acts.find((a) => a.id === 'approve')!.blocked).toMatch(/quyền duyệt/)
    expect(acts.find((a) => a.id === 'reject')!.blocked).toMatch(/quyền duyệt/)
    expect(acts.find((a) => a.id === 'withdraw')!.blocked).toBeUndefined()
  })
})

describe('lỗ hổng màn cũ được lấp', () => {
  it('Rút về nháp có mặt ở bước chờ duyệt và gọi đúng route withdraw', () => {
    const w = actionsFor('pending_approval', own).find((a) => a.id === 'withdraw')!
    expect(w.build!({ id: 'p', reason: '', date: '' })).toEqual([
      { path: '/api/dept/supply/pos/p/withdraw', method: 'POST' },
    ])
  })

  it('Nhân bản có mặt ở nháp, đã duyệt, đang về, đã đóng', () => {
    for (const s of ['draft', 'approved', 'ordered', 'received', 'cancelled'] as const) {
      expect(actionsFor(s, own).some((a) => a.id === 'duplicate')).toBe(true)
    }
  })
})

describe('route — không mở đường ghi mới', () => {
  it('mọi route đều thuộc tập màn chi tiết đang dùng', () => {
    const allowed = new Set([
      '/api/doc-notes',
      '/api/dept/supply/pos/p',
      '/api/dept/supply/pos/p/submit',
      '/api/dept/supply/pos/p/withdraw',
      '/api/dept/supply/pos/p/decide',
      '/api/dept/supply/pos/p/advance',
      '/api/dept/supply/pos/p/reschedule',
    ])
    for (const s of PO_STATUSES) {
      for (const a of actionsFor(s, boss)) {
        for (const c of a.build?.({ id: 'p', reason: 'r', date: '2026-09-20' }) ?? []) {
          expect(allowed.has(c.path)).toBe(true)
        }
      }
    }
  })

  it('từ chối gửi lý do; duyệt thì không', () => {
    const acts = actionsFor('pending_approval', boss)
    expect(acts.find((a) => a.id === 'reject')!.build!({ id: 'p', reason: 'thiếu giá', date: '' })[0].body) // prettier-ignore
      .toEqual({ decision: 'reject', reason: 'thiếu giá' })
    expect(acts.find((a) => a.id === 'approve')!.build!({ id: 'p', reason: '', date: '' })[0].body) // prettier-ignore
      .toEqual({ decision: 'approve' })
  })

  it('ghi việc đã giục: ghi chú trước, dời hẹn sau và chỉ khi có ngày', () => {
    const n = actionsFor('ordered', own).find((a) => a.id === 'nudge')!
    expect(n.build!({ id: 'p', reason: 'gọi rồi', date: '' }).map((c) => c.path)).toEqual(['/api/doc-notes']) // prettier-ignore
    expect(
      n.build!({ id: 'p', reason: 'gọi rồi', date: '2026-09-20' }).map((c) => c.path),
    ).toEqual([
      // prettier-ignore
      '/api/doc-notes',
      '/api/dept/supply/pos/p/reschedule',
    ])
  })

  it('đổi hẹn giao khoá đúng theo canReschedule', () => {
    expect(
      actionsFor('approved', own).find((a) => a.id === 'reschedule')!.blocked,
    ).toBeUndefined()
    // Đã nhận đủ / đã huỷ không có nút đổi hẹn (không xuất hiện) — kiểm gián tiếp:
    expect(actionsFor('received', own).some((a) => a.id === 'reschedule')).toBe(false)
  })
})

describe('bulkActionFor — cùng bước mới làm hàng loạt', () => {
  it('khác bước thì trả lý do chứ không trả nút', () => {
    const r = bulkActionFor([{ status: 'draft', own: true }, { status: 'approved', own: true }], boss) // prettier-ignore
    expect('reason' in r && r.reason).toMatch(/không cùng một bước/)
  })

  it('cùng bước nháp, đều của mình → Gửi duyệt', () => {
    const r = bulkActionFor([{ status: 'draft', own: true }, { status: 'draft', own: true }], own) // prettier-ignore
    expect('action' in r && r.action.id).toBe('submit')
  })

  it('có một đơn không phải của mình → bị khoá kèm lý do', () => {
    const r = bulkActionFor([{ status: 'draft', own: true }, { status: 'draft', own: false }], own) // prettier-ignore
    expect('reason' in r && r.reason).toMatch(/người khác phụ trách/)
  })

  it('chờ duyệt mà không có quyền duyệt → lý do quyền', () => {
    const r = bulkActionFor([{ status: 'pending_approval', own: true }], own)
    expect('reason' in r && r.reason).toMatch(/quyền duyệt/)
  })

  it('đang về không có việc hàng loạt', () => {
    const r = bulkActionFor([{ status: 'ordered', own: true }], boss)
    expect('reason' in r).toBe(true)
  })
})
