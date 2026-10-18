'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import type { CachTinh } from '@/lib/cham-cong/ky-gio-cong'
import type { MoDieuChinh } from '../dieu-chinh-sheet'
import type { GioCong, NgayGio, Nhom, NguoiGio } from './gio-cong.shared'

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
  const [nguoiMo, setNguoiMo] = useState<string | null>(null)
  const [moDc, setMoDc] = useState<MoDieuChinh | null>(null)
  const [moTrua, setMoTrua] = useState(false)
  const [dangGhi, setDangGhi] = useState(false)

  const vp = useMemo(
    () => new Set(b.boPhan.filter((x) => x.cachTinh === 'ngay').map((x) => x.ten)),
    [b.boPhan],
  )

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
    nhom,
    chonNhom,
    vp,
    tim,
    setTim,
    dong,
    o,
    setO,
    nguoiMo,
    setNguoiMo,
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
