'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { useLocalPref } from '@/lib/use-local-pref'
import {
  COT_TRONG,
  demViec,
  locDs,
  phamViDs,
  TAB_DS,
  thuTuDs,
  VIEC_DS,
  type BoLocDs,
  type CotTrong,
  type TabDs,
  type ViecDs,
} from '@/lib/nhan-su/danh-sach'
import type { LuoiNhanVien } from '@/modules/dept/hr/cham-cong/ho-so-nv.service'

export type TrangDs = { nv: LuoiNhanVien; sua: boolean; homNay: string }

/** Tập đang lọc (sessionStorage) — trang hồ sơ đọc để ‹ › đi đúng thứ tự người xem đang thấy. */
export const KHOA_TAP = 'hr-nv-tap'
/** Bộ lọc nhớ trong PHIÊN: quay lại từ hồ sơ thì giữ nguyên; tab mới thì về "Đang làm". */
const KHOA_LOC = 'hr-nv-ds'
/** Bộ cột + nhóm là thói quen của người xem — nhớ lâu (localStorage). */
const KHOA_XEM = 'hr-nv-xem'

export type BoCot = 'ds_cnv' | 'giay_to' | 'cong_viec'
type Xem = { cot: BoCot; nhom: boolean }

const LOC_MAC_DINH: BoLocDs = {
  tab: 'dang_lam',
  viec: null,
  tim: '',
  to: '',
  trong: null,
}
const XEM_MAC_DINH: Xem = { cot: 'ds_cnv', nhom: true }

function docLoc(s: string): BoLocDs {
  try {
    const v = { ...LOC_MAC_DINH, ...(JSON.parse(s) as Partial<BoLocDs>) }
    // Giá trị lạ (bản cũ, sửa tay) thì về mặc định, không để bảng rỗng không lý do.
    return {
      tab: TAB_DS.some((t) => t.id === v.tab) ? v.tab : 'dang_lam',
      viec: VIEC_DS.some((x) => x.id === v.viec) ? v.viec : null,
      tim: typeof v.tim === 'string' ? v.tim : '',
      to: typeof v.to === 'string' ? v.to : '',
      trong: v.trong && v.trong in COT_TRONG ? v.trong : null,
    }
  } catch {
    return LOC_MAC_DINH
  }
}
function docXem(s: string): Xem {
  try {
    const v = { ...XEM_MAC_DINH, ...(JSON.parse(s) as Partial<Xem>) }
    return {
      cot: ['ds_cnv', 'giay_to', 'cong_viec'].includes(v.cot) ? v.cot : 'ds_cnv',
      nhom: v.nhom !== false,
    }
  } catch {
    return XEM_MAC_DINH
  }
}

/** Câu báo tại chỗ ở thanh trạng thái (thay toast — màn không dùng kit). */
type Bao = { ok: boolean; text: string } | null

/**
 * State + thao tác của danh sách. Ô đếm, tab, chân đếm trống và lưới cùng đếm bằng hàm ở
 * `lib/nhan-su/danh-sach` — số trên ô là số dòng bấm vào sẽ thấy.
 */
export function useNhanVienDs(h: TrangDs) {
  const router = useRouter()
  const [chon, setChon] = useState<Set<string>>(new Set())
  const [locRaw, ghiLoc] = useLocalPref(KHOA_LOC, JSON.stringify(LOC_MAC_DINH), 'session')
  const loc = useMemo(() => docLoc(locRaw), [locRaw])
  // Đổi lọc thì bỏ chọn: dòng đã chọn có thể không còn hiện, "đổi tổ cho 3 người" sẽ đánh lừa.
  const doiLoc = (p: Partial<BoLocDs>) => {
    ghiLoc(JSON.stringify({ ...loc, ...p }))
    setChon(new Set())
  }
  const [xemRaw, ghiXem] = useLocalPref(KHOA_XEM, JSON.stringify(XEM_MAC_DINH))
  const xem = useMemo(() => docXem(xemRaw), [xemRaw])
  // Người không có quyền riêng tư không có bộ cột Giấy tờ & liên hệ.
  const cot: BoCot = !h.nv.rieng && xem.cot === 'giay_to' ? 'ds_cnv' : xem.cot
  const [, ghiTap] = useLocalPref(KHOA_TAP, '[]', 'session')
  const [dong, setDong] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [bao, setBao] = useState<Bao>(null)
  const [moTuyen, setMoTuyen] = useState(false)
  const [moNap, setMoNap] = useState(false)

  const all = h.nv.ds
  const demTab = useMemo(
    () =>
      Object.fromEntries(
        TAB_DS.map((t) => [t.id, phamViDs(all, { ...loc, tab: t.id }).length]),
      ) as Record<TabDs, number>,
    [all, loc],
  )
  const pham = useMemo(() => phamViDs(all, loc), [all, loc])
  const dem = useMemo(() => demViec(pham, h.homNay), [pham, h.homNay])
  const ds = useMemo(
    () => thuTuDs(locDs(all, loc, h.homNay), xem.nhom),
    [all, loc, h.homNay, xem.nhom],
  )

  function moHoSo(code: string) {
    ghiTap(JSON.stringify(ds.map((n) => n.code)))
    router.push(`/hr/nhan-vien/${encodeURIComponent(code)}`)
  }

  function batChon(id: string) {
    setChon((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  async function hangLoat(v: { shift_id?: string; team?: string }, ten: string) {
    setBusy(true)
    try {
      await api('/api/dept/hr/cham-cong/nhan-vien/hang-loat', {
        method: 'POST',
        body: { ids: [...chon], ...v },
      })
      setBao({ ok: true, text: `Đã đổi ${ten} cho ${chon.size} người` })
      setChon(new Set())
      router.refresh()
      return true
    } catch (e) {
      setBao({ ok: false, text: `Chưa đổi được ${ten}: ${apiErrorText(e)}` })
      return false
    } finally {
      setBusy(false)
    }
  }

  return {
    h,
    loc,
    setTab: (tab: TabDs) => doiLoc({ tab, viec: tab === 'da_nghi' ? null : loc.viec }),
    // Bấm lại ô đang chọn = bỏ chọn.
    setViec: (v: ViecDs) => doiLoc({ viec: loc.viec === v ? null : v }),
    setTim: (tim: string) => doiLoc({ tim }),
    setTo: (to: string) => doiLoc({ to }),
    setTrong: (trong: CotTrong | null) => doiLoc({ trong }),
    boLoc: (k: keyof BoLocDs) => doiLoc({ [k]: LOC_MAC_DINH[k] }),
    cot,
    setCot: (c: BoCot) => ghiXem(JSON.stringify({ ...xem, cot: c })),
    nhom: xem.nhom,
    setNhom: (nhom: boolean) => ghiXem(JSON.stringify({ ...xem, nhom })),
    demTab,
    dem,
    ds,
    chon,
    batChon,
    chonHet: (on: boolean) => setChon(on ? new Set(ds.map((n) => n.id)) : new Set()),
    boChon: () => setChon(new Set()),
    dong,
    batDong: (k: string) =>
      setDong((s) => {
        const n = new Set(s)
        if (n.has(k)) n.delete(k)
        else n.add(k)
        return n
      }),
    busy,
    bao,
    setBao,
    hangLoat,
    moHoSo,
    moTuyen,
    moNap,
    setMoNap,
    setMoTuyen,
  } as const
}

export type DsCtx = ReturnType<typeof useNhanVienDs>
