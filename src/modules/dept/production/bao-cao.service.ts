import { entriesRepo } from './entries.repo'
import { componentsRepo } from './components.repo'
import { productionRepo } from './production.repo'
import { lsxLinesRepo } from './lsx-lines.repo'
import { transfersRepo } from './transfers.repo'
import { transferDocsRepo } from './transfer-docs.repo'
import { targetsRepo } from './targets.repo'
import { dayLocksRepo } from './day-locks.repo'
import { defectCodesRepo } from './defect-codes.repo'
import { REPORT_MAX_DAYS } from './reports.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { resolveTeamStage } from '@/lib/stage-for-dept'
import { resolveStageConfigs, type CountLevel } from '@/lib/stage-config'
import { countsAsOfficial, type EntryDocStatus } from '@/lib/entry-doc-flow'
import { totalKey, transferTotals, wipNumbers } from '@/lib/wip-numbers'
import { shiftIso, vnTodayIso } from '@/lib/local-date'
import { BadRequest } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'

/**
 * BÁO CÁO SẢN XUẤT — màn S6 (B6, docs/san-xuat-cau-hinh-thiet-ke.md).
 *
 * Quản đốc / Giám đốc — "tuần này tổ nào đạt chỉ tiêu, lỗi nào nhiều nhất, hàng
 * sửa lại còn treo bao nhiêu, kẹt ở công đoạn nào?". Sáu bảng trên MỘT payload:
 * bốn bảng dựng từ cùng dữ liệu `reports.service` đang có (sổ kỳ tự do), hai
 * bảng mới của bản tư vấn (sửa lại còn treo · tồn công đoạn). Tồn công đoạn
 * tính bằng `wipNumbers` + `transferTotals` — cùng hàm với Hồ sơ lệnh, Ghi sản
 * lượng, Giao nhận.
 *
 * KHÔNG có dòng "tổng toàn xưởng" ở bảng theo tổ: phôi đếm chi tiết, hàn đếm
 * cụm — cộng dọc là số vô nghĩa (bài học Sổ tổng 24/08). Mỗi dòng mang đơn vị
 * của nó.
 */

const r2 = (n: number) => Math.round(n * 100) / 100

export type SanLuongToRow = {
  team_id: string
  team_name: string
  stage: string
  stage_label: string
  count_level: CountLevel
  by_day: { qty: number; defect: number }[]
  total_qty: number
  total_defect: number
  total_rework: number
  /** Σ chỉ tiêu ngày (production_daily_targets) trong kỳ; null = chưa có chỉ tiêu. */
  target: number | null
  /** Số ngày trong kỳ tổ đã chốt sổ. */
  locked_days: number
}

export type LoiRow = {
  code: string | null
  label: string
  stage_label: string
  defect: number
  rework: number
  total: number
  cum_pct: number
  share: number
  top_lsx: string | null
}

export type SuaLaiTreoRow = {
  lsx_id: string
  lsx_code: string
  product_code: string
  comp: string
  cluster: string | null
  stage_label: string
  team_name: string | null
  rework: number
  /** Đạt ghi SAU lần sửa đầu, đã bù vào phần treo. */
  bu: number
  treo: number
  last_date: string
}

export type TonCongDoanRow = {
  lsx_id: string
  lsx_code: string
  product_code: string
  comp: string
  cluster: string | null
  stage: string
  stage_label: string
  count_level: CountLevel
  done: number
  shipped: number
  on_hand: number
  /** Phiếu giao đi từ đây còn chờ tổ nhận xác nhận. */
  cho_nhan: number
}

export type BaoCaoPayload = {
  from: string
  to: string
  days: string[]
  today: string
  teams: { id: string; name: string; stage_code: string | null }[]
  stages: { code: string; label: string; count_level: CountLevel }[]
  lsx: { id: string; code: string; customer_name: string }[]
  san_luong_to: SanLuongToRow[]
  loi: LoiRow[]
  loi_tong: { defect: number; rework: number; free_text: number; codes_total: number }
  sua_lai_treo: SuaLaiTreoRow[]
  ton_cong_doan: TonCongDoanRow[]
}

export const baoCaoService = {
  async get(
    user: User,
    opts: { from: string; to: string; team?: string },
  ): Promise<BaoCaoPayload> {
    const { from, to } = opts
    const nDays = Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000) + 1
    if (nDays <= 0) throw BadRequest('Khoảng ngày không hợp lệ (từ phải ≤ đến)')
    if (nDays > REPORT_MAX_DAYS)
      throw BadRequest(`Kỳ báo cáo tối đa ${REPORT_MAX_DAYS} ngày`)
    const days = Array.from({ length: nDays }, (_, i) => shiftIso(from, i))
    const today = vnTodayIso()

    const [entriesAll, stagesCat, depts, targets, locks, codes, active] =
      await Promise.all([
        entriesRepo.listRange(from, to),
        productionRepo.listStages(),
        departmentsRepo.list(),
        targetsRepo.listRange(from, to),
        dayLocksRepo.listRange(from, to),
        defectCodesRepo.listActive(),
        productionRepo.listActive(),
      ])
    const cfg = resolveStageConfigs(stagesCat)
    const levelOf = (s: string) =>
      cfg.find((c) => c.code === s)?.meta.count_level ?? ('part' as CountLevel)
    const stageLabel = (s: string) => stagesCat.find((x) => x.code === s)?.label ?? s
    const teams = depts
      .filter((d) => d.workspace_id === 'production')
      .map((d) => ({
        id: d.id,
        name: d.name,
        stage_code: resolveTeamStage(d, stagesCat),
      }))
    const teamName = (id: string | null) =>
      (id && teams.find((t) => t.id === id)?.name) || '(không rõ tổ)'
    const entries = entriesAll.filter(
      (e) => !opts.team || e.team_department_id === opts.team,
    )
    const lsxIds = [...new Set(entries.map((e) => e.production_order_id))]
    const codesById = await productionRepo.listCodesByIds(lsxIds)

    // ── 1 · Sản lượng theo tổ × công đoạn × ngày ───────────────────────────
    const dayIdx = new Map(days.map((d, i) => [d, i]))
    const slRows = new Map<string, SanLuongToRow>()
    for (const e of entries) {
      const k = `${e.team_department_id ?? ''}|${e.stage}`
      let row = slRows.get(k)
      if (!row) {
        row = {
          team_id: e.team_department_id ?? '',
          team_name: teamName(e.team_department_id),
          stage: e.stage,
          stage_label: stageLabel(e.stage),
          count_level: levelOf(e.stage),
          by_day: days.map(() => ({ qty: 0, defect: 0 })),
          total_qty: 0,
          total_defect: 0,
          total_rework: 0,
          target: null,
          locked_days: 0,
        }
        slRows.set(k, row)
      }
      const i = dayIdx.get(e.entry_date)
      if (i != null) {
        row.by_day[i].qty += e.qty
        row.by_day[i].defect += e.defect_qty
      }
      row.total_qty += e.qty
      row.total_defect += e.defect_qty
      row.total_rework += e.rework_qty
    }
    for (const t of targets) {
      const row = slRows.get(`${t.team_department_id}|${t.stage}`)
      if (row) row.target = (row.target ?? 0) + t.qty
    }
    const lockedByTeam = new Map<string, Set<string>>()
    for (const l of locks) {
      const s = lockedByTeam.get(l.team_department_id) ?? new Set()
      s.add(l.entry_date)
      lockedByTeam.set(l.team_department_id, s)
    }
    const stageOrder = new Map(stagesCat.map((s, i) => [s.code, i]))
    const san_luong_to = [...slRows.values()]
      .map((r) => ({
        ...r,
        total_qty: r2(r.total_qty),
        total_defect: r2(r.total_defect),
        total_rework: r2(r.total_rework),
        locked_days: lockedByTeam.get(r.team_id)?.size ?? 0,
      }))
      .sort(
        (a, b) =>
          (stageOrder.get(a.stage) ?? 99) - (stageOrder.get(b.stage) ?? 99) ||
          a.team_name.localeCompare(b.team_name),
      )

    // ── 2 · Lỗi theo mã (Pareto) — phế + sửa lại ───────────────────────────
    const codeLabel = new Map(codes.map((c) => [c.code, c.label]))
    const codeStage = new Map(codes.map((c) => [c.code, c.stage_code]))
    type LoiAcc = LoiRow & { by_lsx: Map<string, number> }
    const loiAcc = new Map<string, LoiAcc>()
    let freeText = 0
    for (const e of entries) {
      const bad = e.defect_qty + e.rework_qty
      if (bad <= 0) continue
      const code = e.defect_code ?? null
      const reason = (e.defect_reason ?? '').trim()
      if (!code && reason) freeText++
      const key = code ?? (reason ? `~${reason.toLocaleLowerCase('vi')}` : '~')
      let row = loiAcc.get(key)
      if (!row) {
        row = {
          code,
          label: code ? (codeLabel.get(code) ?? code) : reason || '(không ghi lý do)',
          stage_label: code
            ? codeStage.get(code)
              ? stageLabel(codeStage.get(code)!)
              : 'chung'
            : stageLabel(e.stage),
          defect: 0,
          rework: 0,
          total: 0,
          cum_pct: 0,
          share: 0,
          top_lsx: null,
          by_lsx: new Map(),
        }
        loiAcc.set(key, row)
      }
      row.defect += e.defect_qty
      row.rework += e.rework_qty
      row.total += bad
      row.by_lsx.set(
        e.production_order_id,
        (row.by_lsx.get(e.production_order_id) ?? 0) + bad,
      )
    }
    const loiSorted = [...loiAcc.values()].sort((a, b) => b.total - a.total)
    const loiTotal = loiSorted.reduce((a, r) => a + r.total, 0)
    let cum = 0
    const loi: LoiRow[] = loiSorted.map((r) => {
      cum += r.total
      const top = [...r.by_lsx.entries()].sort((a, b) => b[1] - a[1])[0]
      return {
        code: r.code,
        label: r.label,
        stage_label: r.stage_label,
        defect: r2(r.defect),
        rework: r2(r.rework),
        total: r2(r.total),
        cum_pct: loiTotal > 0 ? Math.round((cum / loiTotal) * 100) : 0,
        share: loiTotal > 0 ? r.total / loiTotal : 0,
        top_lsx: top ? (codesById.get(top[0]) ?? null) : null,
      }
    })

    // ── 3 · Sửa lại còn treo (mọi kỳ, lệnh đang chạy) + 4 · Tồn công đoạn ──
    const activeIds = active.map((l) => l.id)
    const [allEntries, comps, lines, rawTransfers, docs] = await Promise.all([
      entriesRepo.listByLsxWithStatusBulk(activeIds),
      componentsRepo.listByLsxBulk(activeIds),
      lsxLinesRepo.listLinesBulk(activeIds),
      transfersRepo.listRawByLsxBulk(activeIds),
      transferDocsRepo.listByLsxBulk(activeIds),
    ])
    const compById = new Map(comps.map((c) => [c.id, c]))
    const lineCode = new Map(lines.map((l) => [l.id, l.product_code]))
    const lsxCode = new Map(active.map((l) => [l.id, l.code]))
    const productOf = (compId: string) => {
      const c = compById.get(compId)
      return c ? (lineCode.get(c.production_order_line_id) ?? '') : ''
    }

    // Sửa lại treo: theo thứ tự ghi, đạt ghi SAU bù vào phần sửa đang treo.
    type TreoAcc = {
      rework: number
      bu: number
      treo: number
      last: string
      team: string | null
    }
    const treo = new Map<string, TreoAcc>()
    for (const e of [...allEntries].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    )) {
      const k = `${e.component_id}|${e.stage}`
      let t = treo.get(k)
      if (!t) {
        t = { rework: 0, bu: 0, treo: 0, last: e.entry_date, team: null }
        treo.set(k, t)
      }
      if (t.treo > 0 && e.qty > 0) {
        const b = Math.min(t.treo, e.qty)
        t.bu += b
        t.treo -= b
      }
      if (e.rework_qty > 0) {
        t.rework += e.rework_qty
        t.treo += e.rework_qty
        t.last = e.entry_date
        t.team = e.team_department_id
      }
    }
    const sua_lai_treo: SuaLaiTreoRow[] = [...treo.entries()]
      .filter(([, t]) => t.treo > 0.001)
      .map(([k, t]) => {
        const [compId, stage] = k.split('|')
        const c = compById.get(compId)
        return {
          lsx_id: c?.production_order_id ?? '',
          lsx_code: c ? (lsxCode.get(c.production_order_id) ?? '') : '',
          product_code: productOf(compId),
          comp: c?.name ?? '(dòng đã xoá)',
          cluster: c?.cluster ?? null,
          stage_label: stageLabel(stage),
          team_name: t.team ? teamName(t.team) : null,
          rework: r2(t.rework),
          bu: r2(t.bu),
          treo: r2(t.treo),
          last_date: t.last,
        }
      })
      .sort((a, b) => b.treo - a.treo)

    // Tồn công đoạn = xong (chính thức) − max(đã giao, đã ghi ở công đoạn kế);
    // chờ nhận = phiếu da_giao đi từ đó. Cùng `wipNumbers` với Hồ sơ lệnh:
    // công đoạn sau đã ghi sổ thì hàng đã đi dù không ai lập PGT (10/11/2026).
    const doneAt = new Map<string, number>()
    const usedAt = new Map<string, number>()
    const stagesOfComp = new Map<string, Set<string>>()
    for (const e of allEntries) {
      const k = totalKey(e.component_id, e.stage)
      usedAt.set(k, (usedAt.get(k) ?? 0) + e.qty + e.defect_qty + e.rework_qty)
      const set = stagesOfComp.get(e.component_id) ?? new Set<string>()
      set.add(e.stage)
      stagesOfComp.set(e.component_id, set)
      if (!countsAsOfficial(e.doc_status as EntryDocStatus)) continue
      doneAt.set(k, (doneAt.get(k) ?? 0) + e.qty)
    }
    // Công đoạn KẾ của một dòng = công đoạn gần nhất SAU nó (theo danh mục) mà
    // dòng đó có sổ — không cần lộ trình đầy đủ, chỉ cần biết hàng đã sang đâu.
    const nextUsedOf = (compId: string, stage: string): number | null => {
      const cur = stageOrder.get(stage) ?? 99
      let best: { ord: number; used: number } | null = null
      for (const s of stagesOfComp.get(compId) ?? []) {
        const ord = stageOrder.get(s) ?? 99
        if (ord <= cur) continue
        if (!best || ord < best.ord) {
          best = { ord, used: usedAt.get(totalKey(compId, s)) ?? 0 }
        }
      }
      return best ? best.used : null
    }
    const totals = transferTotals(docs, rawTransfers)
    const docById = new Map(docs.map((d) => [d.id, d]))
    const choNhan = new Map<string, number>()
    for (const t of rawTransfers) {
      const d = t.doc_id ? docById.get(t.doc_id) : null
      if (!d || d.status !== 'da_giao' || d.reverses_doc_id) continue
      const k = totalKey(t.component_id, d.from_stage)
      choNhan.set(k, (choNhan.get(k) ?? 0) + t.qty)
    }
    const ton_cong_doan: TonCongDoanRow[] = []
    for (const [k, done] of doneAt) {
      const [compId, stage] = k.split('|')
      const t = totals.get(k)
      const n = wipNumbers({
        done,
        shipped: t?.shipped ?? 0,
        received: null,
        used: 0,
        next_used: nextUsedOf(compId, stage),
      })
      const cn = choNhan.get(k) ?? 0
      if (n.on_hand <= 0.001 && cn <= 0) continue
      const c = compById.get(compId)
      ton_cong_doan.push({
        lsx_id: c?.production_order_id ?? '',
        lsx_code: c ? (lsxCode.get(c.production_order_id) ?? '') : '',
        product_code: productOf(compId),
        comp: c?.name ?? '(dòng đã xoá)',
        cluster: c?.cluster ?? null,
        stage,
        stage_label: stageLabel(stage),
        count_level: levelOf(stage),
        done: n.done,
        shipped: n.shipped,
        on_hand: n.on_hand,
        cho_nhan: r2(cn),
      })
    }
    ton_cong_doan.sort(
      (a, b) =>
        (stageOrder.get(a.stage) ?? 99) - (stageOrder.get(b.stage) ?? 99) ||
        b.on_hand - a.on_hand,
    )

    // Bảng "Năng suất theo tổ" cũ GỠ 12/11/2026 — chủ dự án chọn màn riêng
    // /thongke/nang-suat (kg / giờ công đầu phiếu, lib/nang-suat).

    return {
      from,
      to,
      days,
      today,
      teams,
      stages: cfg.map((c) => ({
        code: c.code,
        label: c.label,
        count_level: c.meta.count_level,
      })),
      lsx: active.map((l) => ({
        id: l.id,
        code: l.code,
        customer_name: l.customer_name,
      })),
      san_luong_to,
      loi,
      loi_tong: {
        defect: r2(loiSorted.reduce((a, r) => a + r.defect, 0)),
        rework: r2(loiSorted.reduce((a, r) => a + r.rework, 0)),
        free_text: freeText,
        codes_total: codes.length,
      },
      sua_lai_treo,
      ton_cong_doan,
    }
  },
}
