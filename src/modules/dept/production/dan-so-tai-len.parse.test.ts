import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildMauLenhExcel } from './dan-so-mau-lenh.excel'
import { docFileMau, timTo } from './dan-so-tai-len.parse'
import type { MauLenh } from './dan-so.service'

const LSX = '11111111-2222-3333-4444-555555555555'
const m: MauLenh = {
  lsx_id: LSX,
  lsx_code: '99/26-27 - TEST',
  cot: ['2026-11-13', '2026-11-14', '2026-11-15'],
  teams: [
    { id: 't1', name: 'Tổ Phôi', stage: 'phoi' },
    { id: 't2', name: 'Tổ Hàn', stage: 'han' },
  ],
  to: [
    {
      stage: 'phoi',
      label: 'Phôi',
      don_vi: 'chi tiết',
      to: { id: 't1', name: 'Tổ Phôi' },
      so_o_co: 1,
      dong: [
        {
          ma: 'SP1',
          ten_sp: 'Ghế',
          cum: 'Cụm chân',
          ten: 'Chân phi 40',
          ct_sp: 4,
          can: 896,
          da_lam: 100,
          o: { '2026-11-14': 30 },
          thu_tu: 0,
        },
        {
          ma: 'SP1',
          ten_sp: 'Ghế',
          cum: 'Cụm chân',
          ten: 'Giằng',
          ct_sp: 2,
          can: 448,
          da_lam: 0,
          o: {},
          thu_tu: 1,
        },
      ],
    },
    {
      stage: 'han',
      label: 'Hàn',
      don_vi: 'cụm',
      to: null,
      so_o_co: 0,
      dong: [
        {
          ma: 'SP1',
          ten_sp: 'Ghế',
          cum: 'Cụm chân',
          ten: 'Cụm chân',
          ct_sp: 1,
          can: 224,
          da_lam: 0,
          o: {},
          thu_tu: 0,
        },
      ],
    },
  ],
}

async function mo(sua?: (wb: ExcelJS.Workbook) => void) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load((await buildMauLenhExcel(m)) as never)
  sua?.(wb)
  const wb2 = new ExcelJS.Workbook()
  await wb2.xlsx.load((await wb.xlsx.writeBuffer()) as never)
  return docFileMau(wb2, 2026)
}

describe('docFileMau', () => {
  it('đọc mã khoá, tổ, cột ngày; chỉ lấy dòng có số; số ERP điền sẵn vẫn được giữ', async () => {
    const r = await mo((wb) => {
      const ws = wb.getWorksheet('PHÔI')!
      ws.getCell('G5').value = 12 // 13/11 chân phi
      ws.getCell('I6').value = 7 // 15/11 giằng
      const han = wb.getWorksheet('HÀN')!
      han.getCell('H1').value = 'Tổ Hàn'
      han.getCell('H5').value = 50
    })
    expect(r.lsx_id).toBe(LSX)
    expect(r.bo_qua).toEqual([])
    const phoi = r.to.find((t) => t.stage === 'phoi')!
    expect(phoi.to_ten).toBe('Tổ Phôi')
    expect(phoi.cot).toEqual(['2026-11-13', '2026-11-14', '2026-11-15'])
    expect(phoi.rows).toHaveLength(2)
    expect(phoi.rows[0]).toMatchObject({
      ma_sp: 'SP1',
      cum: 'Cụm chân',
      ten: 'Chân phi 40',
      ct_sp: 4,
    })
    expect(phoi.rows[0].o).toEqual({ '2026-11-13': 12, '2026-11-14': 30 })
    expect(phoi.rows[1].o).toEqual({ '2026-11-15': 7 })
    const han = r.to.find((t) => t.stage === 'han')!
    expect(han.to_ten).toBe('Tổ Hàn')
    expect(han.rows[0].o).toEqual({ '2026-11-14': 50 })
  })

  it('dòng mới gõ ở cuối tờ PHÔI được đọc; chữ trong ô số thành ô sai', async () => {
    const r = await mo((wb) => {
      const ws = wb.getWorksheet('PHÔI')!
      ws.getCell('A7').value = 'SP1'
      ws.getCell('B7').value = 'CỤM MỚI'
      ws.getCell('C7').value = 'Chi tiết mới'
      ws.getCell('D7').value = 2
      ws.getCell('G7').value = 9
      ws.getCell('H5').value = 'abc'
    })
    const phoi = r.to.find((t) => t.stage === 'phoi')!
    const moi = phoi.rows.find((x) => x.ten === 'Chi tiết mới')!
    expect(moi).toMatchObject({ ma_sp: 'SP1', cum: 'CỤM MỚI', ct_sp: 2 })
    expect(moi.o).toEqual({ '2026-11-13': 9 })
    expect(phoi.rows[0].sai).toEqual([{ iso: '2026-11-14', raw: 'abc' }])
  })

  it('tờ thiếu mã khoá bị bỏ qua kèm lý do; ô tổ trống đọc ra rỗng', async () => {
    const r = await mo((wb) => {
      wb.addWorksheet('Ghi chú').getCell('A1').value = 'xin chào'
    })
    expect(r.bo_qua.map((b) => b.ten_to)).toEqual(['Ghi chú'])
    expect(r.to.find((t) => t.stage === 'han')!.to_ten).toBe('')
  })

  it('tờ thuộc lệnh khác bị bỏ qua', async () => {
    const r = await mo((wb) => {
      wb.getWorksheet('HÀN')!.getCell('F2').value =
        'LSX:99999999-2222-3333-4444-555555555555|CD:han|v1'
    })
    expect(r.bo_qua).toEqual([
      { ten_to: 'HÀN', ly_do: 'Thuộc lệnh khác với các tờ còn lại của file' },
    ])
  })
})

describe('timTo', () => {
  it('khớp tên tổ không phân biệt hoa thường / dấu', () => {
    const ds = [{ id: 'a', name: 'Tổ Hàn' }]
    expect(timTo('to han', ds)).toBe('a')
    expect(timTo('', ds)).toBeNull()
    expect(timTo('Tổ Lạ', ds)).toBeNull()
  })
})
