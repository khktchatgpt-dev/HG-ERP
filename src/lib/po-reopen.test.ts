import { describe, expect, it } from 'vitest'
import { canReopenForEdit, reopenNote } from './po-reopen'

/*
  Hạ đơn về nháp là thao tác VÔ HIỆU HOÁ CHỮ KÝ DUYỆT, nên mỗi hàng rào phải có
  test riêng. Hàng rào "đã nhận hàng thì không" là cứng nhất: bỏ nó thì sửa dòng
  sẽ để lại phiếu nhập kho trỏ vào dòng không còn tồn tại.
*/
const base = {
  status: 'ordered',
  receivedQty: 0,
  warehouseDocs: 0,
  privileged: true,
}

describe('canReopenForEdit', () => {
  it('cho phép hạ đơn đã gửi NCC khi chưa có hàng về', () => {
    expect(canReopenForEdit(base)).toEqual({ ok: true })
  })

  it.each(['pending_approval', 'approved', 'ordered', 'confirmed', 'in_transit'])(
    'cho phép ở trạng thái %s',
    (status) => {
      expect(canReopenForEdit({ ...base, status })).toEqual({ ok: true })
    },
  )

  it('chặn người không có quyền, kể cả khi mọi điều kiện khác đều đạt', () => {
    const g = canReopenForEdit({ ...base, privileged: false })
    expect(g.ok).toBe(false)
    expect(g.ok === false && g.reason).toMatch(/Giám đốc hoặc trưởng phòng/)
  })

  it('CHẶN CỨNG khi đã nhận dù chỉ một phần — phiếu nhập sẽ mồ côi', () => {
    const g = canReopenForEdit({ ...base, status: 'partial', receivedQty: 0.5 })
    expect(g.ok).toBe(false)
    expect(g.ok === false && g.reason).toMatch(/phiếu nhập kho/)
  })

  it('chặn cả khi phiếu kho ghi 0 (trả hàng, phiếu huỷ dở)', () => {
    const g = canReopenForEdit({ ...base, warehouseDocs: 1 })
    expect(g.ok).toBe(false)
    expect(g.ok === false && g.reason).toMatch(/phiếu nhập kho/)
  })

  it('quyền được xét TRƯỚC tình trạng nhận hàng — báo đúng vướng mắc gần nhất', () => {
    const g = canReopenForEdit({ ...base, privileged: false, receivedQty: 10 })
    expect(g.ok === false && g.reason).toMatch(/Giám đốc hoặc trưởng phòng/)
  })

  it('đơn nháp thì vô nghĩa, chỉ thẳng sang đường sửa bình thường', () => {
    const g = canReopenForEdit({ ...base, status: 'draft' })
    expect(g.ok === false && g.reason).toMatch(/sửa thẳng được rồi/)
  })

  it('đơn đã huỷ thì chỉ sang "Tạo lại từ đơn này"', () => {
    const g = canReopenForEdit({ ...base, status: 'cancelled' })
    expect(g.ok === false && g.reason).toMatch(/Tạo lại từ đơn này/)
  })

  it('đơn đã về đủ không hạ được, ngay cả khi chưa kịp ghi phiếu kho', () => {
    // 'received' không nằm trong REOPENABLE — hàng rào thứ hai đỡ nếu số nhận
    // chưa kịp đồng bộ về 0 vì lý do nào đó.
    expect(canReopenForEdit({ ...base, status: 'received' }).ok).toBe(false)
  })
})

describe('reopenNote', () => {
  it('đóng dấu trạng thái cũ và lý do, giữ nguyên ghi chú trước đó', () => {
    const n = reopenNote('ordered', 'Gõ nhầm số lượng chân côn', 'Ghi chú cũ')
    expect(n).toMatch(/ordered/)
    expect(n).toMatch(/Gõ nhầm số lượng chân côn/)
    expect(n).toMatch(/Ghi chú cũ/)
  })
})
