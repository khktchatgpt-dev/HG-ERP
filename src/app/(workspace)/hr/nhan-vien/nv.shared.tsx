import { Tag } from '@/components/kit'
import { ngayVn, tinhTrangLam } from '@/lib/nhan-su/bien-dong'
import { chuDau } from '@/lib/nhan-su/ho-so'

export const TH =
  'sticky top-0 z-[1] border-b border-[var(--line)] bg-[var(--surface-raised)] px-2.5 py-1.5 text-left font-semibold text-[var(--ink-2)] whitespace-nowrap'
export const TD = 'border-b border-[var(--line-faint)] px-2.5 py-1.5 whitespace-nowrap'

/** Ô ảnh: chưa có ảnh thì chữ cái đầu (bản vẽ lượt 2, Q3 — ảnh tải lên làm ở B2b). */
export function Avatar({ ten, lon = false }: { ten: string; lon?: boolean }) {
  return (
    <span
      aria-hidden
      className={
        lon
          ? 'text-k-body grid size-11 shrink-0 place-items-center rounded-full bg-[var(--act-wash)] font-semibold text-[var(--act-text)]'
          : 'text-k-label grid size-7 shrink-0 place-items-center rounded-full bg-[var(--act-wash)] font-semibold text-[var(--act-text)]'
      }
    >
      {chuDau(ten)}
    </span>
  )
}

/** Nhãn tình trạng suy từ ngày vào / ngày làm cuối (0248). */
export function TagTinhTrang({
  n,
  homNay,
}: {
  n: { ngayVao: string | null; ngayCuoi: string | null; active: boolean }
  homNay: string
}) {
  const t = n.active
    ? tinhTrangLam({ hireDate: n.ngayVao, leaveDate: n.ngayCuoi }, homNay)
    : 'da_nghi'
  if (t === 'da_nghi') return <Tag tone="neutral">đã nghỉ</Tag>
  if (t === 'sap_nghi') return <Tag tone="warn">làm tới {ngayVn(n.ngayCuoi)}</Tag>
  if (t === 'chua_vao') return <Tag tone="run">vào {ngayVn(n.ngayVao)}</Tag>
  return <Tag tone="done">đang làm</Tag>
}
