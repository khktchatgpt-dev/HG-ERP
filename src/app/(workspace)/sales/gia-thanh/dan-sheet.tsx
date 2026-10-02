'use client'

import { useMemo, useState } from 'react'
import { Consequence, Pick, Sheet, SheetActions, TextArea } from '@/components/kit'
import { guessDecimalSep, type DecimalSep } from '@/lib/price-paste'
import {
  matchPlanRows,
  parsePlanBlock,
  parsePlanPaste,
  planCheck,
  type BreakdownItem,
  type PlanCost,
  type PlanTarget,
} from '@/lib/plan-cost'

export type PasteApply = {
  product_id: string
  plan: PlanCost
  breakdown?: BreakdownItem[]
  /** Dòng nào trong khối dán — để bày "khối dán · dòng N". */
  from_line: number
}

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

/**
 * HỘP DÁN — hai kiểu, cùng một luật: dán chỉ ĐIỀN vào bảng, chưa lưu.
 *
 * `table`: bảng 5 cột nhiều SP (mã · trực tiếp · chi phí chung · lợi nhuận ·
 * FOB) — Sale thêm cột mã vào file rồi bôi. `block`: chép nguyên MỘT cột chi
 * phí của một SP trong bảng tính (nhôm, công, …, Total) — giữ được chi tiết
 * từng khoản để bước 4 so với đơn mua.
 */
export function DanSheet({
  mode,
  product,
  targets,
  currency,
  onClose,
  onApply,
}: {
  mode: 'table' | 'block'
  /** Kiểu `block`: SP đang nhận khối. */
  product: { product_id: string; code: string; name: string } | null
  targets: PlanTarget[]
  currency: string
  onClose: () => void
  onApply: (rows: PasteApply[]) => void
}) {
  const [text, setText] = useState('')
  const [sepPick, setSepPick] = useState<'auto' | DecimalSep>('auto')
  const sep: DecimalSep = sepPick === 'auto' ? guessDecimalSep(text) : sepPick

  const table = useMemo(() => {
    if (mode !== 'table' || !text.trim()) return null
    const parsed = parsePlanPaste(text, sep)
    const match = matchPlanRows(targets, parsed.rows)
    const bad = match.matched.filter((m) => !planCheck(m.row.plan, currency).ok)
    return { parsed, match, bad }
  }, [mode, text, sep, targets, currency])

  const block = useMemo(() => {
    if (mode !== 'block' || !text.trim()) return null
    return parsePlanBlock(text, sep)
  }, [mode, text, sep])

  const canApply =
    mode === 'table' ? !!table && table.match.matched.length > 0 : !!block && !!product

  function apply(): void {
    if (mode === 'table' && table) {
      onApply(
        table.match.matched.map((m) => ({
          product_id: m.target.product_id,
          plan: m.row.plan,
          from_line: m.row.line,
        })),
      )
    } else if (mode === 'block' && block && product) {
      onApply([{ product_id: product.product_id, plan: block.plan, breakdown: block.breakdown, from_line: 0 }]) // prettier-ignore
    }
    onClose()
  }

  return (
    <Sheet
      open
      onClose={onClose}
      width={760}
      stakes="nhe"
      title={
        mode === 'table'
          ? 'Dán bốn số từ bảng tính giá'
          : `Dán khối chi phí của ${product?.code ?? ''}`
      }
      subtitle={
        mode === 'table'
          ? 'Bôi trong Excel: mã (HG hoặc mã khách) · trực tiếp · chi phí chung · lợi nhuận · giá FOB. Trực tiếp để trống thì máy suy = FOB − chung − lợi nhuận.'
          : 'Chép nguyên cột chi phí của SP trong bảng tính (nhôm, tiền công, …, chi phí chung, Lợi nhuận, Total). Mỗi dòng trước "chi phí chung" là một khoản trực tiếp và được giữ lại để soi.'
      }
      footer={
        <SheetActions
          disabled={!canApply}
          onCancel={onClose}
          cancelLabel="Thôi"
          confirmLabel={
            mode === 'table'
              ? `Điền ${table?.match.matched.length ?? 0} dòng vào bảng`
              : 'Điền vào bảng'
          }
          onConfirm={apply}
        />
      }
    >
      <Consequence>
        Dán chỉ điền vào ô trên màn hình. Anh/chị soát lại rồi mới bấm Lưu ở thanh dưới —
        số cũ của SP chưa đổi cho tới lúc đó.
      </Consequence>
      <div className="mt-3 flex items-center gap-3">
        <Pick
          label="Dấu thập phân"
          width={190}
          value={sepPick}
          onChange={(v) => setSepPick(v as 'auto' | DecimalSep)}
          options={[
            {
              value: 'auto',
              label: `Dấu thập phân: đoán (${sep === '.' ? 'chấm' : 'phẩy'})`,
            },
            { value: '.', label: 'Dấu chấm (144.00)' },
            { value: ',', label: 'Dấu phẩy (144,00)' },
          ]}
        />
        <span className="text-k-sm text-[var(--ink-3)]">
          Tiền tệ của lần lưu này: {currency}
        </span>
      </div>
      <div className="mt-2">
        <TextArea
          value={text}
          onChange={setText}
          rows={8}
          maxRows={16}
          placeholder={
            mode === 'table'
              ? 'Halston Corner\t144.00\t28.80\t15.55\t188.34\n21604-217\t\t13.14\t4.73\t83.58'
              : 'nhôm\t$18.48\ntiền công\t$4.86\n…\nchi phí chung\t$4.45\nLợi nhuận\t$3.43\nTotal\t$52.40'
          }
        />
      </div>

      {table && (
        <div className="text-k-sm mt-3 space-y-1">
          <p>
            Khớp <b>{table.match.matched.length}</b> dòng
            {table.match.unmatched.length > 0 && (
              <>
                {' '}
                · <b>{table.match.unmatched.length}</b> không khớp mã nào:{' '}
                {table.match.unmatched
                  .slice(0, 5)
                  .map((u) => `dòng ${u.line} “${u.code}”`)
                  .join(', ')}
                {table.match.unmatched.length > 5 ? '…' : ''} — file ghi tên, không ghi
                mã? Thêm cột mã HG hoặc mã khách rồi dán lại.
              </>
            )}
          </p>
          {table.match.ambiguous.length > 0 && (
            <p className="text-[var(--warn)]">
              {table.match.ambiguous.length} dòng có mã khách gắn với nhiều SP HG (
              {table.match.ambiguous[0].codes.join(' / ')}…) — ghi mã HG để không gán
              nhầm.
            </p>
          )}
          {table.parsed.errors.length > 0 && (
            <p className="text-[var(--stop)]">
              {table.parsed.errors.length} dòng đọc không được:{' '}
              {table.parsed.errors
                .slice(0, 4)
                .map((e) => `dòng ${e.line} (${e.reason})`)
                .join(', ')}
            </p>
          )}
          {table.bad.length > 0 && (
            <p className="text-[var(--warn)]">
              {table.bad.length} dòng có trực tiếp + chung + lợi nhuận ≠ FOB — vẫn điền,
              nhưng phải sửa trước khi lưu.
            </p>
          )}
        </div>
      )}

      {mode === 'block' && text.trim() && (
        <div className="text-k-sm mt-3">
          {!block ? (
            <p className="text-[var(--stop)]">
              Chưa thấy đủ ba dòng “chi phí chung”, “Lợi nhuận”, “Total” — chép thiếu phần
              đuôi của cột?
            </p>
          ) : (
            <>
              <p>
                Trực tiếp <b className="num">{fmt(block.plan.direct)}</b> (
                {block.breakdown.length} khoản) · chi phí chung{' '}
                <b className="num">{fmt(block.plan.overhead)}</b> · lợi nhuận{' '}
                <b className="num">{fmt(block.plan.profit)}</b> · FOB{' '}
                <b className="num">{fmt(block.plan.price)}</b>
                {block.old_price != null && (
                  <span className="text-[var(--ink-3)]">
                    {' '}
                    · giá cũ trong file {fmt(block.old_price)}
                  </span>
                )}
              </p>
              <p className="text-[var(--ink-3)]">
                {block.breakdown.map((b) => `${b.label} ${fmt(b.amount)}`).join(' · ')}
              </p>
              {!planCheck(block.plan, currency).ok && (
                <p className="text-[var(--warn)]">
                  Tổng các khoản ≠ Total (lệch {fmt(planCheck(block.plan, currency).diff)}
                  ) — có dòng trực tiếp bị thiếu khi chép?
                </p>
              )}
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
