'use client'

import { useMemo, useState } from 'react'
import { conPhaiDat, type NplCon, type NplConTT } from '@/lib/npl-con-phai-dat'
import {
  coLoc,
  demNpl,
  locNpl,
  nhomTheoLenh,
  NPL_LOC_TRONG,
  phamViNpl,
  xuatTruoc,
  type NplLenh,
  type NplLoc,
  type NplRow,
} from '@/lib/npl-theo-lenh'
import type { SupplyScope } from '@/lib/supply-scope'
import type { NplCanData } from '@/modules/dept/supply/npl-theo-lenh.service'
import { TAB_DAU, trongTab, type NplTabXem } from './npl.shared'

/** Ghi một tham số lên địa chỉ trang mà không tải lại (state PHẢI null). */
function ghiUrl(k: string, v: string | null) {
  // Next coi state mang cờ nội bộ là lệnh của chính nó và không đồng bộ lại.
  const url = new URL(window.location.href)
  if (v == null) url.searchParams.delete(k)
  else url.searchParams.set(k, v)
  window.history.replaceState(null, '', url)
}

/** Bỏ dấu + chữ thường — cùng cách tìm với `locNpl`. */
function khongDau(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
}

export type DemXem = Record<NplTabXem, number> & { tre: number }
export type NhomCon = { lenh: NplLenh; rows: NplCon[] }

/**
 * Toàn bộ state của màn NPL theo lệnh: phạm vi, tab, bộ lọc, nhóm gập, dòng
 * chọn, dòng mở chi tiết. Thứ tự lọc: phạm vi (Của tôi / Cả phòng) → thanh lọc
 * → tab. Số trên tab đếm trên tập ĐÃ qua phạm vi + thanh lọc (cùng hàm với
 * lưới) nên bấm tab nào thấy đúng chừng ấy dòng.
 *
 * Tab "Còn phải đặt" (bản vẽ 3) đếm trên số cần theo định mức, KHÔNG qua phạm vi
 * (Q4: mỗi lệnh 2–5 người cầm đơn, "của tôi" không bớt được gì) — luôn cả phòng.
 */
export function useNpl(
  rows: NplRow[],
  lenh: NplLenh[],
  can: NplCanData,
  tabDau: NplTabXem,
  meId: string | null,
  phamViDau: SupplyScope,
) {
  const [phamVi, setPhamViState] = useState<SupplyScope>(phamViDau)
  const [tab, setTabState] = useState<NplTabXem>(tabDau)
  const [loc, setLoc] = useState<NplLoc>(NPL_LOC_TRONG)
  const [ttCon, setTtCon] = useState<'' | NplConTT>('')
  const [gap, setGap] = useState<Set<string>>(() => new Set())
  const [chon, setChon] = useState<string | null>(null)
  const [moChia, setMoChia] = useState<Set<string>>(() => new Set())
  const [moKhongSo, setMoKhongSo] = useState(false)

  const lenhById = useMemo(() => new Map(lenh.map((l) => [l.id, l])), [lenh])
  const trongPV = useMemo(() => phamViNpl(rows, phamVi, meId), [rows, phamVi, meId])
  const daLoc = useMemo(() => locNpl(trongPV, loc), [trongPV, loc])

  const conTatCa = useMemo(() => conPhaiDat(can.con), [can.con])
  const conLoc = useMemo(() => {
    const q = khongDau(loc.q.trim())
    return conTatCa.filter((c) => {
      if (loc.lsx && c.lsx_id !== loc.lsx) return false
      if (loc.nhom && (c.nhom ?? '') !== loc.nhom) return false
      if (ttCon && c.tt !== ttCon) return false
      if (
        q &&
        !khongDau(`${c.ma} ${c.ten} ${c.sp.map((s) => s.sp_code).join(' ')}`).includes(q)
      )
        return false
      return true
    })
  }, [conTatCa, loc, ttCon])

  const dem: DemXem = useMemo(
    () => ({ ...demNpl(daLoc), con: conLoc.length }),
    [daLoc, conLoc],
  )
  /** Số cả phòng cùng bộ lọc — cho câu "Xem cả phòng (n)" khi "của tôi" trống. */
  const demPhong: DemXem = useMemo(
    () => (phamVi === 'toi' ? { ...demNpl(locNpl(rows, loc)), con: conLoc.length } : dem),
    [phamVi, rows, loc, dem, conLoc],
  )
  const xem = useMemo(
    () => (tab === 'con' ? [] : daLoc.filter((r) => trongTab(r, tab))),
    [daLoc, tab],
  )
  const nhom = useMemo(() => nhomTheoLenh(xem, lenhById), [xem, lenhById])
  const nhomCon: NhomCon[] = useMemo(() => {
    const by = new Map<string, NplCon[]>()
    for (const c of conLoc) {
      const l = by.get(c.lsx_id) ?? []
      l.push(c)
      by.set(c.lsx_id, l)
    }
    return [...by]
      .map(([id, list]) => ({
        lenh: lenhById.get(id) ?? { id, code: list[0].lsx_code, ship_date: null },
        rows: list,
      }))
      .sort((a, b) => xuatTruoc(a.lenh, b.lenh))
  }, [conLoc, lenhById])

  /** Ô chọn của thanh lọc — lấy từ mọi dòng TRONG PHẠM VI, để đổi tab không làm ô chọn nhảy. */
  const chonLoc = useMemo(() => {
    const uniq = (xs: (string | null)[]) =>
      [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) =>
        a.localeCompare(b, 'vi'),
      )
    if (tab === 'con') {
      // Cả lệnh chưa so được — chọn nó thì câu rỗng nói vì sao.
      const ids = new Set([
        ...conTatCa.map((c) => c.lsx_id),
        ...can.khongSo.map((k) => k.id),
      ])
      return {
        lenh: lenh.filter((l) => ids.has(l.id)).sort(xuatTruoc),
        ncc: [],
        nhom: uniq(conTatCa.map((c) => c.nhom)),
        nguoi: [],
      }
    }
    const coDong = new Set(trongPV.map((r) => r.lsx_id))
    return {
      lenh: nhomTheoLenh(trongPV, lenhById)
        .map((g) => g.lenh)
        .filter((l) => coDong.has(l.id)),
      ncc: uniq(trongPV.map((r) => r.supplier)),
      nhom: uniq(trongPV.map((r) => r.nhom)),
      nguoi: uniq(trongPV.map((r) => r.assignee)),
    }
  }, [tab, conTatCa, can.khongSo, lenh, trongPV, lenhById])

  function setTab(t: NplTabXem) {
    setTabState(t)
    setChon(null)
    // NCC / Phụ trách / trễ không có ở tab Còn phải đặt và ngược lại — bỏ lọc sót.
    if (t === 'con') setLoc((f) => ({ ...f, ncc: '', nguoi: '', quaHen: false }))
    else setTtCon('')
    ghiUrl('tab', t === TAB_DAU ? null : t)
  }

  function setPhamVi(v: SupplyScope) {
    setPhamViState(v)
    setChon(null)
    // "Của tôi" không có cột / ô lọc Phụ trách — bỏ lọc người còn sót từ Cả phòng.
    if (v === 'toi') setLoc((f) => ({ ...f, nguoi: '' }))
    ghiUrl('pham_vi', v)
  }

  function datLoc(part: Partial<NplLoc>) {
    setLoc((f) => ({ ...f, ...part }))
  }

  function boLoc() {
    setLoc(NPL_LOC_TRONG)
    setTtCon('')
  }

  function lat(set: Set<string>, key: string): Set<string> {
    const next = new Set(set)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  }

  const idNhom =
    tab === 'con' ? nhomCon.map((g) => g.lenh.id) : nhom.map((g) => g.lenh.id)
  const tatCaGap = idNhom.length > 0 && idNhom.every((id) => gap.has(id))

  return {
    phamVi,
    setPhamVi,
    phong: phamVi === 'phong',
    soDongPhamVi: trongPV.length,
    tab,
    setTab,
    loc,
    datLoc,
    boLoc,
    coLoc: coLoc(loc) || !!ttCon,
    ttCon,
    setTtCon,
    dem,
    demPhong,
    xem,
    nhom,
    can,
    nhomCon,
    conXem: conLoc,
    chonLoc,
    soNhom: idNhom.length,
    gap,
    latGap: (id: string) => setGap((s) => lat(s, id)),
    tatCaGap,
    gapHet: () => setGap(tatCaGap ? new Set() : new Set(idNhom)),
    chon,
    setChon,
    moChia,
    latChia: (key: string) => setMoChia((s) => lat(s, key)),
    moKhongSo,
    latKhongSo: () => setMoKhongSo((v) => !v),
  } as const
}

export type NplCtx = ReturnType<typeof useNpl>
