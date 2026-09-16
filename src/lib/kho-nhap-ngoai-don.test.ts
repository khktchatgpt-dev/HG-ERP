import { describe, expect, it } from 'vitest'
import {
  LY_DO_NGOAI_DON,
  donMoCuaNcc,
  kiemTruocGhiSoNgoai,
  themDongNhan,
  timLyDoNgoaiDon,
  tinhTongNhan,
  type DauPhieuNgoai,
  type DongNhanNgoai,
} from './kho-nhap-ngoai-don'

const vt = (n: number) => ({
  id: `m${n}`,
  code: `VT-000${n}`,
  name: `Vật tư ${n}`,
  unit: 'cái',
})

const dong = (n: number, p: Partial<DongNhanNgoai> = {}): DongNhanNgoai => ({
  ...vt(n),
  ton: 0,
  qty: 10,
  tinh_trang: 'ok',
  bin_id: '',
  note: '',
  ...p,
})

const head: DauPhieuNgoai = {
  nguoi_giao: 'Vạn Vi Thành',
  ly_do: 'mua_le',
  supplier_doc_no: '',
  doc_date: '2026-09-16',
  note: '',
}

describe('LY_DO_NGOAI_DON', () => {
  it('có đúng bốn lựa chọn, mã không trùng', () => {
    expect(LY_DO_NGOAI_DON).toHaveLength(4)
    expect(new Set(LY_DO_NGOAI_DON.map((x) => x.ma)).size).toBe(4)
  })

  it('mỗi lựa chọn nói được HỆ QUẢ, không chỉ có nhãn', () => {
    for (const x of LY_DO_NGOAI_DON) expect(x.heQua.length).toBeGreaterThan(25)
  })

  it('chỉ "Khác" bắt ghi chú', () => {
    expect(LY_DO_NGOAI_DON.filter((x) => x.batGhiChu).map((x) => x.ma)).toEqual(['khac'])
  })

  it('mã lạ trả null chứ không ném', () => {
    expect(timLyDoNgoaiDon('khong-co')).toBeNull()
  })
})

describe('themDongNhan', () => {
  it('thêm mã mới vào cuối lưới, mặc định đạt và số 0', () => {
    const r = themDongNhan([], vt(1), 824)
    expect(r.trung).toBe(false)
    expect(r.index).toBe(0)
    expect(r.rows[0]).toMatchObject({ qty: 0, tinh_trang: 'ok', ton: 824 })
  })

  it('MỘT MÃ MỘT DÒNG — chọn lại trả về dòng cũ, không đẻ dòng thứ hai', () => {
    const base = [dong(1), dong(2)]
    const r = themDongNhan(base, vt(1), 5)
    expect(r.trung).toBe(true)
    expect(r.index).toBe(0)
    expect(r.rows).toHaveLength(2)
    expect(r.rows).toBe(base)
  })

  it('tồn chưa tra được thì giữ null, không hoá 0', () => {
    const r = themDongNhan([], vt(3), null)
    expect(r.rows[0].ton).toBeNull()
  })
})

describe('tinhTongNhan', () => {
  it('tách dùng được và vào khoá', () => {
    const t = tinhTongNhan([
      dong(1, { qty: 500 }),
      dong(2, { qty: 200, tinh_trang: 'blocked', note: 'lệch màu' }),
      dong(3, { qty: 25 }),
    ])
    expect(t).toEqual({ so_dong: 3, tong: 725, dung_duoc: 525, vao_khoa: 200 })
  })

  it('dòng số 0 không tính là dòng', () => {
    expect(tinhTongNhan([dong(1, { qty: 0 }), dong(2, { qty: 4 })])).toEqual({
      so_dong: 1,
      tong: 4,
      dung_duoc: 4,
      vao_khoa: 0,
    })
  })

  it('lưới rỗng ra số 0 chứ không NaN', () => {
    expect(tinhTongNhan([])).toEqual({ so_dong: 0, tong: 0, dung_duoc: 0, vao_khoa: 0 })
  })
})

describe('kiemTruocGhiSoNgoai', () => {
  it('đủ thì cho ghi sổ', () => {
    expect(kiemTruocGhiSoNgoai(head, [dong(1)])).toEqual({ ok: true })
  })

  it('thiếu người giao chặn trước tiên', () => {
    const r = kiemTruocGhiSoNgoai({ ...head, nguoi_giao: '  ' }, [dong(1)])
    expect(r).toMatchObject({
      ok: false,
      reason: 'thieu_nguoi_giao',
      focus: 'nguoi_giao',
    })
  })

  it('chưa chọn vì sao không có đơn thì chặn', () => {
    const r = kiemTruocGhiSoNgoai({ ...head, ly_do: '' }, [dong(1)])
    expect(r).toMatchObject({ ok: false, reason: 'thieu_ly_do', focus: 'ly_do' })
  })

  it('lý do "Khác" mà ghi chú trống thì chặn, và nói tên lý do', () => {
    const r = kiemTruocGhiSoNgoai({ ...head, ly_do: 'khac' }, [dong(1)])
    expect(r).toMatchObject({ ok: false, reason: 'thieu_ghi_chu', focus: 'ghi_chu' })
    if (!r.ok) expect(r.message).toContain('Khác')
  })

  it('lý do "Khác" có ghi chú thì qua', () => {
    const r = kiemTruocGhiSoNgoai(
      { ...head, ly_do: 'khac', note: 'hàng thu hồi từ kho cũ' },
      [dong(1)],
    )
    expect(r.ok).toBe(true)
  })

  it('lưới rỗng nói chỗ thêm dòng', () => {
    const r = kiemTruocGhiSoNgoai(head, [])
    expect(r).toMatchObject({ ok: false, reason: 'khong_dong', focus: -1 })
    if (!r.ok) expect(r.message).toMatch(/ô cuối lưới/)
  })

  it('có dòng nhưng chưa dòng nào có số', () => {
    const r = kiemTruocGhiSoNgoai(head, [dong(1, { qty: 0 })])
    expect(r).toMatchObject({ ok: false, reason: 'khong_dong', focus: 0 })
  })

  it('số âm hoặc NaN chặn và chỉ đúng dòng', () => {
    const r = kiemTruocGhiSoNgoai(head, [dong(1), dong(2, { qty: Number.NaN })])
    expect(r).toMatchObject({ ok: false, reason: 'so_khong_hop_le', focus: 1 })
    if (!r.ok) expect(r.message).toContain('VT-0002')
  })

  it('dòng khoá thiếu lý do chặn và chỉ đúng dòng', () => {
    const r = kiemTruocGhiSoNgoai(head, [
      dong(1),
      dong(2, { tinh_trang: 'blocked', note: '   ' }),
    ])
    expect(r).toMatchObject({ ok: false, reason: 'khoa_thieu_ly_do', focus: 1 })
  })

  it('dòng khoá số 0 không bị đòi lý do — nó không vào sổ', () => {
    const r = kiemTruocGhiSoNgoai(head, [
      dong(1),
      dong(2, { qty: 0, tinh_trang: 'blocked' }),
    ])
    expect(r.ok).toBe(true)
  })
})

describe('donMoCuaNcc', () => {
  const pos = [
    { code: 'PO-2026-0044', supplier_name: 'Vạn Vi Thành' },
    { code: 'PO-2026-0051', supplier_name: '  vạn vi  thành ' },
    { code: 'PO-2026-0060', supplier_name: 'Thép Hoà Phát' },
  ]

  it('khớp bỏ hoa thường và gọn khoảng trắng', () => {
    expect(donMoCuaNcc('Vạn Vi Thành', pos).map((p) => p.code)).toEqual([
      'PO-2026-0044',
      'PO-2026-0051',
    ])
  })

  it('người giao trống thì không cảnh báo', () => {
    expect(donMoCuaNcc('   ', pos)).toEqual([])
  })

  it('KHÔNG so gần đúng — cảnh báo nhầm NCC thì người dùng học cách bỏ qua', () => {
    expect(donMoCuaNcc('Vạn Vi', pos)).toEqual([])
    expect(donMoCuaNcc('Thép Hoà Phát Miền Nam', pos)).toEqual([])
  })
})
