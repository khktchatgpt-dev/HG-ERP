import { describe, expect, it } from 'vitest'
import { gomMaCuaLenh, lyDoChuaGhi, type DongDinhMuc } from './ma-chua-ghi'

const dong = (p: Partial<DongDinhMuc>): DongDinhMuc => ({
  lsx_id: 'rosco',
  ma: 'CH0219HG-AL',
  ten: 'Ghế bành lưng cao New Chelsea',
  sl: 168,
  co_bang: false,
  n_dm: 0,
  ...p,
})

describe('gomMaCuaLenh', () => {
  it('mã lặp ở nhiều đợt gộp một hàng: cộng SL, đếm đợt', () => {
    const [L] = gomMaCuaLenh(
      [{ id: 'rosco', code: '01/26-27 - ROSCO' }],
      [dong({}), dong({ sl: 56 }), dong({ sl: 144 })],
    )
    expect(L.ma).toEqual([
      expect.objectContaining({
        ma: 'CH0219HG-AL',
        sl: 368,
        dot: 3,
        tinh_trang: 'chua_dm',
      }),
    ])
    expect(L.sl_chua).toBe(368)
  })

  it('ba tình trạng: có bảng / có định mức chưa nạp / chưa có định mức', () => {
    const [L] = gomMaCuaLenh(
      [{ id: 'rosco', code: '02/26-27 - ROSCO' }],
      [
        dong({ ma: 'TB0096HG-AL', co_bang: true, n_dm: 3 }),
        dong({ ma: '2722239', n_dm: 25, sl: 2204 }),
        dong({ ma: 'BN0229HG-IR', sl: 5456 }),
      ],
    )
    expect(L.ma.map((m) => [m.ma, m.tinh_trang])).toEqual([
      ['2722239', 'chua_nap'],
      ['BN0229HG-IR', 'chua_dm'],
      ['TB0096HG-AL', 'co_bang'],
    ])
    expect(L.chua.map((m) => m.ma)).toEqual(['2722239', 'BN0229HG-IR'])
    expect([L.n_chua_nap, L.n_chua_dm, L.sl_chua]).toEqual([1, 1, 7660])
    expect(lyDoChuaGhi(L)).toBe('1 mã chưa có định mức · 1 mã chưa nạp')
  })

  it('một đợt đã có bảng thì cả mã ghi được', () => {
    const [L] = gomMaCuaLenh(
      [{ id: 'rosco', code: 'x' }],
      [dong({ co_bang: true }), dong({ co_bang: false })],
    )
    expect(L.chua).toEqual([])
  })

  it('giữ thứ tự lệnh; lệnh không có dòng SP thì rỗng', () => {
    const out = gomMaCuaLenh(
      [
        { id: 'a', code: 'A' },
        { id: 'b', code: 'B' },
      ],
      [dong({ lsx_id: 'b' })],
    )
    expect(out.map((l) => [l.lsx_code, l.ma.length])).toEqual([
      ['A', 0],
      ['B', 1],
    ])
  })
})
