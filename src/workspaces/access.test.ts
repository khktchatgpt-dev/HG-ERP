import { describe, expect, it } from 'vitest'
import { canEnterWorkspaceSync, workspaceViewPermission } from './access'
import { WORKSPACE_IDS } from './workspaces.config'

const admin = { role: 'admin' as const }
const manager = { role: 'manager' as const }
const employee = { role: 'employee' as const }

describe('canEnterWorkspaceSync — 0086: xem chéo phải có quyền', () => {
  it('admin vào mọi workspace, kể cả chưa ready', () => {
    for (const id of WORKSPACE_IDS) {
      expect(canEnterWorkspaceSync(admin, id, null), id).toBe(true)
    }
  })

  it('workspace nhà luôn vào được, kể cả hr/finance', () => {
    expect(canEnterWorkspaceSync(employee, 'hr', 'hr')).toBe(true)
    expect(canEnterWorkspaceSync(employee, 'finance', 'finance')).toBe(true)
    expect(canEnterWorkspaceSync(manager, 'exec', 'exec')).toBe(true)
  })

  it('khu nhạy cảm (hr/finance/system) chặn hẳn người ngoài — kể cả manager', () => {
    for (const who of [employee, manager]) {
      for (const id of ['hr', 'finance', 'system'] as const) {
        expect(canEnterWorkspaceSync(who, id, 'sales'), `${who.role}:${id}`).toBe(false)
      }
    }
  })

  it('workspace khác nhà (kể cả exec) → cần permission, KHÔNG còn đặc quyền manager', () => {
    for (const who of [employee, manager]) {
      for (const id of [
        'sales',
        'technical',
        'warehouse',
        'planning',
        'production',
        'team',
        'stat',
        'prodplan',
        'exec',
      ] as const) {
        expect(canEnterWorkspaceSync(who, id, 'hr'), `${who.role}:${id}`).toBe(
          'need-permission',
        )
      }
    }
  })

  it('nhà xưởng (homeId=production) mở cửa CẢ gia đình SX', () => {
    for (const id of ['production', 'team', 'stat', 'prodplan'] as const) {
      expect(canEnterWorkspaceSync(employee, id, 'production'), id).toBe(true)
    }
  })

  it('workspace chưa ready (qc) chặn mọi người trừ admin', () => {
    expect(canEnterWorkspaceSync(employee, 'qc', 'qc')).toBe(false)
    expect(canEnterWorkspaceSync(manager, 'qc', null)).toBe(false)
    expect(canEnterWorkspaceSync(admin, 'qc', null)).toBe(true)
  })
})

describe('workspaceViewPermission', () => {
  it('exec dùng exec.tower.view; còn lại workspace.view.<id>', () => {
    expect(workspaceViewPermission('exec')).toBe('exec.tower.view')
    expect(workspaceViewPermission('production')).toBe('workspace.view.production')
    // Cả gia đình SX dùng chung 1 quyền xem.
    expect(workspaceViewPermission('team')).toBe('workspace.view.production')
    expect(workspaceViewPermission('stat')).toBe('workspace.view.production')
    expect(workspaceViewPermission('prodplan')).toBe('workspace.view.production')
    expect(workspaceViewPermission('warehouse')).toBe('workspace.view.warehouse')
  })
})
