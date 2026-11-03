'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { useLocalPref } from '@/lib/use-local-pref'
import {
  formTu,
  goiHoSo,
  kiemHoSo,
  type FormHoSo,
  type OHoSo,
} from '@/lib/nhan-su/sua-ho-so'
import type { HoSoNvTrang } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'
import type { HdDong } from '@/modules/dept/hr/cham-cong/hop-dong.repo'
import { KHOA_TAP } from '../useNhanVienDs'
import type { Muc } from './muc'

export type { Muc }

export type HopBd = null | 'nghi' | 'lam_lai' | 'chuyen'
type Bao = { ok: boolean; text: string } | null

/**
 * State + thao tác của trang hồ sơ một người. B4 (bản vẽ 02/11/2026 mục D): một nút "Sửa thông
 * tin" mở cả 4 khối, lưu MỘT lần qua `[id]/thong-tin` (thay sửa theo khối). Tab Hợp đồng,
 * Giấy tờ, Lương, Lịch sử giữ nguyên — vẫn dùng `toast`, `guiHd`, `moFile`… ở đây.
 */
export function useHoSoNv(h: HoSoNvTrang, mucDau: Muc) {
  const router = useRouter()
  const toast = useToast()
  const n = h.n
  const [muc, setMucState] = useState<Muc>(mucDau)
  const [cccd, setCccd] = useState<string | null>(null)
  // Hộp hợp đồng: thêm mới / sửa một HĐ / huỷ một HĐ.
  const [hopHd, setHopHd] = useState<
    null | { moi: true } | { sua: HdDong } | { huy: HdDong }
  >(null)
  const [hop, setHop] = useState<HopBd>(null)
  const [busy, setBusy] = useState(false)
  const [bao, setBao] = useState<Bao>(null)

  // ── Sửa thông tin ──
  const quyen = { cv: h.quyen.sua && n.active, rieng: h.quyen.rieng }
  const suaDuoc = quyen.cv || quyen.rieng
  const goc = useMemo(() => formTu(n, h.caNhan), [n, h.caNhan])
  const [dangSua, setDangSua] = useState(false)
  const [f, setF] = useState<FormHoSo>(goc)
  const [thu, setThu] = useState(false)
  const loi = dangSua ? kiemHoSo(f, { ...quyen, homNay: h.homNay }) : []
  const { goi, so } = dangSua ? goiHoSo(f, goc, quyen) : { goi: {}, so: 0 }

  // Rời trang khi còn ô chưa lưu → trình duyệt hỏi lại.
  useEffect(() => {
    if (!so) return
    const hoi = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', hoi)
    return () => window.removeEventListener('beforeunload', hoi)
  }, [so])

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
    if (so) {
      setBao({ ok: false, text: `Còn ${so} ô chưa lưu — Lưu hoặc Huỷ trước` })
      return
    }
    const ma = tap[viTri + buoc]
    if (ma) router.push(`/hr/nhan-vien/${encodeURIComponent(ma)}`)
  }

  function setMuc(m: Muc) {
    setMucState(m)
    const q = m === 'thong-tin' ? '' : `?muc=${m}`
    window.history.replaceState(
      null,
      '',
      `/hr/nhan-vien/${encodeURIComponent(n.code)}${q}`,
    )
  }

  /** Mở chế độ sửa (từ nút đầu trang, hoặc nút "Ghi ngày vào làm" ở Lịch sử → nhảy tới ô). */
  function batSua(o?: OHoSo) {
    setF(goc)
    setThu(false)
    setBao(null)
    setDangSua(true)
    setMuc('thong-tin')
    if (o) setTimeout(() => document.getElementById(`hs-${o}`)?.focus(), 50)
  }

  const datO =
    <K extends OHoSo>(o: K) =>
    (v: FormHoSo[K]) =>
      setF((x) => ({ ...x, [o]: v }))

  function toi(o: OHoSo) {
    setThu(true)
    document.getElementById(`hs-${o}`)?.focus()
  }

  async function luuThongTin() {
    if (busy) return
    if (loi.length) return toi(loi[0].o)
    if (!so) {
      setDangSua(false)
      return
    }
    setBusy(true)
    try {
      await api(`/api/dept/hr/cham-cong/nhan-vien/${n.id}/thong-tin`, {
        method: 'POST',
        body: goi,
      })
      setDangSua(false)
      setCccd(null)
      setBao({ ok: true, text: `Đã lưu ${so} ô` })
      router.refresh()
    } catch (e) {
      setBao({ ok: false, text: `Chưa lưu được: ${apiErrorText(e)}` })
    } finally {
      setBusy(false)
    }
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

  /** Hiện số CCCD thật — server ghi nhật ký người xem. */
  async function hienCccd() {
    try {
      const r = await api<{ gia: string | null }>(
        `/api/dept/hr/cham-cong/nhan-vien/${n.id}/ca-nhan`,
        { method: 'POST', body: { viec: 'hien' } },
      )
      setCccd(r.gia ?? '')
    } catch (e) {
      setBao({ ok: false, text: `Không hiện được số CCCD: ${apiErrorText(e)}` })
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
    cccd,
    hienCccd,
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
    bao,
    setBao,
    homNay: h.homNay,
    bienDong,
    // sửa thông tin
    quyen,
    suaDuoc,
    dangSua,
    batSua,
    huySua: () => {
      setDangSua(false)
      setBao(null)
    },
    f,
    datO,
    loi,
    thu,
    so,
    toi,
    luuThongTin,
    viTri,
    tongTap: tap.length,
    truoc: viTri > 0 ? () => di(-1) : undefined,
    sau: viTri >= 0 && viTri < tap.length - 1 ? () => di(1) : undefined,
  } as const
}

export type HoSoCtx = ReturnType<typeof useHoSoNv>
