import { describe, expect, it } from 'vitest'
import { canEnterWorkspaceSync } from './access'
import { WORKSPACE_IDS } from './workspaces.config'

const admin = { role: 'admin' as const }
const manager = { role: 'manager' as const }
const employee = { role: 'employee' as const }

describe('canEnterWorkspaceSync', () => {
  it('admin vào mọi workspace, kể cả chưa ready', () => {
    for (const id of WORKSPACE_IDS) {
      expect(canEnterWorkspaceSync(admin, id, null), id).toBe(true)
    }
  })

  it('NV thường xem chéo được 5 workspace vận hành (openView)', () => {
    // Sales employee (home = sales) vào Kỹ thuật chỉ xem — đúng yêu cầu gốc.
    for (const id of [
      'sales',
      'technical',
      'warehouse',
      'planning',
      'production',
    ] as const) {
      expect(canEnterWorkspaceSync(employee, id, 'sales'), id).toBe(true)
    }
  })

  it('NV thường KHÔNG vào được khu nhạy cảm/điều hành của phòng khác', () => {
    for (const id of ['hr', 'finance', 'exec', 'system'] as const) {
      expect(canEnterWorkspaceSync(employee, id, 'sales'), id).toBe(false)
    }
  })

  it('workspace nhà luôn vào được, kể cả hr/finance', () => {
    expect(canEnterWorkspaceSync(employee, 'hr', 'hr')).toBe(true)
    expect(canEnterWorkspaceSync(employee, 'finance', 'finance')).toBe(true)
  })

  it('manager xem chéo mọi nơi trừ hr/finance/system phòng khác', () => {
    for (const id of [
      'sales',
      'technical',
      'warehouse',
      'planning',
      'production',
      'exec',
    ] as const) {
      expect(canEnterWorkspaceSync(manager, id, 'sales'), id).toBe(true)
    }
    for (const id of ['hr', 'finance', 'system'] as const) {
      expect(canEnterWorkspaceSync(manager, id, 'sales'), id).toBe(false)
    }
  })

  it('workspace chưa ready (qc) chặn mọi người trừ admin', () => {
    expect(canEnterWorkspaceSync(employee, 'qc', 'qc')).toBe(false)
    expect(canEnterWorkspaceSync(manager, 'qc', null)).toBe(false)
    expect(canEnterWorkspaceSync(admin, 'qc', null)).toBe(true)
  })
})
