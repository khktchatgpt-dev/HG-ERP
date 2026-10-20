import { describe, expect, it } from 'vitest'
import { buildFeedbackMarkdown } from './feedback.export'
import type { FeedbackCommentRow, FeedbackRow } from './feedback.repo'

const row = (over: Partial<FeedbackRow>): FeedbackRow => ({
  id: 'f1',
  kind: 'system',
  type: 'bug',
  severity: 'blocking',
  title: 'Nút lưu bị mờ',
  content: 'Ở màn đơn hàng, bấm lưu không được.',
  page_url: '/sales/orders/1',
  page_title: 'Đơn hàng',
  is_private: false,
  topic: 'sales',
  status: 'done',
  reopen_count: 1,
  reopened_at: null,
  confirmed_ok_at: null,
  gate_passed_at: null,
  reviewed_by: null,
  reviewed_at: null,
  returned_reason: null,
  returned_at: null,
  submitted_at: '2026-10-01T00:00:00Z',
  admin_reply: 'Đã sửa, F5 lại nhé',
  admin_reply_by: 'adm',
  admin_replied_at: '2026-10-02T00:00:00Z',
  done_at: '2026-10-02T00:00:00Z',
  created_by: 'u1',
  department_id: 'd1',
  file_ids: [],
  edited_at: null,
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-02T00:00:00Z',
  ...over,
})

describe('buildFeedbackMarkdown', () => {
  it('mỗi góp ý một mục, có phân loại, người viết, trả lời và luồng trao đổi', () => {
    const comments = new Map<string, FeedbackCommentRow[]>([
      [
        'f1',
        [
          {
            id: 'c1',
            feedback_id: 'f1',
            kind: 'comment',
            content: 'Em cũng bị\nở máy khác',
            author_id: 'u2',
            is_admin: false,
            round: 0,
            from_status: null,
            to_status: null,
            file_ids: [],
            mention_ids: [],
            edited_at: null,
            created_at: '2026-10-01T05:00:00Z',
          },
          {
            id: 'c2',
            feedback_id: 'f1',
            kind: 'status',
            content: null,
            author_id: 'adm',
            is_admin: true,
            round: 0,
            from_status: 'new',
            to_status: 'done',
            file_ids: [],
            mention_ids: [],
            edited_at: null,
            created_at: '2026-10-02T00:00:00Z',
          },
        ],
      ],
    ])
    const md = buildFeedbackMarkdown({
      items: [
        row({}),
        row({
          id: 'f2',
          title: 'Ý tưởng',
          kind: 'operation',
          type: 'idea',
          status: 'new',
          admin_reply: null,
          severity: 'nice',
          reopen_count: 0,
        }),
      ],
      comments,
      names: new Map([
        ['u1', 'Hoa'],
        ['u2', 'An'],
        ['adm', 'Kiên'],
      ]),
      departments: new Map([['d1', 'Bán hàng']]),
      votes: new Map([['f1', ['u2', 'u3']]]),
      days: 90,
      now: new Date('2026-10-20T03:00:00Z'),
    })
    expect(md).toContain('# Góp ý hệ thống — 90 ngày gần đây')
    expect(md).toContain('2 góp ý')
    expect(md).toContain('- Đã đẩy online: 1')
    expect(md).toContain('## Nút lưu bị mờ')
    expect(md).toContain('_Hệ thống · Lỗi · Chặn việc · Đã đẩy online · chủ đề: Bán hàng · mở lại 1 lần · 2 người cũng gặp_')
    expect(md).toContain('Người viết: Hoa (Bán hàng) · 2026-10-01 · trang: Đơn hàng /sales/orders/1')
    expect(md).toContain('**Trả lời (Kiên, 2026-10-02):** Đã sửa, F5 lại nhé')
    expect(md).toContain('- 2026-10-01 · An: Em cũng bị ở máy khác')
    expect(md).toContain('- 2026-10-02 · Kiên đổi trạng thái → Đã đẩy online')
    expect(md).toContain('## Ý tưởng')
    expect(md).toContain('_Vận hành · Ý tưởng · Có thì tốt · Yêu cầu mới · chủ đề: Bán hàng_')
  })
})
