import { describe, expect, it } from 'vitest'
import { chiaDot, gopKetQua, ngayCanGhi } from './dan-so-ghi'
import type { KetQuaGhi, XemDanSo } from '@/modules/dept/production/dan-so.service'

const xem = (dong: Record<string, { tt: string }>[]): Pick<XemDanSo, 'dong'> =>
  ({ dong: dong.map((o) => ({ o })) }) as never

describe('ngayCanGhi', () => {
  it('chỉ lấy ngày có ô sẽ ghi, không trùng, tăng dần', () => {
    const r = ngayCanGhi(
      xem([
        { '2026-11-12': { tt: 'ghi' }, '2026-11-10': { tt: 'trung' } },
        {
          '2026-11-11': { tt: 'ghi' },
          '2026-11-12': { tt: 'ghi' },
          '2026-11-09': { tt: 'chot' },
        },
      ]),
    )
    expect(r).toEqual(['2026-11-11', '2026-11-12'])
  })
  it('chưa xem trước → rỗng', () => expect(ngayCanGhi(null)).toEqual([]))
})

describe('chiaDot', () => {
  it('chia đều, đợt cuối lẻ', () => {
    expect(chiaDot([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
    expect(chiaDot([], 10)).toEqual([])
  })
})

const kq = (p: Partial<KetQuaGhi>): KetQuaGhi => ({
  ghi_boi: 'Loan',
  luc: '2026-11-19T08:00:00.000Z',
  theo_ma: [],
  phieu: [],
  moi_tao: 0,
  canh_bao: [],
  ...p,
})

describe('gopKetQua', () => {
  it('nối phiếu, cộng số lượng theo (mã, đợt), đếm chi tiết bằng hợp id', () => {
    const m = (ct: string[], tong: number, moi = 0) => ({
      ma: 'SP1',
      ten: 'Ghế',
      dot: 'Xuất 11.11',
      so_ct: ct.length,
      ct_ids: ct,
      tong,
      moi,
    })
    const r = gopKetQua([
      kq({
        phieu: [{ iso: '2026-11-10', doc_no: 'PBS-1', so_o: 2, loi: null }],
        theo_ma: [m(['a', 'b'], 100, 1)],
        moi_tao: 1,
        canh_bao: ['x'],
      }),
      kq({
        phieu: [{ iso: '2026-11-11', doc_no: 'PBS-2', so_o: 1, loi: null }],
        theo_ma: [m(['b', 'c'], 50)],
        canh_bao: ['x', 'y'],
      }),
    ])
    expect(r.phieu.map((p) => p.doc_no)).toEqual(['PBS-1', 'PBS-2'])
    expect(r.theo_ma).toHaveLength(1)
    expect(r.theo_ma[0]).toMatchObject({ tong: 150, moi: 1, so_ct: 3 })
    expect(r.moi_tao).toBe(1)
    expect(r.canh_bao).toEqual(['x', 'y'])
  })
})
