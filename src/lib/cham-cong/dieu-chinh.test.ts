import { describe, expect, it } from 'vitest'
import {
  apDieuChinh,
  moTaDc,
  theoNguoiNgay,
  MAY_BO_SUNG,
  type DieuChinh,
} from './dieu-chinh'
import { tinhBangTo } from './bang-to'
import type { Ca } from './tinh-cong'

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

describe('bảng tổ dùng điều chỉnh', () => {
  const XUONG: Ca = {
    code: 'XUONG',
    name: 'Xưởng',
    start: '07:00',
    end: '16:00',
    breakMin: 60,
    requiredPunches: 2,
    otFrom: '16:00',
    otRound: 30,
    graceMin: 5,
  }
  const vao = {
    to: 'T',
    homNay: '2026-10-05',
    theoNgay: ['01', '02'].map((d) => ({
      ngay: `2026-10-${d}`,
      theoMay: { '.203': 3 } as Record<string, number>,
    })),
    nhanSu: [{ ma: '1', ten: 'A', boPhan: 'T', ca: XUONG }],
    dong: [{ ngay: '2026-10-01', ma: '1', daGhep: true, luot: [l('06:55:00')] }],
  }
  it('thiếu lượt + bổ sung ra đã duyệt → X; nghỉ phép đã duyệt → N, không vắng', () => {
    const b = tinhBangTo({
      ...vao,
      dieuChinh: [
        dc({ ngay: '2026-10-01', gio: '16:05:00', chieu: 'out' }),
        dc({ ngay: '2026-10-02', loai: 'leave', nghi: 'annual' }),
      ],
    })
    const p = b.nguoi[0]
    expect(p.o.map((o) => o.ky)).toEqual(['X', 'N'])
    expect(p).toMatchObject({ diLam: 1, vang: 0, nghi: 1, canXuLy: 0 })
    expect(p.o[0].daSua).toBe(true)
  })
  it('chờ duyệt: ô vẫn ? và V, chỉ đánh dấu choDuyet', () => {
    const b = tinhBangTo({
      ...vao,
      dieuChinh: [
        dc({ ngay: '2026-10-01', gio: '16:05:00', tinhTrang: 'pending' }),
        dc({ ngay: '2026-10-02', loai: 'leave', nghi: 'annual', tinhTrang: 'pending' }),
      ],
    })
    expect(b.nguoi[0].o.map((o) => [o.ky, o.choDuyet])).toEqual([
      ['?', 1],
      ['V', 1],
    ])
  })
})
