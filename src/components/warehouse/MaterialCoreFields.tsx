'use client'

import { useState } from 'react'
export {
  EMPTY_CORE,
  coreFromMaterial,
  useMaterialCore,
  type MaterialCore,
  type MaterialCoreState,
} from './useMaterialCore'
import type { MaterialCore, MaterialCoreState } from './useMaterialCore'

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

/**
 * STYLE CHUẨN CỦA MỌI FORM VẬT TƯ (0137 — "chuẩn hóa form về 1 style"):
 * trước đây ba chỗ khai (danh mục Kho/Cung ứng, khai nhanh trong đơn, sửa tại
 * dòng) mỗi nơi một bộ class — viền zinc focus amber ở Kho, viền input-token
 * focus ring ở đơn. Cùng một khối ô hỏi mà nhìn như ba app. Token shadcn/theme:
 * ô nhập + nút lấy từ đây, KHÔNG tự chế class ở từng form nữa.
 */
export const materialInputClass =
  'w-full rounded-lg border border-input bg-card px-3 py-2 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50'
/**
 * @deprecated Hai hằng này chép lại đúng `Button` (default) và
 * `Button variant="outline"` của kit, nên chúng trôi mỗi khi kit đổi. Dùng
 * `Button` từ `@/components/shadcn/button`.
 *
 * Chưa xoá được vì `MaterialsManager.tsx` còn gọi (4 chỗ) — file đó nằm trong
 * nợ baseline, dọn cùng đợt của nó rồi xoá hai hằng này.
 */
export const materialBtnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50'
export const materialBtnSecondary =
  'rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs hover:bg-muted'

// ── Mảnh dựng form dùng chung ────────────────────────────────────────────────

/** Nút "vẫn dùng số này" cho cảnh báo barem — chưa bấm thì chưa lưu được. */
function BaremConfirm({ s }: { s: MaterialCoreState }) {
  if (s.baremConfirmed) return <b> Đã xác nhận dùng số này.</b>
  return (
    <>
      {' '}
      Số cân thật của NCC đúng là vậy thì{' '}
      <button
        type="button"
        onClick={s.confirmBarem}
        className="rounded border border-red-300 px-1.5 py-0.5 hover:bg-red-100"
      >
        xác nhận dùng số này
      </button>{' '}
      — chưa xác nhận thì chưa lưu được.
    </>
  )
}

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
          className="absolute top-full right-0 left-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-md border border-zinc-200 bg-white py-1 text-sm shadow-md"
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
                i === hi ? 'bg-zinc-100' : 'hover:bg-zinc-100'
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
      <span className="font-medium text-zinc-700">
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
    <section className="rounded-lg border border-zinc-200 p-3">
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
   * CHỈ Ở DANH MỤC — nhưng từ 0182 hai ô này ĐI VÀO TIỀN với các mẫu không có
   * công thức riêng (sơn/hoá chất/phụ kiện/mro/simple): khai "giá theo Lít,
   * 1 Thùng = 17,5" thì dòng đơn tự điền cặp quy đổi và thành tiền = lít × giá.
   * Mẫu kim loại/bao bì vẫn theo công thức riêng, hai ô này với chúng chỉ là
   * ghi chú (477/489 giá trị cũ chỉ lặp lại điều mẫu đơn đã nói).
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
              <span className="block rounded-md bg-amber-50 px-2 py-1 text-amber-700">
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
          hint={
            s.unitWarn && !s.unitConfirmed ? (
              <span className="block rounded-md bg-amber-50 px-2 py-1 text-amber-700">
                {s.unitWarn.kind === 'suggest' ? (
                  <>
                    ⚠ &quot;{s.f.unit}&quot; không có trong danh mục — gần giống{' '}
                    <b>{s.unitWarn.suggest}</b>.{' '}
                    <button
                      type="button"
                      onClick={() =>
                        s.setF((x) => ({
                          ...x,
                          unit: (s.unitWarn as { suggest: string }).suggest,
                        }))
                      }
                      className="rounded border border-amber-300 px-1.5 py-0.5 hover:bg-amber-100"
                    >
                      Sửa thành {s.unitWarn.suggest}
                    </button>{' '}
                    <button
                      type="button"
                      onClick={s.confirmUnit}
                      className="rounded border border-amber-300 px-1.5 py-0.5 hover:bg-amber-100"
                    >
                      Vẫn dùng &quot;{s.f.unit}&quot;
                    </button>
                  </>
                ) : (
                  <>
                    ⚠ ĐVT &quot;{s.f.unit}&quot; không có trong danh mục nhãn chuẩn. Nhãn
                    lạ của xưởng là thật thì{' '}
                    <button
                      type="button"
                      onClick={s.confirmUnit}
                      className="rounded border border-amber-300 px-1.5 py-0.5 hover:bg-amber-100"
                    >
                      xác nhận dùng
                    </button>{' '}
                    — chưa xác nhận thì chưa lưu được.
                  </>
                )}
              </span>
            ) : (
              'Gợi ý từ danh mục chuẩn, vẫn gõ được nhãn lạ của xưởng.'
            )
          }
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
        {/* Placeholder + hint ĐỔI THEO NHÓM (0137); PREVIEW SỐNG (13/08/2026):
            nhóm nuôi tiền từ quy cách (bao bì/kính/xốp) hiện ngay điều máy hiểu
            — gõ sai dạng là thấy tại chỗ, không đợi tới lúc lên đơn mới lộ. */}
        <Field
          label="Quy cách"
          hint={
            s.specPrev ? (
              s.specPrev.ok ? (
                <span className="text-emerald-700">{s.specPrev.text}</span>
              ) : (
                <span className="block rounded-md bg-amber-50 px-2 py-1 text-amber-700">
                  ⚠ {s.specPrev.warn}
                </span>
              )
            ) : s.specSuggest ? (
              <span>
                Tên đang chứa quy cách —{' '}
                <button
                  type="button"
                  onClick={() => s.setF((x) => ({ ...x, spec: s.specSuggest! }))}
                  className="rounded border border-emerald-300 px-1.5 py-0.5 text-emerald-700 hover:bg-emerald-50"
                >
                  điền &quot;{s.specSuggest}&quot; từ tên
                </button>{' '}
                thay vì gõ lại.
              </span>
            ) : (
              s.groupCfg.specHint
            )
          }
        >
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
        <Field
          label="Vật liệu / màu"
          hint="Tự điền cột Vật liệu trên đơn đặt — chọn nhãn đã dùng trong nhóm, gõ mới nếu chưa có."
        >
          {/* CHỌN TRƯỚC, GÕ SAU (02/09): input trần thì "xi trắng"/"Xi trắng"/
              "xi trang" thành ba nhãn cho cùng một thứ trên đơn in. Nguồn chọn
              là nhãn đã dùng trong nhóm; vẫn gõ được vì màu là từ vựng mở. */}
          <SuggestInput
            value={f.material_grade}
            onChange={(v) => setF((x) => ({ ...x, material_grade: v }))}
            options={s.grades}
            listId={`${unitListId}-grade`}
            maxLength={100}
            placeholder={s.groupCfg.gradePlaceholder}
            className={inputClass}
          />
        </Field>
        {/* KIM LOẠI: màu / bề mặt (0137) — cột "Màu / bề mặt" của đơn inox/sắt,
            trước chỉ nhớ từ lần đặt gần nhất. */}
        {s.groupCfg.showFinish && (
          <Field
            label="Màu / bề mặt"
            hint="Tự điền cột Màu / bề mặt trên đơn inox/sắt — chọn nhãn đã dùng, gõ mới nếu chưa có."
          >
            <SuggestInput
              value={f.finish}
              onChange={(v) => setF((x) => ({ ...x, finish: v }))}
              options={s.finishes}
              listId={`${unitListId}-finish`}
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
          {/* Nhãn bao gói đã dùng toàn danh mục — "bì" và "bịch" là hai nhãn
              cho cùng một thứ nếu để gõ trần. */}
          <SuggestInput
            value={f.pack_unit}
            onChange={(v) => setF((x) => ({ ...x, pack_unit: v }))}
            options={s.packUnits}
            listId={`${unitListId}-pack`}
            maxLength={30}
            placeholder="bì / bó / thùng / bao…"
            className={inputClass}
          />
        </Field>
        <Field
          label={`1 ${f.pack_unit.trim() || 'bao gói'} = ? ${f.unit.trim() || 'ĐVT'}`}
          hint={
            // Quy đổi SỐNG kèm ví dụ (13/08): "1 bì = 50" gõ thiếu số 0 thì ví
            // dụ nhảy 10 lần — số vô lý lộ ngay lúc gõ, không đợi lên đơn.
            s.packPrev ? (
              s.packPrev.warn ? (
                <span className="block rounded-md bg-amber-50 px-2 py-1 text-amber-700">
                  ⚠ {s.packPrev.warn}
                </span>
              ) : (
                <span className="text-emerald-700">{s.packPrev.text}</span>
              )
            ) : (
              'vd 1 bì = 500 con — form đặt sẽ gợi ý SL tròn bao.'
            )
          }
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
          <div className="grid gap-3 rounded-md bg-sky-50 p-3 sm:col-span-2">
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
              <p className="text-xs text-amber-700">
                ⚠ Bỏ trống thì mỗi lần đặt phải gõ tay theo phiếu cân NCC — mà dòng đơn bị
                chặn gửi khi thiếu số này, nên rất dễ gõ đại cho qua.
              </p>
            )}
            {/* Đối chiếu kg/đơn-vị với kg/m × dài cây khi cả hai barem cùng có
                trong state (13/08) — cùng ngưỡng 5% với ô kg/m. */}
            {s.kgUnitOff != null && s.kgUnitOff > 0.05 && (
              <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700">
                ⚠ Số đang nhập lệch {Math.round(s.kgUnitOff * 100)}% so với kg/m × dài cây
                đã khai (
                {(Number(f.kg_per_m) * Number(f.default_bar_length_m)).toFixed(2)} kg).
                Kiểm lại dấu chấm thập phân — sai chỗ này là sai thẳng tiền đơn.
                <BaremConfirm s={s} />
              </p>
            )}
          </div>
        )}

        {s.needsBarWeight && (
          <div className="grid gap-3 rounded-md bg-sky-50 p-3 sm:col-span-2 sm:grid-cols-2">
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
                  s.kgMismatch ? 'border-red-400' : ''
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
                <span className="text-emerald-700">
                  Máy đọc được <b className="tabular-nums">{s.derived.kg}</b> kg/m từ quy
                  cách trong tên.
                </span>
                {!f.kg_per_m.trim() && (
                  <button
                    type="button"
                    onClick={() =>
                      setF((v) => ({ ...v, kg_per_m: String(s.derived!.kg) }))
                    }
                    className="rounded border border-emerald-300 px-1.5 py-0.5 text-emerald-700 hover:bg-emerald-50"
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
              <p className="rounded-md bg-red-50 px-2 py-1 text-xs text-red-700 sm:col-span-2">
                ⚠ Số đang nhập lệch {Math.round(s.kgOff * 100)}% so với {s.derived.kg}{' '}
                kg/m máy tính từ quy cách. Kiểm lại dấu chấm thập phân — sai chỗ này là
                sai thẳng số tiền trên đơn.
                <BaremConfirm s={s} />
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
