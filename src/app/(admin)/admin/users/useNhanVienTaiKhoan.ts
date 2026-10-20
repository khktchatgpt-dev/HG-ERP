'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/kit'
import { api, ApiError } from '@/lib/api'
import {
  demLoc,
  hienMacDinh,
  khopTim,
  thuocLoc,
  type DongNvTk,
  type Loc,
  type NvGoc,
  type TkGoc,
} from '@/lib/nhan-vien-tai-khoan'
import type { NhanVienTaiKhoanData } from '@/modules/core/users/nhan-vien-tai-khoan.service'

export type Phong = { id: string; name: string }
export type TrangNvTk = NhanVienTaiKhoanData & { phong: Phong[]; toi: string }

/** Hộp đang mở — mỗi hộp mang đúng thứ nó cần. */
export type Hop =
  | null
  | { kieu: 'cap'; nv: NvGoc }
  | { kieu: 'gan'; tk: TkGoc }
  | { kieu: 'tk'; tk: TkGoc; nv: NvGoc | null }
  | { kieu: 'tao_chung' }
  | { kieu: 'goi_y' }

/** State + thao tác của màn Nhân viên & tài khoản. Chip đếm bằng đúng hàm lọc của bảng. */
export function useNhanVienTaiKhoan(h: TrangNvTk) {
  const router = useRouter()
  const toast = useToast()
  const [loc, setLoc] = useState<Loc>('tat_ca')
  const [tim, setTim] = useState('')
  const [hienHet, setHienHet] = useState(false)
  const [hop, setHop] = useState<Hop>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const dem = useMemo(() => demLoc(h.dong, hienHet), [h.dong, hienHet])
  const ds = useMemo(() => {
    // "Đã nghỉ còn tài khoản" luôn hiện, kể cả khi không bật hiện hết.
    const thay = hienHet ? h.dong : h.dong.filter(hienMacDinh)
    return thay.filter((d) => thuocLoc(d, loc) && khopTim(d, tim))
  }, [h.dong, hienHet, loc, tim])

  const tenPhong = (id: string | null) =>
    id ? (h.phong.find((p) => p.id === id)?.name ?? '—') : '—'

  /** Nhân viên đang làm chưa có tài khoản — ứng viên cho hộp Gắn nhân viên. */
  const nvChuaCo = useMemo(
    () =>
      h.dong
        .filter(
          (d): d is Extract<DongNvTk, { kieu: 'nv' }> =>
            d.kieu === 'nv' && d.nv.dangLam && (!d.tk || !!d.tk.xoaLuc),
        )
        .map((d) => d.nv),
    [h.dong],
  )

  async function goi<T>(
    ten: string,
    url: string,
    method: 'POST' | 'PATCH' | 'DELETE',
    body: Record<string, unknown> | undefined,
    xong?: string,
  ): Promise<T | null> {
    setBusy(ten)
    try {
      const r = await api<T>(url, { method, body })
      if (xong) toast.success(xong)
      router.refresh()
      return r
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không thực hiện được — thử lại')
      return null
    } finally {
      setBusy(null)
    }
  }

  return {
    h,
    loc,
    setLoc,
    tim,
    setTim,
    hienHet,
    setHienHet,
    dem,
    ds,
    hop,
    setHop,
    dongHop: () => setHop(null),
    busy,
    goi,
    toast,
    tenPhong,
    nvChuaCo,
  } as const
}

export type NvTkCtx = ReturnType<typeof useNhanVienTaiKhoan>
