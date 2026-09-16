import { describe, expect, it } from 'vitest'
import { canReopen, receivedBlockReason } from './po-reopen'
import { PO_STATUSES } from './po-status'

describe('canReopen — trạng thái nào mở lại để sửa được', () => {
  it('đã duyệt / đã gửi NCC / NCC xác nhận / đang giao: mở được', () => {
    for (const s of ['approved', 'ordered', 'confirmed', 'in_transit']) {
      expect(canReopen(s)).toEqual({ ok: true })
    }
  })

  it('nháp và chờ duyệt: chặn, và chỉ sang đúng nút có sẵn', () => {
    const d = canReopen('draft')
    expect(d.ok === false && d.reason).toContain('Sửa đơn')
    const p = canReopen('pending_approval')
    expect(p.ok === false && p.reason).toContain('Rút về nháp')
  })

  it('đã có hàng về thì chặn — sổ kho đã ghi theo bản cũ', () => {
    for (const s of ['partial', 'received']) {
      const g = canReopen(s)
      expect(g.ok).toBe(false)
      expect(g.ok === false && g.reason).toContain('nhân bản')
    }
  })

  it('đơn huỷ thì chặn', () => {
    expect(canReopen('cancelled').ok).toBe(false)
  })

  /*
    Trạng thái mới thêm vào PO_STATUSES mà quên khai ở đây sẽ rơi vào nhánh
    cuối của canReopen — test này bắt nó nói ra lý do đọc được, thay vì trả
    `ok: true` cho một bước chưa ai cân nhắc.
  */
  it('mọi trạng thái đều có câu trả lời, không cái nào lọt', () => {
    for (const s of PO_STATUSES) {
      const g = canReopen(s)
      if (!g.ok) expect(g.reason.length).toBeGreaterThan(10)
    }
    expect(canReopen('trang_thai_la').ok).toBe(false)
  })
})

describe('receivedBlockReason — tầng chặn thứ hai (theo phiếu nhập)', () => {
  it('chưa nhận dòng nào thì không chặn', () => {
    expect(receivedBlockReason(0)).toBeNull()
  })

  it('đã nhận thì nói SỐ dòng và cả hai lối đi tiếp', () => {
    const r = receivedBlockReason(2)
    expect(r).toContain('2 dòng')
    expect(r).toContain('Chốt phần thiếu')
    expect(r).toContain('nhân bản')
  })
})
