/**
 * Tổng hợp sản lượng theo chi tiết × công đoạn (SRS sản xuất chi tiết
 * FR-PR-04/05/06 — thay các cột tổng hợp của sheet `quan li`). Thuần,
 * chia 0 an toàn (NFR-CC-03), có test đối chiếu (NFR-QA-01).
 *
 * Quy ước (ghi rõ vì file Excel không nêu công thức):
 *  - %HT per công đoạn = đã làm / tổng cần (cap 100%).
 *  - Hoàn thành TỔNG của chi tiết = đã làm ở CÔNG ĐOẠN CUỐI / tổng cần —
 *    chi tiết chỉ "xong" khi qua hết chuỗi.
 *  - Đồng bộ (số bộ SP đủ chi tiết): min theo các chi tiết của
 *    floor(đã làm công đoạn cuối / CT-trên-SP) — chi tiết chậm nhất quyết định.
 */

export type StageOutput = {
  stage: string
  done: number
  defect: number
}

export type ComponentStageSummary = {
  stage: string
  done: number
  defect: number
  /** Thiếu/(Dư) = tổng cần − đã làm (âm = dư). */
  missing: number
  /** 0..1, cap 1; tổng cần 0 → 0 (không chia 0). */
  pct: number
  /**
   * Phần TRONG `done` do gia công ngoài NHẬN VỀ (0171) — service gắn sau khi
   * tổng hợp, chỉ có khi > 0. Hàm thuần này không tự tính.
   */
  gc?: number
}

export type ComponentSummary = {
  stages: ComponentStageSummary[]
  /** Đã làm ở công đoạn cuối cùng của chuỗi. */
  done_final: number
  /** %HT tổng = done_final / tổng cần (cap 1). */
  pct_total: number
  status: 'not_started' | 'in_progress' | 'done'
}

const r2 = (n: number) => Math.round(n * 100) / 100

/**
 * @param totalNeeded tổng cần của chi tiết/cụm (đơn vị / SP × SL đơn)
 * @param stageOrder  chuỗi công đoạn theo thứ tự (vd phôi → hàn → nguội → sơn)
 * @param outputs     sản lượng đã gộp theo công đoạn
 * @param finalStage  công đoạn CUỐI (tuỳ SP — không qua sơn thì cuối là nguội);
 *                    null/không khớp → dùng cuối danh mục.
 * @param firstStage  công đoạn ĐẦU của chuỗi (0088 — cụm bắt đầu ở hàn nên
 *                    không tính ở phôi); null/không khớp → từ đầu danh mục.
 *                    Component chỉ tính trong khoảng [firstStage..finalStage].
 */
export function summarizeComponent(
  totalNeeded: number,
  stageOrder: string[],
  outputs: StageOutput[],
  finalStage?: string | null,
  firstStage?: string | null,
): ComponentSummary {
  const finalIdx = finalStage ? stageOrder.indexOf(finalStage) : -1
  const firstIdx = firstStage ? stageOrder.indexOf(firstStage) : -1
  const start = firstIdx >= 0 ? firstIdx : 0
  const end = finalIdx >= 0 ? finalIdx : stageOrder.length - 1
  const effectiveOrder = end >= start ? stageOrder.slice(start, end + 1) : stageOrder
  const byStage = new Map(outputs.map((o) => [o.stage, o]))
  const stages: ComponentStageSummary[] = effectiveOrder.map((stage) => {
    const o = byStage.get(stage)
    const done = o?.done ?? 0
    return {
      stage,
      done,
      defect: o?.defect ?? 0,
      missing: r2(totalNeeded - done),
      pct: totalNeeded > 0 ? Math.min(done / totalNeeded, 1) : 0,
    }
  })
  const lastStage = stages[stages.length - 1]
  const doneFinal = lastStage?.done ?? 0
  const anyDone = stages.some((s) => s.done > 0)
  return {
    stages,
    done_final: doneFinal,
    pct_total: totalNeeded > 0 ? Math.min(doneFinal / totalNeeded, 1) : 0,
    status:
      totalNeeded > 0 && doneFinal >= totalNeeded
        ? 'done'
        : anyDone
          ? 'in_progress'
          : 'not_started',
  }
}

/**
 * Đồng bộ SP (FR-PR-06): số BỘ sản phẩm đã đủ mọi chi tiết qua công đoạn cuối.
 * = min theo chi tiết của floor(done_final / qty_per_unit).
 * qty_per_unit 0/thiếu → bỏ dòng đó (không chia 0); không có dòng hợp lệ → 0.
 */
export function syncedSets(
  components: { qty_per_unit: number; done_final: number }[],
): number {
  const per = components
    .filter((c) => c.qty_per_unit > 0)
    .map((c) => Math.floor(c.done_final / c.qty_per_unit))
  if (per.length === 0) return 0
  return Math.min(...per)
}

/**
 * TIẾN ĐỘ CẢ LỆNH theo CÔNG ĐOẠN, quy về BỘ SP (24/08 — màn Kế hoạch lệnh):
 * per công đoạn: cần = Σ SL SP các dòng CÓ công đoạn đó; đạt = Σ per dòng
 * min-theo-chi-tiết floor(đã làm × SL dòng / tổng cần chi tiết) — đúng quy
 * ước "đồng bộ SP = MIN" của sổ Tổng TĐ SX, áp cho TỪNG công đoạn. Chi tiết
 * chỉ tham gia ở công đoạn nằm trong khoảng [first..final] của nó (đầu vào
 * `stages` đã cắt sẵn bởi summarizeComponent).
 */
export type LsxStageProgress = {
  stage: string
  /** Σ SL SP các dòng có công đoạn này. */
  need_sets: number
  /** Σ bộ SP đã đồng bộ qua công đoạn này (min theo chi tiết, cap SL dòng). */
  done_sets: number
  /** Σ phế mọi chi tiết ở công đoạn này (đơn vị chi tiết, không quy SP). */
  defect: number
  /** 0..1, cap 1; cần 0 → 0. */
  pct: number
}

export function lsxStageProgress(
  stageOrder: string[],
  lines: { id: string; qty: number }[],
  comps: {
    order_line_id: string
    total_needed: number
    stages: { stage: string; done: number; defect: number }[]
  }[],
): LsxStageProgress[] {
  const compsByLine = new Map<string, typeof comps>()
  for (const c of comps) {
    const arr = compsByLine.get(c.order_line_id) ?? []
    arr.push(c)
    compsByLine.set(c.order_line_id, arr)
  }
  const out: LsxStageProgress[] = []
  for (const stage of stageOrder) {
    let need = 0
    let done = 0
    let defect = 0
    for (const line of lines) {
      const atStage = (compsByLine.get(line.id) ?? [])
        .map((c) => ({ c, o: c.stages.find((s) => s.stage === stage) }))
        .filter((x): x is { c: (typeof comps)[number]; o: StageOutput } => !!x.o)
      if (!atStage.length) continue
      need += line.qty
      defect += atStage.reduce((s, x) => s + x.o.defect, 0)
      // min theo chi tiết của số BỘ đã qua công đoạn — tổng cần 0 thì bỏ chi
      // tiết đó (không chia 0, như syncedSets).
      const per = atStage
        .filter((x) => x.c.total_needed > 0)
        .map((x) => Math.floor((x.o.done * line.qty) / x.c.total_needed))
      done += per.length ? Math.min(Math.min(...per), line.qty) : 0
    }
    if (need > 0 || done > 0 || defect > 0) {
      out.push({
        stage,
        need_sets: need,
        done_sets: done,
        defect: r2(defect),
        pct: need > 0 ? Math.min(done / need, 1) : 0,
      })
    }
  }
  return out
}

/**
 * Đối chiếu gia công ngoài per (chi tiết, đơn vị) — FR-OS-02:
 * thiếu/(dư) = tổng giao − tổng nhận; %HT = nhận/giao (giao 0 → 0, không chia 0).
 */
export type OutsourceSummary = {
  sent: number
  received: number
  defect: number
  missing: number
  pct: number
}

export function summarizeOutsource(
  entries: { direction: 'send' | 'receive'; qty: number; defect_qty: number }[],
): OutsourceSummary {
  let sent = 0
  let received = 0
  let defect = 0
  for (const e of entries) {
    if (e.direction === 'send') sent += e.qty
    else {
      received += e.qty
      defect += e.defect_qty
    }
  }
  return {
    sent: r2(sent),
    received: r2(received),
    defect: r2(defect),
    missing: r2(sent - received),
    pct: sent > 0 ? Math.min(received / sent, 1) : 0,
  }
}

/**
 * Cảnh báo WIP LIÊN CẤP (0088): nhập sản lượng CỤM ở công đoạn đầu của cụm
 * (vd hàn) mà số cụm đã làm vượt số CHI TIẾT con đã xong ở công đoạn cuối của
 * chúng — tức "hàn nhiều cụm hơn số chi tiết có sẵn". KHÔNG chặn, chỉ cảnh báo
 * (đồng bộ triết lý FR-PR-07). Excel gốc không kiểm được điểm này.
 *
 * @param assemblyName     tên cụm (vd "CỤM TỰA")
 * @param assembliesAfter  số cụm đã làm ở first_stage SAU khi tính lần nhập này
 * @param children         chi tiết con: cần / có; qtyPerAssembly = số chi tiết
 *                         cho 1 cụm, partDone = đã xong ở công đoạn cuối của nó
 */
export function assemblyWipWarning(
  assemblyName: string,
  assembliesAfter: number,
  children: { name: string; qtyPerAssembly: number; partDone: number }[],
): string | null {
  const short = children
    .map((c) => ({ ...c, need: r2(assembliesAfter * c.qtyPerAssembly) }))
    .filter((c) => c.need - c.partDone > 0.001)
  if (short.length === 0) return null
  const detail = short
    .map((c) => `${c.name} cần ${c.need} nhưng mới xong ${c.partDone}`)
    .join('; ')
  return `${assemblyName}: hàn ${assembliesAfter} cụm VƯỢT số chi tiết đã xong — ${detail}`
}

/**
 * Đối chiếu BÀN GIAO NỘI BỘ per (chi tiết × công đoạn × tổ) — 0090, thay cột
 * "SL giao 1..4 / Tổng giao / Thiếu-Dư" của sheet tổ trong Excel:
 *  - issued/returned = Σ production_transfers direction issue/return;
 *  - used = Σ (qty + defect_qty) của production_entries cùng bộ ba — phế cũng
 *    tiêu tốn đầu vào;
 *  - available = issued − returned − used (âm = tổ làm vượt số được giao).
 * issued = 0 nghĩa là tổ không đi qua sổ bàn giao → caller bỏ qua cảnh báo.
 */
export type TeamWipSummary = {
  issued: number
  returned: number
  used: number
  available: number
}

export function summarizeTeamWip(
  transfers: { direction: 'issue' | 'return'; qty: number }[],
  used: number,
): TeamWipSummary {
  let issued = 0
  let returned = 0
  for (const t of transfers) {
    if (t.direction === 'issue') issued += t.qty
    else returned += t.qty
  }
  return {
    issued: r2(issued),
    returned: r2(returned),
    used: r2(used),
    available: r2(issued - returned - used),
  }
}

/**
 * Cảnh báo ghi sản lượng VƯỢT số đã được bàn giao (0090). Không chặn (đồng bộ
 * FR-PR-07) — chỉ nhắc khi tổ CÓ đi qua sổ bàn giao (issued > 0).
 * @param adding qty + defect sắp ghi (phế cũng ăn đầu vào)
 */
export function teamWipShortageWarning(
  name: string,
  stage: string,
  wip: TeamWipSummary,
  adding: number,
): string | null {
  if (wip.issued <= 0) return null
  if (adding - wip.available <= 0.001) return null
  return `${name} @ ${stage}: tổ được giao ${wip.issued} (trả lại ${wip.returned}, đã dùng ${wip.used}) — ghi thêm ${r2(adding)} là VƯỢT ${r2(adding - wip.available)} so với số được giao`
}

/**
 * Cảnh báo WIP ÂM THEO CHUỖI CÔNG ĐOẠN (production-roles §2, làm 24/08): ghi
 * công đoạn SAU mà tổng sẽ thành > số đã xong công đoạn TRƯỚC của CÙNG chi
 * tiết. KHÔNG chặn — số nhập có thể đúng mà sổ công đoạn trước ghi thiếu;
 * việc của cảnh báo là bắt người nhập liếc lại trước khi Ctrl+Enter. Bù lỗ
 * hổng: teamWipShortageWarning im lặng khi tổ không đi qua sổ bàn giao
 * (issued = 0), overrunWarning chỉ so với TỔNG CẦN chứ không so công đoạn
 * trước.
 */
export function stageChainWarning(
  name: string,
  stage: string,
  prevStage: string,
  prevDone: number,
  alreadyDone: number,
  adding: number,
): string | null {
  const after = alreadyDone + adding
  if (after - prevDone <= 0.001) return null
  return `${name}: ${stage} sẽ thành ${r2(after)} mà ${prevStage} mới xong ${r2(prevDone)} — kiểm tra lại số hoặc sổ công đoạn trước`
}

/**
 * Backflush khối lượng (0090): kg bỏ trống → dm_kg × qty (Excel cũng TÍNH
 * "Khối lượng đã làm" = ĐM × SL chứ không nhập tay). Người nhập ghi đè được;
 * không có định mức → null (không đoán).
 */
export function backflushKg(
  kg: number | null | undefined,
  dmKg: number | null,
  qty: number,
): number | null {
  if (kg != null) return kg
  if (dmKg == null || dmKg <= 0 || qty <= 0) return null
  return r2(dmKg * qty)
}

// ── GĐ2/GĐ3 plan-sx (23/08/2026): chỉ tiêu ngày suy từ lộ trình + nghẽn WIP ──

/**
 * Xưởng có làm CHỦ NHẬT không — một chỗ duy nhất, đổi ở đây.
 * User chốt 23/08/2026: CÓ, xưởng làm cả Chủ nhật.
 */
export const WORKING_SUNDAYS = true

/** Đếm ngày làm việc trong [fromIso..toIso] (bỏ CN trừ khi WORKING_SUNDAYS). */
function workingDays(fromIso: string, toIso: string): number {
  let count = 0
  const d = new Date(`${fromIso}T00:00:00Z`)
  const end = Date.parse(`${toIso}T00:00:00Z`)
  while (d.getTime() <= end) {
    if (WORKING_SUNDAYS || d.getUTCDay() !== 0) count++
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return count
}

/**
 * CHỈ TIÊU NGÀY suy từ lộ trình (GĐ2 bước 1 — KHÔNG bắt ai nhập thêm):
 * phần còn lại của (dòng SP × công đoạn) chia đều số ngày làm việc còn lại
 * trong khoảng kế hoạch. Quá hạn → NỢ DỒN cả phần còn lại vào hôm nay.
 * null = job chưa lên lộ trình (không có planned_end) — không vào mẫu số %.
 */
export function deriveDailyTarget(opts: {
  needQty: number
  /** Đã làm LUỸ KẾ ĐẾN HẾT HÔM QUA (không tính hôm nay). */
  doneQty: number
  plannedStart: string | null
  plannedEnd: string | null
  todayIso: string
}): number | null {
  const { needQty, doneQty, plannedStart, plannedEnd, todayIso } = opts
  if (!plannedEnd) return null
  const remaining = Math.max(needQty - doneQty, 0)
  if (remaining <= 0) return 0
  // Chưa tới lượt theo kế hoạch → hôm nay chưa phải làm.
  if (plannedStart && todayIso < plannedStart.slice(0, 10)) return 0
  const end = plannedEnd.slice(0, 10)
  if (end < todayIso) return r2(remaining)
  const days = workingDays(todayIso, end)
  // Khoảng còn lại toàn CN (nghỉ) → coi như hạn chót, dồn cả.
  if (days <= 0) return r2(remaining)
  return r2(remaining / days)
}

/**
 * Nhịp SUY cho CẢ khung kế hoạch — dùng ở editor lúc ĐẶT hạn: người lập gõ
 * xong hai đầu ngày là thấy ngay "≈ bao nhiêu SP/ngày" để tự lượng khung có
 * hợp lý không. Khác deriveDailyTarget (tính từ HÔM NAY cho phần còn lại),
 * hàm này chia đều toàn bộ SL cho số ngày làm việc trong [start..end].
 * Làm tròn LÊN: "ít nhất X/ngày mới kịp". null = thiếu một đầu / khoảng ngược.
 */
export function paceForWindow(
  qty: number,
  startIso: string | null,
  endIso: string | null,
): number | null {
  if (!startIso || !endIso || qty <= 0) return null
  const start = startIso.slice(0, 10)
  const end = endIso.slice(0, 10)
  if (end < start) return null
  const days = workingDays(start, end)
  if (days <= 0) return null
  return Math.ceil(qty / days)
}

export type TeamStageQty = {
  team_department_id: string | null
  stage: string
  qty: number
}

/**
 * Hợp nhất chỉ tiêu ngày (GĐ 2.2 — 0168): (tổ × công đoạn) CÓ chỉ tiêu THẬT
 * do Kế hoạch giao thì dùng số thật — kể cả 0 ("hôm nay tổ này làm việc khác"
 * cũng là một chỉ tiêu); không có dòng thật → rơi về số SUY từ lộ trình.
 * Việc chưa giao tổ chỉ có vế suy (không ai giao chỉ tiêu cho "không tổ").
 */
export function resolveDailyTargets(
  derived: TeamStageQty[],
  real: { team_department_id: string; stage: string; qty: number }[],
): { total: number; by_team: Map<string, number> } {
  const realByTS = new Map(real.map((r) => [`${r.team_department_id}|${r.stage}`, r.qty]))
  const derivedByTS = new Map<string, number>()
  let noTeam = 0
  for (const d of derived) {
    if (!d.team_department_id) {
      noTeam += d.qty
      continue
    }
    const k = `${d.team_department_id}|${d.stage}`
    derivedByTS.set(k, (derivedByTS.get(k) ?? 0) + d.qty)
  }
  const keys = new Set([...derivedByTS.keys(), ...realByTS.keys()])
  const byTeam = new Map<string, number>()
  let total = noTeam
  for (const k of keys) {
    const qty = realByTS.has(k) ? realByTS.get(k)! : (derivedByTS.get(k) ?? 0)
    total += qty
    const team = k.slice(0, k.indexOf('|'))
    byTeam.set(team, r2((byTeam.get(team) ?? 0) + qty))
  }
  return { total: r2(total), by_team: byTeam }
}

/**
 * NGÀY DỰ KIẾN XONG = còn lại ÷ nhịp (TB SL/ngày của các ngày CÓ ghi sổ gần
 * nhất), đếm ngày lịch (xưởng làm cả CN — chốt 23/08). null = đã đủ số hoặc
 * chưa có nhịp để suy (đừng đoán).
 */
export function forecastFinishDate(
  remaining: number,
  recentDaily: number[],
  todayIso: string,
): string | null {
  if (remaining <= 0) return null
  const pace = recentDaily.length
    ? recentDaily.reduce((a, b) => a + b, 0) / recentDaily.length
    : 0
  if (pace <= 0) return null
  const d = new Date(`${todayIso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + Math.ceil(remaining / pace))
  return d.toISOString().slice(0, 10)
}

/** Ngưỡng nghẽn: tồn WIP đủ cho > N ngày làm theo nhịp hiện tại. */
export const BOTTLENECK_DAYS = 3
/** Tổ ôm phôi mà im hơi quá N ngày (không ghi sổ) cũng tính là nghẽn. */
export const BOTTLENECK_IDLE_DAYS = 2

/**
 * NGHẼN tại (tổ × công đoạn) — GĐ3: tồn WIP so với nhịp làm của CHÍNH tổ đó.
 * @param wipAvailable tồn tại tổ (summarizeTeamWip.available)
 * @param recentDaily  SL đạt của các NGÀY CÓ GHI SỔ gần nhất (tối đa 7 ngày)
 * @param idleDays     số ngày từ lần ghi sổ gần nhất (không có sổ → từ lần giao)
 */
export function isTeamStageBottleneck(
  wipAvailable: number,
  recentDaily: number[],
  idleDays: number,
): boolean {
  if (wipAvailable <= 0) return false
  const pace = recentDaily.length
    ? recentDaily.reduce((a, b) => a + b, 0) / recentDaily.length
    : 0
  if (pace > 0) return wipAvailable / pace > BOTTLENECK_DAYS
  return idleDays > BOTTLENECK_IDLE_DAYS
}

/**
 * Nhịp so với kế hoạch của 1 ô (chi tiết × công đoạn) — tô nền sổ tổng (GĐ3):
 *  - 'late'   = quá planned_end mà chưa đủ số;
 *  - 'behind' = đã qua NỬA khoảng kế hoạch mà chưa được nửa số;
 *  - null     = bình thường / xong / không có kế hoạch để so.
 */
export function paceTone(opts: {
  done: number
  needed: number
  plannedStart: string | null
  plannedEnd: string | null
  todayIso: string
}): 'late' | 'behind' | null {
  const { done, needed, plannedStart, plannedEnd, todayIso } = opts
  if (needed <= 0 || done >= needed) return null
  if (!plannedEnd) return null
  const end = plannedEnd.slice(0, 10)
  if (end < todayIso) return 'late'
  if (!plannedStart) return null
  const start = plannedStart.slice(0, 10)
  const span = Date.parse(end) - Date.parse(start)
  if (span <= 0) return null
  const elapsed = Date.parse(todayIso) - Date.parse(start)
  if (elapsed / span > 0.5 && done / needed < 0.5) return 'behind'
  return null
}

/** Cảnh báo nhập vượt (FR-PR-07): đã làm + sắp nhập > tổng cần → chuỗi cảnh báo. */
export function overrunWarning(
  name: string,
  stage: string,
  alreadyDone: number,
  adding: number,
  totalNeeded: number,
): string | null {
  const after = alreadyDone + adding
  if (totalNeeded > 0 && after > totalNeeded) {
    return `${name} @ ${stage}: đã làm ${after}/${totalNeeded} — VƯỢT ${r2(after - totalNeeded)}`
  }
  return null
}

// ── BƯỚC 3 — LOGIC: kế hoạch → thực tế → lũy kế → tiến độ → trạng thái ──────
//
// Năm công thức chốt 26/08/2026. Nguyên tắc xuyên suốt: thống kê KHÔNG bao giờ
// nhập "còn lại" hay "tiến độ" — mọi số dẫn xuất tính ở đây.

/**
 * Sản lượng gộp của MỘT (chi tiết × công đoạn), tách theo trạng thái phiếu.
 *
 *  - `confirmed` — phiếu tổ trưởng ĐÃ xác nhận (`da_xac_nhan`). Chỉ số này vào
 *    tiến độ chính thức, theo đúng luật "Đã đạt lũy kế = Σ phiếu đã xác nhận".
 *  - `pending`   — phiếu đã gửi, ĐANG chờ tổ trưởng duyệt (`cho_xac_nhan`).
 *
 * Phiếu `nhap` (nháp chưa gửi) và `tu_choi` (bị trả về, số đang sai) KHÔNG thuộc
 * nhóm nào — caller không đưa vào. Cố ý: nháp là việc riêng của thống kê, còn
 * phiếu bị từ chối mà vẫn cộng vào "chờ" sẽ vẽ ra tiến độ không có thật.
 */
export type EntryTally = {
  confirmed: { qty: number; defect: number }
  pending: { qty: number; defect: number }
}

export type StageProgress = {
  /** Kế hoạch của công đoạn = SL dòng SP × định mức/SP (KHÔNG nhập tay). */
  planned: number
  /** Đã đạt lũy kế — chỉ đếm phiếu đã xác nhận. */
  done: number
  defect: number
  /** Còn lại = kế hoạch − đã đạt; kẹp ở 0 (làm dư không thành số âm). */
  remaining: number
  /** Tiến độ = đã đạt / kế hoạch, kẹp trần 1. */
  pct: number
  /** Tỷ lệ lỗi = lỗi / thực hiện, với thực hiện = đạt + lỗi. */
  defect_rate: number
  /**
   * Đang chờ tổ trưởng duyệt — bày RIÊNG, không cộng vào `done`. Có số này thì
   * mới thấy được "tiến độ đứng im vì chưa ai duyệt", thay vì tưởng xưởng nghỉ.
   */
  pending_qty: number
  /**
   * Suy TỪ SỐ, không lưu cứng. Không có 'paused' — tạm dừng là quyết định của
   * người, phải có ai đó bấm, không suy ra được từ sản lượng.
   */
  status: 'not_started' | 'in_progress' | 'done'
}

/** Thực hiện = đạt + lỗi (không lưu thành cột — xem 0176). */
export function totalRun(qty: number, defect: number): number {
  return r2(qty + defect)
}

/** Tỷ lệ lỗi = lỗi / thực hiện. Chưa làm gì → 0 (không chia 0). */
export function defectRate(qty: number, defect: number): number {
  const run = qty + defect
  if (run <= 0) return 0
  return defect / run
}

/**
 * Gộp cả năm công thức cho một (chi tiết × công đoạn).
 * `planned = 0` (chưa định hình) → mọi tỷ lệ về 0, KHÔNG chia 0 và không vẽ ra
 * tiến độ 100% giả.
 */
export function stageProgress(planned: number, tally: EntryTally): StageProgress {
  const done = tally.confirmed.qty
  const defect = tally.confirmed.defect
  const pendingQty = tally.pending.qty
  return {
    planned: r2(planned),
    done: r2(done),
    defect: r2(defect),
    remaining: r2(Math.max(0, planned - done)),
    pct: planned > 0 ? Math.min(done / planned, 1) : 0,
    defect_rate: defectRate(done, defect),
    pending_qty: r2(pendingQty),
    status:
      planned > 0 && done >= planned ? 'done' : done > 0 ? 'in_progress' : 'not_started',
  }
}
