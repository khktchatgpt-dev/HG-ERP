import { describe, it, expect } from 'vitest'
import { canMutateOwned, canRemoveOrdersFromLsx } from './record-ownership'

const HANG = { id: 'u-hang', role: 'employee' as const }
const PHUONG = { id: 'u-phuong', role: 'employee' as const }
const TRUONG_PHONG = { id: 'u-mgr', role: 'manager' as const }
const ADMIN = { id: 'u-admin', role: 'admin' as const }

describe('canMutateOwned — của ai người đó sửa', () => {
  it('nhân viên sửa được bản ghi của chính mình', () => {
    expect(canMutateOwned(HANG, 'u-hang')).toBe(true)
  })

  it('nhân viên KHÔNG sửa được bản ghi của đồng nghiệp', () => {
    expect(canMutateOwned(HANG, 'u-phuong')).toBe(false)
    expect(canMutateOwned(PHUONG, 'u-hang')).toBe(false)
  })

  it('admin và trưởng phòng/GĐ sửa được mọi bản ghi', () => {
    for (const boss of [ADMIN, TRUONG_PHONG]) {
      expect(canMutateOwned(boss, 'u-hang')).toBe(true)
      expect(canMutateOwned(boss, 'u-phuong')).toBe(true)
    }
  })

  it('bản ghi VÔ CHỦ: nhân viên không đụng được, quản lý thì có', () => {
    // Đơn/lệnh nhập bằng script trước khi có cột created_by. Mở cho mọi nhân
    // viên thì còn lỏng hơn luật cũ — phải để quản lý gán chủ trước.
    for (const nil of [null, undefined, '']) {
      expect(canMutateOwned(HANG, nil)).toBe(false)
      expect(canMutateOwned(ADMIN, nil)).toBe(true)
      expect(canMutateOwned(TRUONG_PHONG, nil)).toBe(true)
    }
  })
})

describe('canRemoveOrdersFromLsx — duyệt rồi thì không gỡ đơn', () => {
  it('trước khi duyệt: gỡ được', () => {
    for (const s of ['draft', 'pending_approval', 'rejected']) {
      expect(canRemoveOrdersFromLsx(s)).toBe(true)
    }
  })

  it('từ lúc duyệt trở đi: KHÔNG gỡ được, chỉ sửa/cập nhật', () => {
    for (const s of ['approved', 'in_progress', 'completed', 'cancelled']) {
      expect(canRemoveOrdersFromLsx(s)).toBe(false)
    }
  })
})
