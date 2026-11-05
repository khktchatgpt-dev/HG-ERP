import { thieuViec } from './hang-muc'
import { guiDuyetSanLoi } from './mua-san'
import { supplierOrderBlock, type SupplierGate } from './po-guards'

/**
 * TRƯỞNG PHÒNG XEM ĐƠN MUA TRƯỚC KHI LÊN BÀN GIÁM ĐỐC (05/11/2026, bản vẽ
 * https://claude.ai/artifact/RcqWLU7F1z33btAR97gZBo — chủ dự án duyệt Q1–Q6).
 *
 * Không thêm trạng thái: đơn vẫn `pending_approval`. "Đã xem" là một dòng
 * `reviewed` trong sổ vết ký (`approval_events`) đứng SAU lần `submitted` cuối.
 * Rút về nháp / bị trả lại rồi gửi lại thì có `submitted` mới → dấu cũ hết hiệu
 * lực mà không phải dọn gì (nội dung anh trưởng phòng đã xem không còn nữa).
 *
 * Thuần — server (service) và client (màn) dùng chung, có test.
 */

/** Một dòng sổ vết ký — đủ trường để suy dấu "đã xem". */
export type VetKy = {
  id?: string
  action: string
  actor_id: string | null
  actor_name?: string | null
  reason: string | null
  created_at: string
}

/** Dấu "trưởng phòng đã xem" còn hiệu lực trên đơn. */
export type DauDaXem = {
  by: string | null
  by_name: string | null
  at: string
  /** Ghi chú trưởng phòng để lại cho Giám đốc (không bắt buộc — Q3). */
  note: string | null
}

/**
 * Mốc KẾT THÚC một vòng duyệt (đơn về nháp): sau các mốc này dấu "đã xem" của
 * vòng cũ không còn nghĩa, kể cả khi sổ thiếu dòng `submitted` của vòng mới.
 */
const HET_VONG = new Set(['withdrawn', 'returned', 'rejected', 'reopened'])

/** Xếp xuôi thời gian, ổn định khi trùng mốc (giữ thứ tự ghi). */
function xuoi(events: VetKy[]): VetKy[] {
  return events
    .map((e, i) => ({ e, i, t: Date.parse(e.created_at) }))
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .map((x) => x.e)
}

/**
 * Dấu "đã xem" CÒN HIỆU LỰC: dòng `reviewed` đầu tiên sau lần `submitted` cuối,
 * miễn là giữa hai dòng đó đơn chưa về nháp. Không có → null (chưa xem).
 *
 * Đơn gửi trước 0128 không có dòng `submitted` nào — khi đó tính từ đầu sổ.
 */
export function reviewMark(events: VetKy[]): DauDaXem | null {
  const ds = xuoi(events)
  let tu = 0
  ds.forEach((e, i) => {
    if (e.action === 'submitted') tu = i + 1
  })
  const vong = ds.slice(tu)
  // Vòng đã kết thúc (đơn về nháp) ở BẤT KỲ đâu sau mốc gửi → dấu không còn.
  if (vong.some((e) => HET_VONG.has(e.action))) return null
  const e = vong.find((x) => x.action === 'reviewed')
  if (!e) return null
  return {
    by: e.actor_id,
    by_name: e.actor_name ?? null,
    at: e.created_at,
    note: e.reason?.trim() || null,
  }
}

/**
 * Dấu đã xem của NHIỀU đơn một lượt — cho hộp "Chờ tôi xem" và hộp ký Giám
 * đốc. `events` là sổ vết của mọi đơn trong danh sách (thứ tự tuỳ ý).
 */
export function reviewMarks(
  events: (VetKy & { entity_id: string })[],
): Map<string, DauDaXem> {
  const theoDon = new Map<string, VetKy[]>()
  for (const e of events) {
    const ds = theoDon.get(e.entity_id)
    if (ds) ds.push(e)
    else theoDon.set(e.entity_id, [e])
  }
  const out = new Map<string, DauDaXem>()
  for (const [id, ds] of theoDon) {
    const m = reviewMark(ds)
    if (m) out.set(id, m)
  }
  return out
}

/**
 * Lý do ghi kèm dòng `approved` khi Giám đốc duyệt lúc trưởng phòng CHƯA xem.
 * Đánh dấu tường minh ngay trên dòng duyệt (không suy ngược) để đơn duyệt TRƯỚC
 * ngày có bước xem không bị gọi oan là "duyệt khi chưa xem".
 */
export const DUYET_KHI_CHUA_XEM = 'Duyệt khi trưởng phòng chưa xem'

/** Dòng vết này là "Giám đốc duyệt khi trưởng phòng chưa xem"? */
export function laDuyetKhiChuaXem(e: Pick<VetKy, 'action' | 'reason'>): boolean {
  return e.action === 'approved' && (e.reason ?? '').startsWith(DUYET_KHI_CHUA_XEM)
}

/** Lý do trả lại tối thiểu (Q3): người lập phải sửa được theo câu này. */
export const LY_DO_TRA_LAI_TOI_THIEU = 5

/** Động từ của những mốc làm đơn rời hàng "chờ trưởng phòng xem". */
const VUA_DOI: Record<string, string> = {
  withdrawn: 'rút về nháp',
  returned: 'trả lại để sửa',
  rejected: 'trả lại để sửa',
  reopened: 'mở lại để sửa',
  approved: 'duyệt',
  urgent_sent: 'gửi gấp cho NCC',
}

/**
 * Câu nói THẬT vì sao đơn không còn ở chỗ trưởng phòng — bày tại chỗ khi bấm
 * "đã xem" / "trả lại" mà đơn vừa đổi (bản vẽ khung 2·C): "PO-2026-0236 vừa
 * được Đặng Thị Thanh Nga rút về nháp lúc 09:18". Không tìm được mốc → null.
 * `gio` đổi ISO → "HH:mm" giờ VN (truyền vào để hàm thuần, test không phụ
 * thuộc múi giờ máy).
 */
export function vuaDoiCau(
  code: string,
  events: VetKy[],
  gio: (iso: string) => string,
): string | null {
  const cuoi = xuoi(events)
    .filter((e) => e.action in VUA_DOI)
    .at(-1)
  if (!cuoi) return null
  const ai = cuoi.actor_name?.trim() || 'người khác'
  return `${code} vừa được ${ai} ${VUA_DOI[cuoi.action]} lúc ${gio(cuoi.created_at)}`
}

/**
 * TRƯỞNG PHÒNG trên một đơn đang chờ Giám đốc ký — hộp ký + màn ký đơn đọc chung
 * (B3). Chỗ dùng nhận `null` = KHÔNG ÁP (chưa ai giữ vai trưởng phòng CƯ, hoặc
 * đơn chờ ký bù): khi đó không cột, không nhóm, không khoá ký nhanh.
 */
export type TruongPhongXem = {
  /** Tên người giữ vai trưởng phòng CƯ (nhiều người thì nối " · "). */
  ten: string | null
  da_xem: DauDaXem | null
  /** Phút từ lần gửi duyệt cuối tới lúc nạp — cho "chưa xem · 25′". */
  cho_phut: number
}

/**
 * Ngữ cảnh trưởng phòng của một lượt nạp: tên + id người giữ vai (để biết "đến
 * lượt bạn") + dấu đã xem theo đơn. null = chưa có trưởng phòng.
 */
export type TruongPhongCtx = {
  ten: string | null
  ids: string[]
  marks: Map<string, DauDaXem>
} | null

/** Trưởng phòng trên MỘT đơn từ ngữ cảnh của lượt nạp. `guiLuc` = lần gửi duyệt cuối. */
export function truongPhongXem(
  ctx: TruongPhongCtx,
  id: string,
  guiLuc: string,
  nowMs: number,
): TruongPhongXem | null {
  if (!ctx) return null
  return {
    ten: ctx.ten,
    da_xem: ctx.marks.get(id) ?? null,
    cho_phut: Math.max(0, Math.round((nowMs - Date.parse(guiLuc)) / 60_000)),
  }
}

/** Đơn có trưởng phòng mà trưởng phòng CHƯA xem — Q1: không có ô ký nhanh. */
export const chuaXem = (tp: TruongPhongXem | null | undefined): boolean =>
  !!tp && !tp.da_xem

/** "25′" · "18 giờ" · "2 ngày" — đơn đã nằm chờ trưởng phòng bao lâu. */
export function choBaoLau(phut: number): string {
  const p = Math.max(0, Math.floor(phut))
  if (p < 60) return `${p}′`
  if (p < 1440) return `${Math.floor(p / 60)} giờ`
  return `${Math.floor(p / 1440)} ngày`
}

/**
 * Câu cảnh báo trong hộp xác nhận khi Giám đốc ký đơn trưởng phòng CHƯA xem —
 * ký được (chủ dự án 05/11/2026), nhưng nói trước chuyện gì sẽ xảy ra. Hộp ký và
 * màn ký đơn dùng chung một câu.
 */
export function canhBaoChuaXem(ten: string | null): string {
  const ai = ten ?? 'Trưởng phòng'
  return `${ai} chưa xem đơn này. Duyệt bây giờ: lịch sử ký ghi “duyệt khi trưởng phòng chưa xem”, ${ai} nhận thông báo.`
}

/** Nhãn từng loại mốc trong LỊCH SỬ KÝ — màn ký đơn của GĐ và trang đơn Cung ứng đọc chung. */
const VET_KY_NHAN: Record<string, { label: string; tone?: 'done' | 'warn' | 'stop' }> = {
  submitted: { label: 'Gửi duyệt' },
  reviewed: { label: 'Trưởng phòng đã xem', tone: 'done' },
  returned: { label: 'Trưởng phòng trả lại để sửa', tone: 'stop' },
  approved: { label: 'Giám đốc duyệt', tone: 'done' },
  rejected: { label: 'Giám đốc trả lại để sửa', tone: 'stop' },
  withdrawn: { label: 'Rút về nháp', tone: 'warn' },
  reassigned: { label: 'Đổi người phụ trách' },
  reopened: { label: 'Mở lại đơn đã duyệt', tone: 'warn' },
  unapproved: { label: 'Thu hồi chữ ký', tone: 'warn' },
  urgent_sent: { label: 'Gửi NCC gấp, chưa ký', tone: 'stop' },
}

/**
 * Một dòng lịch sử ký: nhãn + màu + ghi chú. Duyệt khi trưởng phòng chưa xem
 * thì dấu nằm đầu lý do (`DUYET_KHI_CHUA_XEM`) — tách ra làm nhãn, phần còn lại
 * (nếu có) mới là ghi chú.
 */
export function vetKyDong(e: Pick<VetKy, 'action' | 'reason'>): {
  label: string
  tone?: 'done' | 'warn' | 'stop'
  detail: string | null
} {
  if (laDuyetKhiChuaXem(e)) {
    const con = (e.reason ?? '').slice(DUYET_KHI_CHUA_XEM.length).replace(/^ · /, '')
    return { label: 'Giám đốc duyệt — trưởng phòng chưa xem', tone: 'warn', detail: con.trim() || null } // prettier-ignore
  }
  const m = VET_KY_NHAN[e.action]
  return { label: m?.label ?? e.action, tone: m?.tone, detail: e.reason?.trim() || null }
}

/**
 * Trưởng phòng đang nhìn NHÁP mà NV vừa "Gửi thẳng Giám đốc" — câu nói thật cho
 * 409: "PO-2026-0243 vừa được Nguyễn Đình Huy gửi duyệt lúc 09:30". Tách khỏi
 * `vuaDoiCau` vì ở đó mốc gửi duyệt là chuyện bình thường của đơn chờ duyệt.
 */
export function vuaGuiDuyetCau(
  code: string,
  events: VetKy[],
  gio: (iso: string) => string,
): string | null {
  const cuoi = xuoi(events)
    .filter((e) => e.action === 'submitted')
    .at(-1)
  if (!cuoi) return null
  const ai = cuoi.actor_name?.trim() || 'người khác'
  return `${code} vừa được ${ai} gửi duyệt lúc ${gio(cuoi.created_at)}`
}

/** Mốc đưa đơn VỀ NHÁP vì người khác trả lại (trưởng phòng / GĐ trả lại, hạ về nháp). */
const TRA_LAI = new Set(['returned', 'rejected', 'reopened'])
/** Mốc đổi chỗ đứng của một nháp: gửi đi, tự rút về, hoặc bị trả lại. */
const MOC_NHAP = new Set(['submitted', 'withdrawn', ...TRA_LAI])

/** Lần trả lại còn ảnh hưởng một NHÁP. */
export type TraLaiNhap = {
  at: string
  by_name: string | null
  reason: string | null
  /** NV đã lưu nháp SAU lúc bị trả lại → đơn quay lại hộp trưởng phòng. */
  da_sua: boolean
}

/**
 * NHÁP BỊ TRẢ LẠI (luồng chốt 05/11/2026 chiều — không có mốc "gửi trưởng
 * phòng"): mốc cuối trong các mốc đổi chỗ của nháp là một lần trả lại. Hộp
 * "Chờ tôi xem" GIẤU nháp đó tới khi NV sửa (lưu nháp → `updated_at` mới hơn
 * mốc trả lại), rồi bày lại kèm nhãn "đã sửa sau khi trả lại".
 *
 * Trả lại khi đơn đang chờ duyệt: hệ thống đổi trạng thái (`updated_at` = t1)
 * RỒI mới ghi vết (t2 > t1) — nên chưa ai sửa thì `da_sua` đúng là false.
 */
export function traLaiNhap(events: VetKy[], updatedAt: string): TraLaiNhap | null {
  const cuoi = xuoi(events)
    .filter((e) => MOC_NHAP.has(e.action))
    .at(-1)
  if (!cuoi || !TRA_LAI.has(cuoi.action)) return null
  return {
    at: cuoi.created_at,
    by_name: cuoi.actor_name ?? null,
    reason: cuoi.reason?.trim() || null,
    da_sua: Date.parse(updatedAt) > Date.parse(cuoi.created_at),
  }
}

/**
 * VÌ SAO NHÁP CHƯA TRÌNH GĐ ĐƯỢC — cùng thứ tự và cùng luật với hàng rào ở
 * máy chủ (`pos.service.assertGuiDuyetDuoc`), câu ngắn để bày ngay trên dòng
 * của hộp trưởng phòng (khoá nút trình). null = trình được.
 */
export function lyDoChuaTrinh(x: {
  so_dong: number
  expected_at: string | null
  production_order_id: string | null
  project_id?: string | null
  marketplace_shop?: string | null
  ncc: (SupplierGate & { is_marketplace?: boolean | null }) | null
}): string | null {
  if (x.so_dong === 0) return 'Chưa có dòng hàng'
  if (x.ncc) {
    const khoa = supplierOrderBlock(x.ncc)
    if (khoa) return khoa
    if (x.ncc.is_marketplace) {
      const san = guiDuyetSanLoi(x)
      if (san) return san
    }
  }
  if (thieuViec(x)) return 'Đơn ngoài lệnh chưa chọn hạng mục'
  if (!x.expected_at) return 'Chưa có hẹn giao'
  return null
}
