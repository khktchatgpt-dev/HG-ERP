'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/Badge'
import { Spinner } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import { noHoanUng } from '@/lib/mua-san'
import type { ChoHoanUngRow } from '@/modules/dept/accounting/payables.repo'

/*
  CHỜ HOÀN ỨNG (0279, bản vẽ "Đơn mua trên sàn" khung 5, duyệt 27/10/2026).

  Nhân viên Cung ứng ứng tiền riêng khi "Đặt trên sàn" → phiếu chi mang người ứng.
  Khối này gom theo người: công ty còn nợ ai bao nhiêu, phiếu nào. Phiếu sàn hoàn về
  chính người đó nằm ngay dưới và TRỪ vào số phải hoàn (`noHoanUng` — cùng hàm đếm ô
  "Chờ hoàn ứng" ở dải số). Một nút mỗi người: đóng dấu mọi phiếu của họ trong cùng
  loại tiền, vì công ty trả họ một lần phần ròng.

  Màn này còn theme v3 (sửa tại chỗ) — khối viết bằng lớp token của hệ cũ.
*/

const fmtM = (n: number) => n.toLocaleString('vi-VN')
const fmtD = (d: string) => d.split('-').reverse().join('/')

export function ChoHoanUng({
  rows,
  canManage,
}: {
  rows: ChoHoanUngRow[]
  canManage: boolean
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const no = noHoanUng(rows)

  async function hoan(userId: string, currency: string, name: string, amount: number) {
    const ids = rows
      .filter((r) => r.paid_by_user_id === userId && r.currency === currency)
      .map((r) => r.id)
    setBusy(`${userId}|${currency}`)
    try {
      for (const id of ids)
        await api(`/api/dept/accounting/payments/${id}/reimburse`, { method: 'POST' })
      toast.success('Đã hoàn ứng', `${name} · ${fmtM(amount)} ${currency}`)
      router.refresh()
    } catch (e) {
      toast.error('Không ghi được hoàn ứng', e instanceof ApiError ? e.message : 'Lỗi')
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  return (
    <section className="bg-card mb-4 rounded-md border">
      <div className="flex flex-wrap items-baseline gap-2 border-b px-3 py-2">
        <h3 className="text-sm font-semibold">
          Nhân viên ứng tiền mua sàn — chờ hoàn ứng
        </h3>
        <span className="text-muted-foreground ml-auto text-xs">
          Phiếu chi có người trả hộ mà chưa hoàn · phiếu sàn hoàn về chính người đó trừ
          vào
        </span>
      </div>
      {no.length === 0 ? (
        <p className="text-muted-foreground px-3 py-3 text-sm">
          Không ai đang chờ hoàn ứng — phiếu do nhân viên trả hộ khi &ldquo;Đặt trên
          sàn&rdquo; sẽ hiện ở đây.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted text-muted-foreground text-xs">
              <tr>
                <th className="px-3 py-1.5 text-left font-semibold">Nhân viên</th>
                <th className="px-3 py-1.5 text-left font-semibold">Đơn</th>
                <th className="px-3 py-1.5 text-left font-semibold">Shop · mã đơn sàn</th>
                <th className="px-3 py-1.5 text-left font-semibold">Ngày trả</th>
                <th className="px-3 py-1.5 text-left font-semibold">Loại</th>
                <th className="px-3 py-1.5 text-right font-semibold">Số tiền</th>
                <th className="px-3 py-1.5 text-right font-semibold">Còn phải hoàn</th>
                <th className="px-3 py-1.5" />
              </tr>
            </thead>
            <tbody>
              {no.map((n) => {
                const mine = rows.filter(
                  (r) => r.paid_by_user_id === n.user_id && r.currency === n.currency,
                )
                const key = `${n.user_id}|${n.currency}`
                return mine.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`border-t ${r.kind === 'refund' ? 'text-muted-foreground text-xs' : ''}`}
                  >
                    <td className="px-3 py-1.5 whitespace-nowrap">
                      {i === 0 ? (
                        <b>{r.payer_name}</b>
                      ) : r.kind === 'refund' ? (
                        '↳ sàn hoàn về'
                      ) : (
                        ''
                      )}
                    </td>
                    <td className="t-data px-3 py-1.5 text-xs whitespace-nowrap text-[var(--primary)]">
                      {r.po_id ? (
                        <a href={`/mua-hang/don/${r.po_id}`}>{r.po_code}</a>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      {r.kind === 'refund'
                        ? (r.note ?? '')
                        : [r.shop, r.doc_no].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="t-data px-3 py-1.5 whitespace-nowrap">
                      {fmtD(r.paid_on)}
                    </td>
                    <td className="px-3 py-1.5">
                      {r.kind === 'refund' ? (
                        <Badge tone="green">Hoàn tiền</Badge>
                      ) : (
                        'Trả tiền'
                      )}
                    </td>
                    <td
                      className={`t-data px-3 py-1.5 text-right tabular-nums ${r.kind === 'refund' ? 'text-[var(--done)]' : ''}`}
                    >
                      {r.kind === 'refund' ? `−${fmtM(r.amount)}` : fmtM(r.amount)}
                    </td>
                    <td className="t-data px-3 py-1.5 text-right font-semibold tabular-nums">
                      {i === 0 ? `${fmtM(n.amount)} ${n.currency}` : ''}
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {i === 0 && canManage && (
                        <button
                          type="button"
                          disabled={busy != null}
                          onClick={() =>
                            void hoan(n.user_id, n.currency, r.payer_name, n.amount)
                          }
                          className="inline-flex items-center gap-1.5 rounded-md bg-[var(--primary)] px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {busy === key && <Spinner size={12} />} Đã hoàn ứng
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              })}
            </tbody>
            <tfoot className="bg-muted text-sm font-semibold">
              <tr className="border-t">
                <td className="px-3 py-1.5" colSpan={6}>
                  Cộng {new Set(no.map((n) => n.user_id)).size} người · chưa gồm phiếu đã
                  hoàn ứng
                </td>
                <td className="t-data px-3 py-1.5 text-right tabular-nums">
                  {[...new Set(no.map((n) => n.currency))]
                    .map(
                      (c) =>
                        `${fmtM(no.filter((n) => n.currency === c).reduce((t, n) => t + n.amount, 0))} ${c}`,
                    ) // prettier-ignore
                    .join(' · ')}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}
