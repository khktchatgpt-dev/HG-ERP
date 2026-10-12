import { describe, expect, it } from 'vitest'
import {
  chiDongTuDo,
  dotKeTiep,
  ngay,
  ngayBatThuong,
  soNgayToi,
  xepHangVe,
  type DotMo,
  type HangVeRow,
} from './kho-hang-ve'

const TODAY = '2026-10-12'

const row = (p: Partial<HangVeRow> & { po_code: string }): HangVeRow => ({
  po_id: 'id-' + p.po_code,
  supplier_name: 'NCC',
  lsx_code: null,
  extra_lsx: [],
  template: 'accessory',
  bucket: 'later',
  expected_at: null,
  lines_done: 0,
  lines_total: 1,
  owner_name: null,
  dot: null,
  ...p,
})

describe('dotKeTiep', () => {
  it('không có đợt mở → null (cột ghi "chưa chia đợt")', () => {
    expect(dotKeTiep([], 0, new Map())).toBeNull()
  })

  it('có đợt nhưng không đợt nào còn mở → lịch đã hẹn hết, không phải "chưa chia đợt"', () => {
    expect(dotKeTiep([], 2, new Map())).toEqual({
      so_dot: 2,
      ke_tiep: null,
      da_nhap_truoc: [],
    })
  })

  it('PO-2026-0100: đợt 1 đã nhập trước, kế tiếp là đợt 2', () => {
    const dots: DotMo[] = [
      { id: 's1', seq: 1, date: '2026-10-12', arrived: false, line_ids: ['a', 'b', 'c'] },
      { id: 's2', seq: 2, date: '2026-10-22', arrived: false, line_ids: ['d'] },
    ]
    const open = new Map([['a', 0], ['b', 0], ['c', 0], ['d', 500]]) // prettier-ignore
    expect(dotKeTiep(dots, 2, open)).toEqual({
      so_dot: 2,
      ke_tiep: { id: 's2', seq: 2, date: '2026-10-22', arrived: false },
      da_nhap_truoc: [1],
    })
  })

  it('xếp theo NGÀY chứ không theo số đợt', () => {
    const dots: DotMo[] = [
      { id: 's3', seq: 3, date: '2027-01-02', arrived: false, line_ids: ['x'] },
      { id: 's2', seq: 2, date: '2026-10-25', arrived: true, line_ids: ['y'] },
    ]
    const r = dotKeTiep(dots, 3, new Map([['x', 1], ['y', 1]])) // prettier-ignore
    expect(r?.ke_tiep).toEqual({ id: 's2', seq: 2, date: '2026-10-25', arrived: true })
    expect(r?.da_nhap_truoc).toEqual([])
  })

  it('mọi đợt mở đã nhập đủ → ke_tiep null, liệt kê đợt đã nhập trước', () => {
    const dots: DotMo[] = [
      { id: 's1', seq: 1, date: '2026-10-12', arrived: false, line_ids: ['a'] },
    ]
    expect(dotKeTiep(dots, 1, new Map([['a', 0]]))).toEqual({
      so_dot: 1,
      ke_tiep: null,
      da_nhap_truoc: [1],
    })
  })

  it('dòng thiếu số trong lineOpen coi như CÒN chờ — không tự tuyên bố xong', () => {
    const dots: DotMo[] = [{ id: 's1', seq: 1, date: '2026-10-12', arrived: false, line_ids: ['a', 'zz'] }] // prettier-ignore
    expect(dotKeTiep(dots, 1, new Map([['a', 0]]))?.ke_tiep?.seq).toBe(1)
  })

  it('đợt không có dòng nào là đợt còn mở (chưa khai dòng), không phải đã xong', () => {
    const dots: DotMo[] = [
      { id: 's1', seq: 1, date: '2026-10-12', arrived: false, line_ids: [] },
    ]
    expect(dotKeTiep(dots, 1, new Map())?.ke_tiep?.seq).toBe(1)
  })
})

describe('ngayBatThuong', () => {
  it('PO-2026-0085 hẹn năm 2610 là bất thường', () => {
    expect(ngayBatThuong('2610-10-03', TODAY)).toBe(true)
  })
  it('trễ hơn một năm về trước cũng bất thường', () => {
    expect(ngayBatThuong('2025-09-01', TODAY)).toBe(true)
  })
  it('trong một năm thì bình thường; chưa hẹn thì không gắn nhãn', () => {
    expect(ngayBatThuong('2027-02-10', TODAY)).toBe(false)
    expect(ngayBatThuong('2026-09-05', TODAY)).toBe(false)
    expect(ngayBatThuong(null, TODAY)).toBe(false)
  })
})

describe('ngay', () => {
  it('cùng năm với hôm nay thì dd/mm, khác năm thì thêm năm', () => {
    expect(ngay('2026-10-22', TODAY)).toBe('22/10')
    expect(ngay('2027-01-02', TODAY)).toBe('02/01/2027')
    expect(ngay('2610-10-03', TODAY)).toBe('03/10/2610')
    expect(ngay('2026-10-06T08:00:00+07:00', TODAY)).toBe('06/10')
  })
})

describe('soNgayToi', () => {
  it('âm khi đã qua, 0 hôm nay', () => {
    expect(soNgayToi('2026-10-05', TODAY)).toBe(-7)
    expect(soNgayToi(TODAY, TODAY)).toBe(0)
    expect(soNgayToi('2026-10-22', TODAY)).toBe(10)
  })
})

describe('chiDongTuDo', () => {
  it('đơn gỗ chỉ có dòng theo mã SP (0 dòng vật tư) không vào sổ kho', () => {
    expect(chiDongTuDo({ lines_total: 0 })).toBe(true)
    expect(chiDongTuDo({ lines_total: 7 })).toBe(false)
  })
})

describe('xepHangVe', () => {
  it('hẹn sớm trước, chưa hẹn cuối, cùng ngày theo mã', () => {
    const rs = [
      row({ po_code: 'PO-3', expected_at: null }),
      row({ po_code: 'PO-2', expected_at: '2026-10-13' }),
      row({ po_code: 'PO-1', expected_at: '2026-10-13' }),
      row({ po_code: 'PO-0', expected_at: '2026-10-02' }),
    ]
    expect(rs.sort(xepHangVe).map((r) => r.po_code)).toEqual([
      'PO-0',
      'PO-1',
      'PO-2',
      'PO-3',
    ])
  })
})
