import { entriesRepo } from './entries.repo'
import { componentsRepo } from './components.repo'
import { productionRepo } from './production.repo'
import { bomSnapshotRepo } from './bom-snapshot.repo'
import { departmentsRepo } from '@/modules/core/departments/departments.repo'
import { calcComponent } from '@/lib/component-needs'
import type { User } from '@/modules/core/users/users.repo'
import { BadRequest, NotFound } from '@/server/http'

/**
 * TẦNG DỮ LIỆU BÁO CÁO sản xuất (GĐ4 plan-sx) — kỳ TỰ DO [from..to], tháng
 * chỉ là trường hợp riêng. Trang `/thongke/bao-cao` (SSR) và route
 * `/api/dept/production/reports` (JSON + Excel) cùng gọi vào đây — một nguồn
 * số cho màn hình, bản in và file tải về.
 * Đọc: mọi NV đã đăng nhập (cùng tư thế các màn thống kê hiện có).
 */

const r2 = (n: number) => Math.round(n * 100) / 100
const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000)

/** Trần kỳ báo cáo — ma trận 1 cột/ngày, quá dài là bảng không đọc nổi. */
export const REPORT_MAX_DAYS = 92

function assertRange(from: string, to: string): number {
  const days = dayDiff(from, to) + 1
  if (days <= 0) throw BadRequest('Khoảng ngày không hợp lệ (from phải ≤ to)')
  if (days > REPORT_MAX_DAYS) {
    throw BadRequest(`Kỳ báo cáo tối đa ${REPORT_MAX_DAYS} ngày`)
  }
  return days
}

/** Chuẩn hoá text gõ tay để GỘP nhóm (lý do phế, tên người làm): trim + gộp
 *  khoảng trắng + so không phân biệt hoa thường. Hiển thị giữ bản gốc đầu tiên. */
function normKey(s: string): string {
  return s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('vi')
}

// ── Sản lượng (ma trận ngày) ────────────────────────────────────────────────

export type SanLuongRow = {
  lsx: string
  comp: string
  cluster: string | null
  kind: string
  stage: string
  /** SL đạt từng ngày trong kỳ — index 0 = `from`. */
  by_day: number[]
  total: number
  kg: number
  workers: string[]
  total_needed: number
  /** Lũy kế MỌI kỳ (Thiếu/Dư so tổng cần phải lũy kế, không chỉ kỳ đang xem). */
  done_all: number
}

export type SanLuongReport = {
  from: string
  to: string
  days: number
  rows: SanLuongRow[]
  total_qty: number
  total_kg: number
}

// ── Phế ────────────────────────────────────────────────────────────────────

export type PheReport = {
  from: string
  to: string
  total_defect: number
  by_reason: { reason: string; qty: number }[]
  by_team: { team_name: string; qty: number }[]
  by_stage: { stage_label: string; qty: number }[]
  /** Dòng chi tiết (tổ × công đoạn × lý do) — bảng đầy đủ / xuất Excel. */
  rows: { team_name: string; stage_label: string; reason: string; qty: number }[]
}

// ── Năng suất theo người ───────────────────────────────────────────────────

export type NangSuatRow = {
  /** Tên gõ tay đã gộp trim/hoa-thường — kèm chú thích "tên gõ tay" ở UI. */
  worker: string
  qty: number
  defect: number
  kg: number
  /** Số ngày có ghi sổ trong kỳ. */
  days: number
  teams: string[]
  stages: string[]
}

// ── Định mức vs thực dùng ──────────────────────────────────────────────────

export type DinhMucRow = {
  material_code: string
  material_name: string | null
  unit: string | null
  /** Cần theo định mức ĐÃ CHỐT × SL dòng lệnh. */
  qty_needed: number
  /** Sổ KHO: đã xuất cho lệnh. */
  qty_issued: number
  /** Sổ THỐNG KÊ: Σ kg backflush của các chi tiết mang vật tư này. CỐ Ý để
   *  CẠNH qty_issued chứ không trộn — hai sổ đo hai điều khác nhau. */
  kg_logged: number | null
}

export type DinhMucReport = {
  lsx: { id: string; code: string; customer_name: string }
  /** null = lệnh CHƯA chốt định mức → cột "cần" không có nghĩa. */
  snapped_at: string | null
  rows: DinhMucRow[]
}

export const reportsService = {
  /** Ma trận sản lượng ngày × (lệnh × chi tiết × công đoạn) — kỳ tự do.
   *  Cùng công thức với báo cáo tháng cũ (0090), chỉ tổng quát hoá cột ngày. */
  async sanLuong(
    _user: User,
    opts: { from: string; to: string; team?: string; stage?: string },
  ): Promise<SanLuongReport> {
    const days = assertRange(opts.from, opts.to)
    const allEntries = await entriesRepo.listRange(opts.from, opts.to)
    const entries = allEntries.filter(
      (e) =>
        (!opts.team || e.team_department_id === opts.team) &&
        (!opts.stage || e.stage === opts.stage),
    )
    const lsxIds = [...new Set(entries.map((e) => e.production_order_id))]
    const [comps, allTime, codes] = await Promise.all([
      componentsRepo.listByLsxBulk(lsxIds),
      entriesRepo.listByLsxBulk(lsxIds),
      productionRepo.listCodesByIds(lsxIds),
    ])
    const compById = new Map(comps.map((c) => [c.id, c]))
    const doneAll = new Map<string, number>()
    for (const e of allTime) {
      const k = `${e.component_id}|${e.stage}`
      doneAll.set(k, (doneAll.get(k) ?? 0) + Number(e.qty))
    }

    type Acc = SanLuongRow & { sort: number; worker_set: Set<string> }
    const rows = new Map<string, Acc>()
    for (const e of entries) {
      const c = compById.get(e.component_id)
      const k = `${e.production_order_id}|${e.component_id}|${e.stage}`
      let row = rows.get(k)
      if (!row) {
        row = {
          lsx: codes.get(e.production_order_id) ?? '?',
          comp: c?.name ?? '?',
          cluster: c?.cluster ?? null,
          kind: c?.kind ?? 'part',
          stage: e.stage,
          sort: c?.sort_order ?? 9999,
          by_day: Array.from({ length: days }, () => 0),
          total: 0,
          kg: 0,
          workers: [],
          worker_set: new Set<string>(),
          total_needed: c
            ? calcComponent(
                {
                  qty_per_unit: c.qty_per_unit,
                  dm_kg: c.dm_kg,
                  pcs_per_bar: c.pcs_per_bar,
                },
                c.line_qty,
              ).total_needed
            : 0,
          done_all: doneAll.get(`${e.component_id}|${e.stage}`) ?? 0,
        }
        rows.set(k, row)
      }
      const day = dayDiff(opts.from, e.entry_date)
      if (day >= 0 && day < days) row.by_day[day] += Number(e.qty)
      row.total += Number(e.qty)
      row.kg += e.kg == null ? 0 : Number(e.kg)
      if (e.worker_name) row.worker_set.add(e.worker_name)
    }
    const sorted: SanLuongRow[] = [...rows.values()]
      .sort((a, b) => a.lsx.localeCompare(b.lsx) || a.sort - b.sort)
      .map((row) => ({
        lsx: row.lsx,
        comp: row.comp,
        cluster: row.cluster,
        kind: row.kind,
        stage: row.stage,
        by_day: row.by_day,
        total: row.total,
        kg: r2(row.kg),
        workers: [...row.worker_set],
        total_needed: row.total_needed,
        done_all: row.done_all,
      }))
    return {
      from: opts.from,
      to: opts.to,
      days,
      rows: sorted,
      total_qty: sorted.reduce((a, r) => a + r.total, 0),
      total_kg: r2(sorted.reduce((a, r) => a + r.kg, 0)),
    }
  },

  /** Phế theo tổ / công đoạn / lý do — từ defect_qty + defect_reason đã thu,
   *  KHÔNG thêm form phân loại (QC không lên hệ thống). */
  async phe(
    _user: User,
    opts: { from: string; to: string; team?: string; stage?: string },
  ): Promise<PheReport> {
    assertRange(opts.from, opts.to)
    const [allEntries, stages, depts] = await Promise.all([
      entriesRepo.listRange(opts.from, opts.to),
      productionRepo.listStages(),
      departmentsRepo.list(),
    ])
    const teamName = (id: string | null) =>
      (id && depts.find((d) => d.id === id)?.name) || '(không rõ tổ)'
    const stageLabel = (c: string) => stages.find((s) => s.code === c)?.label ?? c

    const entries = allEntries.filter(
      (e) =>
        e.defect_qty > 0 &&
        (!opts.team || e.team_department_id === opts.team) &&
        (!opts.stage || e.stage === opts.stage),
    )
    const detail = new Map<string, PheReport['rows'][number]>()
    const reasonDisplay = new Map<string, string>()
    for (const e of entries) {
      const raw = (e.defect_reason ?? '').trim()
      const rKey = raw ? normKey(raw) : ''
      if (!reasonDisplay.has(rKey)) {
        reasonDisplay.set(rKey, raw || '(không ghi lý do)')
      }
      const k = `${e.team_department_id ?? ''}|${e.stage}|${rKey}`
      const row = detail.get(k) ?? {
        team_name: teamName(e.team_department_id),
        stage_label: stageLabel(e.stage),
        reason: reasonDisplay.get(rKey)!,
        qty: 0,
      }
      row.qty += e.defect_qty
      detail.set(k, row)
    }
    const rows = [...detail.values()].sort((a, b) => b.qty - a.qty)
    const roll = (key: (r: PheReport['rows'][number]) => string) => {
      const m = new Map<string, number>()
      for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + r.qty)
      return [...m.entries()].sort((a, b) => b[1] - a[1])
    }
    return {
      from: opts.from,
      to: opts.to,
      total_defect: rows.reduce((a, r) => a + r.qty, 0),
      by_reason: roll((r) => r.reason).map(([reason, qty]) => ({ reason, qty })),
      by_team: roll((r) => r.team_name).map(([team_name, qty]) => ({ team_name, qty })),
      by_stage: roll((r) => r.stage_label).map(([stage_label, qty]) => ({
        stage_label,
        qty,
      })),
      rows,
    }
  },

  /** Năng suất theo NGƯỜI — gom `worker_name` gõ tay (trim/hoa-thường).
   *  FK danh mục công nhân dời đến bài lương sản phẩm (ghi chú 0090). */
  async nangSuat(
    _user: User,
    opts: { from: string; to: string; team?: string },
  ): Promise<{ from: string; to: string; rows: NangSuatRow[] }> {
    assertRange(opts.from, opts.to)
    const [allEntries, stages, depts] = await Promise.all([
      entriesRepo.listRange(opts.from, opts.to),
      productionRepo.listStages(),
      departmentsRepo.list(),
    ])
    const stageLabel = (c: string) => stages.find((s) => s.code === c)?.label ?? c
    const entries = allEntries.filter(
      (e) => !opts.team || e.team_department_id === opts.team,
    )
    type Acc = NangSuatRow & {
      day_set: Set<string>
      team_set: Set<string>
      stage_set: Set<string>
    }
    const byWorker = new Map<string, Acc>()
    for (const e of entries) {
      const raw = (e.worker_name ?? '').trim()
      const key = raw ? normKey(raw) : ''
      const row = byWorker.get(key) ?? {
        worker: raw || '(không ghi tên)',
        qty: 0,
        defect: 0,
        kg: 0,
        days: 0,
        teams: [],
        stages: [],
        day_set: new Set<string>(),
        team_set: new Set<string>(),
        stage_set: new Set<string>(),
      }
      row.qty += e.qty
      row.defect += e.defect_qty
      row.kg += e.kg == null ? 0 : Number(e.kg)
      row.day_set.add(e.entry_date)
      if (e.team_department_id) {
        row.team_set.add(
          depts.find((d) => d.id === e.team_department_id)?.name ?? '(không rõ tổ)',
        )
      }
      row.stage_set.add(stageLabel(e.stage))
      byWorker.set(key, row)
    }
    const rows = [...byWorker.values()]
      .map(({ day_set, team_set, stage_set, ...r }) => ({
        ...r,
        kg: r2(r.kg),
        days: day_set.size,
        teams: [...team_set],
        stages: [...stage_set],
      }))
      .sort((a, b) => b.qty - a.qty)
    return { from: opts.from, to: opts.to, rows }
  },

  /** Định mức (đã chốt) vs thực dùng per LSX — hai cột "thực" CỐ Ý tách:
   *  sổ kho (đã xuất) và sổ thống kê (kg backflush) đo hai điều khác nhau. */
  async dinhMuc(_user: User, lsxId: string): Promise<DinhMucReport> {
    const lsx = await productionRepo.findById(lsxId)
    if (!lsx) throw NotFound('LSX không tồn tại')
    const [status, snapshot, comps, entries] = await Promise.all([
      productionRepo.materialStatusByLsx(lsxId),
      bomSnapshotRepo.listByOrder(lsxId),
      componentsRepo.listByLsx(lsxId),
      entriesRepo.listByLsx(lsxId),
    ])
    // Σ kg sổ thống kê theo VẬT TƯ: chi tiết → material_id → cộng kg các lần ghi.
    const materialByComp = new Map(comps.map((c) => [c.id, c.material_id]))
    const kgByMaterial = new Map<string, number>()
    for (const e of entries) {
      if (e.kg == null) continue
      const mid = materialByComp.get(e.component_id)
      if (!mid) continue
      kgByMaterial.set(mid, (kgByMaterial.get(mid) ?? 0) + Number(e.kg))
    }
    return {
      lsx: { id: lsx.id, code: lsx.code, customer_name: lsx.customer_name },
      snapped_at: snapshot.length
        ? snapshot.reduce(
            (a, r) => (r.snapped_at > a ? r.snapped_at : a),
            snapshot[0].snapped_at,
          )
        : null,
      rows: status.map((r) => ({
        material_code: r.material_code,
        material_name: r.material_name,
        unit: r.unit,
        qty_needed: r.qty_needed,
        qty_issued: r.qty_issued,
        kg_logged:
          r.material_id && kgByMaterial.has(r.material_id)
            ? r2(kgByMaterial.get(r.material_id)!)
            : null,
      })),
    }
  },
}
