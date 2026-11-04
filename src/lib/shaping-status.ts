/**
 * Tình trạng bảng chi tiết + lộ trình cụm của một lệnh đang chạy — kiểu + hai
 * vị từ THUẦN để client (màn Lộ trình công đoạn gộp, danh sách lệnh) và server
 * (`componentsService.shapingOverview`, badge sidebar) đếm bằng cùng một luật.
 * Ở `src/lib/` vì file `'use client'` chỉ được `import type` từ `@/modules/*`.
 */
export type ShapingRow = {
  lsx: {
    id: string
    code: string
    customer_name: string
    ship_date: string | null
    status: string
  }
  line_count: number
  component_count: number
  cluster_count: number
  /** Cụm trên lệnh chưa khai lộ trình (`stages` null → chạy theo mặc định nhóm vật tư). */
  cluster_unrouted: number
  /** Dòng SP của lệnh chưa có dòng chi tiết nào (chưa nạp bảng, hoặc chưa có định mức). */
  lines_without_rows: number
  /** Dòng SP KHÔNG lấy được bảng từ Kỹ thuật: chưa gắn SP hoặc hồ sơ chưa có định mức. */
  lines_missing_bom: number
  jobs_total: number
}

/** Lệnh chưa có chi tiết nào — không có gì để ghi sổ. Cùng luật với chip "Chưa định hình" ở Lệnh SX. */
export function isUnshaped(r: Pick<ShapingRow, 'component_count'>): boolean {
  return r.component_count === 0
}

/**
 * Việc của Kế hoạch còn treo: lệnh có cụm chưa khai lộ trình (04/11/2026). Lệnh
 * chưa có bảng không tính — đó là việc của Kỹ thuật (định mức), không phải kế hoạch.
 */
export function needsRoute(r: Pick<ShapingRow, 'cluster_unrouted'>): boolean {
  return r.cluster_unrouted > 0
}
