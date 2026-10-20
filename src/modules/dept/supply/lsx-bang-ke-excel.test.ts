import ExcelJS from 'exceljs'
import { describe, expect, it } from 'vitest'
import type { BangKeRow } from '@/lib/lsx-bang-ke'
import type { LsxBangKe } from './lsx-bang-ke.service'
import { aiGo, buildBangKeExcel } from './lsx-bang-ke-excel'

/** Dòng bảng kê giả — số đo thật của lệnh 01/26-27 - BLACKIN (08/10/2026). */
function dong(p: Partial<BangKeRow>): BangKeRow {
  return {
    material_id: p.material_code ?? 'm',
    material_code: 'X',
    material_name: 'x',
    unit: 'Con',
    group_name: null,
    source: 'bom',
    deviates: false,
    auto_needed: null,
    draft_needed: 0,
    edited_by: null,
    edited_at: null,
    from_products: [],
    incomplete: false,
    qty_needed: 0,
    qty_issued: 0,
    qty_remaining: 0,
    on_hand: 0,
    reserved_others: 0,
    available: 0,
    ordered: 0,
    pending: 0,
    draft: 0,
    received: 0,
    suggest: 0,
    status: 'none',
    note: null,
    pos: [],
    ...p,
  }
}

const bk: LsxBangKe = {
  lsx: {
    id: 'L1',
    code: '01/26-27 - BLACKIN',
    customer_name: 'BLACKIN',
    order_codes: ['BLACKIN 01/26-27 (tạm)'],
    ship_date: '2027-10-11',
    materials_due_at: null,
    materials_received_at: null,
  },
  rows: [
    dong({
      material_code: 'ST-0127',
      material_name: 'Sắt vuông 25 dày 0.8ly mạ kẽm',
      unit: 'Cây',
      kind: 'FRAME',
      qty_needed: 1109.7216,
      status: 'none',
      from_products: [
        { code: 'TB0300HG-IR', name: 'Bàn', qty: 352, per: 2.75, confirmed: false },
      ],
      last_price: {
        unit_price: 180000,
        currency: 'VND',
        supplier_id: 's1',
        supplier_name: 'Thép Việt',
        po_code: 'PO-2026-0001',
        at: '2026-09-01',
      },
    }),
    dong({
      material_code: 'SAT0671',
      material_name: 'Vít 4x15 sắt xi đen',
      kind: 'NGU_KIM',
      qty_needed: 28864,
      draft: 18000,
      status: 'pending',
      pos: [
        {
          id: 'p1',
          code: 'PO-2026-0150',
          supplier_name: 'Ngũ Kim Thành Nghĩa',
          status: 'draft',
          expected_at: null,
          qty_ordered: 18000,
          qty_received: 0,
          late: false,
        },
      ],
    }),
    dong({
      material_code: 'BUL0022',
      material_name: 'Bulon 6x25x13, xi đen',
      kind: 'NGU_KIM',
      qty_needed: 9288,
      draft: 9400,
      status: 'pending',
    }),
    dong({
      material_code: 'NK-0205',
      material_name: 'Logo',
      source: 'none',
      draft: 1910,
      status: 'extra',
    }),
  ],
  summary: {
    unconfirmed: 0,
    blank: 0,
    none: 1,
    short: 0,
    pending: 2,
    inflight: 0,
    done: 0,
    extra: 1,
    total: 4,
    needed: 3,
  },
  groups: [],
  need_source: 'bom',
  include_draft: true,
  blocked: [
    {
      product_code: 'CH0291HG-IR',
      material_code: 'ST-0064',
      material_name: 'Sắt hộp 20x40 x 0.8 li',
      unit: 'Cây',
      part_name: 'Chân trước',
      reason: 'Chưa khai chiều dài một Cây của vật tư — không đổi 1,28 m ra số Cây được',
      material_id: 'm64',
    },
  ],
  products: [
    {
      id: 'sp1',
      code: 'TB0300HG-IR',
      name: 'Bàn',
      qty: 352,
      bom_confirmed: false,
      coded_parts: 40,
    },
    {
      id: 'sp2',
      code: 'CH0291HG-IR',
      name: 'Ghế',
      qty: 1548,
      bom_confirmed: false,
      coded_parts: 23,
    },
  ],
  manual_count: 0,
  manual_error: null,
  unsplit_pos: [],
}

async function doc(buf: Buffer): Promise<ExcelJS.Workbook> {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  return wb
}

describe('buildBangKeExcel — file cùng số với màn, có công thức để dùng tiếp', () => {
  it('sáu tờ đúng tên và thứ tự', async () => {
    const wb = await doc(await buildBangKeExcel(bk, '2026-10-08', 'Nga'))
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      'Tóm tắt',
      'Bảng kê',
      'Cần đặt',
      'Theo SP',
      'Chưa quy đổi',
      'Đơn của lệnh',
    ])
  })

  it('Bảng kê: Cần làm tròn theo đơn vị mua, Còn phải đặt là CÔNG THỨC trừ cả nháp, tô màu theo tình trạng', async () => {
    const wb = await doc(await buildBangKeExcel(bk, '2026-10-08'))
    const ws = wb.getWorksheet('Bảng kê')!
    const rows: Record<string, ExcelJS.Row> = {}
    ws.eachRow((r) => {
      const ma = r.getCell(2).value
      if (typeof ma === 'string' && /^[A-Z]{2,3}-?\d/.test(ma)) rows[ma] = r
    })
    const sat = rows['ST-0127']
    expect(sat.getCell(7).value).toBe(1110)
    const congThuc = sat.getCell(11).value as ExcelJS.CellFormulaValue
    expect(congThuc.formula).toBe(
      `MAX(G${sat.number}-H${sat.number}-I${sat.number}-J${sat.number},0)`,
    )
    expect(congThuc.result).toBe(1110)
    const tien = sat.getCell(16).value as ExcelJS.CellFormulaValue
    expect(tien.result).toBe(1110 * 180000)
    expect(sat.getCell(12).value).toBe('Chưa đặt')
    expect((sat.getCell(2).fill as ExcelJS.FillPattern).fgColor?.argb).toBe('FFFCECEB')

    const vit = rows['SAT0671']
    expect(vit.getCell(10).value).toBe(18000)
    expect((vit.getCell(11).value as ExcelJS.CellFormulaValue).result).toBe(10864)
    expect(vit.getCell(12).value).toBe('Nháp thiếu')
    expect(vit.getCell(13).value).toBe('PO-2026-0150')

    const bul = rows['BUL0022']
    expect((bul.getCell(11).value as ExcelJS.CellFormulaValue).result ?? 0).toBe(0) // exceljs bỏ result = 0 khi ghi
    expect(bul.getCell(12).value).toBe('Đủ trên nháp')
    expect(
      (bul.getCell(2).fill as ExcelJS.FillPattern | undefined)?.fgColor?.argb,
    ).not.toBe('FFFCECEB')

    expect(ws.views[0]?.state).toBe('frozen')
    expect(ws.autoFilter).toBeTruthy()
  })

  it('Cần đặt: chỉ mã còn phải đặt, Thành tiền là công thức SL × Giá chào', async () => {
    const wb = await doc(await buildBangKeExcel(bk, '2026-10-08'))
    const ws = wb.getWorksheet('Cần đặt')!
    const codes: string[] = []
    ws.eachRow((r) => {
      const ma = r.getCell(2).value
      if (typeof ma === 'string' && /^[A-Z]{2,3}-?\d/.test(ma)) {
        codes.push(ma)
        expect((r.getCell(11).value as ExcelJS.CellFormulaValue).formula).toBe(
          `IF(J${r.number}="","",F${r.number}*J${r.number})`,
        )
      }
    })
    expect(codes.sort()).toEqual(['SAT0671', 'ST-0127'])
  })

  it('Theo SP dò ngược, Chưa quy đổi nói ai gỡ, Đơn của lệnh gộp theo đơn', async () => {
    const wb = await doc(await buildBangKeExcel(bk, '2026-10-08'))
    const sp = wb.getWorksheet('Theo SP')!
    const dongSp = sp.getRow(5)
    expect([
      dongSp.getCell(1).value,
      dongSp.getCell(4).value,
      dongSp.getCell(7).value,
    ]).toEqual(['ST-0127', 'TB0300HG-IR', 2.75 * 352])
    const chan = wb.getWorksheet('Chưa quy đổi')!
    expect(chan.getRow(5).getCell(7).value).toBe('Cung ứng · khai dài cây ở hồ sơ vật tư')
    const don = wb.getWorksheet('Đơn của lệnh')!
    expect([
      don.getRow(4).getCell(1).value,
      don.getRow(4).getCell(3).value,
      don.getRow(4).getCell(5).value,
    ]).toEqual(['PO-2026-0150', 'Nháp', 1])
  })

  it('Tóm tắt đếm theo tình trạng đúng số dòng', async () => {
    const wb = await doc(await buildBangKeExcel(bk, '2026-10-08'))
    const ws = wb.getWorksheet('Tóm tắt')!
    const dem: Record<string, number> = {}
    ws.eachRow((r) => {
      const a = r.getCell(1).value
      const b = r.getCell(2).value
      if (typeof a === 'string' && typeof b === 'number') dem[a] = b
    })
    expect(dem['Chưa đặt']).toBe(1)
    expect(dem['Nháp thiếu']).toBe(1)
    expect(dem['Đủ trên nháp']).toBe(1)
    expect(dem['Ngoài định mức']).toBe(1)
    expect(dem['Cộng']).toBe(4)
  })

  it('aiGo: thiếu dài cây → Cung ứng; còn lại → Kỹ thuật', () => {
    expect(aiGo('Chưa khai chiều dài một Cây của vật tư')).toMatch(/Cung ứng/)
    expect(aiGo('Định mức chưa có khối tích')).toMatch(/Kỹ thuật/)
  })
})
