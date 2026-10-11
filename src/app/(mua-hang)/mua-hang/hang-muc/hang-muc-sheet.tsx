'use client'

import { useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { fmtMoney } from '@/lib/po-line'
import { docTienDuToan } from '@/lib/hang-muc'
import { HopThoai, INPUT, Nut, O } from '../_erp/ui'

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

/**
 * HỘP TẠO / SỬA HẠNG MỤC (0230) — chép hộp "Hạng mục mới" của bản vẽ Đầu đơn mua,
 * viết tay không qua kit. Mở ngay trên màn soạn đơn (ô "Cho việc" → "+ Tạo hạng
 * mục …", tên điền sẵn chữ đã gõ) hoặc ở trang Hạng mục.
 *
 * Bốn ô: tên việc, loại (gõ tự do + CHIP gợi ý — không dùng <datalist>: đo trên
 * Chrome, Tab ở ô có datalist bị danh sách giữ lại), dự toán (tuỳ chọn, chỉ để
 * theo dõi), phụ trách (người tạo; đổi người ở trang hạng mục). Sửa thì thêm ghi chú.
 */
export function HangMucSheet({
  ban,
  tenSan = '',
  phuTrach,
  goiYLoai,
  onClose,
  onSaved,
}: {
  /** Có = sửa hạng mục này; không = tạo mới. */
  ban?: { id: string; code: string; name: string; kind: string; budget: number | null; note: string | null; currency: string; owner_name: string | null } // prettier-ignore
  /** Tên điền sẵn (chữ người dùng đã gõ ở ô "Cho việc"). */
  tenSan?: string
  /** Người phụ trách hiển thị khi TẠO — người đang soạn. */
  phuTrach?: string
  /** Gợi ý ô Loại (lib/po-muc-dich `goiYMucDich`). */
  goiYLoai: readonly string[]
  onClose: () => void
  onSaved: (p: HangMucLuu) => void
}) {
  const toast = useToast()
  const [name, setName] = useState(ban?.name ?? tenSan)
  const [kind, setKind] = useState(ban?.kind ?? '')
  const [budgetText, setBudgetText] = useState(
    ban?.budget != null ? fmtMoney(ban.budget, ban.currency) : '',
  )
  const [note, setNote] = useState(ban?.note ?? '')
  const [busy, setBusy] = useState(false)
  const budget = docTienDuToan(budgetText)
  const why =
    name.trim().length < 2
      ? 'chưa có tên hạng mục'
      : kind.trim().length < 2
        ? 'chưa có loại'
        : budget === undefined
          ? 'dự toán không đọc được — gõ số, vd. 150.000.000'
          : null

  async function save() {
    if (why) return
    setBusy(true)
    try {
      const body = { name: name.trim(), kind: kind.trim(), budget: budget ?? null, ...(ban ? { note: note.trim() || null } : {}) } // prettier-ignore
      if (ban) {
        await api(`/api/dept/supply/projects/${ban.id}`, { method: 'PATCH', body })
        toast.success('Đã lưu hạng mục', ban.code)
        onSaved({ id: ban.id, code: ban.code, currency: ban.currency, status: 'open', name: body.name, kind: body.kind, budget: body.budget }) // prettier-ignore
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
    <HopThoai
      title={ban ? 'Sửa hạng mục' : 'Hạng mục mới'}
      aside={ban ? ban.code : 'HM-… · cấp khi lưu'}
      onClose={onClose}
      footer={
        <>
          {why && (
            <span className="mr-auto text-[12px] text-[var(--stop)]">
              Chưa lưu được: {why}
            </span>
          )}
          <Nut onClick={onClose}>Thôi</Nut>
          <Nut
            chinh
            khoa={why ? `Chưa lưu được: ${why}` : undefined}
            busy={busy}
            onClick={() => void save()}
          >
            {ban ? 'Lưu' : 'Tạo và chọn'}
          </Nut>
        </>
      }
    >
      <O label="Tên việc *">
        <input
          aria-label="Tên hạng mục"
          className={INPUT}
          value={name}
          autoFocus
          placeholder="vd. Xây dựng văn phòng"
          onChange={(e) => setName(e.target.value)}
        />
      </O>
      <O label="Loại *" help="gõ tự do kèm gợi ý — loại đã dùng nhiều đứng trước">
        <input
          aria-label="Loại hạng mục"
          className={INPUT}
          value={kind}
          placeholder="vd. Sửa chữa nhà xưởng"
          onChange={(e) => setKind(e.target.value)}
        />
        <span className="flex flex-wrap gap-1">
          {goiYLoai.slice(0, 8).map((x) => (
            <button
              key={x}
              type="button"
              tabIndex={-1}
              onClick={() => setKind(x)}
              className={`rounded-[10px] border px-2 py-[2px] text-[11.5px] ${kind === x ? 'border-[var(--act-line)] bg-[var(--act-wash)] text-[var(--act-text)]' : 'border-[var(--hair)] bg-[var(--surface-raised)] text-[var(--ink-2)] hover:border-[var(--act)]'}`}
            >
              {x}
            </button>
          ))}
        </span>
      </O>
      <O
        label="Dự toán (tuỳ chọn)"
        help="để trống = không theo dõi trần; có số thì màn soạn và màn ký bày “đã tiêu / dự toán”"
      >
        <input
          aria-label="Dự toán"
          inputMode="decimal"
          className={`${INPUT} font-mono`}
          value={budgetText}
          placeholder="vd. 150.000.000"
          onChange={(e) => setBudgetText(e.target.value)}
          onBlur={() => {
            const n = docTienDuToan(budgetText)
            if (n != null) setBudgetText(fmtMoney(n, ban?.currency ?? 'VND'))
          }}
        />
      </O>
      <O label="Phụ trách">
        <span className={`${INPUT} bg-[var(--surface-raised)]`}>
          {ban ? (ban.owner_name ?? '—') : `${phuTrach ?? 'tôi'} (người tạo)`}
        </span>
      </O>
      {ban && (
        <O label="Ghi chú">
          <textarea
            aria-label="Ghi chú hạng mục"
            className={INPUT}
            rows={2}
            value={note}
            placeholder="vd. Văn phòng 2 tầng cạnh xưởng A"
            onChange={(e) => setNote(e.target.value)}
          />
        </O>
      )}
    </HopThoai>
  )
}
