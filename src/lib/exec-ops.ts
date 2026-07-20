/**
 * Toán thuần cho khu Ban Giám Đốc (Báo cáo CEO + Tháp điều hành COO) —
 * tách khỏi ops.service để test đơn vị được (cùng triết lý late-risk.ts,
 * production-summary.ts). Caller truyền todayIso để pure/testable.
 */

// ── Ngưỡng phê duyệt "Giá trị lớn — cần Giám đốc" ──────────────────────────
// Không routing cứng theo vai (CEO/COO cùng role manager — user chốt 07/2026),
// chỉ badge nhắc trên thẻ duyệt. Đổi ngưỡng: sửa 1 chỗ này.
export const BIG_APPROVAL_VND = 50_000_000

export function isBigApproval(total: number): boolean {
  return total >= BIG_APPROVAL_VND
}

// ── Dòng sản lượng gọn (khớp cột outputsRepo.listRange) ─────────────────────
export type SlimOutputEntry = {
  production_order_id: string
  component_id: string
  stage: string
  team_department_id: string | null
  entry_date: string
  qty: number
  defect_qty: number
  defect_reason: string | null
}

// ── Gộp tuần cho biểu đồ sản lượng (CEO) ────────────────────────────────────

/** Thứ Hai đầu tuần của 1 ngày yyyy-mm-dd (UTC — tránh lệch múi giờ). */
export function weekStartIso(dateIso: string): string {
  const d = new Date(`${dateIso}T00:00:00Z`)
  const day = d.getUTCDay() // 0 = CN
  const diff = day === 0 ? 6 : day - 1
  d.setUTCDate(d.getUTCDate() - diff)
  return d.toISOString().slice(0, 10)
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * N tuần gần nhất (kết thúc ở tuần chứa todayIso), cũ → mới; tuần không có
 * sản lượng vẫn có mặt (qty 0) để trục biểu đồ liền mạch. Entry ngoài khoảng bỏ.
 */
export function bucketByWeek(
  entries: { entry_date: string; qty: number; defect_qty: number }[],
  weeks: number,
  todayIso: string,
): { week_start: string; qty: number; defect: number }[] {
  const lastWeek = weekStartIso(todayIso)
  const buckets = new Map<string, { week_start: string; qty: number; defect: number }>()
  for (let i = weeks - 1; i >= 0; i--) {
    const ws = addDaysIso(lastWeek, -7 * i)
    buckets.set(ws, { week_start: ws, qty: 0, defect: 0 })
  }
  for (const e of entries) {
    const b = buckets.get(weekStartIso(e.entry_date))
    if (!b) continue
    b.qty += Number(e.qty)
    b.defect += Number(e.defect_qty)
  }
  return [...buckets.values()]
}

// ── WIP ứ đọng giữa 2 công đoạn kế tiếp (bottleneck strip — COO) ────────────

/** Input = summary.stages per chi tiết (đã cắt theo lộ trình + final_stage). */
export type WipComponent = { stages: { stage: string; done: number }[] }

/**
 * Mỗi cặp công đoạn kế tiếp trong stageOrder: wip = Σ max(0, done_trước −
 * done_sau) — CHỈ tính chi tiết có CẢ 2 công đoạn (route chứa cả hai; lệnh
 * chưa định hình có đủ danh mục nên tự được tính). Không âm: tổ sau làm dư
 * (nhập bù) không tạo "ứ âm" gây nhiễu.
 */
export function wipBetweenStages(
  components: WipComponent[],
  stageOrder: string[],
): { from: string; to: string; wip: number }[] {
  const out: { from: string; to: string; wip: number }[] = []
  for (let i = 0; i < stageOrder.length - 1; i++) {
    const a = stageOrder[i]
    const b = stageOrder[i + 1]
    let wip = 0
    for (const c of components) {
      const da = c.stages.find((s) => s.stage === a)
      const db = c.stages.find((s) => s.stage === b)
      if (!da || !db) continue
      wip += Math.max(0, Number(da.done) - Number(db.done))
    }
    out.push({ from: a, to: b, wip })
  }
  return out
}

// ── Màu ô tổ trên sơ đồ xưởng (COO) ─────────────────────────────────────────

/** Ngưỡng BTP ứ trước tổ coi là "chậm" — chỉnh sau khi xưởng dùng thử. */
export const WIP_ALERT_QTY = 50

export type TeamStatusInput = {
  hasOpenIncident: boolean
  doing: number
  todayQty: number
  wipBefore: number
  wipAlert?: number
}

/**
 * red = có sự cố mở (thắng mọi thứ) · yellow = đang có việc mà hôm nay chưa
 * ghi sản lượng, hoặc BTP ứ trước tổ vượt ngưỡng · green = còn lại (tổ rảnh
 * không việc cũng xanh — rảnh không phải lỗi).
 */
export function teamStatusColor(i: TeamStatusInput): 'red' | 'yellow' | 'green' {
  if (i.hasOpenIncident) return 'red'
  const wipAlert = i.wipAlert ?? WIP_ALERT_QTY
  if ((i.doing > 0 && i.todayQty === 0) || i.wipBefore > wipAlert) return 'yellow'
  return 'green'
}

// ── Chất lượng / root cause (COO) ───────────────────────────────────────────

/** Tỷ lệ phế = Σphế / ΣSL; SL 0 → 0 (chia 0 an toàn — NFR-CC-03). */
export function defectStats(entries: { qty: number; defect_qty: number }[]): {
  qty: number
  defect: number
  rate: number
} {
  let qty = 0
  let defect = 0
  for (const e of entries) {
    qty += Number(e.qty)
    defect += Number(e.defect_qty)
  }
  return { qty, defect, rate: qty > 0 ? defect / qty : 0 }
}

/** Gộp sản lượng/phế theo tổ (key null = bản ghi không rõ tổ). */
export function defectByTeam(
  entries: SlimOutputEntry[],
): Map<string | null, { qty: number; defect: number }> {
  const m = new Map<string | null, { qty: number; defect: number }>()
  for (const e of entries) {
    const cur = m.get(e.team_department_id) ?? { qty: 0, defect: 0 }
    cur.qty += Number(e.qty)
    cur.defect += Number(e.defect_qty)
    m.set(e.team_department_id, cur)
  }
  return m
}

export const UNCLASSIFIED_REASON = 'Chưa phân loại'

/**
 * Top nguyên nhân phế của 1 tổ: count = Σ defect_qty theo defect_reason;
 * reason null (bản ghi trước 0067) → "Chưa phân loại"; code không còn trong
 * danh mục → hiện raw code. Sort giảm dần.
 */
export function topDefectReasons(
  entries: SlimOutputEntry[],
  teamId: string | null,
  labelByCode: Map<string, string>,
): { code: string | null; label: string; count: number }[] {
  const byCode = new Map<string | null, number>()
  for (const e of entries) {
    if (e.team_department_id !== teamId) continue
    const d = Number(e.defect_qty)
    if (d <= 0) continue
    byCode.set(e.defect_reason, (byCode.get(e.defect_reason) ?? 0) + d)
  }
  return [...byCode.entries()]
    .map(([code, count]) => ({
      code,
      label: code === null ? UNCLASSIFIED_REASON : (labelByCode.get(code) ?? code),
      count,
    }))
    .sort((a, b) => b.count - a.count)
}

// ── %HT đồng bộ bộ của 1 đơn (card Đơn trọng điểm — CEO) ────────────────────

/**
 * Σ bộ đồng bộ / Σ SL đặt trên các dòng ĐÃ CÓ bảng chi tiết; chưa dòng nào có
 * → 0 (chưa đo được). Cap 1 (nhập dư không vượt 100%).
 */
export function orderSyncPct(
  lines: { qty: number; synced_sets: number; has_components: boolean }[],
): number {
  let need = 0
  let done = 0
  for (const l of lines) {
    if (!l.has_components) continue
    need += Number(l.qty)
    done += Number(l.synced_sets)
  }
  if (need <= 0) return 0
  return Math.min(1, done / need)
}
