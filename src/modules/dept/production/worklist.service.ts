import { componentsRepo } from './components.repo'
import { entriesRepo } from './entries.repo'
import { productionRepo } from './production.repo'
import { jobsRepo } from './jobs.repo'
import { lsxLinesRepo } from './lsx-lines.repo'
import { calcComponent } from '@/lib/component-needs'
import { stageProgress, type EntryTally } from '@/lib/production-summary'
import { clipRoute, isPurchasedGroup, resolveComponentRoute } from '@/lib/stage-route'
import {
  DEFAULT_ASSEMBLY_NAME,
  defaultAssemblyId,
  resolveCountingPlan,
} from '@/lib/default-assembly'
import { countsAsOfficial, countsAsPending } from '@/lib/entry-doc-flow'
import type { EntryDocStatus } from '@/lib/entry-doc-flow'
import { shiftIso, vnTodayIso } from '@/lib/local-date'
import { transfersRepo } from './transfers.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { resolveTeamStage } from '@/lib/stage-for-dept'
import { fileImageSrc } from '@/server/file-image'
import { productsRepo } from '@/modules/dept/technical/technical.repo'
import type { User } from '@/modules/core/users/users.repo'

/**
 * CÔNG VIỆC CẦN GHI NHẬN — màn đầu tiên của Thống kê (Bước 5).
 *
 * Một dòng = một (lệnh SX × sản phẩm × công đoạn), đo bằng **BỘ sản phẩm** chứ
 * không phải số chi tiết: tổ báo "hôm nay cắt xong 35 bộ", không ai báo 35 chân
 * cộng 35 tựa. Số bộ đã qua một công đoạn = chi tiết CHẬM NHẤT quyết định —
 * thiếu một cái tựa thì bộ đó chưa xong, dù chân đã dư.
 *
 * Công đoạn của chi tiết lấy theo thứ tự: kế hoạch SX → suy theo nhóm vật tư
 * (xem lib/stage-route). Chi tiết chưa phân nhóm và hàng mua (ngũ kim) không
 * sinh dòng việc nào.
 *
 * Đạt = chỉ phiếu ĐÃ XÁC NHẬN (luật Bước 3); phiếu đang chờ tổ trưởng duyệt
 * hiện riêng ở `pending`, để phân biệt "xưởng chậm" với "tắc ở khâu duyệt".
 */

export type WorklistRow = {
  lsx_id: string
  lsx_code: string
  customer_name: string
  ship_date: string | null
  order_line_id: string
  product_code: string
  product_name: string
  stage: string
  stage_label: string
  /** Kế hoạch, đơn vị BỘ sản phẩm. */
  planned: number
  /** Đã đạt (bộ) — chỉ đếm phiếu đã xác nhận. */
  done: number
  /** Đang chờ tổ trưởng duyệt (bộ) — KHÔNG cộng vào `done`. */
  pending: number
  remaining: number
  pct: number
  status: 'not_started' | 'in_progress' | 'done'
}

/**
 * Một LỆNH ở màn danh sách. Gom theo lệnh vì một lệnh có nhiều SP × nhiều công
 * đoạn — liệt kê phẳng ra vài trăm dòng thì không ai đọc nổi (user chốt 26/08).
 */
export type LsxCard = {
  lsx_id: string
  lsx_code: string
  customer_name: string
  ship_date: string | null
  order_codes: string[]
  /** Số dòng SP có việc ghi nhận trong lệnh. */
  product_count: number
  /** Tổng số việc = (SP × công đoạn). */
  job_count: number
  open_count: number
  done_count: number
  /** Σ bộ đang chờ tổ trưởng duyệt trong cả lệnh. */
  pending_sets: number
  /** Công đoạn có việc, đúng thứ tự danh mục — vẽ dải chip trên thẻ. */
  stage_labels: string[]
  /** Σ SL đặt (bộ) của các dòng SP có việc — mẫu số cái nhìn bao quát. */
  total_sets: number
  /** Σ bộ đã qua CÔNG ĐOẠN CUỐI của từng dòng — tử số "xong x/y bộ". */
  done_sets: number
}

export type WorklistPayload = {
  stages: { code: string; label: string }[]
  rows: WorklistRow[]
  /** Gom theo lệnh — nguồn cho màn danh sách. */
  lsx_cards: LsxCard[]
  /** Chi tiết chưa phân nhóm → không biết đi công đoạn nào; cần Kỹ thuật vá. */
  unrouted_count: number
}

/** Số BỘ đã qua công đoạn: chi tiết chậm nhất quyết định, kẹp trần ở SL đặt. */
function setsDone(
  comps: { total_needed: number; done: number }[],
  lineQty: number,
): number {
  const per = comps
    .filter((c) => c.total_needed > 0)
    .map((c) => Math.floor((c.done * lineQty) / c.total_needed))
  if (per.length === 0) return 0
  return Math.min(Math.min(...per), lineQty)
}

export const worklistService = {
  /**
   * Danh sách việc cần ghi nhận của các lệnh đang chạy.
   * `stage` bỏ trống = mọi công đoạn. Đọc: mọi NV đã đăng nhập.
   */
  async list(
    _user: User,
    filter: { stage?: string | null; lsxId?: string | null } = {},
  ): Promise<WorklistPayload> {
    const [allActive, stages] = await Promise.all([
      productionRepo.listActive(),
      productionRepo.listStages(),
    ])
    const active = filter.lsxId
      ? allActive.filter((l) => l.id === filter.lsxId)
      : allActive
    const stageLabel = new Map(stages.map((s) => [s.code, s.label]))
    const stageOrder = new Map(stages.map((s, i) => [s.code, i]))

    const rows: WorklistRow[] = []
    let unrouted = 0

    for (const lsx of active) {
      const [components, lines, jobs, entries] = await Promise.all([
        componentsRepo.listByLsx(lsx.id),
        lsxLinesRepo.listLines(lsx.id),
        jobsRepo.listByLsx(lsx.id),
        entriesRepo.listByLsxWithStatus(lsx.id),
      ])
      if (lines.length === 0) continue

      // Lộ trình do Kế hoạch lên (nếu có) — theo dòng SP, đúng thứ tự.
      const plannedRoute = new Map<string, string[]>()
      for (const j of [...jobs].sort((a, b) => a.seq - b.seq)) {
        const arr = plannedRoute.get(j.production_order_line_id) ?? []
        arr.push(j.stage)
        plannedRoute.set(j.production_order_line_id, arr)
      }

      // Sản lượng gộp theo (chi tiết × công đoạn), tách theo trạng thái phiếu.
      const tally = new Map<string, EntryTally>()
      for (const e of entries) {
        const k = `${e.component_id}|${e.stage}`
        const t = tally.get(k) ?? {
          confirmed: { qty: 0, defect: 0 },
          pending: { qty: 0, defect: 0 },
        }
        const st = e.doc_status as EntryDocStatus
        if (countsAsOfficial(st)) {
          t.confirmed.qty += Number(e.qty)
          t.confirmed.defect += Number(e.defect_qty)
        } else if (countsAsPending(st)) {
          t.pending.qty += Number(e.qty)
          t.pending.defect += Number(e.defect_qty)
        }
        tally.set(k, t)
      }

      for (const line of lines) {
        const mine = components.filter((c) => c.production_order_line_id === line.id)
        if (mine.length === 0) continue

        // Công đoạn nào dòng SP này đi qua = hợp của lộ trình các chi tiết.
        const routeOf = new Map<string, string[]>()
        const stagesOfLine = new Set<string>()
        for (const c of mine) {
          // Cắt về khoảng [first..final] của chính nó (0088): chi tiết đã gộp
          // vào cụm dừng trước hàn; cụm (kể cả cụm vật chất hoá từ cụm mặc
          // nhiên) chỉ đếm từ công đoạn đầu của nó trở đi.
          const r = clipRoute(
            resolveComponentRoute(plannedRoute.get(line.id), c.group_code),
            c.first_stage,
            c.final_stage,
          )
          // Đếm CHƯA BIẾT lộ trình — KHÔNG gồm hàng mua. Ngũ kim (vít, bulong)
          // cũng có lộ trình rỗng nhưng đó là ĐÚNG: tổ không gia công chúng.
          // Gộp hai thứ này lại là bảo người đi vá thứ không hỏng. Cụm cũng
          // không tính: cụm thiếu nhóm sẽ có lộ trình khi lệnh lên kế hoạch,
          // không phải thứ Kỹ thuật phải đi phân nhóm.
          if (r.length === 0 && c.kind !== 'assembly' && !isPurchasedGroup(c.group_code))
            unrouted++
          routeOf.set(c.id, r)
          for (const s of r) stagesOfLine.add(s)
        }

        for (const stage of [...stagesOfLine].sort(
          (a, b) => (stageOrder.get(a) ?? 99) - (stageOrder.get(b) ?? 99),
        )) {
          if (filter.stage && stage !== filter.stage) continue
          // Chỉ chi tiết THỰC SỰ đi qua công đoạn này mới tính vào bộ.
          const inStage = mine.filter((c) => routeOf.get(c.id)?.includes(stage))
          if (inStage.length === 0) continue

          const measured = inStage.map((c) => {
            const total = calcComponent(
              {
                qty_per_unit: c.qty_per_unit,
                dm_kg: c.dm_kg,
                pcs_per_bar: c.pcs_per_bar,
              },
              line.qty,
            ).total_needed
            const t = tally.get(`${c.id}|${stage}`)
            return {
              total_needed: total,
              done: t?.confirmed.qty ?? 0,
              pending: t?.pending.qty ?? 0,
            }
          })

          const done = setsDone(measured, line.qty)
          const pending = setsDone(
            measured.map((m) => ({
              total_needed: m.total_needed,
              done: m.done + m.pending,
            })),
            line.qty,
          )
          const p = stageProgress(line.qty, {
            confirmed: { qty: done, defect: 0 },
            pending: { qty: Math.max(0, pending - done), defect: 0 },
          })

          rows.push({
            lsx_id: lsx.id,
            lsx_code: lsx.code,
            customer_name: lsx.customer_name,
            ship_date: lsx.ship_date,
            order_line_id: line.id,
            product_code: line.product_code,
            product_name: line.name_vi ?? line.product_code,
            stage,
            stage_label: stageLabel.get(stage) ?? stage,
            planned: p.planned,
            done: p.done,
            pending: p.pending_qty,
            remaining: p.remaining,
            pct: p.pct,
            status: p.status,
          })
        }
      }
    }

    // Việc CHƯA XONG lên trước — đó là thứ thống kê phải ghi hôm nay.
    rows.sort((a, b) => {
      if ((a.status === 'done') !== (b.status === 'done')) {
        return a.status === 'done' ? 1 : -1
      }
      return (
        a.lsx_code.localeCompare(b.lsx_code) ||
        (stageOrder.get(a.stage) ?? 99) - (stageOrder.get(b.stage) ?? 99) ||
        a.product_code.localeCompare(b.product_code)
      )
    })

    // Gom theo lệnh cho màn danh sách. Tiến độ của lệnh nói bằng "x/y việc
    // xong" chứ không bịa ra một % có trọng số — thống kê cần biết CÒN BAO
    // NHIÊU VIỆC PHẢI GHI, không cần một con số tổng hợp mơ hồ.
    const cardById = new Map<string, LsxCard>()
    for (const r of rows) {
      const card = cardById.get(r.lsx_id) ?? {
        lsx_id: r.lsx_id,
        lsx_code: r.lsx_code,
        customer_name: r.customer_name,
        ship_date: r.ship_date,
        order_codes: active.find((l) => l.id === r.lsx_id)?.order_codes ?? [],
        product_count: 0,
        job_count: 0,
        open_count: 0,
        done_count: 0,
        pending_sets: 0,
        stage_labels: [],
        total_sets: 0,
        done_sets: 0,
      }
      card.job_count++
      if (r.status === 'done') card.done_count++
      else card.open_count++
      card.pending_sets += r.pending
      if (!card.stage_labels.includes(r.stage_label)) {
        card.stage_labels.push(r.stage_label)
      }
      cardById.set(r.lsx_id, card)
    }
    for (const [id, card] of cardById) {
      const mine = rows.filter((r) => r.lsx_id === id)
      card.product_count = new Set(mine.map((r) => r.order_line_id)).size
      card.stage_labels.sort(
        (a, b) =>
          (stages.findIndex((s) => s.label === a) + 1 || 99) -
          (stages.findIndex((s) => s.label === b) + 1 || 99),
      )
      // Bao quát theo BỘ: mẫu số = Σ SL đặt các dòng có việc; tử số = Σ bộ đã
      // qua công đoạn CUỐI CÙNG của từng dòng (xong cả chuỗi mới là xong).
      const byLine = new Map<string, WorklistRow[]>()
      for (const r of mine) {
        const arr = byLine.get(r.order_line_id) ?? []
        arr.push(r)
        byLine.set(r.order_line_id, arr)
      }
      for (const rs of byLine.values()) {
        const last = rs.reduce((a, b) =>
          (stageOrder.get(b.stage) ?? 99) > (stageOrder.get(a.stage) ?? 99) ? b : a,
        )
        card.total_sets += last.planned
        card.done_sets += last.done
      }
    }
    // Lệnh còn nhiều việc mở lên trước; hết việc xuống cuối.
    const lsx_cards = [...cardById.values()].sort(
      (a, b) => b.open_count - a.open_count || a.lsx_code.localeCompare(b.lsx_code),
    )

    return { stages, rows, lsx_cards, unrouted_count: unrouted }
  },
}

// ── PHIẾU GHI SỔ — dữ liệu màn lập phiếu (Sổ Sản Lượng v2, B1 — 27/08) ──────
//
// 1 phiếu = 1 lệnh × 1 công đoạn × 1 tổ × 1 ngày (0172). Màn bày sẵn ĐÚNG dòng
// phải gõ theo thang đơn vị đếm: phôi ra CHI TIẾT, từ hàn ra dòng CỤM đếm BỘ
// (cụm thật, hoặc cụm mặc nhiên id ảo — record vật chất hoá ở lượt ghi đầu).

export type EntrySheetLine = {
  component_id: string
  kind: 'part' | 'assembly'
  /** true = cụm mặc nhiên (id ảo `default-asm:`) — chưa có dòng DB. */
  is_virtual: boolean
  cluster: string | null
  name: string
  unit: string | null
  /** ĐM kg/đơn vị — gợi ý kg = ĐM × SL, không bắt gõ. */
  dm_kg: number | null
  needed: number
  /** Đã đạt — chỉ phiếu đã xác nhận. */
  done: number
  /** Đã ghi, chờ tổ trưởng xác nhận. */
  pending: number
  remaining: number
  /** Đã ghi HÔM NAY (mọi trạng thái phiếu, kể cả nháp) — chống gõ đúp. */
  today_qty: number
}

export type EntrySheetGroup = {
  order_line_id: string
  product_code: string
  product_name: string
  /** SL đặt của dòng — đơn vị BỘ. */
  qty: number
  /** Ảnh SP (URL ký HMAC ổn định) — thống kê đối chiếu với sổ giấy bằng mắt. */
  image_src: string | null
  lines: EntrySheetLine[]
}

export type EntrySheet = {
  lsx: {
    id: string
    code: string
    customer_name: string
    ship_date: string | null
    status: string
  }
  stage: string
  stage_label: string
  /** Công đoạn CÓ VIỆC của lệnh, đúng thứ tự danh mục — dải chip chuyển tab. */
  stages: { code: string; label: string }[]
  /** Tổ xưởng + công đoạn phụ trách — mặc định chọn tổ khớp công đoạn. */
  teams: { id: string; name: string; stage_code: string | null }[]
  groups: EntrySheetGroup[]
  /** (chi tiết × tổ) hệ đề xuất: tổ đang cầm hàng được giao / ghi 7 ngày qua. */
  suggested: { component_id: string; team_id: string }[]
  /** Lý do phế dùng 30 ngày gần đây — gợi ý gõ nhanh. */
  recent_defect_reasons: string[]
  today: string
  /** false = lệnh chưa duyệt / đã kết thúc → màn chỉ xem. */
  can_record: boolean
}

/**
 * Tải dữ liệu màn lập phiếu. `stage` bỏ trống / không có việc → công đoạn đầu
 * tiên có việc của lệnh. Trả null khi lệnh không tồn tại hoặc không có việc.
 */
export async function loadEntrySheet(
  lsxId: string,
  stageWanted?: string | null,
): Promise<EntrySheet | null> {
  const [lsx, components, lines, jobs, entries, stagesCat, depts, transfers] =
    await Promise.all([
      productionRepo.findById(lsxId),
      componentsRepo.listByLsx(lsxId),
      lsxLinesRepo.listLines(lsxId),
      jobsRepo.listByLsx(lsxId),
      entriesRepo.listByLsxWithStatus(lsxId),
      productionRepo.listStages(),
      departmentsRepo.list(),
      transfersRepo.listRawByLsx(lsxId),
    ])
  if (!lsx || lines.length === 0) return null

  const plannedByLine = new Map<string, string[]>()
  for (const j of [...jobs].sort((a, b) => a.seq - b.seq)) {
    const arr = plannedByLine.get(j.production_order_line_id) ?? []
    arr.push(j.stage)
    plannedByLine.set(j.production_order_line_id, arr)
  }

  // Lộ trình hiệu lực per component + kế hoạch đếm per dòng — một lần, dùng
  // cho cả việc chọn công đoạn lẫn dựng dòng nhập.
  const planByLine = new Map<string, ReturnType<typeof resolveCountingPlan>>()
  const routeOf = new Map<string, string[]>()
  const worked = new Set<string>()
  for (const line of lines) {
    const lineComps = components.filter((c) => c.production_order_line_id === line.id)
    const plan = resolveCountingPlan(lineComps, plannedByLine.get(line.id))
    planByLine.set(line.id, plan)
    for (const c of lineComps) {
      const r =
        plan.own_route.get(c.id) ??
        clipRoute(
          resolveComponentRoute(plannedByLine.get(line.id), c.group_code),
          c.first_stage,
          c.final_stage,
        )
      routeOf.set(c.id, r)
      for (const s of r) worked.add(s)
    }
    for (const s of plan.virtual_stages) worked.add(s)
  }
  const stages = stagesCat.filter((s) => worked.has(s.code))
  if (stages.length === 0) return null
  const stage = stages.some((s) => s.code === stageWanted)
    ? (stageWanted as string)
    : stages[0].code

  // Ảnh SP: ảnh dòng lệnh thắng, thiếu thì rơi về ảnh hồ sơ SP.
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
  const imageOf = (line: (typeof lines)[number]): string | null => {
    const fid =
      line.image_file_id ?? (line.product_id ? productImgs.get(line.product_id) : null)
    return fid ? fileImageSrc(fid) : null
  }

  // Sản lượng của CÔNG ĐOẠN đang mở, tách theo trạng thái phiếu + đã ghi hôm nay.
  const todayIso = vnTodayIso()
  const tally = new Map<string, EntryTally>()
  const todayQty = new Map<string, number>()
  for (const e of entries) {
    if (e.stage !== stage) continue
    const t = tally.get(e.component_id) ?? {
      confirmed: { qty: 0, defect: 0 },
      pending: { qty: 0, defect: 0 },
    }
    const st = e.doc_status as EntryDocStatus
    if (countsAsOfficial(st)) t.confirmed.qty += Number(e.qty)
    else if (countsAsPending(st)) t.pending.qty += Number(e.qty)
    tally.set(e.component_id, t)
    if (e.entry_date === todayIso) {
      todayQty.set(e.component_id, (todayQty.get(e.component_id) ?? 0) + Number(e.qty))
    }
  }

  const groups: EntrySheetGroup[] = []
  for (const line of lines) {
    const lineComps = components.filter((c) => c.production_order_line_id === line.id)
    const plan = planByLine.get(line.id)!
    const out: EntrySheetLine[] = lineComps
      .filter((c) => routeOf.get(c.id)?.includes(stage))
      .map((c) => {
        const needed = calcComponent(
          { qty_per_unit: c.qty_per_unit, dm_kg: c.dm_kg, pcs_per_bar: c.pcs_per_bar },
          line.qty,
        ).total_needed
        const t = tally.get(c.id)
        const done = t?.confirmed.qty ?? 0
        return {
          component_id: c.id,
          kind: c.kind,
          is_virtual: false,
          cluster: c.cluster,
          name: c.name,
          unit: c.unit,
          dm_kg: c.dm_kg,
          needed,
          done,
          pending: t?.pending.qty ?? 0,
          remaining: Math.max(0, needed - done),
          today_qty: todayQty.get(c.id) ?? 0,
        }
      })

    // Dòng CỤM MẶC NHIÊN: đơn vị BỘ, cần = SL đặt; sản lượng SUY từ sổ chi
    // tiết bị gộp (min chi tiết chậm nhất) vì cụm ảo chưa có sổ riêng.
    if (plan.virtual_stages.includes(stage)) {
      const absorbed = lineComps
        .filter((c) => plan.own_route.has(c.id))
        .map((c) => {
          const total = calcComponent(
            { qty_per_unit: c.qty_per_unit, dm_kg: c.dm_kg, pcs_per_bar: c.pcs_per_bar },
            line.qty,
          ).total_needed
          const t = tally.get(c.id)
          return { total, confirmed: t?.confirmed.qty ?? 0, pending: t?.pending.qty ?? 0 }
        })
      const minSets = (pick: (a: (typeof absorbed)[number]) => number) => {
        let m: number | null = null
        for (const a of absorbed) {
          if (a.total <= 0) continue
          const sets = Math.floor((pick(a) * line.qty) / a.total)
          m = m == null ? sets : Math.min(m, sets)
        }
        return Math.min(m ?? 0, line.qty)
      }
      const vDone = minSets((a) => a.confirmed)
      const vAll = minSets((a) => a.confirmed + a.pending)
      out.push({
        component_id: defaultAssemblyId(line.id),
        kind: 'assembly',
        is_virtual: true,
        cluster: null,
        name: DEFAULT_ASSEMBLY_NAME,
        unit: 'bộ',
        dm_kg: null,
        needed: line.qty,
        done: vDone,
        pending: Math.max(0, vAll - vDone),
        remaining: Math.max(0, line.qty - vDone),
        today_qty: 0,
      })
    }

    if (out.length > 0) {
      groups.push({
        order_line_id: line.id,
        product_code: line.product_code,
        product_name: line.name_vi ?? line.product_code,
        qty: line.qty,
        image_src: imageOf(line),
        lines: out,
      })
    }
  }

  // ĐỀ XUẤT TRƯỚC, NHẬP SAU (mượn proposal của SAP CO11N): tổ đang cầm hàng
  // được giao chưa dùng hết, hoặc tổ đã ghi (chi tiết × công đoạn này) trong
  // 7 ngày — thực tế xưởng cùng một mã làm nhiều ngày liền.
  const suggested: { component_id: string; team_id: string }[] = []
  const seenSug = new Set<string>()
  const pushSug = (componentId: string, teamId: string) => {
    const k = `${componentId}|${teamId}`
    if (seenSug.has(k)) return
    seenSug.add(k)
    suggested.push({ component_id: componentId, team_id: teamId })
  }
  const issuedNet = new Map<string, number>()
  for (const t of transfers) {
    if (t.stage !== stage) continue
    const k = `${t.component_id}|${t.team_department_id}`
    issuedNet.set(
      k,
      (issuedNet.get(k) ?? 0) +
        (t.direction === 'issue' ? Number(t.qty) : -Number(t.qty)),
    )
  }
  for (const [k, net] of issuedNet) {
    if (net <= 0) continue
    const [componentId, teamId] = k.split('|')
    pushSug(componentId, teamId)
  }
  const from7 = shiftIso(todayIso, -7)
  const from30 = shiftIso(todayIso, -30)
  const reasonSeen = new Set<string>()
  const reasons: { reason: string; at: string }[] = []
  for (const e of entries) {
    if (e.stage === stage && e.team_department_id && e.entry_date >= from7) {
      pushSug(e.component_id, e.team_department_id)
    }
    if (e.defect_reason && e.entry_date >= from30) {
      const r = e.defect_reason.trim()
      if (r && !reasonSeen.has(r.toLowerCase())) {
        reasonSeen.add(r.toLowerCase())
        reasons.push({ reason: r, at: e.created_at })
      }
    }
  }
  reasons.sort((a, b) => b.at.localeCompare(a.at))

  return {
    lsx: {
      id: lsx.id,
      code: lsx.code,
      customer_name: lsx.customer_name,
      ship_date: lsx.ship_date,
      status: lsx.status,
    },
    stage,
    stage_label: stagesCat.find((s) => s.code === stage)?.label ?? stage,
    stages,
    teams: depts
      .filter((d) => d.workspace_id === 'production')
      .map((d) => ({
        id: d.id,
        name: d.name,
        stage_code: resolveTeamStage(d, stagesCat),
      })),
    groups,
    suggested,
    recent_defect_reasons: reasons.slice(0, 15).map((r) => r.reason),
    today: todayIso,
    can_record: lsx.status === 'approved' || lsx.status === 'in_progress',
  }
}
