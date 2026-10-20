'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, DateInput, FilterBar, Popover, TextArea, useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import type { DangVeRow } from './DangVeScreen'

/**
 * THAO TÁC NHIỀU ĐƠN MỘT LƯỢT (02/10/2026, chủ dự án: "thay vì mỗi dòng một nút
 * Nhận hàng, tích chọn nhiều để thao tác dễ hơn").
 *
 * Không mở đường ghi mới: mỗi đơn vẫn đi đúng route của thao tác trên dòng
 * (`reschedule`, `confirm`, form phiếu nhập) — server kiểm quyền + trạng thái
 * TỪNG đơn. Đơn nào hỏng thì báo đúng đơn đó, đơn khác vẫn ghi.
 *
 * Nhận hàng KHÔNG gộp thành một phiếu: phiếu nhập là chứng từ theo MỘT đơn (đối
 * chiếu NCC, hoá đơn, công nợ theo đơn). "Nhận lần lượt" mở phiếu đơn đầu, ghi
 * sổ xong quay về đây với nút "Nhận tiếp" cho đơn sau (`?tiep=`).
 *
 * Vào chế độ chọn bằng mục "Chọn nhiều đơn…" trong menu ⋯ của dòng (chủ dự án
 * chọn 02/10: cột tích thường trực rối hơn menu); "Bỏ chọn" thì cột tích ẩn lại.
 */
export function ThanhChon({
  rows,
  canReceive,
  canTrip,
  onTrip,
  onClear,
}: {
  rows: DangVeRow[]
  canReceive: boolean
  canTrip: boolean
  onTrip: (ids: string[]) => void
  onClear: () => void
}) {
  const sua = rows.filter((r) => r.editable)
  const chuaXn = sua.filter((r) => r.status === 'ordered')
  const [dau, ...sau] = rows
  return (
    <FilterBar dense tone="selected" label="Thao tác các đơn đã chọn">
      <span className="num text-k-sm mr-1 shrink-0 font-semibold text-[var(--act-text)]">
        {rows.length} đơn đã chọn
      </span>
      {canReceive && dau && (
        <Btn
          primary
          icon="nhanHang"
          href={`/mua-hang/don/${dau.id}/nhan${sau.length ? `?tiep=${sau.map((r) => r.id).join(',')}` : ''}`}
          title={rows.length > 1 ? `Mở phiếu nhập ${dau.code}; ghi sổ xong nhận tiếp ${sau.length} đơn còn lại` : undefined} // prettier-ignore
        >
          {rows.length > 1
            ? `Nhận hàng lần lượt (${rows.length})`
            : `Nhận hàng ${dau.code}`}
        </Btn>
      )}
      {canTrip && (
        <Btn icon="them" onClick={() => onTrip(rows.map((r) => r.id))}>
          Ghi chuyến hàng
        </Btn>
      )}
      <HenNhieu rows={sua} onDone={onClear} />
      <XacNhanNhieu rows={chuaXn} onDone={onClear} />
      {sua.length < rows.length && (
        <span className="text-k-sm text-[var(--ink-3)]">
          {rows.length - sua.length} đơn không do bạn phụ trách — chỉ nhận hàng được,
          không sửa hẹn/xác nhận
        </span>
      )}
      <span className="ml-auto">
        <Btn onClick={onClear}>Bỏ chọn</Btn>
      </span>
    </FilterBar>
  )
}

/** Gọi lần lượt từng đơn, gom kết quả — một đơn hỏng không chặn đơn khác. */
async function lanLuot(
  rows: DangVeRow[],
  goi: (r: DangVeRow) => Promise<unknown>,
): Promise<{ ok: string[]; loi: string[] }> {
  const ok: string[] = []
  const loi: string[] = []
  for (const r of rows) {
    try {
      await goi(r)
      ok.push(r.code)
    } catch (e) {
      loi.push(`${r.code}: ${apiErrorText(e)}`)
    }
  }
  return { ok, loi }
}

function useKetQua(onDone: () => void) {
  const router = useRouter()
  const toast = useToast()
  return (viec: string, kq: { ok: string[]; loi: string[] }) => {
    if (kq.ok.length) toast.success(`${viec} ${kq.ok.length} đơn`, kq.ok.join(', '))
    if (kq.loi.length)
      toast.error(`${kq.loi.length} đơn chưa ghi được`, kq.loi.join(' · '))
    router.refresh()
    if (!kq.loi.length) onDone()
  }
}

function HenNhieu({ rows, onDone }: { rows: DangVeRow[]; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const xong = useKetQua(onDone)
  const coDoi = rows.some((r) => r.expected_at)
  const why = !date ? 'Chọn ngày giao' : coDoi && !reason.trim() ? 'Có đơn đang có hẹn — ghi lý do dời' : null // prettier-ignore
  const luu = async () => {
    if (why) return
    setBusy(true)
    const kq = await lanLuot(
      rows.filter((r) => r.expected_at?.slice(0, 10) !== date),
      (r) => api(`/api/dept/supply/pos/${r.id}/reschedule`, { method: 'POST', body: { expected_at: date, reason: reason.trim() } }), // prettier-ignore
    )
    setBusy(false)
    setOpen(false)
    xong('Đã hẹn giao', kq)
  }
  if (rows.length === 0) return null
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={`Hẹn giao ${rows.length} đơn`}
      width={320}
      trigger={<Btn icon="hen">{`Hẹn giao (${rows.length})`}</Btn>}
    >
      <div className="flex flex-col gap-2">
        <b className="text-k-sm">Đặt / dời hẹn giao · {rows.length} đơn</b>
        <span className="text-k-sm text-[var(--ink-3)]">
          {rows.map((r) => r.code).join(', ')}
        </span>
        <label className="text-k-sm flex flex-col gap-1">
          <span className="font-semibold text-[var(--ink-2)]">Ngày giao</span>
          <DateInput label="Ngày giao" value={date} onChange={setDate} />
        </label>
        <label className="text-k-sm flex flex-col gap-1">
          <span className="font-semibold text-[var(--ink-2)]">
            Lý do{coDoi ? '' : ' (không bắt buộc)'}
          </span>
          <TextArea
            aria-label="Lý do"
            rows={2}
            value={reason}
            onChange={setReason}
            placeholder="VD: NCC báo lùi 3 ngày"
          />
        </label>
        {why && <span className="text-k-sm text-[var(--warn)]">{why}</span>}
        <div className="flex justify-end gap-2 pt-1">
          <Btn onClick={() => setOpen(false)}>Huỷ</Btn>
          <Btn
            primary
            busy={busy}
            disabled={!!why}
            title={why ?? undefined}
            onClick={luu}
          >
            Lưu
          </Btn>
        </div>
      </div>
    </Popover>
  )
}

function XacNhanNhieu({ rows, onDone }: { rows: DangVeRow[]; onDone: () => void }) {
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const xong = useKetQua(onDone)
  const luu = async () => {
    setBusy(true)
    const kq = await lanLuot(
      rows,
      (r) =>
      api(`/api/dept/supply/pos/${r.id}/confirm`, { method: 'POST', body: { confirmed_note: note.trim() || null, shipments: [] } }), // prettier-ignore
    )
    setBusy(false)
    setOpen(false)
    xong('NCC đã xác nhận', kq)
  }
  if (rows.length === 0) return null
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={`Ghi NCC xác nhận ${rows.length} đơn`}
      width={320}
      trigger={<Btn icon="duyet">{`Ghi NCC xác nhận (${rows.length})`}</Btn>}
    >
      <div className="flex flex-col gap-2">
        <b className="text-k-sm">NCC xác nhận · {rows.length} đơn chưa xác nhận</b>
        <span className="text-k-sm text-[var(--ink-3)]">
          {rows.map((r) => r.code).join(', ')}
        </span>
        <label className="text-k-sm flex flex-col gap-1">
          <span className="font-semibold text-[var(--ink-2)]">
            Ai xác nhận, qua kênh nào
          </span>
          <TextArea
            aria-label="Ghi chú xác nhận"
            rows={2}
            value={note}
            onChange={setNote}
            placeholder="VD: chị Lan gọi điện 02/10"
          />
        </label>
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
