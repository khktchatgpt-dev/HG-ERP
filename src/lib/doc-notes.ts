import { z } from 'zod'

/**
 * GHI CHÚ TRAO ĐỔI TRÊN CHỨNG TỪ.
 *
 * Chứng từ đã có DÒNG THỜI GIAN — thứ MÁY ghi (duyệt lúc nào, ai gửi NCC).
 * Tệp này lo thứ NGƯỜI viết: "NCC báo trễ 3 ngày, đã gọi xác nhận với chị Hoa".
 *
 * Không có nó thì mọi trao đổi nằm trên Zalo và ba tháng sau không ai tra ra —
 * đo được: 66/68 đơn nằm im 5-7 ngày mà không dòng nào giải thích vì sao.
 */

/** Loại chứng từ mang được ghi chú. Thêm loại mới KHÔNG phải chạy migration. */
export const DOC_TYPES = ['po', 'lsx', 'receipt', 'quote'] as const
export type DocType = (typeof DOC_TYPES)[number]

export const DOC_TYPE_LABEL: Record<DocType, string> = {
  po: 'Đơn đặt vật tư',
  lsx: 'Lệnh sản xuất',
  receipt: 'Phiếu nhập kho',
  quote: 'Báo giá',
}

/**
 * NGƯỜI ĐỌC ĐƯỢC GHI CHÚ.
 *
 * Tách hai loại là bắt buộc, không phải cho đẹp: gộp một ô thì sớm muộn có
 * người gõ "thằng này giao hàng như mèo mửa" rồi bấm gửi cho chính NCC đó.
 */
export const AUDIENCES = ['internal', 'partner'] as const
export type Audience = (typeof AUDIENCES)[number]

export const AUDIENCE_LABEL: Record<Audience, string> = {
  internal: 'Nội bộ',
  partner: 'Gửi nhà cung cấp',
}

/** Câu nhắc dưới ô nhập — nói HỆ QUẢ, không nói tên trường. */
export const AUDIENCE_HINT: Record<Audience, string> = {
  internal: 'Chỉ người trong công ty đọc được.',
  partner: 'Nội dung đã hoặc sẽ gửi ra ngoài — viết như đang nói với họ.',
}

export type DocNote = {
  id: string
  doc_type: DocType
  doc_id: string
  author_id: string
  author_name: string | null
  audience: Audience
  body: string
  reply_to: string | null
  created_at: string
  deleted_at: string | null
}

/**
 * Ô nhập ghi chú.
 *
 * `max` 2000: dài hơn thế là tài liệu, thuộc về tệp đính kèm chứ không phải
 * một dòng trao đổi. Chặn ở đây để ô nhập không thành nơi dán cả email.
 */
export const docNoteCreateSchema = z.object({
  doc_type: z.enum(DOC_TYPES),
  doc_id: z.string().uuid(),
  audience: z.enum(AUDIENCES).default('internal'),
  body: z.string().trim().min(1, 'Ghi chú trống').max(2000, 'Ghi chú quá dài'),
  reply_to: z.string().uuid().nullable().optional(),
})

export type DocNoteCreate = z.infer<typeof docNoteCreateSchema>

/**
 * NGƯỜI THEO DÕI SUY RA TỰ ĐỘNG.
 *
 * Bắt người dùng tự bấm "theo dõi" thì không ai bấm và tính năng chết. Ba vai
 * dưới đây là người ĐÃ CHẠM vào chứng từ — họ có lý do để biết chuyện gì xảy
 * ra tiếp theo, không cần hỏi.
 *
 * Trả về danh sách đã lọc trùng và bỏ giá trị rỗng.
 */
export function deriveFollowers(doc: {
  created_by?: string | null
  assigned_to?: string | null
  approved_by?: string | null
}): string[] {
  return [...new Set([doc.created_by, doc.assigned_to, doc.approved_by])].filter(
    (x): x is string => !!x,
  )
}

/**
 * AI ĐƯỢC BÁO khi có ghi chú mới.
 *
 * Ba luật, theo đúng thứ tự:
 *   1. Không báo cho chính người vừa viết — họ biết rồi.
 *   2. Người đã CHỦ ĐỘNG bỏ theo dõi (`muted_at`) thì không gắn lại. Thiếu luật
 *      này thì mỗi lần ai đó đụng vào đơn, hệ thống lại lôi họ vào — và người
 *      dùng học được rằng nút "bỏ theo dõi" là nói dối.
 *   3. Ghi chú `partner` vẫn báo nội bộ như thường: nó nói cho người trong
 *      công ty biết mình vừa gửi gì ra ngoài.
 */
export function notifyTargets(
  followers: { user_id: string; muted_at: string | null }[],
  authorId: string,
): string[] {
  return followers
    .filter((f) => f.user_id !== authorId && !f.muted_at)
    .map((f) => f.user_id)
}

/**
 * GỘP GHI CHÚ VÀ MỐC MÁY GHI THÀNH MỘT DÒNG.
 *
 * Để hai tab riêng thì người đọc phải đọc hai lần rồi tự ghép thứ tự trong
 * đầu — mà thứ tự mới là thứ giải thích được chuyện gì đã xảy ra: "gửi duyệt
 * 03/09 → ghi chú 'GĐ đi công tác' 04/09 → duyệt 08/09" chỉ có nghĩa khi ba
 * dòng nằm cạnh nhau.
 *
 * Ghi chú đã xoá KHÔNG lọt vào dòng gộp — nhưng vẫn còn trong DB.
 */
export type StreamItem =
  | { kind: 'mark'; at: string; key: string; label: string; actor?: string | null }
  | { kind: 'note'; at: string; note: DocNote }

export function mergeStream(
  marks: { key: string; at: string | null; label: string; actor?: string | null }[],
  notes: DocNote[],
): StreamItem[] {
  const items: StreamItem[] = [
    ...marks
      .filter((m): m is typeof m & { at: string } => !!m.at)
      .map((m) => ({
        kind: 'mark' as const,
        at: m.at,
        key: m.key,
        label: m.label,
        actor: m.actor,
      })),
    ...notes
      .filter((n) => !n.deleted_at)
      .map((n) => ({ kind: 'note' as const, at: n.created_at, note: n })),
  ]
  // Mới nhất TRƯỚC: người mở chứng từ hỏi "vừa có chuyện gì", không hỏi "hồi
  // đầu ra sao". Muốn đọc từ đầu thì cuộn xuống — rẻ hơn là bắt mọi người cuộn
  // xuống mỗi lần mở.
  return items.sort((a, b) => b.at.localeCompare(a.at))
}
