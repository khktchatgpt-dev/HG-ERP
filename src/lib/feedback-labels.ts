/**
 * GÓP Ý HỆ THỐNG — từ vựng dùng chung cho cả server (schema, service) và client
 * (nút ghi nhanh, trang /gop-y). Thuần, không phụ thuộc React hay DB.
 *
 * Nhãn tiếng Việt giữ đúng ý bản gốc (Nam An ERP): "Đã đẩy online" chứ không
 * phải "Hoàn thành" — xong ở đội phát triển chưa phải xong với người viết.
 */

export const FEEDBACK_KINDS = ['system', 'operation'] as const
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number]
export const KIND_LABEL: Record<FeedbackKind, { label: string; hint: string }> = {
  system: {
    label: 'Hệ thống',
    hint: 'Lỗi, chỗ khó dùng, tính năng muốn có trong phần mềm',
  },
  operation: {
    label: 'Vận hành',
    hint: 'Quy trình, phối hợp giữa các phòng, cách làm việc',
  },
}

export const FEEDBACK_TYPES = ['bug', 'idea', 'hard_to_use', 'process', 'question'] as const
export type FeedbackType = (typeof FEEDBACK_TYPES)[number]
export const TYPE_LABEL: Record<FeedbackType, string> = {
  bug: 'Lỗi',
  idea: 'Ý tưởng',
  hard_to_use: 'Khó dùng',
  process: 'Quy trình',
  question: 'Câu hỏi',
}
/** Loại hợp lệ theo nhóm: BUG / HARD_TO_USE chỉ hệ thống, PROCESS chỉ vận hành. */
export const TYPES_BY_KIND: Record<FeedbackKind, readonly FeedbackType[]> = {
  system: ['bug', 'hard_to_use', 'idea', 'question'],
  operation: ['process', 'idea', 'question'],
}

export const FEEDBACK_SEVERITIES = ['blocking', 'annoying', 'nice'] as const
export type FeedbackSeverity = (typeof FEEDBACK_SEVERITIES)[number]
export const SEVERITY_LABEL: Record<FeedbackSeverity, { label: string; hint: string }> = {
  blocking: { label: 'Chặn việc', hint: 'Không làm việc được' },
  annoying: { label: 'Mất công', hint: 'Làm được nhưng mất công' },
  nice: { label: 'Có thì tốt', hint: 'Không gấp' },
}
export const SEVERITY_TONE: Record<FeedbackSeverity, 'red' | 'amber' | 'gray'> = {
  blocking: 'red',
  annoying: 'amber',
  nice: 'gray',
}

export const FEEDBACK_STATUSES = [
  'pending_review',
  'returned',
  'new',
  'reopened',
  'reviewing',
  'planned',
  'done',
  'declined',
] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]
export const STATUS_LABEL: Record<FeedbackStatus, string> = {
  pending_review: 'Chờ xác nhận',
  returned: 'Trả lại người viết',
  new: 'Yêu cầu mới',
  reopened: 'Cần chỉnh thêm',
  reviewing: 'Đang xem',
  planned: 'Sẽ làm',
  done: 'Đã đẩy online',
  declined: 'Chưa làm lúc này',
}
export const STATUS_TONE: Record<FeedbackStatus, 'gray' | 'blue' | 'green' | 'amber' | 'red'> = {
  pending_review: 'amber',
  returned: 'red',
  new: 'blue',
  reopened: 'amber',
  reviewing: 'blue',
  planned: 'blue',
  done: 'green',
  declined: 'gray',
}
/** Trạng thái admin đặt được tay (không gồm hai trạng thái của cửa xác nhận). */
export const MANAGER_STATUSES: readonly FeedbackStatus[] = [
  'new',
  'reviewing',
  'planned',
  'done',
  'declined',
  'reopened',
]

/**
 * Cột bảng kanban. `done_confirmed` là cột ẢO: status vẫn là `done` nhưng người
 * viết đã bấm "Đã ổn" (`confirmed_ok_at` ≠ null) — việc thật sự khép lại.
 */
export const KANBAN_COLUMNS = [
  'pending_review',
  'returned',
  'new',
  'reopened',
  'reviewing',
  'planned',
  'done',
  'done_confirmed',
  'declined',
] as const
export type KanbanColumn = (typeof KANBAN_COLUMNS)[number]
export const COLUMN_LABEL: Record<KanbanColumn, string> = {
  ...STATUS_LABEL,
  done_confirmed: 'Đã xong — người dùng xác nhận',
}
export function columnOf(fb: { status: FeedbackStatus; confirmed_ok_at: string | null }): KanbanColumn {
  return fb.status === 'done' && fb.confirmed_ok_at ? 'done_confirmed' : fb.status
}

export const COMMENT_KINDS = ['comment', 'reply', 'needs_more', 'confirmed', 'status'] as const
export type CommentKind = (typeof COMMENT_KINDS)[number]

/**
 * CHỦ ĐỀ = khu làm việc của HG-ERP (thay cho KH_BG_MAU đặc thù Artex). Đoán theo
 * đường dẫn trang đang mở; người viết đổi được.
 */
export const FEEDBACK_TOPICS = [
  { id: 'sales', label: 'Bán hàng', prefixes: ['/sales'] },
  { id: 'finance', label: 'Kế toán', prefixes: ['/finance'] },
  { id: 'warehouse', label: 'Kho', prefixes: ['/warehouse'] },
  { id: 'technical', label: 'Kỹ thuật & Sản phẩm', prefixes: ['/technical', '/products', '/cat-phoi'] },
  { id: 'planning', label: 'Cung ứng', prefixes: ['/planning'] },
  { id: 'qc', label: 'QC', prefixes: ['/qc'] },
  { id: 'production', label: 'Sản xuất', prefixes: ['/production', '/to', '/thongke', '/kehoach-sx'] },
  { id: 'hr', label: 'Nhân sự', prefixes: ['/hr'] },
  { id: 'exec', label: 'Ban Giám đốc', prefixes: ['/exec'] },
  { id: 'tasks', label: 'Công việc & Thông báo', prefixes: ['/tasks', '/notifications'] },
  { id: 'system', label: 'Tài khoản & Quản trị', prefixes: ['/admin', '/tai-khoan', '/login', '/doi-mat-khau'] },
  { id: 'other', label: 'Khác', prefixes: [] },
] as const
export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number]['id']
export const TOPIC_IDS = FEEDBACK_TOPICS.map((t) => t.id) as readonly FeedbackTopic[]
export const TOPIC_LABEL = Object.fromEntries(FEEDBACK_TOPICS.map((t) => [t.id, t.label])) as Record<
  FeedbackTopic,
  string
>

/**
 * Đoán chủ đề từ đường dẫn trang đang mở. `/gop-y` (chính trang góp ý) không
 * nói gì về chủ đề → null để người viết tự chọn. Cùng luật ở server và client.
 */
export function guessTopic(pageUrl: string | null | undefined): FeedbackTopic | null {
  if (!pageUrl) return null
  let path = pageUrl
  try {
    path = pageUrl.startsWith('http') ? new URL(pageUrl).pathname : pageUrl
  } catch {
    /* chuỗi lạ → so thẳng */
  }
  path = path.split('?')[0]
  for (const t of FEEDBACK_TOPICS) {
    for (const p of t.prefixes) {
      if (path === p || path.startsWith(p + '/')) return t.id
    }
  }
  return null
}

/** Tiêu đề tự rút từ dòng đầu nội dung khi người viết bỏ trống (≤ 90 ký tự). */
export function deriveTitle(content: string): string {
  const first = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0)
  if (!first) return 'Góp ý'
  return first.length > 90 ? first.slice(0, 87).trimEnd() + '…' : first
}

/** Thứ Hai của tuần chứa `d` (giờ địa phương), dạng yyyy-mm-dd. */
export function weekStartOf(d: Date): string {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const dow = (x.getDay() + 6) % 7 // 0 = thứ Hai
  x.setDate(x.getDate() - dow)
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${x.getFullYear()}-${p2(x.getMonth() + 1)}-${p2(x.getDate())}`
}

/** Mốc "hoạt động gần nhất" để xếp cột kanban: max(tạo, sửa, trao đổi cuối). */
export function lastActivity(fb: {
  created_at: string
  edited_at: string | null
  updated_at: string
  last_comment_at: string | null
}): string {
  return [fb.created_at, fb.edited_at, fb.updated_at, fb.last_comment_at]
    .filter((x): x is string => !!x)
    .sort()
    .at(-1)!
}

/**
 * Tách tên nhắc `@Tên Người` trong nội dung: so với danh sách người (không dấu,
 * không phân biệt hoa thường), ưu tiên tên dài hơn để "@Nguyễn Văn An" không
 * khớp nhầm "An". Trả id đã khớp, không trùng.
 */
export function extractMentions(
  content: string,
  people: readonly { id: string; name: string }[],
): string[] {
  if (!content.includes('@')) return []
  const norm = (s: string) =>
    s
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[đĐ]/g, 'd')
      .toLowerCase()
  const text = norm(content)
  const found: string[] = []
  for (const p of [...people].sort((a, b) => b.name.length - a.name.length)) {
    const n = norm(p.name).trim()
    if (n.length < 2) continue
    if (text.includes('@' + n) && !found.includes(p.id)) found.push(p.id)
  }
  return found
}
