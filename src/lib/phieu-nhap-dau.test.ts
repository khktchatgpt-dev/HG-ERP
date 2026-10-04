import { describe, expect, it } from 'vitest'
import { suaLaiTu } from './da-ve'
import { canNhacSoNcc, ghiChuPhieu, nguoiGiaoBanDau } from './phieu-nhap-dau'

describe('nguoiGiaoBanDau', () => {
  it('phiếu mới → tên NCC', () => {
    expect(nguoiGiaoBanDau(null, 'CÔNG TY TNHH SX & TM DV TÂN THÀNH LONG')).toBe(
      'CÔNG TY TNHH SX & TM DV TÂN THÀNH LONG',
    )
  })
  it('lập lại phiếu giữ người giao của phiếu cũ', () => {
    expect(nguoiGiaoBanDau({ counterparty: 'Anh Tài (tài xế)' }, 'Kimpack')).toBe(
      'Anh Tài (tài xế)',
    )
  })
  it('phiếu cũ để trống người giao → vẫn điền tên NCC', () => {
    expect(nguoiGiaoBanDau({ counterparty: '  ' }, 'Kimpack')).toBe('Kimpack')
  })
})

describe('ghiChuPhieu', () => {
  it('không gõ gì, không sửa phiếu → null (không ghi chuỗi rỗng)', () => {
    expect(ghiChuPhieu(null, '   ')).toBeNull()
  })
  it('chỉ ghi chú người lập', () => {
    expect(ghiChuPhieu(null, ' hàng về 2 xe ')).toBe('hàng về 2 xe')
  })
  it('sửa phiếu: dấu "Sửa lại" đứng đầu và suaLaiTu vẫn đọc được', () => {
    const n = ghiChuPhieu(
      { code: 'PNK-2026-0066', daoBoi: 'PXK-2026-0029' },
      'gỡ 2 dòng Elos',
    )
    expect(n).toBe('Sửa lại PNK-2026-0066 (đã đảo bởi PXK-2026-0029) · gỡ 2 dòng Elos')
    expect(suaLaiTu(n)).toBe('PNK-2026-0066')
  })
})

describe('canNhacSoNcc', () => {
  it('trống hoặc toàn khoảng trắng → nhắc', () => {
    expect(canNhacSoNcc('')).toBe(true)
    expect(canNhacSoNcc('  ')).toBe(true)
  })
  it('đã có số → không nhắc', () => {
    expect(canNhacSoNcc('5/2026- HG/TTL')).toBe(false)
  })
})
