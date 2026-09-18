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

  describe('altRoutes — ba khu Sản xuất gộp làm một (18/09/2026)', () => {
    it('/thongke và /kehoach-sx thuộc khu production', () => {
      expect(resolveWorkspaceFromPath('/thongke')?.id).toBe('production')
      expect(resolveWorkspaceFromPath('/kehoach-sx')?.id).toBe('production')
    })

    it('sub-path của altRoute cũng thuộc khu đó', () => {
      // Nếu hỏng, mọi trang ghi sổ mất sidebar và mất luôn màu khu.
      expect(resolveWorkspaceFromPath('/thongke/ghi')?.id).toBe('production')
      expect(resolveWorkspaceFromPath('/thongke/lsx/abc/dinh-hinh')?.id).toBe(
        'production',
      )
      expect(resolveWorkspaceFromPath('/kehoach-sx/chi-tieu')?.id).toBe('production')
    })

    it('bề mặt XƯỞNG vẫn là workspace riêng', () => {
      expect(resolveWorkspaceFromPath('/to')?.id).toBe('team')
      expect(resolveWorkspaceFromPath('/to/lenh')?.id).toBe('team')
    })

    it('altRoute không nuốt path chỉ GIỐNG tiền tố', () => {
      expect(resolveWorkspaceFromPath('/thongkexyz')).toBeNull()
    })
  })
})
