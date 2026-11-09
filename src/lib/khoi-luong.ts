/**
 * KHỐI LƯỢNG THEO CÔNG ĐOẠN của một lệnh (bản vẽ bước 2, 09/11/2026,
 * https://claude.ai/artifact/2u4QXWAx6hsn8Gha4ari6d — duyệt Q1–Q7).
 *
 * Trả lời câu của người lập kế hoạch: "lệnh này phôi phải cắt bao nhiêu CHI
 * TIẾT, hàn ra bao nhiêu CỤM, lắp ráp bao nhiêu BỘ, ai làm, hạn nào". Số lấy từ
 * `tallyLineStages` (cùng hàm với dải công đoạn ở Lệnh sản xuất và "cần" của
 * việc giao tổ) rồi CỘNG DỌC các dòng SP theo từng bậc đếm — không bao giờ cộng
 * hai đơn vị vào một số (Q3). Thuần, có test; service chỉ nạp dữ liệu.
 */

import { tallyLineStages, type TallyComponent, type UnitTally } from './line-stage-tally'
import { isFinishRow } from './finish-stages'
import { DEFAULT_COUNTING, type Counting } from './stage-config'
import { componentRoute } from './stage-route'

export type KlLineIn = {
  id: string
  product_id: string | null
  product_code: string
  product_name: string
  qty: number
  unit: string | null
  comps: TallyComponent[]
}

export type KlJob = {
  production_order_line_id: string
  stage: string
  team_name: string | null
  planned_start: string | null
  planned_end: string | null
}

export type KlStage = {
  code: string
  label: string
  /** Thứ tự trong danh mục (1-based) — đọc chéo với dải 12 ô ở Lệnh sản xuất. */
  index: number
  /** Cộng dồn mọi đơn vị — chỉ để vẽ %; bày số thì dùng `by_unit`. */
  needed: number
  done: number
  by_unit: UnitTally[]
  /** Chi tiết đi qua công đoạn ghép mà KHÔNG thuộc cụm thật nào (Q5) — đang
   *  đếm lẫn cạnh cụm, Kỹ thuật gán ở hồ sơ SP; hệ không tự gộp. */
  unassigned_qty: number
  /** Tổ phụ trách (gộp mọi dòng SP, không trùng). */
  teams: string[]
  /** Có việc đã lên kế hoạch mà chưa gắn tổ. */
  team_missing: boolean
  /** Hạn sớm nhất / muộn nhất trong các việc của công đoạn này. */
  planned_start: string | null
  planned_end: string | null
  jobs: number
}

export type KlLine = {
  order_line_id: string
  product_id: string | null
  product_code: string
  product_name: string
  qty: number
  unit: string
  has_components: boolean
  /** công đoạn → cần theo bậc đếm (chỉ công đoạn dòng này đi qua). */
  cells: Record<string, UnitTally[]>
}

export type KhoiLuong = {
  stages: KlStage[]
  lines: KlLine[]
  /** Nhãn công đoạn trong danh mục mà lệnh không đi qua. */
  not_traversed: string[]
  /** Số dòng SP chưa có bảng chi tiết — số trên chưa gồm chúng. */
  unshaped: number
  unassigned: { parts: number; qty: number }
}

const r2 = (n: number) => Math.round(n * 100) / 100
const fmt = (n: number) => n.toLocaleString('vi-VN')

/** "2.000 cái · 36.750 chi tiết" — đơn vị chính trước, không cộng. */
export function byUnitText(u: UnitTally[]): string {
  return sortByUnit(u)
    .map((x) => `${fmt(x.needed)} ${x.unit}`)
    .join(' · ')
}

/** Đơn vị CHÍNH của một công đoạn: bộ → cụm → chi tiết (nhịp/ngày tính theo nó). */
export function principalUnit(u: UnitTally[]): UnitTally | null {
  return sortByUnit(u)[0] ?? null
}

const LEVEL_RANK: Record<UnitTally['level'], number> = { unit: 0, cluster: 1, part: 2 }

export function sortByUnit(u: UnitTally[]): UnitTally[] {
  return [...u].sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level])
}

export function khoiLuongOf(
  lines: KlLineIn[],
  plannedByLine: Map<string, string[]>,
  stagesCat: { code: string; label: string }[],
  doneByCompStage: Map<string, number>,
  jobs: KlJob[],
  counting: Counting = DEFAULT_COUNTING,
): KhoiLuong {
  const acc = new Map<string, KlStage>()
  const at = (code: string): KlStage => {
    let s = acc.get(code)
    if (!s) {
      const i = stagesCat.findIndex((x) => x.code === code)
      s = {
        code,
        label: stagesCat[i]?.label ?? code,
        index: i + 1,
        needed: 0,
        done: 0,
        by_unit: [],
        unassigned_qty: 0,
        teams: [],
        team_missing: false,
        planned_start: null,
        planned_end: null,
        jobs: 0,
      }
      acc.set(code, s)
    }
    return s
  }
  let unassignedParts = 0
  let unassignedQty = 0

  const out: KlLine[] = lines.map((l) => {
    const unit = l.unit?.trim() || 'cái'
    const planned = plannedByLine.get(l.id)
    const t = tallyLineStages(l.comps, planned, doneByCompStage, counting, l.unit)
    const cells: Record<string, UnitTally[]> = {}
    for (const [stage, x] of t) {
      cells[stage] = sortByUnit(x.by_unit)
      const s = at(stage)
      s.needed = r2(s.needed + x.needed)
      s.done = r2(s.done + Math.min(x.done, x.needed))
      for (const u of x.by_unit) {
        let m = s.by_unit.find((y) => y.level === u.level && y.unit === u.unit)
        if (!m) {
          m = { level: u.level, unit: u.unit, needed: 0, done: 0 }
          s.by_unit.push(m)
        }
        m.needed = r2(m.needed + u.needed)
        m.done = r2(m.done + u.done)
      }
    }
    // Q5 — chi tiết chưa gán cụm: chỉ xét dòng CÓ cụm thật (BOM phẳng thì cụm
    // mặc nhiên đã gom hết, không có gì "chưa gán").
    const asmNames = new Set(
      l.comps
        .filter(
          (c) =>
            (c.kind ?? 'part') === 'assembly' &&
            !isFinishRow(
              { kind: 'assembly', first_stage: c.first_stage ?? null },
              counting.finish,
            ),
        )
        .map((c) => c.name),
    )
    if (asmNames.size > 0 && counting.join) {
      for (const c of l.comps) {
        if ((c.kind ?? 'part') !== 'part' || c.final_stage != null) continue
        if (c.group_code && asmNamesHas(asmNames, c)) continue
        const route = componentRoute(planned, {
          group_code: c.group_code ?? null,
          stages: c.stages,
          first_stage: c.first_stage,
          final_stage: c.final_stage,
        })
        const j = route.indexOf(counting.join)
        if (j < 0) continue
        const qty = r2(c.qty_per_unit * c.line_qty)
        unassignedParts += 1
        unassignedQty = r2(unassignedQty + qty)
        for (const stage of route.slice(j)) {
          const s = at(stage)
          s.unassigned_qty = r2(s.unassigned_qty + qty)
        }
      }
    }
    return {
      order_line_id: l.id,
      product_id: l.product_id,
      product_code: l.product_code,
      product_name: l.product_name,
      qty: l.qty,
      unit,
      has_components: l.comps.length > 0,
      cells,
    }
  })

  // Tổ & hạn từ kế hoạch (production_jobs), gộp mọi dòng SP của công đoạn.
  for (const j of jobs) {
    const s = acc.get(j.stage)
    if (!s) continue
    s.jobs += 1
    if (j.team_name) {
      if (!s.teams.includes(j.team_name)) s.teams.push(j.team_name)
    } else s.team_missing = true
    const ps = j.planned_start?.slice(0, 10) ?? null
    const pe = j.planned_end?.slice(0, 10) ?? null
    if (ps && (!s.planned_start || ps < s.planned_start)) s.planned_start = ps
    if (pe && (!s.planned_end || pe > s.planned_end)) s.planned_end = pe
  }

  const stages = stagesCat
    .filter((c) => acc.has(c.code))
    .map((c) => {
      const s = acc.get(c.code)!
      return { ...s, by_unit: sortByUnit(s.by_unit) }
    })
  return {
    stages,
    lines: out,
    not_traversed: stagesCat.filter((c) => !acc.has(c.code)).map((c) => c.label),
    unshaped: out.filter((l) => !l.has_components).length,
    unassigned: { parts: unassignedParts, qty: unassignedQty },
  }
}

/** Chi tiết thuộc cụm thật khi `cluster` khớp TÊN một dòng cụm. */
function asmNamesHas(asmNames: Set<string>, c: TallyComponent): boolean {
  return !!c.cluster && asmNames.has(c.cluster)
}

/**
 * Câu tổ & hạn của một ô (bản vẽ §2, §4b): "chưa giao tổ & hạn" · "chưa có tổ
 * cho mài" · "Tổ Hàn · chưa hạn" · "Tổ Hàn · 12/11→28/11" · "2 tổ · 12/11→05/12".
 */
export function teamText(s: KlStage): { text: string; tone: 'warn' | null } {
  if (s.jobs === 0) return { text: 'chưa giao tổ & hạn', tone: 'warn' }
  if (s.teams.length === 0)
    return { text: `chưa có tổ cho ${s.label.toLowerCase()}`, tone: 'warn' }
  const who = s.teams.length === 1 ? s.teams[0] : `${s.teams.length} tổ`
  if (!s.planned_end) return { text: `${who} · chưa hạn`, tone: 'warn' }
  const dm = (iso: string) => iso.slice(5, 10).split('-').reverse().join('/')
  const span = s.planned_start
    ? `${dm(s.planned_start)}→${dm(s.planned_end)}`
    : `→${dm(s.planned_end)}`
  return {
    text: `${who} · ${span}${s.team_missing ? ' · thiếu tổ' : ''}`,
    tone: s.team_missing ? 'warn' : null,
  }
}
