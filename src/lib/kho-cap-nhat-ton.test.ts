import { describe, expect, it } from 'vitest'
import {
  cauChan,
  chenh,
  docSoThucTe,
  ghiChuDong,
  hoiLenh,
  kiemTruocGhi,
  laXuatBu,
  taoDong,
  thanGui,
  themDongCapNhat,
  tomTat,
  type DauCapNhat,
  type DongCapNhat,
} from './kho-cap-nhat-ton'

const DAU: DauCapNhat = { ly_do_chung: 'giao_kho', ghi_chu: '' }
const vt = (id: string, code = id) => ({ id, code, name: `Vật tư ${code}`, unit: 'Cây' })

/** Dữ liệu thật 27/10: NH-0513 753 cây, của 3 lệnh; NH-0606 290 cây tồn chung. */
const nhom = () =>
  taoDong(vt('m-513', 'NH-0513'), 753, [
    { lsx_id: 'l-roso3', code: '03/26-27 - ROSCO', chia: 200 },
    { lsx_id: 'l-mx9', code: '09/26-27 - MX', chia: 500 },
    { lsx_id: 'l-mx10', code: '10/26-27 - MX', chia: 53 },
  ])
const chung = () => taoDong(vt('m-606', 'NH-0606'), 290, [])

describe('docSoThucTe', () => {
  it('số kiểu VN; trống = null; chữ lạ = NaN', () => {
    expect(docSoThucTe('1.250')).toBe(1250)
    expect(docSoThucTe('12,5')).toBe(12.5)
    expect(docSoThucTe('0')).toBe(0)
    expect(docSoThucTe('  ')).toBeNull()
    expect(docSoThucTe('abc')).toBeNaN()
  })
})

describe('taoDong / themDongCapNhat', () => {
  it('mặc định "tổ đã lấy" cho lệnh có phần lớn nhất', () => {
    const r = nhom()
    expect(r.lenh[0].code).toBe('09/26-27 - MX')
    expect(r).toMatchObject({ che_do: 'xuat_bu', xuat_bu_lsx: 'l-mx9', thuc_te: null })
    expect(chung().xuat_bu_lsx).toBeNull()
  })

  it('một mã một dòng', () => {
    const a = themDongCapNhat([], nhom())
    const b = themDongCapNhat(a.rows, nhom())
    expect(b).toMatchObject({ trung: true, index: 0 })
    expect(b.rows).toHaveLength(1)
  })
})

describe('chênh, hỏi lệnh, xuất bù', () => {
  it('giảm hàng của lệnh → hỏi; mặc định xuất bù', () => {
    const r: DongCapNhat = { ...nhom(), thuc_te: 745 }
    expect(chenh(r)).toBe(-8)
    expect(hoiLenh(r)).toBe(true)
    expect(laXuatBu(r)).toBe(true)
    expect(laXuatBu({ ...r, che_do: 'thieu' })).toBe(false)
  })

  it('tăng, khớp, tồn chung không hỏi lệnh', () => {
    expect(hoiLenh({ ...nhom(), thuc_te: 760 })).toBe(false)
    expect(hoiLenh({ ...nhom(), thuc_te: 753 })).toBe(false)
    expect(hoiLenh({ ...chung(), thuc_te: 280 })).toBe(false)
  })

  it('chưa gõ / gõ sai → chênh null', () => {
    expect(chenh(nhom())).toBeNull()
    expect(chenh({ ...nhom(), thuc_te: Number.NaN })).toBeNull()
  })
})

describe('kiemTruocGhi', () => {
  it('rỗng → nói gõ mã ở đâu', () => {
    expect(kiemTruocGhi(DAU, [])[0]).toMatchObject({ i: -1, reason: 'rong' })
  })

  it('chưa gõ KHÔNG coi là 0; số âm; chữ lạ; mọi lỗi đều trả về', () => {
    const loi = kiemTruocGhi(DAU, [
      nhom(),
      { ...chung(), thuc_te: -2 },
      { ...chung(), material_id: 'x', thuc_te: Number.NaN },
    ])
    expect(loi.map((l) => [l.i, l.reason])).toEqual([
      [0, 'chua_go'],
      [1, 'so_am'],
      [2, 'so_sai'],
    ])
    expect(cauChan(loi)).toBe('Dòng 1 chưa gõ số thực tế (và 2 chỗ nữa)')
  })

  it('"Khác" bắt ghi chú — ghi chú dòng hoặc ghi chú chung đều được', () => {
    const r: DongCapNhat = { ...chung(), thuc_te: 300, ly_do: 'khac' }
    expect(kiemTruocGhi(DAU, [r])[0].reason).toBe('thieu_ghi_chu')
    expect(kiemTruocGhi(DAU, [{ ...r, ghi_chu: 'nhận lại từ xưởng' }])).toEqual([])
    expect(kiemTruocGhi({ ...DAU, ghi_chu: 'đếm cùng chị Nữ' }, [r])).toEqual([])
    expect(kiemTruocGhi({ ly_do_chung: 'khac', ghi_chu: '' }, [{ ...r, ly_do: '' }])[0].reason).toBe('thieu_ghi_chu') // prettier-ignore
  })

  it('xuất bù mà chưa chọn lệnh → chặn; ghi thiếu thì không cần lệnh', () => {
    const r: DongCapNhat = { ...nhom(), thuc_te: 745, xuat_bu_lsx: null }
    expect(kiemTruocGhi(DAU, [r])[0].reason).toBe('thieu_lenh')
    expect(kiemTruocGhi(DAU, [{ ...r, che_do: 'thieu' }])).toEqual([])
  })
})

describe('tomTat + thanGui', () => {
  const rows: DongCapNhat[] = [
    { ...nhom(), thuc_te: 745 },
    { ...chung(), thuc_te: 300, ly_do: 'hang_cu' },
    { ...taoDong(vt('m-29', 'BUL0029'), 44890, []), thuc_te: 44890 },
    { ...taoDong(vt('m-1234', 'SAT1234'), 13, []), thuc_te: 11 },
    taoDong(vt('m-220', 'ST-0220'), 10, []),
  ]

  it('đếm khớp / thừa / thiếu / xuất bù / chưa gõ', () => {
    expect(tomTat(rows)).toEqual({ dong: 5, khop: 1, thua: 1, thieu: 1, xuat_bu: 1, chua_go: 1 }) // prettier-ignore
  })

  it('chỉ dòng xuất bù mang lệnh; lý do trống = theo lý do chung', () => {
    const g = thanGui({ ly_do_chung: 'giao_kho', ghi_chu: ' ' }, rows.slice(0, 4))
    expect(g.ghi_chu).toBeNull()
    expect(g.lines.map((l) => l.xuat_bu_lsx_id)).toEqual(['l-mx9', null, null, null])
    expect(g.lines[1]).toMatchObject({ ly_do: 'hang_cu', counted_qty: 300 })
    expect(g.lines[0].ly_do).toBeNull()
  })
})

describe('ghiChuDong', () => {
  it('nhãn lý do · ghi chú · lệnh xuất bù', () => {
    expect(ghiChuDong({ ly_do: 'giao_kho', xuat_bu_code: '09/26-27 - MX' })).toBe(
      'Đếm lại khi giao kho · tổ đã lấy → xuất bù cho 09/26-27 - MX',
    )
    expect(ghiChuDong({ ly_do: 'khac', ghi_chu: ' nhận lại ' })).toBe('Khác · nhận lại')
  })
})
