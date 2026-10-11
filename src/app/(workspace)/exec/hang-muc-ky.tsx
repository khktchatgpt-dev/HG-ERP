import Link from 'next/link'
import { FactKv } from '@/components/kit'
import { NGUONG_DU_TOAN } from '@/lib/hang-muc'
import { money } from './approval-helpers'
import type { PendingPo } from './approval-types'

/**
 * KHỐI "HẠNG MỤC" TRÊN MÀN KÝ (0230, B2 bản vẽ Đầu đơn) — đơn ngoài lệnh mua cho
 * việc gì, việc đó đã tiêu bao nhiêu TRƯỚC đơn này, và sau đơn này lên bao nhiêu
 * so với dự toán. Vượt dự toán chỉ CẢNH BÁO, không chặn ký (Q4).
 */
export function HangMucKy({ p }: { p: PendingPo }) {
  const h = p.project!
  const cungTien = h.currency === p.currency
  const grand = p.money?.grand ?? p.total
  const sau = h.ordered_truoc + (cungTien ? grand : 0)
  const pct = h.budget ? Math.round((sau / h.budget) * 100) : null
  const vuot = h.budget != null ? sau - h.budget : 0
  return (
    <FactKv
      prose
      rows={[
        [
          'Hạng mục',
          <Link
            key="h"
            href={`/mua-hang/hang-muc/${h.id}`}
            className="text-[var(--act)] underline-offset-2 hover:underline"
          >
            <span className="num">{h.code}</span> · {h.name}
          </Link>,
        ],
        ['Loại', h.kind],
        [
          'Đã đặt trước đơn này',
          h.n_truoc > 0 ? (
            <span key="t">
              <span className="num">{money(h.ordered_truoc, h.currency)}</span>{' '}
              <Muted>· {h.n_truoc} đơn, gồm VAT</Muted>
            </span>
          ) : (
            <Muted key="t">chưa có đơn nào — đây là đơn đầu</Muted>
          ),
        ],
        [
          'Sau đơn này',
          cungTien ? (
            <span
              key="s"
              className={pct != null && pct >= NGUONG_DU_TOAN ? 'k-t-warn' : undefined}
            >
              <span className="num">{money(sau, h.currency)}</span>
              {h.budget != null
                ? vuot > 0.005
                  ? ` · vượt dự toán ${money(vuot, h.currency)}`
                  : ` · ${pct}% dự toán ${money(h.budget, h.currency)}`
                : ''}
            </span>
          ) : (
            <Muted key="s">
              đơn tính {p.currency}, hạng mục tính {h.currency} — không cộng
            </Muted>
          ),
        ],
      ]}
    />
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return <span className="text-[var(--ink-3)]">{children}</span>
}
