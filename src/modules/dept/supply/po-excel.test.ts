import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildPoExcel, poExcelFilename } from '@/modules/dept/supply/po-excel'
import type { PoPrintHeader, PoPrintLine } from '@/app/print/supply/PoPrintSheet'

/**
 * XUẤT EXCEL ĐƠN ĐẶT HÀNG phải GIỐNG PHIẾU IN — cùng nhãn cột (đọc chung
 * PO_PRINT_ORDER), cùng khối tổng, cùng câu chữ. Test này khoá phần khung:
 * đổi nhãn/công thức mà chỉ sửa một bản là đỏ ngay.
 */

const COMPANY = {
  company_name: 'CÔNG TY TNHH SX-TM HOÀNG GIA',
  company_address: 'Lô C3 - Cụm công nghiệp Cát Nhơn - Xã Xuân An - Gia Lai',
  company_tax_code: '4100644894',
  company_phone: '056.3 749 073',
  company_fax: '056.3853946',
  company_locality: 'Gia Lai',
}

const header = (over: Partial<PoPrintHeader> = {}): PoPrintHeader => ({
  code: '01/26 HG/MĐ',
  template: 'simple',
  currency: 'VND',
  vat_rate: 8,
  price_includes_vat: false,
  discount_amount: 0,
  contract_no: null,
  expected_at: '2026-08-10',
  note: null,
  terms: null,
  terms_quality: null,
  terms_delivery_place: 'Công ty Hoàng Gia',
  terms_payment: 'Công nợ 30 ngày kể từ thời điểm giao hàng',
  terms_invoice: 'Hóa đơn GTGT',
  terms_lead_time: 'Hàng giao theo kế hoạch đã thỏa thuận ở trên đơn hàng',
  signer_role: 'NGƯỜI LẬP',
  lsx_code: 'LSX 01/26-27 - Yotrio',
  order_code: null,
  supplier_name: 'Công ty TNHH Green Coatings Việt Nam',
  created_at: '2026-08-03T00:00:00Z',
  ...over,
})

const line = (over: Partial<PoPrintLine> = {}): PoPrintLine => ({
  id: 'l1',
  material_code: 'C679-ASA',
  material_name: 'Sơn xám cát ngoài trời',
  material_unit: 'KG',
  qty_ordered: 60,
  unit_price: 80_000,
  price_basis: 'unit',
  qty2: null,
  spec: null,
  note: 'Ghế xếp chồng Yotrio FDA50089N',
  material_grade: null,
  dm_per_sp: null,
  qty_demand: null,
  qty_on_hand: null,
  die_code: null,
  weight_per_m: null,
  bar_length_m: null,
  dimension_text: null,
  finish: null,
  weight_per_unit: null,
  open_style: null,
  pcs_per_ctn: null,
  inner_l_mm: null,
  inner_w_mm: null,
  inner_h_mm: null,
  area_m2: null,
  carton_basis: null,
  ...over,
})

async function load(buf: Buffer): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  return wb.worksheets[0]
}

function findCell(ws: ExcelJS.Worksheet, want: unknown) {
  let hit: ExcelJS.Cell | null = null
  ws.eachRow((row) =>
    row.eachCell((cell) => {
      if (!hit && cell.value === want) hit = cell
    }),
  )
  return hit as ExcelJS.Cell | null
}

describe('buildPoExcel — khung giống phiếu in', () => {
  it('mẫu đơn giản: đủ đầu phiếu, tiêu đề vàng, tiền đúng, tô vàng tổng', async () => {
    // Đúng số liệu đơn thật 01/26 HG/MĐ: 3 dòng sơn 60kg × 80.000.
    const buf = await buildPoExcel({
      company: COMPANY,
      po: header(),
      supplier: {
        name: 'Công ty TNHH Green Coatings Việt Nam',
        address: '120/2 Lê Hồng Phong, Nha Trang',
        tax_no: '4201932306',
        phone: '0944.090.220 - Anh Phước',
      },
      lines: [
        line(),
        line({ id: 'l2', qty_ordered: 60 }),
        line({ id: 'l3', qty_ordered: 60 }),
      ],
    })
    const ws = await load(buf)

    expect(findCell(ws, 'ĐƠN ĐẶT HÀNG')).toBeTruthy()
    expect(findCell(ws, 'CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM')).toBeTruthy()
    expect(findCell(ws, 'Số ĐH : 01/26 HG/MĐ')).toBeTruthy()

    // Hàng tiêu đề: nền vàng, cột Đơn giá chữ đỏ (mẫu chuẩn 08/2026).
    const head = findCell(ws, 'Tên sản phẩm / vật tư')!
    expect(head).toBeTruthy()
    expect((head.fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFFEF08A')
    const price = findCell(ws, 'Đơn giá (VND)')!
    expect(price.font?.color?.argb).toBe('FFDC2626')
    // Mẫu đơn giản có cột Ngày đặt hàng + Thời gian giao hàng như đơn sơn thật.
    expect(findCell(ws, 'Ngày đặt hàng')).toBeTruthy()
    expect(findCell(ws, 'Thời gian giao hàng')).toBeTruthy()

    // Tổng số KG (cùng ĐVT) và khối tiền: 180kg · 14.4tr + VAT 8% = 15.552tr.
    expect(findCell(ws, 'Tổng số KG')).toBeTruthy()
    expect(findCell(ws, 14_400_000)).toBeTruthy()
    expect(findCell(ws, 'TỔNG THANH TOÁN:')).toBeTruthy()
    const grand = findCell(ws, 15_552_000)!
    expect((grand.fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFFEF08A')
    // Chiết khấu 0 in "-" như phiếu gửi NCC.
    expect(findCell(ws, '-')).toBeTruthy()

    expect(findCell(ws, 'XÁC NHẬN CỦA NHÀ CUNG CẤP')).toBeTruthy()
    expect(
      findCell(
        ws,
        'Đề nghị Quý công ty fax lại xác nhận thông tin cho công ty chúng tôi. Xin cảm ơn!',
      ),
    ).toBeTruthy()
  })

  it('mẫu nhôm: tiền theo tổng kg × giá/kg, có cột kg/m + Tổng kg', async () => {
    const buf = await buildPoExcel({
      company: COMPANY,
      po: header({ template: 'aluminium', vat_rate: 10, code: 'NH-01' }),
      supplier: null,
      lines: [
        line({
          material_unit: 'cây',
          qty_ordered: 273,
          unit_price: 102_000,
          price_basis: 'unit2',
          qty2: 382.2, // tổng kg
          weight_per_m: 0.248,
          bar_length_m: 5.65,
        }),
      ],
    })
    const ws = await load(buf)
    expect(findCell(ws, 'kg/m')).toBeTruthy()
    expect(findCell(ws, 'Số cây')).toBeTruthy()
    // (382,2 kg × 102.000) = 38.984.400 — tiền theo kg, không phải theo cây.
    expect(findCell(ws, 38_984_400)).toBeTruthy()
  })

  it('tên file làm sạch ký tự cấm của Windows', () => {
    expect(poExcelFilename('01/26 HG/MĐ')).toBe('DH 01-26 HG-MĐ.xlsx')
  })
})
