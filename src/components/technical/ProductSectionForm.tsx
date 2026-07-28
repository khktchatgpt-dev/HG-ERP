'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { Spinner } from '@/components/erp/Spinner'

/** Một ô nhập trong form sửa từng phần. */
export type FieldSpec = {
  name: string
  label: string
  kind?: 'text' | 'number' | 'textarea' | 'select' | 'checkbox' | 'date'
  /** Trường nằm trong jsonb con thay vì cột phẳng. */
  json?: 'packing' | 'tech_spec'
  options?: { value: string; label: string }[]
  /**
   * Giá trị đã dùng ở SP khác — đổ vào `datalist` để chọn lại thay vì gõ tay.
   * KHÔNG giới hạn: vẫn gõ được giá trị mới.
   */
  suggest?: string[]
  placeholder?: string
  maxLength?: number
  step?: string
  rows?: number
  mono?: boolean
  /** Cột NOT NULL (code/name/unit) — chặn xoá trắng ngay ở form. */
  required?: boolean
  wide?: boolean
}

export type SectionSpec = {
  key: string
  title: string
  hint?: string
  fields: FieldSpec[]
}

const cls =
  'w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900'

const numOrNull = (v: FormDataEntryValue | null) => {
  const s = String(v ?? '').trim()
  if (!s) return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/**
 * Sửa MỘT phần hồ sơ sản phẩm, NGAY TRONG thẻ của phần đó — không mở hộp thoại
 * đè lên trang: mỗi phần chỉ 4–11 ô, mà che cả màn hình thì mất luôn các thẻ
 * bên cạnh đang cần đối chiếu.
 *
 * PATCH chỉ gửi các trường của phần đang sửa (`productUpdateSchema` là partial).
 * Với `packing` / `tech_spec`: jsonb bị GHI ĐÈ trọn khối, nên phải trộn lên giá
 * trị hiện có chứ không gửi mỗi vài khoá — nếu không sẽ xoá mất phần còn lại.
 */
export function ProductSectionForm({
  productId,
  section,
  values,
  currentPacking,
  currentTechSpec,
  onClose,
}: {
  productId: string
  section: SectionSpec
  values: Record<string, string | number | boolean | null | undefined>
  currentPacking: Record<string, unknown>
  currentTechSpec: Record<string, unknown>
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const body: Record<string, unknown> = {}
    const packing = { ...currentPacking }
    const techSpec = { ...currentTechSpec }

    for (const f of section.fields) {
      const raw = fd.get(f.name)
      if (f.kind === 'checkbox') {
        body[f.name] = raw === 'on'
        continue
      }
      if (f.json) {
        const target = f.json === 'packing' ? packing : techSpec
        const v = f.kind === 'number' ? numOrNull(raw) : String(raw ?? '').trim() || null
        if (v === null) delete target[f.name]
        else target[f.name] = v
        continue
      }
      body[f.name] =
        f.kind === 'number' ? numOrNull(raw) : String(raw ?? '').trim() || null
    }
    if (section.fields.some((f) => f.json === 'packing')) body.packing = packing
    if (section.fields.some((f) => f.json === 'tech_spec')) body.tech_spec = techSpec

    setBusy(true)
    try {
      await api(`/api/dept/technical/products/${productId}`, { method: 'PATCH', body })
      router.refresh()
      toast.success('Đã lưu', section.title)
      onClose()
    } catch (err) {
      toast.error('Lưu thất bại', apiErrorText(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
      {section.fields.map((f) => {
        const v = values[f.name]
        if (f.kind === 'checkbox')
          return (
            <label key={f.name} className="flex items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" name={f.name} defaultChecked={!!v} />
              {f.label}
            </label>
          )
        return (
          <label
            key={f.name}
            className={`flex flex-col gap-1 text-sm ${f.wide ? 'sm:col-span-2' : ''}`}
          >
            <span>
              {f.label}
              {f.required && <span className="text-red-500"> *</span>}
            </span>
            {f.kind === 'textarea' ? (
              <textarea
                name={f.name}
                rows={f.rows ?? 2}
                maxLength={f.maxLength}
                defaultValue={(v as string) ?? ''}
                placeholder={f.placeholder}
                className={cls}
              />
            ) : f.kind === 'select' ? (
              <select name={f.name} defaultValue={(v as string) ?? ''} className={cls}>
                {(f.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <input
                  name={f.name}
                  // `date` cho ra đúng chuỗi YYYY-MM-DD mà cột `date` của
                  // Postgres và `bom_effective_date` trong schema chờ sẵn.
                  type={
                    f.kind === 'number' ? 'number' : f.kind === 'date' ? 'date' : 'text'
                  }
                  step={f.step}
                  min={f.kind === 'number' ? '0' : undefined}
                  maxLength={f.maxLength}
                  required={f.required}
                  list={f.suggest?.length ? `${section.key}-${f.name}` : undefined}
                  defaultValue={(v as string | number) ?? ''}
                  placeholder={f.placeholder}
                  className={f.mono ? `${cls} font-mono` : cls}
                />
                {!!f.suggest?.length && (
                  <datalist id={`${section.key}-${f.name}`}>
                    {f.suggest.map((s) => (
                      <option key={s} value={s} />
                    ))}
                  </datalist>
                )}
              </>
            )}
          </label>
        )
      })}

      <div className="mt-1 flex justify-end gap-2 sm:col-span-2">
        <button
          type="button"
          onClick={onClose}
          disabled={busy}
          className="rounded-md border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Huỷ
        </button>
        <button
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-sky-600 px-5 py-1.5 text-sm font-medium text-white shadow hover:bg-sky-700 disabled:opacity-50"
        >
          {busy && <Spinner size={14} />}
          {busy ? 'Đang lưu…' : 'Lưu'}
        </button>
      </div>
    </form>
  )
}
