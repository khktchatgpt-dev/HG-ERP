/**
 * BƯỚC 4 — WORKFLOW phiếu báo sản lượng. Luật chuyển trạng thái + ai được bấm gì.
 *
 * File THUẦN (không đụng DB) vì cả hai phía đều cần: client bật/tắt nút, server
 * gác thật. Server vẫn là nơi quyết định cuối — client chỉ dùng để khỏi bày nút
 * bấm vào sẽ bị từ chối.
 *
 * NGUYÊN TẮC CHỐT 26/08/2026 (user): **thống kê là người thao tác chính, tổ
 * trưởng chỉ quản lý.** Vì vậy luồng KHÔNG phải "duyệt trước mới được đi tiếp":
 *
 *   Thống kê ghi sổ  →  số vào TẠM TÍNH ngay (xưởng nhìn thấy tiến độ)
 *   Tổ trưởng giám sát →  xác nhận thì số thành CHÍNH THỨC; sai thì trả về
 *
 * Nếu bắt tổ trưởng duyệt mới được tính, mà tổ trưởng lại không phải người dùng
 * hệ thống hằng ngày, thì phiếu dồn đống và tiến độ đứng im dù xưởng vẫn chạy.
 * Tách "tạm tính" / "chính thức" (xem stageProgress ở production-summary) giữ
 * được CẢ HAI: dòng chảy không tắc, mà số chính thức vẫn có người chịu trách nhiệm.
 *
 * Vẫn giữ đúng hai điều cấm của phạm vi Bước 1: thống kê KHÔNG tự xác nhận số
 * của mình, và KHÔNG sửa được phiếu đã xác nhận.
 */

export type EntryDocStatus = 'nhap' | 'cho_xac_nhan' | 'da_xac_nhan' | 'tu_choi'

/** Vai trong luồng phiếu — ánh xạ sang permission ở service. */
export type DocRole =
  /** Thống kê xưởng: người thao tác chính. */
  | 'thong_ke'
  /** Tổ trưởng: giám sát tổ mình. */
  | 'to_truong'
  /** Quản đốc / Giám đốc: gỡ kẹt, có lưu vết. */
  | 'quan_ly'

export type DocAction =
  | 'gui' // gửi phiếu cho tổ trưởng
  | 'thu_hoi' // rút phiếu về sửa (ghi nhầm, tổ trưởng chưa đụng)
  | 'sua' // sửa dòng trên phiếu
  | 'xoa' // xoá cả phiếu
  | 'xac_nhan' // tổ trưởng: số đúng
  | 'tra_ve' // tổ trưởng: số sai, kèm lý do
  | 'mo_khoa' // quản lý: mở phiếu đã xác nhận để sửa

/** Nhãn tiếng Việt cho nút và cho thông báo lỗi — một nguồn, khỏi lệch chữ. */
export const STATUS_LABEL: Record<EntryDocStatus, string> = {
  nhap: 'Nháp',
  cho_xac_nhan: 'Chờ xác nhận',
  da_xac_nhan: 'Đã xác nhận',
  tu_choi: 'Bị trả về',
}

export const ACTION_LABEL: Record<DocAction, string> = {
  gui: 'Gửi tổ trưởng',
  thu_hoi: 'Thu hồi',
  sua: 'Sửa',
  xoa: 'Xoá phiếu',
  xac_nhan: 'Xác nhận',
  tra_ve: 'Trả về',
  mo_khoa: 'Mở khoá',
}

type Transition = {
  action: DocAction
  from: EntryDocStatus[]
  to: EntryDocStatus
  roles: DocRole[]
  /** Bắt buộc kèm lý do — không cho trả về/mở khoá mà không nói vì sao. */
  needsReason?: boolean
}

/**
 * Bảng luật. Đọc từ trên xuống là ra toàn bộ vòng đời phiếu:
 *
 *   nhap ──gửi──→ cho_xac_nhan ──xác nhận──→ da_xac_nhan
 *     ↑               │                          │
 *     └──thu hồi──────┘                          │
 *                     └──trả về──→ tu_choi       │
 *                                     │          │
 *                     └───gửi lại─────┘          │
 *                                                │
 *   da_xac_nhan ──mở khoá (quản lý, có lý do)──→ nhap
 */
const TRANSITIONS: Transition[] = [
  { action: 'gui', from: ['nhap', 'tu_choi'], to: 'cho_xac_nhan', roles: ['thong_ke'] },
  // Thu hồi CHỈ khi tổ trưởng chưa xử lý — thống kê tự phát hiện gõ nhầm.
  { action: 'thu_hoi', from: ['cho_xac_nhan'], to: 'nhap', roles: ['thong_ke'] },
  {
    action: 'xac_nhan',
    from: ['cho_xac_nhan'],
    to: 'da_xac_nhan',
    roles: ['to_truong', 'quan_ly'],
  },
  {
    action: 'tra_ve',
    from: ['cho_xac_nhan'],
    to: 'tu_choi',
    roles: ['to_truong', 'quan_ly'],
    needsReason: true,
  },
  // Phiếu đã xác nhận là số CHÍNH THỨC — chỉ quản lý gỡ được, và phải nói lý do.
  {
    action: 'mo_khoa',
    from: ['da_xac_nhan'],
    to: 'nhap',
    roles: ['quan_ly'],
    needsReason: true,
  },
]

/**
 * Sửa / xoá KHÔNG đổi trạng thái nên để riêng. Luật: chỉ đụng được phiếu mà số
 * của nó chưa tính vào đâu (nháp, hoặc bị trả về). Phiếu đang chờ xác nhận phải
 * thu hồi trước — nếu không, tổ trưởng đang nhìn một đằng, số đổi một nẻo.
 */
const EDITABLE_FROM: EntryDocStatus[] = ['nhap', 'tu_choi']

export function canEdit(status: EntryDocStatus, role: DocRole): boolean {
  return role === 'thong_ke' && EDITABLE_FROM.includes(status)
}

export function canDelete(status: EntryDocStatus, role: DocRole): boolean {
  if (role === 'quan_ly') return status !== 'da_xac_nhan'
  return canEdit(status, role)
}

/** Hành động vai này bấm được trên phiếu đang ở trạng thái này. */
export function allowedActions(status: EntryDocStatus, role: DocRole): DocAction[] {
  const out: DocAction[] = TRANSITIONS.filter(
    (t) => t.from.includes(status) && t.roles.includes(role),
  ).map((t) => t.action)
  if (canEdit(status, role)) out.push('sua')
  if (canDelete(status, role)) out.push('xoa')
  return out
}

export type TransitionCheck =
  { ok: true; to: EntryDocStatus } | { ok: false; reason: string }

/**
 * Kiểm tra một lượt chuyển. Trả LÝ DO đọc được để service ném thẳng ra cho
 * người dùng, thay vì "Forbidden" trống không.
 */
export function checkTransition(
  status: EntryDocStatus,
  action: DocAction,
  role: DocRole,
  reason?: string | null,
): TransitionCheck {
  const rule = TRANSITIONS.find((t) => t.action === action)
  if (!rule) return { ok: false, reason: `Không có thao tác "${action}"` }
  if (!rule.from.includes(status)) {
    return {
      ok: false,
      reason: `Phiếu đang ở "${STATUS_LABEL[status]}" nên không ${ACTION_LABEL[action].toLowerCase()} được`,
    }
  }
  if (!rule.roles.includes(role)) {
    return {
      ok: false,
      reason: `Vai này không được ${ACTION_LABEL[action].toLowerCase()}`,
    }
  }
  if (rule.needsReason && !reason?.trim()) {
    return { ok: false, reason: `${ACTION_LABEL[action]} phải ghi lý do` }
  }
  return { ok: true, to: rule.to }
}

// ── Số của phiếu này tính vào đâu (nối với logic Bước 3) ────────────────────

/** Phiếu đã xác nhận = số CHÍNH THỨC, vào tiến độ. */
export function countsAsOfficial(status: EntryDocStatus): boolean {
  return status === 'da_xac_nhan'
}

/**
 * Phiếu đã gửi, chờ tổ trưởng = số TẠM TÍNH, bày riêng cạnh tiến độ.
 * Nháp (chưa gửi) và bị trả về (số đang sai) KHÔNG tính vào đâu cả.
 */
export function countsAsPending(status: EntryDocStatus): boolean {
  return status === 'cho_xac_nhan'
}
