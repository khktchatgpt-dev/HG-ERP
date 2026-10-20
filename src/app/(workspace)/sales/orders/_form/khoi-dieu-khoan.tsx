'use client'

import { ChevronDown, ChevronRight, Paperclip, X } from 'lucide-react'
import { INPUT, O } from './don-form.shared'
import type { DonHangFormCtx } from './useDonHangForm'

/**
 * Điều khoản thương mại + ghi chú + lý do thay đổi + tệp đính kèm. Gấp được —
 * mở sẵn khi sửa đơn hoặc đã có điều khoản; tạo mới thì thường chỉ cần mồi từ
 * khách (server tự thừa kế ô trống khi lưu).
 */
export function KhoiDieuKhoan({ d }: { d: DonHangFormCtx }) {
  const t = d.terms
  return (
    <div className="border-border bg-card border-t">
      <button
        type="button"
        className="text-muted-foreground hover:text-foreground flex w-full items-center gap-1.5 px-6 py-1.5 text-left text-xs font-semibold tracking-wide uppercase"
        onClick={() => d.setTermsOpen(!d.termsOpen)}
      >
        {d.termsOpen ? (
          <ChevronDown className="size-3.5" strokeWidth={1.8} />
        ) : (
          <ChevronRight className="size-3.5" strokeWidth={1.8} />
        )}
        Điều khoản & ghi chú
        <span className="font-normal normal-case">
          ·{' '}
          {d.termsFilled
            ? `${d.termsFilled}/10 ô đã khai`
            : 'chưa khai — lưu sẽ thừa kế mặc định của khách'}
          {d.files.length > 0 && ` · ${d.files.length} tệp`}
        </span>
      </button>
      {(d.termsOpen || d.afterLsx) && (
        <div className="flex flex-wrap items-end gap-x-4 gap-y-2 px-6 pb-3">
          {d.afterLsx && (
            <O label="Lý do thay đổi * (đơn đã có lệnh SX)" htmlFor="f-change" w="w-full">
              <input
                id="f-change"
                className={`${INPUT} border-[var(--warn)]`}
                value={d.h.change_note}
                onChange={(e) => d.set('change_note', e.target.value)}
                placeholder="VD: khách đổi SL dòng 3 theo mail 05/10"
              />
            </O>
          )}
          {d.termsOpen && (
            <>
              <O label="Điều kiện giá" w="w-[120px]">
                <input
                  className={INPUT}
                  value={t.price_term}
                  onChange={(e) => d.setTerm('price_term', e.target.value)}
                  placeholder="FOB HCM"
                />
              </O>
              <O label="Thanh toán" w="w-[200px]">
                <input
                  className={INPUT}
                  value={t.payment_terms}
                  onChange={(e) => d.setTerm('payment_terms', e.target.value)}
                  placeholder="T/T 30% cọc, 70% trước giao"
                />
              </O>
              <O label="Cọc %" w="w-[70px]">
                <input
                  className={`${INPUT} text-right font-mono`}
                  value={t.deposit_percent}
                  onChange={(e) => d.setTerm('deposit_percent', e.target.value)}
                />
              </O>
              <O label="Dung sai SL %" w="w-[90px]">
                <input
                  className={`${INPUT} text-right font-mono`}
                  value={t.qty_tolerance_pct}
                  onChange={(e) => d.setTerm('qty_tolerance_pct', e.target.value)}
                />
              </O>
              <O label="Cảng đi" w="w-[130px]">
                <input
                  className={INPUT}
                  value={t.port_of_loading}
                  onChange={(e) => d.setTerm('port_of_loading', e.target.value)}
                />
              </O>
              <O label="Cảng đến" w="w-[130px]">
                <input
                  className={INPUT}
                  value={t.port_of_discharge}
                  onChange={(e) => d.setTerm('port_of_discharge', e.target.value)}
                />
              </O>
              <O label="Hình thức TT" w="w-[120px]">
                <input
                  className={INPUT}
                  value={t.payment_method}
                  onChange={(e) => d.setTerm('payment_method', e.target.value)}
                  placeholder="T/T · L/C"
                />
              </O>
              <O label="Chứng từ yêu cầu" w="w-[220px]">
                <input
                  className={INPUT}
                  value={t.required_docs}
                  onChange={(e) => d.setTerm('required_docs', e.target.value)}
                  placeholder="Invoice, Packing list, B/L, C/O"
                />
              </O>
              <O label="Giao từng phần" w="w-[120px]">
                <select
                  className={INPUT}
                  value={t.partial_shipment}
                  onChange={(e) => d.setTerm('partial_shipment', e.target.value)}
                >
                  <option value="">—</option>
                  <option value="true">Cho phép</option>
                  <option value="false">Không</option>
                </select>
              </O>
              <O label="Chuyển tải" w="w-[120px]">
                <select
                  className={INPUT}
                  value={t.transhipment}
                  onChange={(e) => d.setTerm('transhipment', e.target.value)}
                >
                  <option value="">—</option>
                  <option value="true">Cho phép</option>
                  <option value="false">Không</option>
                </select>
              </O>
              <O label="Ghi chú đơn" w="w-full">
                <textarea
                  className={`${INPUT} h-14 resize-y py-1`}
                  value={d.h.note}
                  onChange={(e) => d.set('note', e.target.value)}
                />
              </O>
              {d.mode === 'create' && (
                <O label="Tệp đính kèm (PO khách, mail xác nhận…)" w="w-full">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="border-border bg-card hover:bg-muted inline-flex h-7 cursor-pointer items-center gap-1 rounded-sm border px-2.5 text-[13px]">
                      <Paperclip className="size-3.5" strokeWidth={1.8} /> Chọn tệp
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => d.addFiles(e.target.files)}
                      />
                    </label>
                    {d.files.map((f, i) => (
                      <span
                        key={`${f.name}-${i}`}
                        className="bg-muted inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs"
                      >
                        {f.name}
                        <button
                          type="button"
                          onClick={() => d.removeFile(i)}
                          aria-label="Bỏ tệp"
                        >
                          <X className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </O>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
