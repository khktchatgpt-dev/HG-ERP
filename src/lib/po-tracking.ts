/**
 * THEO DÕI THỰC HIỆN ĐƠN MUA (0213, 27/09/2026) — phần thuần, có test.
 *
 * Trả lời ba câu người mua hỏi mỗi ngày sau khi đơn đã ra khỏi cửa:
 *   · NCC xác nhận TỪNG DÒNG thế nào — đủ / một phần / không / chưa phản hồi;
 *   · NCC đã hứa gì, dời mấy lần — sổ hẹn giao;
 *   · Giao có vấn đề gì — sổ sự cố.
 */

/* ── 1 · XÁC NHẬN THEO DÒNG ─────────────────────────────────────────────── */

export type LineConfirm = {
  kind: 'chua_phan_hoi' | 'du' | 'mot_phan' | 'khong'
  label: string
  tone: 'neutral' | 'warn' | 'done' | 'stop'
  /** SL NCC đã hẹn giao cho dòng (tổng các đợt còn sống). */
  committed: number
}

const SENT = ['ordered', 'confirmed', 'in_transit', 'partial', 'received']

/**
 * SL NCC cam kết của dòng = tổng các đợt CÒN SỐNG (đợt huỷ / đợt đề nghị đã bị
 * thay không tính). Đơn chưa gửi → `null` (chưa có gì để xác nhận).
 *
 * Đơn đã xác nhận mà KHÔNG chia đợt nào (NCC chỉ gật "ok giao đủ") → coi như
 * xác nhận đủ cả đơn — không có đợt không có nghĩa là NCC từ chối từng dòng.
 */
export function lineConfirm(
  line: { id: string; qty_ordered: number },
  po: { status: string; confirmed_at: string | null },
  shipments: { status: string; lines: { po_line_id: string; qty: number }[] }[],
): LineConfirm | null {
  if (!SENT.includes(po.status)) return null
  const live = shipments.filter((s) => s.status !== 'cancelled')
  const committed = live.reduce(
    (t, s) =>
      t + s.lines.filter((l) => l.po_line_id === line.id).reduce((a, l) => a + l.qty, 0),
    0,
  )
  if (!po.confirmed_at && po.status === 'ordered') {
    return { kind: 'chua_phan_hoi', label: 'Chưa phản hồi', tone: 'warn', committed }
  }
  if (live.length === 0) {
    return {
      kind: 'du',
      label: 'Xác nhận cả đơn',
      tone: 'done',
      committed: line.qty_ordered,
    }
  }
  if (committed >= line.qty_ordered - 1e-6) return { kind: 'du', label: 'Xác nhận đủ', tone: 'done', committed } // prettier-ignore
  if (committed > 1e-6) return { kind: 'mot_phan', label: 'Xác nhận một phần', tone: 'warn', committed } // prettier-ignore
  return { kind: 'khong', label: 'Không xác nhận', tone: 'stop', committed }
}

/* ── 2 · SỔ HẸN GIAO ────────────────────────────────────────────────────── */

export const COMMIT_KINDS = ['de_nghi', 'ncc_xac_nhan', 'them_dot', 'doi_hen', 'huy_dot', 'doi_hen_don'] as const // prettier-ignore
export type CommitKind = (typeof COMMIT_KINDS)[number]

export const COMMIT_KIND_LABEL: Record<CommitKind, string> = {
  de_nghi: 'Mình đề nghị',
  ncc_xac_nhan: 'NCC cam kết',
  them_dot: 'Hẹn thêm đợt',
  doi_hen: 'Dời hẹn đợt',
  huy_dot: 'Huỷ đợt',
  doi_hen_don: 'Dời hẹn cả đơn',
}

/**
 * NCC ĐÃ DỜI HẸN BAO NHIÊU NGÀY so với lần cam kết ĐẦU TIÊN — con số người mua
 * mang đi nói chuyện với NCC. So ngày sớm nhất của lần cam kết đầu với ngày sớm
 * nhất của các đợt còn sống hiện tại. `null` = chưa có cam kết nào để so.
 */
/**
 * Tiền tố lý do của dòng sổ khi LẤY TRƯỚC (tách đợt, 27/09/2026). Tách đợt ghi
 * sổ dạng 'them_dot' (không thêm loại mới để khỏi đổi ràng buộc DB), nhưng đó là
 * MÌNH kéo hàng lên chứ không phải NCC hứa — không được làm mốc so trễ/sớm.
 */
export const SPLIT_REASON_PREFIX = 'Lấy trước từ đợt'

export function slipDays(
  log: { kind: string; date_after: string | null; created_at: string; reason?: string | null }[],
  currentEarliest: string | null,
): number | null {
  const firstCommit = log
    .filter((e) => (e.kind === 'ncc_xac_nhan' || e.kind === 'them_dot') && e.date_after && !e.reason?.startsWith(SPLIT_REASON_PREFIX)) // prettier-ignore
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
  if (firstCommit.length === 0 || !currentEarliest) return null
  const firstAt = firstCommit[0].created_at
  const firstBatch = firstCommit.filter((e) => e.created_at === firstAt).map((e) => e.date_after!).sort() // prettier-ignore
  const d = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`)
  return Math.round((d(currentEarliest) - d(firstBatch[0])) / 86_400_000)
}

/* ── 3 · SỔ SỰ CỐ ───────────────────────────────────────────────────────── */

export const ISSUE_KINDS = ['sai_quy_cach', 'thieu_so_luong', 'du_so_luong', 'hong_loi', 'giao_tre', 'khac'] as const // prettier-ignore
export type IssueKind = (typeof ISSUE_KINDS)[number]

export const ISSUE_KIND_LABEL: Record<IssueKind, string> = {
  sai_quy_cach: 'Sai quy cách / sai mã',
  thieu_so_luong: 'Giao thiếu',
  du_so_luong: 'Giao dư',
  hong_loi: 'Hàng hỏng / lỗi',
  giao_tre: 'Giao trễ',
  khac: 'Khác',
}

/**
 * NHẮC MOQ (P3). MOQ của NCC là CHỮ TỰ DO ("500 kg", "1 xe", "2tr/đơn"). Chỉ so
 * khi đọc được một con số KÈM đơn vị trùng với ĐVT các dòng — đoán sai đơn vị
 * còn tệ hơn không nhắc. Trả câu nhắc, hoặc `null`.
 */
export function moqHint(
  moq: string | null | undefined,
  lines: { unit: string | null | undefined; qty: number }[],
): string | null {
  const text = moq?.trim()
  if (!text) return null
  const m = text.match(/(\d[\d.,]*)\s*([^\d\s/.,;]+)/)
  if (!m) return null
  const n = Number(m[1].replace(/\./g, '').replace(',', '.'))
  if (!(n > 0)) return null
  const unit = m[2].toLowerCase()
  const same = lines.filter((l) => (l.unit ?? '').trim().toLowerCase() === unit)
  if (same.length === 0) return null
  const total = same.reduce((t, l) => t + (l.qty || 0), 0)
  return total < n ? `Dưới MOQ của NCC (${text}): đơn đang đặt ${total.toLocaleString('vi-VN')} ${m[2]}` : null // prettier-ignore
}

/**
 * GIÁ LỆCH SO VỚI LẦN MUA TRƯỚC (P3) — nhắc khi soạn, cùng ngưỡng 5% mà màn
 * duyệt của Giám đốc đang tô (`approval-parts.tsx`). Trả % lệch (có dấu) hoặc
 * `null` khi không có giá cũ / lệch nhỏ.
 */
export function priceDrift(
  price: number | null | undefined,
  lastPrice: number | null | undefined,
): number | null {
  if (price == null || lastPrice == null || !(lastPrice > 0) || !(price > 0)) return null
  const pct = ((price - lastPrice) / lastPrice) * 100
  return Math.abs(pct) >= 5 ? Math.round(pct * 10) / 10 : null
}
