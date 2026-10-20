'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { groupForBangKe } from '@/lib/lsx-bang-ke'
import {
  chonDuoc,
  demTinhTrangMua,
  hrefLenDon,
  tinhDongMua,
  type TinhTrangMua,
} from '@/lib/lsx-bang-ke-mua'
import { partGroupLabel, partGroupRank } from '@/lib/part-groups'
import { normalizeSearch } from '@/lib/search-text'
import type { LsxBangKe } from '@/modules/dept/supply/lsx-bang-ke.service'
import type { DongBK } from './bang-ke.shared'

export type LocMua = TinhTrangMua | 'can' | null

/**
 * Toàn bộ state của màn Bảng kê vật tư: bộ lọc tình trạng (từ dữ kiện đầu
 * trang), lọc nhóm, tìm, các dòng đã tích để lên đơn, và công tắc định mức nháp
 * (đi qua URL `?nhap=0|1` để link chia sẻ giữ nguyên cách tính).
 */
export function useBangKe({
  bk,
  canEdit,
  includeDraft,
}: {
  bk: LsxBangKe
  canEdit: boolean
  includeDraft: boolean
}) {
  const router = useRouter()
  const [loc, setLoc] = useState<LocMua>(null)
  const [nhom, setNhom] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [chon, setChon] = useState<ReadonlySet<string>>(() => new Set())
  const [moChan, setMoChan] = useState(false)

  // Tính một lần cho mọi dòng; mọi con số trên màn đều đọc từ đây.
  const tatCa = useMemo<DongBK[]>(
    () => bk.rows.map((r) => ({ r, d: tinhDongMua(r) })),
    [bk.rows],
  )
  const byId = useMemo(() => new Map(tatCa.map((x) => [x.r.material_id, x])), [tatCa])
  const dem = useMemo(() => demTinhTrangMua(tatCa.map((x) => x.d)), [tatCa])
  /** Mã có số cần thật (không tính ngoài định mức, chờ xác nhận, chưa điền). */
  const canMua = useMemo(
    () =>
      tatCa.filter(
        (x) => !['ngoai_dm', 'chua_xac_nhan', 'chua_dien'].includes(x.d.tinhTrang),
      ).length,
    [tatCa],
  )

  const nhoms = useMemo(
    () => groupForBangKe(bk.rows, partGroupLabel, partGroupRank).map((k) => k.name),
    [bk.rows],
  )

  const hien = useMemo(() => {
    const tk = normalizeSearch(q).split(/\s+/).filter(Boolean)
    const khop = (x: DongBK) =>
      (loc === null ||
        (loc === 'can'
          ? !['ngoai_dm', 'chua_xac_nhan', 'chua_dien'].includes(x.d.tinhTrang)
          : x.d.tinhTrang === loc)) &&
      tk.every((t) =>
        normalizeSearch(`${x.r.material_code} ${x.r.material_name}`).includes(t),
      )
    const rows = tatCa.filter(khop).map((x) => x.r)
    return groupForBangKe(rows, partGroupLabel, partGroupRank).filter(
      (k) => nhom === null || k.name === nhom,
    )
  }, [tatCa, loc, q, nhom])
  const soDongHien = useMemo(() => hien.reduce((s, k) => s + k.rows.length, 0), [hien])

  const daChon = useMemo(
    () =>
      [...chon]
        .map((id) => byId.get(id))
        .filter((x): x is DongBK => !!x && chonDuoc(x.d)),
    [chon, byId],
  )
  const hrefDon = useMemo(
    () =>
      hrefLenDon(
        bk.lsx.id,
        daChon.map((x) => ({
          material_code: x.r.material_code,
          conPhaiDat: x.d.conPhaiDat,
        })),
      ),
    [bk.lsx.id, daChon],
  )

  function toggleChon(id: string) {
    setChon((cur) => {
      const n = new Set(cur)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  /** Tích / bỏ tích mọi dòng ĐANG HIỆN mà còn phải đặt. */
  function chonHetHien(on: boolean) {
    setChon((cur) => {
      const n = new Set(cur)
      for (const k of hien)
        for (const r of k.rows) {
          const x = byId.get(r.material_id)
          if (!x || !chonDuoc(x.d)) continue
          if (on) n.add(r.material_id)
          else n.delete(r.material_id)
        }
      return n
    })
  }
  const hienChonDuoc = useMemo(
    () =>
      hien.reduce(
        (s, k) =>
          s +
          k.rows.filter((r) =>
            chonDuoc(byId.get(r.material_id)?.d ?? ({ conPhaiDat: 0 } as never)),
          ).length,
        0,
      ),
    [hien, byId],
  )
  const hetHienDaChon =
    hienChonDuoc > 0 &&
    hien.every((k) =>
      k.rows.every(
        (r) => !chonDuoc(byId.get(r.material_id)!.d) || chon.has(r.material_id),
      ),
    )

  function doiNhap(on: boolean) {
    router.replace(`?nhap=${on ? '1' : '0'}`)
  }
  function lenDon() {
    if (hrefDon) router.push(hrefDon)
  }
  /** Bấm ô "chưa quy đổi được" ở đầu trang → mở khối cuối trang và cuộn tới. */
  function toiChan() {
    setMoChan(true)
    requestAnimationFrame(() =>
      document.getElementById('bk-chan')?.scrollIntoView({ block: 'start' }),
    )
  }

  return {
    bk,
    canEdit,
    includeDraft,
    loc,
    setLoc,
    nhom,
    setNhom,
    nhoms,
    q,
    setQ,
    tatCa,
    byId,
    dem,
    canMua,
    hien,
    soDongHien,
    chon,
    daChon,
    toggleChon,
    chonHetHien,
    hienChonDuoc,
    hetHienDaChon,
    hrefDon,
    lenDon,
    doiNhap,
    moChan,
    setMoChan,
    toiChan,
  } as const
}

export type BangKeCtx = ReturnType<typeof useBangKe>
