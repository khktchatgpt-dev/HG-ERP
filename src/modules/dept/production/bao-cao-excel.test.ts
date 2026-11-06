import { describe, expect, it } from 'vitest'
import ExcelJS from 'exceljs'
import { buildTonExcel, buildTreoExcel } from './bao-cao-excel'
import type { BaoCaoPayload } from './bao-cao.service'

const P = {
  from: '2026-11-01',
  to: '2026-11-06',
  today: '2026-11-06',
  sua_lai_treo: [
    {
      lsx_id: 'l1',
      lsx_code: 'LSX-13',
      product_code: 'GH-01',
      comp: 'Chân',
      cluster: 'Khung',
      stage_label: 'Hàn',
      team_name: 'Tổ Hàn',
      rework: 12,
      bu: 4,
      treo: 8,
      last_date: '2026-11-05',
    },
    {
      lsx_id: 'l1',
      lsx_code: 'LSX-13',
      product_code: 'GH-01',
      comp: 'Mê',
      cluster: null,
      stage_label: 'Phôi',
      team_name: null,
      rework: 3,
      bu: 0,
      treo: 3,
      last_date: '2026-11-04',
    },
  ],
  ton_cong_doan: [
    {
      lsx_id: 'l1',
      lsx_code: 'LSX-13',
      product_code: 'GH-01',
      comp: 'Cụm khung (mặc nhiên)',
      cluster: null,
      stage: 'han',
      stage_label: 'Hàn',
      count_level: 'cluster',
      done: 50,
      shipped: 30,
      on_hand: 20,
      cho_nhan: 10,
    },
  ],
} as unknown as BaoCaoPayload

async function load(buf: Buffer) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(buf as unknown as ArrayBuffer)
  return wb.worksheets[0]
}
const cells = (ws: ExcelJS.Worksheet, n: number) =>
  (ws.getRow(n).values as (string | number | undefined)[]).slice(1)

describe('Excel hai bảng mới của Báo cáo sản xuất (Đợt 1, 06/11/2026)', () => {
  it('Sửa lại còn treo: đổ đúng payload, chân nói tổng và "không cộng dọc"', async () => {
    const ws = await load(await buildTreoExcel(P))
    expect(cells(ws, 3)).toEqual([
      'Lệnh',
      'SP',
      'Dòng',
      'Công đoạn',
      'Tổ',
      'Sửa lại',
      'Đã bù',
      'Còn treo',
      'Ghi sửa gần nhất',
    ])
    expect(cells(ws, 4)).toEqual([
      'LSX-13',
      'GH-01',
      'Khung · Chân',
      'Hàn',
      'Tổ Hàn',
      12,
      4,
      8,
      '05/11/2026',
    ])
    expect(cells(ws, 5)[4] ?? '').toBe('') // tổ trống → ô trống, không "null"
    const foot = cells(ws, 6)
    expect(foot[0]).toBe('2 dòng còn treo')
    expect(foot[7]).toBe(11)
    expect(foot[8]).toBe('không cộng dọc khác đơn vị')
    expect(ws.views[0]).toMatchObject({ state: 'frozen', ySplit: 3 })
  })

  it('Tồn công đoạn: bậc đếm thành chữ, bốn số, chân không có tổng', async () => {
    const ws = await load(await buildTonExcel(P))
    expect(cells(ws, 3)).toEqual([
      'Lệnh',
      'SP',
      'Dòng',
      'Công đoạn',
      'Đếm',
      'Xong',
      'Đã giao',
      'Tồn',
      'Chờ nhận',
    ])
    expect(cells(ws, 4)).toEqual([
      'LSX-13',
      'GH-01',
      'Cụm khung (mặc nhiên)',
      'Hàn',
      'cụm',
      50,
      30,
      20,
      10,
    ])
    expect(String(cells(ws, 5)[0])).toContain('1 dòng × công đoạn có tồn')
    expect(cells(ws, 5)[7]).toBeUndefined()
  })

  it('payload rỗng vẫn ra file có tiêu đề + chân 0 dòng', async () => {
    const ws = await load(
      await buildTreoExcel({ ...P, sua_lai_treo: [] } as BaoCaoPayload),
    )
    expect(cells(ws, 4)[0]).toBe('0 dòng còn treo')
  })
})
