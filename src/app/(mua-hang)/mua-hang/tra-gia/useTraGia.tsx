'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { api, ApiError, apiErrorText } from '@/lib/api'
import { todayVn } from '@/lib/date-vn'
import type { PastedPoLine } from '@/lib/po-paste'
import {
  dangChon,
  phuongAn,
  thanhTien,
  type GiaHoi,
  type PhuongAn,
} from '@/lib/tra-gia-chon'
import type { TraGiaKetQua } from '@/modules/dept/supply/tra-gia.service'
import type { Ky, Mon, TrangMon } from './tra-gia.shared'

type MonGoc = Pick<Mon, 'id' | 'text' | 'sl' | 'dvt' | 'key'>
/** Nháp trên máy — chỉ CHỮ người mua khai; giá luôn tra lại khi mở (giá đổi theo đơn mới). */
type Luu = {
  v: 1
  mons: MonGoc[]
  ky: Ky
  chon: Record<string, string>
  hoi: Record<string, GiaHoi[]>
}

export type Loc = 'all' | 'ok' | 'one' | 'mo_ho' | 'moi' | 'trong' | 'chenh'
/** Chênh giữa NCC rẻ nhất và đắt nhất từ ngưỡng này thì đáng hỏi lại. */
export const CHENH_DANG_XEM = 0.1
const TRAN_MOT_LUOT = 200

let dem = 0
const moiId = () => `${Date.now().toString(36)}${(dem++).toString(36)}`

/** Một món đã tính sẵn mọi thứ màn cần: phương án giá, NCC đang chọn, thành tiền. */
export type MonTinh = {
  m: Mon
  ds: PhuongAn[]
  re: number | null
  dv: string | null
  chon: PhuongAn | null
  tien: number | null
  trang: TrangMon
  chenh: number | null
}

function tinhMon(m: Mon, hoi: readonly GiaHoi[], chonKey: string | undefined): MonTinh {
  const { ds, re, dv } = phuongAn(m.kq, hoi)
  const chon = dangChon(ds, chonKey)
  const so = ds.filter((p) => p.so_duoc)
  const trang: TrangMon = m.dang
    ? 'dang'
    : m.loi
      ? 'loi'
      : m.kq?.trang_thai === 'mo_ho'
        ? 'mo_ho'
        : so.length >= 2
          ? 'ok'
          : so.length === 1
            ? 'one'
            : m.kq?.trang_thai === 'moi'
              ? 'moi'
              : 'trong'
  const chenh = so.length >= 2 ? Math.max(...so.map((p) => p.gia)) / re! - 1 : null
  return { m, ds, re, dv, chon, tien: thanhTien(chon, m.sl), trang, chenh }
}

const LOC_TEST: Record<Loc, (t: MonTinh) => boolean> = {
  all: () => true,
  ok: (t) => t.trang === 'ok',
  one: (t) => t.trang === 'one',
  mo_ho: (t) => t.trang === 'mo_ho',
  moi: (t) => t.trang === 'moi',
  trong: (t) => t.trang === 'trong' || t.trang === 'loi',
  chenh: (t) => (t.chenh ?? 0) > CHENH_DANG_XEM,
}

/**
 * Toàn bộ state + xử lý của màn Tra giá vật tư. Danh sách món là NHÁP TRÊN MÁY
 * (localStorage theo người — câu Q5 bản vẽ): không thành phiếu, không ai duyệt.
 */
export function useTraGia(meId: string) {
  const toast = useToast()
  const [mons, setMons] = useState<Mon[]>([])
  const [ky, setKy] = useState<Ky>(6)
  const [chon, setChon] = useState<Record<string, string>>({})
  const [hoi, setHoi] = useState<Record<string, GiaHoi[]>>({})
  const [meta, setMeta] = useState<Omit<TraGiaKetQua, 'mon'> | null>(null)
  const [view, setView] = useState<'mon' | 'ncc'>('mon')
  const [loc, setLoc] = useState<Loc>('all')
  const [chiChon, setChiChon] = useState(false)
  const [thu, setThu] = useState<ReadonlySet<string>>(new Set())
  const [hopDan, setHopDan] = useState(false)
  const [hoiCho, setHoiCho] = useState<string | null>(null)
  const [dangXuat, setDangXuat] = useState(false)
  const kyDangTra = useRef<Ky>(6)
  const daNap = useRef(false)
  const luuKey = `hg.tra-gia.v1.${meId}`
  const homNay = todayVn()

  const tra = useCallback(
    async (ds: readonly MonGoc[], k: Ky) => {
      if (ds.length === 0) return
      const ids = new Set(ds.map((d) => d.id))
      setMons((ms) => ms.map((m) => (ids.has(m.id) ? { ...m, dang: true, loi: null } : m))) // prettier-ignore
      for (let i = 0; i < ds.length; i += TRAN_MOT_LUOT) {
        const phan = ds.slice(i, i + TRAN_MOT_LUOT)
        try {
          const r = await api<TraGiaKetQua>('/api/dept/supply/tra-gia', {
            method: 'POST',
            body: {
              thang: k,
              items: phan.map((d) => ({
                text: d.text,
                sl: d.sl,
                dvt: d.dvt,
                key: d.key,
              })),
            },
          })
          // Người mua đổi kỳ giữa chừng → kết quả của kỳ cũ bỏ đi, lượt tra mới đang chạy.
          if (k !== kyDangTra.current) return
          const by = new Map(phan.map((d, j) => [d.id, r.mon[j]]))
          setMons((ms) => ms.map((m) => (by.has(m.id) ? { ...m, kq: by.get(m.id)!, dang: false, loi: null } : m))) // prettier-ignore
          setMeta({ tu_ngay: r.tu_ngay, den_ngay: r.den_ngay, so_dong: r.so_dong })
        } catch (e) {
          const loi = apiErrorText(e)
          const hong = new Set(phan.map((d) => d.id))
          setMons((ms) => ms.map((m) => (hong.has(m.id) ? { ...m, dang: false, loi } : m))) // prettier-ignore
          toast.error('Tra giá không được', loi)
        }
      }
    },
    [toast],
  )

  // ── Nháp trên máy: nạp một lần sau khi mount (rồi tra lại giá), lưu mỗi khi đổi ──
  useEffect(() => {
    let luu: Luu | null = null
    try {
      const raw = localStorage.getItem(luuKey)
      if (raw) luu = JSON.parse(raw) as Luu
    } catch {
      // nháp hỏng / bị chặn → bắt đầu trống
    }
    if (luu?.v === 1 && Array.isArray(luu.mons) && luu.mons.length) {
      const k: Ky = [3, 6, 12, 0].includes(luu.ky) ? luu.ky : 6
      kyDangTra.current = k
      // Đồng bộ state với localStorage bên ngoài — ngoại lệ hợp lệ của luật.
      /* eslint-disable react-hooks/set-state-in-effect */
      setMons(luu.mons.map((m) => ({ ...m, kq: null, dang: true, loi: null })))
      setKy(k)
      setChon(luu.chon ?? {})
      setHoi(luu.hoi ?? {})
      /* eslint-enable react-hooks/set-state-in-effect */
      void tra(luu.mons, k)
    }
    daNap.current = true
  }, [luuKey, tra])

  useEffect(() => {
    if (!daNap.current) return
    const luu: Luu = { v: 1, mons: mons.map(({ id, text, sl, dvt, key }) => ({ id, text, sl, dvt, key })), ky, chon, hoi } // prettier-ignore
    try {
      localStorage.setItem(luuKey, JSON.stringify(luu))
    } catch {
      // hết chỗ / bị chặn → nháp chỉ sống tới khi đóng tab
    }
  }, [mons, ky, chon, hoi, luuKey])

  // ── Thêm / bớt món ──────────────────────────────────────────────────────────
  const themNhieu = useCallback(
    (ds: { text: string; sl: number | null; dvt: string | null }[]) => {
      const moi: Mon[] = ds
        .filter((d) => d.text.trim())
        .map((d) => ({ id: moiId(), text: d.text.trim(), sl: d.sl, dvt: d.dvt, key: null, kq: null, dang: true, loi: null })) // prettier-ignore
      if (moi.length === 0) return 0
      setMons((ms) => [...ms, ...moi])
      setLoc('all')
      void tra(moi, ky)
      return moi.length
    },
    [tra, ky],
  )
  const them = (text: string) => themNhieu([{ text, sl: null, dvt: null }])
  const dan = (lines: PastedPoLine[]) =>
    themNhieu(lines.map((l) => ({ text: l.name || l.code || '', sl: l.qty, dvt: null })))

  const xoa = (id: string) => {
    setMons((ms) => ms.filter((m) => m.id !== id))
    const bo = <T,>(x: Record<string, T>) => Object.fromEntries(Object.entries(x).filter(([k]) => k !== id)) // prettier-ignore
    setHoi(bo)
    setChon(bo)
  }
  const xoaHet = () => {
    setMons([])
    setHoi({})
    setChon({})
    setMeta(null)
  }
  const traLai = () => void tra(mons, ky)

  /**
   * XUẤT EXCEL — gửi chữ món + lựa chọn (NCC chọn, giá hỏi); server tra lại giá
   * rồi ghi file. Tải bằng fetch + blob như Quy cắt phôi: `api()` chỉ đọc JSON.
   */
  const xuatExcel = async () => {
    if (mons.length === 0 || dangXuat) return
    setDangXuat(true)
    try {
      const res = await fetch('/api/dept/supply/tra-gia/excel', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          thang: ky,
          items: mons.map((m) => ({ text: m.text, sl: m.sl, dvt: m.dvt, key: m.key, chon: chon[m.id] ?? null, hoi: hoi[m.id] ?? [] })), // prettier-ignore
        }),
      })
      if (res.status === 401) {
        window.location.href = '/login'
        return
      }
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string; code?: string; issues?: unknown } // prettier-ignore
        throw new ApiError(res.status, j.error ?? `HTTP ${res.status}`, j.code, j.issues)
      }
      const blob = await res.blob()
      const m = /filename\*=UTF-8''([^;]+)/.exec(
        res.headers.get('content-disposition') ?? '',
      )
      const ten = m ? decodeURIComponent(m[1]) : 'Tra-gia-vat-tu.xlsx'
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = ten
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Đã xuất Excel', ten)
    } catch (e) {
      toast.error('Xuất Excel không được', apiErrorText(e))
    } finally {
      setDangXuat(false)
    }
  }
  const doiKy = (k: Ky) => {
    kyDangTra.current = k
    setKy(k)
    void tra(mons, k)
  }
  const datSl = (id: string, sl: number | null) =>
    setMons((ms) => ms.map((m) => (m.id === id ? { ...m, sl } : m)))

  /** Món mơ hồ: người mua chọn một quy cách → tra lại riêng món đó với khoá đã chọn. */
  const chonQuyCach = (id: string, key: string) => {
    const m = mons.find((x) => x.id === id)
    if (!m) return
    const moi = { ...m, key }
    setMons((ms) => ms.map((x) => (x.id === id ? moi : x)))
    void tra([moi], ky)
  }
  /** "Giữ cả hai": tách món mơ hồ thành mỗi quy cách một dòng, cùng chữ gõ và SL. */
  const tachQuyCach = (id: string) => {
    const m = mons.find((x) => x.id === id)
    const uv = m?.kq?.ung_vien ?? []
    if (!m || uv.length === 0) return
    const moi = uv.map((u) => ({ ...m, id: moiId(), key: u.key, kq: null, dang: true, loi: null })) // prettier-ignore
    setMons((ms) => ms.flatMap((x) => (x.id === id ? moi : [x])))
    void tra(moi, ky)
  }

  const chonNcc = (monId: string, key: string) => setChon((c) => ({ ...c, [monId]: key }))
  const ghiHoi = (monId: string, h: Omit<GiaHoi, 'id' | 'at'>) =>
    setHoi((x) => ({ ...x, [monId]: [...(x[monId] ?? []), { ...h, id: moiId(), at: homNay }] })) // prettier-ignore
  const xoaHoi = (monId: string, hoiId: string) =>
    setHoi((x) => ({ ...x, [monId]: (x[monId] ?? []).filter((h) => h.id !== hoiId) }))
  const lat = (id: string) =>
    setThu((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })

  // ── Suy ra ──────────────────────────────────────────────────────────────────
  const tinh = useMemo(
    () => mons.map((m) => tinhMon(m, hoi[m.id] ?? [], chon[m.id])),
    [mons, hoi, chon],
  )
  const dem_loc = useMemo(() => {
    const r = {} as Record<Loc, number>
    for (const k of Object.keys(LOC_TEST) as Loc[]) r[k] = tinh.filter(LOC_TEST[k]).length
    return r
  }, [tinh])
  const hien = useMemo(() => tinh.filter(LOC_TEST[loc]), [tinh, loc])
  const tong = useMemo(() => {
    let tienChon = 0
    let thamKhao = 0
    let coChon = 0
    for (const t of tinh) {
      if (t.tien != null) tienChon += t.tien
      if (t.chon && !t.chon.tham_khao) coChon++
      if (t.chon?.tham_khao && t.m.sl) thamKhao += Math.round(t.chon.gia * t.m.sl)
    }
    return { tienChon, thamKhao, coChon }
  }, [tinh])
  const hoiMon = hoiCho ? (tinh.find((t) => t.m.id === hoiCho) ?? null) : null
  /** Tên NCC đã gặp trong kết quả — gợi ý cho ô gõ NCC ở hộp ghi giá hỏi. */
  const tenNcc = useMemo(
    () => [...new Set(tinh.flatMap((t) => t.m.kq?.ncc.map((n) => n.supplier_name) ?? []))].sort(), // prettier-ignore
    [tinh],
  )

  return {
    mons,
    tinh,
    hien,
    ky,
    meta,
    homNay,
    view,
    setView,
    loc,
    setLoc,
    dem_loc,
    chiChon,
    setChiChon,
    thu,
    lat,
    tong,
    hopDan,
    setHopDan,
    hoiCho,
    setHoiCho,
    hoiMon,
    dangXuat,
    xuatExcel,
    tenNcc,
    them,
    dan,
    xoa,
    xoaHet,
    traLai,
    doiKy,
    datSl,
    chonQuyCach,
    tachQuyCach,
    chonNcc,
    ghiHoi,
    xoaHoi,
  } as const
}

export type TraGiaCtx = ReturnType<typeof useTraGia>
