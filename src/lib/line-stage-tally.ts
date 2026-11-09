/**
 * CẦN / ĐẠT THEO (DÒNG SP × CÔNG ĐOẠN) — đúng ĐƠN VỊ của từng công đoạn.
 *
 * Vì sao có file này (09/11/2026). Kế hoạch cần biết "phôi phải cắt bao nhiêu
 * CHI TIẾT, hàn phải ra bao nhiêu CỤM, lắp ráp bao nhiêu BỘ". Mã đã có đủ ba
 * bậc đếm (lib/default-assembly · lib/finish-stages · cụm thật 0088), nhưng
 * chỉ `entries.service` (Ghi sản lượng, Hồ sơ lệnh) áp đủ; `jobs.service`
 * (dải công đoạn ở Lệnh sản xuất, Tình hình xưởng, số "cần" của việc giao tổ)
 * đếm thẳng từ `final_stage` trong DB. Đo 09/11: 7/8 lệnh có bảng là BOM
 * PHẲNG (mọi chi tiết `final_stage = null`), nên hàn · nguội · sơn của MX 13
 * mang 228.550 CHI TIẾT trong khi Ghi sản lượng nói 1 cụm × SL lệnh. Hai màn,
 * hai số cho một ô — đúng thứ luật dự án cấm.
 *
 * Hàm này là MỘT cách đếm cho mọi service, thuần, có test:
 *   1. chi tiết: lộ trình hiệu lực (kế hoạch → khai → nhóm), CẮT trước công
 *      đoạn ghép khi BOM phẳng (`resolveCountingPlan`); cần = CT/SP × SL dòng;
 *   2. cụm mặc nhiên (BOM phẳng): từ công đoạn ghép trở đi, cần = SL dòng,
 *      đạt SUY từ chi tiết chậm nhất (`defaultAssemblyOutputs`);
 *   3. cụm thật (0088): dòng `kind='assembly'` tự mang khoảng [first..final];
 *   4. chặng thành phẩm: cần = SL dòng, đạt = sổ của dòng thành phẩm đã vật
 *      chất hoá; chưa vật chất hoá thì 0 (dòng ảo — không bịa).
 *
 * Một công đoạn có thể mang HAI đơn vị thật (sơn: cụm khung + tấm gỗ). Hàm trả
 * tổng cộng dồn như trước để % và chip không đổi hình, NHƯNG kèm `by_unit` để
 * màn kế hoạch bày "1.671 cụm · 557 tấm" thay vì cộng thành một số.
 */

import { calcComponent } from './component-needs'
import {
  DEFAULT_ASSEMBLY_NAME,
  defaultAssemblyId,
  defaultAssemblyOutputs,
  resolveCountingPlan,
  type AbsorbedTally,
} from './default-assembly'
import {
  FINISH_ROW_NAME,
  finishRouteOverride,
  finishRowId,
  isFinishRow,
  lineUnit,
} from './finish-stages'
import { DEFAULT_COUNTING, type Counting } from './stage-config'
import { componentRoute } from './stage-route'

export type TallyComponent = {
  id: string
  production_order_line_id: string
  /** Thiếu = 'part' (fixture cũ). */
  kind?: 'part' | 'assembly' | null
  name: string
  group_code?: string | null
  /** Lộ trình khai / chụp (0288). */
  stages?: readonly string[] | null
  first_stage?: string | null
  final_stage?: string | null
  unit?: string | null
  qty_per_unit: number
  dm_kg: number | null
  pcs_per_bar: number | null
  /** SL của dòng SP — repo bulk đã join sẵn. */
  line_qty: number
}

export type TallyShortfall = {
  component_id: string
  name: string
  needed: number
  done: number
  missing: number
}

export type UnitTally = {
  /** 'part' chi tiết · 'cluster' cụm · 'unit' bộ/cái — bậc đếm của dòng góp số. */
  level: 'part' | 'cluster' | 'unit'
  /** Đơn vị bày: 'chi tiết' · 'cụm' · đơn vị dòng SP ('cái'/'bộ'). */
  unit: string
  needed: number
  done: number
}

export type StageTally = {
  /** Σ cần của mọi dòng có mặt ở công đoạn này (cộng dồn, có thể lẫn đơn vị —
   *  xem `by_unit`). */
  needed: number
  done: number
  shortfalls: TallyShortfall[]
  /** Tách theo bậc đếm, để bày đúng đơn vị. */
  by_unit: UnitTally[]
}

const r2 = (n: number) => Math.round(n * 100) / 100
const EPS = 1e-9

/** Đơn vị dòng SP (hộp "lineUnit") — null khi dòng không có chi tiết nào. */
const isFinish = (c: TallyComponent, counting: Counting) =>
  isFinishRow(
    { kind: c.kind ?? 'part', first_stage: c.first_stage ?? null },
    counting.finish,
  )

function lineQtyOf(lineComps: TallyComponent[]): number {
  return lineComps[0]?.line_qty ?? 0
}

/**
 * Đếm MỘT dòng SP: công đoạn → cần/đạt/thiếu. Chỉ trả công đoạn có dòng đi
 * qua; dòng SP chưa có bảng chi tiết → Map rỗng.
 *
 * @param lineComps  mọi dòng `production_components` của dòng SP (cùng line_qty)
 * @param plannedRoute lộ trình kế hoạch (production_jobs theo seq) — thắng suy theo nhóm
 * @param doneByCompStage sổ đã gộp `${component_id}|${stage}` → Σ đạt
 */
export function tallyLineStages(
  lineComps: TallyComponent[],
  plannedRoute: string[] | null | undefined,
  doneByCompStage: Map<string, number>,
  counting: Counting = DEFAULT_COUNTING,
  unitOfLine?: string | null,
): Map<string, StageTally> {
  const out = new Map<string, StageTally>()
  if (lineComps.length === 0) return out
  const lineQty = lineQtyOf(lineComps)
  const unit = lineUnit(unitOfLine ?? lineComps.find((c) => isFinish(c, counting))?.unit)

  const at = (stage: string): StageTally => {
    let t = out.get(stage)
    if (!t) {
      t = { needed: 0, done: 0, shortfalls: [], by_unit: [] }
      out.set(stage, t)
    }
    return t
  }
  const add = (
    stage: string,
    row: { id: string; name: string; needed: number; done: number },
    level: UnitTally['level'],
    unitLabel: string,
  ) => {
    const t = at(stage)
    t.needed = r2(t.needed + row.needed)
    t.done = r2(t.done + row.done)
    if (row.needed - row.done > EPS) {
      t.shortfalls.push({
        component_id: row.id,
        name: row.name,
        needed: row.needed,
        done: row.done,
        missing: r2(row.needed - row.done),
      })
    }
    let u = t.by_unit.find((x) => x.level === level && x.unit === unitLabel)
    if (!u) {
      u = { level, unit: unitLabel, needed: 0, done: 0 }
      t.by_unit.push(u)
    }
    u.needed = r2(u.needed + row.needed)
    u.done = r2(u.done + row.done)
  }

  const plan = resolveCountingPlan(
    lineComps.map((c) => ({
      id: c.id,
      kind: c.kind ?? 'part',
      group_code: c.group_code ?? null,
      final_stage: c.final_stage ?? null,
      first_stage: c.first_stage ?? null,
      stages: c.stages ?? null,
    })),
    plannedRoute,
    counting,
  )

  // 1 + 3 + 4a — dòng thật: chi tiết (có thể đã cắt), cụm thật, dòng thành phẩm đã vật chất hoá.
  for (const c of lineComps) {
    const kind = c.kind ?? 'part'
    const finish = finishRouteOverride(
      { kind, first_stage: c.first_stage ?? null },
      counting.finish,
    )
    const route =
      finish ??
      plan.own_route.get(c.id) ??
      componentRoute(plannedRoute, {
        group_code: c.group_code ?? null,
        stages: c.stages,
        first_stage: c.first_stage,
        final_stage: c.final_stage,
      })
    if (route.length === 0) continue
    const needed = calcComponent(
      { qty_per_unit: c.qty_per_unit, dm_kg: c.dm_kg, pcs_per_bar: c.pcs_per_bar },
      c.line_qty,
    ).total_needed
    const level: UnitTally['level'] = finish
      ? 'unit'
      : kind === 'assembly'
        ? 'cluster'
        : 'part'
    const unitLabel = finish ? unit : kind === 'assembly' ? 'cụm' : 'chi tiết'
    for (const stage of route) {
      add(
        stage,
        {
          id: c.id,
          name: c.name,
          needed,
          done: doneByCompStage.get(`${c.id}|${stage}`) ?? 0,
        },
        level,
        unitLabel,
      )
    }
  }

  // 2 — cụm mặc nhiên (BOM phẳng): đạt suy từ chi tiết bị gộp, cùng công thức Ghi sản lượng.
  if (plan.virtual_stages.length > 0) {
    const absorbed: AbsorbedTally[] = lineComps
      .filter((c) => plan.own_route.has(c.id))
      .map((c) => ({
        total_needed: calcComponent(
          { qty_per_unit: c.qty_per_unit, dm_kg: c.dm_kg, pcs_per_bar: c.pcs_per_bar },
          c.line_qty,
        ).total_needed,
        outputs: plan.virtual_stages.map((stage) => ({
          stage,
          done: doneByCompStage.get(`${c.id}|${stage}`) ?? 0,
          defect: 0,
        })),
      }))
    const outputs = defaultAssemblyOutputs(plan.virtual_stages, lineQty, absorbed)
    const lid = lineComps[0].production_order_line_id
    for (const o of outputs) {
      add(
        o.stage,
        {
          id: defaultAssemblyId(lid),
          name: DEFAULT_ASSEMBLY_NAME,
          needed: lineQty,
          done: o.done,
        },
        'cluster',
        unit,
      )
    }
  }

  // 4b — chặng thành phẩm chưa vật chất hoá: cần = SL dòng, đạt 0 (không suy).
  if (!lineComps.some((c) => isFinish(c, counting))) {
    const lid = lineComps[0].production_order_line_id
    for (const stage of counting.finish) {
      add(
        stage,
        { id: finishRowId(lid), name: FINISH_ROW_NAME, needed: lineQty, done: 0 },
        'unit',
        unit,
      )
    }
  }

  return out
}

/** Gom `components` (nhiều lệnh) theo `${production_order_id}|${line_id}`. */
export function groupByLine<
  T extends { production_order_id?: string; production_order_line_id: string },
>(components: T[]): Map<string, T[]> {
  const byLine = new Map<string, T[]>()
  for (const c of components) {
    const key = `${c.production_order_id ?? ''}|${c.production_order_line_id}`
    const arr = byLine.get(key) ?? []
    arr.push(c)
    byLine.set(key, arr)
  }
  return byLine
}
