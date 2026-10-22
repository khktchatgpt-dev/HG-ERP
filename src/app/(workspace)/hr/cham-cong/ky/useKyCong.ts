'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useToast } from '@/components/kit'
import { api, ApiError } from '@/lib/api'
import type { KyCongTrang, ToKy } from '@/modules/dept/hr/cham-cong/ky-cong.service'

export type { KyCongTrang, ToKy }

import type { MucKy } from './ky.shared'
export type { MucKy }

type Sheet = null | 'chot' | 'xin' | 'quyet' | 'khoang' | { xacNhan: string }

/** State + chuyển tiếp của màn Kỳ công. Mọi điều kiện lấy từ server (cùng hàm thuần). */
export function useKyCong(k: KyCongTrang, mucDau: MucKy) {
  const router = useRouter()
  const path = usePathname()
  const toast = useToast()
  const [muc, setMucState] = useState<MucKy>(mucDau)
  const [chon, setChon] = useState<string | null>(
    () => k.to.find((t) => !t.xacNhan)?.ten ?? k.to[0]?.ten ?? null,
  )
  const [sheet, setSheet] = useState<Sheet>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const toChon = k.to.find((t) => t.ten === chon) ?? null
  const chuaChot = k.dieuKien.filter((d) => !d.ok)
  const mo = k.trangThai === 'open' && !k.ngoaiErp

  const di = (thang: string, m: MucKy = muc) =>
    router.push(`${path}?thang=${thang}${m !== 'theo-to' ? `&muc=${m}` : ''}`)

  function setMuc(m: MucKy) {
    setMucState(m)
    router.replace(`${path}?thang=${k.thang}${m !== 'theo-to' ? `&muc=${m}` : ''}`, {
      scroll: false,
    })
  }

  async function viec(ten: string, body: Record<string, unknown>, xong: string) {
    setBusy(ten)
    try {
      await api(`/api/dept/hr/cham-cong/ky/${k.thang}`, { method: 'POST', body })
      toast.success(xong)
      setSheet(null)
      router.refresh()
      return true
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không thực hiện được — thử lại')
      return false
    } finally {
      setBusy(null)
    }
  }

  const xacNhan = (to: string, dongY0: boolean) =>
    viec('xn', { viec: 'xac_nhan', to, dongY0 }, `Đã xác nhận ${to}`)
  const boXacNhan = (to: string) =>
    viec('bo', { viec: 'bo_xac_nhan', to }, `${to}: đã bỏ xác nhận`)
  const chot = () =>
    viec(
      'chot',
      { viec: 'chot' },
      `Đã chốt kỳ ${k.thang.slice(5)}/${k.thang.slice(0, 4)} — đã báo Kế toán kiểm bảng lương`,
    )
  const xinMo = (lyDo: string) =>
    viec('xin', { viec: 'xin_mo', lyDo }, 'Đã gửi yêu cầu mở lại cho Kế toán trưởng')
  const rutXin = () => viec('rut', { viec: 'rut_xin' }, 'Đã rút yêu cầu mở lại')
  const datKhoang = (tu: string, den: string, lyDo: string) =>
    viec(
      'khoang',
      { viec: 'dat_khoang', tu, den, lyDo: lyDo.trim() || undefined },
      `Đã đặt kỳ ${k.thang.slice(5)}/${k.thang.slice(0, 4)}: ${tu.slice(8)}/${tu.slice(5, 7)} → ${den.slice(8)}/${den.slice(5, 7)} — Bảng công tính lại theo khoảng mới`,
    )
  /** Ghi công nhập tay một người (rời ô là ghi). Không đóng hộp, không toast khi thành công. */
  async function nhapTay(v: {
    ma: string
    cong: number | null
    tcGio: number | null
    ghiChu: string | null
  }) {
    setBusy(`nhap:${v.ma}`)
    try {
      await api(`/api/dept/hr/cham-cong/ky/${k.thang}`, {
        method: 'POST',
        body: { viec: 'nhap_tay', ...v },
      })
      router.refresh()
      return true
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không ghi được — thử lại')
      return false
    } finally {
      setBusy(null)
    }
  }
  /** Điền ô trống bằng số ngày làm việc gợi ý — không ghi đè số đã nhập. */
  async function dienGoiY() {
    const trong = k.khongCham.filter((x) => x.cong == null)
    setBusy('goi-y')
    try {
      for (const x of trong)
        await api(`/api/dept/hr/cham-cong/ky/${k.thang}`, {
          method: 'POST',
          body: {
            viec: 'nhap_tay',
            ma: x.ma,
            cong: x.ngayLamViec,
            tcGio: null,
            ghiChu: x.ghiChu,
          },
        })
      toast.success(
        `Đã điền gợi ý cho ${trong.length} người — kiểm lại từng số trước khi chốt`,
      )
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không điền được — thử lại')
    } finally {
      setBusy(null)
      router.refresh()
    }
  }
  const quyetMo = (dongY: boolean, ghiChu?: string) =>
    viec(
      'quyet',
      { viec: 'quyet_mo', dongY, ghiChu },
      dongY ? 'Đã mở lại kỳ' : 'Đã từ chối mở lại — kỳ vẫn chốt',
    )

  return {
    k,
    muc,
    setMuc,
    di,
    chon,
    setChon,
    toChon,
    chuaChot,
    mo,
    sheet,
    setSheet,
    busy,
    xacNhan,
    boXacNhan,
    chot,
    xinMo,
    rutXin,
    quyetMo,
    datKhoang,
    nhapTay,
    dienGoiY,
  } as const
}

export type KyCongCtx = ReturnType<typeof useKyCong>
