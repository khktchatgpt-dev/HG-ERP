import { describe, it, expect } from 'vitest'
import { computeDerivedRoleKeys } from './rbac.derive'

const derive = (
  role: 'admin' | 'manager' | 'employee',
  deptName: string | null,
  workspaceId: string | null,
  isHead = false,
) => computeDerivedRoleKeys({ role, deptName, workspaceId, isHead }).sort()

describe('computeDerivedRoleKeys — mirror backfill 0073', () => {
  it('admin không phòng → chỉ admin', () => {
    expect(derive('admin', null, null)).toEqual(['admin'])
  })

  it('manager không phòng → chỉ director', () => {
    expect(derive('manager', null, null)).toEqual(['director'])
  })

  it('NV Sản xuất (workspace production) → production_staff', () => {
    expect(derive('employee', 'Xưởng Sản Xuất', 'production')).toEqual([
      'production_staff',
    ])
  })

  it('manager phòng Sản xuất → director + production_staff', () => {
    expect(derive('manager', 'Xưởng Sản Xuất', 'production')).toEqual([
      'director',
      'production_staff',
    ])
  })

  it('NV phòng gộp cũ (Kế Hoạch Sản Xuất-cung ứng) → planner + supply_staff', () => {
    expect(derive('employee', 'Kế Hoạch Sản Xuất-cung ứng', 'planning')).toEqual([
      'planner',
      'supply_staff',
    ])
  })

  it('NV Kế hoạch (phòng tách) → planner', () => {
    expect(derive('employee', 'Kế Hoạch Sản Xuất', 'planning')).toEqual(['planner'])
  })

  it('NV Cung ứng (phòng tách) → supply_staff', () => {
    expect(derive('employee', 'Cung Ứng - Mua Hàng', 'planning')).toEqual([
      'supply_staff',
    ])
  })

  it('mỗi workspace 1-1 map đúng role', () => {
    expect(derive('employee', 'Bán Hàng', 'sales')).toEqual(['sales_staff'])
    expect(derive('employee', 'Kho', 'warehouse')).toEqual(['warehouse_staff'])
    expect(derive('employee', 'Kỹ Thuật', 'technical')).toEqual(['technical_staff'])
    expect(derive('employee', 'Tài Chính Kế Toán', 'finance')).toEqual([
      'accounting_staff',
    ])
    expect(derive('employee', 'Hành Chính Nhân Sự', 'hr')).toEqual(['hr_staff'])
    expect(derive('employee', 'QC', 'qc')).toEqual(['qc_staff'])
  })

  it('trưởng phòng → thêm head', () => {
    expect(derive('employee', 'Bán Hàng', 'sales', true)).toEqual(['head', 'sales_staff'])
  })

  it('workspace không map (exec/system) → không role phòng', () => {
    expect(derive('manager', 'Ban Giám Đốc', 'exec')).toEqual(['director'])
    expect(derive('employee', null, 'system')).toEqual([])
  })
})
