'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, apiErrorText } from '@/lib/api'
import { demNhom, soThayDoi, type NhomDoi } from '@/lib/lenh-doi'
import type { LoaiDongDm } from '@/lib/nhat-ky-dinh-muc'
import { normalizeSearch } from '@/lib/search-text'
import type { LenhDoiCuaLenh } from '@/modules/dept/supply/lenh-doi.service'

/** Đầu lệnh — chỉ thứ màn cần, không gửi cả bảng kê xuống trình duyệt. */
export type LenhSoat = {
  id: string
  code: string
  customer_name: string
  ship_date: string | null
  /** Mốc vật tư hiện tại — để nói "ngày xuất dời mà mốc vật tư chưa sửa theo". */
  materials_due_at: string | null
  /** Số SP và tổng SL sản phẩm của lệnh. */
  so_sp: number
  sl_sp: number
}

/** Ba tab của bản vẽ (FgRYhTxe…): Vật tư · Định mức · Lệnh SX. Đơn hàng thêm ở T4. */
export type TabSoat = 'vat_tu' | 'dinh_muc' | 'lenh'

/**
 * State của trang SOÁT THAY ĐỔI một lệnh. Mọi con số đọc từ `doi.thayDoi` — một
 * lần tính ở máy chủ, cùng hàm lúc ghi mốc, cùng hàm số trên menu.
 */
export function useSoatLenh({
  lsx,
  doi,
  canEdit,
}: {
  lsx: LenhSoat
  doi: LenhDoiCuaLenh
  canEdit: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const { thayDoi } = doi
  // Tab mở sẵn là tab CÓ VIỆC: vật tư đổi → Vật tư; chỉ có dòng định mức đổi
  // (đổi quy cách, chưa mã…) → Định mức; chỉ có thông tin lệnh đổi → Lệnh SX.
  const [tab, setTab] = useState<TabSoat>(
    thayDoi.dong.length > 0
      ? 'vat_tu'
      : thayDoi.dinhMuc.length > 0 || thayDoi.suaSauMoc
        ? 'dinh_muc'
        : thayDoi.lenh.length > 0
          ? 'lenh'
          : 'vat_tu',
  )
  const [loc, setLoc] = useState<NhomDoi | null>(null)
  const [q, setQ] = useState('')
  const [moSoat, setMoSoat] = useState(false)
  const [moLichSu, setMoLichSu] = useState(false)
  const [ghiChu, setGhiChu] = useState('')
  const [busy, setBusy] = useState(false)
  // Tab Định mức — lọc theo loại đổi + ô tìm, riêng với tab Vật tư.
  const [locDm, setLocDm] = useState<LoaiDongDm | null>(null)
  const [qDm, setQDm] = useState('')
  // Các mã vật tư đang mở ▸ (xem dòng định mức gây đổi).
  const [mo, setMo] = useState<ReadonlySet<string>>(new Set())

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

  const demDm = useMemo(() => {
    const out: Record<LoaiDongDm, number> = { them: 0, sua: 0, bo: 0 }
    for (const x of thayDoi.dinhMuc) out[x.loai]++
    return out
  }, [thayDoi.dinhMuc])
  const hienDm = useMemo(() => {
    const tk = normalizeSearch(qDm).split(/s+/).filter(Boolean)
    return thayDoi.dinhMuc.filter((x) => {
      if (locDm !== null && x.loai !== locDm) return false
      const chu = `${x.sp} ${x.truoc?.part_name ?? ''} ${x.sau?.part_name ?? ''} ${x.truoc?.material_code ?? ''} ${x.sau?.material_code ?? ''}` // prettier-ignore
      return tk.every((t) => normalizeSearch(chu).includes(t))
    })
  }, [thayDoi.dinhMuc, locDm, qDm])
  const lenhTheoKhoa = useMemo(
    () => new Map(thayDoi.lenh.map((x) => [x.key, x])),
    [thayDoi.lenh],
  )
  const dmTheoKhoa = useMemo(
    () => new Map(thayDoi.dinhMuc.map((x) => [x.key, x])),
    [thayDoi.dinhMuc],
  )
  function batMo(key: string) {
    setMo((cu) => {
      const moi = new Set(cu)
      if (!moi.delete(key)) moi.add(key)
      return moi
    })
  }

  /** Ghi mốc soát mới. Có người sửa thêm trong lúc xem thì máy chủ từ chối (409). */
  async function soat(): Promise<boolean> {
    setBusy(true)
    try {
      await api('/api/dept/supply/lsx-reviews', {
        method: 'POST',
        body: { production_order_id: lsx.id, dau: thayDoi.dau, note: ghiChu || null },
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
    lsx,
    canEdit,
    tab,
    setTab,
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
    locDm,
    setLocDm,
    qDm,
    setQDm,
    demDm,
    hienDm,
    dmTheoKhoa,
    lenhTheoKhoa,
    mo,
    batMo,
  } as const
}

export type SoatCtx = ReturnType<typeof useSoatLenh>
