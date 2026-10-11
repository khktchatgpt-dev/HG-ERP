import { describe, expect, it } from 'vitest'
import { chuanMucDich, goiYMucDich, MUC_DICH_MOI, nhanNgoaiLenh, nhomTheoMucDich } from './po-muc-dich'

describe('mục đích đơn ngoài lệnh', () => {
  it('chuẩn hoá: gọn khoảng trắng, hoa chữ đầu, rỗng → null', () => {
    expect(chuanMucDich('  khuôn   mẫu ')).toBe('Khuôn mẫu')
    expect(chuanMucDich('đơn khách')).toBe('Đơn khách')
    expect(chuanMucDich('   ')).toBeNull()
    expect(chuanMucDich(null)).toBeNull()
  })

  it('gợi ý: loại đã dùng nhiều trước, gộp hoa thường, rồi tới loại mồi chưa dùng', () => {
    const g = goiYMucDich(['Khuôn mẫu', 'khuôn mẫu', 'Sơn tường', null, 'Dự trữ kho'])
    expect(g.slice(0, 3)).toEqual(['Khuôn mẫu', 'Dự trữ kho', 'Sơn tường'])
    // Mồi đã có trong loại dùng rồi thì không lặp lại.
    expect(g.filter((x) => x.toLowerCase() === 'khuôn mẫu')).toHaveLength(1)
    expect(g).toHaveLength(3 + MUC_DICH_MOI.length - 2)
  })

  it('giữ dấu khi so trùng: "Mau" và "Mẫu" là hai chữ', () => {
    expect(goiYMucDich(['Hàng mau', 'Hàng mẫu']).slice(0, 2)).toHaveLength(2)
  })

  it('nhãn: đủ ba phần / chỉ loại / trần', () => {
    expect(nhanNgoaiLenh({ standalone_purpose: 'Đơn khách chưa ra lệnh', standalone_ref: 'PHIPPS' })).toBe('Ngoài lệnh · Đơn khách chưa ra lệnh · PHIPPS') // prettier-ignore
    expect(nhanNgoaiLenh({ standalone_purpose: 'Khuôn mẫu' })).toBe(
      'Ngoài lệnh · Khuôn mẫu',
    )
    expect(nhanNgoaiLenh({})).toBe('Ngoài lệnh')
  })
})

describe('nhomTheoMucDich', () => {
  it('mỗi loại một nhóm, gộp hoa thường, nhiều trước; chưa ghi → nhóm riêng', () => {
    const g = nhomTheoMucDich([
      { id: 1, standalone_purpose: 'Khuôn mẫu' },
      { id: 2, standalone_purpose: null },
      { id: 3, standalone_purpose: 'khuôn mẫu' },
      { id: 4, standalone_purpose: 'Dự trữ kho' },
    ])
    expect(g.map(([n, ps]) => [n, ps.map((p) => p.id)])).toEqual([
      ['Khuôn mẫu', [1, 3]],
      ['chưa ghi mục đích', [2]],
      ['Dự trữ kho', [4]],
    ])
  })
})
