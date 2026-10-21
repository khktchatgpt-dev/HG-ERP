'use client'

import { useMemo, useState } from 'react'
import {
  Combobox,
  DateInput,
  NumInput,
  Pick,
  Sheet,
  SheetActions,
  Tag,
  TextArea,
  TextInput,
  Tick,
} from '@/components/kit'
import { todayVn } from '@/lib/date-vn'
import { everyTxt, vnd, type PlanUnit } from '@/lib/may-moc'
import type { AssetFormOptions } from '@/modules/core/assets/assets.service'
import {
  Blocked,
  draftParts,
  emptyPart,
  FormRow,
  PartsEditor,
  readNum,
  useMutate,
  type PartDraft,
} from './shared'

export type EditableAsset = {
  id: string
  code: string
  name: string
  kind: 'machine' | 'tool'
  group_id: string
  model: string | null
  serial: string | null
  supplier: string | null
  department_id: string | null
  resp_employee_id: string | null
  use_date: string | null
  cost: number
  hours_per_day: number
  note: string | null
}

/** Thêm / sửa máy. Thêm thì tự cấp mã tem và tick sẵn lịch mẫu của nhóm. */
export function AssetFormSheet({
  options,
  asset,
  kind = 'machine',
  onClose,
  onCreated,
}: {
  options: AssetFormOptions
  asset?: EditableAsset
  kind?: 'machine' | 'tool'
  onClose: () => void
  onCreated?: (code: string) => void
}) {
  const m = useMutate()
  const editing = !!asset
  const groups = options.groups.filter((g) => g.kind === (asset?.kind ?? kind))
  const [f, setF] = useState({
    name: asset?.name ?? '',
    group_id: asset?.group_id ?? groups[0]?.id ?? '',
    model: asset?.model ?? '',
    serial: asset?.serial ?? '',
    supplier: asset?.supplier ?? '',
    department_id: asset?.department_id ?? '',
    resp_employee_id: asset?.resp_employee_id ?? '',
    use_date: asset?.use_date ?? todayVn(),
    cost: asset ? String(asset.cost || '') : '',
    hpd: asset ? String(asset.hours_per_day || '') : kind === 'machine' ? '8' : '',
    note: asset?.note ?? '',
  })
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) =>
    setF((x) => ({ ...x, [k]: v }))
  const g = groups.find((x) => x.id === f.group_id)
  const [keep, setKeep] = useState<Set<number> | null>(null)
  const kept = keep ?? new Set((g?.templates ?? []).map((_, i) => i))
  const [err, setErr] = useState<string | null>(null)
  const empOpts = useMemo(
    () =>
      options.employees.map((e) => ({
        value: e.id,
        label: `${e.name} · ${e.code}${e.team ? ` · ${e.team}` : ''}`,
      })),
    [options.employees],
  )
  const isMachine = (asset?.kind ?? kind) === 'machine'

  async function send() {
    if (f.name.trim().length < 2)
      return setErr(isMachine ? 'nhập tên máy.' : 'nhập tên dụng cụ.')
    if (!f.group_id) return setErr('chọn nhóm.')
    const cost = readNum(f.cost)
    const hpd = readNum(f.hpd)
    if (Number.isNaN(cost)) return setErr('giá mua phải là số.')
    if (Number.isNaN(hpd) || hpd > 24) return setErr('giờ chạy/ngày phải từ 0 tới 24.')
    setErr(null)
    const body = {
      name: f.name.trim(),
      model: f.model.trim() || null,
      serial: f.serial.trim() || null,
      supplier: f.supplier.trim() || null,
      department_id: f.department_id || null,
      resp_employee_id: isMachine ? f.resp_employee_id || null : null,
      use_date: f.use_date || null,
      cost,
      hours_per_day: isMachine ? hpd : 0,
      note: f.note.trim() || null,
    }
    const r = editing
      ? await m.run(
          () => m.api(`/api/may-moc/assets/${asset!.id}`, { method: 'PUT', body }),
          'Đã lưu thông tin máy',
        )
      : await m.run(
          () =>
            m.api<{ asset: { code: string } }>('/api/may-moc/assets', {
              method: 'POST',
              body: { ...body, group_id: f.group_id, template_idx: [...kept] },
            }),
          (x) => `Đã thêm ${x.asset.code} — in tem QR dán lên máy`,
        )
    if (!r.ok) return setErr(r.error)
    onClose()
    if (!editing && onCreated)
      onCreated((r.data as { asset: { code: string } }).asset.code)
  }

  return (
    <Sheet
      open
      onClose={onClose}
      width={720}
      title={editing ? `Sửa ${asset!.code}` : isMachine ? 'Thêm máy' : 'Thêm dụng cụ'}
      subtitle={
        editing ? asset!.name : 'Hệ thống tự cấp mã tem theo nhóm và gợi ý lịch bảo trì.'
      }
      footer={
        <SheetActions
          onCancel={onClose}
          onConfirm={() => void send()}
          busy={m.busy}
          confirmLabel={editing ? 'Lưu' : isMachine ? 'Thêm máy' : 'Thêm dụng cụ'}
        />
      }
    >
      <div className="grid gap-3" onInput={() => setErr(null)}>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label={isMachine ? 'Tên máy' : 'Tên dụng cụ'}>
            <TextInput
              label="Tên"
              value={f.name}
              onCommit={(v) => set('name', v)}
              placeholder={
                isMachine ? 'VD: Máy hàn MIG 350A' : 'VD: Máy mài cầm tay 100 mm'
              }
            />
          </FormRow>
          <FormRow
            label="Nhóm"
            hint={editing ? 'Nhóm nằm trong mã tem nên không đổi được.' : undefined}
          >
            <Pick
              label="Nhóm"
              value={f.group_id}
              disabled={editing}
              onChange={(v) => {
                set('group_id', v)
                setKeep(null)
              }}
              options={groups.map((x) => ({ value: x.id, label: `${x.id} · ${x.name}` }))}
            />
          </FormRow>
          <FormRow label="Model / hãng">
            <TextInput label="Model" value={f.model} onCommit={(v) => set('model', v)} />
          </FormRow>
          <FormRow label="Số serial">
            <TextInput
              label="Serial"
              mono
              value={f.serial}
              onCommit={(v) => set('serial', v)}
            />
          </FormRow>
          <FormRow label="Đặt tại (tổ)">
            <Pick
              label="Đặt tại"
              value={f.department_id}
              onChange={(v) => set('department_id', v)}
              options={[
                { value: '', label: '— Chưa gán —' },
                ...options.depts.map((d) => ({ value: d.id, label: d.name })),
              ]}
            />
          </FormRow>
          {isMachine && (
            <FormRow label="Người phụ trách">
              <Combobox
                label="Người phụ trách"
                options={empOpts}
                value={f.resp_employee_id}
                onChange={(v) => set('resp_employee_id', v)}
                emptyLabel="— Chưa giao —"
              />
            </FormRow>
          )}
          <FormRow label="Ngày đưa vào dùng">
            <DateInput
              label="Ngày đưa vào dùng"
              value={f.use_date}
              onChange={(v) => set('use_date', v)}
            />
          </FormRow>
          <FormRow label="Giá mua (đ, không bắt buộc)">
            <NumInput
              aria-label="Giá mua"
              value={f.cost}
              onCommit={(v) => set('cost', v)}
              align="left"
            />
          </FormRow>
          <FormRow label="Nhà cung cấp">
            <TextInput
              label="Nhà cung cấp"
              value={f.supplier}
              onCommit={(v) => set('supplier', v)}
            />
          </FormRow>
          {isMachine && (
            <FormRow
              label="Giờ chạy trung bình / ngày"
              hint="0 = máy không có đồng hồ giờ: lịch chỉ tính theo ngày, tháng."
            >
              <NumInput
                aria-label="Giờ chạy mỗi ngày"
                value={f.hpd}
                onCommit={(v) => set('hpd', v)}
                align="left"
              />
            </FormRow>
          )}
        </div>
        <FormRow label="Ghi chú">
          <TextArea
            aria-label="Ghi chú"
            value={f.note}
            onChange={(v) => set('note', v)}
            rows={2}
          />
        </FormRow>
        {!editing && isMachine && g && (
          <div className="grid gap-1">
            <span className="text-k-sm font-semibold text-[var(--ink-label)]">
              Lịch bảo trì gợi ý cho nhóm {g.name}
            </span>
            {g.templates.length === 0 && (
              <span className="text-k-sm text-[var(--ink-3)]">
                Nhóm này chưa có lịch mẫu — thêm hạng mục sau khi tạo máy.
              </span>
            )}
            {g.templates.map((t, i) => {
              const noHours = t.unit === 'h' && !readNum(f.hpd)
              return (
                <div key={i} className="text-k-body flex items-center gap-2">
                  <Tick
                    label={`Giữ hạng mục ${t.task}`}
                    checked={kept.has(i) && !noHours}
                    disabled={noHours}
                    onChange={(on) => {
                      const n = new Set(kept)
                      if (on) n.add(i)
                      else n.delete(i)
                      setKeep(n)
                    }}
                  />
                  <span>
                    {t.inspection && <Tag tone="warn">Kiểm định</Tag>} {t.task}{' '}
                    <span className="text-[var(--ink-3)]">
                      · mỗi {everyTxt(t.every, t.unit)}
                    </span>
                    {noHours && (
                      <span className="text-[var(--ink-3)]">
                        {' '}
                        · cần giờ chạy/ngày &gt; 0
                      </span>
                    )}
                  </span>
                </div>
              )
            })}
          </div>
        )}
        {err && <Blocked>{err}</Blocked>}
      </div>
    </Sheet>
  )
}

/** Cập nhật số đọc đồng hồ giờ chạy. */
export function HoursSheet({
  asset,
  onClose,
}: {
  asset: { id: string; code: string; name: string; hours: number }
  onClose: () => void
}) {
  const m = useMutate()
  const [h, setH] = useState(String(asset.hours))
  const [err, setErr] = useState<string | null>(null)
  async function send() {
    const v = readNum(h)
    if (Number.isNaN(v) || v < asset.hours)
      return setErr(`số giờ mới phải ≥ ${vnd(asset.hours)} (đồng hồ không lùi).`)
    setErr(null)
    const r = await m.run(
      () =>
        m.api(`/api/may-moc/assets/${asset.id}/hours`, {
          method: 'POST',
          body: { hours: v },
        }),
      'Đã cập nhật giờ chạy — lịch theo giờ đã tính lại',
    )
    if (r.ok) onClose()
    else setErr(r.error)
  }
  return (
    <Sheet
      open
      onClose={onClose}
      stakes="nhe"
      width={420}
      title="Cập nhật giờ chạy máy"
      subtitle={`${asset.code} · ${asset.name}`}
      footer={
        <SheetActions
          onCancel={onClose}
          onConfirm={() => void send()}
          busy={m.busy}
          confirmLabel="Lưu"
        />
      }
    >
      <div className="grid gap-3" onInput={() => setErr(null)}>
        <FormRow
          label="Số đọc trên đồng hồ giờ chạy"
          hint={`Hiện tại ${vnd(asset.hours)} giờ.`}
        >
          <NumInput aria-label="Số giờ chạy" value={h} onCommit={setH} align="left" />
        </FormRow>
        {err && <Blocked>{err}</Blocked>}
      </div>
    </Sheet>
  )
}

/** Thêm hạng mục bảo trì cho một máy. */
export function PlanFormSheet({
  asset,
  onClose,
}: {
  asset: { id: string; name: string; hours_per_day: number }
  onClose: () => void
}) {
  const m = useMutate()
  const [task, setTask] = useState('')
  const [every, setEvery] = useState('1')
  const [unit, setUnit] = useState<PlanUnit>('m')
  const [cost, setCost] = useState('')
  const [kd, setKd] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  async function send() {
    if (task.trim().length < 3) return setErr('nhập tên công việc.')
    const n = readNum(every)
    if (!Number.isInteger(n) || n < 1) return setErr('chu kỳ phải là số nguyên ≥ 1.')
    setErr(null)
    const r = await m.run(
      () =>
        m.api(`/api/may-moc/assets/${asset.id}/plans`, {
          method: 'POST',
          body: {
            task: task.trim(),
            every_n: n,
            unit,
            cost: readNum(cost) || 0,
            is_inspection: kd,
          },
        }),
      'Đã thêm hạng mục bảo trì',
    )
    if (r.ok) onClose()
    else setErr(r.error)
  }
  return (
    <Sheet
      open
      onClose={onClose}
      stakes="nhe"
      width={520}
      title="Thêm hạng mục bảo trì"
      subtitle={asset.name}
      footer={
        <SheetActions
          onCancel={onClose}
          onConfirm={() => void send()}
          busy={m.busy}
          confirmLabel="Thêm"
        />
      }
    >
      <div className="grid gap-3" onInput={() => setErr(null)}>
        <FormRow label="Công việc">
          <TextInput
            label="Công việc"
            value={task}
            onCommit={setTask}
            placeholder="VD: Thay dầu hộp số"
          />
        </FormRow>
        <div className="grid grid-cols-3 gap-3">
          <FormRow label="Chu kỳ">
            <NumInput
              aria-label="Chu kỳ"
              value={every}
              onCommit={setEvery}
              align="left"
            />
          </FormRow>
          <FormRow label="Đơn vị">
            <Pick
              label="Đơn vị chu kỳ"
              value={unit}
              onChange={(v) => setUnit(v as PlanUnit)}
              options={[
                { value: 'm', label: 'Tháng' },
                { value: 'd', label: 'Ngày' },
                ...(asset.hours_per_day ? [{ value: 'h', label: 'Giờ chạy máy' }] : []),
              ]}
            />
          </FormRow>
          <FormRow label="Chi phí dự kiến (đ)">
            <NumInput
              aria-label="Chi phí dự kiến"
              value={cost}
              onCommit={setCost}
              align="left"
            />
          </FormRow>
        </div>
        <div className="text-k-body flex items-center gap-2">
          <Tick label="Là kiểm định, đăng kiểm bắt buộc" checked={kd} onChange={setKd} />{' '}
          Là kiểm định, đăng kiểm bắt buộc (nhắc trước 30 ngày)
        </div>
        {err && <Blocked>{err}</Blocked>}
      </div>
    </Sheet>
  )
}

export type PlanForDone = {
  id: string
  task: string
  is_inspection: boolean
  cost: number
  asset: { id: string; code: string; name: string; hours: number; hours_per_day: number }
}

/** "Đã làm" một hạng mục: ghi phiếu PBD / PKD, lịch dời sang kỳ sau. */
export function PlanDoneSheet({
  plan,
  techs,
  onClose,
}: {
  plan: PlanForDone
  techs: { id: string; name: string }[]
  onClose: () => void
}) {
  const m = useMutate()
  const kd = plan.is_inspection
  const [date, setDate] = useState(todayVn())
  const [tech, setTech] = useState(kd ? '' : (techs[0]?.id ?? ''))
  const [vendor, setVendor] = useState(kd ? 'Trung tâm kiểm định an toàn' : '')
  const [hours, setHours] = useState(
    plan.asset.hours_per_day ? String(plan.asset.hours) : '',
  )
  const [parts, setParts] = useState<PartDraft[]>([emptyPart()])
  const [labor, setLabor] = useState(kd ? String(plan.cost || '') : '')
  const [down, setDown] = useState(kd ? '0' : '1')
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const total =
    (kd ? 0 : draftParts(parts).reduce((s, p) => s + Math.round(p.qty * p.price), 0)) +
    (readNum(labor) || 0)
  async function send() {
    if (!date) return setErr('chọn ngày làm.')
    if (date > todayVn()) return setErr('ngày làm không được sau hôm nay.')
    if (!tech && !vendor.trim())
      return setErr('chọn người làm hoặc ghi đơn vị thực hiện.')
    const h = hours ? readNum(hours) : null
    if (h != null && (Number.isNaN(h) || h < plan.asset.hours))
      return setErr(`giờ chạy phải ≥ ${vnd(plan.asset.hours)} (số hiện tại).`)
    setErr(null)
    const r = await m.run(
      () =>
        m.api<{ work_order: { no: string } }>(`/api/may-moc/plans/${plan.id}/done`, {
          method: 'POST',
          body: {
            done_on: date,
            tech_employee_id: tech || null,
            vendor: tech ? null : vendor.trim(),
            hours: h,
            parts: draftParts(parts),
            labor: readNum(labor) || 0,
            downtime_hours: readNum(down) || 0,
            note: note.trim() || null,
          },
        }),
      (x) => `Đã ghi ${x.work_order.no} — lịch dời sang kỳ sau`,
    )
    if (r.ok) onClose()
    else setErr(r.error)
  }
  return (
    <Sheet
      open
      onClose={onClose}
      width={680}
      title={kd ? 'Ghi nhận đã kiểm định' : 'Ghi nhận đã bảo trì'}
      subtitle={`${plan.asset.code} · ${plan.asset.name} · ${plan.task}`}
      footer={
        <SheetActions
          onCancel={onClose}
          onConfirm={() => void send()}
          busy={m.busy}
          confirmLabel="Lưu"
        />
      }
    >
      <div className="grid gap-3" onInput={() => setErr(null)}>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Ngày làm">
            <DateInput label="Ngày làm" value={date} onChange={setDate} max={todayVn()} />
          </FormRow>
          <FormRow label="Người làm">
            <Pick
              label="Người làm"
              value={tech}
              onChange={(v) => {
                setTech(v)
                setErr(null)
              }}
              options={[
                ...techs.map((t) => ({ value: t.id, label: t.name })),
                { value: '', label: 'Thuê ngoài' },
              ]}
            />
          </FormRow>
          {!tech && (
            <FormRow label="Đơn vị thực hiện">
              <TextInput label="Đơn vị thực hiện" value={vendor} onCommit={setVendor} />
            </FormRow>
          )}
          {plan.asset.hours_per_day > 0 && (
            <FormRow label="Giờ chạy trên đồng hồ máy">
              <NumInput
                aria-label="Giờ chạy trên đồng hồ"
                value={hours}
                onCommit={setHours}
                align="left"
              />
            </FormRow>
          )}
        </div>
        {!kd && <PartsEditor rows={parts} onChange={setParts} />}
        <div className="grid grid-cols-2 gap-3">
          <FormRow label={kd ? 'Phí kiểm định (đ)' : 'Chi phí khác (đ)'}>
            <NumInput
              aria-label="Chi phí khác"
              value={labor}
              onCommit={setLabor}
              align="left"
            />
          </FormRow>
          <FormRow label="Máy dừng bao nhiêu giờ">
            <NumInput
              aria-label="Giờ dừng máy"
              value={down}
              onCommit={setDown}
              align="left"
            />
          </FormRow>
        </div>
        <FormRow label="Ghi chú, tình trạng phát hiện">
          <TextArea
            aria-label="Ghi chú"
            value={note}
            onChange={setNote}
            rows={2}
            placeholder="VD: ray hơi mòn, theo dõi thêm"
          />
        </FormRow>
        <p className="text-k-sm">
          Phiếu {kd ? 'kiểm định' : 'bảo dưỡng'} sẽ ghi{' '}
          <b className="font-mono">{vnd(total)} đ</b> vào chi phí tháng này, lịch dời sang
          kỳ sau.
        </p>
        {err && <Blocked>{err}</Blocked>}
      </div>
    </Sheet>
  )
}
