'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useToast } from '@/components/kit'
import { api, ApiError } from '@/lib/api'
import { khongDau } from '@/lib/luong/ho-so-luong'
import type {
  ChiTiet,
  DongHoSo,
  DongXemNap,
  HoSoTrang,
} from '@/modules/dept/hr/luong/ho-so-luong.service'

export type { ChiTiet, DongHoSo, DongXemNap, HoSoTrang }

export type Loc =
  'tat_ca' | 'thieu_luong' | 'thieu_stk' | 'thieu_bh' | 'doi' | 'khong_cham'

export const LOC: {
  id: Loc
  ten: string
  dung: (d: DongHoSo) => boolean
  bao?: boolean
}[] = [
  { id: 'tat_ca', ten: 'Tất cả', dung: () => true },
  {
    id: 'thieu_luong',
    ten: 'Thiếu đơn giá / lương',
    dung: (d) => d.thieu.luong,
    bao: true,
  },
  { id: 'thieu_stk', ten: 'Thiếu STK', dung: (d) => d.thieu.stk, bao: true },
  { id: 'thieu_bh', ten: 'Thiếu lương đóng BH', dung: (d) => d.thieu.bh, bao: true },
  { id: 'doi', ten: 'Đổi từ kỳ này', dung: (d) => d.doiTuKyNay },
  { id: 'khong_cham', ten: 'Không chấm công', dung: (d) => d.khongCham },
]

export type Sheet = null | 'nap' | 'to' | 'phu_cap'

const API = '/api/dept/hr/luong'

/** State + thao tác của màn Hồ sơ lương. Số trên chip đếm bằng đúng hàm lọc của bảng. */
export function useHoSoLuong(h: HoSoTrang) {
  const router = useRouter()
  const path = usePathname()
  const toast = useToast()
  const [loc, setLoc] = useState<Loc>('tat_ca')
  const [tim, setTim] = useState('')
  const [chon, setChon] = useState<string | null>(null)
  const [chiTiet, setChiTiet] = useState<ChiTiet | null>(null)
  const [sheet, setSheet] = useState<Sheet>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const dem = useMemo(
    () =>
      Object.fromEntries(LOC.map((l) => [l.id, h.dong.filter(l.dung).length])) as Record<
        Loc,
        number
      >,
    [h.dong],
  )
  const ds = useMemo(() => {
    const f = LOC.find((l) => l.id === loc)!.dung
    const q = khongDau(tim)
    return h.dong.filter(
      (d) =>
        f(d) && (!q || d.ma.toLowerCase().includes(q) || khongDau(d.ten).includes(q)),
    )
  }, [h.dong, loc, tim])
  const dongChon = h.dong.find((d) => d.employeeId === chon) ?? null
  const thieuAi = h.dong.filter((d) => d.thieu.luong || d.thieu.stk || d.thieu.bh).length

  const xemKy = (t: string) => router.push(`${path}?thang=${t}`)

  async function chonNguoi(id: string) {
    setChon(id)
    setChiTiet(null)
    try {
      setChiTiet(await api<ChiTiet>(`${API}?nv=${id}`))
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không tải được hồ sơ')
    }
  }

  async function goi<T>(
    ten: string,
    body: Record<string, unknown>,
    xong?: string,
  ): Promise<T | null> {
    setBusy(ten)
    try {
      const r = await api<T>(API, { method: 'POST', body })
      if (xong) toast.success(xong)
      return r
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không thực hiện được — thử lại')
      return null
    } finally {
      setBusy(null)
    }
  }

  async function sauGhi() {
    router.refresh()
    if (chon) await chonNguoi(chon)
  }

  return {
    h,
    loc,
    setLoc,
    tim,
    setTim,
    dem,
    ds,
    chon,
    chonNguoi,
    dongChon,
    chiTiet,
    thieuAi,
    sheet,
    setSheet,
    busy,
    xemKy,
    goi,
    sauGhi,
    dongLai: () => {
      setChon(null)
      setChiTiet(null)
    },
  } as const
}

export type HoSoLuongCtx = ReturnType<typeof useHoSoLuong>
