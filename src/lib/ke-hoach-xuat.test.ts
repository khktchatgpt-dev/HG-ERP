import { describe, expect, it } from 'vitest'
import {
  cong,
  dayThang,
  dungDotXuat,
  gomTheoLenh,
  kiemKeHoach,
  maTran,
  tinhTrang,
  type DotXuat,
  type RawLsx,
} from './ke-hoach-xuat'

const LSX = (p: Partial<RawLsx> = {}): RawLsx => ({
  id: 'L1',
  code: '01/26-27 - LAURA',
  status: 'approved',
  customer: 'LAURA',
  ship_date: '2027-03-24',
  container_summary: null,
  materials_due_at: null,
  materials_received_at: null,
  ...p,
})

describe('dungDotXuat — mỗi nhóm lệnh một đợt, trị giá khớp đơn bán', () => {
  const base = {
    lsx: [LSX()],
    don: [
      { id: 'O1', code: 'DH-1', production_order_id: 'L1' },
      { id: 'O2', code: 'DH-2', production_order_id: 'L1' },
    ],
    dongDon: [
      { id: 'a', order_id: 'O1', product_id: 'P1', qty: 10, unit_price: 50 },
      { id: 'b', order_id: 'O2', product_id: 'P2', qty: 4, unit_price: 100 },
    ],
    donMua: [
      { production_order_id: 'L1', status: 'received' },
      { production_order_id: 'L1', status: 'confirmed' },
      { production_order_id: 'L1', status: 'cancelled' },
    ],
  }
  it('nhóm gắn đơn → tổng đơn; nhóm không gắn → SL × giá cùng SP; Σ khớp Σ đơn', () => {
    const d = dungDotXuat({
      ...base,
      nhom: [
        { id: 'G1', production_order_id: 'L1', sales_order_id: 'O1', po_no: 'PO-A', title: null, ship_date: '2026-12-30', ship_label: null, sort_order: 1 }, // prettier-ignore
        { id: 'G2', production_order_id: 'L1', sales_order_id: null, po_no: 'PO-B', title: null, ship_date: '2027-01-13', ship_label: null, sort_order: 2 }, // prettier-ignore
      ],
      dongLenh: [
        { production_order_id: 'L1', group_id: 'G1', qty: 10, product_id: 'P1', sales_order_line_id: null }, // prettier-ignore
        { production_order_id: 'L1', group_id: 'G2', qty: 4, product_id: 'P2', sales_order_line_id: null }, // prettier-ignore
      ],
    })
    expect(d.map((x) => [x.label, x.value, x.value_src, x.ship_date])).toEqual([
      ['PO-A', 500, 'don', '2026-12-30'],
      ['PO-B', 400, 'gia-dong', '2027-01-13'],
    ])
    expect(cong(d).value).toBe(900) // = Σ đơn bán của lệnh
    // Vật tư: bỏ đơn huỷ, đếm đơn chưa về đủ.
    expect(d[0].vt).toMatchObject({ po_total: 2, po_open: 1 })
  })
  it('nhóm trống ngày mượn ngày cuối của lệnh và nói ra điều đó', () => {
    const d = dungDotXuat({
      ...base,
      nhom: [{ id: 'G1', production_order_id: 'L1', sales_order_id: null, po_no: null, title: 'Đợt 1', ship_date: null, ship_label: null, sort_order: 1 }], // prettier-ignore
      dongLenh: [],
    })
    // Lệnh một nhóm → trị giá cả lệnh.
    expect(d[0]).toMatchObject({ label: 'Đợt 1', date_src: 'lenh', ship_date: '2027-03-24', value: 900 }) // prettier-ignore
  })
  it('không dòng nào có giá → trị giá null, không giả 0', () => {
    const d = dungDotXuat({
      ...base,
      dongDon: [],
      nhom: [
        { id: 'G1', production_order_id: 'L1', sales_order_id: null, po_no: 'X', title: null, ship_date: '2027-01-01', ship_label: null, sort_order: 1 }, // prettier-ignore
        { id: 'G2', production_order_id: 'L1', sales_order_id: null, po_no: 'Y', title: null, ship_date: '2027-02-01', ship_label: null, sort_order: 2 }, // prettier-ignore
      ],
      dongLenh: [{ production_order_id: 'L1', group_id: 'G1', qty: 5, product_id: 'P9', sales_order_line_id: null }], // prettier-ignore
    })
    expect(d[0]).toMatchObject({ value: null, value_src: null })
  })
})

const D = (p: Partial<DotXuat>): DotXuat => ({
  id: Math.random().toString(36),
  lsx_id: 'L1',
  lsx_code: 'L',
  lsx_status: 'approved',
  customer: 'ROSCO',
  label: 'PO',
  ship_label: null,
  ship_date: '2026-11-10',
  date_src: 'nhom',
  order_code: null,
  qty: 1,
  value: 100,
  value_src: 'don',
  cont: null,
  vt: { po_total: 1, po_open: 1, po_chua_gui: 0, due: null, da_nhan: false },
  ...p,
})

describe('tinhTrang — rổ "Cần để ý" và nhãn', () => {
  const today = '2026-10-06'
  it('xuất trong 45 ngày mà đơn mua chưa về đủ → cần để ý', () => {
    expect(tinhTrang(D({}), today)).toMatchObject({
      tone: 'warn',
      canDeY: true,
      conNgay: 35,
    })
  })
  it('vật tư đủ, hoặc còn xa hơn 45 ngày → bình thường', () => {
    expect(tinhTrang(D({ vt: { po_total: 1, po_open: 0, po_chua_gui: 0, due: null, da_nhan: true } }), today).canDeY).toBe(false) // prettier-ignore
    expect(tinhTrang(D({ ship_date: '2026-12-31' }), today).canDeY).toBe(false)
  })
  it('quá ngày xuất mà lệnh chưa xong → đỏ; lệnh xong thì không báo', () => {
    expect(tinhTrang(D({ ship_date: '2026-10-01' }), today)).toMatchObject({ tone: 'stop', canDeY: true }) // prettier-ignore
    expect(tinhTrang(D({ ship_date: '2026-10-01', lsx_status: 'completed' }), today).canDeY).toBe(false) // prettier-ignore
  })
})

describe('dayThang + maTran', () => {
  it('tháng liên tục, không hở tháng trống; đếm đợt mượn ngày', () => {
    const ds = [
      D({ ship_date: '2026-11-10' }),
      D({ ship_date: '2027-01-05', date_src: 'lenh' }),
    ]
    expect(dayThang(ds)).toEqual(['2026-11', '2026-12', '2027-01'])
    const m = maTran(ds)
    expect(m[0].tong).toEqual({ value: 200, n: 2, muon: 1 })
    expect(m[0].theoThang['2027-01']).toEqual({ value: 100, n: 1, muon: 1 })
  })
})

describe('gomTheoLenh — kế hoạch xuất của một lệnh: đợt (PO) × SP', () => {
  const base = {
    lsx: [LSX({ id: 'L1', ship_date: '2027-03-17' })],
    don: [{ id: 'O1', code: 'DH-1', production_order_id: 'L1' }],
    dongDon: [
      { id: 'a', order_id: 'O1', product_id: 'P1', qty: 84, unit_price: 10 },
      { id: 'b', order_id: 'O1', product_id: 'P2', qty: 42, unit_price: 20 },
    ],
    donMua: [],
  }
  it('cột = SP của lệnh; mỗi đợt có SL theo cột; tổng cột = SL lệnh', () => {
    const r = gomTheoLenh({
      ...base,
      nhom: [
        { id: 'G2', production_order_id: 'L1', sales_order_id: null, po_no: '29416', title: null, ship_date: '2026-10-17', ship_label: null, sort_order: 2 }, // prettier-ignore
        { id: 'G1', production_order_id: 'L1', sales_order_id: null, po_no: '29415', title: null, ship_date: '2026-10-17', ship_label: null, sort_order: 1 }, // prettier-ignore
      ],
      dongLenh: [
        { production_order_id: 'L1', group_id: 'G1', qty: 42, product_id: 'P1', sales_order_line_id: null, product_code: 'BN0229HG-IR', name_vi: 'Băng 1' }, // prettier-ignore
        { production_order_id: 'L1', group_id: 'G1', qty: 21, product_id: 'P2', sales_order_line_id: null, product_code: 'TB0286HG-IR', name_vi: 'Bàn tròn' }, // prettier-ignore
        { production_order_id: 'L1', group_id: 'G2', qty: 42, product_id: 'P1', sales_order_line_id: null, product_code: 'BN0229HG-IR ', name_vi: 'Băng 1' }, // prettier-ignore
        { production_order_id: 'L1', group_id: 'G2', qty: 21, product_id: 'P2', sales_order_line_id: null, product_code: 'TB0286HG-IR', name_vi: 'Bàn tròn' }, // prettier-ignore
      ],
    })[0]
    expect(r.sps.map((s) => [s.code, s.qty])).toEqual([
      ['BN0229HG-IR', 84],
      ['TB0286HG-IR', 42],
    ])
    // Cùng ngày thì xếp theo PO; mỗi đợt có SL riêng từng cột.
    expect(
      r.dots.map((d) => [d.label, d.sl['BN0229HG-IR'], d.sl['TB0286HG-IR']]),
    ).toEqual([
      ['29415', 42, 21],
      ['29416', 42, 21],
    ])
    expect(r).toMatchObject({ chua_chia: false, muon: 0 })
  })
  it('lệnh một nhóm chưa có ngày riêng = CHƯA CHIA theo PO khách', () => {
    const r = gomTheoLenh({
      ...base,
      nhom: [{ id: 'G1', production_order_id: 'L1', sales_order_id: null, po_no: null, title: 'ROSCO', ship_date: null, ship_label: null, sort_order: 1 }], // prettier-ignore
      dongLenh: [{ production_order_id: 'L1', group_id: 'G1', qty: 84, product_id: 'P1', sales_order_line_id: null, product_code: 'BN0229HG-IR' }], // prettier-ignore
    })[0]
    expect(r).toMatchObject({ chua_chia: true, muon: 1 })
    expect(r.dots[0].ship_date).toBe('2027-03-17')
  })
})

describe('đợt Sale (0222) — thay nhóm lệnh khi lệnh đã có kế hoạch', () => {
  const base = {
    lsx: [LSX({ id: 'L1', ship_date: '2027-03-17' })],
    don: [{ id: 'O1', code: 'DH-1', production_order_id: 'L1' }],
    dongDon: [
      { id: 'a', order_id: 'O1', product_id: 'P1', qty: 168, unit_price: 100 },
      { id: 'b', order_id: 'O1', product_id: 'P2', qty: 84, unit_price: 50 },
    ],
    donMua: [],
    nhom: [{ id: 'G1', production_order_id: 'L1', sales_order_id: null, po_no: null, title: 'ROSCO', ship_date: null, ship_label: null, sort_order: 1 }], // prettier-ignore
    dongLenh: [
      { production_order_id: 'L1', group_id: 'G1', qty: 168, product_id: 'P1', sales_order_line_id: null, product_code: '2723874' }, // prettier-ignore
      { production_order_id: 'L1', group_id: 'G1', qty: 84, product_id: 'P2', sales_order_line_id: null, product_code: '2723875' }, // prettier-ignore
    ],
  }
  const lots = [
    { id: 'S1', production_order_id: 'L1', seq: 1, po_no: 'HCXD73295828', po_ref: '29415', order_no: '2', ship_date: '2026-10-17', note: null, lines: [{ product_key: '2723874', qty: 42 }, { product_key: '2723875', qty: 84 }] }, // prettier-ignore
    { id: 'S2', production_order_id: 'L1', seq: 2, po_no: 'IRXD73295859', po_ref: '29416', order_no: '3', ship_date: null, note: null, lines: [{ product_key: '2723874', qty: 42 }] }, // prettier-ignore
  ]
  it('đợt lấy từ kế hoạch Sale: tên PO, ngày, SL, trị giá theo giá cùng SP', () => {
    const d = dungDotXuat({ ...base, lots })
    expect(
      d.map((x) => [x.label, x.ship_date, x.date_src, x.qty, x.value, x.nguon]),
    ).toEqual([
      ['29415 · HCXD73295828', '2026-10-17', 'nhom', 126, 42 * 100 + 84 * 50, 'sale'],
      ['29416 · IRXD73295859', '2027-03-17', 'lenh', 42, 4200, 'sale'],
    ])
    expect(d[0].order_code).toBe('#2')
  })
  it('lệnh có kế hoạch Sale thì KHÔNG còn "chưa chia", và mang theo kế hoạch để sửa', () => {
    const l = gomTheoLenh({ ...base, lots })[0]
    expect(l).toMatchObject({ chua_chia: false, muon: 1 })
    expect(l.ke_hoach).toHaveLength(2)
    expect(l.dots[0].sl).toEqual({ '2723874': 42, '2723875': 84 })
    // Không có kế hoạch Sale → quay về nhóm lệnh như cũ.
    expect(gomTheoLenh(base)[0]).toMatchObject({ chua_chia: true, ke_hoach: null })
  })
})

describe('kiemKeHoach — chặn vượt SL lệnh, không chặn xếp thiếu', () => {
  const sps = [
    { key: 'A', code: 'A', qty: 168 },
    { key: 'B', code: 'B', qty: 84 },
  ]
  const lot = (lines: { product_key: string; qty: number }[], po?: string) => ({
    po_no: po ?? null,
    po_ref: null,
    order_no: null,
    ship_date: null,
    note: null,
    lines, // prettier-ignore
  })
  it('xếp thiếu: lưu được, báo còn lại', () => {
    const r = kiemKeHoach([lot([{ product_key: 'A', qty: 42 }])], sps)
    expect(r.loi).toEqual([])
    expect(r.conLai).toEqual({ A: 126, B: 84 })
  })
  it('vượt SL lệnh, SP lạ, đợt rỗng → lỗi', () => {
    const r = kiemKeHoach(
      [lot([{ product_key: 'A', qty: 100 }]), lot([{ product_key: 'A', qty: 100 }, { product_key: 'Z', qty: 1 }]), lot([], 'PO-9')], // prettier-ignore
      sps,
    )
    expect(r.loi).toEqual([
      'Đợt 2: SP Z không có trong lệnh',
      'Đợt 3 (PO-9) chưa có SL nào',
      'A: xếp 200 > SL lệnh 168',
    ])
  })
})
