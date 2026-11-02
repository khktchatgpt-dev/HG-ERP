import { ngayGioVn } from '@/lib/date-vn'
import type { DongDinhMuc, DongLenh } from '@/lib/lenh-doi'
import { doiQuyCach, type TruongDau, type TruongDong } from '@/lib/nhat-ky-lenh'
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

/* ── Thay đổi của lệnh (T3) ─────────────────────────────────────────────── */

const NHAN_DAU: Record<TruongDau, string> = {
  ship_date: 'Ngày xuất',
  materials_due_at: 'Mốc vật tư',
  priority: 'Ưu tiên',
  status: 'Trạng thái',
}
const NHAN_DONG: Record<TruongDong, string> = {
  sp: 'đổi SP',
  qty: 'SL sản phẩm',
  unit: 'ĐVT',
  specs: 'quy cách',
  ship_date: 'ngày xuất dòng',
}

const TRANG_THAI: Record<string, string> = {
  approved: 'Đã duyệt',
  in_progress: 'Đang sản xuất',
  cancelled: 'Đã huỷ',
  completed: 'Hoàn thành',
}

const dmyNgan = (iso: string | number | null) => {
  if (iso === null || iso === '') return '—'
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/** Số ngày giữa hai ngày ISO (sau − trước); null nếu thiếu một bên. */
export function soNgay(truoc: string | number | null, sau: string | number | null) {
  if (!truoc || !sau) return null
  return Math.round((Date.parse(String(sau)) - Date.parse(String(truoc))) / 86_400_000)
}

/** Một thay đổi của lệnh thành hai mẩu chữ: "thay đổi gì" + "cũ → mới". */
export function moTaLenh(x: DongLenh): { gi: string; cuMoi: string } {
  if (x.phan === 'dau') {
    if (x.truong === 'status') {
      const tt = (v: string | number | null) => TRANG_THAI[String(v)] ?? String(v ?? '—')
      return {
        gi: x.sau === 'cancelled' ? 'Huỷ lệnh' : 'Mở lại lệnh đã huỷ',
        cuMoi: `${tt(x.truoc)} → ${tt(x.sau)}`,
      }
    }
    const gt = x.truong === 'priority' ? (v: typeof x.truoc) => String(v ?? '—') : dmyNgan
    return { gi: NHAN_DAU[x.truong], cuMoi: `${gt(x.truoc)} → ${gt(x.sau)}` }
  }
  const a = x.truoc
  const b = x.sau
  const sp = b?.product_code ?? a?.product_code ?? '—'
  const dv = (b?.unit ?? a?.unit) ? ` ${b?.unit ?? a?.unit}` : ''
  if (x.loai === 'them')
    return { gi: `${sp} · thêm SP`, cuMoi: `SL ${soDm(b?.qty ?? 0)}${dv}` }
  if (x.loai === 'bo')
    return { gi: `${sp} · bỏ SP`, cuMoi: `SL ${soDm(a?.qty ?? 0)} → 0` }
  const phan: string[] = []
  for (const f of x.truong) {
    if (f === 'qty') phan.push(`${soDm(a?.qty ?? 0)} → ${soDm(b?.qty ?? 0)}${dv}`)
    if (f === 'sp') phan.push(`${a?.product_code ?? '—'} → ${b?.product_code ?? '—'}`)
    if (f === 'unit') phan.push(`ĐVT ${a?.unit ?? '—'} → ${b?.unit ?? '—'}`)
    if (f === 'ship_date') phan.push(`xuất ${dmyNgan(a?.ship_date ?? null)} → ${dmyNgan(b?.ship_date ?? null)}`) // prettier-ignore
    if (f === 'specs')
      for (const q of doiQuyCach(a?.specs ?? {}, b?.specs ?? {}))
        phan.push(`${q.nhan}: ${q.truoc ?? '—'} → ${q.sau ?? '—'}`)
  }
  return {
    gi: `${sp} · ${x.truong.map((f) => NHAN_DONG[f]).join(', ')}`,
    cuMoi: phan.join(' · '),
  }
}

/** "Ai · lúc" của một thay đổi lệnh: người (hoặc "không ghi người"), giờ; thấy từ mốc soát thì nói vậy. */
export function aiLucLenh(x: DongLenh): { ai: string; luc: string } {
  if (!x.luc) return { ai: '—', luc: 'so với mốc soát' }
  return { ai: x.boi ?? 'không ghi người', luc: ngayGio(x.luc) }
}
