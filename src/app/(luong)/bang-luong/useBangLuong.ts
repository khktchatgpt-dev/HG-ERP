'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useToast } from '@/components/kit'
import { api, ApiError } from '@/lib/api'
import type { BangLuongTrang, MucBl } from './bang-luong.shared'

export type HopBl = null | 'gui' | 'quyet' | 'mo_lai' | 'chi'

/** State + chuyển tiếp của màn Bảng lương. Điều kiện gửi duyệt lấy từ server (cùng hàm kiểm). */
export function useBangLuong(b: BangLuongTrang, mucDau: MucBl) {
  const router = useRouter()
  const path = usePathname()
  const toast = useToast()
  const [muc, setMucState] = useState<MucBl>(mucDau)
  const [chon, setChon] = useState<string | null>(null)
  const [hop, setHop] = useState<HopBl>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [tim, setTim] = useState('')

  const tt = b.bang?.trangThai ?? null
  const nhap = !tt || tt === 'draft'
  const daTinh = !!b.bang?.lanTinh
  const vuong = b.dieuKien.filter((x) => !x.ok)
  const phieuChon = b.phieu.find((p) => p.employeeId === chon) ?? null

  const di = (thang: string) => router.push(`${path}?thang=${thang}`)
  function setMuc(m: MucBl) {
    setMucState(m)
    router.replace(`${path}?thang=${b.thang}${m !== 'bang' ? `&muc=${m}` : ''}`, {
      scroll: false,
    })
  }

  async function viec(ten: string, body: Record<string, unknown>, xong: string) {
    setBusy(ten)
    try {
      await api(`/api/dept/hr/luong/bang/${b.thang}`, { method: 'POST', body })
      toast.success(xong)
      setHop(null)
      router.refresh()
      return true
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không thực hiện được — thử lại')
      return false
    } finally {
      setBusy(null)
    }
  }

  return {
    b,
    muc,
    setMuc,
    di,
    chon,
    setChon,
    phieuChon,
    hop,
    setHop,
    busy,
    tim,
    setTim,
    tt,
    nhap,
    daTinh,
    vuong,
    tinh: () =>
      viec(
        'tinh',
        { viec: 'tinh' },
        `Đã tính bảng lương kỳ ${b.thang.slice(5)}/${b.thang.slice(0, 4)}`,
      ),
    gui: (ghiChu?: string) =>
      viec(
        'gui',
        { viec: 'gui', ghiChu: ghiChu?.trim() || null },
        'Đã gửi sếp duyệt — sếp được báo',
      ),
    rut: () => viec('rut', { viec: 'rut' }, 'Đã rút về nháp'),
    quyet: (dongY: boolean, lyDo?: string) =>
      viec(
        'quyet',
        { viec: 'quyet', dongY, lyDo },
        dongY ? 'Đã duyệt bảng lương' : 'Đã trả lại Kế toán',
      ),
    moLai: (lyDo: string) =>
      viec('mo_lai', { viec: 'mo_lai', lyDo }, 'Đã rút bảng lương về nháp'),
    chi: () => viec('chi', { viec: 'chi' }, 'Đã đánh dấu đã chi'),
    themKhoan: (
      ds: { employeeId: string; loai: string; tien: number; ghiChu: string | null }[],
    ) => viec('khoan', { viec: 'them_khoan', ds }, `Đã thêm ${ds.length} khoản`),
    xoaKhoan: (id: string) => viec('xoa', { viec: 'xoa_khoan', id }, 'Đã xoá khoản'),
  } as const
}

export type BangLuongCtx = ReturnType<typeof useBangLuong>
