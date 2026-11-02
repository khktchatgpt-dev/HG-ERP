import { describe, expect, it } from 'vitest'
import type { NvDsTom, RiengDs } from './danh-sach'
import { danVung, gocO, laVung, tongHop, xetO, type SuaBang } from './sua-bang'

const R: RiengDs = {
  gioiTinh: 'female',
  ngaySinh: '2001-03-14',
  cccd4: '4417',
  ngayCap: null,
  noiCap: null,
  mst4: null,
  dienThoai: '0976214558',
  choO: 'Khu phố 2',
  thuongTru: null,
  trinhDo: null,
  khanCapTen: null,
  khanCapQuanHe: null,
  khanCapSdt: null,
}
const nv = (p: Partial<NvDsTom> = {}): NvDsTom => ({
  id: 'a',
  code: '6143',
  hoTen: 'Trần Thị Mỹ Duyên',
  boPhan: 'Tổ Sơn Sắt',
  chucDanh: 'Công nhân',
  ngayVao: '2023-05-08',
  ngayCuoi: null,
  active: true,
  khongChamCong: false,
  tenTuMay: false,
  ma: [],
  coRieng: {
    ngaySinh: true,
    cccd: false,
    diaChi: false,
    dienThoai: true,
    trinhDo: false,
    khanCap: false,
  },
  hd: null,
  vang: null,
  ghiChu: null,
  rieng: R,
  ...p,
})

describe('giá trị đang có viết như người gõ', () => {
  it('ngày dd/mm/yyyy, SĐT có cách, Nam/Nữ; CCCD che → trống', () => {
    const n = nv()
    expect(gocO(n, 'ngayVao')).toBe('08/05/2023')
    expect(gocO(n, 'ngaySinh')).toBe('14/03/2001')
    expect(gocO(n, 'dienThoai')).toBe('0976 214 558')
    expect(gocO(n, 'gioiTinh')).toBe('Nữ')
    expect(gocO(n, 'cccd')).toBe('')
    expect(gocO(n, 'thuongTru')).toBe('')
  })
})

describe('xét một ô', () => {
  it('gõ lại đúng giá trị cũ theo cách khác → giữ nguyên', () => {
    expect(xetO('dienThoai', '0976 214 558', '0976.214.558')).toEqual({ kieu: 'giu' })
    expect(xetO('ngaySinh', '14/03/2001', '14-3-2001')).toEqual({ kieu: 'giu' })
    expect(xetO('gioiTinh', 'Nữ', 'nu')).toEqual({ kieu: 'giu' })
  })
  it('đổi → gửi giá trị đã chuẩn hoá (ISO, số liền, male/female)', () => {
    expect(xetO('dienThoai', '', '0905 123 456')).toEqual({
      kieu: 'doi',
      moi: '0905123456',
    })
    expect(xetO('ngayVao', '08/05/2023', '01/06/2023')).toEqual({
      kieu: 'doi',
      moi: '2023-06-01',
    })
    expect(xetO('gioiTinh', 'Nữ', 'Nam')).toEqual({ kieu: 'doi', moi: 'male' })
  })
  it('sai định dạng → câu nói cần gì (cùng LOI_O với nạp Excel)', () => {
    const x = xetO('cccd', '', '05230100441')
    expect(x.kieu).toBe('loi')
    expect(x.kieu === 'loi' && x.loi).toContain('12 chữ số')
    expect(xetO('ngaySinh', '', '31/02/2001').kieu).toBe('loi')
  })
  it('xoá ô đang có giá trị → sai (bảng không xoá); ô trống để trống → giữ', () => {
    expect(xetO('choO', 'Khu phố 2', '  ').kieu).toBe('loi')
    expect(xetO('thuongTru', '', '')).toEqual({ kieu: 'giu' })
    expect(xetO('cccd', '', '')).toEqual({ kieu: 'giu' })
  })
})

describe('gom ô đã sửa', () => {
  const a = nv()
  const b = nv({ id: 'b', code: '7010', rieng: { ...R, dienThoai: null } })
  const nguoi = new Map([
    ['a', a],
    ['b', b],
  ])
  const thuTu = { ids: ['a', 'b'], cots: ['chucDanh', 'cccd', 'dienThoai'] as const }
  it('đếm ô đổi + người, bỏ ô gõ lại như cũ, gói theo MÃ người', () => {
    const sua: SuaBang = {
      a: { dienThoai: '0976214558', chucDanh: 'Tổ trưởng' },
      b: { dienThoai: '0905123456', choO: 'Ấp 2' },
    }
    const t = tongHop(sua, nguoi, thuTu)
    expect(t.o).toBe(3)
    expect(t.nguoi).toBe(2)
    expect(t.loi).toEqual([])
    expect(t.goi).toEqual([
      { ma: '6143', o: { chucDanh: 'Tổ trưởng' } },
      { ma: '7010', o: { dienThoai: '0905123456', choO: 'Ấp 2' } },
    ])
  })
  it('ô sai xếp theo dòng rồi cột; người chỉ có ô sai không vào gói', () => {
    const sua: SuaBang = {
      b: { cccd: '123', dienThoai: '12' },
      a: { dienThoai: 'abc' },
    }
    const t = tongHop(sua, nguoi, thuTu)
    expect(t.loi.map((l) => `${l.id}.${l.cot}`)).toEqual([
      'a.dienThoai',
      'b.cccd',
      'b.dienThoai',
    ])
    expect(t.goi).toEqual([])
  })
})

describe('dán vùng Excel', () => {
  const ids = ['a', 'b', 'c']
  const cots = ['ngaySinh', 'cccd', 'dienThoai'] as const
  it('chạy sang phải theo cột sửa được, xuống theo dòng đang hiện; cắt phần thừa', () => {
    const r = danVung(
      '01/01/1990\t012345678901\n02/02/1991\t\n03/03/1992\tx\ty\tz\n',
      ids,
      cots,
      1,
      0,
    )
    expect(r).toEqual([
      { id: 'b', cot: 'ngaySinh', v: '01/01/1990' },
      { id: 'b', cot: 'cccd', v: '012345678901' },
      { id: 'c', cot: 'ngaySinh', v: '02/02/1991' },
    ])
  })
  it('nhận biết vùng nhiều ô; một ô (kể cả có xuống dòng cuối) thì không', () => {
    expect(laVung('a\tb')).toBe(true)
    expect(laVung('a\nb')).toBe(true)
    expect(laVung('0905123456\r\n')).toBe(false)
  })
})
