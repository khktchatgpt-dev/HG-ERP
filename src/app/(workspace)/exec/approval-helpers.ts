/**
 * Toán thuần cho khu Phê duyệt (Ban Giám đốc) — tách khỏi component để test
 * đơn vị được (cùng triết lý exec-ops.ts, late-risk.ts).
 *
 * 14/08/2026 — file này TỪNG có thêm: `waitingTone`, `isBulkApprovable`,
 * `comparePending`, `matchesFilter`, `summarizeBulk`. Tất cả phục vụ buồng lái
 * master-detail `ApprovalCockpit`, đã xoá cùng lúc Hộp ký (`/exec`) thay chỗ.
 * Việc chúng làm nay nằm ở:
 *   · xếp thứ tự + gom tiền  → `execService.signBox` (server, có test)
 *   · lọc theo loại phiếu    → chip lọc trong `SignBoxScreen`
 *   · chặn ký nhanh phiếu to → cờ `SignItem.big` (`isBigApprovalIn` — có xét
 *     TIỀN TỆ, khác `isBulkApprovable` cũ vốn so mọi tiền tệ với ngưỡng VND)
 */

/** Số NGÀY đã chờ (làm tròn xuống) từ created_at đến nowIso; âm → 0. */
export function waitingDays(createdAtIso: string, nowIso: string): number {
  const created = new Date(createdAtIso).getTime()
  const now = new Date(nowIso).getTime()
  if (!Number.isFinite(created) || !Number.isFinite(now)) return 0
  const days = Math.floor((now - created) / 86_400_000)
  return days > 0 ? days : 0
}
