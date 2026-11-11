import type { OverviewRow, PlanStage } from '@/modules/dept/production/jobs.service'
import type { ShapingRow } from '@/lib/shaping-status'
import { maGon, mocHan } from '@/lib/vao-viec-sx'
import { shortStageLabel } from '@/lib/stage-config'

/**
 * DANH SÁCH GIAO TỔ & HẠN (khuôn C, bản vẽ 1 11/11/2026 duyệt,
 * https://claude.ai/artifact/CAmsvjowophhfMkNmANiu9) — phần THUẦN: hình dữ
 * liệu một hàng, bốn trạng thái loại trừ nhau, chip đếm bằng ĐÚNG hàm lọc, ô
 * "Tổ & hạn" theo công đoạn, câu "việc kế tiếp" + nút theo trạng thái. Không
 * `'use client'` để server (trang) và test dùng chung — cùng lý do `views.ts`
 * của Lệnh sản xuất.
 *
 * Trả lời: "lệnh nào tôi giao được ngay, lệnh nào đang chờ người khác?".
 * Nguồn số: `jobsService.overview` (cùng Lệnh SX / Vào việc) +
 * `componentsService.shapingOverview` (cùng Lộ trình công đoạn).
 */

export const fmt = (n: number) => n.toLocaleString('vi-VN')
export const cx = (...xs: (string | false | null | undefined | 0)[]) =>
  xs.filter(Boolean).join(' ')

export type DsRow = {
  id: string
  code: string
  customer_name: string
  order_codes: string[]
  ship_date: string | null
  late: 'overdue' | 'at_risk' | null
  /** Dòng SP của lệnh / dòng đã có bảng chi tiết. */
  line_count: number
  lines_shaped: number
  /** Dòng SP không lấy được bảng từ Kỹ thuật (chưa gắn SP / hồ sơ chưa định mức). */
  lines_missing_bom: number
  cluster_unrouted: number
  component_count: number
  /** Bộ đặt của dòng đã định hình — dòng chưa định hình không vào (không biết gì để đếm). */
  sets_needed: number
  jobs_total: number
  jobs_no_end: number
  jobs_no_team: number
  plan_overdue: number
  /** Công đoạn lệnh ĐI QUA (từ bảng chi tiết), thứ tự danh mục. */
  stages: string[]
  plan_stages: PlanStage[]
}

/** Ghép một hàng từ hai nguồn; thiếu nguồn định hình thì coi như chưa biết dòng. */
export function toDsRow(r: OverviewRow, s: ShapingRow | undefined): DsRow {
  return {
    id: r.lsx.id,
    code: r.lsx.code,
    customer_name: r.lsx.customer_name,
    order_codes: r.lsx.order_codes,
    ship_date: r.lsx.ship_date,
    late: r.lsx.late,
    line_count: s?.line_count ?? 0,
    lines_shaped: s ? s.line_count - s.lines_without_rows : 0,
    lines_missing_bom: s?.lines_missing_bom ?? 0,
    cluster_unrouted: s?.cluster_unrouted ?? 0,
    component_count: r.component_count,
    sets_needed: r.sets_needed,
    jobs_total: r.jobs_total,
    jobs_no_end: r.jobs_no_end,
    jobs_no_team: r.jobs_no_team,
    plan_overdue: r.plan_overdue,
    stages: r.chips.filter((c) => c.total > 0).map((c) => c.stage),
    plan_stages: r.plan_stages,
  }
}

/**
 * Bốn trạng thái LOẠI TRỪ NHAU — cộng bốn chip = "Tất cả" (17 = 8 + 1 + 8 + 0
 * lúc vẽ). Chưa có bảng chi tiết là việc của Kỹ thuật, không phải của màn này;
 * có bảng mà chưa việc nào = giao được ngay; có việc mà còn thiếu tổ hay hạn =
 * dở; còn lại = đủ.
 */
export type TrangThai = 'cho_kt' | 'chua_giao' | 'do' | 'du'

export function trangThai(
  r: Pick<DsRow, 'component_count' | 'jobs_total' | 'jobs_no_end' | 'jobs_no_team'>,
): TrangThai {
  if (r.component_count === 0) return 'cho_kt'
  if (r.jobs_total === 0) return 'chua_giao'
  if (r.jobs_no_end > 0 || r.jobs_no_team > 0) return 'do'
  return 'du'
}

export type Chip = {
  id: string
  label: string
  /** Chữ phụ nhỏ cạnh số — chỉ khi tên chip chưa đủ nghĩa. */
  note?: string
  test: (r: DsRow) => boolean
}

/** Thứ tự cố ý: việc CẤP trước; "Đủ" đứng gần cuối vì là tin mừng, không phải việc. */
export const CHIPS: Chip[] = [
  {
    id: 'chua_giao',
    label: 'Chưa giao tổ',
    note: 'có bảng, giao được ngay',
    test: (r) => trangThai(r) === 'chua_giao',
  },
  { id: 'do', label: 'Dở — thiếu hạn / tổ', test: (r) => trangThai(r) === 'do' },
  { id: 'tre', label: 'Trễ hạn tổ', test: (r) => r.plan_overdue > 0 },
  {
    id: 'cho_kt',
    label: 'Chờ Kỹ thuật',
    note: 'chưa có bảng chi tiết',
    test: (r) => trangThai(r) === 'cho_kt',
  },
  { id: 'du', label: 'Đủ tổ & hạn', test: (r) => trangThai(r) === 'du' },
  { id: 'all', label: 'Tất cả', test: () => true },
]

export const CHIP_IDS: string[] = CHIPS.map((c) => c.id)

/** Chip từ query, rơi về "Chưa giao tổ" nếu id lạ. */
export function resolveChip(raw: string | undefined): string {
  return raw && CHIP_IDS.includes(raw) ? raw : 'chua_giao'
}

/** Trễ hạn xuất xếp trước, rồi hạn gần nhất; chưa có hạn xuống cuối. */
export function sapXep<T extends { ship_date: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) =>
    (a.ship_date ?? '9999').localeCompare(b.ship_date ?? '9999'),
  )
}

/** Ô tìm soi mã lệnh, tên khách, số đơn. */
export function khop(r: DsRow, kw: string): boolean {
  const k = kw.trim().toLowerCase()
  if (!k) return true
  return `${r.code} ${r.customer_name} ${r.order_codes.join(' ')}`
    .toLowerCase()
    .includes(k)
}

/**
 * Một ô của dải "Tổ & hạn": `na` = lệnh không đi qua (sọc) · `empty` = đi qua,
 * chưa giao · `half` = có việc nhưng còn thiếu tổ hoặc hạn · `ok` = đủ cả.
 */
export type OToHan = 'na' | 'empty' | 'half' | 'ok'

export function oToHan(r: Pick<DsRow, 'stages' | 'plan_stages'>, stage: string): OToHan {
  const p = r.plan_stages.find((x) => x.stage === stage)
  if (!p) return r.stages.includes(stage) ? 'empty' : 'na'
  return p.no_team > 0 || p.no_end > 0 ? 'half' : 'ok'
}

/** Cột của dải = HỢP công đoạn mọi lệnh đang bày đi qua (hoặc đã có việc), thứ tự danh mục. */
export function cotDai(rows: DsRow[], stages: { code: string }[]): string[] {
  const seen = new Set<string>()
  for (const r of rows) {
    for (const s of r.stages) seen.add(s)
    for (const p of r.plan_stages) seen.add(p.stage)
  }
  return stages.map((s) => s.code).filter((c) => seen.has(c))
}

/** Chữ cái đầu của tên ngắn công đoạn — nhãn trong ô 14px. */
export function chuO(label: string): string {
  return shortStageLabel(label).charAt(0).toUpperCase()
}

export type Viec = {
  tone: 'stop' | 'warn' | 'none' | 'done'
  text: string
  /** Liên kết chen trong câu (khai lộ trình, nạp từ BOM). */
  link?: { label: string; href: string }
  /** Nút cuối hàng — đổi theo trạng thái (Q6). */
  nut: { label: string; href: string }
}

/**
 * MỘT câu + MỘT nút cho mỗi hàng. Thứ tự ưu tiên trong một trạng thái: thứ
 * chặn người đứng ở màn này trước (dòng chờ Kỹ thuật, cụm chưa khai), rồi tới
 * việc họ làm được ngay.
 */
export function viecKeTiep(
  r: DsRow,
  today: string,
  labelOf: (code: string) => string,
): Viec {
  const tt = trangThai(r)
  // Hạn xuất đã có cột riêng — câu không nhắc lại số ngày; chỉ đổi màu khi đã trễ.

  if (tt === 'cho_kt') {
    if (r.lines_missing_bom > 0) {
      return {
        tone: r.late === 'overdue' ? 'stop' : 'warn',
        text: `Chờ Kỹ thuật nạp định mức ${fmt(r.lines_missing_bom)} SP`,
        nut: { label: 'Nhắc KT ›', href: '/phan-cong-viec?muc=giao' },
      }
    }
    return {
      tone: 'warn',
      text: 'Bảng chi tiết chưa nạp dù SP đã có định mức',
      link: { label: 'nạp từ BOM ›', href: `/thongke/lsx/${r.id}/dinh-hinh` },
      nut: { label: 'Bảng chi tiết ›', href: `/thongke/lsx/${r.id}/dinh-hinh` },
    }
  }

  const giaoTo = { label: 'Giao tổ ›', href: `/kehoach-sx/${r.id}` }
  if (tt === 'chua_giao') {
    const choKT = r.line_count - r.lines_shaped
    if (r.cluster_unrouted > 0) {
      return {
        tone: r.late === 'overdue' ? 'stop' : 'warn',
        text: `${fmt(r.cluster_unrouted)} cụm chưa khai lộ trình`,
        link: { label: 'khai lộ trình ›', href: `/thongke/lo-trinh?lsx=${r.id}` },
        nut: giaoTo,
      }
    }
    if (choKT > 0) {
      return {
        tone: r.late === 'overdue' ? 'stop' : 'warn',
        text: `Giao được ${fmt(r.lines_shaped)} dòng; ${fmt(choKT)} dòng chờ Kỹ thuật`,
        nut: giaoTo,
      }
    }
    if (r.late === 'overdue') {
      const dau = r.stages[0] ? labelOf(r.stages[0]) : null
      return {
        tone: 'stop',
        text: `Trễ hạn xuất — giao ${fmt(r.stages.length)} công đoạn${dau ? ` từ ${dau}` : ''}`,
        nut: giaoTo,
      }
    }
    return { tone: 'none', text: `Giao ${fmt(r.stages.length)} công đoạn`, nut: giaoTo }
  }

  if (tt === 'do') {
    const parts: string[] = []
    if (r.jobs_no_end > 0) parts.push(`${fmt(r.jobs_no_end)} việc chưa có hạn`)
    for (const p of r.plan_stages) {
      if (p.no_team > 0) parts.push(`${fmt(p.no_team)} việc ${labelOf(p.stage)} chưa tổ`)
    }
    const choKT = r.line_count - r.lines_shaped
    if (choKT > 0) parts.push(`${fmt(choKT)} dòng chờ Kỹ thuật`)
    return {
      tone: 'warn',
      text: parts.join(' · '),
      nut: {
        label: r.jobs_no_end > 0 ? 'Đặt hạn ›' : 'Chọn tổ ›',
        href: `/kehoach-sx/${r.id}`,
      },
    }
  }

  if (r.plan_overdue > 0) {
    return {
      tone: 'warn',
      text: `${fmt(r.plan_overdue)} việc quá hạn kế hoạch`,
      nut: { label: 'Mở ›', href: `/kehoach-sx/${r.id}` },
    }
  }
  return {
    tone: 'done',
    text: `Đủ tổ & hạn · ${fmt(r.jobs_total)} việc`,
    nut: { label: 'Mở ›', href: `/kehoach-sx/${r.id}` },
  }
}

/** Lệnh nên bắt tay đầu tiên khi chip đang chọn rỗng: trễ hạn xuất nhất trong "Chưa giao tổ". */
export function lenhBatDau(rows: DsRow[]): DsRow | null {
  return sapXep(rows.filter((r) => trangThai(r) === 'chua_giao'))[0] ?? null
}

export { maGon, mocHan }
