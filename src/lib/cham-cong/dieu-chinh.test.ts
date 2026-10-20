import { describe, expect, it } from 'vitest'
import {
  apDieuChinh,
  moTaDc,
  theoNguoiNgay,
  MAY_BO_SUNG,
  type DieuChinh,
} from './dieu-chinh'

const l = (gio: string, may = '.203') => ({ gio, may, lap: 1 })
const dc = (p: Partial<DieuChinh>): DieuChinh => ({
  id: Math.random().toString(36),
  ma: '1',
  ngay: '2026-10-01',
  loai: 'add_punch',
  gio: null,
  chieu: null,
  nghi: null,
  lyDo: 'x',
  canCu: null,
  tinhTrang: 'approved',
  nguoiGui: null,
  luc: '2026-10-02T08:00:00Z',
  nguoiDuyet: null,
  lucDuyet: null,
  ghiChuDuyet: null,
  ...p,
})

describe('apDieuChinh', () => {
  it('bổ sung lượt ra đã duyệt → thêm lượt, nhãn máy "Bổ sung", xếp theo giờ', () => {
    const x = apDieuChinh([l('05:54:12')], [dc({ gio: '21:00:00', chieu: 'out' })])
    expect(x.luot.map((v) => [v.gio, v.may])).toEqual([
      ['05:54:12', '.203'],
      ['21:00:00', MAY_BO_SUNG],
    ])
    expect(x).toMatchObject({ daSua: true, choDuyet: 0, nghi: null })
  })
  it('chờ duyệt KHÔNG đổi lượt, chỉ đếm', () => {
    const luot = [l('05:54:12')]
    const x = apDieuChinh(luot, [dc({ gio: '21:00:00', tinhTrang: 'pending' })])
    expect(x.luot).toBe(luot)
    expect(x).toMatchObject({ daSua: false, choDuyet: 1 })
  })
  it('bỏ qua lượt khớp theo giờ:phút', () => {
    const x = apDieuChinh(
      [l('06:58:00'), l('07:01:30'), l('16:02:00')],
      [dc({ loai: 'ignore_punch', gio: '07:01:00' })],
    )
    expect(x.luot.map((v) => v.gio)).toEqual(['06:58:00', '16:02:00'])
  })
  it('nghỉ có lý do', () => {
    expect(apDieuChinh([], [dc({ loai: 'leave', nghi: 'sick' })]).nghi).toBe('sick')
  })
  it('theoNguoiNgay bỏ đã rút / từ chối', () => {
    const m = theoNguoiNgay([
      dc({ tinhTrang: 'cancelled' }),
      dc({ tinhTrang: 'rejected' }),
      dc({ tinhTrang: 'pending' }),
    ])
    expect(m.get('1|2026-10-01')).toHaveLength(1)
  })
  it('moTaDc', () => {
    expect(moTaDc({ loai: 'add_punch', gio: '21:00:00', chieu: 'out', nghi: null })).toBe(
      'Bổ sung lượt ra 21:00',
    )
    expect(moTaDc({ loai: 'leave', gio: null, chieu: null, nghi: 'annual' })).toBe(
      'Nghỉ phép',
    )
  })
})
