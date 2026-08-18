/**
 * Toán thuần cho khu Phê duyệt (Ban Giám đốc) — tách khỏi component để test
 * đơn vị được (cùng triết lý exec-ops.ts, late-risk.ts).
 *
 * 14/08/2026 — file này TỪNG có thêm: `waitingTone`, `isBulkApprovable`,
 * `comparePending`, `matchesFilter`, `summarizeBulk`. Tất cả phục vụ buồng lái
 * master-detail `ApprovalCockpit`, đã xoá cùng lúc Hộp ký (`/exec`) thay chỗ.
 * Việc chúng làm nay nằm ở:
 *   · xếp thứ tự + gom tiền  → `execService.signBox` (server, có test)
 *   · lọc theo loại phiếu    → chip lọc trong `approvals/ApprovalCenterScreen`
 *   · chặn ký nhanh phiếu to → cờ `SignItem.big` (`isBigApprovalIn` — có xét
 *     TIỀN TỆ, khác `isBulkApprovable` cũ vốn so mọi tiền tệ với ngưỡng VND)
 */

/**
 * Tiền LUÔN đi kèm MÃ TIỀN TỆ. Trước 17/08/2026 trang chi tiết duyệt in cứng
 * "₫" và "tr" (triệu đồng) cho mọi phiếu, trong khi Trung tâm phê duyệt đã hiện
 * đúng "3.000 USD" — cùng một đơn, hai màn nói hai số khác nhau. Đơn mua và đơn
 * hàng đều có cả USD, mà Giám đốc ký theo con số nhìn thấy.
 */
export function money(value: number, currency: string): string {
  return `${new Intl.NumberFormat('vi-VN', {
    maximumFractionDigits: currency === 'VND' ? 0 : 2,
  }).format(value)} ${currency}`
}

/**
 * Cộng tiền theo TỪNG tiền tệ — USD và VND không bao giờ cộng chung (lệnh gộp
 * nhiều đơn có thể lẫn tiền tệ). Bỏ nhánh 0 đồng để khỏi in "0 VND · 500 USD";
 * không còn nhánh nào thì trả '—'.
 */
export function moneyByCurrency(items: { value: number; currency: string }[]): string {
  const m = new Map<string, number>()
  for (const i of items) m.set(i.currency, (m.get(i.currency) ?? 0) + i.value)
  const parts = [...m.entries()].filter(([, v]) => v > 0)
  return parts.length ? parts.map(([c, v]) => money(v, c)).join(' · ') : '—'
}

/** Số NGÀY đã chờ (làm tròn xuống) từ created_at đến nowIso; âm → 0. */
export function waitingDays(createdAtIso: string, nowIso: string): number {
  const created = new Date(createdAtIso).getTime()
  const now = new Date(nowIso).getTime()
  if (!Number.isFinite(created) || !Number.isFinite(now)) return 0
  const days = Math.floor((now - created) / 86_400_000)
  return days > 0 ? days : 0
}
