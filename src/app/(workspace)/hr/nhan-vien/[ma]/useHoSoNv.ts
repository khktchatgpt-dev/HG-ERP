'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { useLocalPref } from '@/lib/use-local-pref'
import type { HoSoNvTrang } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'
import { KHOA_TAP } from '../useNhanVienDs'

export type Muc = 'tong-quan' | 'lich-su'
export type HopBd = null | 'nghi' | 'lam_lai' | 'chuyen'

/** State + thao tác của trang hồ sơ một người (B2a). */
export function useHoSoNv(h: HoSoNvTrang, mucDau: Muc) {
  const router = useRouter()
  const toast = useToast()
  const n = h.n
  const [muc, setMucState] = useState<Muc>(mucDau)
  const [suaCv, setSuaCv] = useState(false)
  const [hop, setHop] = useState<HopBd>(null)
  const [busy, setBusy] = useState(false)
  // ‹ ›: tập người xem vừa lọc ở danh sách; không có người này thì danh sách mặc định.
  const [tapRaw] = useLocalPref(KHOA_TAP, '[]')
  const tap = useMemo(() => {
    try {
      const t = JSON.parse(tapRaw) as string[]
      return Array.isArray(t) && t.includes(n.code) ? t : h.dsMa
    } catch {
      return h.dsMa
    }
  }, [tapRaw, n.code, h.dsMa])

  const viTri = tap.indexOf(n.code)
  const di = (buoc: number) => {
    const ma = tap[viTri + buoc]
    if (ma) router.push(`/hr/nhan-vien/${encodeURIComponent(ma)}`)
  }

  function setMuc(m: Muc) {
    setMucState(m)
    const q = m === 'tong-quan' ? '' : `?muc=${m}`
    window.history.replaceState(
      null,
      '',
      `/hr/nhan-vien/${encodeURIComponent(n.code)}${q}`,
    )
  }

  async function chay(viec: () => Promise<unknown>, xong: string): Promise<boolean> {
    if (busy) return false
    setBusy(true)
    try {
      await viec()
      toast.success(xong)
      router.refresh()
      return true
    } catch (e) {
      toast.error('Chưa lưu được', apiErrorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  /** Lưu khối Công việc: sửa dữ liệu tại chỗ (không phải biến động chuyển tổ). */
  async function luuCongViec(v: {
    full_name: string
    team: string
    job_title: string
    shift_id: string
    attendance_exempt: boolean
    ngayVao: string
  }) {
    const ok = await chay(async () => {
      await api(`/api/dept/hr/cham-cong/nhan-vien/${n.id}`, {
        method: 'PATCH',
        body: {
          full_name: v.full_name,
          team: v.team,
          job_title: v.job_title,
          shift_id: v.shift_id,
          attendance_exempt: v.attendance_exempt,
        },
      })
      if (v.ngayVao !== (n.ngayVao ?? ''))
        await api(`/api/dept/hr/cham-cong/nhan-vien/${n.id}/bien-dong`, {
          method: 'POST',
          body: { viec: 'ngay_vao', ngay: v.ngayVao || null },
        })
    }, `Đã lưu công việc của ${v.full_name}`)
    if (ok) setSuaCv(false)
    return ok
  }

  const bienDong = (id: string, body: Record<string, unknown>, xong: string) =>
    chay(
      () =>
        api(`/api/dept/hr/cham-cong/nhan-vien/${id}/bien-dong`, { method: 'POST', body }),
      xong,
    )

  return {
    h,
    n,
    muc,
    setMuc,
    suaCv,
    setSuaCv,
    hop,
    setHop,
    busy,
    homNay: h.homNay,
    luuCongViec,
    bienDong,
    viTri,
    tongTap: tap.length,
    truoc: viTri > 0 ? () => di(-1) : undefined,
    sau: viTri >= 0 && viTri < tap.length - 1 ? () => di(1) : undefined,
  } as const
}

export type HoSoCtx = ReturnType<typeof useHoSoNv>
