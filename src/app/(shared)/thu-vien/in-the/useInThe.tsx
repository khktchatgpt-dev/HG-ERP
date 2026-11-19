'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import {
  buildThe,
  sapTheoKhu,
  soTo,
  theThieu,
  type TheMoiTo,
  type TheNguon,
} from '@/lib/the-treo'

export type TabThe = 'chua' | 'da' | 'all'
export type LocMau = '' | 'co' | 'chua'

const bo = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').toLowerCase().trim()

const daTreo = (r: TheNguon) => !!r.showroom_tagged_at

/**
 * Toàn bộ state + xử lý của màn In thẻ treo. Dữ liệu đã nạp hết từ server (≤ vài
 * trăm SP), nên lọc / đếm làm ở đây — tab, ô đếm và lưới đi qua CÙNG chuỗi lọc.
 */
export function useInThe({ rows, canMark }: { rows: TheNguon[]; canMark: boolean }) {
  const router = useRouter()
  const [tab, setTab] = useState<TabThe>('chua')
  const [q, setQ] = useState('')
  const [kh, setKh] = useState('')
  const [mau, setMau] = useState<LocMau>('')
  const [thieuKt, setThieuKt] = useState(false)
  const [thieuAnh, setThieuAnh] = useState(false)
  const [moiTo, setMoiTo] = useState<TheMoiTo>(2)
  const [inAnh, setInAnh] = useState(true)
  const [inKhach, setInKhach] = useState(false)
  /** Dòng ĐÃ tick để in — mặc định chưa chọn gì, người in tự chọn (chủ dự án 19/11). */
  const [daChon, setDaChon] = useState<Set<string>>(() => new Set())
  const [focus, setFocus] = useState<string | null>(null)
  /** id đang gửi ra máy in (khác null = đang in). */
  const [dangIn, setDangIn] = useState<string[] | null>(null)
  /** id vừa in xong — hỏi lại có đánh dấu đã treo không. */
  const [vuaIn, setVuaIn] = useState<string[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [bao, setBao] = useState<{ ok: boolean; text: string } | null>(null)
  const [chan, setChan] = useState<string | null>(null)

  const sorted = useMemo(() => sapTheoKhu(rows), [rows])
  const khachs = useMemo(
    () =>
      [
        ...new Set(rows.map((r) => r.customer_name).filter((x): x is string => !!x)),
      ].sort(),
    [rows],
  )

  // Lọc ngoài tab (tìm · khách · mẫu) → tập tính số cho cả ba tab.
  const base = useMemo(() => {
    const k = bo(q)
    return sorted.filter(
      (r) =>
        (!k || bo(`${r.code} ${r.name}`).includes(k)) &&
        (!kh || r.customer_name === kh) &&
        (!mau || (mau === 'co') === r.showroom_sample),
    )
  }, [sorted, q, kh, mau])
  const dem = {
    chua: base.filter((r) => !daTreo(r)).length,
    da: base.filter(daTreo).length,
    all: base.length,
  }
  const trongTab = base.filter((r) => tab === 'all' || (tab === 'da') === daTreo(r))
  const thieu = {
    kt: trongTab.filter((r) => theThieu(r).kt).length,
    anh: trongTab.filter((r) => theThieu(r).anh).length,
  }
  const hien = trongTab.filter(
    (r) => (!thieuKt || theThieu(r).kt) && (!thieuAnh || theThieu(r).anh),
  )
  const chon = hien.filter((r) => daChon.has(r.id))
  const chuaTreoTrongChon = chon.filter((r) => !daTreo(r))
  const tatCa = hien.length > 0 && chon.length === hien.length
  const dangXem = hien.find((r) => r.id === focus) ?? hien[0] ?? null

  const the = useCallback((r: TheNguon) => buildThe(r, { khach: inKhach }), [inKhach])

  const latChon = (id: string) =>
    setDaChon((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const latTatCa = () =>
    setDaChon((s) => {
      const n = new Set(s)
      for (const r of hien) {
        if (tatCa) n.delete(r.id)
        else n.add(r.id)
      }
      return n
    })
  /** Chọn nhanh một nhóm trong các dòng đang hiện (cả khu, mọi SP có mẫu…) — CỘNG vào lựa chọn. */
  const chonNhom = (pred: (r: TheNguon) => boolean) =>
    setDaChon((s) => {
      const n = new Set(s)
      for (const r of hien) if (pred(r)) n.add(r.id)
      return n
    })
  const boChonHet = () => setDaChon(new Set())
  /** Nhóm chọn nhanh — đếm trên CÙNG tập `hien` mà lưới đang bày. */
  const nhom = useMemo(() => {
    const khu = new Map<string, number>()
    for (const r of hien)
      if (r.showroom_zone) khu.set(r.showroom_zone, (khu.get(r.showroom_zone) ?? 0) + 1)
    return {
      khu: [...khu.entries()],
      coMau: hien.filter((r) => r.showroom_sample).length,
    }
  }, [hien])
  /** Thẻ phóng cỡ lớn (lớp phủ) — để soát chữ; ở màn hẹp đây là chỗ xem trước duy nhất. */
  const [phong, setPhong] = useState(false)

  const boLoc = () => {
    setQ('')
    setKh('')
    setMau('')
    setThieuKt(false)
    setThieuAnh(false)
  }

  const batDauIn = () => {
    setBao(null)
    if (chon.length === 0) {
      setChan('Chưa chọn SP nào. Tick ở cột đầu, hoặc chọn tất cả.')
      return
    }
    setChan(null)
    setVuaIn(null)
    setDangIn(chon.map((r) => r.id))
  }
  const xongIn = useCallback(() => {
    setVuaIn(dangIn)
    setDangIn(null)
  }, [dangIn])

  const danhDau = async (ids: string[]) => {
    setBao(null)
    if (!canMark) {
      setChan('Cần quyền sửa hồ sơ SP (Kỹ thuật) để đánh dấu đã treo thẻ.')
      return
    }
    if (ids.length === 0) {
      setChan('Các SP đang chọn đều đã treo thẻ.')
      return
    }
    setChan(null)
    setBusy(true)
    try {
      const r = await api<{ marked: number; already: number }>(
        '/api/dept/technical/products/treo-the',
        { method: 'POST', body: { ids } },
      )
      setBao({
        ok: true,
        text: `Đã đánh dấu ${r.marked} SP đã treo thẻ (ghi ngày hôm nay).${r.already ? ` ${r.already} SP đã treo từ trước, giữ ngày cũ.` : ''}`,
      })
      setVuaIn(null)
      router.refresh()
    } catch (e) {
      setBao({ ok: false, text: apiErrorText(e, 'Không ghi được, thử lại') })
    } finally {
      setBusy(false)
    }
  }

  const [xemIn, setXemIn] = useState(false)
  const theChon = useMemo(() => (xemIn ? chon.map(the) : []), [xemIn, chon, the])

  const theIn = useMemo(
    () => (dangIn ? sorted.filter((r) => dangIn.includes(r.id)).map(the) : []),
    [dangIn, sorted, the],
  )

  return {
    tab,
    setTab,
    q,
    setQ,
    kh,
    setKh,
    mau,
    setMau,
    thieuKt,
    setThieuKt,
    thieuAnh,
    setThieuAnh,
    moiTo,
    setMoiTo,
    inAnh,
    setInAnh,
    inKhach,
    setInKhach,
    khachs,
    dem,
    thieu,
    hien,
    chon,
    chuaTreoTrongChon,
    daChon,
    tatCa,
    dangXem,
    setFocus,
    latChon,
    latTatCa,
    chonNhom,
    boChonHet,
    nhom,
    phong,
    setPhong,
    boLoc,
    the,
    soTo: soTo(chon.length, moiTo),
    batDauIn,
    xongIn,
    dangIn,
    theIn,
    xemIn,
    setXemIn,
    theChon,
    vuaIn,
    setVuaIn,
    danhDau,
    busy,
    bao,
    chan,
    tongSp: rows.length,
  } as const
}

export type InTheCtx = ReturnType<typeof useInThe>
