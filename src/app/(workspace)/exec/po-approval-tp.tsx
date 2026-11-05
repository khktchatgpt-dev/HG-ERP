'use client'

import { Ico } from '@/components/kit'
import { cn } from '@/lib/utils'
import { choBaoLau, type TruongPhongXem } from '@/lib/po-review'

/*
  TRƯỞNG PHÒNG CƯ TRÊN MÀN KÝ ĐƠN (0293 · B3, bản vẽ RcqWLU7F1z33btAR97gZBo
  khung 4). Màn ký chạy bằng kit nên khối này cũng dùng token kit — sửa tại chỗ,
  không trộn hệ. Chưa xem KHÔNG khoá nút Phê duyệt (chủ dự án 05/11/2026).
*/

function fmtDT(iso: string) {
  const d = new Date(iso)
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(d.getDate())}/${p2(d.getMonth() + 1)} ${p2(d.getHours())}:${p2(d.getMinutes())}`
}

/**
 * Dải dưới tổng tiền (bản vẽ khung 4): xanh = trưởng phòng đã xem (ai · lúc ·
 * ghi chú); vàng = chưa xem (gửi lúc nào, bao lâu, ký bây giờ thì sao).
 */
export function TruongPhongBand({
  tp,
  submittedAt,
}: {
  tp: TruongPhongXem
  submittedAt: string | null
}) {
  const d = tp.da_xem
  return (
    <div
      className={cn(
        'text-k-sm flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 border-b border-[var(--line)] px-[var(--gutter)] py-1.5 text-[var(--ink-2)]',
        d ? 'bg-[var(--done-wash)]' : 'bg-[var(--warn-wash)]',
      )}
    >
      {d ? (
        <>
          <b className="text-[var(--done)]">
            <Ico name="xong" size={13} className="mr-1 inline" aria-hidden />
            Trưởng phòng đã xem
          </b>
          <span>
            {d.by_name ?? tp.ten ?? 'Trưởng phòng'} ·{' '}
            <span className="num">{fmtDT(d.at)}</span>
            {d.note ? (
              <>
                {' '}
                — <span className="text-[var(--ink)]">“{d.note}”</span>
              </>
            ) : (
              <span className="text-[var(--ink-3)]"> · không ghi chú</span>
            )}
          </span>
        </>
      ) : (
        <>
          <b className="text-[var(--warn)]">Trưởng phòng chưa xem</b>
          <span>
            {submittedAt && (
              <>
                gửi <span className="num">{fmtDT(submittedAt)}</span> ·{' '}
              </>
            )}
            {choBaoLau(tp.cho_phut)}. Duyệt bây giờ: lịch sử ký ghi “duyệt khi trưởng
            phòng chưa xem”, {tp.ten ?? 'trưởng phòng'} nhận thông báo.
          </span>
        </>
      )}
    </div>
  )
}

/** Dòng "Trưởng phòng" ở khối "Ai lập · ai giữ". */
export function TruongPhongKv({ tp }: { tp: TruongPhongXem }) {
  const d = tp.da_xem
  return (
    <span>
      <span
        className={cn('font-semibold', d ? 'text-[var(--done)]' : 'text-[var(--warn)]')}
      >
        {(d?.by_name ?? tp.ten) || 'Trưởng phòng CƯ'}
      </span>
      {' · '}
      {d ? (
        <span className="text-[var(--ink-2)]">
          đã xem <span className="num">{fmtDT(d.at)}</span>
        </span>
      ) : (
        <span className="text-[var(--ink-3)]">chưa xem</span>
      )}
    </span>
  )
}
