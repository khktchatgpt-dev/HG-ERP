import { describe, expect, it } from 'vitest'
import { khoangNgayTenFile, tenFileXuat } from './ten-file-xuat'

describe('tên file xuất', () => {
  it('khoảng cùng năm: 26.09-25.10.2026; khác năm ghi năm hai đầu', () => {
    expect(khoangNgayTenFile('2026-09-26', '2026-10-25')).toBe('26.09-25.10.2026')
    expect(khoangNgayTenFile('2025-12-26', '2026-01-25')).toBe('26.12.2025-25.01.2026')
  })
  it('ghép phần bằng " - ", bỏ ký tự cấm, bỏ phần trống', () => {
    expect(tenFileXuat('Chi tiết chấm công', 'Cả công ty', '26.09-25.10.2026')).toBe(
      'Chi tiết chấm công - Cả công ty - 26.09-25.10.2026.xlsx',
    )
    expect(tenFileXuat('Chấm công', '00059 Lê Thị Phúc', null, '')).toBe(
      'Chấm công - 00059 Lê Thị Phúc.xlsx',
    )
    expect(tenFileXuat('Tổ A/B: "x"?')).toBe('Tổ A B x.xlsx')
  })
})
