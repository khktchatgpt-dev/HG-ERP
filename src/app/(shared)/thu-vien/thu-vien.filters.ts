import { PRODUCT_TYPE_CODES, FRAME_MATERIALS } from '@/lib/product-code'
import { isShowroomZone } from '@/lib/showroom'
import { isLifecycle } from '@/lib/product-lifecycle'
import { isThieuFilter } from '@/lib/ho-so-sp'
import type { ThuVienFilters } from './thu-vien.shared'

export type ThuVienSearch = Record<string, string | string[] | undefined>

export const thamSo = (v: string | string[] | undefined) =>
  (Array.isArray(v) ? v[0] : v) ?? ''

/**
 * URL → bộ lọc Thư viện SP. MỘT chỗ đọc cho `/thu-vien` và `/thu-vien/in-the`:
 * nút "In thẻ treo" mang nguyên query sang, màn in phải hiểu y như màn danh sách.
 */
export function docLocThuVien(sp: ThuVienSearch, canPrice: boolean): ThuVienFilters {
  const loaiRaw = thamSo(sp.loai).toUpperCase()
  const khungRaw = thamSo(sp.khung).toUpperCase()
  const thieuRaw = thamSo(sp.thieu)
  const ttRaw = thamSo(sp.tt)
  return {
    q: thamSo(sp.q).trim(),
    kh: thamSo(sp.kh),
    // Mã lạ trên URL coi như không lọc — không trả 0 dòng khó hiểu.
    loai: PRODUCT_TYPE_CODES.includes(loaiRaw as never) ? loaiRaw : '',
    khung: FRAME_MATERIALS.some((m) => m.code === khungRaw) ? khungRaw : '',
    hs: isLifecycle(thamSo(sp.hs)) ? thamSo(sp.hs) : '',
    thieu: isThieuFilter(thieuRaw) ? thieuRaw : '',
    kt: thamSo(sp.kt) === '1',
    tt: ttRaw === 'inactive' || ttRaw === 'all' ? ttRaw : 'active',
    lenh: thamSo(sp.lenh) === '1',
    // Hai chiều. URL cũ `mau=1` (= có mẫu) và `the=1` (= chưa treo) vẫn đọc được.
    mau: haiChieu(thamSo(sp.mau), 'co', 'chua'),
    the: haiChieu(thamSo(sp.the), 'da', 'chua', 'chua'),
    anh: haiChieu(thamSo(sp.anh), 'co', 'chua'),
    khu: isShowroomZone(thamSo(sp.khu)) ? thamSo(sp.khu) : '',
    gia: canPrice && thamSo(sp.gia) === '1',
  }
}

/** Tham số hai chiều: giá trị đúng tên, hoặc '1' cũ → `mot` (mặc định = chiều "có"). */
function haiChieu<A extends string, B extends string>(
  v: string,
  a: A,
  b: B,
  mot: A | B = a,
): '' | A | B {
  if (v === a || v === b) return v as A | B
  if (v === '1') return mot
  if (v === '0') return b
  return ''
}

/** Bộ lọc → query (đúng tham số URL của trang) — cho route xuất Excel và màn in thẻ. */
export function locQuery(f: ThuVienFilters): string {
  const p = new URLSearchParams()
  if (f.q) p.set('q', f.q)
  if (f.kh) p.set('kh', f.kh)
  if (f.loai) p.set('loai', f.loai)
  if (f.khung) p.set('khung', f.khung)
  if (f.hs) p.set('hs', f.hs)
  if (f.thieu) p.set('thieu', f.thieu)
  if (f.kt) p.set('kt', '1')
  p.set('tt', f.tt)
  if (f.lenh) p.set('lenh', '1')
  if (f.mau) p.set('mau', f.mau)
  if (f.the) p.set('the', f.the)
  if (f.anh) p.set('anh', f.anh)
  if (f.khu) p.set('khu', f.khu)
  return p.toString()
}
