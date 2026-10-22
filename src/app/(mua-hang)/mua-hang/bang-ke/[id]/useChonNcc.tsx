'use client'

import { useMemo, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { LY_DO_GOI_Y, type UngVienNcc } from '@/lib/goi-y-ncc'
import { sameUnit } from '@/lib/po-paste'
import type { NguonNccLenh } from '@/modules/dept/supply/ke-hoach-mua.service'
import type { DongKH } from './ke-hoach.shared'

/** Lựa chọn NCC của một mã — đã lưu (0275) hay đang là gợi ý của máy. */
export type ChonMa = {
  supplier_id: string | null
  supplier_name: string
  /** Giá theo `co_so`: đ/ĐVT mua ('unit') hoặc đ/kg ('kg'). Null = chưa có giá. */
  price: number | null
  co_so: 'unit' | 'kg'
  /** Đã ghi vào DB chưa — chưa thì đang là gợi ý, đóng màn là mất. */
  luu: boolean
  lyDo: string
}

/**
 * Giá + cơ sở tính khi chọn một ứng viên: hàng kim loại có giá/kg → tính theo kg
 * (lên đơn là price_basis unit2); còn lại theo ĐVT mua. Giá lần trước tính theo
 * ĐVT KHÁC ĐVT của mã (LĐS mua theo Kg, mã tính Con) → KHÔNG mang giá sang, để
 * trống cho người mua gõ, kẻo lệch cả trăm lần.
 */
function giaTuUngVien(
  u: UngVienNcc | undefined,
  unit: string,
): Pick<ChonMa, 'price' | 'co_so'> {
  if (!u) return { price: null, co_so: 'unit' }
  if (u.giaKg != null) return { price: u.giaKg, co_so: 'kg' }
  if (u.giaDv != null && sameUnit(u.dvGia, unit)) return { price: u.giaDv, co_so: 'unit' }
  return { price: null, co_so: 'unit' }
}

/**
 * BƯỚC 2 · CHỌN NCC — state + việc. Mỗi thay đổi GHI NGAY (PUT lsx-sourcing),
 * không tải lại trang (bảng kê nạp ~5 s); lỗi thì trả về lựa chọn cũ + báo.
 */
export function useChonNcc({
  lsxId,
  nguon,
  conDat,
}: {
  lsxId: string
  nguon: NguonNccLenh
  conDat: DongKH[]
}) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [tich, setTich] = useState<ReadonlySet<string>>(() => new Set())
  const [locNcc, setLocNcc] = useState<'tat_ca' | 'chua_gia' | 'chua_luu'>('tat_ca')

  /**
   * NỀN tính lại từ dữ liệu máy chủ mỗi lần (đã lưu → gợi ý của máy); state chỉ
   * giữ phần ĐỔI trong phiên. Nhờ vậy bước 1 thêm mã (tải lại trang) thì bước 2
   * có gợi ý ngay cho mã mới, không kẹt bản chụp lúc mở màn.
   */
  const [doi, setDoi] = useState<Record<string, ChonMa>>({})
  const nen = useMemo(() => {
    const daLuu = new Map(nguon.chon.map((c) => [c.material_id, c]))
    const out: Record<string, ChonMa> = {}
    for (const { r } of conDat) {
      const c = daLuu.get(r.material_id)
      if (c) {
        out[r.material_id] = {
          supplier_id: c.supplier_id,
          supplier_name: c.supplier_name,
          price: c.price,
          co_so: c.price_basis,
          luu: true,
          lyDo: 'đã chọn',
        }
        continue
      }
      const u = nguon.goiY[r.material_id]?.[0]
      out[r.material_id] = {
        supplier_id: u?.supplier_id ?? null,
        supplier_name: u?.supplier_name ?? '',
        ...giaTuUngVien(u, r.unit),
        luu: false,
        lyDo: u ? LY_DO_GOI_Y[u.nguon] : '',
      }
    }
    return out
  }, [nguon, conDat])
  const chon = useMemo(() => ({ ...nen, ...doi }), [nen, doi])
  /** Ghi đè phần đổi trong phiên (giữ API `setChon` cho các hàm dưới). */
  const setChon = (
    v: Record<string, ChonMa> | ((s: Record<string, ChonMa>) => Record<string, ChonMa>),
  ) =>
    setDoi((cur) => {
      const full = typeof v === 'function' ? v({ ...nen, ...cur }) : v
      // Chỉ giữ mã KHÁC nền — không chụp lại cả bảng, kẻo nền mới (tải lại) bị đè.
      return Object.fromEntries(Object.entries(full).filter(([k, x]) => x !== nen[k]))
    })

  const tenNcc = useMemo(
    () => new Map(nguon.nccs.map((s) => [s.id, s.name])),
    [nguon.nccs],
  )
  const unitCua = useMemo(() => new Map(conDat.map((x) => [x.r.material_id, x.r.unit])), [conDat]) // prettier-ignore

  /** Thành tiền dự kiến (chưa VAT) của một mã; null = chưa tính được. */
  function thanhTien(x: DongKH): number | null {
    const c = chon[x.r.material_id]
    if (!c?.supplier_id || c.price == null) return null
    if (c.co_so === 'unit') return c.price * x.d.conPhaiDat
    const kg = nguon.kgMoiDv[x.r.material_id]
    return kg ? c.price * kg * x.d.conPhaiDat : null
  }

  const dem = useMemo(() => {
    let coNcc = 0, chuaGia = 0, chuaLuu = 0, tong = 0, thieuTien = 0 // prettier-ignore
    for (const x of conDat) {
      const c = chon[x.r.material_id]
      if (!c?.supplier_id) continue
      coNcc++
      if (c.price == null) chuaGia++
      if (!c.luu) chuaLuu++
      const t = thanhTien(x)
      if (t == null) thieuTien++
      else tong += t
    }
    return { coNcc, chuaGia, chuaLuu, tong, thieuTien, nccs: new Set(conDat.map((x) => chon[x.r.material_id]?.supplier_id).filter(Boolean)).size } // prettier-ignore
    // eslint-disable-next-line react-hooks/exhaustive-deps -- thanhTien chỉ đọc chon + nguon
  }, [conDat, chon, nguon.kgMoiDv])

  /** Ghi các mã lên máy chủ; lỗi thì trả state cũ. */
  async function ghi(
    ids: string[],
    moi: Record<string, ChonMa>,
    cu: Record<string, ChonMa>,
  ) {
    const rows = ids
      .map((id) => ({ id, c: moi[id] }))
      .filter((x) => x.c?.supplier_id)
      .map(({ id, c }) => ({
        material_id: id,
        supplier_id: c.supplier_id!,
        price: c.price,
        price_basis: c.co_so,
      }))
    if (rows.length === 0) return true
    setBusy(true)
    try {
      await api('/api/dept/supply/lsx-sourcing', {
        method: 'PUT',
        body: { production_order_id: lsxId, rows },
      })
      setChon((s) => {
        const n = { ...s }
        for (const r of rows) n[r.material_id] = { ...n[r.material_id], luu: true }
        return n
      })
      return true
    } catch (e) {
      setChon(cu)
      toast.error('Chưa lưu được lựa chọn NCC', apiErrorText(e))
      return false
    } finally {
      setBusy(false)
    }
  }

  /** Đổi NCC của một mã — giá lấy theo ứng viên đó nếu có, NCC ngoài gợi ý thì để trống. */
  function doiNcc(materialId: string, supplierId: string) {
    const u = nguon.goiY[materialId]?.find((x) => x.supplier_id === supplierId)
    const cu = chon
    const moi = {
      ...chon,
      [materialId]: {
        supplier_id: supplierId,
        supplier_name: u?.supplier_name ?? tenNcc.get(supplierId) ?? '—',
        ...giaTuUngVien(u, unitCua.get(materialId) ?? ''),
        luu: false,
        lyDo: 'người mua chọn',
      },
    }
    setChon(moi)
    void ghi([materialId], moi, cu)
  }

  /** Gõ giá chào — lưu theo lệnh (Q4), chưa vào bảng giá chung. */
  function doiGia(materialId: string, price: number | null) {
    const c = chon[materialId]
    if (!c?.supplier_id || c.price === price) return
    const cu = chon
    const moi = { ...chon, [materialId]: { ...c, price, luu: false } }
    setChon(moi)
    void ghi([materialId], moi, cu)
  }

  /** Lưu mọi gợi ý của máy đang hiện thành lựa chọn. */
  async function luuGoiY() {
    const ids = conDat
      .map((x) => x.r.material_id)
      .filter((id) => chon[id]?.supplier_id && !chon[id].luu)
    if (await ghi(ids, chon, chon))
      toast.success(`Đã lưu lựa chọn NCC cho ${ids.length} mã`)
  }

  /** Gán một NCC cho mọi dòng đang tích. */
  async function ganNcc(supplierId: string) {
    const ids = [...tich]
    if (ids.length === 0) return
    const cu = chon
    const moi = { ...chon }
    for (const id of ids) {
      const u = nguon.goiY[id]?.find((x) => x.supplier_id === supplierId)
      moi[id] = {
        supplier_id: supplierId,
        supplier_name: u?.supplier_name ?? tenNcc.get(supplierId) ?? '—',
        ...giaTuUngVien(u, unitCua.get(id) ?? ''),
        luu: false,
        lyDo: 'người mua chọn',
      }
    }
    setChon(moi)
    if (await ghi(ids, moi, cu)) {
      toast.success(`Đã gán ${tenNcc.get(supplierId) ?? 'NCC'} cho ${ids.length} mã`)
      setTich(new Set())
    }
  }

  /** Bỏ lựa chọn đã lưu → về gợi ý của máy. */
  async function boChon(materialId: string) {
    setBusy(true)
    try {
      await api('/api/dept/supply/lsx-sourcing', {
        method: 'DELETE',
        body: { production_order_id: lsxId, material_ids: [materialId] },
      })
      const u = nguon.goiY[materialId]?.[0]
      setChon((s) => ({
        ...s,
        [materialId]: {
          supplier_id: u?.supplier_id ?? null,
          supplier_name: u?.supplier_name ?? '',
          ...giaTuUngVien(u, unitCua.get(materialId) ?? ''),
          luu: false,
          lyDo: u ? LY_DO_GOI_Y[u.nguon] : '',
        },
      }))
    } catch (e) {
      toast.error('Chưa bỏ được lựa chọn', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  function doiTich(id: string) {
    setTich((cur) => {
      const n = new Set(cur)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  return {
    nguon,
    chon,
    dem,
    busy,
    tich,
    setTich,
    doiTich,
    locNcc,
    setLocNcc,
    thanhTien,
    doiNcc,
    doiGia,
    luuGoiY,
    ganNcc,
    boChon,
  } as const
}

export type ChonNccCtx = ReturnType<typeof useChonNcc>
