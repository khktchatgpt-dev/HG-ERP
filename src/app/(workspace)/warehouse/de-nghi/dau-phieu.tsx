'use client'

import type { Dispatch, SetStateAction } from 'react'
import { isoToVn, todayVn } from '@/lib/date-vn'
import { Combobox, DateInput, NumInput, TextInput } from '@/components/kit'

export type DauPhieuState = {
  department: string
  need_by: string
  note: string
  production_order_id: string | null
  /** Phí vận chuyển dự kiến cả phiếu (Đ7). */
  shipping_fee: number
}

/**
 * Đầu phiếu đề nghị một dải (khuôn F): bộ phận · ngày · cần trước · lệnh · ghi
 * chú. Sửa được khi phiếu còn nháp. Tách khỏi `DeNghiScreen` 13/10/2026 (file
 * chạm trần 800 dòng khi thêm phần nhập kho — Đ3/Đ4).
 */
export function DauPhieu({
  sua,
  head,
  setHead,
  createdAt,
  lsx,
}: {
  sua: boolean
  head: DauPhieuState
  setHead: Dispatch<SetStateAction<DauPhieuState>>
  createdAt: string | null
  lsx: { id: string; code: string }[]
}) {
  const lsxChon = lsx.find((l) => l.id === head.production_order_id) ?? null
  const phieu = { created_at: createdAt }
  return (
    <div className="text-k-sm flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-[var(--hair)] bg-[var(--surface-card)] px-[var(--gutter)] py-2">
      <label className="inline-flex items-center gap-2">
        <span className="text-k-label font-semibold tracking-[.06em] whitespace-nowrap text-[var(--ink-3)] uppercase">
          Bộ phận
        </span>
        {sua ? (
          <TextInput
            value={head.department}
            onCommit={(v) => setHead((h) => ({ ...h, department: v }))}
            label="Bộ phận đề nghị"
            style={{ width: 150 }}
          />
        ) : (
          <b>{head.department}</b>
        )}
      </label>
      <span className="inline-flex items-center gap-2">
        <span className="text-k-label font-semibold tracking-[.06em] whitespace-nowrap text-[var(--ink-3)] uppercase">
          Ngày
        </span>
        <b className="num">
          {isoToVn(phieu.created_at ? todayVn(new Date(phieu.created_at)) : todayVn())}
        </b>
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="text-k-label font-semibold tracking-[.06em] whitespace-nowrap text-[var(--ink-3)] uppercase">
          Cần trước
        </span>
        {sua ? (
          <DateInput
            value={head.need_by}
            onChange={(v) => setHead((h) => ({ ...h, need_by: v }))}
            label="Cần trước ngày"
          />
        ) : (
          <b className="num">{head.need_by ? isoToVn(head.need_by) : '—'}</b>
        )}
      </span>
      <span className="inline-flex min-w-0 items-center gap-2">
        <span className="text-k-label font-semibold tracking-[.06em] whitespace-nowrap text-[var(--ink-3)] uppercase">
          Lệnh SX
        </span>
        {sua ? (
          <Combobox
            value={head.production_order_id ?? ''}
            onChange={(v) => setHead((h) => ({ ...h, production_order_id: v || null }))}
            options={[
              { value: '', label: 'Không gắn lệnh' },
              ...lsx.map((l) => ({ value: l.id, label: l.code })),
            ]}
            label="Lệnh sản xuất (tuỳ chọn)"
            width={190}
          />
        ) : (
          <b className="num">{lsxChon?.code ?? '—'}</b>
        )}
      </span>
      {/* Phí vận chuyển cả phiếu (Đ7) — tờ giấy có cột này; tổng lãnh đạo thấy gồm nó. */}
      <label className="inline-flex items-center gap-2">
        <span className="text-k-label font-semibold tracking-[.06em] whitespace-nowrap text-[var(--ink-3)] uppercase">
          Vận chuyển
        </span>
        {sua ? (
          <NumInput
            value={head.shipping_fee ? String(head.shipping_fee) : ''}
            onCommit={(v) => {
              const n = Number(v.replace(/\./g, '').replace(',', '.'))
              setHead((h) => ({
                ...h,
                shipping_fee: Number.isFinite(n) && n > 0 ? n : 0,
              }))
            }}
            placeholder="0"
            aria-label="Phí vận chuyển dự kiến"
            style={{ width: 100 }}
          />
        ) : (
          <b className="num">
            {head.shipping_fee ? head.shipping_fee.toLocaleString('vi-VN') : '—'}
          </b>
        )}
      </label>
      <label className="inline-flex min-w-0 flex-1 basis-[260px] items-center gap-2">
        <span className="text-k-label font-semibold tracking-[.06em] whitespace-nowrap text-[var(--ink-3)] uppercase">
          Ghi chú
        </span>
        {sua ? (
          <TextInput
            value={head.note}
            onCommit={(v) => setHead((h) => ({ ...h, note: v }))}
            placeholder="VD: cấp phục vụ sản xuất tuần 42"
            label="Ghi chú chung"
            style={{ width: '100%' }}
          />
        ) : (
          <span className="truncate">{head.note || '—'}</span>
        )}
      </label>
    </div>
  )
}
