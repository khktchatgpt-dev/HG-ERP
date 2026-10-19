import { Tag } from '@/components/kit'
import { cn } from '@/lib/utils'
import { ngayVn } from '@/lib/nhan-su/bien-dong'
import {
  chuDau,
  khoiCua,
  nhanTinhTrang,
  SO_MUC_HO_SO,
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

/** Thuộc tính, không phải vấn đề: viền, không nền. */
export function TagKhongCham() {
  return (
    <span className="text-k-label inline-flex h-[19px] items-center rounded-[var(--radius-sm)] border border-[var(--line)] px-1.5 whitespace-nowrap text-[var(--ink-2)]">
      không chấm công
    </span>
  )
}

/** Thanh hồ sơ (Q4): xám khi còn thiếu, xanh lá chỉ khi đủ. */
export function ThanhHoSo({ thieu }: { thieu: number }) {
  const co = SO_MUC_HO_SO - thieu
  const du = thieu === 0
  return (
    <span
      className="inline-flex items-center gap-1.5"
      title={du ? 'Đủ các mục đang theo dõi' : `Còn thiếu ${thieu} mục`}
    >
      <span className="relative h-[5px] w-12 bg-[var(--track)]">
        <span
          className={cn(
            'absolute inset-y-0 left-0',
            du ? 'bg-[var(--done)]' : 'bg-[var(--fill)]',
          )}
          style={{ width: `${(co / SO_MUC_HO_SO) * 100}%` }}
        />
      </span>
      <span className={cn('num', du && 'text-[var(--done)]')}>
        {co}/{SO_MUC_HO_SO}
      </span>
    </span>
  )
}
