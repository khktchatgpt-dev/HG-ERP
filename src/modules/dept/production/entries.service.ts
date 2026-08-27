import { entriesRepo, type ProductionEntry } from './entries.repo'
import { componentsRepo } from './components.repo'
import { productionRepo } from './production.repo'
import { jobsRepo, type Job } from './jobs.repo'
import { dayLocksRepo } from './day-locks.repo'
import { ordersRepo } from '@/modules/dept/sales/orders.repo'
import { lsxLinesRepo } from './lsx-lines.repo'
import { calcComponent } from '@/lib/component-needs'
import {
  assemblyWipWarning,
  backflushKg,
  overrunWarning,
  summarizeComponent,
  stageChainWarning,
  summarizeTeamWip,
  syncedSets,
  teamWipShortageWarning,
  type ComponentSummary,
} from '@/lib/production-summary'
import { clipRoute, resolveComponentRoute } from '@/lib/stage-route'
import {
  DEFAULT_ASSEMBLY_NAME,
  defaultAssemblyId,
  defaultAssemblyLineId,
  defaultAssemblyOutputs,
  isDefaultAssemblyId,
  resolveCountingPlan,
  type CountingPlan,
} from '@/lib/default-assembly'
import { transfersRepo } from './transfers.repo'
import { outsourceRepo } from './outsource.repo'
import { entryDocsRepo } from './entry-docs.repo'
import { shiftIso, vnTodayIso } from '@/lib/local-date'
import type { User } from '@/modules/core/users/users.repo'
import { assertAction } from '@/modules/core/rbac/rbac.service'
import { BadRequest, Conflict, Forbidden, NotFound } from '@/server/http'

/**
 * SỔ SỐ LIỆU sản xuất (thống kê xưởng nhập tập trung — 0084). Nguồn SỐ duy
 * nhất; trạng thái nằm ở production_jobs:
 *  - có sản lượng đầu tiên ở (dòng SP × công đoạn) → job todo tự nhích doing;
 *  - lần ghi đầu của lệnh approved → lệnh in_progress + đơn in_production.
 * Nhập vượt tổng cần KHÔNG chặn — trả warnings (FR-PR-07 giữ lại).
 */

type RecordInput = {
  stage: string
  entry_date: string
  team_department_id?: string | null
  /**
   * true = "Ghi sổ chính thức" → phiếu vào thẳng 'da_xac_nhan' (user chốt
   * 27/08: hiện không cần tổ trưởng xác nhận). false/bỏ trống = "Lưu nháp"
   * → 'nhap', chưa ai thấy, chưa tính vào đâu.
   */
  submit?: boolean
  /** Ghi chú CẢ PHIẾU (khác note của từng dòng chi tiết). */
  note?: string | null
  entries: {
    component_id: string
    qty: number
    kg?: number | null
    defect_qty?: number
    defect_reason?: string | null
    machine_note?: string | null
    worker_name?: string | null
    finish_state?: 'tran' | 'dang_may' | null
    note?: string | null
  }[]
}

export type ComponentOutputView = {
  id: string
  order_line_id: string
  /** 'part' = chi tiết (đếm ở phôi); 'assembly' = cụm (đếm từ hàn — 0088). */
  kind: 'part' | 'assembly'
  cluster: string | null
  name: string
  unit: string | null
  total_needed: number
  /** ĐM kg/đơn vị — lưới nhập gợi ý kg = ĐM × SL (0090). */
  dm_kg: number | null
  /** Vật tư (join) — sổ tổng phân PHẦN SẮT/NHÔM theo các trường này (GĐ1). */
  material_type: string | null
  material_code: string | null
  material_name: string | null
  /** Lộ trình công đoạn của dòng SP (jobs theo seq); null = chưa lên kế hoạch. */
  allowed_stages: string[] | null
  summary: ComponentSummary
  /**
   * true = CỤM MẶC NHIÊN (lib/default-assembly): BOM phẳng nên từ hàn trở đi
   * đếm theo BỘ bằng dòng suy này. id là id ảo — KHÔNG ghi sổ trực tiếp vào nó.
   */
  is_virtual?: boolean
}

// ── Bảng nhập toàn xưởng theo công đoạn (GĐ2 — 24/08) ───────────────────────

export type BoardComponent = {
  id: string
  kind: 'part' | 'assembly'
  cluster: string | null
  name: string
  unit: string | null
  dm_kg: number | null
  total_needed: number
  /** stage → tiến độ lũy kế — CHỈ công đoạn trong khoảng [first..final] của nó. */
  stages: Record<string, { done: number; missing: number }>
  /** stage → đã ghi trong NGÀY đang mở (mọi tổ) — tránh gõ đúp. */
  today: Record<string, { qty: number; defect: number }>
}

export type BoardProduct = {
  order_line_id: string
  product_code: string
  product_name: string
  qty: number
  components: BoardComponent[]
}

export type BoardLsx = {
  id: string
  code: string
  customer_name: string
  ship_date: string | null
  products: BoardProduct[]
}

/**
 * Dòng GỢI Ý cho phiếu nhập của một tổ (thiết kế lại 26/08 — mượn "proposal"
 * của SAP CO11N/CO12): hệ thống đề xuất sẵn dòng, người nhập chỉ sửa số.
 *  - 'transfer': tổ được GIAO chi tiết này (sổ bàn giao) mà chưa dùng hết;
 *  - 'recent': tổ đã ghi chi tiết × công đoạn này trong 7 ngày gần đây
 *    (thực tế xưởng: cùng một mã làm nhiều ngày liền).
 */
export type BoardSuggestion = {
  team_id: string
  lsx_id: string
  component_id: string
  stage: string
  source: 'transfer' | 'recent'
}

export type BoardPayload = {
  stages: { code: string; label: string }[]
  lsx: BoardLsx[]
  suggested: BoardSuggestion[]
  /** Lý do phế dùng gần đây (30 ngày, mới nhất trước) — gợi ý gõ nhanh. */
  recent_defect_reasons: string[]
}

async function loadLsxContext(lsxId: string) {
  const lsx = await productionRepo.findById(lsxId)
  if (!lsx) throw NotFound('LSX không tồn tại')
  const [components, orderLines, groups, jobs] = await Promise.all([
    componentsRepo.listByLsx(lsxId),
    lsxLinesRepo.listLines(lsxId),
    lsxLinesRepo.listGroups(lsxId),
    jobsRepo.listByLsx(lsxId),
  ])
  // Dòng lệnh thuộc NHÓM, nhóm mới gắn đơn (0114) → tra đơn qua nhóm.
  const orderIdByGroup = new Map(groups.map((g) => [g.id, g.sales_order_id]))
  const qtyByLine = new Map(orderLines.map((l) => [l.id, l.qty]))
  const totalByComponent = new Map(
    components.map((c) => [
      c.id,
      calcComponent(
        { qty_per_unit: c.qty_per_unit, dm_kg: c.dm_kg, pcs_per_bar: c.pcs_per_bar },
        qtyByLine.get(c.production_order_line_id) ?? 0,
      ).total_needed,
    ]),
  )
  // Lộ trình CÓ THỨ TỰ per dòng SP = jobs theo seq (thay bảng routes cũ).
  const routeByLine = new Map<string, string[]>()
  for (const j of [...jobs].sort((a, b) => a.seq - b.seq)) {
    const arr = routeByLine.get(j.production_order_line_id) ?? []
    arr.push(j.stage)
    routeByLine.set(j.production_order_line_id, arr)
  }
  return {
    lsx,
    components,
    orderLines,
    orderIdByGroup,
    jobs,
    totalByComponent,
    routeByLine,
  }
}

export const entriesService = {
  /**
   * Nhập sổ theo LÔ (1 công đoạn + 1 ngày + 1 tổ, nhiều chi tiết).
   * Công đoạn phải thuộc kế hoạch của dòng SP (dòng chưa lên KH → nhập tự do).
   */
  async record(
    user: User,
    lsxId: string,
    input: RecordInput,
  ): Promise<{ warnings: string[]; doc_no: string }> {
    await assertAction(user, 'production.entries.record')
    const { lsx, components, orderLines, orderIdByGroup, totalByComponent, routeByLine } =
      await loadLsxContext(lsxId)
    if (lsx.status !== 'approved' && lsx.status !== 'in_progress') {
      throw BadRequest('Chỉ nhập sổ cho LSX đã duyệt / đang sản xuất')
    }
    const byId = new Map(components.map((c) => [c.id, c]))

    // ── CỤM MẶC NHIÊN → VẬT CHẤT HOÁ (bậc 2 thang đơn vị đếm, 27/08) ─────────
    // Sổ gửi id ảo `default-asm:<line_id>` khi ghi số BỘ ở hàn+ cho BOM phẳng.
    // Lượt ghi ĐẦU TIÊN biến cụm ảo thành dòng production_components thật và
    // chốt công đoạn cuối cho chi tiết bị gộp — từ đó mọi đường (0088) đối xử
    // với nó y như cụm người khai; các lượt sau tự trỏ vào dòng thật.
    const idRemap = new Map<string, string>()
    for (const vid of new Set(
      input.entries.map((e) => e.component_id).filter(isDefaultAssemblyId),
    )) {
      const lineId = defaultAssemblyLineId(vid)!
      const line = orderLines.find((l) => l.id === lineId)
      if (!line) throw BadRequest('Có dòng sổ gắn cụm mặc nhiên không thuộc lệnh này')
      const lineComps = components.filter((c) => c.production_order_line_id === lineId)
      // Đã vật chất hoá (lượt ghi trước / màn khác vừa ghi) → dùng lại dòng thật.
      let real = lineComps.find((c) => c.kind === 'assembly' && c.cluster == null)
      if (!real) {
        const plan = resolveCountingPlan(lineComps, routeByLine.get(lineId))
        if (plan.virtual_stages.length === 0) {
          throw BadRequest(
            'Dòng SP này không (còn) cụm mặc nhiên — tải lại màn ghi sổ rồi ghi lại',
          )
        }
        const absorbed = lineComps.filter((c) => plan.own_route.has(c.id))
        const fields = {
          production_order_id: lsxId,
          production_order_line_id: lineId,
          kind: 'assembly' as const,
          cluster: null,
          name: DEFAULT_ASSEMBLY_NAME,
          // Kế thừa nhóm vật tư của chi tiết bị gộp (FRAME) — nhờ đó lộ trình
          // của cụm suy được cả khi dòng chưa lên kế hoạch SX.
          group_code: absorbed.find((c) => c.group_code)?.group_code ?? null,
          unit: 'bộ',
          qty_per_unit: 1,
          first_stage: plan.virtual_stages[0],
          final_stage: plan.virtual_stages[plan.virtual_stages.length - 1],
          note: null,
        }
        const newId = await componentsRepo.insertOne(fields)
        await componentsRepo.setFinalStages(
          absorbed.map((c) => ({
            id: c.id,
            final_stage: plan.own_route.get(c.id)![plan.own_route.get(c.id)!.length - 1],
          })),
        )
        // Cập nhật ngữ cảnh đang cầm trên tay cho phần còn lại của lượt ghi.
        for (const c of absorbed) {
          c.final_stage = plan.own_route.get(c.id)![plan.own_route.get(c.id)!.length - 1]
        }
        real = {
          ...fields,
          id: newId,
          material_id: null,
          material_type: null,
          spec_thickness_mm: null,
          spec_width_mm: null,
          spec_length_mm: null,
          wall_thickness_mm: null,
          dm_kg: null,
          pcs_per_bar: null,
          qty_per_assembly: null,
          sort_order: 9999,
          material_code: null,
          material_name: null,
          material_unit: null,
        }
        components.push(real)
        byId.set(real.id, real)
        // Cụm 1/SP → tổng cần = SL đặt của dòng.
        totalByComponent.set(real.id, Number(line.qty) || 0)
      }
      idRemap.set(vid, real.id)
    }
    // Từ đây trở đi mọi phép tính dùng bản đã trỏ về dòng thật.
    const recEntries = input.entries.map((e) =>
      idRemap.has(e.component_id)
        ? { ...e, component_id: idRemap.get(e.component_id)! }
        : e,
    )

    for (const e of recEntries) {
      if (!byId.has(e.component_id)) {
        throw BadRequest('Có dòng sổ gắn chi tiết không thuộc lệnh này')
      }
    }
    // Ghi hồi tố ngày cũ là hợp lệ (bổ sung báo giấy về muộn) — nhưng ngày
    // TƯƠNG LAI thì không có nghiệp vụ nào cả (25/08). So theo giờ VN chứ
    // không phải ngày UTC của server (xem lib/local-date).
    if (input.entry_date > vnTodayIso()) {
      throw BadRequest('Không ghi sổ cho ngày tương lai — kiểm tra lại ô ngày')
    }
    // Cảnh báo hiện TÊN công đoạn cho người đọc — mã code chỉ dân dev hiểu.
    const stagesCat = await productionRepo.listStages()
    const stageLabel = (c: string) => stagesCat.find((s) => s.code === c)?.label ?? c

    // Chốt sổ khoá THEO TỔ nên bản ghi phải có tổ — không thì ghi "vô chủ" là
    // đường lách khoá + sổ tổ thiếu số (25/08, đóng lỗ hổng cũ).
    const team = input.team_department_id ?? user.department_id ?? null
    if (!team) {
      throw BadRequest('Chọn tổ trước khi ghi sổ — chốt sổ cuối ngày khoá theo tổ')
    }
    const lock = await dayLocksRepo.find(team, input.entry_date)
    if (lock) {
      throw BadRequest(
        `Sổ ngày ${input.entry_date} của tổ đã chốt — nhờ quản lý mở khoá trước khi ghi thêm`,
      )
    }

    // Công đoạn nhập ∈ kế hoạch của dòng SP chứa chi tiết (dòng chưa lên KH
    // thì nhập tự do — cùng chính sách lệnh cũ).
    for (const e of recEntries) {
      const comp = byId.get(e.component_id)!
      const route = routeByLine.get(comp.production_order_line_id)
      if (route && !route.includes(input.stage)) {
        throw BadRequest(
          `Chi tiết "${comp.name}" không đi qua công đoạn này theo kế hoạch — kiểm tra lại hoặc sửa kế hoạch ở màn Kế hoạch SX`,
        )
      }
    }

    // Công đoạn nhập ∈ KHOẢNG ĐẾM của chính chi tiết/cụm: chi tiết đã gộp vào
    // cụm (mặc nhiên hay người khai) thì từ hàn trở đi KHÔNG ghi theo chi tiết
    // nữa — chặn sớm kèm câu chỉ đường, thay vì để số rơi vào dòng sổ không
    // bao giờ được đọc. Khoảng rỗng (chưa phân nhóm/chưa lên KH) → nhập tự do.
    const planCache = new Map<string, CountingPlan>()
    const planOf = (lineId: string) => {
      let p = planCache.get(lineId)
      if (!p) {
        p = resolveCountingPlan(
          components.filter((c) => c.production_order_line_id === lineId),
          routeByLine.get(lineId),
        )
        planCache.set(lineId, p)
      }
      return p
    }
    for (const e of recEntries) {
      const comp = byId.get(e.component_id)!
      const eff =
        planOf(comp.production_order_line_id).own_route.get(comp.id) ??
        clipRoute(
          resolveComponentRoute(
            routeByLine.get(comp.production_order_line_id),
            comp.group_code,
          ),
          comp.first_stage,
          comp.final_stage,
        )
      if (eff.length > 0 && !eff.includes(input.stage)) {
        throw BadRequest(
          `"${comp.name}" không đếm ở công đoạn ${stageLabel(input.stage)} — khoảng ghi của nó là ${eff
            .map(stageLabel)
            .join(' → ')}; số sau khi ghép cụm thì ghi trên dòng cụm/bộ`,
        )
      }
    }

    // Cảnh báo vượt: đã làm hiện có + sắp nhập > tổng cần (không chặn).
    // "Đã làm" gồm cả NHẬN VỀ gia công có công đoạn (0171) — thiếu vế này thì
    // cảnh báo chuỗi kêu oan "hàn vượt phôi" khi phôi do NCC làm.
    const [existing, outsourced] = await Promise.all([
      entriesRepo.listByLsx(lsxId),
      outsourceRepo.listByLsx(lsxId),
    ])
    const doneByCompStage = new Map<string, number>()
    for (const en of existing) {
      const k = `${en.component_id}|${en.stage}`
      doneByCompStage.set(k, (doneByCompStage.get(k) ?? 0) + Number(en.qty))
    }
    for (const oe of outsourced) {
      if (oe.direction !== 'receive' || !oe.stage) continue
      const k = `${oe.component_id}|${oe.stage}`
      doneByCompStage.set(k, (doneByCompStage.get(k) ?? 0) + Number(oe.qty))
    }
    // Đã dùng đầu vào per (chi tiết × công đoạn × tổ) — phế cũng ăn đầu vào.
    const usedByTriple = new Map<string, number>()
    for (const en of existing) {
      if (!en.team_department_id) continue
      const k = `${en.component_id}|${en.stage}|${en.team_department_id}`
      usedByTriple.set(
        k,
        (usedByTriple.get(k) ?? 0) + Number(en.qty) + Number(en.defect_qty),
      )
    }
    const warnings: string[] = []
    for (const e of recEntries) {
      const comp = byId.get(e.component_id)
      if (!comp) continue
      const w = overrunWarning(
        comp.name,
        stageLabel(input.stage),
        doneByCompStage.get(`${e.component_id}|${input.stage}`) ?? 0,
        e.qty,
        totalByComponent.get(e.component_id) ?? 0,
      )
      if (w) warnings.push(w)
    }

    // Cảnh báo WIP LIÊN CẤP (0088): nhập CỤM ở công đoạn ĐẦU của nó (vd hàn) mà
    // số cụm vượt số chi tiết con đã xong ở công đoạn cuối của chúng. Không chặn.
    const addingByComp = new Map<string, number>()
    for (const e of recEntries) {
      addingByComp.set(e.component_id, (addingByComp.get(e.component_id) ?? 0) + e.qty)
    }

    // Cảnh báo WIP ÂM THEO CHUỖI (24/08): công đoạn sau vượt số đã xong công
    // đoạn TRƯỚC của cùng chi tiết. Cần lộ trình dòng để biết công đoạn trước;
    // công đoạn ĐẦU của chính chi tiết/cụm thì bỏ (cụm đã có cảnh báo liên cấp).
    for (const [compId, adding] of addingByComp) {
      const comp = byId.get(compId)!
      const route = routeByLine.get(comp.production_order_line_id)
      if (!route) continue
      const idx = route.indexOf(input.stage)
      if (idx <= 0) continue
      if (comp.first_stage === input.stage) continue
      const prev = route[idx - 1]
      const w = stageChainWarning(
        comp.name,
        stageLabel(input.stage),
        stageLabel(prev),
        doneByCompStage.get(`${compId}|${prev}`) ?? 0,
        doneByCompStage.get(`${compId}|${input.stage}`) ?? 0,
        adding,
      )
      if (w) warnings.push(w)
    }
    for (const [compId, adding] of addingByComp) {
      const asm = byId.get(compId)
      if (!asm || asm.kind !== 'assembly') continue
      // Chỉ đối chiếu tiêu hao chi tiết ở công đoạn đầu của cụm (nơi ghép lại).
      if (asm.first_stage && input.stage !== asm.first_stage) continue
      const assembliesAfter =
        (doneByCompStage.get(`${compId}|${input.stage}`) ?? 0) + adding
      // Cụm CÓ `cluster` → con là các chi tiết cùng cluster (0088). Cụm KHÔNG
      // cluster = cụm CẢ DÒNG (vật chất hoá từ cụm mặc nhiên) → con là mọi chi
      // tiết của dòng đã chốt công đoạn cuối; định mức per cụm thiếu thì suy
      // từ CT/SP chia số cụm/SP.
      const children = components
        .filter(
          (c) =>
            c.kind !== 'assembly' &&
            c.production_order_line_id === asm.production_order_line_id &&
            c.final_stage != null &&
            (asm.cluster == null
              ? true
              : c.cluster === asm.cluster && c.qty_per_assembly != null),
        )
        .map((c) => ({
          name: c.name,
          qtyPerAssembly: Number(
            c.qty_per_assembly ?? c.qty_per_unit / (asm.qty_per_unit || 1),
          ),
          partDone: doneByCompStage.get(`${c.id}|${c.final_stage}`) ?? 0,
        }))
      const w = assemblyWipWarning(asm.name, assembliesAfter, children)
      if (w) warnings.push(w)
    }

    // Cảnh báo VƯỢT SỐ ĐƯỢC GIAO (0090): tổ có đi qua sổ bàn giao (issued > 0)
    // mà ghi quá available = giao − trả − đã dùng. Không chặn (FR-PR-07).
    if (team) {
      const transfers = await transfersRepo.listRawByLsx(lsxId)
      const byTriple = new Map<string, { direction: 'issue' | 'return'; qty: number }[]>()
      for (const t of transfers) {
        const k = `${t.component_id}|${t.stage}|${t.team_department_id}`
        const arr = byTriple.get(k) ?? []
        arr.push(t)
        byTriple.set(k, arr)
      }
      for (const [compId, addingQty] of addingByComp) {
        const k = `${compId}|${input.stage}|${team}`
        const same = byTriple.get(k)
        if (!same?.length) continue
        const addingDefect = recEntries
          .filter((e) => e.component_id === compId)
          .reduce((a, e) => a + (e.defect_qty ?? 0), 0)
        const wip = summarizeTeamWip(same, usedByTriple.get(k) ?? 0)
        const w = teamWipShortageWarning(
          byId.get(compId)!.name,
          stageLabel(input.stage),
          wip,
          addingQty + addingDefect,
        )
        if (w) warnings.push(w)
      }
    }

    // CHỨNG TỪ HOÁ (0172): mỗi lượt ghi = một PHIẾU BÁO SẢN LƯỢNG có số hiệu
    // — in được cho tổ trưởng ký, xoá là xoá nguyên phiếu.
    const doc = await entryDocsRepo.insert({
      doc_no: await entryDocsRepo.nextDocNo(),
      production_order_id: lsxId,
      stage: input.stage,
      team_department_id: team,
      entry_date: input.entry_date,
      // User chốt 27/08/2026: HIỆN KHÔNG CẦN tổ trưởng xác nhận (tổ trưởng
      // không dùng hệ thống hằng ngày) — gửi phiếu là số CHÍNH THỨC luôn.
      // Check 0176 bắt phiếu chính thức phải có chủ: người chốt là chính
      // thống kê. Máy luật entry-doc-flow + cho_xac_nhan/tu_choi GIỮ NGUYÊN —
      // ngày nào cần tầng duyệt thì đổi lại khối này, không phải xây lại.
      status: input.submit ? 'da_xac_nhan' : 'nhap',
      confirmed_by: input.submit ? user.id : null,
      confirmed_at: input.submit ? new Date().toISOString() : null,
      note: input.note?.trim() || null,
      created_by: user.id,
    })

    await entriesRepo.insertMany(
      recEntries.map((e) => ({
        production_order_id: lsxId,
        component_id: e.component_id,
        stage: input.stage,
        team_department_id: team,
        doc_id: doc.id,
        entry_date: input.entry_date,
        qty: e.qty,
        // Bỏ trống kg → backflush ĐM × SL (Excel cũng tính, không nhập tay).
        kg: backflushKg(e.kg, byId.get(e.component_id)!.dm_kg, e.qty),
        defect_qty: e.defect_qty ?? 0,
        defect_reason: (e.defect_qty ?? 0) > 0 ? (e.defect_reason ?? null) : null,
        machine_note: e.machine_note ?? null,
        worker_name: e.worker_name ?? null,
        finish_state: e.finish_state ?? null,
        note: e.note ?? null,
        created_by: user.id,
      })),
    )

    // Job (dòng SP × công đoạn) tự nhích todo → doing khi có số đầu tiên.
    const affectedLines = new Set(
      recEntries.map((e) => byId.get(e.component_id)!.production_order_line_id),
    )
    await Promise.all(
      [...affectedLines].map((lineId) => jobsRepo.markDoing(lsxId, lineId, input.stage)),
    )

    // Lần ghi sổ đầu tiên của lệnh đã duyệt → lệnh sang "đang sản xuất".
    if (lsx.status === 'approved') {
      await productionRepo.patch(lsxId, { status: 'in_progress' })
    }
    // Lệnh gộp nhiều đơn (0113): chỉ ĐƠN có dòng vừa được ghi sổ mới sang "đang
    // sản xuất" — đơn cùng lệnh nhưng chưa ai làm thì vẫn là "đã phát lệnh".
    const orderIdsOfLines = new Set(
      orderLines
        .filter((l) => affectedLines.has(l.id))
        .map((l) => orderIdByGroup.get(l.group_id))
        .filter((x): x is string => !!x),
    )
    const started = await ordersRepo.listByProductionOrder(lsxId)
    await Promise.all(
      started
        .filter((o) => orderIdsOfLines.has(o.id) && o.status === 'lsx_issued')
        .map((o) => ordersRepo.patch(o.id, { status: 'in_production' })),
    )
    return { warnings, doc_no: doc.doc_no }
  },

  /**
   * Tổng hợp per chi tiết × công đoạn + đồng bộ per SP + sổ nhập + jobs —
   * một payload cho màn hồ sơ lệnh/bảng tổng. Đọc: mọi NV đã đăng nhập.
   */
  async summary(_user: User, lsxId: string) {
    const {
      components,
      orderLines,
      orderIdByGroup,
      jobs,
      totalByComponent,
      routeByLine,
    } = await loadLsxContext(lsxId)
    const [entries, stages, outsource] = await Promise.all([
      entriesRepo.listByLsx(lsxId),
      productionRepo.listStages(),
      outsourceRepo.listByLsx(lsxId),
    ])

    // Gộp sản lượng theo (chi tiết, công đoạn). NHẬN VỀ gia công có công đoạn
    // (0171) cộng vào "đã làm" như Excel gộp cột "Gia công" vào từng khâu —
    // theo dõi riêng phần GC để màn sổ tổng bày "trong đó gia công".
    const agg = new Map<string, Map<string, { done: number; defect: number }>>()
    const add = (compId: string, stage: string, qty: number, defect: number) => {
      const perStage = agg.get(compId) ?? new Map()
      const cur = perStage.get(stage) ?? { done: 0, defect: 0 }
      cur.done += qty
      cur.defect += defect
      perStage.set(stage, cur)
      agg.set(compId, perStage)
    }
    for (const en of entries) {
      add(en.component_id, en.stage, Number(en.qty), Number(en.defect_qty))
    }
    const gcByCompStage = new Map<string, number>()
    for (const oe of outsource) {
      if (oe.direction !== 'receive' || !oe.stage) continue
      add(oe.component_id, oe.stage, Number(oe.qty), Number(oe.defect_qty))
      const k = `${oe.component_id}|${oe.stage}`
      gcByCompStage.set(k, (gcByCompStage.get(k) ?? 0) + Number(oe.qty))
    }

    // KẾ HOẠCH ĐẾM per dòng SP (27/08 — lib/default-assembly): BOM phẳng thì
    // chi tiết dừng TRƯỚC hàn, từ hàn trở đi đếm bằng "cụm khung mặc nhiên"
    // theo BỘ. Lệnh có cụm thật (0088) → kế hoạch rỗng, mọi thứ như cũ.
    const planByLine = new Map<string, CountingPlan>()
    for (const l of orderLines) {
      planByLine.set(
        l.id,
        resolveCountingPlan(
          components.filter((c) => c.production_order_line_id === l.id),
          routeByLine.get(l.id),
        ),
      )
    }

    const views: ComponentOutputView[] = components.map((c) => {
      const perStage = agg.get(c.id) ?? new Map()
      const outputs = [...perStage.entries()].map(([stage, v]) => ({
        stage,
        done: v.done,
        defect: v.defect,
      }))
      // Lộ trình của chi tiết: kế hoạch SX thắng; chưa lên kế hoạch thì SUY
      // THEO NHÓM VẬT TƯ (0174 + stage-route).
      //
      // Trước đây chỗ này fallback về `stageOrder` = TOÀN BỘ 12 công đoạn, nên
      // mọi chi tiết hiện ở mọi tab — mở tab May vẫn thấy chân ghế sắt, mở tab
      // Phôi thấy cả 996 dòng gồm ốc vít. Đó là gốc của việc màn nhập cũ không
      // dùng nổi. Nhóm chưa biết → rỗng (không đoán), chi tiết đó không thuộc
      // công đoạn nào cho tới khi được phân nhóm hoặc lên kế hoạch.
      // Chi tiết bị gộp vào cụm mặc nhiên → lộ trình đã cắt (chỉ còn trước
      // hàn); còn lại giữ nguyên lộ trình đầy đủ.
      const route =
        planByLine.get(c.production_order_line_id)?.own_route.get(c.id) ??
        resolveComponentRoute(routeByLine.get(c.production_order_line_id), c.group_code)
      const summary = summarizeComponent(
        totalByComponent.get(c.id) ?? 0,
        route,
        outputs,
        c.final_stage,
        c.first_stage,
      )
      summary.stages = summary.stages.map((s) => {
        const gc = gcByCompStage.get(`${c.id}|${s.stage}`) ?? 0
        return gc > 0 ? { ...s, gc } : s
      })
      return {
        id: c.id,
        order_line_id: c.production_order_line_id,
        kind: c.kind,
        cluster: c.cluster,
        name: c.name,
        unit: c.unit,
        total_needed: totalByComponent.get(c.id) ?? 0,
        dm_kg: c.dm_kg,
        material_type: c.material_type,
        material_code: c.material_code,
        material_name: c.material_name,
        allowed_stages: route,
        summary,
      }
    })

    // CỤM MẶC NHIÊN per dòng SP: một dòng suy đếm theo BỘ cho các công đoạn từ
    // hàn trở đi. Sản lượng suy từ sổ CHI TIẾT (min chi tiết chậm nhất) — gồm
    // cả gia công nhận về vì `agg` đã cộng; nó không có sổ riêng để đọc.
    for (const l of orderLines) {
      const plan = planByLine.get(l.id)!
      if (plan.virtual_stages.length === 0) continue
      const absorbed = components
        .filter((c) => plan.own_route.has(c.id))
        .map((c) => ({
          total_needed: totalByComponent.get(c.id) ?? 0,
          outputs: [...(agg.get(c.id)?.entries() ?? [])].map(([stage, v]) => ({
            stage,
            done: v.done,
            defect: v.defect,
          })),
        }))
      views.push({
        id: defaultAssemblyId(l.id),
        order_line_id: l.id,
        kind: 'assembly',
        cluster: null,
        name: DEFAULT_ASSEMBLY_NAME,
        unit: 'bộ',
        total_needed: l.qty,
        dm_kg: null,
        material_type: null,
        material_code: null,
        material_name: null,
        allowed_stages: plan.virtual_stages,
        summary: summarizeComponent(
          l.qty,
          plan.virtual_stages,
          defaultAssemblyOutputs(plan.virtual_stages, l.qty, absorbed),
        ),
        is_virtual: true,
      })
    }

    // Đồng bộ per dòng SP: min theo bộ phận "đầu ra cuối" của floor(done_final /
    // đơn-vị-trên-SP). Chỉ tính component TOP-LEVEL (cụm + chi tiết KHÔNG bị gộp
    // vào cụm) — chi tiết đã hàn thành cụm thì cụm quyết định đồng bộ, không đếm
    // trùng (0088). Lệnh không có cụm → mọi chi tiết đều top-level = như cũ.
    const synced = orderLines.map((l) => {
      const plan = planByLine.get(l.id)!
      const lineComps = components.filter((c) => c.production_order_line_id === l.id)
      const assemblyClusters = new Set(
        lineComps.filter((c) => c.kind === 'assembly' && c.cluster).map((c) => c.cluster),
      )
      const comps = lineComps
        .filter(
          (c) =>
            c.kind === 'assembly' ||
            !(c.cluster != null && assemblyClusters.has(c.cluster)),
        )
        // Chi tiết bị gộp vào cụm mặc nhiên: đầu ra cuối của nó giờ là PHÔI —
        // đem vào đồng bộ là đếm phôi thành SP xong. Cụm mặc nhiên thay mặt.
        .filter((c) => !plan.own_route.has(c.id))
        .map((c) => ({
          qty_per_unit: c.qty_per_unit,
          done_final: views.find((v) => v.id === c.id)?.summary.done_final ?? 0,
        }))
      if (plan.virtual_stages.length > 0) {
        comps.push({
          qty_per_unit: 1,
          done_final:
            views.find((v) => v.id === defaultAssemblyId(l.id))?.summary.done_final ?? 0,
        })
      }
      return {
        order_line_id: l.id,
        /** Đơn chứa dòng — lệnh gộp nhiều đơn nên %HT tách được theo đơn (0113). */
        order_id: orderIdByGroup.get(l.group_id) ?? '',
        product_code: l.product_code,
        product_name: l.name_vi ?? l.product_code,
        qty: l.qty,
        synced_sets: comps.length ? syncedSets(comps) : 0,
        has_components: lineComps.length > 0,
      }
    })

    return {
      stages,
      components: views,
      synced_by_line: synced,
      entries,
      /** Sổ gia công ngoài (0171) — sổ tổng cần ngày để tách theo tháng. */
      outsource,
      jobs,
    }
  },

  /**
   * BẢNG NHẬP theo công đoạn (GĐ2 sổ thống kê — 24/08): hàng = chi tiết đi qua
   * công đoạn, nhóm LỆNH → SP, kèm số đã ghi trong NGÀY đang mở để thấy cột
   * hôm nay đã gõ gì. `lsxId` giới hạn về MỘT lệnh — màn nhập tách theo lệnh
   * (user chốt 25/08: đổ cả xưởng vào một bảng nhập là không dùng nổi).
   */
  async board(user: User, date: string, lsxId?: string): Promise<BoardPayload> {
    const active = await productionRepo.listActive()
    const shown = (lsxId ? active.filter((l) => l.id === lsxId) : active).slice(0, 20)
    const [summaries, transfersByLsx] = await Promise.all([
      Promise.all(shown.map((l) => entriesService.summary(user, l.id))),
      Promise.all(shown.map((l) => transfersRepo.listRawByLsx(l.id))),
    ])
    const stages = summaries[0]?.stages ?? (await productionRepo.listStages())
    const lsx: BoardLsx[] = shown.map((l, i) => {
      const s = summaries[i]
      // Đã ghi trong ngày per (chi tiết × công đoạn) — mọi tổ, để người nhập
      // thấy "hôm nay đã có số" và khỏi gõ đúp.
      const todayByCS = new Map<string, { qty: number; defect: number }>()
      for (const en of s.entries) {
        if (en.entry_date !== date) continue
        const k = `${en.component_id}|${en.stage}`
        const cur = todayByCS.get(k) ?? { qty: 0, defect: 0 }
        cur.qty += Number(en.qty)
        cur.defect += Number(en.defect_qty)
        todayByCS.set(k, cur)
      }
      return {
        id: l.id,
        code: l.code,
        customer_name: l.customer_name,
        ship_date: l.ship_date,
        products: s.synced_by_line
          .map((line) => ({
            order_line_id: line.order_line_id,
            product_code: line.product_code,
            product_name: line.product_name,
            qty: line.qty,
            components: s.components
              .filter((c) => c.order_line_id === line.order_line_id)
              .map((c) => {
                const today: BoardComponent['today'] = {}
                for (const st of c.summary.stages) {
                  const t = todayByCS.get(`${c.id}|${st.stage}`)
                  if (t) today[st.stage] = t
                }
                return {
                  id: c.id,
                  kind: c.kind,
                  cluster: c.cluster,
                  name: c.name,
                  unit: c.unit,
                  dm_kg: c.dm_kg,
                  total_needed: c.total_needed,
                  stages: Object.fromEntries(
                    c.summary.stages.map((st) => [
                      st.stage,
                      { done: st.done, missing: st.missing },
                    ]),
                  ),
                  today,
                } satisfies BoardComponent
              }),
          }))
          .filter((p) => p.components.length > 0),
      }
    })

    // Dòng gợi ý per tổ + lý do phế gần đây — "đề xuất trước, nhập sau".
    const suggested: BoardSuggestion[] = []
    const seenSug = new Set<string>()
    const reasonSeen = new Set<string>()
    const reasons: { reason: string; at: string }[] = []
    const from7 = shiftIso(date, -7)
    const from30 = shiftIso(date, -30)
    shown.forEach((l, i) => {
      const s = summaries[i]
      const push = (
        teamId: string,
        compId: string,
        stage: string,
        source: BoardSuggestion['source'],
      ) => {
        const key = `${l.id}|${stage}|${compId}|${teamId}`
        if (seenSug.has(key)) return
        seenSug.add(key)
        suggested.push({
          team_id: teamId,
          lsx_id: l.id,
          component_id: compId,
          stage,
          source,
        })
      }
      // Giao tổ còn treo: giao − trả − đã dùng (phế cũng ăn đầu vào) > 0.
      const usedByTriple = new Map<string, number>()
      for (const en of s.entries) {
        if (!en.team_department_id) continue
        const k = `${en.component_id}|${en.stage}|${en.team_department_id}`
        usedByTriple.set(
          k,
          (usedByTriple.get(k) ?? 0) + Number(en.qty) + Number(en.defect_qty),
        )
      }
      const issuedNet = new Map<string, number>()
      for (const t of transfersByLsx[i]) {
        const k = `${t.component_id}|${t.stage}|${t.team_department_id}`
        issuedNet.set(
          k,
          (issuedNet.get(k) ?? 0) +
            (t.direction === 'issue' ? Number(t.qty) : -Number(t.qty)),
        )
      }
      for (const [k, net] of issuedNet) {
        const [compId, stage, teamId] = k.split('|')
        if (net - (usedByTriple.get(k) ?? 0) > 0) push(teamId, compId, stage, 'transfer')
      }
      // Tổ đã ghi (chi tiết × công đoạn) trong 7 ngày — mai thường làm tiếp.
      for (const en of s.entries) {
        if (!en.team_department_id) continue
        if (en.entry_date < from7 || en.entry_date > date) continue
        push(en.team_department_id, en.component_id, en.stage, 'recent')
      }
      for (const en of s.entries) {
        if (!en.defect_reason || en.entry_date < from30) continue
        const r = en.defect_reason.trim()
        if (!r || reasonSeen.has(r.toLowerCase())) continue
        reasonSeen.add(r.toLowerCase())
        reasons.push({ reason: r, at: en.created_at })
      }
    })
    reasons.sort((a, b) => b.at.localeCompare(a.at))

    return {
      stages,
      lsx,
      suggested,
      recent_defect_reasons: reasons.slice(0, 15).map((r) => r.reason),
    }
  },

  /**
   * Sổ toàn xưởng 1 ngày + PHIẾU của ngày + trạng thái chốt — đọc: mọi NV.
   * Kèm `unlocked_past`: 7 ngày gần nhất (trước hôm nay) tổ CÓ sổ mà QUÊN chốt
   * — quên chốt là sổ mở vô hạn, mất ý nghĩa khoá số liệu.
   */
  async listDay(_user: User, date: string) {
    const today = vnTodayIso()
    const [entries, locks, docs, pastPairs, pastLocks] = await Promise.all([
      entriesRepo.listByDate(date),
      dayLocksRepo.listByDate(date),
      entryDocsRepo.listByDate(date),
      entriesRepo.listDayTeamPairs(shiftIso(today, -7), shiftIso(today, -1)),
      dayLocksRepo.listRange(shiftIso(today, -7), shiftIso(today, -1)),
    ])
    const lockedPast = new Set(
      pastLocks.map((l) => `${l.entry_date}|${l.team_department_id}`),
    )
    const unlocked_past = pastPairs
      .filter((p) => !lockedPast.has(`${p.entry_date}|${p.team_department_id}`))
      .sort((a, b) => a.entry_date.localeCompare(b.entry_date))
    return { entries, locks, docs, unlocked_past }
  },

  /**
   * Xoá NGUYÊN PHIẾU báo sản lượng (0172) — dòng + header. Cùng luật với xoá
   * dòng lẻ: người lập hoặc GĐ/QL; tổ đã chốt ngày đó thì mở khoá trước;
   * lệnh kết thúc thì sổ khoá.
   */
  async deleteDoc(user: User, docId: string): Promise<void> {
    const doc = await entryDocsRepo.findById(docId)
    if (!doc) throw NotFound('Phiếu báo sản lượng không tồn tại')
    const allowed =
      user.role === 'admin' || user.role === 'manager' || doc.created_by === user.id
    if (!allowed) throw Forbidden('Chỉ người lập phiếu hoặc Ban quản lý xoá được phiếu')
    if (doc.team_department_id) {
      const lock = await dayLocksRepo.find(doc.team_department_id, doc.entry_date)
      if (lock) {
        throw BadRequest('Sổ ngày của tổ đã chốt — mở khoá trước khi xoá phiếu')
      }
    }
    const lsx = await productionRepo.findById(doc.production_order_id)
    if (lsx && (lsx.status === 'completed' || lsx.status === 'cancelled')) {
      throw BadRequest('LSX đã kết thúc — sổ khoá')
    }
    await entriesRepo.deleteByDoc(docId)
    await entryDocsRepo.delete(docId)
  },

  /** Xoá bản ghi nhập nhầm: người tạo hoặc GĐ/QL; lệnh đã kết thúc thì khoá. */
  async deleteEntry(user: User, entryId: string): Promise<void> {
    const entry = await entriesRepo.findById(entryId)
    if (!entry) throw NotFound('Bản ghi sổ không tồn tại')
    const allowed =
      user.role === 'admin' || user.role === 'manager' || entry.created_by === user.id
    if (!allowed) throw Forbidden('Chỉ người nhập hoặc Ban quản lý xoá được bản ghi')
    // Ngày đã chốt thì cấm xoá KỂ CẢ admin — mở khoá trước (giữ vết ai mở).
    if (entry.team_department_id) {
      const lock = await dayLocksRepo.find(entry.team_department_id, entry.entry_date)
      if (lock) {
        throw BadRequest('Sổ ngày của tổ đã chốt — mở khoá trước khi xoá bản ghi')
      }
    }
    const lsx = await productionRepo.findById(entry.production_order_id)
    if (lsx && (lsx.status === 'completed' || lsx.status === 'cancelled')) {
      throw BadRequest('LSX đã kết thúc — sổ khoá')
    }
    await entriesRepo.delete(entryId)
  },

  /**
   * Chốt sổ cuối ngày theo tổ. NV xưởng bị ép tổ mình; GĐ/QL chốt hộ tổ
   * chỉ định. Đã chốt rồi → Conflict.
   */
  async lockDay(
    user: User,
    input: { entry_date: string; team_department_id?: string | null },
  ): Promise<void> {
    await assertAction(user, 'production.daylock.lock')
    let team = input.team_department_id ?? user.department_id ?? null
    if (user.role === 'employee') team = user.department_id ?? null
    if (!team) throw BadRequest('Chưa xác định được tổ để chốt sổ')
    const { duplicate } = await dayLocksRepo.insert({
      team_department_id: team,
      entry_date: input.entry_date,
      locked_by: user.id,
    })
    if (duplicate) throw Conflict('Tổ đã chốt sổ ngày này', 'DAY_LOCKED')
  },

  /** Mở lại sổ ngày (GĐ/QL) — để sửa nhầm lẫn có kiểm soát. */
  async unlockDay(user: User, teamId: string, date: string): Promise<void> {
    await assertAction(user, 'production.daylock.unlock')
    await dayLocksRepo.deleteByTeamDate(teamId, date)
  },
}

export type { ProductionEntry, Job }
