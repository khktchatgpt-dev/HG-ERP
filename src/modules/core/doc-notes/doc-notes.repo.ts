import { db } from '@/server/db'
import type { Audience, DocNote, DocType } from '@/lib/doc-notes'

/**
 * ĐỌC/GHI GHI CHÚ TRAO ĐỔI TRÊN CHỨNG TỪ.
 *
 * Đặt ở `modules/core/` chứ không ở `dept/supply/`: ghi chú dùng cho MỌI loại
 * chứng từ của mọi phòng (đơn đặt, lệnh sản xuất, phiếu kho, báo giá). Nhét
 * vào một phòng thì phòng thứ hai sẽ chép sang, và hai bản bắt đầu lệch.
 */

export type FollowerRow = { user_id: string; muted_at: string | null; source: string }

/** Lỗi 'cột chưa có' (42703) — DB chưa áp migration mới hơn code (0218). */
function isMissingColumn(e: { code?: string; message?: string }): boolean {
  return e.code === '42703' || /does not exist/.test(e.message ?? '')
}

export const docNotesRepo = {
  /**
   * Mọi ghi chú của một chứng từ, MỚI NHẤT TRƯỚC.
   *
   * Trả cả bản đã xoá — tầng trên tự lọc. Lý do: trang kiểm toán cần thấy
   * "đã có một ghi chú bị xoá ở đây" chứ không phải một khoảng trống im lặng.
   */
  async list(docType: DocType, docId: string): Promise<DocNote[]> {
    const { data, error } = await db()
      .from('doc_notes')
      .select('*, author:users!doc_notes_author_id_fkey(name)')
      .eq('doc_type', docType)
      .eq('doc_id', docId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((r) => {
      const { author, ...rest } = r as Record<string, unknown> & {
        author: { name: string | null } | null
      }
      return { ...rest, author_name: author?.name ?? null } as DocNote
    })
  },

  /**
   * `authorName` truyền vào chứ không join lại: người vừa viết CHÍNH LÀ người
   * đang đăng nhập, tên đã nằm sẵn trong phiên. Join thêm một lượt chỉ để lấy
   * cái tên mình vừa cầm trong tay là phí một vòng gọi DB trên đường ghi.
   */
  async create(
    input: {
      doc_type: DocType
      doc_id: string
      author_id: string
      audience: Audience
      body: string
      reply_to?: string | null
      /** 0218 — 'question' cho câu hỏi của Giám đốc; bỏ trống = ghi chú thường. */
      kind?: 'note' | 'question'
    },
    authorName: string | null,
  ): Promise<DocNote> {
    const { data, error } = await db()
      .from('doc_notes')
      .insert(input)
      .select('*')
      .single()
    if (error) throw error
    return { ...data, author_name: authorName } as DocNote
  },

  /**
   * ĐÓNG CÂU HỎI (0218). `onlyId` đóng đúng một câu (người phụ trách trả lời);
   * bỏ trống thì đóng MỌI câu còn mở của chứng từ (đơn được ký / trả lại / thu
   * hồi / huỷ — câu hỏi hết đối tượng). Trả về id + tác giả các câu vừa đóng để
   * báo người hỏi.
   */
  async resolveQuestions(
    docType: DocType,
    docId: string,
    by: string,
    how: 'answered' | 'decided' | 'closed',
    onlyId?: string,
  ): Promise<{ id: string; author_id: string }[]> {
    let q = db()
      .from('doc_notes')
      .update({
        resolved_at: new Date().toISOString(),
        resolved_by: by,
        resolved_how: how,
      })
      .eq('doc_type', docType)
      .eq('doc_id', docId)
      .eq('kind', 'question')
      .is('resolved_at', null)
      .is('deleted_at', null)
    if (onlyId) q = q.eq('id', onlyId)
    const { data, error } = await q.select('id, author_id')
    // DB chưa áp 0218 → chưa có câu hỏi nào để đóng. KHÔNG được ném: hàm này
    // nằm trên đường Duyệt / Huỷ đơn, ném ra là chặn luôn việc ký.
    if (error) {
      if (isMissingColumn(error)) return []
      throw error
    }
    return (data ?? []) as { id: string; author_id: string }[]
  },

  /**
   * Câu hỏi CÒN MỞ của nhiều chứng từ một lượt — cho hộp ký (nhãn "Đang hỏi")
   * và sổ Đơn mua. Một truy vấn cho cả trang, có index một phần ở DB.
   */
  async openQuestionsByDocs(
    docType: DocType,
    docIds: string[],
  ): Promise<Map<string, { id: string; created_at: string; author_id: string }>> {
    const out = new Map<string, { id: string; created_at: string; author_id: string }>()
    if (docIds.length === 0) return out
    const { data, error } = await db()
      .from('doc_notes')
      .select('id, doc_id, created_at, author_id')
      .eq('doc_type', docType)
      .in('doc_id', docIds)
      .eq('kind', 'question')
      .is('resolved_at', null)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    if (error) {
      if (isMissingColumn(error)) return out // chưa áp 0218 → chưa có câu hỏi
      throw error
    }
    // Giữ câu hỏi CŨ NHẤT còn mở: thời gian chờ tính từ lúc bóng sang tay người trả lời.
    for (const r of (data ?? []) as {
      id: string
      doc_id: string
      created_at: string
      author_id: string
    }[]) {
      // prettier-ignore
      if (!out.has(r.doc_id)) out.set(r.doc_id, { id: r.id, created_at: r.created_at, author_id: r.author_id }) // prettier-ignore
    }
    return out
  },

  /**
   * XOÁ MỀM. Không có `delete` cứng ở repo này — cố ý.
   *
   * Ghi chú xoá được hẳn thì nó không còn là bằng chứng: ai cũng có thể dọn
   * sạch dấu vết một quyết định sai. Gõ nhầm thì ẩn đi, dòng vẫn còn.
   */
  async softDelete(id: string, byUserId: string): Promise<void> {
    const { error } = await db()
      .from('doc_notes')
      .update({ deleted_at: new Date().toISOString(), deleted_by: byUserId })
      .eq('id', id)
      .is('deleted_at', null)
    if (error) throw error
  },

  async followers(docType: DocType, docId: string): Promise<FollowerRow[]> {
    const { data, error } = await db()
      .from('doc_followers')
      .select('user_id, muted_at, source')
      .eq('doc_type', docType)
      .eq('doc_id', docId)
    if (error) throw error
    return (data ?? []) as FollowerRow[]
  },

  /**
   * Gắn người theo dõi tự động.
   *
   * `ignoreDuplicates` chứ không phải upsert-ghi-đè: người đã CHỦ ĐỘNG bỏ theo
   * dõi (`muted_at`) không được gắn lại chỉ vì họ vừa đụng vào chứng từ. Ghi đè
   * ở đây biến nút "bỏ theo dõi" thành lời nói dối.
   */
  async addFollowers(docType: DocType, docId: string, userIds: string[]): Promise<void> {
    if (userIds.length === 0) return
    const { error } = await db()
      .from('doc_followers')
      .upsert(
        userIds.map((user_id) => ({
          doc_type: docType,
          doc_id: docId,
          user_id,
          source: 'auto',
        })),
        { onConflict: 'doc_type,doc_id,user_id', ignoreDuplicates: true },
      )
    if (error) throw error
  },

  /** Bật/tắt theo dõi thủ công. `muted_at` có giá trị = đã bỏ theo dõi. */
  async setMuted(
    docType: DocType,
    docId: string,
    userId: string,
    muted: boolean,
  ): Promise<void> {
    const { error } = await db()
      .from('doc_followers')
      .upsert(
        {
          doc_type: docType,
          doc_id: docId,
          user_id: userId,
          source: 'manual',
          muted_at: muted ? new Date().toISOString() : null,
        },
        { onConflict: 'doc_type,doc_id,user_id' },
      )
    if (error) throw error
  },

  /** Đếm ghi chú của nhiều chứng từ một lượt — cho badge trên bảng danh sách. */
  async countByDocs(docType: DocType, docIds: string[]): Promise<Map<string, number>> {
    const out = new Map<string, number>()
    if (docIds.length === 0) return out
    const { data, error } = await db()
      .from('doc_notes')
      .select('doc_id')
      .eq('doc_type', docType)
      .in('doc_id', docIds)
      .is('deleted_at', null)
    if (error) throw error
    for (const r of data ?? []) {
      const id = (r as { doc_id: string }).doc_id
      out.set(id, (out.get(id) ?? 0) + 1)
    }
    return out
  },
}
