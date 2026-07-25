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
