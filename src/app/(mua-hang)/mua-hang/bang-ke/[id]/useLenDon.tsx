'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { goiYMauDon } from '@/lib/ke-hoach-len-don'
import type { PoTemplate } from '@/lib/po-template'
import type {
  KetQuaTaoDon,
  NguonNccLenh,
} from '@/modules/dept/supply/ke-hoach-mua.service'
import type { DongKH } from './ke-hoach.shared'
import type { ChonNccCtx } from './useChonNcc'

/** Một đơn sẽ tạo: một NCC + các mã đã chọn NCC đó. */
export type NhomDon = {
  supplier_id: string
  supplier_name: string
  mau: PoTemplate
  /** Mẫu do máy gợi ý (để nói "gợi ý" khi người mua chưa đổi). */
  mauGoiY: PoTemplate
  dong: DongKH[]
  tien: number
  thieuGia: number
  thue: { rate: number; incl: boolean } | null
}

/**
 * BƯỚC 3 · LÊN ĐƠN — gom các mã còn phải đặt theo NCC đã chọn ở bước 2, mỗi NCC
 * một đơn nháp. Mẫu đơn gợi ý (`goiYMauDon`), đổi được trước khi tạo. Tạo xong
 * thì tải lại trang: dòng đã lên nháp tự rời "còn phải đặt" (nháp đã trừ), nên
 * bấm lần nữa không tạo trùng.
 */
export function useLenDon({
  lsxId,
  nguon,
  conDat,
  ncc,
}: {
  lsxId: string
  nguon: NguonNccLenh
  conDat: DongKH[]
  ncc: ChonNccCtx
}) {
  const router = useRouter()
  const toast = useToast()
  const [doiMau, setDoiMau] = useState<Record<string, PoTemplate>>({})
  const [boQua, setBoQua] = useState<ReadonlySet<string>>(() => new Set())
  const [busy, setBusy] = useState(false)
  const [ketQua, setKetQua] = useState<KetQuaTaoDon | null>(null)

  const nhom = useMemo<NhomDon[]>(() => {
    const m = new Map<string, DongKH[]>()
    for (const x of conDat) {
      const sid = ncc.chon[x.r.material_id]?.supplier_id
      if (!sid) continue
      m.set(sid, [...(m.get(sid) ?? []), x])
    }
    return [...m.entries()]
      .map(([sid, dong]) => {
        const mauGoiY = goiYMauDon(
          dong.map((x) => ({
            group_name: x.r.group_name,
            sub_group: x.r.sub_group ?? null,
            co_so: ncc.chon[x.r.material_id].co_so,
          })),
          nguon.mauNcc[sid],
        )
        return {
          supplier_id: sid,
          supplier_name: ncc.chon[dong[0].r.material_id].supplier_name,
          mau: doiMau[sid] ?? mauGoiY,
          mauGoiY,
          dong,
          tien: dong.reduce((s, x) => s + (ncc.thanhTien(x) ?? 0), 0),
          thieuGia: dong.filter((x) => ncc.chon[x.r.material_id].price == null).length,
          thue: nguon.thueNcc[sid] ?? null,
        }
      })
      .sort((a, b) => b.dong.length - a.dong.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- thanhTien đọc ncc.chon
  }, [conDat, ncc.chon, nguon, doiMau])

  const chuaNcc = useMemo(
    () => conDat.filter((x) => !ncc.chon[x.r.material_id]?.supplier_id),
    [conDat, ncc.chon],
  )
  const seTao = nhom.filter((g) => !boQua.has(g.supplier_id))

  function doiTao(sid: string) {
    setBoQua((cur) => {
      const n = new Set(cur)
      if (n.has(sid)) n.delete(sid)
      else n.add(sid)
      return n
    })
  }

  async function taoDon() {
    if (seTao.length === 0) return
    setBusy(true)
    try {
      const r = await api<KetQuaTaoDon>('/api/dept/supply/lsx-sourcing/tao-don', {
        method: 'POST',
        body: {
          production_order_id: lsxId,
          groups: seTao.map((g) => ({
            supplier_id: g.supplier_id,
            template: g.mau,
            lines: g.dong.map((x) => {
              const c = ncc.chon[x.r.material_id]
              return {
                material_id: x.r.material_id,
                qty: x.d.conPhaiDat,
                price: c.price,
                co_so: c.co_so,
              }
            }),
          })),
        },
      })
      setKetQua(r)
      if (r.tao.length > 0) {
        toast.success(`Đã tạo ${r.tao.length} đơn nháp`)
        // NCC đã bỏ tích ở lượt này không bị "nhớ" sang lượt sau.
        setBoQua(new Set())
        router.refresh()
      }
      if (r.loi.length > 0)
        toast.error(`${r.loi.length} NCC chưa tạo được đơn`, r.loi.map((x) => `${x.supplier_name}: ${x.loi}`).join('\n')) // prettier-ignore
    } catch (e) {
      toast.error('Chưa tạo được đơn', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return {
    nhom,
    chuaNcc,
    seTao,
    boQua,
    doiTao,
    setMau: (sid: string, m: PoTemplate) => setDoiMau((s) => ({ ...s, [sid]: m })),
    busy,
    ketQua,
    taoDon,
  } as const
}

export type LenDonCtx = ReturnType<typeof useLenDon>
