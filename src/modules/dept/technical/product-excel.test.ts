import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildProductExcel, productExcelFilename } from './product-excel'
import type { PartView } from '@/components/technical/ProductProfileCards'

/** Dòng định mức tối thiểu — chỉ khai những ô phép thử quan tâm. */
const part = (over: Partial<PartView>): PartView =>
  ({
    id: 'x',
    group_code: 'FRAME',
    section_title: 'Quy cách :',
    unit_basis: null,
    cluster_id: null,
    part_no: null,
    part_name: 'Chân sau',
    profile_shape: 'HOP',
    profile_code: null,
    material_kind: 'AL',
    material_note: null,
    tenon: null,
    tenon_mm: null,
    dim_a_mm: 25,
    dim_b_mm: 50,
    wall_thickness_mm: 1.2,
    cut_length_mm: 675,
    bend_waste_mm: null,
    kg_per_m: null,
    wood_species: null,
    bar_length_m: null,
    pcs_per_bar: null,
    roll_width_m: null,
    waste_pct: null,
    sheet_w_mm: null,
    sheet_l_mm: null,
    m3_per_sheet: null,
    qty: 2,
    unit: null,
    color: null,
    weight_kg: 0.532,
    total_length_m: 1.35,
    paint_area_m2: 0.2025,
    volume_m3: null,
    note: null,
    blank_confirmed_at: null,
    ...over,
  }) as PartView

const input = (parts: PartView[]) => ({
  product: {
    code: 'CH0001HG-AL',
    name: 'Ghế thử',
    customer_name: 'MERXX',
    customer_item_code: '21601-217',
    code_legacy: null,
    unit: 'cai',
    product_type: 'CH',
    frame_material: 'AL',
    base_material: 'AL',
    length_mm: 560,
    width_mm: 615,
    height_mm: 910,
    length_open_mm: null,
    width_open_mm: null,
    height_open_mm: null,
    thickness_mm: null,
    net_weight_kg: null,
    actual_weight_kg: null,
    material: null,
    hs_code: null,
    origin_country: null,
    max_load_kg: null,
    assembly: null,
    set_contents: null,
    description_en: null,
    shipping_mark: null,
    notes: null,
    barcode: null,
    is_upholstered: false,
    has_glass: false,
    is_set: false,
    packing: { carton_l_cm: 102, carton_w_cm: 64, carton_h_cm: 255, qty_per_carton: 30 },
    tech_spec: {},
    bom_rev: 1,
    bom_effective_date: '2026-02-28',
    paint_coverage_m2_per_kg: 5,
    lifecycle: 'draft',
    created_at: '2026-08-19T00:00:00.000Z',
  },
  parts,
  groups: [{ code: 'FRAME', label: 'Khung' }],
  clusters: [],
  setItems: [],
  files: [],
  image: null,
  exportedBy: 'Người thử',
  exportedAt: new Date('2026-08-19T10:00:00.000Z'),
})

/** Mọi ô CHỮ của một sheet — bố cục đổi chỗ thì phép thử không vỡ theo. */
function texts(ws: ExcelJS.Worksheet): string[] {
  const out: string[] = []
  ws.eachRow((row) =>
    row.eachCell((c) => {
      if (typeof c.value === 'string') out.push(c.value)
    }),
  )
  return out
}

async function open(buf: Buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as never)
  return wb
}

describe('buildProductExcel', () => {
  it('đủ bốn sheet, sheet đầu là biểu mẫu định mức', async () => {
    const wb = await open(await buildProductExcel(input([part({})]) as never))
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Định mức',
      'Thông số kỹ thuật',
      'Đóng gói',
    ])
    // Tiêu đề nằm DƯỚI đầu thư công ty + khối ISO, không còn ở A1.
    expect(texts(wb.getWorksheet('Định mức')!)).toContain(
      'BẢNG ĐỊNH MỨC NGUYÊN - PHỤ KIỆN',
    )
  })

  it('số ghi dạng SỐ THẬT để người nhận còn SUM được', async () => {
    const wb = await open(await buildProductExcel(input([part({})]) as never))
    const ws = wb.getWorksheet('Định mức')!
    const nums: number[] = []
    ws.eachRow((row) =>
      row.eachCell((c) => {
        if (typeof c.value === 'number') nums.push(c.value)
      }),
    )
    // Trọng lượng, tổng dài, diện tích sơn phải nằm trong file dưới dạng số.
    expect(nums).toContain(0.532)
    expect(nums).toContain(1.35)
    expect(nums).toContain(0.2025)
  })

  it('dòng chưa có SL ghi "cần SL" chứ KHÔNG để ô trống', async () => {
    // Ô trống trong Excel đọc như "bằng 0" — file gửi đi phải nói rõ chỗ thiếu.
    const wb = await open(await buildProductExcel(input([part({ qty: null })]) as never))
    const ws = wb.getWorksheet('Định mức')!
    expect(texts(ws)).toContain('cần SL')
  })

  it('khối khung giữ ĐỦ cột biểu mẫu kể cả khi cả nhóm còn trống', async () => {
    const bare = part({
      weight_kg: null,
      total_length_m: null,
      paint_area_m2: null,
      wall_thickness_mm: null,
      qty: null,
    })
    const wb = await open(await buildProductExcel(input([bare]) as never))
    const ws = wb.getWorksheet('Định mức')!
    const heads = texts(ws)
    for (const h of [
      'Trọng lượng (kg)',
      'Tổng chiều dài (m)',
      'Diện tích sơn (M²)',
      'Dày vật liệu (δ)',
    ])
      expect(heads).toContain(h)
  })

  it('SL viết như người gõ (2) chứ không phải 2.0000 hay 2,', async () => {
    // Số DẪN XUẤT giữ đủ số lẻ của biểu mẫu, số người GÕ thì không độn số 0.
    const wb = await open(await buildProductExcel(input([part({})]) as never))
    const ws = wb.getWorksheet('Định mức')!
    const fmt = new Map<number, string>()
    ws.eachRow((row) =>
      row.eachCell((c) => {
        if (typeof c.value === 'number' && c.numFmt) fmt.set(c.value, c.numFmt)
      }),
    )
    // BẪY Excel: '#,##0.####' vẫn in dấu thập phân cho số nguyên → "2,".
    expect(fmt.get(2)).toBe('#,##0')
    expect(fmt.get(1.2)).toBe('#,##0.##')
    expect(fmt.get(0.532)).toBe('#,##0.000')
  })

  it('có đầu thư công ty và khối chữ ký để bản in ký được', async () => {
    const wb = await open(
      await buildProductExcel({
        ...input([part({})]),
        company: { company_name: 'CÔNG TY TNHH SX-TM HOÀNG GIA' },
      } as never),
    )
    const t = texts(wb.getWorksheet('Định mức')!)
    expect(t).toContain('CÔNG TY TNHH SX-TM HOÀNG GIA')
    expect(t).toContain('Biểu mẫu: HG-QT-07/M02')
    expect(t).toContain('NGƯỜI LẬP BIỂU')
    expect(t).toContain('GIÁM ĐỐC')
  })

  it('ô không có số liệu ghi "—" chứ không để trắng', async () => {
    // Ô trắng trên giấy đọc như "quên điền"; gạch ngang là "không có".
    const wb = await open(await buildProductExcel(input([part({})]) as never))
    expect(texts(wb.getWorksheet('Thông số kỹ thuật')!)).toContain('—')
  })

  it('hồ sơ CHƯA có dòng định mức nào vẫn xuất được', async () => {
    // Rất nhiều hồ sơ mới lập chỉ có thông tin chung — không được ném lỗi, và
    // khối tổng hợp phải nói thẳng là chưa đủ số liệu thay vì bày khung rỗng.
    const wb = await open(await buildProductExcel(input([]) as never))
    const t = texts(wb.getWorksheet('Định mức')!)
    expect(t).toContain('BẢNG ĐỊNH MỨC NGUYÊN - PHỤ KIỆN')
    expect(t.some((x) => x.startsWith('Chưa đủ số liệu để tổng hợp'))).toBe(true)
  })

  it('tên file bỏ dấu tiếng Việt — nó đi vào content-disposition', () => {
    expect(productExcelFilename('CH0001HG-AL', 'Ghế xếp chồng')).toBe(
      'HoSoSP_CH0001HG-AL_Ghe_xep_chong.xlsx',
    )
  })
})
