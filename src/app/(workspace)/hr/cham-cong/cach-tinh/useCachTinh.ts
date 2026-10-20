'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useToast } from '@/components/kit'
import { api, ApiError } from '@/lib/api'
import {
  duoiLuat,
  kiemKhung,
  kiemQuyTac,
  mucLuat,
  NGHI_LUONG,
  type KhungBan,
  type QuyTac,
} from '@/lib/cham-cong/cach-tinh'
import {
  congKy,
  khoaHeSo,
  type CachTinhTrang,
  type HeSoDong,
  type Muc,
} from './cach-tinh.shared'

/**
 * Toàn bộ state của màn Cách tính công: bản nháp đang sửa (quy tắc, khung, hệ số) giữ ở
 * client tới khi bấm Lưu nháp; mọi kiểm (khung chồng, dưới luật) tính lại ngay khi gõ —
 * cùng hàm thuần server dùng lúc Áp dụng, nên điều màn báo và điều server chặn là một.
 */
export function useCachTinh(c: CachTinhTrang, mucDau: Muc) {
  const router = useRouter()
  const path = usePathname()
  const sp = useSearchParams()
  const toast = useToast()
  const [muc, setMucState] = useState<Muc>(mucDau)
  const [quyTac, setQuyTac] = useState<QuyTac>(c.xem.quyTac)
  const [khung, setKhung] = useState<KhungBan[]>(c.khung)
  const [heSo, setHeSo] = useState<HeSoDong[]>(c.heSo)
  const [sua, setSua] = useState({ quyTac: false, khung: false, heSo: false })
  const [busy, setBusy] = useState<string | null>(null)
  const [moHuy, setMoHuy] = useState(false)
  const [tuKy, setTuKy] = useState(() => {
    const dauTien = [0, 1, 2]
      .map((n) => congKy(c.kyHienTai, n))
      .find((k) => !c.ban.some((b) => b.tuKy === k))
    return dauTien ?? congKy(c.kyHienTai, 3)
  })

  const nhap = !c.xem.tuKy
  const suaQuyTacDuoc = nhap && c.quyen.quyTac
  const suaHeSoDuoc = nhap && c.quyen.heSo
  const coSua = sua.quyTac || sua.khung || sua.heSo

  const loiKhung = useMemo(() => kiemKhung(khung), [khung])
  const loiQuyTac = useMemo(() => kiemQuyTac(quyTac, khung), [quyTac, khung])

  /** Mức tối thiểu của một ô (null = luật không buộc). */
  const toiThieu = (h: HeSoDong): number | null => {
    if (h.loai === 'leave') return NGHI_LUONG.find((n) => n.ma === h.ma)?.toiThieu ?? null
    const k = khung.find((x) => x.ma === h.ma)
    return k && h.ngay !== 'any' ? mucLuat(k, h.ngay).min : null
  }
  const duoi = heSo.filter((h) => duoiLuat(h.pt, toiThieu(h)))
  const duoiChuaLyDo = duoi.filter((h) => !h.lyDo?.trim())
  const oTrong = heSo.filter((h) => h.pt == null).length

  /** Lý do chưa áp dụng được — câu đầu tiên + mục cần mở. Null = áp dụng được. */
  const chan: { cau: string; muc: Muc } | null = !nhap
    ? null
    : coSua
      ? { cau: 'Còn thay đổi chưa lưu — bấm Lưu nháp trước', muc }
      : loiKhung.length
        ? { cau: `${loiKhung[0].ma}: ${loiKhung[0].loi}`, muc: 'quy-tac' }
        : loiQuyTac
          ? { cau: loiQuyTac, muc: 'quy-tac' }
          : duoiChuaLyDo.length
            ? {
                cau: `${duoiChuaLyDo.length} ô hệ số thấp hơn mức luật chưa ghi lý do`,
                muc: 'he-so',
              }
            : null

  function setMuc(m: Muc) {
    setMucState(m)
    const q = new URLSearchParams(sp.toString())
    q.set('muc', m)
    router.replace(`${path}?${q}`, { scroll: false })
  }

  function xemBan(id: string) {
    const q = new URLSearchParams(sp.toString())
    q.set('ban', id)
    router.push(`${path}?${q}`)
  }

  function doiQuyTac(p: Partial<QuyTac>) {
    setQuyTac((q) => ({ ...q, ...p }))
    setSua((s) => ({ ...s, quyTac: true }))
  }
  function doiKhung(ma: string, p: Partial<KhungBan>) {
    setKhung((ks) => ks.map((k) => (k.ma === ma ? { ...k, ...p } : k)))
    setSua((s) => ({ ...s, khung: true }))
  }
  function doiHeSo(khoa: string, p: Partial<Pick<HeSoDong, 'pt' | 'lyDo'>>) {
    setHeSo((hs) => hs.map((h) => (khoaHeSo(h) === khoa ? { ...h, ...p } : h)))
    setSua((s) => ({ ...s, heSo: true }))
  }

  async function chay(ten: string, f: () => Promise<unknown>, xong: string) {
    setBusy(ten)
    try {
      await f()
      toast.success(xong)
      router.refresh()
      return true
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không lưu được — thử lại')
      return false
    } finally {
      setBusy(null)
    }
  }

  async function luuNhap() {
    const body = {
      ...(sua.quyTac && { quyTac }),
      ...(sua.khung && { khung }),
      ...(sua.heSo && { heSo }),
    }
    const ok = await chay(
      'luu',
      () =>
        api(`/api/dept/hr/cham-cong/cach-tinh/ban/${c.xem.id}`, {
          method: 'PATCH',
          body,
        }),
      `Đã lưu nháp Bản ${c.xem.so}`,
    )
    if (ok) setSua({ quyTac: false, khung: false, heSo: false })
  }

  const apDung = () =>
    chay(
      'ap',
      () =>
        api(`/api/dept/hr/cham-cong/cach-tinh/ban/${c.xem.id}/ap-dung`, {
          method: 'POST',
          body: { tuKy },
        }),
      `Bản ${c.xem.so} áp dụng từ kỳ ${tuKy.slice(5)}/${tuKy.slice(0, 4)}`,
    )

  async function taoBanMoi() {
    setBusy('tao')
    try {
      const r = await api<{ id: string; so: number }>(
        '/api/dept/hr/cham-cong/cach-tinh/ban',
        {
          method: 'POST',
          body: { tuBan: c.xem.id },
        },
      )
      toast.success(`Đã tạo Bản ${r.so} (nháp) từ Bản ${c.xem.so}`)
      xemBan(r.id)
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : 'Không tạo được bản mới')
    } finally {
      setBusy(null)
    }
  }

  const rutVeNhap = () =>
    chay(
      'rut',
      () =>
        api(`/api/dept/hr/cham-cong/cach-tinh/ban/${c.xem.id}/rut`, { method: 'POST' }),
      `Bản ${c.xem.so} đã về nháp`,
    )

  async function huyNhap() {
    const ok = await chay(
      'huy',
      () => api(`/api/dept/hr/cham-cong/cach-tinh/ban/${c.xem.id}`, { method: 'DELETE' }),
      `Đã huỷ Bản ${c.xem.so}`,
    )
    setMoHuy(false)
    if (ok) router.push(path)
  }

  async function doiCachTinhTo(ten: string, cachTinh: 'khung' | 'ngay') {
    await chay(
      'to:' + ten,
      () =>
        api('/api/dept/hr/cham-cong/cach-tinh', {
          method: 'POST',
          body: { boPhan: ten, cachTinh },
        }),
      `${ten}: ${cachTinh === 'ngay' ? 'có quẹt = 1 công' : 'tính theo khung giờ'}`,
    )
  }

  return {
    c,
    muc,
    setMuc,
    xemBan,
    quyTac,
    khung,
    heSo,
    sua,
    coSua,
    nhap,
    suaQuyTacDuoc,
    suaHeSoDuoc,
    loiKhung,
    loiQuyTac,
    toiThieu,
    duoi,
    duoiChuaLyDo,
    oTrong,
    chan,
    busy,
    tuKy,
    setTuKy,
    doiQuyTac,
    doiKhung,
    doiHeSo,
    luuNhap,
    apDung,
    taoBanMoi,
    rutVeNhap,
    huyNhap,
    moHuy,
    setMoHuy,
    doiCachTinhTo,
  } as const
}

export type CachTinhCtx = ReturnType<typeof useCachTinh>
