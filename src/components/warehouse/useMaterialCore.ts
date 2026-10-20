import { useEffect, useMemo, useState } from 'react'
import { api } from '@/lib/api'
import { namesAlike } from '@/lib/material-key'
import { groupFieldConfig } from '@/lib/material-group-fields'
import {
  kgUnitVsBar,
  packPreview,
  specFromName,
  specPreview,
  unitWarning,
  baremGate,
} from '@/lib/material-form-guards'
import { isSheetLike, kgPerM, rhoFor } from '@/lib/metal-weight'
import { guessTemplate } from '@/lib/po-template-guess'
import { type PoTemplate } from '@/lib/po-template'
import type { MaterialTaxonomy } from '@/modules/dept/warehouse/taxonomy.service'


/**
 * LOGIC KHAI VẬT TƯ — tách khỏi `MaterialCoreFields.tsx` (29/09/2026) để màn
 * dựng bằng kit mới (`/mua-hang/vat-tu`, panel Sửa vật tư) dùng CHUNG đúng một bộ
 * luật với form hệ cũ: đọc kg/m từ tên, cổng barem, ĐVT lạ, dò trùng tên, và
 * `corePayload()` ghi null ô ngoài nhóm. Hai giao diện, một bộ não.
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
  const [fetched, setFetched] = useState<MaterialTaxonomy>({
    units: [],
    groups: [],
    packUnits: [],
  })
  const tax = taxonomy ?? fetched
  const [similar, setSimilar] = useState<{ code: string; name: string }[]>([])

  const groupTax = useMemo(
    () => tax.groups.find((g) => g.name === f.group_name),
    [tax, f.group_name],
  )
  const subs = groupTax?.subs ?? []
  /* Nhãn ĐÃ DÙNG trong nhóm — nguồn cho ô chọn Vật liệu/màu và Màu/bề mặt.
   * Chưa chọn nhóm thì gộp mọi nhóm: vẫn gợi ý được thay vì câm. */
  const allOf = (pick: (g: MaterialTaxonomy['groups'][number]) => string[]) =>
    [...new Set(tax.groups.flatMap(pick))].sort((a, b) => a.localeCompare(b, 'vi'))
  const grades = groupTax ? groupTax.grades : allOf((g) => g.grades)
  const finishes = groupTax ? groupTax.finishes : allOf((g) => g.finishes)

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
    if (!g.reason.startsWith('không suy được')) return g
    // Tên không nói lên gì → mẫu MẶC ĐỊNH CỦA NHÓM (0183) trước, rồi mới tới
    // mẫu của đơn đang soạn: nhóm là thứ người khai vừa chọn có chủ đích.
    if (groupTax?.po_template)
      return {
        template: groupTax.po_template,
        reason: `mặc định của nhóm ${f.group_name}`,
      }
    return templateHint ? { template: templateHint, reason: 'theo mẫu đơn đang soạn' } : g
  }, [f.name, f.sub_group, f.group_name, derived, templateHint, groupTax])

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

  /*
   * GUARD Ô NHẬP TAY NGUY HIỂM (13/08/2026 — src/lib/material-form-guards.ts):
   * máy tính song song và HIỆN điều máy hiểu, không khoá gõ tự do.
   */
  // ĐVT: sửa bản đã lưu mà GIỮ NGUYÊN ĐVT cũ thì không nạt lại — nhãn đó đang
  // sống trong DB; chỉ soi khi người dùng ĐỔI.
  const initialUnit = (initial?.unit ?? '').trim().toLowerCase()
  const unitWarn = useMemo(() => {
    if (f.unit.trim().toLowerCase() === initialUnit && initialUnit !== '') return null
    return unitWarning(f.unit, tax.units)
  }, [f.unit, tax.units, initialUnit])
  // Xác nhận GẮN VỚI đúng nhãn lúc bấm — đổi ô là xác nhận cũ hết giá trị
  // (cùng lối tick trùng-tên của QuickAdd).
  const [unitOkFor, setUnitOkFor] = useState('')
  const unitConfirmed = unitOkFor === f.unit

  /*
   * CỔNG BAREM TIỀN (02/09): kgMismatch/kgUnitOff trước đây chỉ tô đỏ — gõ 2.48
   * thay vì 0.248 vẫn lưu trót lọt, rồi mọi đơn nhôm sau điền sẵn kg/m sai 10
   * lần. Nay lệch quá ngưỡng phải bấm xác nhận (cùng cơ chế ĐVT lạ); xác nhận
   * gắn với đúng bộ số lúc bấm, đổi ô nào cũng hết giá trị.
   */
  const barem = baremGate({
    kg_per_m: f.kg_per_m,
    kg_per_unit: f.kg_per_unit,
    default_bar_length_m: f.default_bar_length_m,
    derivedKg: derived?.kg ?? null,
  })
  const [baremOkFor, setBaremOkFor] = useState('')
  const baremConfirmed = baremOkFor === barem.key
  const specPrev = useMemo(
    () => specPreview(f.group_name, f.spec, f.open_style),
    [f.group_name, f.spec, f.open_style],
  )
  const specSuggest = useMemo(
    () => (f.spec.trim() ? null : specFromName(f.name)),
    [f.spec, f.name],
  )
  const packPrev = useMemo(
    () => packPreview(f.pack_unit, f.pack_size, f.unit),
    [f.pack_unit, f.pack_size, f.unit],
  )
  const kgUnitOff = kgUnitVsBar(f.kg_per_unit, f.kg_per_m, f.default_bar_length_m)

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
    unitWarn,
    unitConfirmed,
    confirmUnit: () => setUnitOkFor(f.unit),
    grades,
    finishes,
    packUnits: tax.packUnits,
    baremBlocked: barem.blocked,
    baremConfirmed,
    confirmBarem: () => setBaremOkFor(barem.key),
    specPrev,
    specSuggest,
    packPrev,
    kgUnitOff,
    invalid:
      !f.name.trim() ||
      !f.unit.trim() ||
      (requireGroup && !f.group_name.trim()) ||
      // ĐVT lạ/nghi gõ nhầm phải xác nhận rồi mới lưu — sai đơn vị là mọi đơn
      // sau đặt sai, không phải lỗi sửa được bằng mắt thường trên phiếu.
      (unitWarn != null && !unitConfirmed) ||
      // Barem tiền lệch quá ngưỡng cũng vậy — đây là số nhân thẳng vào tiền.
      (barem.blocked && !baremConfirmed),
    corePayload,
  }
}
