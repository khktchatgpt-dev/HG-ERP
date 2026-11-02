import { ngayGioVn } from '@/lib/date-vn'
import type { DongDinhMuc } from '@/lib/lenh-doi'
import type { AnhDong, AnhHuong, TruongDm } from '@/lib/nhat-ky-dinh-muc'
import { PART_GROUP_LABEL } from '@/lib/part-groups'

/**
 * CÁCH BÀY MỘT DÒNG ĐỊNH MỨC ĐỔI (T2) — dùng chung cho tab Định mức và nút ▸ của
 * tab Vật tư: một dòng phải được kể bằng CÙNG một câu ở cả hai nơi.
 */

const NHAN_TRUONG: Record<TruongDm, string> = {
  material_code: 'Mã',
  part_name: 'Tên',
  qty: 'SL/SP',
  unit: 'ĐVT',
  dim_a_mm: 'Dày',
  dim_b_mm: 'Rộng',
  wall_thickness_mm: 'Thành',
  cut_length_mm: 'Dài cắt',
  material_note: 'Vật liệu',
  weight_kg: 'Khối lượng',
  waste_pct: 'Hao hụt',
}
const DUOI: Partial<Record<TruongDm, string>> = {
  dim_a_mm: ' mm',
  dim_b_mm: ' mm',
  wall_thickness_mm: ' mm',
  cut_length_mm: ' mm',
  weight_kg: ' kg',
  waste_pct: '%',
}

/** Định mức có số lẻ nhỏ (0,0371 kg) — giữ tới 4 chữ số. */
export const soDm = (x: number) => x.toLocaleString('vi-VN', { maximumFractionDigits: 4 })

function gt(f: TruongDm, v: AnhDong[TruongDm]): string {
  if (v === null) return '—'
  return typeof v === 'number' ? `${soDm(v)}${DUOI[f] ?? ''}` : v
}

/** "04/11 09:11" — ngày giờ VN gọn cho cột hẹp. */
export const ngayGio = (at: string) => {
  const s = ngayGioVn(at)
  return `${s.slice(0, 5)} ${s.slice(11)}`
}

export const anhCua = (d: DongDinhMuc): AnhDong => (d.sau ?? d.truoc)!

export const tenNhom = (g: string | null) =>
  g ? (PART_GROUP_LABEL[g.toUpperCase()] ?? g) : '—'

export const NHAN_LOAI_DM = { them: 'Thêm', sua: 'Sửa', bo: 'Bỏ' } as const

/** Quy cách gọn "13×42×450 mm" của một dòng; không có số nào thì rỗng. */
function quyCach(a: AnhDong): string {
  const so = [a.dim_a_mm, a.dim_b_mm, a.cut_length_mm].filter(
    (v): v is number => v !== null && v > 0,
  )
  return so.length ? `${so.map(soDm).join('×')} mm` : ''
}

/**
 * Phần "cũ → mới" của một dòng, mỗi trường một mẩu ("Mã NK-0216 → NK-0217",
 * "SL/SP 4 → 5"). Mã chưa gắn hiện là "—".
 */
export function moTaDoi(d: DongDinhMuc): string[] {
  if (d.loai === 'them') {
    const a = d.sau!
    return [`SL/SP ${gt('qty', a.qty)}${a.unit ? ` ${a.unit}` : ''}`, quyCach(a)].filter(
      Boolean,
    )
  }
  if (d.loai === 'bo') return [`SL/SP ${gt('qty', d.truoc!.qty)} → 0`]
  return d.truong.map(
    (f) => `${NHAN_TRUONG[f]} ${gt(f, d.truoc![f])} → ${gt(f, d.sau![f])}`,
  )
}

/** Một mục "ảnh hưởng số mua": "+1.600 cái CN1527" + phép tính nguyên văn. */
export function moTaAnhHuong(a: AnhHuong): { chu: string; phep: string } {
  const dv = a.unit ? ` ${a.unit}` : ''
  const phep = `(${a.perSau === null ? '?' : soDm(a.perSau)} − ${a.perTruoc === null ? '?' : soDm(a.perTruoc)}) × ${soDm(a.slSp)} SP` // prettier-ignore
  if (a.delta === null) return { chu: 'chưa rõ — dòng không ghi SL', phep }
  const dau = a.delta > 0 ? '+' : '−'
  return { chu: `${dau}${soDm(Math.abs(a.delta))}${dv}`, phep }
}

/** Ô "Ảnh hưởng số mua": mỗi mã một dòng; dòng chưa mã nhắc gắn mã để so đơn. */
export function AnhHuongO({ d }: { d: DongDinhMuc }) {
  if (d.anhHuong.length === 0)
    return (
      <span className="text-[var(--ink-3)]">
        {d.truong.some((f) => f !== 'qty' && f !== 'material_code' && f !== 'part_name')
          ? 'không đổi số · đổi quy cách'
          : 'không đổi số'}
      </span>
    )
  return (
    <span className="grid gap-0.5">
      {d.anhHuong.map((a, i) => {
        const m = moTaAnhHuong(a)
        return (
          <span key={i} title={m.phep}>
            <b className="font-mono font-semibold whitespace-nowrap tabular-nums">
              {m.chu}
            </b>{' '}
            <span className="text-[12px] text-[var(--ink-3)]">
              {a.code ?? 'chưa mã · gắn mã để so đơn'}
            </span>
          </span>
        )
      })}
    </span>
  )
}
