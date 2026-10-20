import {
  deriveFollowers,
  docNoteCreateSchema,
  notifyTargets,
  type DocNote,
  type DocNoteCreate,
  type DocType,
} from '@/lib/doc-notes'
import type { User } from '@/modules/core/users/users.repo'
import { docNotesRepo } from './doc-notes.repo'

/**
 * GHI CHÚ TRAO ĐỔI — tầng nghiệp vụ.
 *
 * QUYỀN ĐỌC/GHI GHI CHÚ = QUYỀN XEM CHỨNG TỪ, không phải một quyền riêng.
 *
 * Lý do: đẻ thêm `doc_notes.create` vào bảng phân quyền thì admin phải cấp lại
 * cho từng người, và trong lúc chưa ai cấp thì tính năng nằm im — mọi người
 * tiếp tục nhắn Zalo. Ai mở được chứng từ thì nói được về chứng từ đó; đó cũng
 * là cách Odoo làm.
 *
 * Người gọi chịu trách nhiệm đã kiểm quyền xem chứng từ TRƯỚC khi vào đây —
 * service này không tự đi tra từng loại chứng từ (nó phục vụ cả 4 loại).
 */

export const docNotesService = {
  async list(_user: User, docType: DocType, docId: string): Promise<DocNote[]> {
    const rows = await docNotesRepo.list(docType, docId)
    // Bản đã xoá KHÔNG ra khỏi service. Repo trả cả để trang kiểm toán dùng
    // riêng nếu cần, còn màn nghiệp vụ thì không.
    return rows.filter((n) => !n.deleted_at)
  },

  /**
   * Thêm ghi chú.
   *
   * `followerSeed` là ba vai của chứng từ (soạn / phụ trách / duyệt) do người
   * gọi truyền vào — service không biết cấu trúc của từng loại chứng từ. Người
   * viết cũng được gắn theo dõi: viết vào một chứng từ nghĩa là quan tâm nó.
   */
  async create(
    user: User,
    input: DocNoteCreate,
    followerSeed: {
      created_by?: string | null
      assigned_to?: string | null
      approved_by?: string | null
    } = {},
  ): Promise<{ note: DocNote; notify: string[] }> {
    const parsed = docNoteCreateSchema.parse(input)

    const note = await docNotesRepo.create(
      {
        doc_type: parsed.doc_type,
        doc_id: parsed.doc_id,
        author_id: user.id,
        audience: parsed.audience,
        body: parsed.body,
        reply_to: parsed.reply_to ?? null,
      },
      user.name ?? null,
    )

    await docNotesRepo.addFollowers(parsed.doc_type, parsed.doc_id, [
      ...deriveFollowers(followerSeed),
      user.id,
    ])

    const followers = await docNotesRepo.followers(parsed.doc_type, parsed.doc_id)
    return { note, notify: notifyTargets(followers, user.id) }
  },

  /**
   * Xoá mềm — CHỈ tác giả, hoặc admin.
   *
   * Trưởng phòng KHÔNG xoá được ghi chú của nhân viên: ghi chú là lời của một
   * người cụ thể, và một hệ thống cho phép cấp trên gỡ lời cấp dưới thì không
   * ai dám viết gì thật nữa.
   */
  async remove(user: User, note: DocNote): Promise<void> {
    if (note.author_id !== user.id && user.role !== 'admin') {
      throw new Error('Chỉ người viết mới gỡ được ghi chú của mình')
    }
    await docNotesRepo.softDelete(note.id, user.id)
  },

  async setMuted(
    user: User,
    docType: DocType,
    docId: string,
    muted: boolean,
  ): Promise<void> {
    await docNotesRepo.setMuted(docType, docId, user.id, muted)
  },

  countByDocs: docNotesRepo.countByDocs,
}
