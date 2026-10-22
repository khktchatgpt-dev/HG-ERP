import { describe, expect, it } from 'vitest'
import { chenhGia, goiYNcc, tenNganNcc, type DongLichSu } from './goi-y-ncc'

const ls = (p: Partial<DongLichSu>): DongLichSu => ({
  material_id: 'm1',
  supplier_id: 's1',
  supplier_name: 'NCC 1',
  po_code: 'PO-1',
  at: '2026-09-01',
  qty: 10,
  amount: 1000,
  kg: null,
  quyCach: null,
  dv: 'Cái',
  ...p,
})

describe('goiYNcc — thứ tự gợi ý Q3', () => {
  it('1) NCC mua chính mã này lần GẦN NHẤT đứng đầu, giá = thành tiền ÷ SL', () => {
    const r = goiYNcc(
      { material_id: 'm1', quyCach: null, kgMoiDv: null, unit: 'Cái' },
      [
        ls({ supplier_id: 'a', supplier_name: 'A', at: '2026-09-01', amount: 1000 }),
        ls({ supplier_id: 'b', supplier_name: 'B', at: '2026-10-03', amount: 1200 }),
        ls({ supplier_id: 'a', supplier_name: 'A', at: '2026-08-01', amount: 900 }),
      ],
      [],
    )
    expect(r.map((u) => u.supplier_name)).toEqual(['B', 'A'])
    expect(r[0]).toMatchObject({ nguon: 'ma', giaDv: 120, po_code: 'PO-1' })
    expect(r[1].soLan).toBe(2)
  })

  it('2) chưa mua mã này → NCC rẻ nhất cùng quy cách theo đ/kg, đổi ra đ/cây khi biết kg/cây', () => {
    const r = goiYNcc(
      { material_id: 'nh-moi', quyCach: 'Nhôm|vuông20', kgMoiDv: 2, unit: 'Cái' },
      [
        ls({ material_id: 'x', supplier_id: 'dg', supplier_name: 'Đoàn Gia', amount: 113000, kg: 1, quyCach: 'Nhôm|vuông20' }), // prettier-ignore
        ls({ material_id: 'y', supplier_id: 'qm', supplier_name: 'Quang Minh', amount: 108000, kg: 1, quyCach: 'Nhôm|vuông20' }), // prettier-ignore
        ls({ material_id: 'z', supplier_id: 'kp', supplier_name: 'Khác', amount: 50000, kg: null, quyCach: 'Nhôm|vuông20' }), // prettier-ignore
      ],
      [],
    )
    expect(r.map((u) => u.supplier_name)).toEqual(['Quang Minh', 'Đoàn Gia'])
    expect(r[0]).toMatchObject({ nguon: 'quy_cach', giaKg: 108000, giaDv: 216000 })
  })

  it('3) không có giá nào → NCC bán nhiều nhất cùng nhóm, giá trống, tối đa 3', () => {
    const r = goiYNcc(
      { material_id: 'vit', quyCach: null, kgMoiDv: null, unit: 'Cái' },
      [],
      [
        { supplier_id: 'tp', supplier_name: 'Tân Phát', soLan: 4 },
        { supplier_id: 'tn', supplier_name: 'Tường Nguyên', soLan: 8 },
        { supplier_id: 'pp', supplier_name: 'Phú Phương', soLan: 3 },
        { supplier_id: 'mt', supplier_name: 'Minh Thắng', soLan: 3 },
      ],
    )
    expect(r.map((u) => u.supplier_name)).toEqual([
      'Tường Nguyên',
      'Tân Phát',
      'Phú Phương',
    ])
    expect(r[0]).toMatchObject({ nguon: 'nhom', giaDv: null, giaKg: null })
  })

  it('một NCC không lặp lại ở nguồn sau', () => {
    const r = goiYNcc({ material_id: 'm1', quyCach: null, kgMoiDv: null, unit: 'Cái' }, [ls({ supplier_id: 'tn', supplier_name: 'TN' })], [
      { supplier_id: 'tn', supplier_name: 'TN', soLan: 9 },
      { supplier_id: 'tp', supplier_name: 'TP', soLan: 2 },
    ]) // prettier-ignore
    expect(r.map((u) => `${u.supplier_name}:${u.nguon}`)).toEqual(['TN:ma', 'TP:nhom'])
  })
})

describe('chenhGia', () => {
  it('so đ/kg khi cả hai có, không thì đ/ĐVT, thiếu thì null', () => {
    const a = { giaDv: 100, giaKg: 108000 }
    expect(chenhGia(a, { giaDv: 90, giaKg: 113000 } as never)).toBeCloseTo(
      113000 / 108000 - 1,
    )
    expect(chenhGia({ giaDv: 100, giaKg: null }, { giaDv: 120, giaKg: null } as never)).toBeCloseTo(0.2) // prettier-ignore
    expect(chenhGia({ giaDv: null, giaKg: null }, { giaDv: 120, giaKg: null } as never)).toBeNull() // prettier-ignore
  })
})

describe('đơn vị của giá đi theo dòng đơn', () => {
  it('lần trước mua theo Kg thì giá là đ/Kg, không phải đ/Cái', () => {
    const r = goiYNcc(
      { material_id: 'lds', quyCach: null, kgMoiDv: null, unit: 'Con' },
      [ls({ material_id: 'lds', qty: 2, amount: 80000, dv: 'Kg' })],
      [],
    )
    expect(r[0]).toMatchObject({ giaDv: 40000, dvGia: 'Kg' })
  })
})

describe('tenNganNcc', () => {
  it('bỏ phần loại hình công ty, giữ tên riêng', () => {
    expect(tenNganNcc('CÔNG TY TNHH SX & TM TƯỜNG NGUYÊN')).toBe('TƯỜNG NGUYÊN')
    expect(tenNganNcc('CÔNG TY TNHH DV & TM TÂN PHÁT')).toBe('TÂN PHÁT')
    expect(tenNganNcc('Doanh Nghiệp Tư Nhân PQ')).toBe('PQ')
    expect(tenNganNcc('Công Ty TNHH Nhôm Đoàn Gia')).toBe('Nhôm Đoàn Gia')
    expect(tenNganNcc('CÔNG TY CỔ PHẦN THÉP ASIA')).toBe('THÉP ASIA')
    expect(tenNganNcc('CÔNG TY TNHH TM -DV -TH MINH THẮNG')).toBe('MINH THẮNG')
  })
})
