import { usersRepo } from '@/modules/core/users/users.repo'
import type { AssetRow, EmployeeLite, IssueRow, WorkOrderRow } from './assets.repo'

/**
 * Phiếu báo hỏng ĐỂ BÀY — một hình dữ liệu cho mọi chỗ hiện phiếu (bảng + thẻ ở
 * Báo hỏng, thẻ ở Việc hôm nay / Tổng quan), để thẻ ở hai trang không nói khác
 * nhau về cùng một phiếu. Thẻ của bản demo MOCA cần thêm tổ đặt máy và kết quả
 * phiếu sửa (chi phí, giờ dừng) — hai thứ đó không nằm trên `asset_issues`.
 */
export type IssueView = IssueRow & {
  asset: {
    id: string
    code: string
    name: string
    department_id: string | null
    status: string
  } | null
  dept_name: string | null
  reporter_name: string | null
  tech_name: string | null
  /** Phiếu sửa sinh ra khi "Sửa xong" — chỉ có ở phiếu đã xong. */
  wo: { no: string; cost: number; downtime_hours: number } | null
}

export async function issueViews(
  issues: IssueRow[],
  src: {
    assets: AssetRow[]
    emps: EmployeeLite[]
    depts: Map<string, string>
    wos: WorkOrderRow[]
  },
): Promise<IssueView[]> {
  const byId = new Map(src.assets.map((a) => [a.id, a]))
  const empName = new Map(src.emps.map((e) => [e.id, e.full_name]))
  const woById = new Map(src.wos.map((w) => [w.id, w]))
  const reporters = await usersRepo.displayNamesByIds([
    ...new Set(issues.map((i) => i.reporter_user_id).filter((x): x is string => !!x)),
  ])
  return issues.map((i) => {
    const a = byId.get(i.asset_id)
    const w = i.work_order_id ? woById.get(i.work_order_id) : undefined
    return {
      ...i,
      asset: a
        ? {
            id: a.id,
            code: a.code,
            name: a.name,
            department_id: a.department_id,
            status: a.status,
          }
        : null,
      dept_name: a?.department_id ? (src.depts.get(a.department_id) ?? null) : null,
      reporter_name: i.reporter_user_id
        ? (reporters.get(i.reporter_user_id) ?? null)
        : null,
      tech_name: i.tech_employee_id ? (empName.get(i.tech_employee_id) ?? null) : null,
      wo: w ? { no: w.no, cost: w.cost, downtime_hours: w.downtime_hours } : null,
    }
  })
}
