import { z } from 'zod'
import { todayVn } from './date-vn'
import type { DocNote } from './doc-notes'

/**
 * YÊU CẦU VIỆC TRÊN CHỨNG TỪ (0281) — luật thuần, không chạm DB.
 *
 * Quản lý Cung ứng xin 29/10/2026 "mục yêu cầu công việc để các bạn thấy và làm
 * tiếp". Bản vẽ: https://claude.ai/artifact/HkyxtrrXDMwzfLiJVH6ZMC. Chủ dự án chốt:
 *   C1 giao được cho người phòng nào cũng được
 *   C2 bắt buộc gắn một đơn mua hoặc lệnh SX
 *   C3 một người nhận — cần hai người thì hai yêu cầu, để luôn rõ ai giữ bóng
 *   C4 báo xong bắt một câu kết quả
 *   C5 ai xem được chứng từ thì giao được (đúng luật ghi chú)
 *
 * Yêu cầu là một `doc_notes` kind = 'request' — bản tổng quát của câu hỏi GĐ
 * (0218). Vì sao không dùng bảng `tasks`: module Việc đã chết (22 việc, việc cuối
 * 26/06/2026), còn ô ghi chú trên đơn mua có 93 ghi chú / 30 ngày.
 *
 * Mọi bước (báo xong, mở lại, chuyển, huỷ) để lại một ghi chú thường TRẢ LỜI yêu
 * cầu (`reply_to`) — đọc chứng từ là thấy cả chuyện, không cần bảng sự kiện.
 */

/** C2 — loại chứng từ mang được yêu cầu việc. */
export const REQUEST_DOC_TYPES = ['po', 'lsx'] as const
export type RequestDocType = (typeof REQUEST_DOC_TYPES)[number]

/** Yêu cầu = ghi chú kind 'request' đã có người nhận. */
export type DocRequest = DocNote & {
  kind: 'request'
  assignee_id: string
  assignee_name: string | null
  due_on: string | null
}

export type RequestState = 'open' | 'done' | 'cancelled' | 'closed'

export const REQUEST_STATE_LABEL: Record<RequestState, string> = {
  open: 'Đang mở',
  done: 'Đã xong',
  cancelled: 'Đã huỷ',
  closed: 'Đóng theo chứng từ',
}

export function requestState(
  r: Pick<DocNote, 'resolved_at' | 'resolved_how'>,
): RequestState {
  if (!r.resolved_at) return 'open'
  if (r.resolved_how === 'done') return 'done'
  if (r.resolved_how === 'cancelled') return 'cancelled'
  return 'closed'
}

/** Số ngày giữa hai ngày 'YYYY-MM-DD' (b − a). */
function daysBetween(a: string, b: string): number {
  const ms = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
  return Math.round((ms(b) - ms(a)) / 86_400_000)
}

/**
 * Quá hạn mấy ngày. 0 = không quá hạn (chưa tới hạn, không hạn, hoặc đã đóng).
 * Quá hạn là NHÃN suy ra, không phải trạng thái — không ai phải bấm gì để nó hiện.
 * Hạn đúng hôm nay chưa tính là quá: người nhận còn cả ngày để làm.
 */
export function overdueDays(
  r: Pick<DocRequest, 'resolved_at' | 'resolved_how' | 'due_on'>,
  today: string,
): number {
  if (requestState(r) !== 'open' || !r.due_on) return 0
  return Math.max(0, daysBetween(r.due_on, today))
}

export const REQUEST_ACTIONS = ['done', 'reopen', 'reassign', 'cancel'] as const
export type RequestAction = (typeof REQUEST_ACTIONS)[number]

export type RequestActor = { id: string; isAdmin: boolean }

/**
 * VÌ SAO người này KHÔNG làm được bước này — null = làm được.
 *
 * Tách `who` (sai người → 403) với `state` (sai lúc → 400) vì cách gỡ khác nhau:
 * sai người thì phải nhờ người khác, sai lúc thì phải làm bước khác trước.
 * Câu chặn nói luôn cách gỡ — màn hình đọc thẳng câu này ra cạnh nút.
 *
 * Admin làm được mọi bước người giao làm được: người giao nghỉ việc thì yêu cầu
 * của họ vẫn phải có người đóng / chuyển được.
 */
export function actionBlock(
  r: Pick<
    DocRequest,
    'author_id' | 'assignee_id' | 'resolved_at' | 'resolved_how' | 'deleted_at'
  > & { author_name?: string | null; assignee_name?: string | null },
  action: RequestAction,
  actor: RequestActor,
): { kind: 'who' | 'state'; message: string } | null {
  if (r.deleted_at) return { kind: 'state', message: 'Yêu cầu đã bị gỡ' }
  const state = requestState(r)
  const isAuthor = actor.isAdmin || actor.id === r.author_id
  const isAssignee = actor.id === r.assignee_id
  const giver = r.author_name ?? 'người giao'
  const taker = r.assignee_name ?? 'người nhận'

  const notOpen = (): { kind: 'state'; message: string } | null => {
    if (state === 'open') return null
    if (state === 'done') return { kind: 'state', message: 'Yêu cầu đã xong — mở lại trước nếu cần làm tiếp' } // prettier-ignore
    if (state === 'cancelled') return { kind: 'state', message: 'Yêu cầu đã huỷ — giao một yêu cầu mới nếu vẫn cần' } // prettier-ignore
    return { kind: 'state', message: 'Chứng từ đã huỷ nên yêu cầu đã đóng — giao trên chứng từ khác nếu vẫn cần' } // prettier-ignore
  }

  switch (action) {
    case 'done':
      return (
        notOpen() ??
        (isAuthor || isAssignee
          ? null
          : { kind: 'who', message: `Chỉ ${taker} hoặc ${giver} báo xong được` })
      )
    case 'reassign':
      return (
        notOpen() ??
        (isAuthor || isAssignee
          ? null
          : { kind: 'who', message: `Chỉ ${giver} hoặc ${taker} chuyển người được` })
      )
    case 'cancel':
      return (
        notOpen() ??
        (isAuthor ? null : { kind: 'who', message: `Chỉ ${giver} huỷ được yêu cầu này` })
      )
    case 'reopen':
      if (state === 'open') return { kind: 'state', message: 'Yêu cầu đang mở rồi' }
      if (state !== 'done') return notOpen()
      return isAuthor ? null : { kind: 'who', message: `Chỉ ${giver} mở lại được` }
  }
}

/** Các bước người này bấm được lúc này — cho nút trên màn hình. */
export function allowedActions(
  r: Parameters<typeof actionBlock>[0],
  actor: RequestActor,
): RequestAction[] {
  return REQUEST_ACTIONS.filter((a) => actionBlock(r, a, actor) === null)
}

/** Hạn đã qua thì không nhận — giao việc với hạn hôm qua là gõ nhầm ngày. */
export function dueBlock(dueOn: string | null | undefined, today: string): string | null {
  if (!dueOn) return null
  return dueOn < today ? 'Hạn đã qua — chọn từ hôm nay trở đi, hoặc bỏ trống hạn' : null
}

/**
 * Đổi DB của từng bước. Trả `expect` = trạng thái phải đang có lúc ghi: repo ghi
 * có điều kiện, hai người bấm cùng lúc thì người sau nhận Conflict thay vì đè.
 */
export function transitionPatch(
  action: RequestAction,
  actorId: string,
  nowIso: string,
  newAssigneeId?: string,
): {
  expect: 'open' | 'done'
  patch: {
    resolved_at?: string | null
    resolved_by?: string | null
    resolved_how?: 'done' | 'cancelled' | null
    assignee_id?: string
  }
} {
  switch (action) {
    case 'done':
      return { expect: 'open', patch: { resolved_at: nowIso, resolved_by: actorId, resolved_how: 'done' } } // prettier-ignore
    case 'cancel':
      return { expect: 'open', patch: { resolved_at: nowIso, resolved_by: actorId, resolved_how: 'cancelled' } } // prettier-ignore
    case 'reopen':
      return { expect: 'done', patch: { resolved_at: null, resolved_by: null, resolved_how: null } } // prettier-ignore
    case 'reassign':
      if (!newAssigneeId) throw new Error('reassign cần người nhận mới')
      return { expect: 'open', patch: { assignee_id: newAssigneeId } }
  }
}

/** Câu ghi vào dòng trao đổi của chứng từ (ghi chú trả lời yêu cầu). */
export function traceText(
  action: RequestAction | 'closed',
  text: string | null | undefined,
  newAssigneeName?: string | null,
): string {
  const t = text?.trim() ?? ''
  switch (action) {
    case 'done':
      return `Xong: ${t}`
    case 'reopen':
      return `Mở lại: ${t}`
    case 'cancel':
      return `Huỷ yêu cầu: ${t}`
    case 'reassign':
      return `Chuyển yêu cầu cho ${newAssigneeName ?? 'người khác'}${t ? ` — ${t}` : ''}`
    case 'closed':
      return 'Đóng yêu cầu: chứng từ đã huỷ'
  }
}

/**
 * AI ĐƯỢC BÁO: mọi người dính tới yêu cầu, trừ người vừa bấm.
 *
 * Một luật cho mọi bước: giao → người nhận; báo xong → người giao (và người nhận,
 * nếu người giao tự báo thay); chuyển → cả người cũ lẫn người mới.
 */
export function requestRecipients(
  r: Pick<DocRequest, 'author_id' | 'assignee_id'>,
  actorId: string,
  extra: (string | null | undefined)[] = [],
): string[] {
  return [...new Set([r.author_id, r.assignee_id, ...extra])].filter(
    (id): id is string => !!id && id !== actorId,
  )
}

/** Chuông mở thẳng trang "Yêu cầu việc" ở đúng yêu cầu (trang ở bước B4). */
export function requestHref(requestId: string): string {
  return `/yeu-cau-viec?id=${requestId}`
}

// ---- Danh sách "Giao cho tôi" / "Tôi đã giao" -----------------------------

/** Đã xong / đã huỷ chỉ giữ trên danh sách bấy nhiêu ngày — đủ để người giao xem lại. */
export const RECENT_DAYS = 7

export const REQUEST_TABS = ['assigned', 'given'] as const
export type RequestTab = (typeof REQUEST_TABS)[number]

export const REQUEST_FILTERS = ['open', 'overdue', 'done', 'cancelled'] as const
export type RequestFilter = (typeof REQUEST_FILTERS)[number]

export const REQUEST_FILTER_LABEL: Record<RequestFilter, string> = {
  open: 'Đang mở',
  overdue: 'Quá hạn',
  done: `Xong ${RECENT_DAYS} ngày qua`,
  cancelled: `Đã huỷ ${RECENT_DAYS} ngày qua`,
}

/** Đóng trong RECENT_DAYS ngày gần nhất (tính theo ngày VN). */
function recent(resolvedAt: string | null, today: string): boolean {
  if (!resolvedAt) return false
  return daysBetween(todayVn(new Date(resolvedAt)), today) < RECENT_DAYS
}

/**
 * MỘT hàm cho cả chip đếm lẫn danh sách mà chip mở ra — số trên chip là lời hứa
 * về số dòng. "Đã huỷ" gộp cả "đóng theo chứng từ": với người theo việc, cả hai
 * đều là "không phải làm nữa, và không phải vì đã làm xong".
 */
export function matchesFilter(r: DocRequest, f: RequestFilter, today: string): boolean {
  const s = requestState(r)
  switch (f) {
    case 'open':
      return s === 'open'
    case 'overdue':
      return overdueDays(r, today) > 0
    case 'done':
      return s === 'done' && recent(r.resolved_at ?? null, today)
    case 'cancelled':
      return (s === 'cancelled' || s === 'closed') && recent(r.resolved_at ?? null, today)
  }
}

export function summarizeRequests(
  list: DocRequest[],
  today: string,
): Record<RequestFilter, number> {
  const out = { open: 0, overdue: 0, done: 0, cancelled: 0 }
  for (const r of list) {
    for (const f of REQUEST_FILTERS) if (matchesFilter(r, f, today)) out[f]++
  }
  return out
}

/**
 * Thứ tự đọc: quá hạn lâu nhất lên đầu → còn mở theo hạn gần nhất (không hạn
 * xuống cuối) → đã đóng, mới đóng trước. Cùng hạn thì giao trước đứng trước.
 */
export function sortRequests(list: DocRequest[], today: string): DocRequest[] {
  const rank = (r: DocRequest) => (requestState(r) === 'open' ? 0 : 1)
  return [...list].sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    if (rank(a) === 1) return (b.resolved_at ?? '').localeCompare(a.resolved_at ?? '')
    const od = overdueDays(b, today) - overdueDays(a, today)
    if (od !== 0) return od
    if (a.due_on !== b.due_on) {
      if (!a.due_on) return 1
      if (!b.due_on) return -1
      return a.due_on.localeCompare(b.due_on)
    }
    return a.created_at.localeCompare(b.created_at)
  })
}

// ---- Ô nhập ----------------------------------------------------------------

const uuid = z.string().uuid('Mã không hợp lệ')
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ngày dạng YYYY-MM-DD')
const text = (min: string) => z.string().trim().min(1, min).max(2000, 'Quá dài')

export const requestCreateSchema = z.object({
  doc_type: z.enum(REQUEST_DOC_TYPES),
  doc_id: uuid,
  assignee_id: uuid,
  due_on: isoDate.nullable().optional(),
  body: text('Ghi việc cần làm'),
})
export type RequestCreate = z.infer<typeof requestCreateSchema>

export const requestActionSchema = z.discriminatedUnion('action', [
  // C4 — câu kết quả bắt buộc: người giao cần biết đã làm gì, và câu đó nằm lại trên chứng từ.
  z.object({ action: z.literal('done'), text: text('Ghi một câu kết quả để người giao biết đã làm gì') }), // prettier-ignore
  z.object({ action: z.literal('reopen'), text: text('Ghi lý do mở lại') }),
  z.object({ action: z.literal('cancel'), text: text('Ghi lý do huỷ') }),
  z.object({
    action: z.literal('reassign'),
    assignee_id: uuid,
    text: z.string().trim().max(2000, 'Quá dài').optional(),
  }),
])
export type RequestActionInput = z.infer<typeof requestActionSchema>

export const requestListQuerySchema = z.object({
  tab: z.enum(REQUEST_TABS).default('assigned'),
  filter: z.enum(REQUEST_FILTERS).default('open'),
})
