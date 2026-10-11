import Link from 'next/link'
import { NGUONG_DU_TOAN } from '@/lib/hang-muc'
import { money } from './approval-helpers'
import type { PendingPo } from './approval-types'

/**
 * KHỐI "HẠNG MỤC" TRÊN MÀN KÝ — chép bản vẽ Đầu đơn mua, viết tay không qua kit.
 * Đơn ngoài lệnh mua cho việc gì, và một câu: "Đơn này X → hạng mục lên Y / dự
 * toán Z (%)" kèm thanh. Vượt dự toán chỉ CẢNH BÁO, không chặn ký (Q4).
 */
export function HangMucKy({ p }: { p: PendingPo }) {
  const h = p.project!
  const cungTien = h.currency === p.currency
  const grand = p.money?.grand ?? p.total
  const sau = h.ordered_truoc + (cungTien ? grand : 0)
  const pct = h.budget ? Math.round((sau / h.budget) * 100) : null
  const vuot = h.budget != null ? sau - h.budget : 0
  return (
    <div className="grid gap-1.5 text-[12.5px]">
      <div>
        <Link
          href={`/mua-hang/hang-muc/${h.id}`}
          className="text-[var(--act)] hover:underline"
        >
          <span className="font-mono font-semibold">{h.code}</span> · <b>{h.name}</b>
        </Link>
        <span className="text-[var(--ink-3)]">
          {' '}
          · {h.kind}
          {h.owner_name ? ` · ${h.owner_name} phụ trách` : ''}
        </span>
      </div>
      {cungTien ? (
        <div
          className={
            pct != null && pct >= NGUONG_DU_TOAN ? 'text-[var(--warn)]' : undefined
          }
        >
          Đơn này <b className="font-mono">{money(grand, p.currency)}</b> → hạng mục lên{' '}
          <b className="font-mono">{money(sau, h.currency)}</b>
          {h.budget != null ? (
            <>
              {' '}
              / dự toán <span className="font-mono">{money(h.budget, h.currency)}</span> (
              {pct}%)
            </>
          ) : (
            <span className="text-[var(--ink-3)]"> · chưa đặt dự toán</span>
          )}
        </div>
      ) : (
        <div className="text-[var(--ink-3)]">
          Đơn tính {p.currency}, hạng mục tính {h.currency} — không cộng vào tổng hạng
          mục.
        </div>
      )}
      {cungTien && pct != null && (
        <span className="block h-1.5 w-full bg-[#e3e7ee]" aria-hidden>
          <span
            className="block h-full"
            style={{
              width: `${Math.min(pct, 100)}%`,
              background: pct >= NGUONG_DU_TOAN ? 'var(--warn)' : 'var(--act)',
            }}
          />
        </span>
      )}
      <div className="text-[12px] text-[var(--ink-3)]">
        {vuot > 0.005
          ? `Vượt dự toán ${money(vuot, h.currency)} — chỉ cảnh báo, không chặn ký.`
          : h.n_truoc > 0
            ? `Trước đơn này: ${h.n_truoc} đơn · ${money(h.ordered_truoc, h.currency)} (gồm VAT, trừ nháp + huỷ).`
            : 'Đây là đơn đầu của hạng mục.'}
      </div>
    </div>
  )
}
