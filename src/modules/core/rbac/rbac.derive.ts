/**
 * Tính tập role DẪN-XUẤT của một user từ (vai toàn cục + phòng + có phải trưởng
 * phòng). Đây là BẢN SAO CODE của backfill trong 0073_rbac.sql — phải khớp
 * tuyệt đối để syncUserRoles không tạo lệch. Hàm THUẦN (không I/O) → test dễ.
 *
 * Quy tắc (đúng như SQL seed):
 *   - admin   → 'admin'
 *   - manager → 'director'
 *   - phòng theo workspace_id 1-1 (sales→sales_staff, production→production_staff…)
 *   - phòng trong workspace 'planning' tách theo TÊN (workspace_id không đủ)
 *   - trưởng phòng (head_user_id) → thêm 'head'
 * Áp cho MỌI vai (admin/manager cũng nhận role phòng nếu có phòng — như SQL).
 */
const ROLE_BY_WORKSPACE: Record<string, string> = {
  sales: 'sales_staff',
  finance: 'accounting_staff',
  warehouse: 'warehouse_staff',
  technical: 'technical_staff',
  production: 'production_staff',
  qc: 'qc_staff',
  hr: 'hr_staff',
}

export function computeDerivedRoleKeys(input: {
  role: 'admin' | 'manager' | 'employee'
  deptName: string | null
  workspaceId: string | null
  isHead: boolean
}): string[] {
  const keys = new Set<string>()

  if (input.role === 'admin') keys.add('admin')
  if (input.role === 'manager') keys.add('director')

  if (input.workspaceId && ROLE_BY_WORKSPACE[input.workspaceId]) {
    keys.add(ROLE_BY_WORKSPACE[input.workspaceId])
  }

  // Workspace 'planning' — tách vai theo tên phòng (đúng SQL backfill).
  if (input.deptName === 'Kế Hoạch Sản Xuất-cung ứng') {
    keys.add('planner')
    keys.add('supply_staff')
  } else if (input.deptName === 'Kế Hoạch Sản Xuất') {
    keys.add('planner')
  } else if (input.deptName === 'Cung Ứng - Mua Hàng') {
    keys.add('supply_staff')
  }

  if (input.isHead) keys.add('head')

  return [...keys]
}
