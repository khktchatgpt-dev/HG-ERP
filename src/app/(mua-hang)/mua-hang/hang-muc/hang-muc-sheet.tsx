'use client'

import { useState } from 'react'
import {
  Field,
  FieldGrid,
  NumInput,
  Sheet,
  SheetActions,
  TextArea,
  TextInput,
  ToneText,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import { fmtMoney } from '@/lib/po-line'

/** Hạng mục vừa tạo / sửa — đủ để ô "Cho việc" và trang hạng mục cập nhật tại chỗ. */
export type HangMucLuu = {
  id: string
  code: string
  name: string
  kind: string
  budget: number | null
  currency: string
  status: string
}

/** "300.000.000" → 300000000; "1,5" → 1,5. Trống → null. Sai → undefined. */
function docTien(v: string): number | null | undefined {
  const t = v.replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : undefined
}

/**
 * HỘP TẠO / SỬA HẠNG MỤC (0230) — mở ngay trên màn soạn đơn (ô "Cho việc" →
 * "+ Tạo hạng mục mới…") hoặc ở trang Hạng mục. Bốn ô: tên, loại (gợi ý),
 * dự toán (tuỳ chọn — chỉ để theo dõi), ghi chú. Người tạo là người phụ trách.
 */
export function HangMucSheet({
  ban,
  goiYLoai,
  onClose,
  onSaved,
}: {
  /** Có = sửa hạng mục này; không = tạo mới. */
  ban?: { id: string; name: string; kind: string; budget: number | null; note: string | null; currency: string } // prettier-ignore
  /** Gợi ý ô Loại (lib/po-muc-dich `goiYMucDich`). */
  goiYLoai: readonly string[]
  onClose: () => void
  onSaved: (p: HangMucLuu) => void
}) {
  const toast = useToast()
  const [f, setF] = useState({
    name: ban?.name ?? '',
    kind: ban?.kind ?? '',
    budget: ban?.budget != null ? fmtMoney(ban.budget, ban.currency) : '',
    note: ban?.note ?? '',
  })
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (v: string) => setF((s) => ({ ...s, [k]: v }))
  const budget = docTien(f.budget)
  const why =
    f.name.trim().length < 2
      ? 'chưa có tên hạng mục'
      : f.kind.trim().length < 2
        ? 'chưa có loại'
        : budget === undefined
          ? 'dự toán không đọc được — gõ số, vd. 150.000.000'
          : null

  async function save() {
    if (why) return
    setBusy(true)
    try {
      const body = { name: f.name.trim(), kind: f.kind.trim(), budget: budget ?? null, note: f.note.trim() || null } // prettier-ignore
      if (ban) {
        await api(`/api/dept/supply/projects/${ban.id}`, { method: 'PATCH', body })
        toast.success('Đã lưu hạng mục')
        onSaved({ id: ban.id, code: '', currency: ban.currency, status: 'open', ...body })
      } else {
        const r = await api<{ project: HangMucLuu }>('/api/dept/supply/projects', { method: 'POST', body }) // prettier-ignore
        toast.success(`Đã tạo ${r.project.code}`, r.project.name)
        onSaved(r.project)
      }
      onClose()
    } catch (e) {
      toast.error(ban ? 'Lưu không được' : 'Tạo không được', apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={ban ? 'Sửa hạng mục' : 'Hạng mục mới'}
      subtitle={ban ? undefined : 'Việc ngoài sản xuất gom nhiều đơn mua — vd. Xây dựng văn phòng, Dự trữ kho. Mã HM- cấp khi lưu.'} // prettier-ignore
      stakes="nhe"
      width={560}
      footer={
        <div className="flex w-full items-center gap-3">
          <span className="text-k-sm flex-1">
            {why && (
              <ToneText tone="stop" strong={false}>
                Chưa lưu được: {why}
              </ToneText>
            )}
          </span>
          <SheetActions
            stakes="nhe"
            busy={busy}
            disabled={!!why}
            onCancel={onClose}
            onConfirm={() => void save()}
            cancelLabel="Thôi"
            confirmLabel={ban ? 'Lưu' : 'Tạo và chọn'}
          />
        </div>
      }
    >
      <FieldGrid>
        <Field label="Tên việc *">
          <TextInput
            value={f.name}
            onCommit={set('name')}
            label="Tên hạng mục"
            placeholder="vd. Xây dựng văn phòng"
            autoFocus
          />
        </Field>
        <Field label="Loại *">
          <TextInput
            value={f.kind}
            onCommit={set('kind')}
            label="Loại hạng mục"
            placeholder="vd. Sửa chữa nhà xưởng"
          />
          {/* Gợi ý là CHIP bấm được, không phải <datalist>: đo 12/10 trên Chrome, Tab ở ô có
              datalist đang mở bị danh sách giữ lại — gõ tiếp là rơi vào nhầm ô Loại. */}
          <span className="mt-1 flex flex-wrap gap-1">
            {goiYLoai.slice(0, 8).map((x) => (
              <button
                key={x}
                type="button"
                tabIndex={-1}
                onClick={() => set('kind')(x)}
                className={`text-k-label rounded-sm border px-1.5 py-0.5 ${f.kind === x ? 'border-[var(--act)] bg-[var(--act-wash,#eef1fc)] text-[var(--act)]' : 'border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--act)]'}`}
              >
                {x}
              </button>
            ))}
          </span>
        </Field>
        <Field label="Dự toán (tuỳ chọn)">
          <NumInput
            value={f.budget}
            onCommit={(v) => {
              const n = docTien(v)
              set('budget')(n == null ? v : fmtMoney(n, ban?.currency ?? 'VND'))
            }}
            aria-label="Dự toán"
            align="left"
            placeholder="để trống = không theo dõi trần"
          />
        </Field>
      </FieldGrid>
      <div className="k-sec">Ghi chú</div>
      <TextArea
        value={f.note}
        onChange={set('note')}
        rows={2}
        placeholder="vd. Văn phòng 2 tầng cạnh xưởng A"
      />
    </Sheet>
  )
}
