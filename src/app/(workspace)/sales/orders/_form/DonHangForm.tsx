'use client'

import { Save, X } from 'lucide-react'
import { TopProgressBar } from '@/components/erp/Spinner'
import { ErpHeader, ErpPage, ToolBtn } from '../../_erp/ui'
import { BTN_PRI, BTN_SUB, fmtMoney } from './don-form.shared'
import { KhoiDauDon } from './khoi-dau-don'
import { KhoiDieuKhoan } from './khoi-dieu-khoan'
import { KhoiLuoiDong } from './khoi-luoi-dong'
import { useDonHangForm, type DonHangFormProps } from './useDonHangForm'

/**
 * Form tạo / sửa đơn bán — khuôn F (Bảng nhập liệu, 07/10/2026): dải đầu đơn ·
 * lưới dòng là nhân vật chính (Enter xuống dòng, dán từ Excel, áp tuần giao
 * hàng loạt) · điều khoản gấp được · thanh chốt đáy nói vì sao chưa lưu được
 * bằng câu BẤM ĐƯỢC (nhảy tới ô thiếu).
 */
export function DonHangForm(props: DonHangFormProps) {
  const d = useDonHangForm(props)
  const edit = d.mode === 'edit'
  const back = edit ? `/sales/orders/${d.order!.id}` : '/sales/orders'
  return (
    <ErpPage>
      <TopProgressBar active={d.busy} />
      <ErpHeader
        crumb={[
          { label: 'Bán hàng', href: '/sales' },
          { label: 'Đơn hàng', href: '/sales/orders' },
          ...(edit ? [{ label: d.order!.code, href: back }] : []),
        ]}
        title={edit ? `Sửa đơn ${d.order!.code}` : 'Tạo đơn hàng'}
        sub={
          edit
            ? 'Lưu là ghi lịch sử thay đổi; dòng đã xuất không bỏ / không giảm dưới số đã xuất.'
            : 'Chọn SP hoặc dán cột từ sổ order; Enter nhảy xuống dòng cùng cột.'
        }
        actions={
          <>
            <ToolBtn href={back} icon={X}>
              Huỷ
            </ToolBtn>
            <ToolBtn onClick={d.submit} icon={Save} primary>
              {edit ? 'Lưu thay đổi' : 'Tạo đơn'}
            </ToolBtn>
          </>
        }
      />
      <KhoiDauDon d={d} />
      <KhoiLuoiDong d={d} />
      <KhoiDieuKhoan d={d} />
      <CommitBar d={d} />
    </ErpPage>
  )
}

/** Thanh chốt đáy: tổng · còn thiếu gì (bấm nhảy tới ô) · nút lưu. */
function CommitBar({ d }: { d: ReturnType<typeof useDonHangForm> }) {
  const edit = d.mode === 'edit'
  const go = (id?: string) => {
    if (!id) return
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ block: 'center' })
    ;(el as HTMLElement).focus()
  }
  return (
    <div className="border-border bg-card sticky bottom-0 z-20 flex flex-wrap items-center gap-3 border-t px-6 py-2">
      <span className="text-[13px]">
        <span className="text-muted-foreground">Tổng</span>{' '}
        <span className="font-mono font-semibold tabular-nums">
          {fmtMoney(d.tong.value)} {d.currency}
        </span>
        <span className="text-muted-foreground"> · {d.lines.length} dòng</span>
      </span>
      <span className="bg-border h-4 w-px" />
      {d.invalid ? (
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <span className="text-[var(--stop)]">Chưa lưu được — còn thiếu:</span>
          {d.missing.map((m, i) => (
            <button
              key={i}
              type="button"
              className="underline decoration-dotted underline-offset-2 hover:text-[var(--primary)]"
              onClick={() => go(m.focus)}
            >
              {m.msg}
            </button>
          ))}
        </span>
      ) : (
        <span className="text-[13px] text-[var(--done)]">
          Đủ điều kiện lưu{edit ? ' — sẽ ghi lịch sử thay đổi' : ''}
        </span>
      )}
      <span className="flex-1" />
      <a
        href={edit ? `/sales/orders/${d.order!.id}` : '/sales/orders'}
        className={BTN_SUB}
      >
        Huỷ
      </a>
      <button
        type="button"
        className={BTN_PRI}
        disabled={d.busy || d.invalid}
        onClick={d.submit}
      >
        <Save className="size-4" strokeWidth={1.8} />
        {d.busy ? 'Đang lưu…' : edit ? 'Lưu thay đổi' : 'Tạo đơn hàng'}
      </button>
    </div>
  )
}
