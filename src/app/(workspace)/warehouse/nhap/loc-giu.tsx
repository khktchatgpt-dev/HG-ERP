'use client'

import { khopGiu, type CheDoGiu, type NguoiKho } from '@/lib/kho-phu-trach'

/**
 * Dải "Của tôi · <người> · Tất cả" của Nhận hàng (B1 phụ trách nhóm vật tư, bản vẽ
 * 27qPqf6o…, 24/11/2026). Số trên từng nút đếm trên tập đã lọc các trục khác —
 * cùng `khopGiu` màn dùng để lọc lưới. Chỉ là bộ lọc: ai cũng nhận hàng được.
 */
export function LocGiu({
  giuCuaDon,
  nguoi,
  meId,
  cheDo,
  onDoi,
}: {
  /** Người giữ của từng đơn trong tập đã lọc các trục khác. */
  giuCuaDon: readonly (readonly string[])[]
  nguoi: readonly NguoiKho[]
  meId: string
  cheDo: CheDoGiu
  onDoi: (c: CheDoGiu) => void
}) {
  const laNguoiKho = nguoi.some((n) => n.id === meId)
  const dem = (c: CheDoGiu) => giuCuaDon.filter((g) => khopGiu(g, c, meId)).length
  const cacNut: { k: CheDoGiu; t: string }[] = [
    ...(laNguoiKho ? [{ k: 'toi', t: 'Của tôi' }] : []),
    ...nguoi.filter((n) => n.id !== meId).map((n) => ({ k: n.id, t: n.name })),
    { k: 'tat_ca', t: 'Tất cả' },
  ]
  if (nguoi.length === 0) return null
  return (
    <div className="kh-seg" role="radiogroup" aria-label="Người Kho giữ đơn">
      {cacNut.map((o) => (
        <button
          key={o.k}
          type="button"
          role="radio"
          aria-checked={cheDo === o.k}
          title={
            o.k === 'toi' || o.k === 'tat_ca'
              ? undefined
              : `Đơn thuộc nhóm vật tư ${o.t} giữ`
          }
          onClick={() => onDoi(o.k)}
        >
          {o.t}
          <span className="kh-num" style={{ marginLeft: 5 }}>
            {dem(o.k)}
          </span>
        </button>
      ))}
    </div>
  )
}

/** Tên người giữ đơn (tên đầy đủ — đoán "tên gọi" từ chữ cuối dễ sai), cách nhau "·". */
export function tenGiu(
  giu: readonly string[] | undefined,
  nguoi: readonly NguoiKho[],
): string {
  return (giu ?? [])
    .map((id) => nguoi.find((n) => n.id === id)?.name)
    .filter((x): x is string => !!x)
    .join(' · ')
}
