'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Btn, Popover, Tag, TextArea, useToast } from '@/components/kit'
import { api, apiErrorText } from '@/lib/api'
import {
  TRIP_MODE_LABEL,
  TRIP_STATUS_LABEL,
  etaDays,
  type TripMode,
  type TripStatus,
} from '@/lib/chuyen-hang'
import type { TripEdit } from './chuyen-sheet'

/**
 * KHỐI "CHUYẾN ĐANG ĐI" trên màn Đang về (0216, bản vẽ C2). Mỗi hàng một chuyến:
 * xe nào, biên nhận, mấy kiện, gửi ngày nào, bao giờ tới, chở những đơn nào.
 * Chuyến tự rời khối khi mọi đơn trong nó có phiếu nhập Kho.
 *
 * Đơn trong chuyến VẪN nằm ở làn ngày hẹn của nó bên dưới (kèm dấu "trên xe"),
 * để con số Quá hẹn / Hôm nay trùng với Hộp thư và Bàn làm việc.
 */

export type TripCard = Omit<TripEdit, 'po_ids'> & {
  status: TripStatus
  pos: { id: string; code: string; supplier_name: string }[]
}

const ngay = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

export function ChuyenDangDi({
  trips,
  today,
  canTrip,
  onEdit,
}: {
  trips: TripCard[]
  today: string
  canTrip: boolean
  onEdit: (t: TripCard) => void
}) {
  if (trips.length === 0) return null
  return (
    <section
      aria-label="Chuyến đang đi"
      className="border-b border-[var(--line)] bg-[var(--surface-card)]"
    >
      <div className="text-k-label flex items-center gap-2 border-b border-[var(--line)] bg-[var(--act-wash)] px-[var(--gutter)] py-1 font-bold tracking-[.06em] text-[var(--act-text)] uppercase">
        Chuyến đang đi <span className="num">{trips.length}</span>
        <span className="font-normal tracking-normal text-[var(--ink-3)] normal-case">
          hàng đã rời NCC · tự rời khối khi Kho nhập đủ các đơn trong chuyến
        </span>
      </div>
      {trips.map((t) => {
        const d = etaDays(t.eta, today)
        return (
          <div
            key={t.id}
            className="text-k-sm flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-[var(--hair)] px-[var(--gutter)] py-1.5 last:border-b-0"
          >
            <b className="num text-[var(--act-text)]">{t.code}</b>
            <span>
              {TRIP_MODE_LABEL[t.mode as TripMode]} · <b>{t.carrier_name}</b>
            </span>
            {t.receipt_no && (
              <span className="text-[var(--ink-3)]">
                biên nhận <span className="num text-[var(--ink)]">{t.receipt_no}</span>
              </span>
            )}
            {t.packages != null && (
              <span>
                <span className="num">{t.packages}</span> {t.package_unit ?? 'kiện'}
              </span>
            )}
            <span>
              gửi <span className="num">{ngay(t.sent_on)}</span>
              {t.eta && (
                <>
                  {' '}
                  → tới <span className="num font-semibold">{ngay(t.eta)}</span>{' '}
                  {d != null && d < 0 ? (
                    <span className="font-semibold text-[var(--stop)]">
                      · trễ {-d} ngày
                    </span>
                  ) : d === 0 ? (
                    <span className="text-[var(--ink-3)]">· hôm nay</span>
                  ) : d != null ? (
                    <span className="text-[var(--ink-3)]">· còn {d} ngày</span>
                  ) : null}
                </>
              )}
            </span>
            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
              {t.pos.map((p) => (
                <a
                  key={p.id}
                  href={`/mua-hang/don/${p.id}`}
                  title={p.supplier_name}
                  className="num rounded-[var(--radius-sm)] bg-[var(--act-wash)] px-1.5 font-semibold text-[var(--act)] hover:underline"
                >
                  {p.code}
                </a>
              ))}
            </span>
            <Tag tone={t.status === 'da_toi' ? 'warn' : 'neutral'}>
              {TRIP_STATUS_LABEL[t.status]}
            </Tag>
            {canTrip && (
              <span className="ml-auto flex items-center gap-2">
                <Btn onClick={() => onEdit(t)}>Sửa</Btn>
                <HuyChuyenNut id={t.id} code={t.code} />
              </span>
            )}
          </div>
        )
      })}
    </section>
  )
}

/** Huỷ chuyến — ghi nhầm, NCC báo gửi mà chưa gửi. Không xoá, bắt lý do. */
function HuyChuyenNut({ id, code }: { id: string; code: string }) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const why = reason.trim().length < 3 ? 'Ghi lý do huỷ (ít nhất 3 ký tự)' : null

  async function huy() {
    if (why) return
    setBusy(true)
    try {
      await api(`/api/dept/supply/trips/${id}/cancel`, {
        method: 'POST',
        body: { reason: reason.trim() },
      })
      toast.success(`Đã huỷ chuyến ${code}`)
      setOpen(false)
      router.refresh()
    } catch (e) {
      toast.error('Chưa huỷ được chuyến', apiErrorText(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={`Huỷ chuyến ${code}`}
      align="end"
      width={300}
      trigger={<Btn aria-label={`Huỷ chuyến ${code}`}>Huỷ</Btn>}
    >
      <div className="flex flex-col gap-2">
        <b className="text-k-sm">Huỷ chuyến {code}</b>
        <span className="text-k-sm text-[var(--ink-3)]">
          Các đơn trong chuyến không đổi, chỉ bỏ dấu &ldquo;trên xe&rdquo;.
        </span>
        <TextArea
          aria-label="Lý do huỷ chuyến"
          rows={2}
          value={reason}
          onChange={setReason}
          placeholder="VD: ghi nhầm, NCC chưa gửi"
        />
        {why && <span className="text-k-sm text-[var(--warn)]">{why}</span>}
        <div className="flex justify-end gap-2">
          <Btn onClick={() => setOpen(false)}>Thôi</Btn>
          <Btn danger busy={busy} disabled={!!why} onClick={huy}>
            Huỷ chuyến
          </Btn>
        </div>
      </div>
    </Popover>
  )
}
