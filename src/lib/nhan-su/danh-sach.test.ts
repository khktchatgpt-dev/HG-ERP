import { describe, expect, it } from 'vitest'
import {
  demTrong,
  demViec,
  khopTimDs,
  laTrong,
  locDs,
  nhomBoPhan,
  phamViDs,
  thuTuDs,
  type BoLocDs,
  type NvDsTom,
  type RiengDs,
} from './danh-sach'

const R: RiengDs = {
  gioiTinh: 'male',
  ngaySinh: '1994-09-21',
  cccd4: '2208',
  ngayCap: null,
  noiCap: null,
  mst4: null,
  dienThoai: '0976214558',
  choO: 'Khu phố 2',
  thuongTru: null,
  khanCap: null,
  khanCapSdt: null,
}
let id = 0
const nv = (p: Partial<NvDsTom> = {}): NvDsTom => ({
  id: String(++id),
  code: '105',
  hoTen: 'Nguyễn Văn Phúc',
  boPhan: 'Tổ Sơn Sắt',
  chucDanh: 'Công nhân',
  ngayVao: '2023-05-08',
  ngayCuoi: null,
  active: true,
  khongChamCong: false,
  tenTuMay: false,
  ma: [{}],
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
const H = '2026-11-02'
const L0: BoLocDs = { tab: 'dang_lam', viec: null, tim: '', to: '', trong: null }

describe('ô trống theo cột', () => {
  it('cột công việc đọc từ dòng, cột cá nhân đọc từ phần riêng', () => {
    const n = nv({ chucDanh: null, rieng: { ...R, dienThoai: null } })
    expect(laTrong(n, 'chuc_vu')).toBe(true)
    expect(laTrong(n, 'dien_thoai')).toBe(true)
    expect(laTrong(n, 'cccd')).toBe(false)
    expect(laTrong(n, 'thuong_tru')).toBe(true)
  })
  it('không có quyền xem riêng → cột cá nhân KHÔNG tính là trống', () => {
    const n = nv({ rieng: null })
    expect(laTrong(n, 'dien_thoai')).toBe(false)
    expect(laTrong(n, 'ngay_sinh')).toBe(false)
    expect(laTrong(n, 'ngay_vao')).toBe(false)
  })
  it('đếm trống = số dòng lọc ra khi bấm', () => {
    const ds = [nv(), nv({ rieng: { ...R, dienThoai: null } }), nv({ rieng: null })]
    const n = demTrong(ds, 'dien_thoai')
    expect(n).toBe(1)
    expect(locDs(ds, { ...L0, trong: 'dien_thoai' }, H)).toHaveLength(n)
  })
})

describe('tìm', () => {
  it('SĐT từ 3 số, gõ có dấu cách / chấm vẫn khớp', () => {
    expect(khopTimDs(nv(), '0976')).toBe(true)
    expect(khopTimDs(nv(), '214 558')).toBe(true)
    expect(khopTimDs(nv(), '0976.214.558')).toBe(true)
    expect(khopTimDs(nv(), '0911')).toBe(false)
  })
  it('đúng 4 số cuối CCCD; 3 số không khớp CCCD', () => {
    expect(khopTimDs(nv(), '2208')).toBe(true)
    expect(khopTimDs(nv({ rieng: { ...R, dienThoai: null } }), '208')).toBe(false)
  })
  it('không có quyền riêng: không khớp theo SĐT / CCCD', () => {
    expect(khopTimDs(nv({ rieng: null }), '2208')).toBe(false)
  })
  it('mã, họ tên không dấu vẫn khớp như cũ', () => {
    expect(khopTimDs(nv(), 'phuc')).toBe(true)
    expect(khopTimDs(nv(), '105')).toBe(true)
  })
})

describe('ô việc tồn', () => {
  const ds = [
    nv({ chucDanh: null }),
    nv({ ngayVao: null }),
    nv({ boPhan: null, tenTuMay: true }),
    nv({ active: false, chucDanh: null }),
    nv({ ngayVao: '2026-10-20' }),
  ]
  it('đếm trên người đang làm; người nghỉ không vào ô việc', () => {
    const d = demViec(phamViDs(ds, L0), H)
    expect(d.chua_chuc_vu).toBe(1)
    expect(d.chua_ngay_vao).toBe(1)
    expect(d.chua_to).toBe(1)
    expect(d.ten_may).toBe(1)
    expect(d.moi_vao).toBe(1)
  })
  it('số trên ô = số dòng bấm vào', () => {
    const d = demViec(phamViDs(ds, L0), H)
    for (const v of ['chua_chuc_vu', 'chua_to', 'moi_vao'] as const)
      expect(locDs(ds, { ...L0, viec: v }, H)).toHaveLength(d[v])
  })
  it('tab Đã nghỉ / Tất cả', () => {
    expect(phamViDs(ds, { ...L0, tab: 'da_nghi' })).toHaveLength(1)
    expect(phamViDs(ds, { ...L0, tab: 'tat_ca' })).toHaveLength(5)
  })
  it('lọc bộ phận "__trong" = chưa có bộ phận', () => {
    expect(phamViDs(ds, { ...L0, to: '__trong' })).toHaveLength(1)
  })
})

describe('nhóm theo bộ phận', () => {
  const ds = [
    nv({ code: '31', boPhan: 'Tổ Phôi' }),
    nv({ code: '5', boPhan: 'Tổ Phôi' }),
    nv({ code: '7', boPhan: null }),
    nv({ code: '2', boPhan: 'Kho' }),
  ]
  it('chưa có bộ phận đứng đầu, rồi theo tên; trong nhóm theo mã số', () => {
    const g = nhomBoPhan(ds)
    expect(g.map((x) => x.boPhan)).toEqual([null, 'Kho', 'Tổ Phôi'])
    expect(g[2].ds.map((n) => n.code)).toEqual(['5', '31'])
  })
  it('thứ tự ‹ › theo đúng lưới: có nhóm / không nhóm', () => {
    expect(thuTuDs(ds, true).map((n) => n.code)).toEqual(['7', '2', '5', '31'])
    expect(thuTuDs(ds, false).map((n) => n.code)).toEqual(['2', '5', '7', '31'])
  })
})
