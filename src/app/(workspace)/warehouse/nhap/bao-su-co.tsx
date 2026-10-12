'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api, apiErrorText } from '@/lib/api'
import { ISSUE_KINDS, ISSUE_KIND_LABEL, type IssueKind } from '@/lib/po-tracking'
import { thanSuCo, TU_CHOI_NHAN } from '@/lib/kho-hang-ve'
import { Chip, Sheet, SheetActions, useToast } from '@/components/kit'
import type { HangCuaDonData } from './tai-hang-cua-don'

const O =
  'h-[var(--ctl-h)] w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-card)] px-2 text-k-sm placeholder:text-[var(--ink-3)] hover:border-[var(--ink-3)] focus:border-[var(--act)]'
const NHAN = 'text-k-sm font-semibold text-[var(--ink-2)]'

/**
 * BÁO SỰ CỐ GIAO HÀNG — giao diện RIÊNG của Kho (Kho đợt 2 · Bước 3, bản vẽ B3-2
 * https://claude.ai/artifact/WLinMQm3FQ1T7NVufZQHjS, duyệt 12/10/2026).
 *
 * Lấp hai lỗ đo được: (1) Kho TỪ CHỐI NHẬN cả lô thì không lập phiếu → không để
 * lại dấu vết; (2) sổ sự cố không báo ai. Câu hỏi ĐẦU là "có nhận lô này không"
 * vì nó quyết định hệ quả; từ chối thì mô tả mang chữ `[Từ chối nhận]` (Q1 — lựa
 * chọn, không phải loại sự cố mới).
 *
 * Ghi vào sổ sự cố của đơn qua route có sẵn `POST pos/[id]/issues` (quyền
 * `supply.po_issue.manage` đã cho Kho); server phát `po.issue_recorded` → người
 * phụ trách đơn nhận thông báo (0231). Không đổi tồn, không đổi đơn. Kho KHÔNG
 * đóng sự cố (Q4) — đó là việc của Cung ứng sau khi làm việc với NCC.
 *
 * Ô gõ thô cập nhật từng phím (kit `TextInput` chốt lúc rời ô → nút Báo không mở
 * khi đang gõ — bẫy đã dính ở hộp Sửa phiếu 02/10).
 */
export function BaoSuCoSheet({
  data,
  onClose,
}: {
  data: Pick<HangCuaDonData, 'po' | 'lines'>
  onClose: () => void
}) {
  const router = useRouter()
  const toast = useToast()
  const { po, lines } = data
  const [tuChoi, setTuChoi] = useState(false)
  const [kind, setKind] = useState<IssueKind | null>(null)
  const [lineId, setLineId] = useState('')
  const [qty, setQty] = useState('')
  const [moTa, setMoTa] = useState('')
  const [busy, setBusy] = useState(false)
  const [loiServer, setLoiServer] = useState<string | null>(null)

  const kq = thanSuCo({ kind, tuChoi, poLineId: lineId || null, qty, moTa })
  const dong = lines.find((l) => l.id === lineId) ?? null
  const nguoi = po.assignee_name ?? 'người phụ trách đơn'

  async function bao() {
    if (!('body' in kq)) return
    setBusy(true)
    setLoiServer(null)
    try {
      await api(`/api/dept/supply/pos/${po.id}/issues`, { method: 'POST', body: kq.body })
      toast.success(
        `Đã báo sự cố ${po.code}`,
        `${po.assignee_name ? `${po.assignee_name} sẽ nhận thông báo` : 'Ghi vào sổ sự cố của đơn'}`,
      )
      onClose()
      router.refresh()
    } catch (e) {
      setLoiServer(apiErrorText(e))
      setBusy(false)
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title={`Báo sự cố giao hàng · ${po.code}`}
      subtitle={[po.supplier_name, po.lsx_code, po.assignee_name && `phụ trách ${po.assignee_name}`].filter(Boolean).join(' · ')} // prettier-ignore
      stakes="vua"
      width={560}
      footer={
        <SheetActions
          onCancel={onClose}
          onConfirm={bao}
          confirmLabel="Báo sự cố"
          busy={busy}
          disabled={!('body' in kq)}
        />
      }
    >
      <form
        className="text-k-sm flex flex-col gap-3 p-[var(--gutter)]"
        onSubmit={(e) => {
          e.preventDefault()
          void bao()
        }}
      >
        <fieldset className="flex flex-col gap-1.5">
          <legend className={`${NHAN} mb-1`}>Lô hàng này</legend>
          {(
            [
              [false, 'Đã nhận / sẽ nhận phần dùng được', 'Phần đạt nhận bằng form nhận hàng; phần sai chọn “Sai quy cách” ở đó để hàng vào kệ khoá.'], // prettier-ignore
              [true, 'Từ chối nhận cả lô', 'Xe chở về lại. Không lập phiếu nhập, tồn không đổi. Cung ứng hẹn NCC giao lại.'], // prettier-ignore
            ] as const
          ).map(([v, ten, cau]) => (
            <label
              key={String(v)}
              className={
                tuChoi === v
                  ? 'flex cursor-pointer gap-2 border border-[var(--act)] bg-[var(--act-wash)] px-2.5 py-2'
                  : 'flex cursor-pointer gap-2 border border-[var(--line)] px-2.5 py-2 hover:border-[var(--ink-3)]'
              }
            >
              <input
                type="radio"
                name="lo-hang"
                checked={tuChoi === v}
                onChange={() => setTuChoi(v)}
                className="mt-0.5 accent-[var(--act)]"
              />
              <span>
                <b>{ten}</b>
                <span className="block text-[var(--ink-3)]">{cau}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <fieldset className="flex flex-col gap-1.5">
          <legend className={`${NHAN} mb-1`}>Loại sự cố</legend>
          <span className="flex flex-wrap gap-1.5">
            {ISSUE_KINDS.map((k) => (
              <Chip key={k} on={kind === k} onClick={() => setKind(k)}>
                {ISSUE_KIND_LABEL[k]}
              </Chip>
            ))}
          </span>
        </fieldset>

        <span className="grid grid-cols-[1fr_130px] gap-2">
          <label className="flex min-w-0 flex-col gap-1">
            <span className={NHAN}>Dòng hàng (không bắt buộc)</span>
            <select
              value={lineId}
              onChange={(e) => setLineId(e.target.value)}
              className={O}
            >
              <option value="">— cả đơn / không rõ dòng —</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.code ?? '—'} · {l.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={NHAN}>Số lượng{dong ? ` (${dong.unit})` : ''}</span>
            <input
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              inputMode="decimal"
              placeholder="không bắt buộc"
              className={`num ${O}`}
            />
          </label>
        </span>

        <label className="flex flex-col gap-1">
          <span className={NHAN}>Mô tả · bắt buộc</span>
          <textarea
            value={moTa}
            onChange={(e) => setMoTa(e.target.value)}
            rows={3}
            maxLength={950}
            placeholder="Thấy gì, bao nhiêu, đã làm gì (chụp ảnh, trả xe…)"
            className="text-k-sm w-full rounded-[var(--radius-sm)] border border-[var(--line)] bg-[var(--surface-card)] px-2 py-1.5 placeholder:text-[var(--ink-3)] hover:border-[var(--ink-3)] focus:border-[var(--act)]"
          />
        </label>

        <p className="border-l-[3px] border-[var(--act)] bg-[var(--act-wash)] px-2.5 py-2">
          Ghi vào <b>sổ sự cố của {po.code}</b>
          {tuChoi && (
            <>
              {' '}
              với chữ <span className="num">{TU_CHOI_NHAN}</span> ở đầu mô tả
            </>
          )}
          , và <b>báo cho {nguoi}</b> (Cung ứng) để làm việc với NCC. Tồn kho và trạng
          thái đơn không đổi.
        </p>
        {'loi' in kq && (kind || moTa) && (
          <p className="font-semibold text-[var(--warn)]">{kq.loi}</p>
        )}
        {loiServer && <p className="font-semibold text-[var(--stop)]">{loiServer}</p>}
      </form>
    </Sheet>
  )
}
