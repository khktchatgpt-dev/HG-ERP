import { describe, expect, it } from 'vitest'
import { choLapLai, phieuNhapCuoi, vuongPhieuKho } from './tong-quan'

const doc = (code: string, kind: string, x: Record<string, unknown> = {}) => ({
  doc_id: `id-${code}`,
  code,
  kind,
  qty_total: 10,
  at: '2026-10-02T00:00:00Z',
  entered_at: '2026-10-02T00:00:00Z',
  ...x,
})

describe('Tổng quan — sổ kho của đơn', () => {
  it('đảo ĐỂ SỬA mà chưa lập lại → chờ lập lại; đã có phiếu "Sửa lại" → hết', () => {
    const goc = doc('PNK-1', 'receipt', { reversed_by: 'PXK-1' })
    const dao = doc('PXK-1', 'reversal', { reversal_of: 'PNK-1', for_fix: true })
    expect(choLapLai([goc, dao]).map((d) => d.code)).toEqual(['PNK-1'])
    expect(vuongPhieuKho([goc, dao])[0]).toMatchObject({
      tag: 'Chờ lập lại',
      muc: 'giao-nhan',
    })
    expect(choLapLai([goc, dao, doc('PNK-2', 'receipt', { fix_of: 'PNK-1' })])).toEqual(
      [],
    )
  })

  it('đảo hẳn (không phải để sửa) không phải việc treo', () => {
    const goc = doc('PNK-1', 'receipt', { reversed_by: 'PXK-1' })
    expect(choLapLai([goc, doc('PXK-1', 'reversal', { for_fix: false })])).toEqual([])
  })

  it('phiếu nhập gần nhất bỏ qua phiếu đã đảo', () => {
    const ds = [
      doc('PNK-1', 'receipt'),
      doc('PNK-2', 'receipt', { reversed_by: 'PXK-1' }),
    ]
    expect(phieuNhapCuoi(ds)?.code).toBe('PNK-1')
  })
})
