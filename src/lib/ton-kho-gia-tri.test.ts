import { describe, expect, it } from 'vitest'
import { giaTriTon, tongGiaTri, type MovementCost } from './ton-kho-gia-tri'

const nhap = (qty: number, unit_cost?: number | null): MovementCost => ({
  direction: 'in',
  qty,
  unit_cost,
})
const xuat = (qty: number): MovementCost => ({ direction: 'out', qty })

describe('giaTriTon — bình quân gia quyền', () => {
  it('một lần nhập: đơn giá đúng bằng giá lần đó', () => {
    const r = giaTriTon(100, [nhap(100, 1750)])
    expect(r.donGia).toBe(1750)
    expect(r.giaTri).toBe(175_000)
    expect(r.phuGia).toBe(1)
  })

  it('hai lần nhập khác giá: bình quân theo SỐ LƯỢNG, không phải trung bình cộng', () => {
    // 100 × 10 + 900 × 20 = 19.000 / 1.000 = 19 — không phải (10+20)/2 = 15.
    const r = giaTriTon(1000, [nhap(100, 10), nhap(900, 20)])
    expect(r.donGia).toBe(19)
    expect(r.giaTri).toBe(19_000)
  })

  it('XUẤT KHÔNG ĐỤNG vào bình quân — giá là của hàng đã mua', () => {
    const a = giaTriTon(400, [nhap(1000, 50)])
    const b = giaTriTon(400, [nhap(1000, 50), xuat(600)])
    expect(b.donGia).toBe(a.donGia)
    expect(b.giaTri).toBe(400 * 50)
  })

  it('giá trị đi theo TỒN THẬT, không theo số đã nhập', () => {
    // Nhập 1.000, còn 250 → giá trị là của 250.
    const r = giaTriTon(250, [nhap(1000, 80)])
    expect(r.giaTri).toBe(20_000)
  })
})

describe('giaTriTon — chưa biết giá KHÁC giá 0', () => {
  it('không lần nhập nào có giá → null, KHÔNG phải 0', () => {
    // Ghi "0 đồng" là nói kho đang giữ 2.400 cái không đáng tiền.
    const r = giaTriTon(2400, [nhap(2400)])
    expect(r.donGia).toBeNull()
    expect(r.giaTri).toBeNull()
    expect(r.phuGia).toBe(0)
  })

  it('NHẬP KHÔNG GIÁ bị bỏ qua, không kéo bình quân xuống', () => {
    // Kiểm kê / hoàn kho từ xưởng không mang giá. Tính chúng là 0 thì đơn giá
    // rơi từ 100 xuống 50 — tồn đọc ra rẻ hơn thực một nửa.
    const r = giaTriTon(200, [nhap(100, 100), nhap(100, null)])
    expect(r.donGia).toBe(100)
    expect(r.phuGia).toBe(0.5)
  })

  it('giá 0 khai TƯỜNG MINH vẫn tính — hàng cho, hàng mẫu', () => {
    const r = giaTriTon(200, [nhap(100, 100), nhap(100, 0)])
    expect(r.donGia).toBe(50)
    expect(r.phuGia).toBe(1)
  })

  it('không có chuyển động nào thì null, không vỡ', () => {
    expect(giaTriTon(0, [])).toEqual({ donGia: null, giaTri: null, phuGia: 0 })
  })

  it('dòng nhập số lượng 0 hoặc âm không làm lệch bình quân', () => {
    const r = giaTriTon(100, [nhap(100, 30), nhap(0, 9999), nhap(-5, 9999)])
    expect(r.donGia).toBe(30)
  })
})

describe('tongGiaTri — tổng của cả kho', () => {
  it('cộng phần tính được và ĐẾM phần chưa tính được', () => {
    const r = tongGiaTri([{ giaTri: 1000 }, { giaTri: null }, { giaTri: 250 }])
    expect(r.tong).toBe(1250)
    expect(r.thieu).toBe(1)
  })

  it('mọi mã đều thiếu giá thì tổng 0 nhưng thiếu = số mã — màn phải nói ra', () => {
    const r = tongGiaTri([{ giaTri: null }, { giaTri: null }])
    expect(r).toEqual({ tong: 0, thieu: 2 })
  })

  it('danh sách rỗng', () => {
    expect(tongGiaTri([])).toEqual({ tong: 0, thieu: 0 })
  })
})
