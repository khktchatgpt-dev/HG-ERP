import { describe, expect, it } from 'vitest'
import { demRo, locRo } from './ro-phieu'

/**
 * K5 (28/10/2026): tab "Phiếu xuất 28" có 10 phiếu đảo của phiếu nhập (đảo phiếu
 * nhập lưu `kind: 'issue'`, mã PXK). Số đo trên sổ thật: 145 nhập gốc + 2 đảo của
 * phiếu xuất, 18 xuất gốc + 10 đảo của phiếu nhập, 2 kiểm kê.
 */
describe('Sổ phiếu — tab Nhập / Xuất chỉ phiếu gốc', () => {
  it('số trên tab: Nhập 145, Xuất 18, Kiểm kê 2, Đã đảo 24 (12 gốc + 12 phiếu đảo)', () => {
    expect(
      demRo({ total: 177, receipt: 145, issue: 18, dao: 12, goc: 12, thieu: 5 }),
    ).toEqual({
      all: 177,
      receipt: 145,
      issue: 18,
      stocktake: 2,
      thieu_ncc: 5,
      reversed: 24,
    })
  })

  it('bộ lọc của tab cùng nguồn với số: Nhập / Xuất bỏ phiếu đảo; Đã đảo = gốc + đảo', () => {
    const tap = { thieu: ['t1'], goc: new Set(['g1', 'g2']), dao: ['d1', 'd2'] }
    expect(locRo('receipt', tap)).toEqual({ kind: 'receipt', goc_only: true })
    expect(locRo('issue', tap)).toEqual({ kind: 'issue', goc_only: true })
    expect(locRo('stocktake', tap)).toEqual({ kind: 'stocktake' })
    expect(locRo('thieu_ncc', tap)).toEqual({ ids: ['t1'] })
    expect(locRo('reversed', tap)).toEqual({ ids: ['g1', 'g2', 'd1', 'd2'] })
    expect(locRo('all', tap)).toEqual({})
  })

  it('sổ chưa có phiếu đảo nào: tab Đã đảo rỗng (ids rỗng → repo trả rỗng, không trả cả sổ)', () => {
    expect(locRo('reversed', { thieu: [], goc: new Set(), dao: [] })).toEqual({ ids: [] })
  })
})
