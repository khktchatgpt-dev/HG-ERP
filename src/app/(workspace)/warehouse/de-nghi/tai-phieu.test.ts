import { describe, expect, it } from 'vitest'
import type { DeNghiChiTiet } from '@/modules/dept/warehouse/de-nghi.service'
import { phieuLapLai } from './tai-phieu'

/** Lập lại từ phiếu cũ (Đ8, Q22). */
const dong = (
  p: Partial<DeNghiChiTiet['lines'][number]>,
): DeNghiChiTiet['lines'][number] => ({
  id: 'l1',
  line_no: 1,
  material_id: 'm-keo',
  name: 'Băng keo trong 4F7',
  unit: 'Cuộn',
  qty: 200,
  approved_qty: null,
  unit_price: 5500,
  vat_rate: 8,
  purpose: 'Đóng gói',
  note: 'ghi chú lần cũ',
  po_line_id: null,
  code: 'KEO0030',
  ton: 36,
  gia_gan_nhat: null,
  theo_doi: true,
  trung: [],
  dang_ve: [],
  can: 200,
  da_nhap: 200,
  phieu_nhap: [],
  ...p,
})
const src = (p: Partial<DeNghiChiTiet> = {}): DeNghiChiTiet =>
  ({
    id: 'dn1',
    code: 'DNM-2026-0001',
    status: 'done',
    department: 'Kho vật tư',
    need_by: '2026-10-17',
    note: 'Cấp phục vụ sản xuất',
    production_order_id: 'lsx1',
    shipping_fee: 30_000,
    lines: [dong({})],
    ...p,
  }) as DeNghiChiTiet

describe('phieuLapLai', () => {
  it('bản nháp MỚI (chưa có id): chép bộ phận, ghi chú, vận chuyển; KHÔNG chép cần trước, lệnh SX', () => {
    const f = phieuLapLai('Lê Khắc Hào', src())
    expect(f).toMatchObject({ id: null, code: null, status: 'draft', department: 'Kho vật tư', note: 'Cấp phục vụ sản xuất', shipping_fee: 30_000, need_by: '', production_order_id: null, nguoi_de_nghi: 'Lê Khắc Hào' }) // prettier-ignore
  })

  it('số lượng = số đã duyệt; dòng duyệt 0 bỏ; giá = lần mua gần nhất nếu có; VAT + mục đích chép, ghi chú dòng thì không', () => {
    const f = phieuLapLai(
      'Hào',
      src({
        lines: [
          dong({ approved_qty: 150, gia_gan_nhat: { unit_price: 5200, po_code: 'PNK-2026-0121', supplier_name: 'Tân Hưng', at: '2026-10-13', nguon: 'kho' } }), // prettier-ignore
          dong({ id: 'l2', material_id: 'm-han', name: 'Que hàn', approved_qty: 0 }),
          dong({ id: 'l3', material_id: null, code: null, name: 'Giẻ lau', unit: 'Kg', qty: 20, unit_price: 15000, vat_rate: 0, ton: null }), // prettier-ignore
        ],
      }),
    )
    expect(
      f.lines.map((l) => [l.name, l.qty, l.unit_price, l.vat_rate, l.purpose, l.note]),
    ).toEqual([
      ['Băng keo trong 4F7', 150, 5200, 8, 'Đóng gói', ''],
      ['Giẻ lau', 20, 15000, 0, 'Đóng gói', ''],
    ])
  })

  it('phiếu cũ còn mở (đang mua) → chính nó là phiếu trùng của bản mới', () => {
    const f = phieuLapLai(
      'Hào',
      src({ status: 'ordering', lines: [dong({ approved_qty: 150 })] }),
    )
    expect(f.lines[0].trung).toEqual([
      { code: 'DNM-2026-0001', status: 'ordering', qty: 150 },
    ])
    expect(phieuLapLai('Hào', src()).lines[0].trung).toEqual([])
  })
})
