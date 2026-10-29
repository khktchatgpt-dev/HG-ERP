import { db } from '@/server/db'
import type { DocType } from '@/lib/doc-notes'
import type { DocRequest, RequestTab, transitionPatch } from '@/lib/doc-requests'

/**
 * ĐỌC/GHI YÊU CẦU VIỆC (0281) — dòng `doc_notes` kind = 'request'.
 *
 * Repo riêng chứ không nhét vào `docNotesRepo`: ghi chú thường không bao giờ được
 * sửa (giá trị nằm ở chỗ không đổi được), còn yêu cầu thì đổi trạng thái — tách hai
 * file để không ai lỡ tay dùng `applyPatch` lên một ghi chú thường. Mọi lệnh ghi ở
 * đây đều lọc `kind = 'request'`.
 */

const SELECT =
  '*, author:users!doc_notes_author_id_fkey(name), assignee:users!doc_notes_assignee_id_fkey(name)'

type Row = Record<string, unknown> & {
  author: { name: string | null } | null
  assignee: { name: string | null } | null
}

function toRequest(r: Row): DocRequest {
  const { author, assignee, ...rest } = r
  return {
    ...rest,
    author_name: author?.name ?? null,
    assignee_name: assignee?.name ?? null,
  } as DocRequest
}

/** Lỗi 'cột chưa có' (42703) — DB chưa áp 0281. */
function isMissingColumn(e: { code?: string; message?: string }): boolean {
  return e.code === '42703' || /does not exist/.test(e.message ?? '')
}

export const docRequestsRepo = {
  async create(input: {
    doc_type: DocType
    doc_id: string
    author_id: string
    assignee_id: string
    due_on: string | null
    body: string
  }): Promise<DocRequest> {
    const { data, error } = await db()
      .from('doc_notes')
      .insert({ ...input, kind: 'request', audience: 'internal' })
      .select(SELECT)
      .single()
    if (error) throw error
    return toRequest(data as unknown as Row)
  },

  async findById(id: string): Promise<DocRequest | null> {
    const { data, error } = await db()
      .from('doc_notes')
      .select(SELECT)
      .eq('id', id)
      .eq('kind', 'request')
      .maybeSingle()
    if (error) throw error
    return data ? toRequest(data as unknown as Row) : null
  },

  /**
   * GHI CÓ ĐIỀU KIỆN: chỉ đổi khi yêu cầu còn đúng trạng thái `expect`. Trả null
   * = có người khác vừa đổi trước (hai người bấm cùng lúc) — tầng trên báo
   * Conflict thay vì lặng lẽ ghi đè việc người kia vừa làm.
   */
  async applyPatch(
    id: string,
    expect: ReturnType<typeof transitionPatch>['expect'],
    patch: ReturnType<typeof transitionPatch>['patch'],
  ): Promise<DocRequest | null> {
    let q = db()
      .from('doc_notes')
      .update(patch)
      .eq('id', id)
      .eq('kind', 'request')
      .is('deleted_at', null)
    q = expect === 'open' ? q.is('resolved_at', null) : q.eq('resolved_how', 'done')
    const { data, error } = await q.select(SELECT).maybeSingle()
    if (error) throw error
    return data ? toRequest(data as unknown as Row) : null
  },

  /**
   * Yêu cầu của một người: `assigned` = giao cho tôi, `given` = tôi đã giao.
   * Lấy mọi yêu cầu còn mở + yêu cầu đóng từ `closedSince` — phần lọc theo chip
   * làm ở `matchesFilter` để chip đếm và danh sách dùng chung một phép.
   */
  async listForUser(
    tab: RequestTab,
    userId: string,
    closedSince: string,
  ): Promise<DocRequest[]> {
    const { data, error } = await db()
      .from('doc_notes')
      .select(SELECT)
      .eq('kind', 'request')
      .is('deleted_at', null)
      .eq(tab === 'assigned' ? 'assignee_id' : 'author_id', userId)
      .or(`resolved_at.is.null,resolved_at.gte.${closedSince}`)
      .order('created_at', { ascending: false })
      .limit(500)
    if (error) {
      if (isMissingColumn(error)) return [] // chưa áp 0281 → chưa có yêu cầu nào
      throw error
    }
    return ((data ?? []) as unknown as Row[]).map(toRequest)
  },

  /**
   * ĐÓNG mọi yêu cầu còn mở của một chứng từ vừa bị huỷ. Trả các yêu cầu vừa đóng
   * để báo người nhận. DB chưa áp 0281 thì không có gì để đóng — KHÔNG ném: hàm
   * này nằm trên đường Huỷ đơn / Huỷ lệnh.
   */
  async closeOpenByDoc(
    docType: DocType,
    docId: string,
    by: string,
  ): Promise<{ id: string; author_id: string; assignee_id: string; body: string }[]> {
    const { data, error } = await db()
      .from('doc_notes')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: by,
        resolved_how: 'closed',
      })
      .eq('doc_type', docType)
      .eq('doc_id', docId)
      .eq('kind', 'request')
      .is('resolved_at', null)
      .is('deleted_at', null)
      .select('id, author_id, assignee_id, body')
    if (error) {
      if (isMissingColumn(error)) return []
      throw error
    }
    return (data ?? []) as {
      id: string
      author_id: string
      assignee_id: string
      body: string
    }[]
  },
}
