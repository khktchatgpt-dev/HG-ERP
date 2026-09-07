import Link from 'next/link'
import { DocChip } from '@/components/erp/DocChip'
import type { BadgeTone } from '@/components/Badge'
import type { MeetingRisk, MeetingRiskLevel } from '@/lib/supply-meeting'
import type { LsxSupplyRow } from '@/modules/dept/supply/lsx-supply.service'

/** Badge theo mức — chỉ ba màu vòng đời + xám; cobalt cho "đang về". */
export const LEVEL_BADGE: Record<MeetingRiskLevel, BadgeTone> = {
  stop: 'red',
  warn: 'amber',
  watch: 'gray',
  inflight: 'blue',
  ready: 'green',
}

const LEVEL_STRIPE: Record<MeetingRiskLevel, string> = {
  stop: 'var(--stop)',
  warn: 'var(--warn)',
  watch: 'var(--muted-foreground)',
  inflight: 'var(--primary)',
  ready: 'var(--done)',
}

export const dmy = (iso: string | null) =>
  iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : '—'

/**
 * MỘT DÒNG VẤN ĐỀ — dùng ở Tổng quan (5 dòng khẩn nhất) và trang Vấn đề cần
 * xử lý (đầy đủ, có lọc). Không dùng hook để trang server render thẳng được.
 *
 * Vạch trái mã hoá mức khẩn; mã lệnh dẫn sang đơn mua của lệnh; bên phải là
 * ai đang cầm bóng và việc phải làm — đúng ba thứ người họp cần đọc.
 */
export function IssueRow({ row, risk }: { row: LsxSupplyRow; risk: MeetingRisk }) {
  return (
    <li className="grid grid-cols-[4px_1fr] gap-3 py-2.5 pr-4 sm:grid-cols-[4px_1fr_auto]">
      <span
        className="self-stretch rounded-r-sm"
        style={{ background: LEVEL_STRIPE[risk.level] }}
      />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Link href={`/planning/lsx/${row.id}`} className="hover:opacity-80">
            <DocChip>{row.code}</DocChip>
          </Link>
          <span className="text-[13px]">{risk.reason}</span>
        </div>
        <div className="text-muted-foreground mt-0.5 text-[12px]">
          {row.customer_name}
          {row.products.length > 0 && (
            <>
              {' · '}
              {row.products
                .slice(0, 2)
                .map((p) => p.name)
                .join(', ')}
              {row.products.length > 2 && ` +${row.products.length - 2}`}
            </>
          )}
          {risk.nextExpected && (
            <>
              {' · '}hẹn về gần nhất{' '}
              <span className="t-data">{dmy(risk.nextExpected)}</span>
            </>
          )}
        </div>
      </div>
      {/*
        col-start-2 ở mobile: lưới chỉ có hai cột dưới sm nên khối này rơi
        xuống ĐÚNG cột vạch màu rộng 4px và chữ bị vắt dọc từng ký tự (đo ở
        375px, 07/09/2026). Ép nó về cột nội dung.
      */}
      <div className="col-start-2 mt-1 text-[12px] sm:col-start-auto sm:mt-0 sm:text-right">
        <div className="text-muted-foreground">{risk.owner}</div>
        {risk.action && <div className="font-medium">{risk.action}</div>}
      </div>
    </li>
  )
}
