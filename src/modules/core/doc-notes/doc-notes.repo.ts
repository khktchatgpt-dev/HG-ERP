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
  async addFollowers(
    docType: DocType,
    docId: string,
    userIds: string[],
  ): Promise<void> {
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
  async countByDocs(
    docType: DocType,
    docIds: string[],
  ): Promise<Map<string, number>> {
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
