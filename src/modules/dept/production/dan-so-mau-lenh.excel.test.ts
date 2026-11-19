import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import {
  buildMauLenhExcel,
  mauLenhFilename,
  MAU_PHIEN_BAN,
} from './dan-so-mau-lenh.excel'
import type { MauLenh } from './dan-so.service'

const m: MauLenh = {
  lsx_id: '11111111-2222-3333-4444-555555555555',
  lsx_code: '02/26-27 - ROSCO',
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
          ma: '2722875',
          ten_sp: 'Ghế xoay',
          cum: 'Cụm chân',
          ten: 'Chân phi 40',
          ct_sp: 4,
          can: 896,
          da_lam: 100,
          o: { '2026-11-14': 30 },
          thu_tu: 0,
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
          ma: '2722875',
          ten_sp: 'Ghế xoay',
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

async function doc() {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load((await buildMauLenhExcel(m)) as never)
  return wb
}

describe('buildMauLenhExcel', () => {
  it('mỗi công đoạn một tờ + tờ _khoa ẩn mang id lệnh và phiên bản', async () => {
    const wb = await doc()
    expect(wb.worksheets.map((w) => w.name)).toEqual(['PHÔI', 'HÀN', '_khoa'])
    const kh = wb.getWorksheet('_khoa')!
    expect(kh.state).toBe('hidden')
    expect(kh.getCell('B1').value).toBe(m.lsx_id)
    expect(kh.getCell('B2').value).toBe(MAU_PHIEN_BAN)
    expect(kh.getCell('D1').value).toBe('Tổ Phôi')
    expect(kh.getCell('F1').value).toBe('2722875')
  })

  it('bốn hàng đầu mang lệnh · công đoạn · tổ · mã khoá; tiêu đề ngày dd/mm/yyyy', async () => {
    const ws = (await doc()).getWorksheet('PHÔI')!
    expect(ws.getCell('B1').value).toBe('02/26-27 - ROSCO')
    expect(ws.getCell('F1').value).toBe('Phôi')
    expect(ws.getCell('H1').value).toBe('Tổ Phôi')
    expect(ws.getCell('K1').value).toBe('chi tiết')
    expect(ws.getCell('F2').value).toBe(`LSX:${m.lsx_id}|CD:phoi|v${MAU_PHIEN_BAN}`)
    expect([7, 8, 9].map((c) => ws.getRow(4).getCell(c).value)).toEqual([
      '13/11/2026',
      '14/11/2026',
      '15/11/2026',
    ])
  })

  it('dòng ERP điền sẵn cố định + số đã ghi; tờ đếm chi tiết có dòng trống để thêm mới', async () => {
    const ws = (await doc()).getWorksheet('PHÔI')!
    const r = ws.getRow(5)
    expect([1, 2, 3, 4, 5, 6].map((c) => r.getCell(c).value)).toEqual([
      '2722875',
      'Cụm chân',
      'Chân phi 40',
      4,
      896,
      100,
    ])
    expect(r.getCell(8).value).toBe(30)
    expect(r.getCell(7).value).toBeNull()
    expect(ws.rowCount).toBe(5 + 6) // 1 dòng + 6 dòng mới
  })

  it('tờ đếm cụm không có dòng mới; tờ chưa có tổ để ô Tổ trống (chọn trong file)', async () => {
    const ws = (await doc()).getWorksheet('HÀN')!
    expect(ws.getCell('H1').value ?? '').toBe('')
    expect(ws.rowCount).toBe(5)
    expect(ws.getCell('K1').value).toBe('cụm')
  })

  it('tên file theo lệnh và khoảng ngày', () => {
    expect(mauLenhFilename(m)).toBe('mau-nhap-lieu_02-26-27-ROSCO_1113-1115.xlsx')
  })
})
