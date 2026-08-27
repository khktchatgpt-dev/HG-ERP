import { describe, it, expect } from 'vitest'
import {
  allowedActions,
  canDelete,
  canEdit,
  checkTransition,
  countsAsOfficial,
  countsAsPending,
} from './entry-doc-flow'

describe('vòng đời phiếu báo sản lượng', () => {
  it('đường chính: nháp → gửi → xác nhận', () => {
    const gui = checkTransition('nhap', 'gui', 'thong_ke')
    expect(gui).toEqual({ ok: true, to: 'cho_xac_nhan' })
    expect(checkTransition('cho_xac_nhan', 'xac_nhan', 'to_truong')).toEqual({
      ok: true,
      to: 'da_xac_nhan',
    })
  })

  it('đường lỗi: trả về (kèm lý do) → sửa → gửi lại', () => {
    expect(
      checkTransition('cho_xac_nhan', 'tra_ve', 'to_truong', 'sai số tổ Phôi'),
    ).toEqual({ ok: true, to: 'tu_choi' })
    expect(canEdit('tu_choi', 'thong_ke')).toBe(true)
    expect(checkTransition('tu_choi', 'gui', 'thong_ke')).toEqual({
      ok: true,
      to: 'cho_xac_nhan',
    })
  })

  it('trả về mà không ghi lý do → chặn, kèm câu đọc được', () => {
    const r = checkTransition('cho_xac_nhan', 'tra_ve', 'to_truong', '   ')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.reason).toContain('lý do')
  })
})

describe('hai điều cấm của phạm vi Bước 1 phải đứng vững', () => {
  it('thống kê KHÔNG tự xác nhận số của mình', () => {
    const r = checkTransition('cho_xac_nhan', 'xac_nhan', 'thong_ke')
    expect(r.ok).toBe(false)
    expect(allowedActions('cho_xac_nhan', 'thong_ke')).not.toContain('xac_nhan')
  })

  it('thống kê KHÔNG sửa/xoá phiếu đã xác nhận', () => {
    expect(canEdit('da_xac_nhan', 'thong_ke')).toBe(false)
    expect(canDelete('da_xac_nhan', 'thong_ke')).toBe(false)
    // Kể cả quản lý cũng phải mở khoá trước, không xoá thẳng.
    expect(canDelete('da_xac_nhan', 'quan_ly')).toBe(false)
  })

  it('mở khoá phiếu đã xác nhận: chỉ quản lý, và phải có lý do', () => {
    expect(checkTransition('da_xac_nhan', 'mo_khoa', 'to_truong', 'x').ok).toBe(false)
    expect(checkTransition('da_xac_nhan', 'mo_khoa', 'quan_ly').ok).toBe(false)
    expect(checkTransition('da_xac_nhan', 'mo_khoa', 'quan_ly', 'sửa sai số')).toEqual({
      ok: true,
      to: 'nhap',
    })
  })
})

describe('thống kê là người thao tác chính — dòng chảy không bị tổ trưởng chặn', () => {
  it('phiếu đang chờ duyệt vẫn được thu hồi để sửa', () => {
    expect(checkTransition('cho_xac_nhan', 'thu_hoi', 'thong_ke')).toEqual({
      ok: true,
      to: 'nhap',
    })
  })

  it('phiếu chờ duyệt KHÔNG sửa thẳng — phải thu hồi trước', () => {
    // Nếu cho sửa thẳng thì tổ trưởng đang nhìn một đằng, số đổi một nẻo.
    expect(canEdit('cho_xac_nhan', 'thong_ke')).toBe(false)
  })

  it('số đã gửi được TẠM TÍNH ngay, chỉ số đã duyệt là CHÍNH THỨC', () => {
    expect(countsAsPending('cho_xac_nhan')).toBe(true)
    expect(countsAsOfficial('cho_xac_nhan')).toBe(false)
    expect(countsAsOfficial('da_xac_nhan')).toBe(true)
  })

  it('nháp và phiếu bị trả về không tính vào đâu cả', () => {
    for (const s of ['nhap', 'tu_choi'] as const) {
      expect(countsAsOfficial(s)).toBe(false)
      expect(countsAsPending(s)).toBe(false)
    }
  })
})

describe('tổ trưởng chỉ quản lý — không thao tác nhập liệu', () => {
  it('không sửa, không xoá, không gửi phiếu', () => {
    expect(canEdit('nhap', 'to_truong')).toBe(false)
    expect(canDelete('nhap', 'to_truong')).toBe(false)
    expect(checkTransition('nhap', 'gui', 'to_truong').ok).toBe(false)
  })

  it('trên phiếu chờ duyệt chỉ có đúng hai nút: xác nhận / trả về', () => {
    expect(allowedActions('cho_xac_nhan', 'to_truong').sort()).toEqual([
      'tra_ve',
      'xac_nhan',
    ])
  })

  it('phiếu nháp của thống kê thì tổ trưởng không thấy nút nào', () => {
    expect(allowedActions('nhap', 'to_truong')).toEqual([])
  })
})
