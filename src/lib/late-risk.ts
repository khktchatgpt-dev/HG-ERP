/**
 * Cảnh báo trễ / thiếu vật tư (FR-SAL-09) — logic thuần, dùng cả server (widget)
 * lẫn client (badge tracking). Caller truyền `todayIso` (yyyy-mm-dd) để pure/testable.
 *
 * Chỉ HIỂN THỊ trên UI — notification đẩy theo lịch để GĐ2 khi có hạ tầng cron
 * (xem docs/plan-supply-completion.md P2).
 */

export const LATE_RISK_HORIZON_DAYS = 7

/** Trường cần từ v_order_tracking (subset — đủ để đánh giá). */
export type LateRiskInput = {
  status: string
  due_date: string | null
  lines_bom_pending: number
  pos_open: number
  production_order_id: string | null
  lsx_status: string | null
}

export type LateRisk = {
  /** overdue = đã quá hạn giao; at_risk = còn ≤ horizon ngày. */
  level: 'overdue' | 'at_risk'
  /** Vì sao có nguy cơ (rỗng = chỉ là sát hạn, chuỗi vẫn đang chạy). */
  reasons: string[]
}

const FINAL_STATUSES = new Set(['completed', 'delivered', 'cancelled'])

export function assessLateRisk(
  row: LateRiskInput,
  todayIso: string,
  horizonDays = LATE_RISK_HORIZON_DAYS,
): LateRisk | null {
  if (FINAL_STATUSES.has(row.status)) return null
  if (!row.due_date) return null // không có hạn giao — không có cơ sở cảnh báo

  const overdue = row.due_date < todayIso
  if (!overdue && row.due_date > addDays(todayIso, horizonDays)) return null

  const reasons: string[] = []
  if (!row.production_order_id) reasons.push('Chưa phát LSX')
  else if (row.lsx_status === 'pending_approval') reasons.push('LSX chờ GĐ duyệt')
  else if (row.lsx_status === 'rejected') reasons.push('LSX bị từ chối')
  else if (row.lsx_status === 'approved') reasons.push('Chưa vào sản xuất')
  if (row.lines_bom_pending > 0) {
    reasons.push(`${row.lines_bom_pending} dòng SP chưa xong BOM`)
  }
  if (row.pos_open > 0) reasons.push(`${row.pos_open} đơn vật tư chưa về đủ`)

  return { level: overdue ? 'overdue' : 'at_risk', reasons }
}

/** Cộng ngày trên chuỗi yyyy-mm-dd (UTC — tránh lệch múi giờ). */
function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
