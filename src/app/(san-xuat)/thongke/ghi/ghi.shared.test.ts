import { describe, expect, it } from 'vitest'
import { isTyped, num, rowProblems, type EditCol } from './ghi.shared'

/** Ghi sản lượng — ô số đọc một luật với Bảng chi tiết, sai thì chặn tại chỗ (15/11/2026). */
const col = (
  key: string,
  label: string,
  kind: EditCol['kind'],
  required = false,
): EditCol => ({
  key,
  label,
  kind,
  required,
  width: 60,
})
const cols = [
  col('qty', 'Đạt', 'num', true),
  col('defect', 'Lỗi', 'num'),
  col('reason', 'Lý do lỗi', 'text'),
  col('kg', 'Kg', 'num'),
  col('f:do_am', 'Độ ẩm', 'num'),
]

describe('Ghi sản lượng — ô số', () => {
  it('"1.390" là 1390 (trước 15/11 gõ tay ra 1,39), phẩy là thập phân', () => {
    expect(num('1.390')).toBe(1390)
    expect(num('2,5')).toBe(2.5)
    expect(num('')).toBe(0)
    expect(num('abc')).toBe(0)
  })

  it('dòng gõ chữ / số âm KHÔNG biến khỏi phiếu — vào danh sách để bị chặn', () => {
    expect(isTyped({ qty: 'abc' })).toBe(true)
    expect(isTyped({ qty: '-5' })).toBe(true)
    expect(isTyped({ qty: '0' })).toBe(false)
    expect(isTyped({ qty: '' })).toBe(false)
    expect(isTyped({ qty: '12' })).toBe(true)
  })

  it('ô số có chữ → lỗi đúng cột, kể cả ô số riêng của công đoạn', () => {
    expect(rowProblems({ qty: 'mười' }, cols)).toEqual([
      { key: 'qty', msg: 'Đạt "mười" không phải số' },
    ])
    expect(rowProblems({ qty: '10', kg: '12kg', 'f:do_am': 'x' }, cols)).toEqual([
      { key: 'kg', msg: 'Kg "12kg" không phải số' },
      { key: 'f:do_am', msg: 'Độ ẩm "x" không phải số' },
    ])
  })

  it('số âm bị chặn trước khi bấm Ghi sổ', () => {
    expect(rowProblems({ qty: '-5' }, cols)).toEqual([
      { key: 'qty', msg: 'Đạt không được âm' },
    ])
  })

  it('dòng đúng không có lỗi; có lỗi mà chưa ghi lý do vẫn bị nhắc', () => {
    expect(rowProblems({ qty: '1.390', kg: '12,5' }, cols)).toEqual([])
    expect(rowProblems({ qty: '10', defect: '2' }, cols)).toEqual([
      { key: 'reason', msg: 'có hàng lỗi mà chưa ghi vì sao' },
    ])
  })
})
