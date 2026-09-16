import { describe, expect, it } from 'vitest'
import {
  LY_DO_XUAT_LE,
  lyDoCanLenh,
  themDong,
  thieuTon,
  tinhTongXuat,
  type DongXuat,
} from './kho-phieu-xuat'

const vt = (id: string) => ({ id, code: 'VT-' + id, name: 'Vật tư ' + id, unit: 'cây' })
const row = (id: string, qty = 0, qty_ok: number | null = 100): DongXuat => ({
  ...vt(id),
  qty_ok,
  qty,
  note: '',
})

describe('LY_DO_XUAT_LE — mã cho xuất lẻ', () => {
  it('chỉ X2, X6, X7: không X1 (theo lệnh), X3 (trả NCC), X4 (cần duyệt), X5 (kiểm kê)', () => {
    expect(LY_DO_XUAT_LE.map((x) => x.ma)).toEqual(['X2', 'X6', 'X7'])
  })
  it('X2 đòi gắn lệnh, X6/X7 không', () => {
    expect(lyDoCanLenh('X2')).toBe(true)
    expect(lyDoCanLenh('X6')).toBe(false)
    expect(lyDoCanLenh(null)).toBe(false)
  })
})

describe('themDong — một mã một dòng', () => {
  it('mã mới → thêm cuối, qty 0, giữ tồn tra được', () => {
    const r = themDong([row('a', 5)], vt('b'), 42)
    expect(r.trung).toBe(false)
    expect(r.index).toBe(1)
    expect(r.rows[1]).toMatchObject({ id: 'b', qty: 0, qty_ok: 42, note: '' })
  })
  it('mã đã có → không đẻ dòng, trả chỉ số dòng cũ', () => {
    const rows = [row('a', 5), row('b')]
    const r = themDong(rows, vt('a'), 99)
    expect(r.trung).toBe(true)
    expect(r.index).toBe(0)
    expect(r.rows).toBe(rows)
  })
})

describe('tinhTongXuat', () => {
  it('chỉ đếm dòng có số', () => {
    expect(tinhTongXuat([row('a', 10), row('b', 0), row('c', 2.5)])).toEqual({
      so_dong: 2,
      tong: 12.5,
    })
  })
})

describe('thieuTon', () => {
  it('quá tồn → phần thiếu; đủ → null; chưa tra được → null', () => {
    expect(thieuTon({ qty: 150, qty_ok: 120 })).toBe(30)
    expect(thieuTon({ qty: 120, qty_ok: 120 })).toBeNull()
    expect(thieuTon({ qty: 150, qty_ok: null })).toBeNull()
  })
})
