'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { trongThoiGianLam, type CachTinh } from '@/lib/cham-cong/ky-gio-cong'
import type { MoDieuChinh } from '../dieu-chinh-sheet'
import {
  chiTietNgay,
  tongCong,
  type CongNgay,
  type TongCong,
} from '@/lib/cham-cong/chi-tiet-cong'
import {
  ngayKy,
  type GioCong,
  type NgayGio,
  type Nhom,
  type NguoiGio,
} from './gio-cong.shared'

/** State + xử lý của màn Bảng giờ công. */
export function useGioCong(b: GioCong, bpDau: string | undefined) {
  const router = useRouter()
  const toast = useToast()
  const [nhom, setNhom] = useState<Nhom>(() =>
    bpDau === 'vp'
      ? { kieu: 'vp' }
      : bpDau === 'all'
        ? { kieu: 'all' }
        : {
            kieu: 'bp',
            ten: b.boPhan.some((x) => x.ten === bpDau)
              ? bpDau!
              : (b.boPhan.find((x) => x.cachTinh === 'khung')?.ten ??
                b.boPhan[0]?.ten ??
                ''),
          },
  )
  const [tim, setTim] = useState('')
  const [o, setO] = useState<{ ma: string; ngay: string; x: number; y: number } | null>(
    null,
  )
  const [moDc, setMoDc] = useState<MoDieuChinh | null>(null)
  const [moTrua, setMoTrua] = useState(false)
  const [dangGhi, setDangGhi] = useState(false)

  const vp = useMemo(
    () => new Set(b.boPhan.filter((x) => x.cachTinh === 'ngay').map((x) => x.ten)),
    [b.boPhan],
  )
  /** Ngăn đang xem: lưới trạng thái từng ngày, hay bảng tổng hợp theo người. */
  const [xem, setXem] = useState<'luoi' | 'tong'>('luoi')

  /**
   * Công từng ô, chia bằng CHÍNH hàm trang Chấm công một người dùng (`chiTietNgay`) —
   * số trong khung nổi, cột tổng và ngăn Tổng hợp khớp trang một người.
   * Ngày đã lấy dữ liệu = cả công ty có lượt và trước ngày đang dở (chưa lấy thì không vắng).
   */
  const cong = useMemo(() => {
    const ngays = ngayKy(b.tu, b.den)
    const coLuot = new Set(
      b.nguoi.flatMap((n) => n.ngay.filter((x) => x.luot.length).map((x) => x.ngay)),
    )
    const moc = b.ngayLay && b.ngayLay < b.homNay ? b.ngayLay : b.homNay
    const daLay = (iso: string) => coLuot.has(iso) && iso < moc
    const out = new Map<string, { ngay: Map<string, CongNgay>; tong: TongCong }>()
    for (const n of b.nguoi) {
      const theo = new Map(n.ngay.map((x) => [x.ngay, x]))
      const ds = ngays
        .filter((iso) => iso < b.homNay)
        .map((iso) => chiTietNgay(iso, theo.get(iso), b.thamSo, n.cachTinh, b.le))
      out.set(n.ma, {
        ngay: new Map(ds.map((x) => [x.ngay, x])),
        // Trước ngày vào / sau ngày làm cuối không còn là "vắng".
        tong: tongCong(ds, (iso) => daLay(iso) && trongThoiGianLam(n, iso)),
      })
    }
    return { cua: out, daLay }
  }, [b])

  const dong = useMemo(() => {
    const q = tim.trim().toLowerCase()
    // Gom theo bộ phận (đúng thứ tự danh sách bộ phận) để mỗi bộ phận một dòng tiêu đề.
    const thuTu = new Map(b.boPhan.map((x, i) => [x.ten, i]))
    return b.nguoi
      .filter(
        (n) =>
          (nhom.kieu === 'all' ||
            (nhom.kieu === 'vp' ? vp.has(n.boPhan ?? '') : n.boPhan === nhom.ten)) &&
          (!q || n.ma.toLowerCase().includes(q) || n.ten.toLowerCase().includes(q)),
      )
      .sort(
        (x, y) =>
          (thuTu.get(x.boPhan ?? '') ?? 999) - (thuTu.get(y.boPhan ?? '') ?? 999) ||
          x.ma.localeCompare(y.ma, 'vi', { numeric: true }),
      )
  }, [b.nguoi, b.boPhan, nhom, tim, vp])

  function chonNhom(n: Nhom) {
    setNhom(n)
    setO(null)
    const bp = n.kieu === 'bp' ? n.ten : n.kieu
    router.replace(
      `/hr/cham-cong/gio-cong?thang=${b.thang}&bp=${encodeURIComponent(bp)}`,
      { scroll: false },
    )
  }

  function xemThang(t: string) {
    const bp = nhom.kieu === 'bp' ? nhom.ten : nhom.kieu
    router.push(`/hr/cham-cong/gio-cong?thang=${t}&bp=${encodeURIComponent(bp)}`)
  }

  const nguoiCua = (ma: string) => b.nguoi.find((n) => n.ma === ma)
  const ngayCua = (n: NguoiGio, ngay: string): NgayGio | undefined =>
    n.ngay.find((x) => x.ngay === ngay)

  function moDieuChinh(ma: string, ngay: string) {
    const n = nguoiCua(ma)
    if (!n) return
    const x = ngayCua(n, ngay)
    setO(null)
    setMoDc({
      ma,
      ten: n.ten,
      to: n.boPhan,
      ca: n.cachTinh === 'ngay' ? 'tính theo ngày' : 'tính theo khung giờ',
      ngay,
      luot: b.luotMay[`${ma}|${ngay}`] ?? [],
      loi: x?.thieu ? 'Chỉ 1 lượt — không tính được giờ' : undefined,
    })
  }

  /** Ghi / bỏ tick làm trưa. */
  async function ghiTrua(muc: { ma: string; ngay: string; phut: number | null }[]) {
    if (!muc.length || dangGhi) return false
    setDangGhi(true)
    try {
      await api('/api/dept/hr/cham-cong/trua', { method: 'POST', body: { muc } })
      const co = muc.filter((m) => m.phut != null).length
      toast.success(
        co
          ? `Đã tick làm trưa ${co} người-ngày`
          : `Đã bỏ tick làm trưa ${muc.length} người-ngày`,
      )
      router.refresh()
      return true
    } catch (e) {
      toast.error('Không ghi được làm trưa', apiErrorText(e))
      return false
    } finally {
      setDangGhi(false)
    }
  }

  async function doiCachTinh(boPhan: string, cachTinh: CachTinh) {
    setDangGhi(true)
    try {
      await api('/api/dept/hr/cham-cong/cach-tinh', {
        method: 'POST',
        body: { boPhan, cachTinh },
      })
      toast.success(
        `${boPhan}: ${cachTinh === 'ngay' ? 'tính theo ngày' : 'tính theo khung giờ'}`,
      )
      router.refresh()
    } catch (e) {
      toast.error('Không đổi được cách tính', apiErrorText(e))
    } finally {
      setDangGhi(false)
    }
  }

  return {
    b,
    xem,
    setXem,
    congCua: (ma: string) => cong.cua.get(ma),
    daLay: cong.daLay,
    nhom,
    chonNhom,
    vp,
    tim,
    setTim,
    dong,
    o,
    setO,
    nguoiCua,
    ngayCua,
    moDc,
    setMoDc,
    moDieuChinh,
    moTrua,
    setMoTrua,
    dangGhi,
    ghiTrua,
    doiCachTinh,
    xemThang,
    lamMoi: () => router.refresh(),
  } as const
}

export type GioCongCtx = ReturnType<typeof useGioCong>
