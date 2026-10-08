'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import type { HoSoView } from './ho-so.shared'

/** Trường sửa được tại chỗ trên khối phiếu. */
export type OSua =
  | 'name'
  | 'name_foreign'
  | 'customer_name'
  | 'customer_item_code'
  | 'unit'
  | 'material'
  | 'hs_code'
  | 'origin_country'
  | 'length_mm'
  | 'width_mm'
  | 'height_mm'
  | 'net_weight_kg'
  | 'max_load_kg'

const SO: ReadonlySet<OSua> = new Set([
  'length_mm',
  'width_mm',
  'height_mm',
  'net_weight_kg',
  'max_load_kg',
])

/** State + xử lý của màn Hồ sơ SP: sửa tại chỗ từng ô, ảnh đang xem. */
export function useHoSo({
  d,
  canEdit,
  batDauSua = false,
}: {
  d: HoSoView
  canEdit: boolean
  /** Mở trang đã ở chế độ sửa (sau khi tạo SP mới). */
  batDauSua?: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [dangSua, setDangSua] = useState<OSua | null>(null)
  const [busy, setBusy] = useState<OSua | null>(null)
  const [anh, setAnh] = useState(0)
  /**
   * CHẾ ĐỘ SỬA bật/tắt ở đầu trang (08/10/2026, chủ dự án: "chưa phân biệt
   * được trạng thái chỉnh sửa hay là xem"): tắt = trang chỉ có chữ; bật = ô
   * nhập hiện ra ở phiếu, đóng gói, lưới định mức + dải vàng "Đang sửa".
   */
  const [cheDoSua, setCheDoSua] = useState(batDauSua && canEdit && !d.locked_at)
  /** Hồ sơ đã khoá thì không sửa tại chỗ — nói lý do ngay trên ô. */
  const khoa = !!d.locked_at
  const suaDuoc = canEdit && !khoa && cheDoSua

  /** Ghi MỘT trường. Trống → null. Số nhận cả "1.750" và "1750". */
  async function luu(field: OSua, raw: string): Promise<boolean> {
    const text = raw.trim()
    let value: string | number | null
    if (SO.has(field)) {
      if (!text) value = null
      else {
        const n = Number(text.replace(/\./g, '').replace(',', '.'))
        if (!Number.isFinite(n) || n < 0) {
          toast.error('Số không hợp lệ', `"${raw}" — gõ số, ví dụ 1750 hoặc 21,5`)
          return false
        }
        value = n
      }
    } else value = text || null
    const cur = d[field as keyof HoSoView] as string | number | null
    if ((cur ?? null) === value) {
      setDangSua(null)
      return true
    }
    setBusy(field)
    try {
      await api(`/api/dept/technical/products/${d.id}`, {
        method: 'PATCH',
        body: { [field]: value },
      })
      setDangSua(null)
      router.refresh()
      return true
    } catch (e) {
      toast.error('Chưa lưu được', e instanceof ApiError ? e.message : 'Có lỗi')
      return false
    } finally {
      setBusy(null)
    }
  }

  /**
   * Ghi ô tóm tắt đóng gói (jsonb `packing`): trộn lên giá trị cũ, khoá trống
   * thì XOÁ chứ không ghi null — cùng nếp với PackingEditor cũ.
   */
  const [busyPack, setBusyPack] = useState(false)
  async function luuPacking(
    patch: Record<string, number | string | null>,
  ): Promise<boolean> {
    const next: Record<string, unknown> = { ...d.packingJson }
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '') delete next[k]
      else next[k] = v
    }
    setBusyPack(true)
    try {
      await api(`/api/dept/technical/products/${d.id}`, {
        method: 'PATCH',
        body: { packing: next },
      })
      router.refresh()
      toast.success('Đã lưu', 'Quy cách đóng gói')
      return true
    } catch (e) {
      toast.error('Chưa lưu được', e instanceof ApiError ? e.message : 'Có lỗi')
      return false
    } finally {
      setBusyPack(false)
    }
  }

  return {
    canEdit,
    cheDoSua,
    setCheDoSua,
    dangSua,
    setDangSua,
    busy,
    luu,
    suaDuoc,
    khoa,
    anh,
    setAnh,
    router,
    toast,
    luuPacking,
    busyPack,
  } as const
}

export type HoSoCtx = ReturnType<typeof useHoSo>
