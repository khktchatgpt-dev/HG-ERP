'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, DateInput, Popover, TextArea, useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'

/**
 * HAI VIỆC LÀM NGAY TRÊN DÒNG của màn Đang về (01/10/2026) — trước đây phải mở
 * từng đơn. Không mở đường ghi mới: gọi đúng hai route màn chứng từ đang dùng
 * (`pos/[id]/reschedule`, `pos/[id]/confirm`), server vẫn kiểm quyền người phụ
 * trách và trạng thái đơn.
 */

const ngay = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

/**
 * ĐẶT / DỜI HẸN GIAO. Đơn đã có hẹn mà đổi ngày thì BẮT ghi lý do: lịch sử dời
 * hẹn (sổ hẹn giao 0213) là số đo NCC giao đúng hẹn, lần dời không lý do là
 * lần dời không ai giải thích được.
 */
export function HenGiaoNut({
  poId,
  code,
  current,
}: {
  poId: string
  code: string
  current: string | null
}) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(current?.slice(0, 10) ?? '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const doi = !!current
  const why = !date
    ? 'Chọn ngày giao'
    : doi && date === current?.slice(0, 10)
      ? 'Ngày mới trùng ngày đang hẹn'
      : doi && !reason.trim()
        ? 'Ghi lý do dời hẹn'
        : null

  async function luu() {
    if (why) return
    setBusy(true)
    try {
      await api(`/api/dept/supply/pos/${poId}/reschedule`, {
        method: 'POST',
        body: { expected_at: date, reason: reason.trim() },
      })
      toast.success(
        doi ? `Đã dời hẹn ${code}` : `Đã hẹn giao ${code}`,
        `Ngày giao ${ngay(date)}`,
      )
      setOpen(false)
      setReason('')
      router.refresh()
    } catch (e) {
      toast.error('Chưa lưu được hẹn giao', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={doi ? `Dời hẹn giao ${code}` : `Đặt hẹn giao ${code}`}
      width={300}
      trigger={
        <button
          type="button"
          className="text-k-sm font-semibold text-[var(--act)] hover:underline"
          aria-label={doi ? `Dời hẹn giao ${code}` : `Đặt hẹn giao ${code}`}
        >
          {doi ? 'Dời' : '+ Đặt hẹn giao'}
        </button>
      }
    >
      <div className="flex flex-col gap-2">
        <b className="text-k-sm">
          {doi ? `Dời hẹn giao · ${code}` : `Đặt hẹn giao · ${code}`}
        </b>
        {doi && (
          <span className="text-k-sm text-[var(--ink-3)]">
            Đang hẹn <span className="num">{ngay(current)}</span>
          </span>
        )}
        <label className="text-k-sm flex flex-col gap-1">
          <span className="font-semibold text-[var(--ink-2)]">Ngày giao</span>
          <DateInput label="Ngày giao" value={date} onChange={setDate} />
        </label>
        <label className="text-k-sm flex flex-col gap-1">
          <span className="font-semibold text-[var(--ink-2)]">
            Lý do{doi ? '' : ' (không bắt buộc)'}
          </span>
          <TextArea
            aria-label="Lý do"
            rows={2}
            value={reason}
            onChange={setReason}
            placeholder={
              doi ? 'VD: NCC báo thiếu phôi, lùi 3 ngày' : 'VD: NCC hẹn qua Zalo'
            }
          />
        </label>
        {/* Chưa lưu được thì nói vì sao NGAY DƯỚI Ô, không đợi bấm. */}
        {why && <span className="text-k-sm text-[var(--warn)]">{why}</span>}
        <div className="flex justify-end gap-2 pt-1">
          <Btn onClick={() => setOpen(false)}>Huỷ</Btn>
          <Btn primary busy={busy} disabled={!!why} title={why ?? undefined} onClick={luu}>
            Lưu
          </Btn>
        </div>
      </div>
    </Popover>
  )
}

/**
 * GHI NCC XÁC NHẬN — đơn đang "Đã gửi NCC" chuyển "NCC đã xác nhận". Không chia
 * đợt ở đây (đợt giao vẫn làm trong đơn); chỉ ghi lại ai hứa, kênh nào.
 */
export function XacNhanNut({ poId, code }: { poId: string; code: string }) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  async function luu() {
    setBusy(true)
    try {
      await api(`/api/dept/supply/pos/${poId}/confirm`, {
        method: 'POST',
        body: { confirmed_note: note.trim() || null, shipments: [] },
      })
      toast.success(`${code}: NCC đã xác nhận`)
      setOpen(false)
      router.refresh()
    } catch (e) {
      toast.error('Chưa ghi được xác nhận', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={`Ghi NCC xác nhận ${code}`}
      width={300}
      trigger={
        <button
          type="button"
          className="text-k-sm font-semibold text-[var(--act)] hover:underline"
          aria-label={`Ghi NCC xác nhận ${code}`}
        >
          Ghi xác nhận
        </button>
      }
    >
      <div className="flex flex-col gap-2">
        <b className="text-k-sm">NCC xác nhận · {code}</b>
        <label className="text-k-sm flex flex-col gap-1">
          <span className="font-semibold text-[var(--ink-2)]">
            Ai xác nhận, qua kênh nào
          </span>
          <TextArea
            aria-label="Ghi chú xác nhận"
            rows={2}
            value={note}
            onChange={setNote}
            placeholder="VD: chị Lan gọi điện 01/10"
          />
        </label>
        <span className="text-k-sm text-[var(--ink-3)]">
          Chia đợt giao theo từng dòng thì mở đơn, mục Giao &amp; nhận.
        </span>
        <div className="flex justify-end gap-2 pt-1">
          <Btn onClick={() => setOpen(false)}>Huỷ</Btn>
          <Btn primary busy={busy} onClick={luu}>
            Ghi xác nhận
          </Btn>
        </div>
      </div>
    </Popover>
  )
}
