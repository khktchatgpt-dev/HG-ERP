'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { useLocalPref } from '@/lib/use-local-pref'
import { demLocNv, khopTimNv, soSanhMa, thuocLoc, type LocNv } from '@/lib/nhan-su/ho-so'
import type { DsNhanVien } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'

export type TrangDs = { nv: DsNhanVien; sua: boolean; homNay: string }

/** Tập đang lọc (localStorage) — trang hồ sơ đọc để ‹ › đi đúng thứ tự người xem đang thấy. */
export const KHOA_TAP = 'hr-nv-tap'
/** Bộ lọc của danh sách — quay lại từ hồ sơ thì giữ nguyên. */
const KHOA_LOC = 'hr-nv-loc'

type Loc = { loc: LocNv; tim: string; to: string }
const LOC_MAC_DINH: Loc = { loc: 'dang_lam', tim: '', to: '' }

function docLoc(s: string): Loc {
  try {
    return { ...LOC_MAC_DINH, ...(JSON.parse(s) as Partial<Loc>) }
  } catch {
    return LOC_MAC_DINH
  }
}

/** State + thao tác của danh sách nhân viên. Chip đếm bằng đúng hàm lọc của bảng. */
export function useNhanVienDs(h: TrangDs) {
  const router = useRouter()
  const toast = useToast()
  // Bộ lọc nhớ theo máy (useLocalPref = useSyncExternalStore): quay lại từ hồ sơ thì
  // giữ nguyên, không cần effect + setState.
  const [locRaw, ghiLoc] = useLocalPref(KHOA_LOC, JSON.stringify(LOC_MAC_DINH))
  const { loc, tim, to } = useMemo(() => docLoc(locRaw), [locRaw])
  const doiLoc = (p: Partial<Loc>) => ghiLoc(JSON.stringify({ loc, tim, to, ...p }))
  const [, ghiTap] = useLocalPref(KHOA_TAP, '[]')
  const [chon, setChon] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [moTuyen, setMoTuyen] = useState(false)
  const [moNap, setMoNap] = useState(false)

  const dem = useMemo(() => demLocNv(h.nv.ds, h.homNay), [h.nv.ds, h.homNay])
  const ds = useMemo(
    () =>
      h.nv.ds
        .filter(
          (n) =>
            thuocLoc(n, loc, h.homNay) &&
            khopTimNv(n, tim) &&
            (!to || (to === '__trong' ? !n.boPhan : n.boPhan === to)),
        )
        .sort((a, b) => soSanhMa(a.code, b.code)),
    [h.nv.ds, h.homNay, loc, tim, to],
  )

  function moHoSo(code: string) {
    ghiTap(JSON.stringify(ds.map((n) => n.code)))
    router.push(`/hr/nhan-vien/${encodeURIComponent(code)}`)
  }

  function batChon(id: string) {
    setChon((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function hangLoat(v: { shift_id?: string; team?: string }) {
    setBusy(true)
    try {
      await api('/api/dept/hr/cham-cong/nhan-vien/hang-loat', {
        method: 'POST',
        body: { ids: [...chon], ...v },
      })
      toast.success(`Đã đổi cho ${chon.size} người`)
      setChon(new Set())
      router.refresh()
      return true
    } catch (e) {
      toast.error('Chưa đổi được', apiErrorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  return {
    h,
    loc,
    setLoc: (l: LocNv) => {
      doiLoc({ loc: l })
      setChon(new Set())
    },
    tim,
    setTim: (v: string) => doiLoc({ tim: v }),
    to,
    setTo: (v: string) => doiLoc({ to: v }),
    dem,
    ds,
    chon,
    batChon,
    chonHet: (on: boolean) => setChon(on ? new Set(ds.map((n) => n.id)) : new Set()),
    boChon: () => setChon(new Set()),
    busy,
    hangLoat,
    moHoSo,
    moTuyen,
    moNap,
    setMoNap,
    setMoTuyen,
  } as const
}

export type DsCtx = ReturnType<typeof useNhanVienDs>
