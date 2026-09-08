import { describe, expect, it } from 'vitest'
import {
  deriveFollowers,
  docNoteCreateSchema,
  mergeStream,
  notifyTargets,
  type DocNote,
} from './doc-notes'

/*
  Dùng UUID THẬT (PO-2026-0065) chứ không phải '1111-...': Zod 4 kiểm cả bit
  phiên bản và biến thể, nên chuỗi toàn số 1 trượt `.uuid()` — test đỏ vì dữ
  liệu giả sai, không phải vì code sai.
*/
const NOTE = (over: Partial<DocNote> = {}): DocNote => ({
  id: 'n1',
  doc_type: 'po',
  doc_id: 'c658703c-1f39-4c28-9223-5dfd6062345b',
  author_id: 'u-nga',
  author_name: 'Nga',
  audience: 'internal',
  body: 'NCC báo trễ 3 ngày',
  reply_to: null,
  created_at: '2026-09-05T10:00:00Z',
  deleted_at: null,
  ...over,
})

describe('docNoteCreateSchema', () => {
  it('nhận ghi chú hợp lệ, mặc định là nội bộ', () => {
    const r = docNoteCreateSchema.parse({
      doc_type: 'po',
      doc_id: 'c658703c-1f39-4c28-9223-5dfd6062345b',
      body: 'Đã gọi xác nhận với chị Hoa',
    })
    // Mặc định phải là 'internal': lỡ tay gửi ra ngoài nguy hiểm hơn lỡ tay
    // giữ trong nhà.
    expect(r.audience).toBe('internal')
  })

  it('chặn ghi chú trống hoặc chỉ có khoảng trắng', () => {
    for (const body of ['', '   ', '\n\t']) {
      expect(() =>
        docNoteCreateSchema.parse({
          doc_type: 'po',
          doc_id: 'c658703c-1f39-4c28-9223-5dfd6062345b',
          body,
        }),
      ).toThrow()
    }
  })

  it('cắt khoảng trắng thừa hai đầu', () => {
    const r = docNoteCreateSchema.parse({
      doc_type: 'po',
      doc_id: 'c658703c-1f39-4c28-9223-5dfd6062345b',
      body: '  đã gọi NCC  ',
    })
    expect(r.body).toBe('đã gọi NCC')
  })

  it('chặn ghi chú dài quá 2000 — đó là tài liệu, không phải trao đổi', () => {
    expect(() =>
      docNoteCreateSchema.parse({
        doc_type: 'po',
        doc_id: 'c658703c-1f39-4c28-9223-5dfd6062345b',
        body: 'x'.repeat(2001),
      }),
    ).toThrow()
  })

  it('chỉ nhận hai mức người đọc đã khai', () => {
    expect(() =>
      docNoteCreateSchema.parse({
        doc_type: 'po',
        doc_id: 'c658703c-1f39-4c28-9223-5dfd6062345b',
        body: 'x',
        audience: 'public',
      }),
    ).toThrow()
  })
})

describe('deriveFollowers', () => {
  it('gom người soạn, người phụ trách, người duyệt', () => {
    expect(
      deriveFollowers({ created_by: 'a', assigned_to: 'b', approved_by: 'c' }).sort(),
    ).toEqual(['a', 'b', 'c'])
  })

  it('không nhân đôi khi một người giữ nhiều vai', () => {
    expect(deriveFollowers({ created_by: 'a', assigned_to: 'a' })).toEqual(['a'])
  })

  it('bỏ qua vai còn trống', () => {
    expect(deriveFollowers({ created_by: 'a', assigned_to: null })).toEqual(['a'])
    expect(deriveFollowers({})).toEqual([])
  })
})

describe('notifyTargets', () => {
  const F = (id: string, muted: string | null = null) => ({
    user_id: id,
    muted_at: muted,
  })

  it('không báo cho chính người vừa viết', () => {
    expect(notifyTargets([F('a'), F('b')], 'a')).toEqual(['b'])
  })

  it('KHÔNG lôi lại người đã chủ động bỏ theo dõi', () => {
    // Thiếu luật này thì nút "bỏ theo dõi" là nói dối: mỗi lần ai đó đụng
    // vào đơn, hệ thống lại gắn họ vào.
    expect(notifyTargets([F('a'), F('b', '2026-09-01T00:00:00Z')], 'x')).toEqual(['a'])
  })

  it('ghi chú gửi NCC vẫn báo cho người nội bộ', () => {
    // Nó nói cho người trong công ty biết mình vừa gửi gì ra ngoài.
    expect(notifyTargets([F('a'), F('b')], 'b')).toEqual(['a'])
  })

  it('không ai theo dõi thì không báo ai', () => {
    expect(notifyTargets([], 'a')).toEqual([])
  })
})

describe('mergeStream', () => {
  const MARKS = [
    { key: 'created', at: '2026-09-03T12:00:00Z', label: 'Soạn đơn', actor: 'Nga' },
    { key: 'submitted', at: '2026-09-03T15:00:00Z', label: 'Gửi GĐ duyệt' },
    // Mốc chưa xảy ra — không được lọt vào dòng gộp.
    { key: 'approved', at: null, label: 'Giám đốc duyệt' },
  ]

  it('trộn ghi chú với mốc máy ghi, mới nhất trước', () => {
    const s = mergeStream(MARKS, [NOTE({ created_at: '2026-09-04T09:00:00Z' })])
    expect(s.map((x) => x.at)).toEqual([
      '2026-09-04T09:00:00Z',
      '2026-09-03T15:00:00Z',
      '2026-09-03T12:00:00Z',
    ])
    expect(s[0].kind).toBe('note')
  })

  it('mốc chưa xảy ra không lọt vào dòng gộp', () => {
    const s = mergeStream(MARKS, [])
    expect(s).toHaveLength(2)
    expect(s.some((x) => x.kind === 'mark' && x.key === 'approved')).toBe(false)
  })

  it('ghi chú đã xoá không hiện, dù vẫn còn trong DB', () => {
    const s = mergeStream([], [NOTE({ deleted_at: '2026-09-06T00:00:00Z' })])
    expect(s).toHaveLength(0)
  })

  it('thứ tự đúng khi ghi chú xen giữa hai mốc', () => {
    // Chính thứ tự này mới giải thích được chuyện gì đã xảy ra:
    // gửi duyệt -> "GĐ đi công tác" -> duyệt.
    const s = mergeStream(MARKS, [NOTE({ created_at: '2026-09-03T13:30:00Z' })])
    expect(s.map((x) => (x.kind === 'note' ? 'note' : x.key))).toEqual([
      'submitted',
      'note',
      'created',
    ])
  })

  it('không có gì thì trả mảng rỗng, không nổ', () => {
    expect(mergeStream([], [])).toEqual([])
  })
})
