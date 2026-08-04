'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PageHeader } from '@/components/erp/PageHeader'
import { Spinner, TopProgressBar } from '@/components/erp/Spinner'
import { api, ApiError } from '@/lib/api'
import { useToast } from '@/components/ui/Toast'
import {
  checkColumnsOf,
  colKey,
  hasCbm,
  specColumnsOf,
  type LsxTemplate,
} from '@/modules/dept/sales/lsx-template'
import type { LsxGroup, LsxLine } from '@/modules/dept/production/lsx-lines.repo'

/**
 * SOẠN DÒNG LỆNH SẢN XUẤT (0114) — màn thay file Excel của Sales.
 *
 * Cấu trúc bám đúng file thật: lệnh → NHÓM (số PO / bộ sưu tập / nơi gia công)
 * → DÒNG. Một mã SP được lặp nhiều dòng, mỗi dòng một số lượng và một đợt xuất
 * ("Tách đợt" nhân đôi dòng để khỏi gõ lại).
 *
 * Ô nhập dựng từ FORM CHUẨN dùng chung (`LSX_FORM`) — mọi khách cùng một bộ cột,
 * khách không dùng cột nào thì để trống chứ phiếu không đổi bảng.
 */

type EditLine = Partial<LsxLine> & { id?: string; _key: string }
type EditGroup = Partial<LsxGroup> & { id?: string; _key: string; lines: EditLine[] }

let seq = 0
const newKey = () => `k${++seq}`

const toEditLine = (l: LsxLine): EditLine => ({ ...l, _key: newKey() })

export function LsxSheetEditor({
  lsxId,
  lsxCode,
  customerName,
  revision,
  canEdit,
  template,
  groups: initial,
  backHref,
}: {
  lsxId: string
  lsxCode: string
  customerName: string
  revision: number
  canEdit: boolean
  template: LsxTemplate
  groups: (LsxGroup & { lines: LsxLine[] })[]
  backHref: string
}) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState('')
  const [groups, setGroups] = useState<EditGroup[]>(
    initial.map((g) => ({ ...g, _key: newKey(), lines: g.lines.map(toEditLine) })),
  )

  const specCols = specColumnsOf(template)
  const checkCols = checkColumnsOf(template)
  const showCbm = hasCbm(template)

  const totalQty = groups.reduce(
    (s, g) => s + g.lines.reduce((x, l) => x + Number(l.qty ?? 0), 0),
    0,
  )
  const totalCbm = groups.reduce(
    (s, g) =>
      s + g.lines.reduce((x, l) => x + Number(l.cbm ?? 0) * Number(l.qty ?? 0), 0),
    0,
  )

  function patchGroup(key: string, patch: Partial<EditGroup>) {
    setGroups((gs) => gs.map((g) => (g._key === key ? { ...g, ...patch } : g)))
  }
  function patchLine(gKey: string, lKey: string, patch: Partial<EditLine>) {
    setGroups((gs) =>
      gs.map((g) =>
        g._key === gKey
          ? {
              ...g,
              lines: g.lines.map((l) => (l._key === lKey ? { ...l, ...patch } : l)),
            }
          : g,
      ),
    )
  }
  function addLine(gKey: string, from?: EditLine) {
    setGroups((gs) =>
      gs.map((g) =>
        g._key === gKey
          ? {
              ...g,
              lines: [
                ...g.lines,
                // Tách đợt = chép dòng nhưng BỎ id (dòng mới) và bỏ số lượng cũ.
                from
                  ? { ...from, id: undefined, _key: newKey(), qty: 0 }
                  : { _key: newKey(), product_code: '', unit: '', qty: 0 },
              ],
            }
          : g,
      ),
    )
  }
  function removeLine(gKey: string, lKey: string) {
    setGroups((gs) =>
      gs.map((g) =>
        g._key === gKey ? { ...g, lines: g.lines.filter((l) => l._key !== lKey) } : g,
      ),
    )
  }

  async function save() {
    setBusy(true)
    try {
      const payload = {
        groups: groups.map((g, gi) => ({
          id: g.id,
          sales_order_id: g.sales_order_id ?? null,
          title: g.title ?? null,
          buyer_name: g.buyer_name ?? null,
          po_no: g.po_no ?? null,
          ship_date: g.ship_date ?? null,
          ship_label: g.ship_label ?? null,
          note: g.note ?? null,
          sort_order: gi,
          lines: g.lines.map((l, li) => ({
            id: l.id,
            product_id: l.product_id ?? null,
            sales_order_line_id: l.sales_order_line_id ?? null,
            product_code: l.product_code ?? '',
            customer_item_code: l.customer_item_code ?? null,
            name_foreign: l.name_foreign ?? null,
            name_vi: l.name_vi ?? null,
            name_customs: l.name_customs ?? null,
            barcode: l.barcode ?? null,
            unit: l.unit ?? '',
            qty: Number(l.qty ?? 0),
            packing: l.packing ?? null,
            cbm: l.cbm == null || l.cbm === ('' as never) ? null : Number(l.cbm),
            ship_date: l.ship_date ?? null,
            ship_label: l.ship_label ?? null,
            specs: l.specs ?? {},
            checks: l.checks ?? {},
            extras: l.extras ?? {},
            note: l.note ?? null,
            important_note: l.important_note ?? null,
            image_file_id: l.image_file_id ?? null,
            sort_order: li,
          })),
        })),
        revision_note: note.trim() || null,
      }
      await api(`/api/dept/production/lsx/${lsxId}/lines`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      toast.success('Đã lưu dòng lệnh', lsxCode)
      router.refresh()
    } catch (e) {
      toast.error('Lưu thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  async function reseed() {
    setBusy(true)
    try {
      await api(`/api/dept/production/lsx/${lsxId}/lines`, { method: 'POST', body: '{}' })
      toast.success('Đã nạp dòng từ đơn hàng')
      router.refresh()
    } catch (e) {
      toast.error('Nạp thất bại', e instanceof ApiError ? e.message : 'Có lỗi')
    } finally {
      setBusy(false)
    }
  }

  const inputCls =
    'w-full rounded border border-zinc-300 px-1.5 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900'

  return (
    <div className="flex flex-col gap-4">
      <TopProgressBar active={busy} />
      <PageHeader
        breadcrumbs={[{ label: 'Lệnh sản xuất', href: backHref }, { label: lsxCode }]}
        title={`Soạn dòng lệnh ${lsxCode}`}
        description={`${customerName} · mẫu cột: ${template.label}${
          revision > 1 ? ` · đang ở bản chỉnh sửa lần ${revision}` : ''
        }`}
        actions={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => void reseed()}
                disabled={busy}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Nạp dòng từ đơn
              </button>
              <Link
                href={`/print/lsx/${lsxId}`}
                target="_blank"
                rel="noopener"
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                🖨 Xem phiếu in
              </Link>
              <button
                onClick={() => void save()}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                {busy && <Spinner size={14} />}
                Lưu dòng lệnh
              </button>
            </div>
          ) : null
        }
      />

      <div className="text-xs text-zinc-500">
        Tổng: <b>{totalQty.toLocaleString('vi-VN')}</b> SP
        {showCbm && (
          <>
            {' · '}
            <b>{totalCbm.toLocaleString('vi-VN', { maximumFractionDigits: 3 })}</b> CBM
          </>
        )}{' '}
        · {groups.length} nhóm
      </div>

      {groups.map((g) => (
        <section
          key={g._key}
          className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-0.5 text-xs">
              Tên nhóm
              <input
                value={g.title ?? ''}
                onChange={(e) => patchGroup(g._key, { title: e.target.value })}
                disabled={!canEdit}
                placeholder="HALI - HALSTON - AMELIA"
                className={`${inputCls} w-64`}
              />
            </label>
            <label className="flex flex-col gap-0.5 text-xs">
              Số PO
              <input
                value={g.po_no ?? ''}
                onChange={(e) => patchGroup(g._key, { po_no: e.target.value })}
                disabled={!canEdit}
                placeholder="PT-138-155-HG"
                className={`${inputCls} w-40`}
              />
            </label>
            <label className="flex flex-col gap-0.5 text-xs">
              Khách con
              <input
                value={g.buyer_name ?? ''}
                onChange={(e) => patchGroup(g._key, { buyer_name: e.target.value })}
                disabled={!canEdit}
                placeholder="PAPAYA 138"
                className={`${inputCls} w-36`}
              />
            </label>
            <label className="flex flex-col gap-0.5 text-xs">
              Ngày giao
              <input
                type="date"
                value={g.ship_date ?? ''}
                onChange={(e) =>
                  patchGroup(g._key, { ship_date: e.target.value || null })
                }
                disabled={!canEdit}
                className={`${inputCls} w-36`}
              />
            </label>
            <span className="ml-auto text-xs text-zinc-500">
              {g.lines.length} dòng ·{' '}
              {g.lines
                .reduce((s, l) => s + Number(l.qty ?? 0), 0)
                .toLocaleString('vi-VN')}{' '}
              SP
            </span>
          </div>

          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-[11px] text-zinc-500 dark:border-zinc-800">
                  <th className="w-8 py-1">#</th>
                  <th className="py-1 pr-2">Mã SP</th>
                  <th className="py-1 pr-2">Tên tiếng Việt</th>
                  <th className="w-16 py-1 pr-2">ĐVT</th>
                  <th className="w-20 py-1 pr-2">SL</th>
                  {showCbm && <th className="w-20 py-1 pr-2">CBM</th>}
                  <th className="w-32 py-1 pr-2">Đợt xuất</th>
                  {specCols.map((c) => (
                    <th key={colKey(c)} className="py-1 pr-2">
                      {c.label}
                    </th>
                  ))}
                  <th className="py-1 pr-2">Đóng gói</th>
                  <th className="py-1 pr-2">Ghi chú</th>
                  {checkCols.map((c) => (
                    <th key={colKey(c)} className="py-1 pr-2">
                      {c.label}
                    </th>
                  ))}
                  {canEdit && <th className="w-20 py-1" />}
                </tr>
              </thead>
              <tbody>
                {g.lines.map((l, i) => (
                  <tr
                    key={l._key}
                    className="border-b border-zinc-100 dark:border-zinc-900"
                  >
                    <td className="py-1 text-zinc-400">{i + 1}</td>
                    <td className="py-1 pr-2">
                      <input
                        value={l.product_code ?? ''}
                        onChange={(e) =>
                          patchLine(g._key, l._key, { product_code: e.target.value })
                        }
                        disabled={!canEdit}
                        placeholder="Thông báo sau"
                        className={`${inputCls} font-mono`}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={l.name_vi ?? ''}
                        onChange={(e) =>
                          patchLine(g._key, l._key, { name_vi: e.target.value })
                        }
                        disabled={!canEdit}
                        className={inputCls}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={l.unit ?? ''}
                        onChange={(e) =>
                          patchLine(g._key, l._key, { unit: e.target.value })
                        }
                        disabled={!canEdit}
                        className={inputCls}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        type="number"
                        min={0}
                        value={String(l.qty ?? 0)}
                        onChange={(e) =>
                          patchLine(g._key, l._key, { qty: Number(e.target.value) })
                        }
                        disabled={!canEdit}
                        className={`${inputCls} text-right`}
                      />
                    </td>
                    {showCbm && (
                      <td className="py-1 pr-2">
                        <input
                          type="number"
                          step="0.001"
                          min={0}
                          value={l.cbm == null ? '' : String(l.cbm)}
                          onChange={(e) =>
                            patchLine(g._key, l._key, {
                              cbm: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          disabled={!canEdit}
                          className={`${inputCls} text-right`}
                        />
                      </td>
                    )}
                    <td className="py-1 pr-2">
                      <input
                        value={l.ship_label ?? l.ship_date ?? ''}
                        onChange={(e) =>
                          patchLine(g._key, l._key, { ship_label: e.target.value })
                        }
                        disabled={!canEdit}
                        placeholder="w37.26"
                        className={inputCls}
                      />
                    </td>
                    {specCols.map((c) => (
                      <td key={colKey(c)} className="py-1 pr-2">
                        <textarea
                          rows={1}
                          value={l.specs?.[colKey(c)] ?? ''}
                          onChange={(e) =>
                            patchLine(g._key, l._key, {
                              specs: { ...(l.specs ?? {}), [colKey(c)]: e.target.value },
                            })
                          }
                          disabled={!canEdit}
                          placeholder={c.hint}
                          className={inputCls}
                        />
                      </td>
                    ))}
                    <td className="py-1 pr-2">
                      <input
                        value={l.packing ?? ''}
                        onChange={(e) =>
                          patchLine(g._key, l._key, { packing: e.target.value })
                        }
                        disabled={!canEdit}
                        placeholder="4 cái/ thùng"
                        className={inputCls}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        value={l.note ?? ''}
                        onChange={(e) =>
                          patchLine(g._key, l._key, { note: e.target.value })
                        }
                        disabled={!canEdit}
                        className={inputCls}
                      />
                    </td>
                    {checkCols.map((c) => (
                      <td key={colKey(c)} className="py-1 pr-2">
                        <input
                          value={l.checks?.[colKey(c)] ?? ''}
                          onChange={(e) =>
                            patchLine(g._key, l._key, {
                              checks: {
                                ...(l.checks ?? {}),
                                [colKey(c)]: e.target.value,
                              },
                            })
                          }
                          disabled={!canEdit}
                          placeholder={c.hint}
                          className={inputCls}
                        />
                      </td>
                    ))}
                    {canEdit && (
                      <td className="py-1 text-right whitespace-nowrap">
                        <button
                          onClick={() => addLine(g._key, l)}
                          title="Tách đợt xuất — chép dòng này thành dòng mới"
                          className="px-1 text-sky-600 hover:underline dark:text-sky-400"
                        >
                          Tách
                        </button>
                        <button
                          onClick={() => removeLine(g._key, l._key)}
                          title="Xoá dòng"
                          className="px-1 text-red-500 hover:underline"
                        >
                          Xoá
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canEdit && (
            <button
              onClick={() => addLine(g._key)}
              className="mt-2 rounded-lg border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              + Thêm dòng
            </button>
          )}
        </section>
      ))}

      {canEdit && (
        <div className="flex flex-wrap items-end gap-2 pb-6">
          <label className="flex flex-1 flex-col gap-0.5 text-xs">
            Lý do chỉnh sửa (ghi vào bản phát lại — xưởng đọc để biết đổi gì)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Khách chốt lại số lượng SIGRID, thêm bộ IMANI"
              className={inputCls}
            />
          </label>
          <button
            onClick={() => void save()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy && <Spinner size={14} />}
            Lưu dòng lệnh
          </button>
        </div>
      )}
    </div>
  )
}
