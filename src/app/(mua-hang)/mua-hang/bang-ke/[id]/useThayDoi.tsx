'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, apiErrorText } from '@/lib/api'
import { demNhom, soThayDoi, type NhomDoi } from '@/lib/lenh-doi'
import { normalizeSearch } from '@/lib/search-text'
import type { LenhDoiCuaLenh } from '@/modules/dept/supply/lenh-doi.service'

/**
 * State của tab "Thay đổi chờ soát" (0282). Số trên tab, chip và nút "Đã soát"
 * đều đếm từ `doi.thayDoi` — một lần tính ở máy chủ, cùng hàm lúc ghi mốc.
 */
export function useThayDoi({ lsxId, doi }: { lsxId: string; doi: LenhDoiCuaLenh }) {
  const router = useRouter()
  const toast = useToast()
  const [loc, setLoc] = useState<NhomDoi | null>(null)
  const [q, setQ] = useState('')
  const [moSoat, setMoSoat] = useState(false)
  const [moLichSu, setMoLichSu] = useState(false)
  const [ghiChu, setGhiChu] = useState('')
  const [busy, setBusy] = useState(false)

  const { thayDoi } = doi
  const dem = useMemo(() => demNhom(thayDoi.dong), [thayDoi.dong])
  const soDoi = soThayDoi(thayDoi)
  const hien = useMemo(() => {
    const tk = normalizeSearch(q).split(/\s+/).filter(Boolean)
    return thayDoi.dong.filter(
      (r) =>
        (loc === null || r.nhom === loc) &&
        tk.every((t) => normalizeSearch(`${r.code ?? ''} ${r.name}`).includes(t)),
    )
  }, [thayDoi.dong, loc, q])

  /** Ghi mốc soát mới. Có người sửa thêm trong lúc xem thì máy chủ từ chối (409). */
  async function soat(): Promise<boolean> {
    setBusy(true)
    try {
      await api('/api/dept/supply/lsx-reviews', {
        method: 'POST',
        body: { production_order_id: lsxId, dau: thayDoi.dau, note: ghiChu || null },
      })
      setMoSoat(false)
      setGhiChu('')
      setLoc(null)
      router.refresh()
      toast.success(
        soDoi > 0 ? `Đã soát ${soDoi} thay đổi — lần sau chỉ hiện phần đổi mới` : 'Đã ghi mốc soát', // prettier-ignore
      )
      return true
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) {
        setMoSoat(false)
        router.refresh()
      }
      toast.error('Chưa ghi được mốc soát', apiErrorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  return {
    ...doi,
    dem,
    soDoi,
    hien,
    loc,
    setLoc,
    q,
    setQ,
    moSoat,
    setMoSoat,
    moLichSu,
    setMoLichSu,
    ghiChu,
    setGhiChu,
    busy,
    soat,
  } as const
}

export type ThayDoiCtx = ReturnType<typeof useThayDoi>
