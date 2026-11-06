'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import {
  chanNgan,
  choXem,
  daXemChoGd,
  gomDon,
  lamDuocNgay,
  tichDuoc,
  trangThaiXem,
  type HopXem,
  type XemDon,
} from '@/lib/cho-xem'
import { todayVn } from '@/lib/date-vn'
import { LY_DO_TRA_LAI_TOI_THIEU } from '@/lib/po-review'
import { searchMatcher } from '@/lib/search-text'

export type TabXem = 'cho' | 'da' | 'thay'
export type GomXem = 'trang_thai' | 'nguoi' | 'lenh'

/** Kết quả lượt bấm gần nhất — bày TẠI CHỖ dưới thanh hành động (khung 7·B). */
export type KetQua = {
  ok: XemDon[]
  loi: { code: string; msg: string }[]
  /** Mã đơn vừa trả lại để sửa (nếu lượt bấm là trả lại). */
  traLai?: string
}

/**
 * Vì sao đơn này CHƯA trình được — câu bày tại chỗ (khung 7·A), null = trình được.
 * Nháp còn thiếu: thiếu gì + ai gỡ; nháp bị trả lại: đang chờ người lập sửa.
 */
export function viSaoChuaTrinh(x: XemDon): string | null {
  const t = trangThaiXem(x)
  if (t === 'thieu' && x.chan)
    return `${chanNgan(x.chan)} — ${x.owner_name ?? 'người lập'} bổ sung ở Đầu đơn. Muốn nhắn, bấm "Trả lại để sửa" kèm lời nhắn (đơn vẫn là nháp).`
  if (t === 'tra_lai')
    return `Đơn đang chờ ${x.owner_name ?? 'người lập'} sửa theo lý do trả lại — sửa xong đơn tự lên nhóm "Trình được". Muốn trình luôn: mở đơn đầy đủ.`
  return null
}

/**
 * Toàn bộ state + xử lý của hộp "Chờ tôi xem" (bản 2 — khung 6 + 7, Q7–Q11).
 * Màn và các khối chỉ đọc `d`.
 *
 * Dòng ĐANG XEM (khung chi tiết dưới lưới) mặc định là dòng đầu của nhóm làm
 * được ngay, không có thì dòng đầu tab — người mở hộp thấy chi tiết ngay, không
 * phải đoán bấm. Bấm "Đã xem — trình GĐ": đơn đã TÍCH (hàng loạt, chỉ đơn làm
 * được + dưới ngưỡng — Q2), không tích thì đơn đang xem. Gọi tuần tự: đơn lỗi
 * nằm lại kèm câu vì sao, đơn xong rời hộp.
 */
export function useChoXem(box: HopXem) {
  const router = useRouter()
  const [tab, setTab] = useState<TabXem>('cho')
  const [gom, setGom] = useState<GomXem>('trang_thai')
  const [q, setQ] = useState('')
  const [tich, setTich] = useState<Set<string>>(new Set())
  const [chon, setChon] = useState<string | null>(null)
  /** Nhóm đang mở trong các nhóm thu gọn sẵn (Q11 — "Bị trả lại"). */
  const [moNhom, setMoNhom] = useState<Set<string>>(new Set())
  const [ghiChu, setGhiChu] = useState<Record<string, string>>({})
  const [traLai, setTraLai] = useState<{ id: string; lyDo: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [ketQua, setKetQua] = useState<KetQua | null>(null)
  /** Câu chặn tại chỗ khi bấm mà chưa đủ điều kiện (nút vẫn bấm được). */
  const [chan, setChan] = useState<string | null>(null)

  const homNay = todayVn(new Date(box.at))
  const khop = searchMatcher(q)
  const loc = (rows: XemDon[]) =>
    q.trim()
      ? rows.filter(
          (d) =>
          khop([d.code, d.ncc_day_du, d.owner_name ?? '', d.lsx ?? '', d.ngoai_lenh ?? '', ...d.materials]), // prettier-ignore
        )
      : rows
  const cho = choXem(box.items)
  const da = daXemChoGd(box.items)
  /** Q7 — số trên tab "Chờ tôi xem" = số đỏ trên menu. */
  const soCho = lamDuocNgay(cho).length
  const rows = loc(tab === 'cho' ? cho : tab === 'da' ? da : [])
  const khoi = useMemo(() => gomDon(rows, gom), [rows, gom])
  /** Thứ tự dòng đúng như màn bày (nhóm thu gọn không tính) — để chọn sẵn dòng đầu. */
  const hienThi = khoi.flatMap((g) => (g.gon && !moNhom.has(g.key) ? [] : g.rows))
  const daTich = rows.filter((d) => tich.has(d.id))
  const dangXem =
    hienThi.find((d) => d.id === chon) ?? lamDuocNgay(hienThi)[0] ?? hienThi[0] ?? null
  const viSao = tab === 'cho' && dangXem ? viSaoChuaTrinh(dangXem) : null

  const doiTab = (t: TabXem) => {
    setTab(t)
    setTich(new Set())
    setChon(null)
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
  const chonDong = (id: string) => {
    setChan(null)
    setChon(id)
    if (traLai && traLai.id !== id) setTraLai(null)
  }
  const batNhom = (key: string) =>
    setMoNhom((s) => {
      const n = new Set(s)
      if (n.has(key)) n.delete(key)
      else n.add(key)
      return n
    })

  /** Đã xem — trình GĐ: đơn đã tích, không thì đơn đang xem. */
  async function daXem() {
    const dich = daTich.length > 0 ? daTich : dangXem && tab === 'cho' ? [dangXem] : []
    if (dich.length === 0) {
      setChan('Bấm vào một đơn ở nhóm "Trình được ngay", hoặc tích các đơn dưới ngưỡng giá trị lớn.') // prettier-ignore
      return
    }
    // Nháp còn thiếu / bị trả lại: nói tại chỗ, không gọi máy chủ.
    const vuong = dich.find((x) => viSaoChuaTrinh(x))
    if (vuong) {
      setChan(`${vuong.code} chưa trình được: ${viSaoChuaTrinh(vuong)}`)
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
    setChon(null)
    router.refresh()
  }

  /** Mở dải lý do trả lại — chỉ một đơn một lần (lý do viết cho từng đơn). */
  function moTraLai() {
    if (!dangXem || tab === 'thay') {
      setChan('Trả lại phải ghi lý do cho từng đơn — bấm vào một đơn trước.')
      return
    }
    if (trangThaiXem(dangXem) === 'tra_lai') {
      setChan(`${dangXem.code} đã được trả lại, đang chờ người lập sửa.`)
      return
    }
    setChan(null)
    setTraLai({ id: dangXem.id, lyDo: '' })
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
      setChon(null)
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
    homNay,
    tab,
    doiTab,
    gom,
    setGom,
    q,
    setQ,
    cho,
    da,
    soCho,
    rows,
    khoi,
    tich,
    daTich,
    batTich,
    tichKhoi,
    dangXem,
    chonDong,
    moNhom,
    batNhom,
    viSao,
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
