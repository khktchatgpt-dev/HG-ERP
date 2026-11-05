'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import {
  choXem,
  daXemChoGd,
  gomDon,
  tichDuoc,
  type HopXem,
  type XemDon,
} from '@/lib/cho-xem'
import { LY_DO_TRA_LAI_TOI_THIEU } from '@/lib/po-review'
import { searchMatcher } from '@/lib/search-text'

export type TabXem = 'cho' | 'da' | 'thay'
export type GomXem = 'nguoi' | 'lenh' | 'khong'

/** Kết quả lượt bấm gần nhất — bày TẠI CHỖ dưới thanh hành động (bản vẽ khung 2·C). */
export type KetQua = {
  ok: XemDon[]
  loi: { code: string; msg: string }[]
  /** Mã đơn vừa trả lại để sửa (nếu lượt bấm là trả lại). */
  traLai?: string
}

/**
 * Toàn bộ state + xử lý của hộp "Chờ tôi xem". Màn và các khối chỉ đọc `d`.
 *
 * Bấm "Đã xem — trình GĐ": đơn đã TÍCH (hàng loạt, chỉ đơn dưới ngưỡng — Q2),
 * không tích đơn nào thì đơn đang MỞ (kèm ghi chú của nó). Gọi tuần tự như ký
 * nhiều phiếu ở hộp ký: đơn lỗi nằm lại kèm câu vì sao, đơn xong rời hộp.
 */
export function useChoXem(box: HopXem) {
  const router = useRouter()
  const [tab, setTab] = useState<TabXem>('cho')
  const [gom, setGom] = useState<GomXem>('nguoi')
  const [q, setQ] = useState('')
  const [tich, setTich] = useState<Set<string>>(new Set())
  const [mo, setMo] = useState<string | null>(null)
  const [ghiChu, setGhiChu] = useState<Record<string, string>>({})
  const [traLai, setTraLai] = useState<{ id: string; lyDo: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [ketQua, setKetQua] = useState<KetQua | null>(null)
  /** Câu chặn tại chỗ khi bấm mà chưa đủ điều kiện (nút vẫn bấm được). */
  const [chan, setChan] = useState<string | null>(null)

  const khop = searchMatcher(q)
  const loc = (rows: XemDon[]) =>
    q.trim()
      ? rows.filter((d) =>
          khop([d.code, d.ncc_day_du, d.owner_name ?? '', d.lsx ?? '', ...d.materials]),
        )
      : rows
  const cho = choXem(box.items)
  const da = daXemChoGd(box.items)
  const rows = loc(tab === 'cho' ? cho : tab === 'da' ? da : [])
  const khoi = useMemo(() => gomDon(rows, gom), [rows, gom])
  const daTich = rows.filter((d) => tich.has(d.id))
  const dangMo = box.items.find((d) => d.id === mo) ?? null

  const doiTab = (t: TabXem) => {
    setTab(t)
    setTich(new Set())
    setMo(null)
    setTraLai(null)
    setChan(null)
  }
  const batTich = (d: XemDon) => {
    if (!tichDuoc(d)) return
    setChan(null)
    setTich((s) => {
      const n = new Set(s)
      if (n.has(d.id)) n.delete(d.id)
      else n.add(d.id)
      return n
    })
  }
  const tichKhoi = (ds: XemDon[], on: boolean) =>
    setTich((s) => {
      const n = new Set(s)
      for (const d of ds.filter(tichDuoc)) {
        if (on) n.add(d.id)
        else n.delete(d.id)
      }
      return n
    })
  const moDong = (id: string) => {
    setChan(null)
    setMo((cur) => (cur === id ? null : id))
    if (traLai && traLai.id !== id) setTraLai(null)
  }

  /** Đã xem — trình GĐ: đơn đã tích, không thì đơn đang mở. */
  async function daXem() {
    const dich = daTich.length > 0 ? daTich : dangMo && tab === 'cho' ? [dangMo] : []
    if (dich.length === 0) {
      setChan('Bấm vào một đơn để mở ra xem, hoặc tích các đơn dưới ngưỡng giá trị lớn.')
      return
    }
    // Nháp còn thiếu (hẹn giao, dòng hàng…): nói tại chỗ, không gọi máy chủ.
    const thieu = dich.find((x) => x.chan)
    if (thieu) {
      setChan(
        `${thieu.code} chưa trình được: ${thieu.chan} — người lập bổ sung rồi mới trình.`,
      )
      return
    }
    setBusy(true)
    setChan(null)
    const ok: XemDon[] = []
    const loi: KetQua['loi'] = []
    for (const d of dich) {
      try {
        await api(`/api/dept/supply/pos/${d.id}/review`, {
          method: 'POST',
          // `tu`: trạng thái lúc anh nhìn — NV vừa rút về / gửi thẳng thì máy chủ trả 409.
          body: {
            note: ghiChu[d.id]?.trim() || null,
            tu: d.nhap ? 'draft' : 'pending_approval',
          },
        })
        ok.push(d)
      } catch (e) {
        loi.push({ code: d.code, msg: apiErrorText(e) })
      }
    }
    setBusy(false)
    setKetQua({ ok, loi })
    setTich(new Set())
    setMo(null)
    router.refresh()
  }

  /** Mở dải lý do trả lại — chỉ một đơn một lần (lý do viết cho từng đơn). */
  function moTraLai() {
    if (!dangMo || tab === 'thay') {
      setChan('Trả lại phải ghi lý do cho từng đơn — bấm vào một đơn trước.')
      return
    }
    setChan(null)
    setTraLai({ id: dangMo.id, lyDo: '' })
  }
  const lyDoDu = (traLai?.lyDo.trim().length ?? 0) >= LY_DO_TRA_LAI_TOI_THIEU

  async function guiTraLai() {
    if (!traLai) return
    const d = box.items.find((x) => x.id === traLai.id)
    if (!d || !lyDoDu) return
    setBusy(true)
    try {
      await api(`/api/dept/supply/pos/${d.id}/return`, {
        method: 'POST',
        body: { reason: traLai.lyDo.trim(), tu: d.nhap ? 'draft' : 'pending_approval' },
      })
      setTraLai(null)
      setMo(null)
      setKetQua({ ok: [], loi: [], traLai: d.code })
      router.refresh()
    } catch (e) {
      setKetQua({ ok: [], loi: [{ code: d.code, msg: apiErrorText(e) }] })
    } finally {
      setBusy(false)
    }
  }

  return {
    box,
    tab,
    doiTab,
    gom,
    setGom,
    q,
    setQ,
    cho,
    da,
    rows,
    khoi,
    tich,
    daTich,
    batTich,
    tichKhoi,
    mo,
    dangMo,
    moDong,
    ghiChu,
    setGhiChu,
    traLai,
    setTraLai,
    lyDoDu,
    moTraLai,
    guiTraLai,
    daXem,
    busy,
    ketQua,
    setKetQua,
    chan,
  } as const
}

export type ChoXemCtx = ReturnType<typeof useChoXem>
