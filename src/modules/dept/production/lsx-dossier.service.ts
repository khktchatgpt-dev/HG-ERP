import { entriesService } from './entries.service'
import { productionRepo } from './production.repo'
import { componentsRepo } from './components.repo'
import { lsxLinesRepo } from './lsx-lines.repo'
import { jobsRepo, type Job } from './jobs.repo'
import { entriesRepo } from './entries.repo'
import { transfersRepo } from './transfers.repo'
import { transferDocsRepo } from './transfer-docs.repo'
import { transferDocsService, type PgtDocView } from './transfer-docs.service'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { productsRepo } from '@/modules/dept/technical/technical.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { resolveTeamStage } from '@/lib/stage-for-dept'
import { countingOf, resolveStageConfigs, type CountLevel } from '@/lib/stage-config'
import { resolveCountingPlan, defaultAssemblyId } from '@/lib/default-assembly'
import { finishRowId, isFinishRow } from '@/lib/finish-stages'
import { resolveHolder, type Holder } from '@/lib/lsx-holder'
import { khoiLuongOf, type KhoiLuong } from '@/lib/khoi-luong'
import {
  headReceived,
  receivedOrFallback,
  totalKey,
  transferTotals,
  wipNumbers,
  type WipNumbers,
} from '@/lib/wip-numbers'
import { fileImageSrc } from '@/server/file-image'
import { vnTodayIso } from '@/lib/local-date'
import { NotFound } from '@/server/http'
import type { User } from '@/modules/core/users/users.repo'

/**
 * HỒ SƠ LỆNH — bảng đồng bộ BA TẦNG × công đoạn + NĂM CON SỐ mỗi ô (B5,
 * docs/san-xuat-cau-hinh-thiet-ke.md §5 S3).
 *
 * Quản đốc — "lệnh này mỗi cụm xong bao nhiêu, đã giao / nhận / tồn ở công đoạn
 * nào, ai giữ?". Số trong ô lấy từ CÙNG hàm mà Ghi sản lượng (worklist) và Giao
 * nhận (transfer-docs) dùng: xong = entriesService.summary (sổ), đã giao / đã
 * nhận = transferTotals (phiếu), khả dụng = wipNumbers; "đã nhận" khi chưa có
 * phiếu = xong ở công đoạn trước (receivedOrFallback). Hai màn nói hai số khác
 * nhau cho một ô là lỗi — nên không màn nào tự cộng.
 */

export type DossierStage = { code: string; label: string; count_level: CountLevel }

export type DossierCell = WipNumbers & {
  defect: number
  rework: number
  /** true = "đã nhận" là XẤP XỈ (xong công đoạn trước) vì chưa ai lập phiếu tới đây. */
  received_estimated: boolean
}

export type DossierRow = {
  id: string
  /** 'finish' thành phẩm (bộ) · 'cluster' cụm · 'part' chi tiết. */
  tier: 'finish' | 'cluster' | 'part'
  /** Chi tiết thuộc cụm nào (id dòng cụm) — để thụt tầng 3. */
  parent_id: string | null
  name: string
  cluster: string | null
  unit: string | null
  qty_per_unit: number
  total_needed: number
  is_virtual: boolean
  route: string[]
  /** Chỉ có ô cho công đoạn TRÊN lộ trình; ngoài lộ trình = không có khoá. */
  cells: Record<string, DossierCell>
  done_final: number
}

export type DossierLine = {
  order_line_id: string
  product_code: string
  product_name: string
  qty: number
  unit: string
  image_src: string | null
  has_components: boolean
  /** Số bộ đồng bộ (MIN qua bộ phận đầu ra cuối) — cùng hàm với bảng cũ. */
  synced_sets: number
  rows: DossierRow[]
}

export type DossierPayload = {
  lsx: {
    id: string
    code: string
    customer_name: string
    order_codes: string[]
    ship_date: string | null
    status: string
    priority: number
    created_at: string
    approved_at: string | null
    completed_at: string | null
  }
  holder: Holder
  stages: DossierStage[]
  lines: DossierLine[]
  jobs: Job[]
  teams: { id: string; name: string; stage_code: string | null }[]
  pbs: Awaited<ReturnType<typeof entriesService.docsOfLsx>>
  pgt: PgtDocView[]
  /** Khối "Khối lượng theo công đoạn" (bước 2, 09/11/2026) — lib/khoi-luong. */
  khoi_luong: KhoiLuong
  unshaped: number
  today: string
}

export const lsxDossierService = {
  async get(user: User, lsxId: string): Promise<DossierPayload> {
    const lsx = await productionRepo.findById(lsxId)
    if (!lsx) throw NotFound('Lệnh không tồn tại')
    const [
      summary,
      components,
      lines,
      jobs,
      depts,
      stagesCat,
      rawTransfers,
      docs,
      pbs,
      pgtAll,
      entries,
    ] = await Promise.all([
      entriesService.summary(user, lsxId),
      componentsRepo.listByLsx(lsxId),
      lsxLinesRepo.listLines(lsxId),
      jobsRepo.listByLsx(lsxId),
      departmentsRepo.list(),
      productionRepo.listStages(),
      transfersRepo.listRawByLsx(lsxId),
      transferDocsRepo.listByLsxBulk([lsxId]),
      entriesService.docsOfLsx(user, lsxId),
      transferDocsService.inbox(user, { lsxId }),
      entriesRepo.listByLsx(lsxId),
    ])
    const counting = countingOf(stagesCat)
    const cfg = resolveStageConfigs(stagesCat)
    const totals = transferTotals(docs, rawTransfers)
    const viewById = new Map(summary.components.map((v) => [v.id, v]))
    const syncedByLine = new Map(summary.synced_by_line.map((s) => [s.order_line_id, s]))

    // Ảnh SP: ảnh dòng lệnh thắng, thiếu thì rơi về hồ sơ SP.
    const productImgs = new Map(
      (
        await productsRepo.listPickByIds([
          ...new Set(
            lines
              .filter((l) => !l.image_file_id && l.product_id)
              .map((l) => l.product_id as string),
          ),
        ])
      ).map((p) => [p.id, p.image_file_id]),
    )

    // "Đã ghi ở công đoạn kế" cho ô CUỐI lộ trình của một dòng (10/11/2026):
    // cụm (thật / mặc nhiên) kết ở sơn → kế là bước đầu chặng thành phẩm, mỗi
    // bộ ăn `qty_per_unit` cụm; thành phẩm kết ở hoàn thiện → kế là XUẤT HÀNG
    // của dòng đơn. Không có thì tồn cuối lộ trình = xong − phiếu, như cũ.
    const usedAtFirst = (v: {
      summary: { stages: { done: number; defect: number; rework: number }[] }
    }) => {
      const s0 = v.summary.stages[0]
      return s0 ? s0.done + s0.defect + s0.rework : 0
    }
    const toRow = (
      v: NonNullable<ReturnType<typeof viewById.get>>,
      tier: DossierRow['tier'],
      parentId: string | null,
      qtyPerUnit: number,
      tailNext: number | null = null,
      headRecv: number | null = null,
    ): DossierRow => {
      const route = v.summary.stages.map((s) => s.stage)
      const cells: Record<string, DossierCell> = {}
      v.summary.stages.forEach((s, i) => {
        const prev = i > 0 ? v.summary.stages[i - 1] : null
        const next = v.summary.stages[i + 1] ?? null
        const t = totals.get(totalKey(v.id, s.stage))
        const n = wipNumbers({
          done: s.done,
          shipped: t?.shipped ?? 0,
          // Đầu lộ trình của dòng gộp: "đã nhận" suy từ dòng con (headRecv).
          received: receivedOrFallback(t, prev ? prev.done : headRecv),
          used: s.done + s.defect + s.rework,
          // Công đoạn kế đã ghi sổ = hàng đã đi dù không lập PGT (10/11/2026).
          next_used: next ? next.done + next.defect + next.rework : tailNext,
        })
        cells[s.stage] = {
          ...n,
          defect: s.defect,
          rework: s.rework,
          received_estimated:
            !t?.has_inbound && (prev != null || (i === 0 && headRecv != null)),
        }
      })
      return {
        id: v.id,
        tier,
        parent_id: parentId,
        name: v.name,
        cluster: v.cluster,
        unit: v.unit,
        qty_per_unit: qtyPerUnit,
        total_needed: v.total_needed,
        is_virtual: !!v.is_virtual,
        route,
        cells,
        done_final: v.summary.done_final,
      }
    }

    // Lộ trình kế hoạch per dòng (jobs theo seq) — cùng đầu vào với summary.
    const plannedByLine = new Map<string, string[]>()
    for (const j of [...jobs].sort((a, b) => a.seq - b.seq)) {
      const arr = plannedByLine.get(j.production_order_line_id) ?? []
      arr.push(j.stage)
      plannedByLine.set(j.production_order_line_id, arr)
    }
    const shippedByLine = await ordersRepo.shippedByLineIds(
      lines.map((l) => l.sales_order_line_id).filter((x): x is string => !!x),
    )
    const used = new Set<string>()
    const linesOut: DossierLine[] = lines.map((l) => {
      const comps = components.filter((c) => c.production_order_line_id === l.id)
      const plan = resolveCountingPlan(comps, plannedByLine.get(l.id), counting)
      const rows: DossierRow[] = []
      // 1 · Thành phẩm (bộ): dòng thật nếu đã vật chất hoá, không thì dòng ảo.
      const finishReal = comps.find((c) => isFinishRow(c, counting.finish))
      const finishId = finishReal ? finishReal.id : finishRowId(l.id)
      const fv = viewById.get(finishId)
      const shippedOfLine = l.sales_order_line_id
        ? (shippedByLine.get(l.sales_order_line_id) ?? 0)
        : null
      // Cụm kết lộ trình → bộ đã bắt đầu lắp (bước đầu chặng thành phẩm).
      const clusterTail = (qtyPerUnit: number) =>
        fv && fv.summary.stages.length ? usedAtFirst(fv) * qtyPerUnit : null
      // "Đã nhận" ở ĐẦU lộ trình cụm = chi tiết con đã về công đoạn ghép (phiếu
      // tới đó, không phiếu thì xong ở chặng cuối của chi tiết), quy ra cụm theo
      // chi tiết chậm nhất — cùng `headReceived` với Ghi sản lượng (10/11/2026).
      const doneAt = (
        pv: { summary: { stages: { stage: string; done: number }[] } },
        stage: string | undefined,
      ) => (stage ? (pv.summary.stages.find((s) => s.stage === stage)?.done ?? 0) : 0)
      const clusterHead = (
        cv: { summary: { stages: { stage: string }[] } },
        parts: typeof comps,
        qtyPerUnit: number,
      ): number | null => {
        const first = cv.summary.stages[0]?.stage
        if (!first) return null
        const inputs = parts.flatMap((p) => {
          const pv = viewById.get(p.id)
          if (!pv) return []
          const t = totals.get(totalKey(p.id, first))
          const last = pv.summary.stages.at(-1)?.stage
          return [
            {
              received: receivedOrFallback(t, last ? doneAt(pv, last) : null),
              total: pv.total_needed,
            },
          ]
        })
        const sets = headReceived(inputs, l.qty)
        return sets == null ? null : sets * qtyPerUnit
      }
      if (fv) {
        // Bộ thành phẩm: đầu vào = số bộ đủ bộ phận = đồng bộ của dòng.
        rows.push(
          toRow(
            fv,
            'finish',
            null,
            1,
            shippedOfLine,
            syncedByLine.get(l.id)?.synced_sets ?? null,
          ),
        )
        used.add(finishId)
      }
      // 2 · Cụm thật + chi tiết trong cụm.
      for (const asm of comps.filter(
        (c) => c.kind === 'assembly' && !isFinishRow(c, counting.finish),
      )) {
        const av = viewById.get(asm.id)
        if (!av) continue
        rows.push(
          toRow(
            av,
            'cluster',
            null,
            asm.qty_per_unit,
            clusterTail(asm.qty_per_unit),
            clusterHead(
              av,
              comps.filter((c) => c.kind === 'part' && c.cluster === asm.cluster),
              asm.qty_per_unit,
            ),
          ),
        )
        used.add(asm.id)
        if (asm.cluster) {
          for (const p of comps.filter(
            (c) => c.kind === 'part' && c.cluster === asm.cluster,
          )) {
            const pv = viewById.get(p.id)
            if (!pv) continue
            rows.push(toRow(pv, 'part', asm.id, p.qty_per_unit))
            used.add(p.id)
          }
        }
      }
      // 3 · Cụm mặc nhiên (ảo) + chi tiết bị gộp vào nó.
      const dv = viewById.get(defaultAssemblyId(l.id))
      if (dv) {
        rows.push(
          toRow(
            dv,
            'cluster',
            null,
            1,
            clusterTail(1),
            clusterHead(
              dv,
              comps.filter((c) => plan.own_route.has(c.id)),
              1,
            ),
          ),
        )
        used.add(dv.id)
        for (const p of comps.filter(
          (c) => plan.own_route.has(c.id) && !used.has(c.id),
        )) {
          const pv = viewById.get(p.id)
          if (!pv) continue
          rows.push(toRow(pv, 'part', dv.id, p.qty_per_unit))
          used.add(p.id)
        }
      }
      // 4 · Chi tiết rời.
      for (const p of comps.filter((c) => !used.has(c.id))) {
        const pv = viewById.get(p.id)
        if (!pv) continue
        rows.push(toRow(pv, 'part', null, p.qty_per_unit))
        used.add(p.id)
      }
      const fid = l.image_file_id ?? (l.product_id ? productImgs.get(l.product_id) : null)
      return {
        order_line_id: l.id,
        product_code: l.product_code,
        product_name: l.name_vi ?? l.product_code,
        qty: l.qty,
        unit: l.unit,
        image_src: fid ? fileImageSrc(fid) : null,
        has_components: comps.length > 0,
        synced_sets: syncedByLine.get(l.id)?.synced_sets ?? 0,
        rows,
      }
    })

    // KHỐI LƯỢNG THEO CÔNG ĐOẠN (bước 2, 09/11/2026): cùng `tallyLineStages`
    // với dải công đoạn ở Lệnh sản xuất và "cần" của việc giao tổ — sổ lấy từ
    // entries như jobs.service (không qua summary, vì summary đã cắt lộ trình
    // chi tiết bị gộp nên không còn số hàn của chúng để suy cụm mặc nhiên).
    const doneByCompStage = new Map<string, number>()
    for (const e of entries) {
      const k = `${e.component_id}|${e.stage}`
      doneByCompStage.set(k, (doneByCompStage.get(k) ?? 0) + Number(e.qty))
    }
    const khoiLuong = khoiLuongOf(
      lines.map((l) => ({
        id: l.id,
        product_id: l.product_id,
        product_code: l.product_code,
        product_name: l.name_vi ?? l.product_code,
        qty: l.qty,
        unit: l.unit,
        comps: components
          .filter((c) => c.production_order_line_id === l.id)
          .map((c) => ({ ...c, line_qty: l.qty })),
      })),
      plannedByLine,
      stagesCat,
      doneByCompStage,
      jobs,
      counting,
    )

    // Cột = công đoạn có mặt trên lộ trình của ít nhất một dòng, theo thứ tự danh mục.
    const present = new Set<string>()
    for (const ln of linesOut)
      for (const r of ln.rows) for (const s of r.route) present.add(s)
    const stages: DossierStage[] = cfg
      .filter((s) => present.has(s.code))
      .map((s) => ({ code: s.code, label: s.label, count_level: s.meta.count_level }))

    return {
      lsx: {
        id: lsx.id,
        code: lsx.code,
        customer_name: lsx.customer_name,
        order_codes: lsx.order_codes,
        ship_date: lsx.ship_date,
        status: lsx.status,
        priority: lsx.priority,
        created_at: lsx.created_at,
        approved_at: lsx.approved_at,
        completed_at: lsx.completed_at,
      },
      holder: resolveHolder(lsx),
      stages,
      lines: linesOut,
      jobs,
      teams: depts
        .filter((d) => d.workspace_id === 'production')
        .map((d) => ({
          id: d.id,
          name: d.name,
          stage_code: resolveTeamStage(d, stagesCat),
        })),
      pbs,
      pgt: pgtAll.docs,
      khoi_luong: khoiLuong,
      unshaped: linesOut.filter((l) => !l.has_components).length,
      today: vnTodayIso(),
    }
  },
}
