import { Tag } from '@/components/kit'
import { cn } from '@/lib/utils'
import { ngayVn } from '@/lib/nhan-su/bien-dong'
import {
  chuDau,
  khoiCua,
  nhanTinhTrang,
  TEN_KHOI,
  type KhoiNv,
  type NvTom,
} from '@/lib/nhan-su/ho-so'

export const TH =
  'sticky top-0 z-[1] border-b border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-left font-semibold text-[var(--ink-2)] whitespace-nowrap'
export const TD = 'border-b border-[var(--line-faint)] px-2.5 py-1.5 whitespace-nowrap'

/** Sắc ô chữ cái theo khối (bản vẽ màu 19/10/2026, Q2) — nhận nhóm, không phải trạng thái. */
const SAC_KHOI: Record<KhoiNv, string> = {
  van_phong: 'bg-[var(--grp-1-wash)] text-[var(--grp-1-ink)]',
  xuong: 'bg-[var(--grp-2-wash)] text-[var(--grp-2-ink)]',
  phuc_vu: 'bg-[var(--grp-3-wash)] text-[var(--grp-3-ink)]',
}

/** Ô ảnh: chưa có ảnh thì chữ cái đầu, tô theo khối của tổ; chưa có tổ thì xám. */
export function Avatar({
  ten,
  boPhan,
  lon = false,
}: {
  ten: string
  boPhan: string | null
  lon?: boolean
}) {
  const k = khoiCua(boPhan)
  return (
    <span
      aria-hidden
      title={k ? TEN_KHOI[k] : undefined}
      className={cn(
        'grid shrink-0 place-items-center rounded-full font-semibold',
        lon ? 'text-k-body size-11' : 'text-k-label size-7',
        k ? SAC_KHOI[k] : 'bg-[var(--surface-raised)] text-[var(--ink-2)]',
      )}
    >
      {chuDau(ten)}
    </span>
  )
}

/**
 * Tình trạng làm việc (bản vẽ màu Q1): "đang làm" là chữ xám không nền — 126/144 người như
 * nhau thì màu không nói gì. Chỉ trạng thái cần để ý mới có nền.
 */
export function TagTinhTrang({ n, homNay }: { n: NvTom; homNay: string }) {
  const t = nhanTinhTrang(n, homNay)
  switch (t.kieu) {
    case 'da_nghi':
      return <Tag tone="neutral">{t.ngay ? `nghỉ từ ${ngayVn(t.ngay)}` : 'đã nghỉ'}</Tag>
    case 'sap_nghi':
      return <Tag tone="warn">làm tới {ngayVn(t.ngay)}</Tag>
    case 'chua_vao':
      return <Tag tone="run">vào {ngayVn(t.ngay)}</Tag>
    case 'vang':
      return (
        <span
          title={
            t.quetCuoi
              ? `Không quẹt ${t.ngay} ngày có dữ liệu liên tiếp; quẹt cuối ${ngayVn(t.quetCuoi)}`
              : `Không quẹt trong ${t.ngay} ngày có dữ liệu gần nhất`
          }
        >
          <Tag tone="warn">vắng {t.ngay} ngày</Tag>
        </span>
      )
    case 'moi':
      return <Tag tone="run">mới · {t.ngay} ngày</Tag>
    case 'dang_lam':
      return <span className="text-k-sm text-[var(--ink-3)]">đang làm</span>
  }
}
