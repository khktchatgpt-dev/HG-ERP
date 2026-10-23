'use client'

import { useMemo, useState } from 'react'
import {
  Combobox,
  Pick,
  SearchInput,
  Sheet,
  SheetActions,
  TextArea,
  Tick,
} from '@/components/kit'
import { todayVn } from '@/lib/date-vn'
import { normalizeSearch } from '@/lib/search-text'
import { Blocked, FormRow, useMutate } from './shared'

export type ToolLite = {
  id: string
  code: string
  name: string
  holder_name?: string | null
  holder_id?: string | null
}

/** Danh sách tick chọn dụng cụ, có ô lọc. */
function ToolPicker({
  list,
  picked,
  onChange,
}: {
  list: ToolLite[]
  picked: Set<string>
  onChange: (s: Set<string>) => void
}) {
  const [q, setQ] = useState('')
  const shown = useMemo(() => {
    const t = normalizeSearch(q).split(/\s+/).filter(Boolean)
    return list.filter((x) =>
      t.every((w) =>
        normalizeSearch(`${x.code} ${x.name} ${x.holder_name ?? ''}`).includes(w),
      ),
    )
  }, [list, q])
  return (
    <div className="grid gap-1">
      <SearchInput
        value={q}
        onChange={setQ}
        placeholder="Lọc theo mã, tên, người giữ…"
        width={300}
        label="Lọc dụng cụ"
      />
      <div className="max-h-[260px] overflow-auto border border-[var(--line)]">
        {shown.length === 0 && (
          <p className="text-k-sm p-3 text-[var(--ink-3)]">Không có dụng cụ phù hợp.</p>
        )}
        {shown.map((x) => (
          <div
            key={x.id}
            className="text-k-body flex items-center gap-2 border-b border-[var(--hair)] px-2 py-1 last:border-b-0"
          >
            <Tick
              label={`Chọn ${x.code}`}
              checked={picked.has(x.id)}
              onChange={(on) => {
                const n = new Set(picked)
                if (on) n.add(x.id)
                else n.delete(x.id)
                onChange(n)
              }}
            />
            <span className="text-k-sm font-mono">{x.code}</span>
            <span className="min-w-0 flex-1 truncate">{x.name}</span>
            {x.holder_name && (
              <span className="text-k-sm text-[var(--ink-3)]">{x.holder_name}</span>
            )}
          </div>
        ))}
      </div>
      <span className="text-k-sm text-[var(--ink-3)]">Đã chọn {picked.size}</span>
    </div>
  )
}

export function GiveSheet({
  store,
  employees,
  employeeId,
  preselect,
  onClose,
}: {
  store: ToolLite[]
  employees: { id: string; name: string; code: string; team: string | null }[]
  employeeId?: string
  preselect?: string[]
  onClose: () => void
}) {
  const m = useMutate()
  const [emp, setEmp] = useState(employeeId ?? '')
  const [picked, setPicked] = useState(new Set(preselect ?? []))
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const opts = useMemo(
    () =>
      employees.map((e) => ({
        value: e.id,
        label: `${e.name} · ${e.code}${e.team ? ` · ${e.team}` : ''}`,
      })),
    [employees],
  )
  async function send() {
    if (!emp) return setErr('chọn nhân viên nhận.')
    if (picked.size === 0) return setErr('chọn ít nhất một dụng cụ trong kho.')
    setErr(null)
    const r = await m.run(
      () =>
        m.api<{ count: number; employee: string }>('/api/may-moc/tools/give', {
          method: 'POST',
          body: {
            employee_id: emp,
            asset_ids: [...picked],
            moved_on: todayVn(),
            note: note.trim() || null,
          },
        }),
      (x) => `Đã giao ${x.count} dụng cụ cho ${x.employee}`,
    )
    if (r.ok) onClose()
    else setErr(r.error)
  }
  return (
    <Sheet
      open
      onClose={onClose}
      width={620}
      title="Giao dụng cụ"
      subtitle="Giao dụng cụ trong kho cho nhân viên — ghi nhận ai đang giữ gì."
      footer={
        <SheetActions
          onCancel={onClose}
          onConfirm={() => void send()}
          busy={m.busy}
          confirmLabel="Xác nhận giao"
        />
      }
    >
      <div className="grid gap-3" onInput={() => setErr(null)}>
        <FormRow label="Giao cho">
          <Combobox
            label="Nhân viên nhận"
            options={opts}
            value={emp}
            onChange={(v) => {
              setEmp(v)
              setErr(null)
            }}
            emptyLabel="— Chọn nhân viên —"
          />
        </FormRow>
        {store.length === 0 ? (
          <Blocked>
            kho không còn dụng cụ nào để giao — thêm dụng cụ hoặc thu hồi trước.
          </Blocked>
        ) : (
          <ToolPicker
            list={store}
            picked={picked}
            onChange={(v) => {
              setPicked(v)
              setErr(null)
            }}
          />
        )}
        <FormRow label="Ghi chú">
          <TextArea
            aria-label="Ghi chú giao"
            value={note}
            onChange={setNote}
            rows={2}
            placeholder="VD: công nhân mới Tổ Hàn"
          />
        </FormRow>
        {err && <Blocked>{err}</Blocked>}
      </div>
    </Sheet>
  )
}

export function RecallSheet({
  held,
  preselect,
  note: note0,
  onClose,
}: {
  held: ToolLite[]
  preselect?: string[]
  note?: string
  onClose: () => void
}) {
  const m = useMutate()
  const [picked, setPicked] = useState(new Set(preselect ?? []))
  const [cond, setCond] = useState<'tot' | 'hong'>('tot')
  const [note, setNote] = useState(note0 ?? '')
  const [err, setErr] = useState<string | null>(null)
  async function send() {
    if (picked.size === 0) return setErr('chọn dụng cụ thu hồi.')
    setErr(null)
    const r = await m.run(
      () =>
        m.api<{ count: number }>('/api/may-moc/tools/recall', {
          method: 'POST',
          body: {
            asset_ids: [...picked],
            condition: cond,
            moved_on: todayVn(),
            note: note.trim() || null,
          },
        }),
      (x) => `Đã thu hồi ${x.count} dụng cụ về kho`,
    )
    if (r.ok) onClose()
    else setErr(r.error)
  }
  return (
    <Sheet
      open
      onClose={onClose}
      width={620}
      title="Thu hồi dụng cụ"
      subtitle="Dụng cụ thu hồi nhập lại kho; mỗi người giữ một phiếu thu hồi."
      footer={
        <SheetActions
          onCancel={onClose}
          onConfirm={() => void send()}
          busy={m.busy}
          confirmLabel="Xác nhận thu hồi"
        />
      }
    >
      <div className="grid gap-3" onInput={() => setErr(null)}>
        <ToolPicker
          list={held}
          picked={picked}
          onChange={(v) => {
            setPicked(v)
            setErr(null)
          }}
        />
        <FormRow label="Tình trạng khi nhận lại">
          <Pick
            label="Tình trạng"
            value={cond}
            onChange={(v) => setCond(v as 'tot' | 'hong')}
            options={[
              { value: 'tot', label: 'Tốt, giao tiếp được' },
              { value: 'hong', label: 'Hỏng, cần sửa' },
            ]}
          />
        </FormRow>
        <FormRow label="Lý do">
          <TextArea aria-label="Lý do thu hồi" value={note} onChange={setNote} rows={2} />
        </FormRow>
        {err && <Blocked>{err}</Blocked>}
      </div>
    </Sheet>
  )
}
