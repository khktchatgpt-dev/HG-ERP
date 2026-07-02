import { describe, it, expect } from 'vitest'
import { resolveWorkspaceFromPath } from './resolveWorkspace'

describe('resolveWorkspaceFromPath', () => {
  it('match exact route base', () => {
    expect(resolveWorkspaceFromPath('/sales')?.id).toBe('sales')
    expect(resolveWorkspaceFromPath('/finance')?.id).toBe('finance')
    expect(resolveWorkspaceFromPath('/admin')?.id).toBe('system')
  })

  it('match sub-path của workspace', () => {
    expect(resolveWorkspaceFromPath('/sales/customers')?.id).toBe('sales')
    expect(resolveWorkspaceFromPath('/sales/customers/abc')?.id).toBe('sales')
    expect(resolveWorkspaceFromPath('/admin/users/audit')?.id).toBe('system')
  })

  it('không match path không thuộc workspace nào', () => {
    expect(resolveWorkspaceFromPath('/tasks')).toBeNull()
    expect(resolveWorkspaceFromPath('/plan')).toBeNull()
    expect(resolveWorkspaceFromPath('/')).toBeNull()
    expect(resolveWorkspaceFromPath('/login')).toBeNull()
  })

  it('không match path giống prefix nhưng khác workspace', () => {
    // /salesforce không phải /sales
    expect(resolveWorkspaceFromPath('/salesforce')).toBeNull()
  })
})
