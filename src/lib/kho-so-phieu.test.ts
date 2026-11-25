import { describe, expect, it } from 'vitest'
import {
  coTinh,
  demTheoThang,
  doiKy,
  gomTheoNgay,
  khoangKy,
  khopTim,
  kyTuThamSo,
  laGhiHo,
  lyDoPhieu,
  nhanKy,
  nhomXuat,
  thuNgay,
  tongSo,
  type SoPhieuDong,
} from './kho-so-phieu'

const p = (o: Partial<SoPhieuDong> & { id: string }): SoPhieuDong => ({
  code: `PNK-${o.id}`,
  kind: 'receipt',
  doc_date: '2026-11-21',
  status: 'posted',
  counterparty: null,
  team_name: null,
  dien_giai: null,
  dao_cua: null,
  dao_boi: null,
  ma: ['N1'],
  so_dong: 1,
  don: null,
  lenh: [],
  supplier_doc_no: null,
  thieu_ncc: false,
  created_by: null,
  created_by_name: null,
  ...o,
})

describe('kỳ', () => {
  it('mặc định tháng của hôm nay, nhận tat-ca, bỏ chuỗi sai', () => {
    expect(kyTuThamSo(undefined, '2026-11-23')).toBe('2026-11')
    expect(kyTuThamSo('2026-13', '2026-11-23')).toBe('2026-11')
    expect(kyTuThamSo('2026-09', '2026-11-23')).toBe('2026-09')
    expect(kyTuThamSo('tat-ca', '2026-11-23')).toBe('tat-ca')
  })
  it('đổi kỳ qua năm, khoảng ngày nửa mở', () => {
    expect(doiKy('2026-12', 1)).toBe('2027-01')
    expect(doiKy('2026-01', -1)).toBe('2025-12')
    expect(khoangKy('2026-12')).toEqual({ tu: '2026-12-01', den: '2027-01-01' })
    expect(khoangKy('tat-ca')).toBeNull()
    expect(nhanKy('2026-11')).toBe('Tháng 11/2026')
  })
  it('đếm theo tháng', () => {
    expect(demTheoThang(['2026-10-01', '2026-10-31', '2026-09-15'])).toEqual({
      '2026-10': 2,
      '2026-09': 1,
    })
  })
})

describe('lý do bằng chữ', () => {
  it('mã → nhãn ngắn; phiếu đảo theo chiều; thiếu mã nói thẳng', () => {
    expect(lyDoPhieu(p({ id: '1' })).nhan).toBe('Mua theo đơn')
    expect(lyDoPhieu(p({ id: '1', ma: ['X1', 'X2'], kind: 'issue' }))).toMatchObject({
      nhan: 'Cấp cho lệnh',
      them: 1,
    })
    const dao = p({ id: '2', kind: 'issue', ma: ['X3'], dao_cua: { id: 'g', code: 'PNK-g' } }) // prettier-ignore
    expect(lyDoPhieu(dao)).toMatchObject({ nhan: 'Đảo phiếu nhập', dao: true })
    expect(lyDoPhieu(p({ id: '3', ma: [] })).nhan).toBe('Chưa rõ lý do')
    expect(lyDoPhieu(p({ id: '4', ma: ['C1'] })).nhan).toBe('Chuyển vị trí')
  })
  it('nhóm xuất: lệnh / đảo / trả / khác', () => {
    expect(nhomXuat(p({ id: '1', ma: ['X1'] }))).toBe('lenh')
    expect(nhomXuat(p({ id: '1', ma: ['X3'] }))).toBe('tra')
    expect(nhomXuat(p({ id: '1', ma: ['X3'], dao_cua: { id: 'g', code: 'g' } }))).toBe('dao') // prettier-ignore
    expect(nhomXuat(p({ id: '1', ma: [] }))).toBe('khac')
  })
  it('ghi hộ đọc từ diễn giải', () => {
    expect(laGhiHo(p({ id: '1', dien_giai: 'Ghi hộ 02/10/2026: vật tư' }))).toBe(true)
    expect(laGhiHo(p({ id: '1', dien_giai: 'Nhận đủ' }))).toBe(false)
  })
})

describe('đếm + gom theo ngày', () => {
  const ds = [
    p({ id: 'a', doc_date: '2026-11-19', so_dong: 6 }),
    p({ id: 'b', doc_date: '2026-11-21', so_dong: 3, thieu_ncc: true }),
    p({ id: 'c', doc_date: '2026-11-21', so_dong: 5, dao_boi: { id: 'x', code: 'PXK-x' } }), // prettier-ignore
    p({ id: 'd', doc_date: '2026-11-21', so_dong: 2, status: 'rejected' }),
  ]
  it('phiếu đã bị đảo và bị từ chối không cộng', () => {
    expect(coTinh(ds[2])).toBe(false)
    expect(coTinh(ds[3])).toBe(false)
    expect(tongSo(ds)).toEqual({ soPhieu: 2, soDong: 9, dao: 0, daBiDao: 1, thieuNcc: 1 })
  })
  it('ngày mới trước, số của ngày chỉ đếm phiếu có cộng', () => {
    const g = gomTheoNgay(ds)
    expect(g.map((x) => x.ngay)).toEqual(['2026-11-21', '2026-11-19'])
    expect(g[0]).toMatchObject({ soPhieu: 1, soDong: 3 })
    expect(g[0].ds.map((x) => x.id)).toEqual(['b', 'c', 'd'])
  })
  it('thứ trong tuần, năm khác thì ghi năm', () => {
    expect(thuNgay('2026-11-21', '2026-11-23')).toBe('Thứ Bảy 21/11')
    expect(thuNgay('2026-11-22', '2026-11-23')).toBe('Chủ nhật 22/11')
    expect(thuNgay('2025-12-31', '2026-11-23')).toBe('Thứ Tư 31/12/2025')
  })
})

describe('tìm', () => {
  it('không phân biệt dấu, khớp đơn / NCC / phiếu gốc', () => {
    const d = p({
      id: '1',
      counterparty: 'TÂN PHÁT',
      don: { po_id: 'x', po_code: 'PO-2026-0086' },
      dao_boi: { id: 'y', code: 'PXK-2026-0029' },
    })
    expect(khopTim(d, 'tan phat')).toBe(true)
    expect(khopTim(d, '0086')).toBe(true)
    expect(khopTim(d, 'pxk-2026-0029')).toBe(true)
    expect(khopTim(d, 'kimpack')).toBe(false)
    expect(khopTim(d, '  ')).toBe(true)
  })
})
