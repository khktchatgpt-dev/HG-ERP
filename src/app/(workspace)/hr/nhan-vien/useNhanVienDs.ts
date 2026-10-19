'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { useLocalPref } from '@/lib/use-local-pref'
import {
  demLocNv,
  khopTimNv,
  LOC_NV,
  soSanhMa,
  thuocLoc,
  type LocNv,
} from '@/lib/nhan-su/ho-so'
import type { DsNhanVien } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'

export type TrangDs = { nv: DsNhanVien; sua: boolean; homNay: string }

/** Tập đang lọc (sessionStorage) — trang hồ sơ đọc để ‹ › đi đúng thứ tự người xem đang thấy. */
export const KHOA_TAP = 'hr-nv-tap'
/** Bộ lọc của danh sách — quay lại từ hồ sơ thì giữ nguyên; tab mới thì về "Đang làm". */
const KHOA_LOC = 'hr-nv-loc'

type Loc = { loc: LocNv; tim: string; to: string }
const LOC_MAC_DINH: Loc = { loc: 'dang_lam', tim: '', to: '' }

function docLoc(s: string): Loc {
  try {
    const v = { ...LOC_MAC_DINH, ...(JSON.parse(s) as Partial<Loc>) }
    // Chip cũ đã bỏ (vd. 'thieu') thì về mặc định, không để bảng rỗng không lý do.
    return LOC_NV.some((l) => l.id === v.loc) ? v : { ...v, loc: LOC_MAC_DINH.loc }
  } catch {
    return LOC_MAC_DINH
  }
}

/** State + thao tác của danh sách nhân viên. Chip đếm bằng đúng hàm lọc của bảng. */
export function useNhanVienDs(h: TrangDs) {
  const router = useRouter()
  const toast = useToast()
  // Bộ lọc nhớ trong PHIÊN (useLocalPref 'session' = useSyncExternalStore): quay lại từ
  // hồ sơ thì giữ nguyên, không cần effect + setState.
  const [locRaw, ghiLoc] = useLocalPref(KHOA_LOC, JSON.stringify(LOC_MAC_DINH), 'session')
  const { loc, tim, to } = useMemo(() => docLoc(locRaw), [locRaw])
  const doiLoc = (p: Partial<Loc>) => ghiLoc(JSON.stringify({ loc, tim, to, ...p }))
  const [, ghiTap] = useLocalPref(KHOA_TAP, '[]', 'session')
  const [chon, setChon] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [moTuyen, setMoTuyen] = useState(false)
  const [moNap, setMoNap] = useState(false)

  // Chip đếm TRONG tổ + ô tìm đang chọn (Q3): số trên chip = số dòng bấm vào sẽ thấy.
  const pham = useMemo(
    () =>
      h.nv.ds.filter(
        (n) =>
          khopTimNv(n, tim) && (!to || (to === '__trong' ? !n.boPhan : n.boPhan === to)),
      ),
    [h.nv.ds, tim, to],
  )
  const dem = useMemo(() => demLocNv(pham, h.homNay), [pham, h.homNay])
  const ds = useMemo(
    () =>
      pham
        .filter((n) => thuocLoc(n, loc, h.homNay))
        .sort((a, b) => soSanhMa(a.code, b.code)),
    [pham, h.homNay, loc],
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
