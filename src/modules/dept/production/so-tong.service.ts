import { productionRepo } from './production.repo'
import { entriesService, type ComponentOutputView } from './entries.service'
import {
  productSection,
  SECTION_ORDER,
  type MaterialSection,
} from '@/lib/production-section'
import type { User } from '@/modules/core/users/users.repo'

/**
 * SỔ TỔNG toàn xưởng (GĐ1 — thay sheet `quan li` của file "TỔNG TĐ SX"):
 * MỘT bảng phân cấp LỆNH → PHẦN SẮT/NHÔM → ĐƠN·MÃ SP → chi tiết/cụm, mỗi ô
 * (chi tiết × công đoạn) mang cả lát cắt THEO THÁNG (cột "TỔNG / T8" của sổ)
 * và phần gia công ngoài nhận về (cột "Gia công"). Tổng chỉ cộng TRONG lệnh —
 * cộng "cần" giữa chi tiết khác lệnh là số vô nghĩa (user chốt 24/08).
 *
 * `buildSoTongLsx` là hàm thuần trên payload của entriesService.summary —
 * test không cần DB; service chỉ ghép dữ liệu.
 */

const r2 = (n: number) => Math.round(n * 100) / 100

export type SoTongCellMonth = { done: number; defect: number; gc: number }

export type SoTongCell = {
  done: number
  defect: number
  /** Phần trong `done` do gia công ngoài nhận về (0171). */
  gc: number
  /** 0..1 cap 1 theo tổng cần của chi tiết. */
  pct: number
  /** Chỉ giữ tháng CÓ SỐ — payload nhẹ (lăng kính Kỳ ở client). */
  months: Record<string, SoTongCellMonth>
  planned_start: string | null
  planned_end: string | null
}

export type SoTongComponent = {
  id: string
  kind: 'part' | 'assembly'
  cluster: string | null
  name: string
  unit: string | null
  total_needed: number
  /** Theo stage code — chỉ các công đoạn trong khoảng [first..final] của nó. */
  cells: Record<string, SoTongCell>
  kg_total: number
  kg_months: Record<string, number>
  pct_total: number
}

export type SoTongProduct = {
  order_line_id: string
  order_code: string | null
  product_code: string
  product_name: string
  qty: number
  synced_sets: number
  section: MaterialSection
  components: SoTongComponent[]
}

export type SoTongSection = {
  section: MaterialSection
  products: SoTongProduct[]
}

export type SoTongLsxTotals = {
  needed: number
  kg: number
  kg_months: Record<string, number>
  stages: Record<
    string,
    { done: number; defect: number; gc: number; months: Record<string, SoTongCellMonth> }
  >
}

export type SoTongLsx = {
  id: string
  code: string
  customer_name: string
  order_codes: string[]
  ship_date: string | null
  /** > 1 phần mới đáng vẽ dòng nhóm PHẦN SẮT/NHÔM. */
  sections: SoTongSection[]
  totals: SoTongLsxTotals
  used_stages: string[]
  has_components: boolean
}

export type SoTongPayload = {
  /** Công đoạn XUẤT HIỆN ở ít nhất một lệnh, theo thứ tự danh mục. */
  stages: { code: string; label: string }[]
  /** 'YYYY-MM' có ghi sổ, mới → cũ — bộ chọn Kỳ. */
  months: string[]
  lsx: SoTongLsx[]
  today: string
  hidden_count: number
}

type SummaryLike = {
  components: ComponentOutputView[]
  synced_by_line: {
    order_line_id: string
    order_id: string
    product_code: string
    product_name: string
    qty: number
    synced_sets: number
  }[]
  entries: {
    component_id: string
    stage: string
    entry_date: string
    qty: number
    kg: number | null
    defect_qty: number
  }[]
  outsource: {
    component_id: string
    stage: string | null
    direction: 'send' | 'receive'
    entry_date: string
    qty: number
    kg: number | null
    defect_qty: number
  }[]
  jobs: {
    production_order_line_id: string
    stage: string
    planned_start: string | null
    planned_end: string | null
  }[]
}

export type SoTongLsxInput = SummaryLike & {
  lsx: {
    id: string
    code: string
    customer_name: string
    order_ids: string[]
    order_codes: string[]
    ship_date: string | null
  }
}

const ym = (d: string) => d.slice(0, 7)

export function buildSoTongLsx(input: SoTongLsxInput): SoTongLsx {
  const { lsx, components, synced_by_line, entries, outsource, jobs } = input

  // Lát cắt tháng per (chi tiết × công đoạn) + kg per chi tiết.
  const monthCell = new Map<string, Record<string, SoTongCellMonth>>()
  const kgMonths = new Map<string, Record<string, number>>()
  const kgTotal = new Map<string, number>()
  const bump = (
    compId: string,
    stage: string,
    month: string,
    d: { done?: number; defect?: number; gc?: number },
  ) => {
    const k = `${compId}|${stage}`
    const rec = monthCell.get(k) ?? {}
    const cur = rec[month] ?? { done: 0, defect: 0, gc: 0 }
    cur.done = r2(cur.done + (d.done ?? 0))
    cur.defect = r2(cur.defect + (d.defect ?? 0))
    cur.gc = r2(cur.gc + (d.gc ?? 0))
    rec[month] = cur
    monthCell.set(k, rec)
  }
  const bumpKg = (compId: string, month: string, kg: number | null) => {
    if (kg == null || kg === 0) return
    kgTotal.set(compId, r2((kgTotal.get(compId) ?? 0) + kg))
    const rec = kgMonths.get(compId) ?? {}
    rec[month] = r2((rec[month] ?? 0) + kg)
    kgMonths.set(compId, rec)
  }
  for (const en of entries) {
    const m = ym(en.entry_date)
    bump(en.component_id, en.stage, m, {
      done: Number(en.qty),
      defect: Number(en.defect_qty),
    })
    bumpKg(en.component_id, m, en.kg == null ? null : Number(en.kg))
  }
  for (const oe of outsource) {
    if (oe.direction !== 'receive' || !oe.stage) continue
    const m = ym(oe.entry_date)
    bump(oe.component_id, oe.stage, m, {
      done: Number(oe.qty),
      defect: Number(oe.defect_qty),
      gc: Number(oe.qty),
    })
    bumpKg(oe.component_id, m, oe.kg == null ? null : Number(oe.kg))
  }

  // Kế hoạch per (dòng SP × công đoạn) — tô nhịp chậm/quá hạn ở client.
  const jobByLineStage = new Map(
    jobs.map((j) => [`${j.production_order_line_id}|${j.stage}`, j]),
  )

  const compViews = new Map<string, ComponentOutputView[]>()
  for (const c of components) {
    const arr = compViews.get(c.order_line_id) ?? []
    arr.push(c)
    compViews.set(c.order_line_id, arr)
  }

  const orderCodeById = new Map(lsx.order_ids.map((id, i) => [id, lsx.order_codes[i]]))

  const products: SoTongProduct[] = synced_by_line.map((l) => {
    const comps = compViews.get(l.order_line_id) ?? []
    return {
      order_line_id: l.order_line_id,
      order_code: orderCodeById.get(l.order_id) ?? null,
      product_code: l.product_code,
      product_name: l.product_name,
      qty: l.qty,
      synced_sets: l.synced_sets,
      section: productSection(l.product_code, comps),
      components: comps.map((c) => ({
        id: c.id,
        kind: c.kind,
        cluster: c.cluster,
        name: c.name,
        unit: c.unit,
        total_needed: c.total_needed,
        cells: Object.fromEntries(
          c.summary.stages.map((s) => {
            const job = jobByLineStage.get(`${l.order_line_id}|${s.stage}`)
            return [
              s.stage,
              {
                done: s.done,
                defect: s.defect,
                gc: s.gc ?? 0,
                pct: s.pct,
                months: monthCell.get(`${c.id}|${s.stage}`) ?? {},
                planned_start: job?.planned_start ?? null,
                planned_end: job?.planned_end ?? null,
              } satisfies SoTongCell,
            ]
          }),
        ),
        kg_total: kgTotal.get(c.id) ?? 0,
        kg_months: kgMonths.get(c.id) ?? {},
        pct_total: c.summary.pct_total,
      })),
    }
  })

  const sections: SoTongSection[] = SECTION_ORDER.map((section) => ({
    section,
    products: products.filter((p) => p.section === section),
  })).filter((s) => s.products.length > 0)

  // TỔNG riêng của lệnh (không có tổng toàn xưởng).
  const totals: SoTongLsxTotals = { needed: 0, kg: 0, kg_months: {}, stages: {} }
  const usedStages = new Set<string>()
  for (const p of products) {
    for (const c of p.components) {
      totals.needed = r2(totals.needed + c.total_needed)
      totals.kg = r2(totals.kg + c.kg_total)
      for (const [m, kg] of Object.entries(c.kg_months)) {
        totals.kg_months[m] = r2((totals.kg_months[m] ?? 0) + kg)
      }
      for (const [stage, cell] of Object.entries(c.cells)) {
        usedStages.add(stage)
        const t = totals.stages[stage] ?? { done: 0, defect: 0, gc: 0, months: {} }
        t.done = r2(t.done + cell.done)
        t.defect = r2(t.defect + cell.defect)
        t.gc = r2(t.gc + cell.gc)
        for (const [m, mc] of Object.entries(cell.months)) {
          const tm = t.months[m] ?? { done: 0, defect: 0, gc: 0 }
          tm.done = r2(tm.done + mc.done)
          tm.defect = r2(tm.defect + mc.defect)
          tm.gc = r2(tm.gc + mc.gc)
          t.months[m] = tm
        }
        totals.stages[stage] = t
      }
    }
  }

  return {
    id: lsx.id,
    code: lsx.code,
    customer_name: lsx.customer_name,
    order_codes: lsx.order_codes,
    ship_date: lsx.ship_date,
    sections,
    totals,
    used_stages: [...usedStages],
    has_components: components.length > 0,
  }
}

/** Toàn xưởng có trần an toàn — quá 20 lệnh chạy song song là bất thường. */
const MAX_LSX = 20

export const soTongService = {
  async build(user: User): Promise<SoTongPayload> {
    const [active, stagesCat] = await Promise.all([
      productionRepo.listActive(),
      productionRepo.listStages(),
    ])
    const shown = active.slice(0, MAX_LSX)
    const summaries = await Promise.all(
      shown.map((l) => entriesService.summary(user, l.id)),
    )
    const blocks = shown.map((l, i) =>
      buildSoTongLsx({
        lsx: {
          id: l.id,
          code: l.code,
          customer_name: l.customer_name,
          order_ids: l.order_ids,
          order_codes: l.order_codes,
          ship_date: l.ship_date,
        },
        ...summaries[i],
      }),
    )
    const used = new Set(blocks.flatMap((b) => b.used_stages))
    const months = new Set<string>()
    for (const b of blocks) {
      for (const t of Object.values(b.totals.stages)) {
        for (const m of Object.keys(t.months)) months.add(m)
      }
    }
    return {
      stages: stagesCat.filter((s) => used.has(s.code)),
      months: [...months].sort().reverse(),
      lsx: blocks,
      today: new Date().toISOString().slice(0, 10),
      hidden_count: active.length - shown.length,
    }
  },
}
