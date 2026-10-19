'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { useLocalPref } from '@/lib/use-local-pref'
import type {
  HoSoNvTrang,
  KhoiCaNhan,
} from '@/modules/dept/hr/cham-cong/ho-so-nv.service'
import type { HdDong } from '@/modules/dept/hr/cham-cong/hop-dong.repo'
import { KHOA_TAP } from '../useNhanVienDs'
import type { Muc } from './muc'

export type { Muc }

export type HopBd = null | 'nghi' | 'lam_lai' | 'chuyen'

/** State + thao tác của trang hồ sơ một người (B2a). */
export function useHoSoNv(h: HoSoNvTrang, mucDau: Muc) {
  const router = useRouter()
  const toast = useToast()
  const n = h.n
  const [muc, setMucState] = useState<Muc>(mucDau)
  const [suaCv, setSuaCv] = useState(false)
  // Khối của tab Cá nhân đang sửa — mỗi lúc một khối (sửa theo khối, Q2 lượt 2).
  const [suaCn, setSuaCn] = useState<KhoiCaNhan | null>(null)
  const [cccd, setCccd] = useState<string | null>(null)
  // Hộp hợp đồng: thêm mới / sửa một HĐ / huỷ một HĐ.
  const [hopHd, setHopHd] = useState<
    null | { moi: true } | { sua: HdDong } | { huy: HdDong }
  >(null)
  const [hop, setHop] = useState<HopBd>(null)
  const [busy, setBusy] = useState(false)
  // ‹ ›: tập người xem vừa lọc ở danh sách; không có người này thì danh sách mặc định.
  const [tapRaw] = useLocalPref(KHOA_TAP, '[]', 'session')
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

  /** Lưu một khối của tab Cá nhân; chỉ gửi ô của khối đó. */
  async function luuCaNhan(khoi: KhoiCaNhan, gia: Record<string, string | null>) {
    const ok = await chay(
      () =>
        api(`/api/dept/hr/cham-cong/nhan-vien/${n.id}/ca-nhan`, {
          method: 'POST',
          body: { viec: 'luu', khoi, gia },
        }),
      'Đã lưu',
    )
    if (ok) {
      setSuaCn(null)
      setCccd(null)
    }
    return ok
  }

  /** Hiện số CCCD thật — server ghi nhật ký người xem. */
  async function hienCccd() {
    try {
      const r = await api<{ gia: string | null }>(
        `/api/dept/hr/cham-cong/nhan-vien/${n.id}/ca-nhan`,
        { method: 'POST', body: { viec: 'hien' } },
      )
      setCccd(r.gia ?? '')
    } catch (e) {
      toast.error('Không hiện được', apiErrorText(e))
    }
  }

  /** Thêm / sửa / huỷ hợp đồng. Cảnh báo luật lao động (nếu có) hiện thành toast vàng. */
  async function guiHd(body: Record<string, unknown>, xong: string) {
    if (busy) return false
    setBusy(true)
    try {
      const r = await api<{ canhBao?: string[] }>(
        `/api/dept/hr/cham-cong/nhan-vien/${n.id}/hop-dong`,
        { method: 'POST', body },
      )
      toast.success(xong)
      for (const c of r.canhBao ?? []) toast.warning('Lưu ý', c)
      setHopHd(null)
      router.refresh()
      return true
    } catch (e) {
      toast.error('Chưa lưu được', apiErrorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  /** Mở / tải một file (giấy tờ, scan HĐ) — server kiểm quyền rồi trả URL ký ngắn hạn. */
  async function moFile(id: string, taiVe = false) {
    try {
      const r = await api<{ url: string }>(
        `/api/files/${id}${taiVe ? '?download=1' : ''}`,
      )
      window.open(r.url, '_blank', 'noopener')
    } catch (e) {
      toast.error('Không mở được file', apiErrorText(e))
    }
  }

  const xoaFile = (id: string, ten: string) =>
    chay(() => api(`/api/files/${id}`, { method: 'DELETE' }), `Đã gỡ ${ten}`)

  const sauTai = (ten: string) => {
    toast.success(`Đã tải lên ${ten}`)
    router.refresh()
  }

  /** Bấm một mục "Còn thiếu": mở đúng tab + khối ở chế độ sửa. */
  function moSua(khoi: 'cong_viec' | 'hop_dong' | KhoiCaNhan) {
    if (khoi === 'hop_dong') {
      setMuc('hop-dong')
      setHopHd({ moi: true })
    } else if (khoi === 'cong_viec') {
      setMuc('tong-quan')
      setSuaCv(true)
    } else {
      setMuc('ca-nhan')
      setSuaCn(khoi)
    }
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
    suaCn,
    setSuaCn,
    luuCaNhan,
    cccd,
    hienCccd,
    moSua,
    hopHd,
    setHopHd,
    guiHd,
    moFile,
    xoaFile,
    sauTai,
    toast,
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
