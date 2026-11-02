'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { groupForBangKe } from '@/lib/lsx-bang-ke'
import { demTinhTrangMua, tinhDongMua, type TinhTrangMua } from '@/lib/lsx-bang-ke-mua'
import { partGroupLabel, partGroupRank } from '@/lib/part-groups'
import { normalizeSearch } from '@/lib/search-text'
import type { LsxBangKe } from '@/modules/dept/supply/lsx-bang-ke.service'
import type { NguonNccLenh } from '@/modules/dept/supply/ke-hoach-mua.service'
import type { DongKH } from './ke-hoach.shared'
import { useChonNcc } from './useChonNcc'
import { useLenDon } from './useLenDon'

export type Buoc = 1 | 2 | 3
/** Lọc bảng nhu cầu: một tình trạng, "còn phải đặt", hoặc "nhập tay". */
export type LocNhuCau = TinhTrangMua | 'con_dat' | 'tay' | null

/** Tình trạng KHÔNG có số cần thật — không đếm vào "cần mua". */
const KHONG_CAN: TinhTrangMua[] = ['ngoai_dm', 'chua_xac_nhan', 'chua_dien']

/**
 * Toàn bộ state + việc của màn Kế hoạch mua. Bước đang mở đi theo `?buoc=`
 * (link gửi cho nhau mở đúng bước); công tắc định mức chưa kiểm theo `?nhap=`.
 * Mọi con số trên màn đọc từ `tatCa` — tính MỘT lần bằng `tinhDongMua`, cùng
 * hàm với file Excel bảng kê.
 */
export function useKeHoachMua({
  bk,
  canEdit,
  includeDraft,
  buocDau,
  nguon,
}: {
  bk: LsxBangKe
  canEdit: boolean
  includeDraft: boolean
  buocDau: Buoc
  /** Gợi ý NCC + lựa chọn đã lưu cho các mã còn phải đặt (bước 2). */
  nguon: NguonNccLenh
}) {
  const router = useRouter()
  const toast = useToast()
  const [buoc, setBuocState] = useState<Buoc>(buocDau)
  const [loc, setLoc] = useState<LocNhuCau>(null)
  const [nhom, setNhom] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [moDan, setMoDan] = useState(false)
  const [moChan, setMoChan] = useState(false)
  const [moChuaMa, setMoChuaMa] = useState(false)
  /** Mã đang sửa số cần tại chỗ. */
  const [dangSua, setDangSua] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const tatCa = useMemo<DongKH[]>(
    () => bk.rows.map((r) => ({ r, d: tinhDongMua(r) })),
    [bk.rows],
  )
  const byId = useMemo(() => new Map(tatCa.map((x) => [x.r.material_id, x])), [tatCa])
  const dem = useMemo(() => demTinhTrangMua(tatCa.map((x) => x.d)), [tatCa])
  const conDat = useMemo(() => tatCa.filter((x) => x.d.conPhaiDat > 0), [tatCa])
  const soTay = useMemo(
    () => tatCa.filter((x) => x.r.source === 'manual').length,
    [tatCa],
  )
  const lechTay = useMemo(() => tatCa.filter((x) => x.r.deviates).length, [tatCa])
  const canMua = useMemo(
    () => tatCa.filter((x) => !KHONG_CAN.includes(x.d.tinhTrang)).length,
    [tatCa],
  )
  const nhoms = useMemo(
    () => groupForBangKe(bk.rows, partGroupLabel, partGroupRank).map((k) => k.name),
    [bk.rows],
  )

  const hien = useMemo(() => {
    const tk = normalizeSearch(q).split(/\s+/).filter(Boolean)
    const khopLoc = (x: DongKH) =>
      loc === null ||
      (loc === 'con_dat'
        ? x.d.conPhaiDat > 0
        : loc === 'tay'
          ? x.r.source === 'manual'
          : x.d.tinhTrang === loc)
    const rows = tatCa
      .filter(
        (x) =>
          khopLoc(x) &&
          tk.every((t) =>
            normalizeSearch(`${x.r.material_code} ${x.r.material_name}`).includes(t),
          ),
      )
      .map((x) => x.r)
    return groupForBangKe(rows, partGroupLabel, partGroupRank).filter(
      (k) => nhom === null || k.name === nhom,
    )
  }, [tatCa, loc, q, nhom])
  const soDongHien = useMemo(() => hien.reduce((s, k) => s + k.rows.length, 0), [hien])

  function setBuoc(b: Buoc) {
    setBuocState(b)
    const p = new URLSearchParams(window.location.search)
    p.set('buoc', String(b))
    window.history.replaceState(null, '', `?${p}`)
  }
  function doiNhap(on: boolean) {
    const p = new URLSearchParams(window.location.search)
    p.set('nhap', on ? '1' : '0')
    router.replace(`?${p}`)
  }
  function boLoc() {
    setLoc(null)
    setNhom(null)
    setQ('')
  }
  function toiChuaMa() {
    setMoChuaMa(true)
    requestAnimationFrame(() =>
      document.getElementById('kh-chua-ma')?.scrollIntoView({ block: 'start' }),
    )
  }
  function toiChan() {
    setMoChan(true)
    requestAnimationFrame(() =>
      document.getElementById('kh-chan')?.scrollIntoView({ block: 'start' }),
    )
  }

  /**
   * GHI SỐ CẦN TAY (0184) — gõ tại chỗ hay dán Excel đều qua đây. Ghi đè TỪNG
   * MÃ (chốt 05/09): mã có số tay thì lấy số tay, mã khác vẫn theo định mức.
   */
  async function ghiSoTay(
    rows: { material_id: string; qty_needed: number; note?: string | null }[],
  ): Promise<boolean> {
    if (rows.length === 0) return false
    setBusy(true)
    try {
      await api('/api/dept/supply/lsx-needs', {
        method: 'PUT',
        body: { production_order_id: bk.lsx.id, rows },
      })
      router.refresh()
      toast.success(
        rows.length === 1 ? 'Đã ghi số cần' : `Đã ghi số cần cho ${rows.length} mã`,
      )
      return true
    } catch (e) {
      toast.error('Chưa ghi được số cần', apiErrorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }
  /** Bỏ số tay → mã quay về số theo định mức (hoặc rời bảng nếu không có). */
  async function boSoTay(materialId: string) {
    setBusy(true)
    try {
      await api('/api/dept/supply/lsx-needs', {
        method: 'DELETE',
        body: { production_order_id: bk.lsx.id, material_ids: [materialId] },
      })
      router.refresh()
      toast.success('Đã bỏ số nhập tay — mã quay về số theo định mức')
    } catch (e) {
      toast.error('Chưa bỏ được số tay', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  const ncc = useChonNcc({ lsxId: bk.lsx.id, nguon, conDat })
  const lenDon = useLenDon({ lsxId: bk.lsx.id, nguon, conDat, ncc })

  return {
    ncc,
    lenDon,
    bk,
    canEdit,
    includeDraft,
    buoc,
    setBuoc,
    loc,
    setLoc,
    nhom,
    setNhom,
    nhoms,
    q,
    setQ,
    boLoc,
    tatCa,
    byId,
    dem,
    conDat,
    soTay,
    lechTay,
    canMua,
    hien,
    soDongHien,
    moDan,
    setMoDan,
    moChan,
    setMoChan,
    toiChan,
    moChuaMa,
    setMoChuaMa,
    toiChuaMa,
    dangSua,
    setDangSua,
    busy,
    ghiSoTay,
    boSoTay,
    doiNhap,
  } as const
}

export type KeHoachCtx = ReturnType<typeof useKeHoachMua>
