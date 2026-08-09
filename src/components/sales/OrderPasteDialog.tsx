'use client'

import { useMemo, useState } from 'react'
import { Modal } from '@/components/Modal'
import { Badge } from '@/components/Badge'
import { parseOrderPaste, type OrderPasteRow, type PasteProduct } from '@/lib/order-paste'

/**
 * DÁN DÒNG ĐƠN TỪ EXCEL — mở từ form đơn hàng.
 *
 * Có vì 71/71 dòng của 20 đơn đầu tiên vào hệ thống với giá 0: chúng được nạp từ
 * file LỆNH SẢN XUẤT, mà file lệnh không mang giá bán. Gõ tay lại 71 dòng thì
 * chậm và dễ lệch một chữ số; dán thẳng từ file của Sale thì không.
 *
 * Hai chế độ áp:
 *   • Bù giá  — chỉ ghi đè ĐƠN GIÁ (và SL nếu vùng dán có) lên dòng ĐÃ CÓ.
 *   • Thêm dòng — dòng nào chưa có trong đơn thì thêm mới.
 * Mặc định bật cả hai; người dùng tắt "thêm dòng" khi chỉ muốn bù giá cho đơn cũ.
 *
 * KHÔNG tự ghi DB: chỉ điền vào lưới, người dùng xem rồi bấm Lưu đơn như thường.
 */

export type ApplyRow = {
  product_id: string
  qty: number | null
  unit_price: number | null
  note: string | null
}

export function OrderPasteDialog({
  open,
  onClose,
  products,
  existingIds,
  currency,
  onApply,
}: {
  open: boolean
  onClose: () => void
  products: PasteProduct[]
  /** SP đã có dòng trong đơn — để phân biệt "bù giá" với "thêm dòng". */
  existingIds: Set<string>
  currency: string
  onApply: (rows: ApplyRow[], mode: { update: boolean; add: boolean }) => void
}) {
  const [text, setText] = useState('')
  const [doUpdate, setDoUpdate] = useState(true)
  const [doAdd, setDoAdd] = useState(true)

  const result = useMemo(
    () => (text.trim() ? parseOrderPaste(text, products) : null),
    [text, products],
  )

  const matched = result?.rows.filter((r) => r.product_id) ?? []
  const unmatched = result?.rows.filter((r) => !r.product_id) ?? []
  const willUpdate = matched.filter((r) => existingIds.has(r.product_id!))
  const willAdd = matched.filter((r) => !existingIds.has(r.product_id!))
  const applyCount = (doUpdate ? willUpdate.length : 0) + (doAdd ? willAdd.length : 0)

  function apply() {
    const rows: ApplyRow[] = matched
      .filter((r) => (existingIds.has(r.product_id!) ? doUpdate : doAdd))
      .map((r) => ({
        product_id: r.product_id!,
        qty: r.qty,
        unit_price: r.unit_price,
        note: r.note,
      }))
    onApply(rows, { update: doUpdate, add: doAdd })
    setText('')
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dán dòng đơn từ Excel"
      maxWidth="sm:max-w-3xl"
    >
      <div className="flex flex-col gap-3 text-sm">
        <p className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          Bôi vùng ô trong Excel (kèm dòng tiêu đề nếu có) rồi dán vào đây. Nhận cột theo
          tiêu đề: <b>Mã SP / Item code</b>, <b>SL / Qty</b>, <b>Đơn giá / Unit price</b>,{' '}
          <b>Ghi chú</b>. Không có tiêu đề thì cột chữ đầu tiên là mã, các cột số sau là
          SL rồi đơn giá — một cột số duy nhất được hiểu là <b>đơn giá</b>. Cột{' '}
          <i>Thành tiền</i> bị bỏ qua vì hệ thống tự nhân lại.
        </p>

        <textarea
          rows={6}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Item code\tQty\tUnit price\nPT-138-155\t120\t45.90'}
          className="w-full rounded-md border border-zinc-300 px-2 py-1.5 font-mono text-xs focus:border-sky-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
        />

        {result && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge tone={result.source === 'header' ? 'green' : 'amber'}>
                {result.source === 'header' ? 'Nhận cột theo tiêu đề' : 'Đoán cột'}
              </Badge>
              {result.mapped.map((m) => (
                <span key={m.index} className="text-zinc-500">
                  cột {m.index + 1} → <b>{m.label}</b>
                </span>
              ))}
            </div>

            <div className="max-h-64 overflow-auto rounded-md border border-zinc-200 dark:border-zinc-800">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-zinc-50 text-left dark:bg-zinc-900">
                  <tr>
                    <th className="px-2 py-1.5">Mã trên file</th>
                    <th className="px-2 py-1.5">Khớp sản phẩm</th>
                    <th className="px-2 py-1.5 text-right">SL</th>
                    <th className="px-2 py-1.5 text-right">Đơn giá ({currency})</th>
                    <th className="px-2 py-1.5">Việc sẽ làm</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((r: OrderPasteRow) => {
                    const isUpdate = r.product_id && existingIds.has(r.product_id)
                    return (
                      <tr
                        key={r.line}
                        className="border-t border-zinc-100 dark:border-zinc-900"
                      >
                        <td className="px-2 py-1 font-mono">{r.raw_key}</td>
                        <td className="px-2 py-1">
                          {r.product_label ?? (
                            <span className="text-red-600 dark:text-red-400">
                              {r.ambiguous ? 'trùng nhiều SP' : 'không tìm thấy'}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {r.qty ?? '—'}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums">
                          {r.unit_price?.toLocaleString('en-US') ?? '—'}
                        </td>
                        <td className="px-2 py-1">
                          {!r.product_id ? (
                            <span className="text-zinc-400">bỏ qua</span>
                          ) : isUpdate ? (
                            <Badge tone={doUpdate ? 'blue' : 'gray'}>bù giá</Badge>
                          ) : (
                            <Badge tone={doAdd ? 'green' : 'gray'}>thêm dòng</Badge>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {result.skipped.length > 0 && (
              <p className="text-[11px] text-zinc-500">
                Bỏ {result.skipped.length} dòng:{' '}
                {result.skipped
                  .slice(0, 4)
                  .map((s) => `dòng ${s.line} (${s.reason})`)
                  .join(' · ')}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs">
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={doUpdate}
                  onChange={(e) => setDoUpdate(e.target.checked)}
                />
                Bù giá cho dòng đã có ({willUpdate.length})
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={doAdd}
                  onChange={(e) => setDoAdd(e.target.checked)}
                />
                Thêm dòng mới ({willAdd.length})
              </label>
              {unmatched.length > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  {unmatched.length} dòng không khớp SP — sẽ bỏ qua
                </span>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Huỷ
          </button>
          <button
            type="button"
            disabled={applyCount === 0}
            onClick={apply}
            className="rounded-md bg-sky-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
          >
            Điền {applyCount} dòng vào đơn
          </button>
        </div>
      </div>
    </Modal>
  )
}
