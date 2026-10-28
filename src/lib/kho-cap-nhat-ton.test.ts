import { describe, expect, it } from 'vitest'
import {
  catBu,
  cauChan,
  chenh,
  chiaBuMacDinh,
  conThieu,
  docSoThucTe,
  ghiChuDong,
  hoiLenh,
  kiemTruocGhi,
  laXuatBu,
  phanBu,
  taoDong,
  thanGui,
  themDongCapNhat,
  tomTat,
  tongBu,
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
  it('mặc định "tổ đã lấy", lệnh giữ nhiều đứng trước, máy chia sẵn', () => {
    const r = nhom()
    expect(r.lenh.map((l) => l.code)).toEqual(['09/26-27 - MX', '03/26-27 - ROSCO', '10/26-27 - MX']) // prettier-ignore
    expect(r).toMatchObject({ che_do: 'xuat_bu', bu_go: null, thuc_te: null })
    expect(chung().lenh).toEqual([])
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

  it('xuất bù mà mọi lệnh 0 → chặn; ghi thiếu thì không cần lệnh', () => {
    const r: DongCapNhat = { ...nhom(), thuc_te: 745, bu_go: { 'l-mx9': '0' } }
    expect(kiemTruocGhi(DAU, [r])[0].reason).toBe('thieu_lenh')
    expect(kiemTruocGhi(DAU, [{ ...r, che_do: 'thieu' }])).toEqual([])
  })

  it('tổ đã lấy nhiều hơn phần thiếu, hoặc gõ chữ lạ → chặn tại dòng', () => {
    const r: DongCapNhat = { ...nhom(), thuc_te: 745 }
    expect(kiemTruocGhi(DAU, [{ ...r, bu_go: { 'l-mx9': '5', 'l-roso3': '5' } }])[0]).toMatchObject({ reason: 'bu_vuot', message: 'dòng 1 tổ đã lấy 10, nhiều hơn phần thiếu 8' }) // prettier-ignore
    expect(kiemTruocGhi(DAU, [{ ...r, bu_go: { 'l-mx9': 'năm' } }])[0].reason).toBe('bu_sai') // prettier-ignore
    expect(kiemTruocGhi(DAU, [{ ...r, bu_go: { 'l-mx9': '5', 'l-roso3': '3' } }])).toEqual([]) // prettier-ignore
  })
})

/*
 * K6 (28/10/2026): phần hụt chia được cho NHIỀU lệnh. Máy chia sẵn — lệnh giữ
 * nhiều trước, mỗi lệnh tối đa phần nó giữ; phần dư là hàng chung → ghi thiếu.
 */
describe('chia phần hụt cho nhiều lệnh (K6)', () => {
  const lenh = [
    { lsx_id: 'a', code: 'A', chia: 30 },
    { lsx_id: 'b', code: 'B', chia: 40 },
  ]
  it('chiaBuMacDinh: lần lượt, mỗi lệnh tối đa phần nó giữ', () => {
    expect(chiaBuMacDinh(lenh, 20).map((p) => p.qty)).toEqual([20, 0])
    expect(chiaBuMacDinh(lenh, 53).map((p) => p.qty)).toEqual([30, 23])
    expect(chiaBuMacDinh(lenh, 90).map((p) => p.qty)).toEqual([30, 40])
  })

  it('hụt vượt phần của mọi lệnh: phần dư ghi thiếu; gõ tay thì theo số gõ', () => {
    // 100 trên máy: A giữ 30, B 40, chung 30. Đếm 10 → hụt 90.
    const r: DongCapNhat = { ...taoDong(vt('m'), 100, lenh), thuc_te: 10 }
    expect(r.lenh.map((l) => l.lsx_id)).toEqual(['b', 'a'])
    expect(phanBu(r).map((p) => [p.code, p.qty])).toEqual([['B', 40], ['A', 30]]) // prettier-ignore
    expect(conThieu(r)).toBe(20)
    expect(laXuatBu(r)).toBe(true)
    const tay: DongCapNhat = { ...r, bu_go: { a: '12,5', b: '' } }
    expect(phanBu(tay).map((p) => p.qty)).toEqual([0, 12.5])
    expect(tongBu(tay)).toBe(12.5)
    expect(conThieu(tay)).toBe(77.5)
    expect(conThieu({ ...r, che_do: 'thieu' })).toBe(90)
    expect(thanGui(DAU, [tay]).lines[0].xuat_bu).toEqual([{ lsx_id: 'a', qty: 12.5 }])
    expect(tomTat([r]).xuat_bu).toBe(1)
  })

  it('catBu (server): cắt theo phần hụt thật, gộp lệnh trùng, bỏ phần 0', () => {
    expect(catBu([{ lsx_id: 'a', qty: 30 }, { lsx_id: 'b', qty: 40 }], 50)).toEqual([{ lsx_id: 'a', qty: 30 }, { lsx_id: 'b', qty: 20 }]) // prettier-ignore
    expect(catBu([{ lsx_id: 'a', qty: Infinity }], 8)).toEqual([{ lsx_id: 'a', qty: 8 }])
    expect(catBu([{ lsx_id: 'a', qty: 5 }, { lsx_id: 'a', qty: 3 }, { lsx_id: 'b', qty: 0 }], 99)).toEqual([{ lsx_id: 'a', qty: 8 }]) // prettier-ignore
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
    // Hụt 8 nằm gọn trong phần 09-MX giữ (500) → cả 8 cho 09-MX.
    expect(g.lines.map((l) => l.xuat_bu)).toEqual([[{ lsx_id: 'l-mx9', qty: 8 }], [], [], []]) // prettier-ignore
    expect(g.lines[1]).toMatchObject({ ly_do: 'hang_cu', counted_qty: 300 })
    expect(g.lines[0].ly_do).toBeNull()
  })
})

describe('ghiChuDong', () => {
  it('nhãn lý do · ghi chú · lệnh xuất bù', () => {
    expect(
      ghiChuDong({ ly_do: 'giao_kho', xuat_bu: [{ code: '09/26-27 - MX', qty: 8 }] }),
    ).toBe(
      // prettier-ignore
      'Đếm lại khi giao kho · tổ đã lấy → xuất bù cho 09/26-27 - MX',
    )
    // Nhiều lệnh / còn phần ghi thiếu → ghi rõ số từng phần.
    expect(
      ghiChuDong({
        ly_do: 'giao_kho',
        xuat_bu: [
          { code: 'B', qty: 40 },
          { code: 'A', qty: 1250 },
        ],
        con_thieu: 20,
      }),
    ).toBe(
      // prettier-ignore
      'Đếm lại khi giao kho · tổ đã lấy → xuất bù 40 cho B, 1.250 cho A; 20 ghi thiếu',
    )
    expect(ghiChuDong({ ly_do: 'khac', ghi_chu: ' nhận lại ' })).toBe('Khác · nhận lại')
  })
})
