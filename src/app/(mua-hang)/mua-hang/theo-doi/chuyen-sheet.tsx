'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  DateInput,
  NumInput,
  Pick,
  ScopeSwitch,
  SearchInput,
  Sheet,
  SheetActions,
  TextArea,
  useToast,
} from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import {
  PACKAGE_UNITS,
  TRIP_MODE_LABEL,
  TRIP_MODES,
  tripProblem,
  type TripMode,
} from '@/lib/chuyen-hang'
import { searchMatcher } from '@/lib/search-text'

/**
 * HỘP "GHI CHUYẾN HÀNG" (0216, bản vẽ C3 — chủ dự án duyệt 01/10/2026).
 *
 * Ghi khi hàng đã RỜI NCC: NCC gửi ảnh biên nhận chành qua Zalo, hoặc HG thuê
 * xe đi lấy. Một chuyến gom được đơn của nhiều NCC. KHÔNG CÓ TIỀN — phí vận
 * chuyển ghi riêng để thống kê chi phí.
 */

export type TripEdit = {
  id: string
  code: string
  mode: TripMode
  carrier_name: string
  carrier_id: string | null
  receipt_no: string | null
  sent_on: string
  eta: string | null
  packages: number | null
  package_unit: string | null
  weight_kg: number | null
  note: string | null
  po_ids: string[]
}

export type TripPoOption = {
  id: string
  code: string
  supplier_name: string
  lsx_code: string | null
  /** Tên chành trên câu nơi giao của đơn — để gợi ý đơn cùng chành. */
  chanh: string | null
}

export type CarrierOption = { id: string | null; name: string }

const inputCls =
  'text-k-sm h-[var(--ctl-h)] w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-card)] px-2 placeholder:text-[var(--ink-3)] focus:border-[var(--act)] focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-k-sm font-semibold text-[var(--ink-label)]">{label}</span>
      {children}
    </label>
  )
}

export function ChuyenSheet({
  open,
  onClose,
  today,
  edit,
  initialPoIds,
  pos,
  carriers,
}: {
  open: boolean
  onClose: () => void
  today: string
  /** Có = sửa chuyến này; không = ghi chuyến mới. */
  edit: TripEdit | null
  /** Đơn tích sẵn khi mở từ một dòng ("NCC đã gửi hàng"). */
  initialPoIds: string[]
  /** Đơn đang về — chọn vào chuyến. */
  pos: TripPoOption[]
  carriers: CarrierOption[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [mode, setMode] = useState<TripMode>(edit?.mode ?? 'chanh')
  const [carrier, setCarrier] = useState(edit?.carrier_name ?? '')
  const [receiptNo, setReceiptNo] = useState(edit?.receipt_no ?? '')
  const [sentOn, setSentOn] = useState(edit?.sent_on ?? today)
  const [eta, setEta] = useState(edit?.eta ?? '')
  const [packages, setPackages] = useState(
    edit?.packages != null ? String(edit.packages) : '',
  )
  const [unit, setUnit] = useState(edit?.package_unit ?? 'kiện')
  const [weight, setWeight] = useState(
    edit?.weight_kg != null ? String(edit.weight_kg) : '',
  )
  const [note, setNote] = useState(edit?.note ?? '')
  const [picked, setPicked] = useState<string[]>(edit?.po_ids ?? initialPoIds)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)

  const why = tripProblem({
    mode,
    carrier_name: carrier,
    sent_on: sentOn,
    eta: eta || null,
    po_ids: picked,
  })

  // Đơn đã có trong chuyến nhưng không còn "đang về" (đã về đủ) vẫn phải hiện để bỏ được.
  const extra = (edit?.po_ids ?? [])
    .filter((id) => !pos.some((p) => p.id === id))
    .map((id) => ({
      id,
      code: 'đơn đã về đủ',
      supplier_name: '',
      lsx_code: null,
      chanh: null,
    }))

  const list = useMemo(() => {
    const tim = searchMatcher(q)
    const all = [...pos, ...extra]
    const hit = all.filter((p) => tim([p.code, p.supplier_name, p.lsx_code, p.chanh]))
    // Đơn đã tích lên đầu, rồi đơn cùng chành với tên đang gõ, rồi theo mã.
    const c = carrier.trim().toLowerCase()
    return [...hit].sort((a, b) => {
      const sa =
        (picked.includes(a.id) ? 0 : 2) +
        (c && a.chanh && c.includes(a.chanh.toLowerCase()) ? 0 : 1)
      const sb =
        (picked.includes(b.id) ? 0 : 2) +
        (c && b.chanh && c.includes(b.chanh.toLowerCase()) ? 0 : 1)
      return sa - sb || a.code.localeCompare(b.code)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- extra suy từ edit + pos
  }, [pos, q, picked, carrier, edit])

  const toggle = (id: string) =>
    setPicked((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]))

  async function luu() {
    if (why) return
    setBusy(true)
    const hit = carriers.find(
      (c) => c.id && c.name.toLowerCase() === carrier.trim().toLowerCase(),
    )
    const body = {
      mode,
      carrier_name: carrier.trim(),
      carrier_id: hit?.id ?? null,
      receipt_no: receiptNo.trim() || null,
      sent_on: sentOn,
      eta: eta || null,
      packages: packages ? Number(packages) : null,
      package_unit: packages ? unit : null,
      weight_kg: weight ? Number(weight.replace(/\./g, '').replace(',', '.')) : null,
      note: note.trim() || null,
      po_ids: picked,
    }
    try {
      if (edit) {
        await api(`/api/dept/supply/trips/${edit.id}`, { method: 'PATCH', body })
        toast.success(`Đã sửa chuyến ${edit.code}`)
      } else {
        const r = await api<{ trip: { code: string } }>('/api/dept/supply/trips', {
          method: 'POST',
          body,
        })
        toast.success(
          `Đã ghi chuyến ${r.trip.code}`,
          `${picked.length} đơn đang trên đường`,
        )
      }
      onClose()
      router.refresh()
    } catch (e) {
      toast.error('Chưa lưu được chuyến', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={edit ? `Sửa chuyến ${edit.code}` : 'Ghi chuyến hàng'}
      subtitle="Hàng đã rời NCC — đang trên xe nào, bao giờ về kho. Không ghi tiền ở đây."
      width={640}
      footer={
        <div className="flex flex-col gap-2">
          {why && <span className="text-k-sm text-[var(--warn)]">{why}</span>}
          <SheetActions
            onCancel={onClose}
            onConfirm={luu}
            confirmLabel={edit ? 'Lưu chuyến' : 'Ghi chuyến'}
            busy={busy}
            disabled={!!why}
          />
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <ScopeSwitch
          label="Hàng đi bằng"
          value={mode}
          onChange={setMode}
          options={TRIP_MODES.map((m) => ({ value: m, label: TRIP_MODE_LABEL[m] }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Field label={mode === 'ncc_cho' ? 'Xe / người chở *' : 'Chành / nhà xe *'}>
            <input
              className={inputCls}
              list="chuyen-nha-xe"
              value={carrier}
              onChange={(e) => setCarrier(e.target.value)}
              placeholder={
                mode === 'chanh' ? 'VD: Chành xe Hùng Vịnh' : 'Tên nhà xe hoặc tài xế'
              }
            />
            <datalist id="chuyen-nha-xe">
              {carriers.map((c) => (
                <option key={c.name} value={c.name} />
              ))}
            </datalist>
          </Field>
          <Field label="Số biên nhận / phiếu gửi">
            <input
              className={`${inputCls} num`}
              value={receiptNo}
              onChange={(e) => setReceiptNo(e.target.value)}
              placeholder="theo ảnh NCC gửi"
            />
          </Field>
          <Field label="Ngày hàng rời NCC *">
            <DateInput label="Ngày gửi" value={sentOn} onChange={setSentOn} />
          </Field>
          <Field label="Dự kiến tới xưởng">
            <DateInput label="Dự kiến tới" value={eta} onChange={setEta} />
          </Field>
          <Field label="Số kiện">
            <span className="flex gap-2">
              <NumInput aria-label="Số kiện" value={packages} onCommit={setPackages} />
              <Pick
                label="Đơn vị kiện"
                width={110}
                value={unit}
                onChange={setUnit}
                options={PACKAGE_UNITS.map((u) => ({ value: u, label: u }))}
              />
            </span>
          </Field>
          <Field label="Trọng lượng (kg) · tuỳ chọn">
            <NumInput aria-label="Trọng lượng kg" value={weight} onCommit={setWeight} />
          </Field>
        </div>
        <Field label="Ghi chú">
          <TextArea
            aria-label="Ghi chú chuyến"
            rows={2}
            value={note}
            onChange={setNote}
            placeholder="VD: 2 kiện nhôm dài, bốc cẩn thận"
          />
        </Field>

        <div className="flex flex-col gap-2 border-t border-[var(--line)] pt-3">
          <div className="flex items-center gap-2">
            <b className="text-k-body">Đơn đi chung chuyến</b>
            <span className="text-k-sm text-[var(--ink-3)]">
              đã chọn <span className="num">{picked.length}</span> · chở được đơn của
              nhiều NCC
            </span>
          </div>
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Tìm số PO, NCC, lệnh…"
            width={300}
          />
          <div className="max-h-[260px] overflow-auto rounded-[var(--radius-sm)] border border-[var(--line)]">
            {list.length === 0 ? (
              <p className="text-k-sm p-3 text-[var(--ink-3)]">
                Không có đơn đang về nào khớp.
              </p>
            ) : (
              list.map((p) => {
                const on = picked.includes(p.id)
                return (
                  <label
                    key={p.id}
                    className={`text-k-sm flex cursor-pointer items-center gap-2 border-b border-[var(--hair)] px-2 py-1.5 last:border-b-0 ${on ? 'bg-[var(--act-wash)]' : 'hover:bg-[var(--surface-hover)]'}`}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => toggle(p.id)}
                      className="accent-[var(--act)]"
                    />
                    <span className="num w-[118px] shrink-0 font-semibold text-[var(--act)]">
                      {p.code}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{p.supplier_name}</span>
                    {p.lsx_code && (
                      <span className="num shrink-0 text-[var(--ink-3)]">
                        {p.lsx_code}
                      </span>
                    )}
                    {p.chanh && (
                      <span className="shrink-0 text-[var(--ink-3)]">· {p.chanh}</span>
                    )}
                  </label>
                )
              })
            )}
          </div>
        </div>
      </div>
    </Sheet>
  )
}
