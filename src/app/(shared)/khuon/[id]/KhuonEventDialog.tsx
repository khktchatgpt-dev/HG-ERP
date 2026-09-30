'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, ArrowRight, Info, NotebookPen } from 'lucide-react'
import { Button } from '@/components/shadcn/button'
import { Checkbox } from '@/components/shadcn/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog'
import { Input } from '@/components/shadcn/input'
import { Textarea } from '@/components/shadcn/textarea'
import { DateField } from '@/components/erp/DateField'
import { Spinner } from '@/components/erp/Spinner'
import { useToast } from '@/components/ui/Toast'
import { api } from '@/lib/api'
import { dieEventChanges, type DieChange } from '@/lib/die-event-effect'
import { localTodayIso } from '@/lib/local-date'
import { cn } from '@/lib/utils'
import type { DieEventType, DieRow } from '@/modules/dept/technical/dies.repo'
import type { DieRef } from '../_components/KhuonFormDialog'
import { errText } from '../_lib/err-text'
import { DIE_EVENT_LABEL, DIE_STATUS_LABEL, kgPerM } from '../_lib/labels'

/**
 * GHI NHẬT KÝ ĐỜI KHUÔN BẰNG TAY (artboard 21 · 21b, duyệt 29/09/2026).
 *
 * Cho việc hệ thống không tự thấy: NCC báo hư, gửi đi sửa / bỏ gân, rút khuôn
 * chuyển sang nhà khác. Trước bước này cả đời một cái khuôn nằm trong ô ghi chú
 * ("Báo khuôn hư 23/2/2022 ĐỨC TOÀN MỞ LẠI KHUÔN 12/5") — 128 khuôn như vậy.
 *
 * Hai luật user chốt:
 *  · Ghi việc CẬP NHẬT LUÔN hồ sơ (ô tick bật sẵn) — thứ sắp đổi bày ra trước
 *    bằng CHÍNH hàm máy chủ dùng (`dieEventChanges`), và chỉ ra MỘT dòng nhật ký.
 *  · Nhật ký chỉ thêm, không sửa / xoá — ghi sai thì ghi thêm dòng đính chính.
 *
 * Cùng hệ theme v3 với form Thêm/Sửa khuôn (xem `KhuonActions`).
 */

/** Thứ tự nút = thứ tự hay gặp: hư và sửa là việc Cung ứng báo nhiều nhất. */
const TYPES: DieEventType[] = [
  'broken',
  'modified',
  'transferred',
  'opened',
  'reopened',
  'replaced',
  'retired',
  'note',
]

/** Việc nào mà thiếu nội dung là dòng nhật ký không nói gì — khớp zod. */
const NEEDS_CONTENT: DieEventType[] = ['broken', 'note']

/** "0,275" (dấu phẩy kiểu VN) → "0.275" cho zod; tiền bỏ dấu chấm nghìn. */
const decimal = (v: string) => v.trim().replace(',', '.')
const money = (v: string) => v.replace(/[.\s,]/g, '')

function changeText(c: DieChange): [string, string, string] {
  if (c.field === 'status') {
    return ['Tình trạng', DIE_STATUS_LABEL[c.from], DIE_STATUS_LABEL[c.to]]
  }
  if (c.field === 'holder_name') return ['Nơi giữ', c.from ?? '(chưa ghi)', c.to]
  return ['kg/m', c.from == null ? '(chưa có)' : kgPerM(c.from), kgPerM(c.to)]
}

export function KhuonEventDialog({
  open,
  onOpenChange,
  die,
  existing,
  holderOptions,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  die: Pick<DieRow, 'id' | 'code' | 'status' | 'holder_name' | 'weight_per_m'>
  /** Danh mục rút gọn — ô "Mã thay thế" tra mã ra khuôn. */
  existing: DieRef[]
  /** Gợi ý "Sang" từ nơi giữ đã có — tránh đẻ ra "Viet Eco" cạnh "Việt Eco". */
  holderOptions: string[]
}) {
  const router = useRouter()
  const toast = useToast()
  const today = localTodayIso()
  const [type, setType] = useState<DieEventType | null>(null)
  const [date, setDate] = useState(today)
  const [content, setContent] = useState('')
  const [weightAfter, setWeightAfter] = useState('')
  const [cost, setCost] = useState('')
  const [toHolder, setToHolder] = useState('')
  const [replaceCode, setReplaceCode] = useState('')
  const [apply, setApply] = useState(true)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [busy, setBusy] = useState(false)
  const touch = (k: string) => setTouched((t) => ({ ...t, [k]: true }))

  const weightNum = weightAfter.trim() === '' ? null : Number(decimal(weightAfter))
  const holder = type === 'transferred' || type === 'opened' ? toHolder : ''
  const changes = useMemo(
    () =>
      type
        ? dieEventChanges(die, {
            event_type: type,
            to_holder: holder,
            weight_after:
              type === 'modified' && Number.isFinite(weightNum) ? weightNum : null,
          })
        : [],
    [type, die, holder, weightNum],
  )

  const replaceDie = useMemo(() => {
    const k = replaceCode.trim().toLowerCase()
    return k ? (existing.find((d) => d.code.trim().toLowerCase() === k) ?? null) : null
  }, [replaceCode, existing])

  // ── Vướng gì — mỗi ô một câu, đúng luật zod ở máy chủ ──────────────────
  const errs: Record<string, string> = {}
  if (!date) errs.date = 'Chưa nhập ngày xảy ra'
  else if (date > today) errs.date = 'Ngày chưa tới — nhật ký ghi chuyện đã xảy ra.'
  if (type && NEEDS_CONTENT.includes(type) && !content.trim()) {
    errs.content = 'Ghi nội dung: chuyện gì, ai báo.'
  }
  if (type === 'transferred' && !toHolder.trim())
    errs.toHolder = 'Chưa ghi chuyển sang đâu.'
  if (type === 'modified' && weightAfter.trim() && !Number.isFinite(weightNum)) {
    errs.weight = 'kg/m phải là số, ví dụ 0,275.'
  }
  if (type === 'replaced' && replaceCode.trim() && !replaceDie) {
    errs.replace = `Không có mã “${replaceCode.trim()}” trong danh mục — thêm khuôn đó trước.`
  }
  if (type === 'replaced' && replaceDie?.id === die.id) {
    errs.replace = 'Khuôn không thay được bằng chính nó.'
  }
  // Ngày tương lai / số sai là LỖI — đỏ ngay. Ô bắt buộc còn trống chỉ đỏ khi
  // người dùng đã đi qua nó, không thì hộp vừa mở đã đỏ lòm.
  const shows = (k: string) =>
    !!errs[k] && (touched[k] || k === 'date' || k === 'weight' || k === 'replace')
  const blockers = Object.keys(errs).length
  const why = !type
    ? 'Chọn việc đã xảy ra'
    : blockers > 0
      ? `Còn ${blockers} chỗ phải sửa`
      : null

  async function submit() {
    if (!type || blockers > 0) {
      setTouched({ content: true, toHolder: true })
      return
    }
    setBusy(true)
    try {
      await api(`/api/dept/technical/dies/${die.id}/events`, {
        method: 'POST',
        body: {
          event_type: type,
          event_date: date,
          content,
          weight_after: type === 'modified' ? decimal(weightAfter) : '',
          cost: type === 'modified' || type === 'opened' ? money(cost) : '',
          to_holder: holder,
          related_die_id: type === 'replaced' ? (replaceDie?.id ?? '') : '',
          apply,
        },
      })
      toast.success(
        apply && changes.length > 0
          ? 'Đã ghi nhật ký và cập nhật hồ sơ khuôn'
          : 'Đã ghi nhật ký',
      )
      onOpenChange(false)
      router.refresh()
    } catch (e) {
      toast.error(errText(e, 'Không ghi được nhật ký'))
    } finally {
      setBusy(false)
    }
  }

  const fieldErr = (k: string) =>
    shows(k) && (
      <span role="alert" className="text-destructive flex items-start gap-1.5 text-xs">
        <AlertTriangle className="mt-px size-3.5 shrink-0" aria-hidden />
        {errs[k]}
      </span>
    )

  return (
    <Dialog open={open} onOpenChange={(v) => (v || !busy) && onOpenChange(v)}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[600px]">
        <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto p-6 pb-4">
          <DialogHeader className="pr-6">
            <DialogTitle>Ghi nhật ký · {die.code}</DialogTitle>
            <DialogDescription>
              Cho việc hệ thống không tự thấy — NCC báo hư, gửi đi sửa, chuyển khuôn sang
              nhà khác. Ghi lùi ngày được.
            </DialogDescription>
          </DialogHeader>

          <fieldset disabled={busy} className="flex min-w-0 flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground text-xs">
                Việc gì đã xảy ra<span className="text-destructive"> *</span>
              </span>
              <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                {TYPES.map((t) => (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant={type === t ? 'default' : 'outline'}
                    aria-pressed={type === t}
                    className="w-full rounded-full"
                    onClick={() => setType(t)}
                  >
                    {DIE_EVENT_LABEL[t]}
                  </Button>
                ))}
              </div>
            </div>

            {type && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Ngày xảy ra" required>
                    <DateField
                      value={date}
                      onChange={setDate}
                      max={today}
                      aria-label="Ngày xảy ra"
                      className={cn(shows('date') && 'border-destructive')}
                    />
                    {fieldErr('date')}
                  </Field>
                  {(type === 'modified' || type === 'opened') && (
                    <Field
                      label={type === 'opened' ? 'Tiền mở khuôn (₫)' : 'Chi phí sửa (₫)'}
                    >
                      <Input
                        value={cost}
                        onChange={(e) => setCost(e.target.value)}
                        inputMode="numeric"
                        className="font-mono"
                      />
                    </Field>
                  )}

                  {type === 'modified' && (
                    <>
                      <Field label="kg/m trước" hint="lấy từ hồ sơ">
                        <Input
                          value={die.weight_per_m == null ? '' : kgPerM(die.weight_per_m)}
                          placeholder="(chưa có)"
                          readOnly
                          tabIndex={-1}
                          className="bg-muted text-muted-foreground font-mono"
                        />
                      </Field>
                      <Field label="kg/m sau">
                        <Input
                          value={weightAfter}
                          onChange={(e) => setWeightAfter(e.target.value)}
                          inputMode="decimal"
                          placeholder="0,275"
                          aria-invalid={shows('weight')}
                          className="font-mono"
                        />
                        {fieldErr('weight')}
                      </Field>
                    </>
                  )}

                  {type === 'transferred' && (
                    <>
                      <Field label="Từ" hint="nơi giữ hiện tại">
                        <Input
                          value={die.holder_name ?? ''}
                          placeholder="(chưa ghi)"
                          readOnly
                          tabIndex={-1}
                          className="bg-muted text-muted-foreground"
                        />
                      </Field>
                      <Field label="Sang" required>
                        <Input
                          value={toHolder}
                          onChange={(e) => setToHolder(e.target.value)}
                          onBlur={() => touch('toHolder')}
                          list="khuon-event-holders"
                          aria-invalid={shows('toHolder')}
                        />
                        {fieldErr('toHolder')}
                      </Field>
                    </>
                  )}

                  {type === 'opened' && (
                    <Field label="Nơi mở / nơi giữ">
                      <Input
                        value={toHolder}
                        onChange={(e) => setToHolder(e.target.value)}
                        list="khuon-event-holders"
                        placeholder={die.holder_name ?? 'Tiến Đạt'}
                      />
                    </Field>
                  )}

                  {type === 'replaced' && (
                    <Field label="Thay bằng mã">
                      <Input
                        value={replaceCode}
                        onChange={(e) => setReplaceCode(e.target.value)}
                        list="khuon-event-codes"
                        aria-invalid={shows('replace')}
                        placeholder="TD-B108"
                        className="font-mono"
                      />
                      {fieldErr('replace')}
                    </Field>
                  )}
                </div>

                <datalist id="khuon-event-holders">
                  {holderOptions.map((h) => (
                    <option key={h} value={h} />
                  ))}
                </datalist>
                {type === 'replaced' && (
                  <datalist id="khuon-event-codes">
                    {existing
                      .filter((d) => d.id !== die.id)
                      .map((d) => (
                        <option key={d.id} value={d.code}>
                          {d.name ?? ''}
                        </option>
                      ))}
                  </datalist>
                )}

                <Field label="Nội dung" required={NEEDS_CONTENT.includes(type)}>
                  <Textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onBlur={() => touch('content')}
                    rows={3}
                    aria-invalid={shows('content')}
                    placeholder={
                      type === 'broken'
                        ? 'NCC báo gì, hư chỗ nào, đang chờ gì'
                        : 'Chuyện gì, ai báo'
                    }
                  />
                  {fieldErr('content')}
                </Field>

                {changes.length > 0 && (
                  <div className="bg-muted flex flex-col gap-1.5 rounded-lg border px-3 py-2.5">
                    <span className="text-xs font-semibold">
                      Cập nhật hồ sơ khuôn theo việc này
                    </span>
                    <label className="flex cursor-pointer flex-col gap-1 text-sm">
                      {changes.map((c, i) => {
                        const [what, from, to] = changeText(c)
                        return (
                          <span key={c.field} className="flex items-center gap-2">
                            {i === 0 ? (
                              <Checkbox
                                checked={apply}
                                onCheckedChange={(v) => setApply(v === true)}
                              />
                            ) : (
                              <span className="size-4 shrink-0" />
                            )}
                            {what}: <span className="text-muted-foreground">{from}</span>
                            <ArrowRight className="size-3.5 shrink-0" aria-hidden />
                            <b>{to}</b>
                          </span>
                        )
                      })}
                    </label>
                    <span className="text-muted-foreground text-xs">
                      Bỏ tick nếu chỉ ghi lại chuyện cũ đã qua — hồ sơ giữ nguyên. Tick
                      hay không cũng chỉ ra MỘT dòng nhật ký.
                    </span>
                  </div>
                )}
              </>
            )}
          </fieldset>
        </div>

        <DialogFooter className="items-center border-t px-6 py-3">
          {why ? (
            <span
              className={cn(
                'flex items-center gap-1.5 text-xs sm:mr-auto',
                type ? 'text-destructive' : 'text-muted-foreground',
              )}
            >
              {type && <AlertTriangle className="size-3.5 shrink-0" aria-hidden />}
              {why}
            </span>
          ) : (
            <span className="text-muted-foreground hidden items-center gap-1.5 text-xs sm:mr-auto sm:flex">
              <Info className="size-3.5 shrink-0" aria-hidden />
              Nhật ký chỉ thêm, không sửa / xoá — ghi sai thì ghi thêm dòng đính chính
            </span>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Huỷ
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !!why}>
            {busy ? <Spinner size={14} /> : <NotebookPen />}
            Ghi nhật ký
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string
  hint?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">
        {label}
        {required && <span className="text-destructive"> *</span>}
        {hint && <span className="opacity-80"> · {hint}</span>}
      </span>
      {children}
    </label>
  )
}
