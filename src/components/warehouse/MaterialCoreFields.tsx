'use client'

import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { namesAlike } from '@/lib/material-key'
import { groupFieldConfig } from '@/lib/material-group-fields'
import { isSheetLike, kgPerM, rhoFor } from '@/lib/metal-weight'
import { guessTemplate } from '@/lib/po-template-guess'
import { type PoTemplate } from '@/lib/po-template'
import type { MaterialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'

/**
 * KHỐI KHAI VẬT TƯ DÙNG CHUNG — một bộ câu hỏi, hai chỗ gọi.
 *
 * Trước đây có HAI form khai vật tư và chúng hỏi khác nhau:
 *   · `QuickAddMaterial` (trong đơn đặt) — nhóm là danh sách chốt, có nhóm phụ,
 *     có mẫu đơn, tự đọc kg/m từ tên.
 *   · `MaterialForm` (danh mục Kho / Cung ứng) — nhóm GÕ TAY, không có ô nhóm
 *     phụ, không có mẫu đơn, không có kg/m.
 *
 * Hệ quả không nằm ở thẩm mỹ: vật tư khai từ danh mục ra đời không có kg/m nên
 * không tính được tiền ở đơn nhôm/inox, còn ô nhóm gõ tay thì đẻ nhóm thứ 15
 * đúng như `docs/tao-vat-tu-ke-hoach.md` cảnh báo. Gom về một khối để hai màn
 * không thể lệch nhau lần nữa.
 *
 * KHÔNG còn ô "Mẫu đơn đặt hàng" (bỏ 08/08/2026): mẫu đơn là thuộc tính của
 * ĐƠN, không gắn theo vật tư — gắn mẫu làm ô tìm của form đặt giấu hàng khác
 * mẫu (gỗ "biến mất"). Máy vẫn ĐOÁN mẫu ngầm từ tên (`guessTemplate`) nhưng chỉ
 * để quyết định có hỏi barem kg/m hay không, không lưu vào danh mục.
 */

export type MaterialCore = {
  name: string
  unit: string
  spec: string
  group_name: string
  sub_group: string
  price_unit: string
  unit2_factor: string
  kg_per_m: string
  default_bar_length_m: string
  /** kg mỗi đơn vị đặt — dùng cho hàng tấm/cuộn, thứ không có barem theo mét. */
  kg_per_unit: string
  /** Vật liệu / màu (0124) — tự điền cột "Vật liệu" trên đơn phụ kiện. */
  material_grade: string
  /** Đóng gói mua (0124): 1 pack_unit = pack_size ĐVT gốc (vd 1 bì = 500 con). */
  pack_size: string
  pack_unit: string
  /** Thông số theo nhóm (0137): bao bì — cách mở AD/MR/ĐK + SP mỗi thùng. */
  open_style: string
  pcs_per_ctn: string
  /** Thông số theo nhóm (0137): kim loại — màu / bề mặt ("inox bóng"). */
  finish: string
}

export const EMPTY_CORE: MaterialCore = {
  name: '',
  unit: '',
  spec: '',
  group_name: '',
  sub_group: '',
  price_unit: '',
  unit2_factor: '',
  kg_per_m: '',
  default_bar_length_m: '',
  kg_per_unit: '',
  material_grade: '',
  pack_size: '',
  pack_unit: '',
  open_style: '',
  pcs_per_ctn: '',
  finish: '',
}

/** Chuẩn hoá tên để dò trùng gần giống: thường hoá, bỏ dấu, gọn khoảng trắng. */
function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

const str = (v: unknown) => (v == null ? '' : String(v))

/** ĐVT về dạng so được: thường hoá + bỏ dấu ("Tấm" → "tam", "Cuộn" → "cuon"). */
function nodUnit(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').trim()
}

/** Đổi một dòng vật tư đã lưu về dạng ô nhập (mở form SỬA). */
export function coreFromMaterial(m: Partial<Record<keyof MaterialCore, unknown>>) {
  return {
    name: str(m.name),
    unit: str(m.unit),
    spec: str(m.spec),
    group_name: str(m.group_name),
    sub_group: str(m.sub_group),
    price_unit: str(m.price_unit),
    unit2_factor: str(m.unit2_factor),
    kg_per_m: str(m.kg_per_m),
    default_bar_length_m: str(m.default_bar_length_m),
    kg_per_unit: str(m.kg_per_unit),
    material_grade: str(m.material_grade),
    pack_size: str(m.pack_size),
    pack_unit: str(m.pack_unit),
    open_style: str(m.open_style),
    pcs_per_ctn: str(m.pcs_per_ctn),
    finish: str(m.finish),
  } satisfies MaterialCore
}

export type MaterialCoreState = ReturnType<typeof useMaterialCore>

export function useMaterialCore({
  active,
  initial,
  templateHint,
  taxonomy,
  excludeCode,
  requireGroup = false,
}: {
  /** Form đang mở — chỉ lúc đó mới nạp danh mục và dò trùng tên. */
  active: boolean
  initial?: Partial<MaterialCore>
  /**
   * Mẫu đơn mượn khi tên không nói lên gì (form trong đơn: mẫu đang soạn).
   * KHÔNG phải mặc định cứng — mẫu quyết định bộ cột của mọi đơn sau này.
   */
  templateHint?: PoTemplate
  /** Danh mục ĐVT/nhóm nạp sẵn ở server — có thì khỏi gọi API. */
  taxonomy?: MaterialTaxonomy
  /** Mã của chính vật tư đang sửa — không tự cảnh báo trùng với bản thân nó. */
  excludeCode?: string
  /**
   * Bắt buộc chọn nhóm (form khai nhanh trong đơn đặt — 0124). Nhóm là phạm vi
   * chặn trùng tên phía server: vật tư không nhóm rơi vào rọ riêng và lọt lưới
   * chặn, mà người đang vội soạn đơn lại chính là người hay bỏ trống nhất.
   */
  requireGroup?: boolean
}) {
  const [f, setF] = useState<MaterialCore>({ ...EMPTY_CORE, ...initial })
  const [fetched, setFetched] = useState<MaterialTaxonomy>({ units: [], groups: [] })
  const tax = taxonomy ?? fetched
  const [similar, setSimilar] = useState<{ code: string; name: string }[]>([])

  const subs = useMemo(
    () => tax.groups.find((g) => g.name === f.group_name)?.subs ?? [],
    [tax, f.group_name],
  )

  /** Bộ ô + placeholder theo NHÓM (0137) — mỗi loại vật tư hỏi đúng bộ của nó. */
  const groupCfg = useMemo(() => groupFieldConfig(f.group_name), [f.group_name])

  /*
   * Nạp ĐVT + nhóm + nhóm phụ MỘT LẦN khi form mở (bỏ qua nếu server đã đưa
   * sẵn). setState nằm trong callback của timer, không gọi thẳng thân effect —
   * gọi đồng bộ ở thân effect gây cascading render.
   */
  useEffect(() => {
    if (taxonomy || !active || fetched.units.length > 0) return
    const t = setTimeout(async () => {
      try {
        setFetched(await api<MaterialTaxonomy>('/api/dept/warehouse/material-taxonomy'))
      } catch {
        // Danh mục chỉ để gợi ý — hỏng thì vẫn gõ tay được, đừng chặn khai vật tư.
      }
    }, 0)
    return () => clearTimeout(t)
  }, [taxonomy, active, fetched.units.length])

  /*
   * BAREM MÁY ĐỌC ĐƯỢC TỪ TÊN — hình học trong tên × tỷ trọng xưởng.
   * "Sắt vuông 30x30x0.8" ra đúng 0,7445 kg/m như barem xưởng đang cân.
   * Đọc không ra thì trả null kèm lý do, KHÔNG đoán — đoán độ dày là sai tiền.
   * Tính TRƯỚC khi đoán mẫu, vì mẫu nhôm chỉ chọn được khi đã có kg/m.
   */
  const derived = useMemo(() => {
    if (f.name.trim().length < 4) return null
    return kgPerM(f.name, rhoFor(f.name, f.group_name))
  }, [f.name, f.group_name])

  const guess = useMemo(() => {
    const g = guessTemplate(f.name, f.sub_group, derived?.kg ?? null)
    return g.reason.startsWith('không suy được') && templateHint
      ? { template: templateHint, reason: 'theo mẫu đơn đang soạn' }
      : g
  }, [f.name, f.sub_group, derived, templateHint])

  // Mẫu chỉ dùng NGẦM (quyết định có hỏi barem kg/m) — không còn ô chọn, không lưu.
  const template = guess.template

  /*
   * Hai mẫu tính tiền theo KHỐI LƯỢNG nên bắt buộc có barem, và `lineReady`
   * chặn gửi dòng khi thiếu:
   *   aluminium → (kg/m × dài cây × số cây) × giá/kg
   *   metal_kg  → (SL × kg/đơn-vị) × giá/kg,  kg/đơn-vị = kg/m × dài cây
   * Hỏi ngay lúc khai, kèm số máy tính sẵn — chứ không đưa ô trống rồi để
   * người soạn đơn đang vội gõ đại cho qua.
   */
  const needsWeight = template === 'aluminium' || template === 'metal_kg'

  /*
   * HÀNG TẤM / CUỘN — khối kg/m + dài cây KHÔNG áp dụng.
   *
   * Barem "kg mỗi mét dài × dài cây" chỉ đúng với hàng CÂY. Tấm inox, tôn cuộn,
   * lưới… cân theo TẤM: đơn thật của phòng Cung ứng ghi thẳng "Trọng lượng tấm
   * (kg)" (Thông Đạt, Hào Tư Hùng) hoặc "Kg/tấm" (Cát Tường), không có cột nào
   * theo mét.
   *
   * Vì sao phải CHẶN chứ không chỉ để trống: `kgPerOrderUnit` nhân kg/m × dài cây
   * ra "kg mỗi đơn vị đặt", rồi số đó được ĐIỀN SẴN vào ô kg/đơn-vị của mọi đơn
   * sau và nhân với giá/kg. Với hàng tấm thì tích đó là con số không có nghĩa —
   * sai tiền mà nhìn vẫn như thật. Kiểm danh mục: 39 vật tư ĐVT "tấm" và 1 "cuộn"
   * đang để trống cả hai ô, tức chưa ai sập bẫy; nhưng cửa vẫn đang mở.
   */
  const sheetLike = isSheetLike(f.name) || /^(tam|cuon|to|kho)/.test(nodUnit(f.unit))
  /** Chỉ hỏi barem theo mét khi thật sự là hàng cây. */
  const needsBarWeight = needsWeight && !sheetLike

  /** Số đang gõ lệch hẳn số máy đọc được → nhiều khả năng gõ nhầm dấu chấm. */
  const kgTyped = Number(f.kg_per_m)
  const kgOff =
    derived?.kg && Number.isFinite(kgTyped) && kgTyped > 0
      ? Math.abs(kgTyped - derived.kg) / derived.kg
      : 0
  const kgMismatch = kgOff > 0.05

  /*
   * Dò trùng tên Ở SERVER. So với danh mục nạp sẵn trong trang là vô dụng: trang
   * chỉ giữ vài chục dòng đang xem trong khi danh mục có 13k — cảnh báo gần như
   * không bao giờ bắn. Debounce 350ms, chỉ hỏi khi tên đủ dài.
   *
   * HAI ĐƯỜNG (0124):
   *   · Đã chọn nhóm → endpoint /materials/similar: so MỜ trong đúng phạm vi
   *     nhóm mà server sẽ chặn cứng — bắt được "Bộ tip Buri"/"Bộ Típ Bori",
   *     "7M"/"7 màu", "đen"/"đem"… là các ca ilike-chứa-nhau lọt sạch (sổ thật
   *     phải ghi tay "Gộp 2 dòng").
   *   · Chưa chọn nhóm → tìm thô theo tên như cũ, thêm so mờ trên kết quả.
   */
  const nName = normalizeName(f.name)
  const groupName = f.group_name.trim()
  useEffect(() => {
    const tooShort = !active || nName.length < 4
    const t = setTimeout(
      async () => {
        if (tooShort) return setSimilar([])
        try {
          if (groupName) {
            const { materials } = await api<{
              materials: { code: string; name: string }[]
            }>(
              `/api/dept/warehouse/materials/similar?name=${encodeURIComponent(
                f.name.trim().slice(0, 200),
              )}&group_name=${encodeURIComponent(groupName)}`,
            )
            setSimilar(materials.filter((m) => m.code !== excludeCode).slice(0, 3))
            return
          }
          const { materials } = await api<{
            materials: { code: string; name: string }[]
          }>(
            `/api/dept/supply/po-materials?limit=8&q=${encodeURIComponent(nName.slice(0, 60))}`,
          )
          setSimilar(
            materials
              .filter((m) => m.code !== excludeCode)
              .filter((m) => {
                const other = normalizeName(m.name)
                return (
                  other.includes(nName) ||
                  nName.includes(other) ||
                  namesAlike(f.name, m.name)
                )
              })
              .slice(0, 3),
          )
        } catch {
          setSimilar([]) // chỉ là cảnh báo, lỗi mạng không được chặn tạo vật tư
        }
      },
      tooShort ? 0 : 350,
    )
    return () => clearTimeout(t)
    // f.name chỉ vào deps qua nName (đã chuẩn hoá) — đổi hoa/thường không refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, nName, groupName, excludeCode])

  /** Số kg/m sẽ ghi: ưu tiên số người gõ, bỏ trống thì lấy số máy đọc được. */
  const kgToSave = f.kg_per_m.trim() ? Number(f.kg_per_m) || null : (derived?.kg ?? null)
  const dual = f.price_unit.trim() !== ''

  /** Phần thân chung của payload POST/PATCH — hai màn gửi giống hệt nhau. */
  function corePayload() {
    return {
      name: f.name.trim(),
      unit: f.unit.trim(),
      spec: f.spec.trim() || null,
      group_name: f.group_name.trim() || null,
      sub_group: f.sub_group.trim() || null,
      price_unit: f.price_unit.trim() || null,
      unit2_factor: dual && f.unit2_factor.trim() ? Number(f.unit2_factor) || null : null,
      // Hàng tấm/cuộn: ghi null cứng. Không chỉ ẩn ô — nếu người dùng gõ số rồi
      // mới đổi tên/ĐVT sang hàng tấm, con số cũ vẫn còn trong state và sẽ đi
      // thẳng vào ô kg/đơn-vị điền sẵn của mọi đơn sau.
      kg_per_m: needsBarWeight ? kgToSave : null,
      default_bar_length_m:
        needsBarWeight && f.default_bar_length_m.trim()
          ? Number(f.default_bar_length_m) || null
          : null,
      // Chỉ hàng tấm/cuộn mới khai số cân trực tiếp; hàng cây suy từ kg/m × dài.
      // Ghi null khi không thuộc diện — đổi qua lại không để sót số cũ.
      kg_per_unit:
        needsWeight && sheetLike && f.kg_per_unit.trim()
          ? Number(f.kg_per_unit) || null
          : null,
      material_grade: f.material_grade.trim() || null,
      // Đóng gói mua: chỉ có nghĩa khi đủ CẢ hai — "1 bì = ?" hay "? = 500" đều
      // không dùng gợi ý được, ghi null cho sạch thay vì lưu nửa thông tin.
      pack_size:
        f.pack_size.trim() && f.pack_unit.trim() ? Number(f.pack_size) || null : null,
      pack_unit: f.pack_size.trim() && f.pack_unit.trim() ? f.pack_unit.trim() : null,
      // Thông số theo nhóm (0137) — ô chỉ hiện đúng nhóm, nhưng GIÁ TRỊ luôn
      // gửi: đổi nhóm sau khi đã gõ thì số cũ về null thay vì kẹt lại ngầm.
      open_style: groupCfg.showCarton ? f.open_style.trim() || null : null,
      pcs_per_ctn: groupCfg.showCarton ? Number(f.pcs_per_ctn) || null : null,
      finish: groupCfg.showFinish ? f.finish.trim() || null : null,
    }
  }

  return {
    f,
    setF,
    tax,
    subs,
    similar,
    derived,
    guess,
    template,
    needsWeight,
    needsBarWeight,
    sheetLike,
    kgMismatch,
    kgOff,
    dual,
    groupCfg,
    requireGroup,
    invalid: !f.name.trim() || !f.unit.trim() || (requireGroup && !f.group_name.trim()),
    corePayload,
  }
}

// ── Mảnh dựng form dùng chung ────────────────────────────────────────────────

/**
 * Ô gõ tự do + GỢI Ý CÓ KIỂM SOÁT — thay `<datalist>` native.
 *
 * Datalist trông gọn trong code nhưng popup là của trình duyệt: 24 đơn vị xổ
 * nguyên một cột cao hơn cả màn hình, không giới hạn/cuộn/style được (ảnh lỗi
 * 07/08/2026). Panel tự quản thì: lọc theo ký tự đang gõ, cao tối đa ~7 dòng
 * rồi cuộn, và vẫn GÕ TỰ DO được — "Lố", "Nhãn", "Thẻ" là ĐVT thật của xưởng,
 * khoá cứng là không khai được (triết lý gõ-tự-do-thay-FK của dự án).
 */
function SuggestInput({
  value,
  onChange,
  options,
  placeholder,
  maxLength,
  className,
  listId,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  options: string[]
  placeholder?: string
  maxLength?: number
  className?: string
  /** Id ổn định cho listbox (aria) — hai form mở cùng lúc không được trùng. */
  listId: string
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [hi, setHi] = useState(-1)

  const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
  const q = norm(value)
  // Đã gõ trùng khớp một nhãn chuẩn thì thôi gợi ý — panel 1 dòng lặp lại chính
  // giá trị trong ô chỉ che form.
  const filtered =
    q && options.some((o) => norm(o) === q)
      ? []
      : options.filter((o) => norm(o).includes(q))

  const pick = (v: string) => {
    onChange(v)
    setOpen(false)
    setHi(-1)
  }

  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => {
          onChange(e.target.value)
          setOpen(true)
          setHi(-1)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Trì hoãn để onMouseDown của option kịp chạy trước khi panel đóng.
          setTimeout(() => setOpen(false), 100)
        }}
        onKeyDown={(e) => {
          if (!open || filtered.length === 0) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setHi((i) => (i + 1) % filtered.length)
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setHi((i) => (i <= 0 ? filtered.length - 1 : i - 1))
          } else if (e.key === 'Enter' && hi >= 0) {
            e.preventDefault()
            pick(filtered[hi])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        role="combobox"
        aria-expanded={open && filtered.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
      />
      {open && filtered.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full right-0 left-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-md dark:border-zinc-700 dark:bg-zinc-900"
        >
          {filtered.map((o, i) => (
            <li
              key={o}
              role="option"
              aria-selected={i === hi}
              // onMouseDown (không phải onClick) — chạy TRƯỚC blur của input,
              // không thì panel đóng mất trước khi click kịp nhận.
              onMouseDown={(e) => {
                e.preventDefault()
                pick(o)
              }}
              className={`cursor-pointer px-3 py-1.5 ${
                i === hi
                  ? 'bg-zinc-100 dark:bg-zinc-800'
                  : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {o}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/**
 * Một ô có nhãn.
 *
 * Vì sao nhãn nằm trong `<span>` riêng: `<label className="flex flex-col">` với
 * nội dung `Tên vật tư <span>*</span>` đẩy dấu sao xuống DÒNG RIÊNG — mỗi ô bắt
 * buộc chiếm ba dòng và trông như lỗi hiển thị. Đó là bug thật, thấy được ở
 * ảnh chụp form cũ.
 */
export function Field({
  label,
  required,
  hint,
  span,
  children,
}: {
  label: string
  required?: boolean
  hint?: React.ReactNode
  /** Chiếm cả hai cột của lưới. */
  span?: boolean
  children: React.ReactNode
}) {
  return (
    <label className={`flex flex-col gap-1 text-sm ${span ? 'sm:col-span-2' : ''}`}>
      <span className="font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="text-xs leading-snug text-zinc-400">{hint}</span>}
    </label>
  )
}

/**
 * Một nhóm ô có tiêu đề.
 *
 * Form danh mục cũ là 16 ô phẳng nối đuôi nhau, ô của Kho lẫn ô của Cung ứng —
 * không có mốc nào để mắt bám. Chia mảng làm người khai biết mình đang ở phần
 * nào và bỏ qua được phần không thuộc việc mình.
 */
export function FormSection({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2">
        <h3 className="text-[11px] font-semibold tracking-wide text-zinc-500 uppercase">
          {title}
        </h3>
        {hint && <span className="text-[11px] text-zinc-400">{hint}</span>}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </section>
  )
}

/**
 * NHẬN DẠNG + PHÂN LOẠI — phần mà hai màn phải hỏi giống hệt nhau.
 *
 * Nguyên tắc: những trường quyết định về sau (nhóm, mẫu đơn, kg/m) thì CHỌN
 * hoặc để máy tính, không gõ tay. Gõ tay ở đây là lỗi phát hiện được sau vài
 * tuần, lúc đơn đã in và hàng đã về.
 */
export function MaterialCoreFields({
  s,
  inputClass,
  unitListId,
  subListId,
  pricingNote = false,
}: {
  s: MaterialCoreState
  inputClass: string
  /** Id của `<datalist>` — hai form có thể mở cùng lúc, không được trùng id. */
  unitListId: string
  subListId: string
  /**
   * Hiện mảng "Cách NCC báo giá" (đơn vị tính giá + hệ số quy đổi).
   *
   * CHỈ Ở DANH MỤC. Trong form đặt hàng thì tắt: hai ô đó không đi vào tính tiền
   * (mẫu đơn mới quyết định), nên với người đang soạn đơn chúng chỉ là hai chỗ
   * để hiểu nhầm. Đếm trên danh mục 12.991 vật tư: 477/489 giá trị đang có chỉ
   * lặp lại đúng cái mẫu đơn đã nói (nhôm→kg, inox/sắt→kg), chỉ 12 dòng mang
   * thông tin thật (gỗ đặt theo tấm, NCC chào theo m³).
   *
   * Giữ ở danh mục để 12 dòng đó còn sửa được — Kho/Cung ứng khai danh mục thì
   * có thời gian đọc kỹ, khác người đang gõ dở một cái đơn.
   */
  pricingNote?: boolean
}) {
  const { f, setF } = s
  const set =
    (k: keyof MaterialCore) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setF((v) => ({ ...v, [k]: e.target.value }))

  return (
    <>
      <FormSection title="Nhận dạng">
        <Field
          label="Tên vật tư"
          required
          span
          hint={
            s.similar.length > 0 ? (
              <span className="block rounded-md bg-amber-50 px-2 py-1 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                ⚠ Tên gần giống vật tư đã có:{' '}
                {s.similar.map((x) => `${x.code} — ${x.name}`).join(' · ')}. Nếu là cùng
                một món, tìm lại ở ô lọc thay vì tạo mã mới.
              </span>
            ) : undefined
          }
        >
          <input
            value={f.name}
            onChange={set('name')}
            maxLength={200}
            className={inputClass}
            autoFocus
          />
        </Field>
        <Field
          label="ĐVT đặt hàng"
          required
          hint="Gợi ý từ danh mục chuẩn, vẫn gõ được nhãn lạ của xưởng."
        >
          {/*
            GỢI Ý TỪ DANH MỤC, vẫn gõ tự do được. Danh mục có 55 nhãn chuẩn,
            nhưng hàng lạ như "Lố", "Nhãn", "Thẻ" là ĐVT thật của xưởng — khoá
            cứng là không khai được. Server chuẩn hoá hoa/thường + NFC lúc lưu.
          */}
          <SuggestInput
            value={f.unit}
            onChange={(v) => setF((x) => ({ ...x, unit: v }))}
            options={s.tax.units}
            listId={unitListId}
            maxLength={30}
            placeholder="Cây / Tấm / Cái…"
            className={inputClass}
          />
        </Field>
        {/* Placeholder + hint ĐỔI THEO NHÓM (0137): quy cách đúng dạng thì form
            đơn TỰ BÓC kích thước (carton lọt lòng, kính m²/tấm, xốp m³). */}
        <Field label="Quy cách" hint={s.groupCfg.specHint}>
          <input
            value={f.spec}
            onChange={set('spec')}
            maxLength={200}
            placeholder={s.groupCfg.specPlaceholder}
            className={inputClass}
          />
        </Field>
        {/* Cột "Vật liệu" của đơn phụ kiện/inox (0124) — trước chỉ chép từ lần
            đặt trước nên vật tư mới khai thì trống, phải gõ ở từng dòng đơn. */}
        <Field label="Vật liệu / màu" hint="Tự điền cột Vật liệu trên đơn đặt.">
          <input
            value={f.material_grade}
            onChange={set('material_grade')}
            maxLength={100}
            placeholder={s.groupCfg.gradePlaceholder}
            className={inputClass}
          />
        </Field>
        {/* KIM LOẠI: màu / bề mặt (0137) — cột "Màu / bề mặt" của đơn inox/sắt,
            trước chỉ nhớ từ lần đặt gần nhất. */}
        {s.groupCfg.showFinish && (
          <Field label="Màu / bề mặt" hint="Tự điền cột Màu / bề mặt trên đơn inox/sắt.">
            <input
              value={f.finish}
              onChange={set('finish')}
              maxLength={100}
              placeholder="inox bóng · xi trắng · sơn đen…"
              className={inputClass}
            />
          </Field>
        )}
        {/* BAO BÌ: cách mở + SP/thùng (0137) — cách mở quyết định công thức
            m²/thùng (AD/MR tự tính, ĐK nhập m² tay ở dòng đơn). */}
        {s.groupCfg.showCarton && (
          <>
            <Field
              label="Cách mở thùng"
              hint="AD/MR tự tính m² từ lọt lòng; ĐK nhập m² tay."
            >
              <select
                value={f.open_style}
                onChange={set('open_style')}
                className={inputClass}
              >
                <option value="">— chưa rõ —</option>
                <option value="AD">AD (âm dương)</option>
                <option value="MR">MR (một mảnh)</option>
                <option value="ĐK">ĐK (đối khẩu)</option>
              </select>
            </Field>
            <Field label="SP mỗi thùng (pcs/thùng)">
              <input
                value={f.pcs_per_ctn}
                onChange={set('pcs_per_ctn')}
                type="number"
                min={0}
                step="1"
                placeholder="vd 1"
                className={`${inputClass} tabular-nums`}
              />
            </Field>
          </>
        )}
      </FormSection>

      <FormSection title="Phân loại" hint="để lọc/tìm theo nhóm và chặn khai trùng tên">
        {/*
          NHÓM LÀ DANH SÁCH CHỐT, không gõ tự do: nhóm quyết định phạm vi so
          trùng tên khi server chặn tạo trùng — gõ sai nhóm là chặn hụt. Nhóm
          PHỤ thì ngược lại (106 giá trị, còn đẻ thêm) nên gợi ý mà vẫn cho mới.
        */}
        <Field label="Nhóm" required={s.requireGroup}>
          <select
            value={f.group_name}
            onChange={(e) =>
              setF((v) => ({ ...v, group_name: e.target.value, sub_group: '' }))
            }
            className={inputClass}
          >
            <option value="">— chọn nhóm —</option>
            {s.tax.groups.map((g) => (
              <option key={g.name} value={g.name}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nhóm phụ">
          <SuggestInput
            value={f.sub_group}
            onChange={(v) => setF((x) => ({ ...x, sub_group: v }))}
            options={s.subs}
            listId={subListId}
            maxLength={100}
            disabled={!f.group_name}
            placeholder={f.group_name ? 'chọn hoặc gõ mới…' : 'chọn nhóm chính trước'}
            className={`${inputClass} disabled:opacity-50`}
          />
        </Field>

        {/*
          ĐÓNG GÓI KHI MUA (0124) — NCC bán theo bao/bì/bó chứ không bán lẻ.
          Đơn thật (THP, LSX 01): cần 13.596 con nút bịt, mua theo bì 500 con —
          nhân viên phải tự chia 27,2 rồi làm tròn 28 bì ngay trong Excel. Khai
          một lần ở đây thì ô SL đặt của mọi đơn sau tự quy đổi + gợi ý tròn bao.
        */}
        <Field label="Đóng gói khi mua" hint="Bỏ trống nếu mua lẻ theo ĐVT.">
          <input
            value={f.pack_unit}
            onChange={set('pack_unit')}
            maxLength={30}
            placeholder="bì / bó / thùng / bao…"
            className={inputClass}
          />
        </Field>
        <Field
          label={`1 ${f.pack_unit.trim() || 'bao gói'} = ? ${f.unit.trim() || 'ĐVT'}`}
          hint="vd 1 bì = 500 con — form đặt sẽ gợi ý SL tròn bao."
        >
          <input
            value={f.pack_size}
            onChange={set('pack_size')}
            type="number"
            min={0}
            step="0.01"
            disabled={!f.pack_unit.trim()}
            placeholder="vd 500"
            className={`${inputClass} tabular-nums disabled:opacity-50`}
          />
        </Field>

        {/*
          HÀNG TẤM / CUỘN: không hỏi barem theo mét, chỉ nói rõ cân ở đâu.
          Khối kg/m × dài cây là mô hình của hàng CÂY; đơn thật cân theo tấm
          ("Trọng lượng tấm (kg)"), nên ở đây đưa hai ô đó ra là mời gõ nhầm.
        */}
        {s.needsWeight && s.sheetLike && (
          <div className="grid gap-3 rounded-md bg-sky-50 p-3 sm:col-span-2 dark:bg-sky-950/30">
            <Field
              label={`Khối lượng mỗi ${f.unit.trim() || 'đơn vị đặt'} (kg)`}
              hint={
                <>
                  Không có barem theo mét với <b>hàng tấm / cuộn</b>, nên khai thẳng số
                  cân — đúng như cột &quot;Trọng lượng tấm (kg)&quot; trên đơn giấy. Khai
                  ở đây MỘT LẦN thì mọi đơn sau tự điền, không ai phải gõ lại.
                </>
              }
            >
              <input
                value={f.kg_per_unit}
                onChange={set('kg_per_unit')}
                type="number"
                min={0}
                step="0.0001"
                placeholder={`vd 23.94 (kg mỗi ${f.unit.trim() || 'đơn vị'})`}
                className={`${inputClass} tabular-nums`}
              />
            </Field>
            {!f.kg_per_unit.trim() && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                ⚠ Bỏ trống thì mỗi lần đặt phải gõ tay theo phiếu cân NCC — mà dòng đơn bị
                chặn gửi khi thiếu số này, nên rất dễ gõ đại cho qua.
              </p>
            )}
          </div>
        )}

        {s.needsBarWeight && (
          <div className="grid gap-3 rounded-md bg-sky-50 p-3 sm:col-span-2 sm:grid-cols-2 dark:bg-sky-950/30">
            <Field label="kg/m">
              <input
                value={f.kg_per_m}
                onChange={set('kg_per_m')}
                type="number"
                min={0}
                step="0.0001"
                placeholder={
                  s.derived?.kg ? `${s.derived.kg} (máy đọc được)` : 'vd 0.248'
                }
                className={`${inputClass} tabular-nums ${
                  s.kgMismatch ? 'border-red-400 dark:border-red-600' : ''
                }`}
              />
            </Field>
            <Field label="Dài cây mặc định (m)">
              <input
                value={f.default_bar_length_m}
                onChange={set('default_bar_length_m')}
                type="number"
                min={0}
                step="0.01"
                placeholder="vd 5.65"
                className={`${inputClass} tabular-nums`}
              />
            </Field>

            {/* Máy đọc được barem từ quy cách trong tên → đưa số ra, không bắt gõ. */}
            {s.derived?.kg != null && (
              <p className="flex flex-wrap items-center gap-2 text-xs sm:col-span-2">
                <span className="text-emerald-700 dark:text-emerald-400">
                  Máy đọc được <b className="tabular-nums">{s.derived.kg}</b> kg/m từ quy
                  cách trong tên.
                </span>
                {!f.kg_per_m.trim() && (
                  <button
                    type="button"
                    onClick={() =>
                      setF((v) => ({ ...v, kg_per_m: String(s.derived!.kg) }))
                    }
                    className="rounded border border-emerald-300 px-1.5 py-0.5 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400"
                  >
                    Dùng số này
                  </button>
                )}
              </p>
            )}
            {s.derived?.kg == null && s.derived?.reason && (
              <p className="text-xs text-zinc-500 sm:col-span-2">
                Máy không tính được barem ({s.derived.reason}) — nhập theo phiếu cân của
                NCC hoặc sổ tay.
              </p>
            )}
            {s.kgMismatch && s.derived?.kg != null && (
              <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 sm:col-span-2 dark:bg-red-950/40 dark:text-red-400">
                ⚠ Số đang nhập lệch {Math.round(s.kgOff * 100)}% so với {s.derived.kg}{' '}
                kg/m máy tính từ quy cách. Kiểm lại dấu chấm thập phân — sai chỗ này là
                sai thẳng số tiền trên đơn.
              </p>
            )}
            <p className="text-xs text-zinc-500 sm:col-span-2">
              {s.template === 'aluminium'
                ? 'Đơn nhôm tính tiền bằng (kg/m × dài cây × số cây) × giá/kg.'
                : 'Đơn inox/sắt tính tiền bằng (SL × kg/đơn-vị) × giá/kg; kg/đơn-vị = kg/m × dài cây.'}{' '}
              Bỏ trống mà máy đọc được thì lấy số máy.
            </p>
          </div>
        )}
      </FormSection>

      {pricingNote && (
        /*
        HAI Ô GHI CHÚ, KHÔNG PHẢI HAI Ô TÍNH TIỀN.

        Lời giải thích cũ hứa "dòng đặt sẽ có ô SL-tính-giá nhập tay". Không có.
        Truy lại cả đường: `po-materials.repo` KHÔNG select hai cột này, `PoMaterial`
        không mang chúng, `newLine()` không đọc chúng, và `deriveLine()` suy
        `price_basis`/`qty2` HOÀN TOÀN từ mẫu đơn (kg/m × dài cây, kg/đơn-vị,
        m²/thùng). Hai ô này chỉ hiện ở danh mục vật tư và bản xuất CSV.

        Lời hứa sai còn nguy hơn ô trống: người khai tin là đơn sẽ tính theo kg
        nên nhập GIÁ/KG vào ô Đơn giá của một dòng đang tính theo cái — tiền sai
        mà không có gì cảnh báo. Nói đúng việc của ô, và cảnh báo khi nó chỏi với
        mẫu đơn (thứ THẬT SỰ quyết định cách tính tiền).
      */
        <FormSection
          title="Cách NCC báo giá"
          hint="ghi chú tra cứu — không đổi cách tính tiền"
        >
          <Field
            label="Đơn vị tính giá"
            span
            hint="Ghi lại NCC chào giá theo đơn vị nào (vd đặt cây, chào giá theo kg). Chỉ hiện ở danh mục để tra cứu — cách tính tiền của đơn do MẪU ĐƠN chọn lúc soạn đơn quyết định."
          >
            <input
              value={f.price_unit}
              onChange={set('price_unit')}
              maxLength={30}
              placeholder="kg / m² / lít…"
              className={inputClass}
            />
          </Field>
          <Field
            label={`Hệ số quy đổi (1 ${f.unit || 'đơn vị'} ≈ ? ${f.price_unit || 'đv giá'})`}
            span
            hint="Số tra cứu khi đối chiếu báo giá NCC. Không tự điền vào đơn."
          >
            <input
              value={f.unit2_factor}
              onChange={set('unit2_factor')}
              type="number"
              min={0}
              step="0.0001"
              placeholder="vd 10.1 (kg/cây)"
              disabled={!s.dual}
              className={`${inputClass} tabular-nums disabled:opacity-50`}
            />
          </Field>
        </FormSection>
      )}
    </>
  )
}
