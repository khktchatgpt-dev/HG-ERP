import type { OverviewRow } from '@/modules/dept/production/jobs.service'

/**
 * LỆNH SẢN XUẤT (khuôn C, bản vẽ 1 06/11/2026 duyệt,
 * https://claude.ai/artifact/1p2dxqkXRUpg5cZU4AaSjy) — phần THUẦN của màn:
 * câu "vướng gì → gỡ ở đâu", số ngày tới hạn, dải công đoạn. Không `'use
 * client'` để server và test dùng chung (cùng lý do `views.ts`).
 */

export const fmt = (n: number) => n.toLocaleString('vi-VN')
export const dmy = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')
export const cx = (...xs: (string | false | null | undefined | 0)[]) =>
  xs.filter(Boolean).join(' ')

/** Số ngày từ `today` tới `iso` (âm = đã qua). Cả hai là yyyy-mm-dd — không
 *  đọc đồng hồ máy khách, để server và client ra cùng một số (không lệch
 *  hydration, không lệch múi giờ). */
export function daysBetween(today: string, iso: string): number {
  return Math.round(
    (Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  )
}

/** Chữ cạnh hạn xuất: "trễ 27đ" · "HÔM NAY" · "còn 23đ". */
export function dueText(d: number): { text: string; tone: 'stop' | 'warn' | null } {
  if (d < 0) return { text: `trễ ${fmt(-d)}đ`, tone: 'stop' }
  if (d === 0) return { text: 'HÔM NAY', tone: 'warn' }
  return { text: `còn ${fmt(d)}đ`, tone: d <= 7 ? 'warn' : null }
}

/** Màn gỡ của một câu vướng — màn ánh xạ sang href. */
/** `vat-tu` trỏ Hồ sơ lệnh: khu Sản xuất chưa có màn vật tư theo lệnh — màn của
 *  Cung ứng (/mua-hang/yeu-cau/[id]) cần quyền xem chéo, người xưởng không chắc vào được. */
export type SnagGo = 'vat-tu' | 'lo-trinh' | 'giao-to' | 'ghi-so' | 'mo'

export type Snag = {
  text: string
  tone: 'stop' | 'warn' | 'done'
  go: SnagGo
  goLabel: string
}

/**
 * MỘT câu, thứ CẤP nhất (Q1 bản vẽ: kèm đường gỡ ngay trên dòng). Cùng thứ tự
 * với `snag()` của màn kit cũ: vật tư quá hẹn → thiếu vật tư → chưa có bảng
 * chi tiết → chưa giao tổ & hạn → việc quá hạn kế hoạch → không vướng.
 * Lệnh vừa thiếu vật tư vừa chưa định hình chỉ nói thiếu vật tư; chip "Chưa
 * định hình" vẫn đếm nó (hai câu khác nhau, một vị từ mỗi câu).
 */
export function snagOf(r: OverviewRow, canRecord: boolean): Snag {
  const m = r.materials
  if (m && m.due_overdue_days != null && m.due_overdue_days > 0) {
    return {
      text: `vật tư quá hẹn ${fmt(m.due_overdue_days)} ngày${m.missing_count > 0 ? ` · thiếu ${fmt(m.missing_count)} mã` : ''}`,
      tone: 'stop',
      go: 'vat-tu',
      goLabel: 'Hồ sơ lệnh',
    }
  }
  if (m && m.missing_count > 0) {
    return {
      text: `thiếu ${fmt(m.missing_count)} mã vật tư`,
      tone: 'warn',
      go: 'vat-tu',
      goLabel: 'Hồ sơ lệnh',
    }
  }
  if (r.component_count === 0) {
    return {
      text: 'chưa có bảng chi tiết (chờ Kỹ thuật)',
      tone: 'warn',
      go: 'lo-trinh',
      goLabel: 'Lộ trình công đoạn',
    }
  }
  if (r.jobs_total === 0) {
    return { text: 'chưa giao tổ & hạn', tone: 'warn', go: 'giao-to', goLabel: 'Giao tổ' }
  }
  if (r.plan_overdue > 0) {
    return {
      text: `${fmt(r.plan_overdue)} việc quá hạn kế hoạch`,
      tone: 'warn',
      go: 'mo',
      goLabel: 'Mở',
    }
  }
  return {
    text: `không vướng · ${fmt(r.jobs_total)} việc đã giao tổ`,
    tone: 'done',
    go: canRecord && r.component_count > 0 ? 'ghi-so' : 'mo',
    goLabel: canRecord && r.component_count > 0 ? 'Ghi sổ' : 'Mở',
  }
}

/** Một ô của dải công đoạn: null = không trong lộ trình (ô sọc). */
export type StripCell = {
  stage: string
  label: string
  pct: number | null
  title: string
}

/**
 * Dải 12 ô theo THỨ TỰ DANH MỤC (cố định, đọc theo cột — Q3 bản vẽ). Ô sọc =
 * lệnh không đi qua; ô 0% = có đi qua, chưa có sổ. Kèm một câu tóm tắt cho
 * trình đọc màn hình (chỉ kể công đoạn nằm trong lộ trình).
 */
export function stripOf(
  chips: OverviewRow['chips'],
  stages: { code: string; label: string }[],
): { cells: StripCell[]; summary: string } {
  const byCode = new Map(chips.map((c) => [c.stage, c]))
  const cells = stages.map((s): StripCell => {
    const c = byCode.get(s.code)
    if (!c || c.total === 0) {
      return {
        stage: s.code,
        label: s.label,
        pct: null,
        title: `${s.label}: không trong lộ trình`,
      }
    }
    const pct = Math.round(Math.min(1, c.done / c.total) * 100)
    return {
      stage: s.code,
      label: s.label,
      pct,
      title: `${s.label}: ${fmt(c.done)}/${fmt(c.total)}${c.doing > 0 ? ` · ${fmt(c.doing)} đang làm` : ''}`,
    }
  })
  const parts = cells.filter((c) => c.pct != null).map((c) => `${c.label} ${c.pct}%`)
  return {
    cells,
    summary: parts.length
      ? `Tiến độ công đoạn — ${parts.join(', ')}`
      : 'Chưa có công đoạn nào trong lộ trình của lệnh này',
  }
}
