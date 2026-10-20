'use client'

import { Nhan, Seg } from '../_erp/ui'
import { BTN_PRI, BTN_SUB, INPUT } from '../orders/_form/don-form.shared'
import { planCheck } from '@/lib/plan-cost'
import type { GiaThanhCtx } from './useGiaThanh'

const NUM = 'text-right font-mono tabular-nums whitespace-nowrap'
const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

/**
 * NGĂN DÁN tại chỗ (thay hộp Sheet cũ) — hai kiểu, cùng một luật: dán chỉ ĐIỀN
 * vào bảng, chưa lưu.
 *
 * `table`: bảng 5 cột nhiều SP (mã · trực tiếp · chi phí chung · lợi nhuận ·
 * FOB) — Sale thêm cột mã vào file rồi bôi. `block`: chép nguyên MỘT cột chi
 * phí của một SP trong bảng tính (nhôm, công, …, Total) — giữ chi tiết từng
 * khoản để sau này so với đơn mua.
 */
export function KhoiDan({ d }: { d: GiaThanhCtx }) {
  const p = d.paste
  if (!p) return null
  const isTable = p.kind === 'table'
  const t = d.table
  const b = d.block
  return (
    <div className="border-border border-b bg-[var(--accent)]/40 px-6 py-3">
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="text-[13px]">
            {isTable ? (
              <>
                Bôi trong Excel 5 cột{' '}
                <b>mã · trực tiếp · chi phí chung · lợi nhuận · FOB</b> (mã HG hoặc mã
                khách) rồi dán. Trực tiếp để trống thì máy suy = FOB − chung − lợi nhuận.
              </>
            ) : (
              <>
                Dán khối chi phí của <b className="font-mono">{p.row.code}</b> ·{' '}
                {p.row.name}: chép nguyên cột trong bảng tính (nhôm, tiền công, …, chi phí
                chung, Lợi nhuận, Total). Mỗi dòng trước “chi phí chung” là một khoản trực
                tiếp, được giữ lại để soi.
              </>
            )}{' '}
            Số chỉ điền vào ô — bạn soát rồi mới Lưu.
          </p>
          <textarea
            className={`${INPUT} h-28 resize-y font-mono text-xs`}
            value={d.pasteText}
            onChange={(e) => d.setPasteInput(e.target.value)}
            placeholder={
              isTable
                ? 'Halston Corner\t144.00\t28.80\t15.55\t188.34\n21604-217\t\t13.14\t4.73\t83.58'
                : 'nhôm\t$18.48\ntiền công\t$4.86\n…\nchi phí chung\t$4.45\nLợi nhuận\t$3.43\nTotal\t$52.40'
            }
            autoFocus
          />
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-muted-foreground text-xs">Dấu thập phân</span>
            <Seg
              label=""
              value={d.pasteSep}
              onChange={(v) => d.choosePasteSep(v)}
              options={[
                { value: '.', label: '1,234.56 (chấm)' },
                { value: ',', label: '1.234,56 (phẩy)' },
              ]}
            />
            <span className="text-muted-foreground text-xs">
              Tiền tệ của lần lưu này: <b>{d.currency}</b>
            </span>
            <span className="flex-1" />
            <button type="button" className={BTN_SUB} onClick={d.closePaste}>
              Đóng
            </button>
            <button
              type="button"
              className={BTN_PRI}
              disabled={!d.canApply}
              onClick={d.applyPaste}
            >
              {isTable
                ? `Điền ${t?.match.matched.length ?? 0} dòng vào bảng`
                : 'Điền vào bảng'}
            </button>
          </div>
        </div>

        {d.pasteText.trim() !== '' && (
          <div className="border-border bg-card max-h-64 w-[480px] shrink-0 overflow-auto rounded-sm border p-2 text-xs">
            {isTable && t && (
              <>
                <p className="mb-1">
                  Khớp <b>{t.match.matched.length}</b> dòng
                  {t.bad.length > 0 && (
                    <span className="text-[var(--warn)]">
                      {' '}
                      · {t.bad.length} dòng tổng ≠ FOB (vẫn điền, phải sửa trước khi lưu)
                    </span>
                  )}
                </p>
                {t.match.matched.length > 0 && (
                  <table className="w-full">
                    <tbody>
                      {t.match.matched.slice(0, 30).map((m) => {
                        const r = d.byId.get(m.target.product_id)!
                        const ok = planCheck(m.row.plan, d.currency).ok
                        return (
                          <tr
                            key={m.target.product_id}
                            className="border-border border-t"
                          >
                            <td className="py-0.5 pr-2 font-mono">{r.code}</td>
                            <td className={`py-0.5 ${NUM}`}>
                              {fmt(m.row.plan.direct)}
                              {m.row.derived_direct ? '*' : ''} +{' '}
                              {fmt(m.row.plan.overhead)} + {fmt(m.row.plan.profit)} ={' '}
                              <b className={ok ? '' : 'text-[var(--stop)]'}>
                                {fmt(m.row.plan.price)}
                              </b>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
                {t.match.matched.some((m) => m.row.derived_direct) && (
                  <p className="text-muted-foreground mt-1">
                    * trực tiếp suy từ FOB − chung − lợi nhuận
                  </p>
                )}
                {t.match.matched.length > 30 && (
                  <p className="text-muted-foreground">
                    … và {t.match.matched.length - 30} dòng nữa
                  </p>
                )}
                {t.match.ambiguous.length > 0 && (
                  <p className="mt-1 text-[var(--warn)]">
                    <Nhan tone="warn">{t.match.ambiguous.length} dòng không rõ SP</Nhan>{' '}
                    mã khách gắn với nhiều SP HG — ghi mã HG:{' '}
                    {t.match.ambiguous
                      .slice(0, 3)
                      .map((a) => `dòng ${a.row.line} (${a.codes.join(' / ')})`)
                      .join(' · ')}
                  </p>
                )}
                {t.match.unmatched.length > 0 && (
                  <p className="text-muted-foreground mt-1">
                    {t.match.unmatched.length} dòng không khớp mã nào:{' '}
                    {t.match.unmatched
                      .slice(0, 5)
                      .map((u) => `dòng ${u.line} “${u.code}”`)
                      .join(', ')}
                    {t.match.unmatched.length > 5 ? '…' : ''} — file ghi tên, không ghi
                    mã?
                  </p>
                )}
                {t.parsed.errors.length > 0 && (
                  <p className="mt-1 text-[var(--stop)]">
                    {t.parsed.errors.length} dòng đọc không được:{' '}
                    {t.parsed.errors
                      .slice(0, 4)
                      .map((e) => `dòng ${e.line} (${e.reason})`)
                      .join(', ')}
                  </p>
                )}
              </>
            )}
            {!isTable &&
              (!b ? (
                <p className="text-[var(--stop)]">
                  Chưa thấy đủ ba dòng “chi phí chung”, “Lợi nhuận”, “Total” — chép thiếu
                  phần đuôi của cột?
                </p>
              ) : (
                <>
                  <p>
                    Trực tiếp <b className="font-mono">{fmt(b.plan.direct)}</b> (
                    {b.breakdown.length} khoản) · chung{' '}
                    <b className="font-mono">{fmt(b.plan.overhead)}</b> · lợi nhuận{' '}
                    <b className="font-mono">{fmt(b.plan.profit)}</b> · FOB{' '}
                    <b className="font-mono">{fmt(b.plan.price)}</b>
                    {b.old_price != null && (
                      <span className="text-muted-foreground">
                        {' '}
                        · giá cũ trong file {fmt(b.old_price)}
                      </span>
                    )}
                  </p>
                  <table className="mt-1 w-full">
                    <tbody>
                      {b.breakdown.map((x, i) => (
                        <tr key={i} className="border-border border-t">
                          <td className="py-0.5 pr-2">{x.label}</td>
                          <td className={`py-0.5 ${NUM}`}>{fmt(x.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!planCheck(b.plan, d.currency).ok && (
                    <p className="mt-1 text-[var(--warn)]">
                      Tổng các khoản ≠ Total (lệch{' '}
                      {fmt(planCheck(b.plan, d.currency).diff)}) — có dòng trực tiếp bị
                      thiếu khi chép?
                    </p>
                  )}
                </>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
