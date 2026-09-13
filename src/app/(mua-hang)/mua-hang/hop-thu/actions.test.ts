import { describe, expect, it } from 'vitest'
import { SUPPLY_TODO } from '@/lib/supply-watch'
import { KIND_ACTION, type BuildInput } from './actions'

/**
 * Bảng nhóm-việc → lời gọi API là chỗ dễ sai nhất của màn hộp thư: gọi nhầm
 * route nghĩa là ghi nhầm vào sổ đơn thật, và giao diện thì trông vẫn bình
 * thường. Nó là logic thuần nên kiểm được không cần dựng màn.
 */

const po = { id: 'po-1', expected_at: '2026-09-05' }
const base: BuildInput = { note: 'gọi anh B', newDate: '', po }

describe('KIND_ACTION — phủ đủ mọi nhóm việc', () => {
  it('có đúng một mục cho mỗi nhóm của supply-watch', () => {
    expect(Object.keys(KIND_ACTION).sort()).toEqual(Object.keys(SUPPLY_TODO).sort())
  })

  it('mọi nhãn nút đều là câu mệnh lệnh, không phải tên trạng thái', () => {
    for (const spec of Object.values(KIND_ACTION)) {
      expect(spec.label.length).toBeGreaterThan(0)
      // Tên trạng thái của đơn tuyệt đối không được lọt lên nút.
      expect(spec.label).not.toMatch(/draft|pending|approved|ordered|partial/i)
    }
  })
})

describe('overdue — ghi việc đã giục', () => {
  it('không có ngày mới thì chỉ ghi một ghi chú, KHÔNG đụng hẹn giao', () => {
    const calls = KIND_ACTION.overdue.build(base)
    expect(calls).toHaveLength(1)
    expect(calls[0].path).toBe('/api/doc-notes')
    expect(calls[0].method).toBe('POST')
  })

  it('ghi chú mang tiền tố nhận ra được để người sau lọc vết', () => {
    const [note] = KIND_ACTION.overdue.build(base)
    const body = note.body as { body: string; doc_type: string; audience: string }
    expect(body.doc_type).toBe('po')
    expect(body.audience).toBe('internal')
    expect(body.body).toContain('[Đã giục NCC]')
    expect(body.body).toContain('gọi anh B')
  })

  it('có ngày mới thì ghi chú TRƯỚC rồi mới dời hẹn', () => {
    const calls = KIND_ACTION.overdue.build({ ...base, newDate: '2026-09-18' })
    expect(calls.map((c) => c.path)).toEqual([
      '/api/doc-notes',
      '/api/dept/supply/pos/po-1/reschedule',
    ])
    // Vết phải được ghi kể cả khi bước dời hẹn hỏng — nên nó đi trước.
    expect(calls[1].body).toEqual({ expected_at: '2026-09-18', reason: 'gọi anh B' })
  })
})

describe('unsent — gửi nhà cung cấp', () => {
  it('một lời gọi advance sang ordered, không hỏi gì thêm', () => {
    expect(KIND_ACTION.unsent.kindOfUi).toBe('direct')
    const calls = KIND_ACTION.unsent.build(base)
    expect(calls).toEqual([
      {
        path: '/api/dept/supply/pos/po-1/advance',
        method: 'POST',
        body: { to: 'ordered' },
      },
    ])
  })
})

describe('no_eta — chốt ngày giao', () => {
  it('bắt buộc cả ngày lẫn lý do', () => {
    expect(KIND_ACTION.no_eta.needDate).toBe(true)
    expect(KIND_ACTION.no_eta.needNote).toBe(true)
  })

  it('gọi đúng route reschedule với ngày người dùng khai', () => {
    const calls = KIND_ACTION.no_eta.build({ ...base, newDate: '2026-09-20' })
    expect(calls).toEqual([
      {
        path: '/api/dept/supply/pos/po-1/reschedule',
        method: 'POST',
        body: { expected_at: '2026-09-20', reason: 'gọi anh B' },
      },
    ])
  })
})

describe('partial — việc nguy hiểm, không làm tắt', () => {
  it('chỉ mở đơn, không phát sinh lời gọi ghi nào', () => {
    expect(KIND_ACTION.partial.kindOfUi).toBe('link')
    expect(KIND_ACTION.partial.build(base)).toEqual([])
  })
})

describe('draft — gửi Giám đốc duyệt', () => {
  it('gọi submit, KHÔNG tự kiểm điều kiện ở client', () => {
    const calls = KIND_ACTION.draft.build(base)
    expect(calls).toEqual([{ path: '/api/dept/supply/pos/po-1/submit', method: 'POST' }])
  })

  it('nói trước hệ quả vì gửi rồi thì không sửa được', () => {
    expect(KIND_ACTION.draft.consequence).toBeTruthy()
  })
})

describe('không mở đường ghi mới', () => {
  it('mọi route đều nằm trong tập màn chi tiết đơn đang dùng', () => {
    const allowed = [
      '/api/doc-notes',
      '/api/dept/supply/pos/po-1/advance',
      '/api/dept/supply/pos/po-1/reschedule',
      '/api/dept/supply/pos/po-1/submit',
    ]
    const used = Object.values(KIND_ACTION).flatMap((s) =>
      s.build({ ...base, newDate: '2026-09-18' }).map((c) => c.path),
    )
    for (const p of used) expect(allowed).toContain(p)
  })
})
