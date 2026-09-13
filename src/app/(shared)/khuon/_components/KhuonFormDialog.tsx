'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/shadcn/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/shadcn/dialog'
import { Input } from '@/components/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/shadcn/select'
import { Textarea } from '@/components/shadcn/textarea'
import { Spinner } from '@/components/erp/Spinner'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import type { DieRow, DieSpec, DieStatus } from '@/modules/dept/technical/dies.repo'
import { DIE_STATUS_LABEL } from '../_lib/labels'

/**
 * FORM THÊM / SỬA HỒ SƠ KHUÔN.
 *
 * Một form dùng cho cả hai việc: thêm và sửa chỉ khác nhau ở chỗ có `die` hay
 * không. Tách thành hai form là hai nơi phải nhớ thêm ô mới mỗi lần danh mục nở
 * ra — và một trong hai sẽ bị quên.
 *
 * ⭐ NGƯỜI DÙNG KHÔNG PHẢI TỰ GHI NHẬT KÝ. Đổi tình trạng / nơi giữ / kg/m thì
 * service tự đẻ một dòng sự kiện (xem `dies.service`). Bắt vừa sửa ô vừa nhớ ghi
 * thêm một dòng lịch sử thì sau ba tuần không ai ghi nữa, và ta quay lại đúng
 * chỗ cũ: cả đời cái khuôn nằm trong ô ghi chú.
 *
 * Ô SỐ để trống ≠ 0. "Chưa cân kg/m" và "kg/m bằng 0" là hai chuyện khác nhau,
 * nên ô trống gửi lên chuỗi rỗng và zod ở biên đổi thành `null` — đừng "tiện
 * tay" `?? 0` ở đây.
 */

const STATUSES: DieStatus[] = [
  'active',
  'pending',
  'rarely_used',
  'broken',
  'replaced',
  'retired',
  'unknown',
]

type Draft = Record<string, string>

/** Giá trị hiện có → chuỗi cho ô nhập. `null` thành '' chứ không thành "null". */
const s = (v: string | number | null | undefined) => (v == null ? '' : String(v))

function toDraft(die?: (DieRow & DieSpec) | null): Draft {
  return {
    code: s(die?.code),
    name: s(die?.name),
    part_group: s(die?.part_group),
    profile_shape: s(die?.profile_shape),
    alloy: s(die?.alloy),
    weight_per_m: s(die?.weight_per_m),
    unit: s(die?.unit) || 'Bộ',
    die_price: s(die?.die_price),
    holder_name: s(die?.holder_name),
    status: die?.status ?? 'active',
    note: s(die?.note),
    section_a_mm: s(die?.section_a_mm),
    section_b_mm: s(die?.section_b_mm),
    wall_thickness_mm: s(die?.wall_thickness_mm),
    rib_count: s(die?.rib_count),
    bar_length_m: s(die?.bar_length_m),
    pcs_per_bundle: s(die?.pcs_per_bundle),
    weight_tolerance_pct: s(die?.weight_tolerance_pct),
    surface_finish: s(die?.surface_finish),
    marking: s(die?.marking),
  }
}

export function KhuonFormDialog({
  open,
  onOpenChange,
  die,
  /** Gợi ý nơi giữ đã có trong danh mục — đỡ gõ và đỡ đẻ ra "Tiến Đat". */
  holderOptions,
  groupOptions,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  die?: (DieRow & DieSpec) | null
  holderOptions: string[]
  groupOptions: string[]
}) {
  const router = useRouter()
  const toast = useToast()
  const editing = !!die
  const [draft, setDraft] = useState<Draft>(() => toDraft(die))
  const [busy, setBusy] = useState(false)

  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }))

  async function submit() {
    if (!draft.code.trim()) {
      toast.error('Chưa nhập mã khuôn')
      return
    }
    setBusy(true)
    try {
      if (editing) {
        await api(`/api/dept/technical/dies/${die.id}`, { method: 'PATCH', body: draft })
        toast.success('Đã lưu hồ sơ khuôn')
      } else {
        await api('/api/dept/technical/dies', { method: 'POST', body: draft })
        toast.success('Đã thêm khuôn vào danh mục')
      }
      onOpenChange(false)
      router.refresh()
    } catch (e) {
      toast.error(apiErrorText(e, 'Không lưu được'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-[720px]">
        <DialogHeader>
          <DialogTitle>
            {editing ? `Sửa khuôn ${die.code}` : 'Thêm khuôn nhôm'}
          </DialogTitle>
          <DialogDescription>
            Đổi tình trạng, nơi giữ hay kg/m thì hệ thống tự ghi một dòng vào nhật ký đời
            khuôn — không phải tự gõ thêm.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <Section title="Nhận diện">
            <Field label="Mã khuôn" required>
              <Input
                value={draft.code}
                onChange={(e) => set('code', e.target.value)}
                placeholder="TD-B108"
                className="font-mono"
              />
            </Field>
            <Field label="Tên chi tiết">
              <Input
                value={draft.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder="Chân bàn U 80x120"
              />
            </Field>
            <Field label="Nhóm chi tiết">
              <Input
                value={draft.part_group}
                onChange={(e) => set('part_group', e.target.value)}
                list="khuon-groups"
                placeholder="Chân, Diềm bàn, Tựa lưng…"
              />
              <datalist id="khuon-groups">
                {groupOptions.map((g) => (
                  <option key={g} value={g} />
                ))}
              </datalist>
            </Field>
            <Field label="Dạng profile">
              <Input
                value={draft.profile_shape}
                onChange={(e) => set('profile_shape', e.target.value)}
                placeholder="Hộp vuông, Oval, La…"
              />
            </Field>
            <Field label="Hợp kim">
              <Input
                value={draft.alloy}
                onChange={(e) => set('alloy', e.target.value)}
                placeholder="Nhôm 6063"
              />
            </Field>
            <Field label="ĐVT">
              <Input value={draft.unit} onChange={(e) => set('unit', e.target.value)} />
            </Field>
          </Section>

          <Section title="Tình trạng & nơi giữ">
            <Field label="Tình trạng">
              <Select value={draft.status} onValueChange={(v) => set('status', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {DIE_STATUS_LABEL[st]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Nơi giữ khuôn">
              <Input
                value={draft.holder_name}
                onChange={(e) => set('holder_name', e.target.value)}
                list="khuon-holders"
                placeholder="Tiến Đạt"
              />
              <datalist id="khuon-holders">
                {holderOptions.map((h) => (
                  <option key={h} value={h} />
                ))}
              </datalist>
            </Field>
            <Field label="Trọng lượng kg/m">
              <Input
                value={draft.weight_per_m}
                onChange={(e) => set('weight_per_m', e.target.value)}
                inputMode="decimal"
                placeholder="0.757"
                className="font-mono"
              />
            </Field>
            <Field label="Tiền mở khuôn (₫)">
              <Input
                value={draft.die_price}
                onChange={(e) => set('die_price', e.target.value)}
                inputMode="numeric"
                placeholder="12090000"
                className="font-mono"
              />
            </Field>
          </Section>

          {/*
            Khối này là lý do danh mục khuôn đáng làm với XƯỞNG, không chỉ với
            Kỹ thuật: đo 13/09/2026 trên 462 dòng định mức có ghi mã khuôn thì
            kg/m chỉ 1%, chiều dài cây 0%, số phôi/cây 0% — xưởng biết cắt dài
            bao nhiêu mà không chỗ nào đổi ra "mấy cây nhôm". Ba số thiếu đó đều
            là thuộc tính của KHUÔN. Xem §4 docs/quan-ly-khuon-ke-hoach.md.
          */}
          <Section
            title="Thông số cho sản xuất"
            hint="Để trống nếu chưa đo — trống không phải là 0."
          >
            <Field label="Tiết diện A (mm)">
              <Input
                value={draft.section_a_mm}
                onChange={(e) => set('section_a_mm', e.target.value)}
                inputMode="decimal"
                className="font-mono"
              />
            </Field>
            <Field label="Tiết diện B (mm)">
              <Input
                value={draft.section_b_mm}
                onChange={(e) => set('section_b_mm', e.target.value)}
                inputMode="decimal"
                className="font-mono"
              />
            </Field>
            <Field label="Độ dày thành (mm)">
              <Input
                value={draft.wall_thickness_mm}
                onChange={(e) => set('wall_thickness_mm', e.target.value)}
                inputMode="decimal"
                className="font-mono"
              />
            </Field>
            <Field label="Số gân">
              <Input
                value={draft.rib_count}
                onChange={(e) => set('rib_count', e.target.value)}
                inputMode="numeric"
                className="font-mono"
              />
            </Field>
            <Field label="Chiều dài cây (m)">
              <Input
                value={draft.bar_length_m}
                onChange={(e) => set('bar_length_m', e.target.value)}
                inputMode="decimal"
                placeholder="6"
                className="font-mono"
              />
            </Field>
            <Field label="Số cây / bó">
              <Input
                value={draft.pcs_per_bundle}
                onChange={(e) => set('pcs_per_bundle', e.target.value)}
                inputMode="numeric"
                className="font-mono"
              />
            </Field>
            <Field label="Dung sai trọng lượng (%)">
              <Input
                value={draft.weight_tolerance_pct}
                onChange={(e) => set('weight_tolerance_pct', e.target.value)}
                inputMode="decimal"
                placeholder="5"
                className="font-mono"
              />
            </Field>
            <Field label="Bề mặt">
              <Input
                value={draft.surface_finish}
                onChange={(e) => set('surface_finish', e.target.value)}
                placeholder="Mộc / anod / sơn"
              />
            </Field>
            <Field label="Dấu in trên cây">
              <Input
                value={draft.marking}
                onChange={(e) => set('marking', e.target.value)}
              />
            </Field>
          </Section>

          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground text-xs">Ghi chú</span>
            <Textarea
              value={draft.note}
              onChange={(e) => set('note', e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Huỷ
          </Button>
          <Button onClick={submit} disabled={busy}>
            {busy && <Spinner size={14} />}
            {editing ? 'Lưu thay đổi' : 'Thêm khuôn'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Section({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h3 className="text-xs font-semibold tracking-wide uppercase">{title}</h3>
        {hint && <span className="text-muted-foreground text-xs">{hint}</span>}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
    </div>
  )
}

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-xs">
        {label}
        {required && <span className="text-[var(--stop)]"> *</span>}
      </span>
      {children}
    </label>
  )
}
