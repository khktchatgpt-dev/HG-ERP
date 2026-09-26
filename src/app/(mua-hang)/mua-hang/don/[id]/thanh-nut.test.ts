import { describe, expect, it } from 'vitest'
import { barLayout } from './thanh-nut'

// Các việc `actionsFor` trả cho từng bước (id thật trong actions.ts).
const DOC: Record<string, string[]> = {
  draft: ['submit', 'edit', 'duplicate', 'reassign', 'delete'],
  pending_approval: ['approve', 'withdraw', 'reject', 'duplicate', 'reassign'],
  approved: ['send', 'adjust', 'edit_terms', 'reopen', 'duplicate', 'reassign', 'cancel'],
  ordered: [
    'open',
    'adjust',
    'nudge',
    'reschedule',
    'edit_terms',
    'reopen',
    'duplicate',
    'reassign',
    'cancel',
  ],
  partial: [
    'adjust',
    'nudge',
    'reschedule',
    'edit_terms',
    'duplicate',
    'reassign',
    'cancel',
  ],
  received: ['duplicate'],
  cancelled: ['duplicate'],
}
const at = (status: string) => barLayout(status, DOC[status])
const keys = (b: ReturnType<typeof barLayout>) => b.more.map((m) => m.key)

describe('barLayout — thanh hành động MỘT HÀNG theo bước của đơn', () => {
  it('nút chính là việc kế tiếp của bước', () => {
    expect(at('draft').primary).toBe('doc:submit')
    expect(at('pending_approval').primary).toBe('doc:approve')
    expect(at('approved').primary).toBe('doc:send')
    expect(at('ordered').primary).toBe('confirm')
    expect(at('partial').primary).toBe('receive')
    expect(at('received').primary).toBeNull()
  })

  it('hiện thẳng tối đa 3 việc hay làm, không lặp nút chính', () => {
    for (const s of Object.keys(DOC)) {
      const b = at(s)
      expect(b.quick.length).toBeLessThanOrEqual(3)
      expect(b.quick).not.toContain(b.primary)
    }
    expect(at('ordered').quick).toEqual(['edit', 'doc:nudge', 'print'])
    expect(at('partial').quick).toEqual(['edit', 'cost', 'print'])
    expect(at('pending_approval').quick).toEqual(['doc:withdraw', 'doc:reject', 'print'])
  })

  it('"⋯ Thêm" chứa MỌI việc còn lại, mỗi việc đúng một lần, không trùng thanh', () => {
    for (const s of Object.keys(DOC)) {
      const b = at(s)
      const shown = [b.primary, ...b.quick].filter(Boolean)
      const more = keys(b)
      expect(new Set(more).size).toBe(more.length)
      for (const k of shown) expect(more).not.toContain(k)
      // Mọi việc của actionsFor đều có chỗ (thanh hoặc menu) — không việc nào bị rơi.
      for (const id of DOC[s].filter(
        (x) => x !== 'edit' && x !== 'adjust' && x !== 'open',
      )) {
        expect([...shown, ...more]).toContain(`doc:${id}`)
      }
    }
  })

  it('huỷ / xoá đứng CUỐI menu, nhóm riêng', () => {
    const m = at('ordered').more
    expect(m.at(-1)).toMatchObject({ key: 'doc:cancel', group: 'Huỷ' })
    expect(at('draft').more.at(-1)).toMatchObject({ key: 'doc:delete', group: 'Huỷ' })
  })

  it('đơn nháp / chờ duyệt: KHÔNG bày nhóm Giao & nhận (chưa có gì để nhận)', () => {
    expect(at('draft').more.some((m) => m.group === 'Giao & nhận')).toBe(false)
    expect(at('pending_approval').more.some((m) => m.group === 'Giao & nhận')).toBe(false)
    expect(at('ordered').more.some((m) => m.group === 'Giao & nhận')).toBe(true)
  })

  it('nhóm liền nhau theo thứ tự cố định: Giao & nhận → Đơn → In & hiển thị → Huỷ', () => {
    const order = ['Giao & nhận', 'Đơn', 'In & hiển thị', 'Huỷ']
    const gs = at('ordered').more.map((m) => order.indexOf(m.group))
    expect(gs).toEqual([...gs].sort((a, b) => a - b))
  })

  it('không bày "Mở đơn" (đang ở chính đơn đó), không bày Xoá nháp ngoài đơn nháp, không bày Huỷ ở đơn nháp', () => {
    expect(keys(at('ordered'))).not.toContain('doc:open')
    expect(keys(at('ordered'))).not.toContain('doc:delete')
    expect(keys(barLayout('ordered', [...DOC.ordered, 'delete']))).not.toContain(
      'doc:delete',
    )
    expect(keys(barLayout('draft', [...DOC.draft, 'cancel']))).not.toContain('doc:cancel')
    expect(keys(at('draft'))).toContain('doc:delete')
  })

  it('đơn về đủ: KHÔNG bày nhóm Giao & nhận (việc nhận đã xong, lý do khoá sẽ nói sai); phí vẫn ghi được', () => {
    expect(at('received').more.some((m) => m.group === 'Giao & nhận')).toBe(false)
    expect(at('received').quick).toContain('cost')
  })
})
