'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { canXuLy, type BangCong } from '../cham-cong.shared'

export type Muc = 'bang' | 'thieu' | 'ngoai' | 'ma' | 'ca'

/**
 * State + xử lý của màn Bảng công (bản vòng 1). Lấy dữ liệu từ máy đã dời sang
 * trang Lấy dữ liệu (B1, 12/10/2026); B4 sẽ làm lại màn này thành "bấm mới tính".
 */
export function useChamCong(b: BangCong) {
  const router = useRouter()
  const [muc, setMuc] = useState<Muc>('bang')
  const [tim, setTim] = useState('')
  const [ca, setCa] = useState('')
  const [chiCanXuLy, setChiCanXuLy] = useState(false)
  const [chon, setChon] = useState<{ id: string; ngay: number } | null>(null)

  const dong = useMemo(() => {
    const q = tim.trim().toLowerCase()
    return b.nguoi.filter(
      (n) =>
        (!q || n.code.toLowerCase().includes(q) || n.ten.toLowerCase().includes(q)) &&
        (!ca || n.ca === ca) &&
        (!chiCanXuLy || canXuLy(n) > 0),
    )
  }, [b.nguoi, tim, ca, chiCanXuLy])

  const tong = useMemo(() => {
    const t = {
      cong: 0,
      tangCa: 0,
      chuNhat: 0,
      le: 0,
      thieu: 0,
      ngoai: 0,
      tre: 0,
      ngayNguoi: 0,
    }
    for (const n of b.nguoi) {
      t.cong += n.tong.cong
      t.tangCa += n.tong.tangCa
      t.chuNhat += n.tong.chuNhat
      t.le += n.tong.le
      t.thieu += n.tong.thieu
      t.ngoai += n.tong.ngoai
      t.tre += n.tong.tre
      t.ngayNguoi += Object.keys(n.ngay).length
    }
    return t
  }, [b.nguoi])

  const nguoiChon = chon ? b.nguoi.find((n) => n.id === chon.id) : undefined
  const ngayChon = nguoiChon && chon ? nguoiChon.ngay[chon.ngay] : undefined

  function xemThang(t: string) {
    setChon(null)
    router.push(`/hr/cham-cong/bang-cong?thang=${t}`)
  }

  return {
    b,
    muc,
    setMuc,
    tim,
    setTim,
    ca,
    setCa,
    chiCanXuLy,
    setChiCanXuLy,
    dong,
    tong,
    chon,
    setChon,
    nguoiChon,
    ngayChon,
    xemThang,
  } as const
}

export type ChamCongCtx = ReturnType<typeof useChamCong>
