'use client'

import { useMemo, useRef, useState } from 'react'
import {
  Btn,
  Combobox,
  Consequence,
  NumInput,
  Pick,
  Sheet,
  SheetActions,
  TextArea,
  TextInput,
} from '@/components/kit'
import { PendingImages } from '@/components/feedback/FeedbackImages'
import { useImagePaste } from '@/components/feedback/useImagePaste'
import { ISSUE_CHIPS, PRIORITY_LABEL, vnd, type IssuePriority } from '@/lib/may-moc'
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

export type AssetOption = {
  id: string
  code: string
  name: string
  /** Tổ đặt máy — danh sách xếp theo tổ như demo (optgroup). */
  dept_name?: string | null
  /** Số phiếu đang mở của máy — một máy một phiếu mở, nên báo ngay khi chọn. */
  open_no?: string | null
  open_id?: string | null
}
export type TechOption = { id: string; name: string }
export type IssueRef = {
  id: string
  no: string
  label: string
  description: string
  priority: IssuePriority
  vendor: string | null
  estimate: number | null
}

/**
 * BÁO HỎNG — mở từ mọi chỗ (hồ sơ máy, danh sách, Việc hôm nay). Mở từ hồ sơ
 * máy / tem QR thì máy đã chọn sẵn. Ảnh: chọn file hoặc dán Ctrl+V (dùng chung
 * bộ dán ảnh của Góp ý), tải lên trước, phiếu lưu xong mới nhận ảnh về.
 */
export function ReportIssueSheet({
  assets,
  assetId,
  onClose,
}: {
  assets: AssetOption[]
  assetId?: string
  onClose: () => void
}) {
  const m = useMutate()
  const [asset, setAsset] = useState(assetId ?? '')
  const [prio, setPrio] = useState<IssuePriority>('dung_may')
  const [desc, setDesc] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const parent = useMemo(() => ({ kind: 'none' as const }), [])
  const paste = useImagePaste(parent)
  const options = useMemo(
    () =>
      [...assets]
        .sort(
          (x, y) =>
            (x.dept_name ?? '￿').localeCompare(y.dept_name ?? '￿', 'vi') ||
            x.code.localeCompare(y.code),
        )
        .map((a) => ({
          value: a.id,
          label: `${a.code} · ${a.name}`,
          hint: [
            a.dept_name ?? 'Chưa gán tổ',
            a.open_no ? `đang có phiếu ${a.open_no} chưa xong` : '',
          ]
            .filter(Boolean)
            .join(' · '),
        })),
    [assets],
  )
  const chosen = assets.find((a) => a.id === asset)
  const busyNo = chosen?.open_no ?? null

  async function send() {
    if (!asset) return setErr('chọn máy bị hỏng.')
    if (busyNo)
      return setErr(
        `máy này đang có phiếu ${busyNo} chưa xong — ghi thêm vào phiếu đó ở Báo hỏng.`,
      )
    if (desc.trim().length < 5)
      return setErr('mô tả hiện tượng (ít nhất 5 ký tự) để Cơ điện biết mang gì đến.')
    if (paste.uploading) return setErr('ảnh đang tải lên — chờ một chút rồi bấm lại.')
    setErr(null)
    const r = await m.run(
      () =>
        m.api<{ issue: { no: string } }>('/api/may-moc/issues', {
          method: 'POST',
          body: {
            asset_id: asset,
            priority: prio,
            description: desc.trim(),
            file_ids: paste.ids,
          },
        }),
      (x) => `Đã gửi ${x.issue.no} — Tổ Cơ điện đã nhận báo hỏng`,
    )
    if (r.ok) onClose()
    else setErr(r.error)
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Báo hỏng máy"
      subtitle="Tổ Cơ điện nhận được ngay. Ảnh giúp thợ biết cần mang gì đến."
      width={560}
      footer={
        <SheetActions
          onCancel={onClose}
          onConfirm={() => void send()}
          busy={m.busy}
          confirmLabel="Gửi báo hỏng"
        />
      }
    >
      <div
        className="grid gap-3"
        onInput={() => setErr(null)}
        onPaste={paste.onPaste}
        onDrop={paste.onDrop}
        onDragOver={(e) => e.preventDefault()}
      >
        <FormRow label="Máy, thiết bị">
          <Combobox
            label="Máy bị hỏng"
            options={options}
            value={asset}
            onChange={(v) => {
              setAsset(v)
              setErr(null)
            }}
            emptyLabel="— Chọn máy —"
          />
        </FormRow>
        {/* Báo ngay lúc chọn, không để người dùng gõ xong mô tả mới bị máy chủ từ chối. */}
        {busyNo && (
          <Blocked lead="Không báo thêm được:">
            máy này đang có phiếu <b className="font-mono">{busyNo}</b> chưa xong — Tổ Cơ
            điện đã biết.{' '}
            <a
              className="text-[var(--act-text)] underline"
              href={`/may-moc/bao-hong?id=${chosen?.open_id ?? ''}`}
            >
              Mở phiếu {busyNo}
            </a>
          </Blocked>
        )}
        <div className="grid gap-1">
          <span className="text-k-sm font-semibold text-[var(--ink-label)]">
            Mức ảnh hưởng
          </span>
          <div className="flex gap-2">
            {(['dung_may', 'van_chay'] as const).map((p) => (
              <Btn
                key={p}
                primary={prio === p}
                aria-pressed={prio === p}
                onClick={() => setPrio(p)}
              >
                {PRIORITY_LABEL[p]}
              </Btn>
            ))}
          </div>
        </div>
        <div className="grid gap-1">
          <span className="text-k-sm font-semibold text-[var(--ink-label)]">
            Hiện tượng
          </span>
          <div className="flex flex-wrap gap-1">
            {ISSUE_CHIPS.map((c) => (
              <Btn
                key={c}
                onClick={() => {
                  // Mỗi chip đóng câu bằng ". " — gõ tiếp ngay sau không bị dính chữ.
                  setDesc((d) =>
                    d.trim() ? `${d.trim().replace(/[.\s]+$/, '')}. ${c}. ` : `${c}. `,
                  )
                  setErr(null)
                }}
              >
                {c}
              </Btn>
            ))}
          </div>
          <TextArea
            aria-label="Mô tả hiện tượng"
            value={desc}
            onChange={setDesc}
            rows={3}
            maxRows={8}
            placeholder="VD: không ra dây, motor cấp dây kêu, đã tắt máy"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Btn icon="them" onClick={() => fileInput.current?.click()}>
            Chụp / chọn ảnh hiện trạng
          </Btn>
          <span className="text-k-sm text-[var(--ink-3)]">
            không bắt buộc · dán ảnh bằng Ctrl+V
          </span>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={(e) => {
              void paste.addFiles(Array.from(e.target.files ?? []))
              e.target.value = ''
            }}
          />
        </div>
        <PendingImages images={paste.images} onRemove={paste.remove} />
        {err && <Blocked>{err}</Blocked>}
      </div>
    </Sheet>
  )
}

/** Nhận việc: giao thợ Tổ Cơ điện hoặc ghi thuê ngoài + dự toán. Vượt hạn mức → chờ GĐ. */
export function AcceptSheet({
  issue,
  techs,
  approveOver,
  me,
  onClose,
}: {
  issue: IssueRef
  techs: TechOption[]
  approveOver: number
  /** Nhân viên của tài khoản đang đăng nhập — thợ nhận việc thì mặc định chính mình. */
  me?: string | null
  onClose: () => void
}) {
  const m = useMutate()
  const [tech, setTech] = useState(
    techs.some((t) => t.id === me) ? me! : (techs[0]?.id ?? ''),
  )
  const [vendor, setVendor] = useState('')
  const [est, setEst] = useState('')
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const estimate = est ? readNum(est) : null
  const over = estimate != null && estimate > approveOver

  async function send() {
    if (!tech && !vendor.trim())
      return setErr('chọn thợ Tổ Cơ điện hoặc ghi đơn vị thuê ngoài.')
    if (estimate != null && Number.isNaN(estimate))
      return setErr('dự toán phải là số (VD 2.400.000).')
    setErr(null)
    const r = await m.run(
      () =>
        m.api(`/api/may-moc/issues/${issue.id}/accept`, {
          method: 'POST',
          body: {
            tech_employee_id: tech || null,
            vendor: tech ? null : vendor.trim(),
            estimate,
            note: note.trim() || null,
          },
        }),
      over
        ? `${issue.no}: dự toán vượt hạn mức, đã chuyển Giám đốc duyệt`
        : `${issue.no}: đã nhận việc, giao ${techs.find((t) => t.id === tech)?.name ?? vendor.trim()}`,
    )
    if (r.ok) onClose()
    else setErr(r.error)
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Nhận việc ${issue.no}`}
      subtitle={`${issue.label} · ${issue.description}`}
      width={560}
      footer={
        <SheetActions
          onCancel={onClose}
          onConfirm={() => void send()}
          busy={m.busy}
          confirmLabel={over ? 'Gửi Giám đốc duyệt' : 'Nhận việc'}
        />
      }
    >
      <div className="grid gap-3" onInput={() => setErr(null)}>
        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Người sửa">
            <Pick
              label="Người sửa"
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
            <FormRow label="Đơn vị thuê ngoài">
              <TextInput
                label="Đơn vị thuê ngoài"
                value={vendor}
                onCommit={setVendor}
                placeholder="VD: hãng HSG Laser"
              />
            </FormRow>
          )}
        </div>
        <FormRow
          label="Dự toán chi phí (đ)"
          warn={over}
          hint={
            over
              ? `Vượt hạn mức ${vnd(approveOver)} đ: phiếu sẽ chờ Ban Giám đốc duyệt, chưa bắt đầu sửa.`
              : `Trên ${vnd(approveOver)} đ phải chờ Giám đốc duyệt. Bỏ trống nếu chưa biết.`
          }
        >
          <NumInput
            aria-label="Dự toán chi phí"
            value={est}
            onCommit={setEst}
            align="left"
            placeholder="VD 2.400.000"
          />
        </FormRow>
        <FormRow label="Ghi chú">
          <TextArea
            aria-label="Ghi chú nhận việc"
            value={note}
            onChange={setNote}
            rows={2}
            placeholder="VD: cần đặt điện trở gia nhiệt, 2 ngày có hàng"
          />
        </FormRow>
        {err && <Blocked>{err}</Blocked>}
      </div>
    </Sheet>
  )
}

/** Hộp một ô lý do — dùng cho "Không duyệt" và "Huỷ phiếu". */
export function ReasonSheet({
  title,
  subtitle,
  consequence,
  confirmLabel,
  url,
  okText,
  placeholder,
  onClose,
}: {
  title: string
  subtitle: string
  consequence: string
  confirmLabel: string
  url: string
  okText: string
  placeholder: string
  onClose: () => void
}) {
  const m = useMutate()
  const [reason, setReason] = useState('')
  const [err, setErr] = useState<string | null>(null)
  async function send() {
    if (reason.trim().length < 5) return setErr('ghi lý do (ít nhất 5 ký tự).')
    setErr(null)
    const r = await m.run(
      () => m.api(url, { method: 'POST', body: { reason: reason.trim() } }),
      okText,
    )
    if (r.ok) onClose()
    else setErr(r.error)
  }
  return (
    <Sheet
      open
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      stakes="vua"
      width={520}
      footer={
        <SheetActions
          onCancel={onClose}
          onConfirm={() => void send()}
          busy={m.busy}
          confirmLabel={confirmLabel}
        />
      }
    >
      <div className="grid gap-3" onInput={() => setErr(null)}>
        <Consequence>{consequence}</Consequence>
        <FormRow label="Lý do">
          <TextArea
            aria-label="Lý do"
            value={reason}
            onChange={setReason}
            rows={3}
            placeholder={placeholder}
          />
        </FormRow>
        {err && <Blocked>{err}</Blocked>}
      </div>
    </Sheet>
  )
}

/** Sửa xong: vật tư + công + giờ dừng + nguyên nhân → phiếu PSC, máy chạy lại. */
export function DoneSheet({
  issue,
  suggestPart,
  onClose,
}: {
  issue: IssueRef
  suggestPart?: string
  onClose: () => void
}) {
  const m = useMutate()
  const [parts, setParts] = useState<PartDraft[]>([emptyPart(suggestPart), emptyPart()])
  const [labor, setLabor] = useState(
    issue.vendor && issue.estimate ? String(issue.estimate) : '',
  )
  const [down, setDown] = useState(issue.priority === 'dung_may' ? '6' : '1')
  const [note, setNote] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const ps = draftParts(parts)
  const total =
    ps.reduce((s, p) => s + Math.round(p.qty * p.price), 0) + (readNum(labor) || 0)

  async function send() {
    if (Number.isNaN(readNum(labor)) || Number.isNaN(readNum(down)))
      return setErr('tiền công và giờ dừng phải là số.')
    if (note.trim().length < 5)
      return setErr('ghi nguyên nhân, cách khắc phục (ít nhất 5 ký tự).')
    setErr(null)
    const r = await m.run(
      () =>
        m.api(`/api/may-moc/issues/${issue.id}/done`, {
          method: 'POST',
          body: {
            parts: ps,
            labor: readNum(labor),
            downtime_hours: readNum(down),
            note: note.trim(),
          },
        }),
      `${issue.label} đã chạy lại · chi phí ${vnd(total)} đ`,
    )
    if (r.ok) onClose()
    else setErr(r.error)
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Sửa xong ${issue.no}`}
      subtitle={`${issue.label} · ${issue.description}`}
      width={680}
      footer={
        <SheetActions
          onCancel={onClose}
          onConfirm={() => void send()}
          busy={m.busy}
          confirmLabel="Xác nhận máy chạy lại"
        />
      }
    >
      <div className="grid gap-3" onInput={() => setErr(null)}>
        <PartsEditor rows={parts} onChange={setParts} />
        <div className="grid grid-cols-2 gap-3">
          <FormRow
            label={issue.vendor ? 'Tiền thuê ngoài (đ)' : 'Nhân công, chi phí khác (đ)'}
          >
            <NumInput
              aria-label="Nhân công, chi phí khác"
              value={labor}
              onCommit={setLabor}
              align="left"
            />
          </FormRow>
          <FormRow label="Máy dừng bao nhiêu giờ">
            <NumInput
              aria-label="Số giờ dừng máy"
              value={down}
              onCommit={setDown}
              align="left"
            />
          </FormRow>
        </div>
        <FormRow label="Nguyên nhân, cách khắc phục">
          <TextArea
            aria-label="Nguyên nhân, cách khắc phục"
            value={note}
            onChange={setNote}
            rows={3}
            placeholder="VD: cháy điện trở gia nhiệt, đã thay mới, chạy thử 30 phút ổn"
          />
        </FormRow>
        <p className="text-k-sm">
          Phiếu sửa chữa sẽ ghi <b className="font-mono">{vnd(total)} đ</b> vào chi phí
          tháng này.
        </p>
        {err && <Blocked>{err}</Blocked>}
      </div>
    </Sheet>
  )
}
