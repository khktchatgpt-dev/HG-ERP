'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowUpFromLine,
  Building2,
  ChevronDown,
  ChevronRight,
  Factory,
} from 'lucide-react'
import { PageHeader } from '@/components/erp/PageHeader'
import { DocChip } from '@/components/erp/DocChip'
import { Badge } from '@/components/Badge'
import { Spinner } from '@/components/erp/Spinner'
import { Button } from '@/components/shadcn/button'
import { api } from '@/lib/api'

type LsxRow = {
  id: string
  code: string
  customer_name: string
  ship_date: string | null
  materials_received_at: string | null
}

/** Một dòng nhu cầu từ `/api/dept/warehouse/lsx-needs` (BOM×SL − đã xuất). */
type Need = {
  material_id: string
  material_code: string
  material_name: string
  unit: string
  qty_needed: number
  qty_issued: number
  qty_remaining: number
  incomplete?: boolean
}

const num = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
const dmy = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })
    : '—'

/**
 * Kho không tự gõ lại vật tư: LỆNH → định mức → nhu cầu → phiếu xuất. Bảng ba
 * cột đúng câu người cấp hỏi: cần bao nhiêu, đã cấp bao nhiêu, còn bao nhiêu.
 * Nút "Tạo phiếu xuất" mở form PXK sẵn có với lệnh CHỌN SẴN (form tự prefill
 * phần còn thiếu).
 */
export function IssueScreen({ lsxs, canEdit }: { lsxs: LsxRow[]; canEdit: boolean }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [needs, setNeeds] = useState<Record<string, Need[] | 'loading' | 'error'>>({})

  async function toggle(id: string) {
    if (openId === id) {
      setOpenId(null)
      return
    }
    setOpenId(id)
    if (needs[id] && needs[id] !== 'error') return
    setNeeds((s) => ({ ...s, [id]: 'loading' }))
    try {
      const res = await api<{ needs: Need[] }>(
        `/api/dept/warehouse/lsx-needs?production_order_id=${id}`,
      )
      setNeeds((s) => ({ ...s, [id]: res.needs }))
    } catch {
      setNeeds((s) => ({ ...s, [id]: 'error' }))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        breadcrumbs={[{ label: 'Kho', href: '/warehouse' }, { label: 'Cấp vật tư SX' }]}
        title="Cấp vật tư cho sản xuất"
        description="Lệnh đang chạy — bung một lệnh để xem cần / đã cấp / còn thiếu theo định mức, rồi tạo phiếu xuất với phần còn thiếu điền sẵn."
      />

      {lsxs.length === 0 ? (
        <div className="bg-card flex flex-col items-center rounded-xl border py-14 text-center">
          <span className="bg-muted grid size-12 place-items-center rounded-xl">
            <Factory className="text-muted-foreground size-6" strokeWidth={1.8} />
          </span>
          <p className="t-title mt-4">Không có lệnh nào đang chạy</p>
        </div>
      ) : (
        <div className="bg-card overflow-hidden rounded-xl border">
          {lsxs.map((l) => {
            const open = openId === l.id
            const state = needs[l.id]
            return (
              <div key={l.id} className="border-b last:border-0">
                <button
                  onClick={() => void toggle(l.id)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--accent)]/40"
                >
                  {open ? (
                    <ChevronDown className="text-muted-foreground size-4 shrink-0" />
                  ) : (
                    <ChevronRight className="text-muted-foreground size-4 shrink-0" />
                  )}
                  <DocChip className="text-[11px]">{l.code}</DocChip>
                  <span className="t-body flex min-w-0 flex-1 items-center gap-1.5 truncate font-medium">
                    <Building2
                      className="text-muted-foreground size-3.5 shrink-0"
                      strokeWidth={1.8}
                    />
                    {l.customer_name}
                  </span>
                  {l.materials_received_at && <Badge tone="green">VT về đủ</Badge>}
                  <span className="text-muted-foreground hidden shrink-0 text-[11.5px] sm:block">
                    giao khách {dmy(l.ship_date)}
                  </span>
                </button>

                {open && (
                  <div className="bg-muted/30 border-t px-4 py-3">
                    {state === 'loading' || state === undefined ? (
                      <div className="text-muted-foreground flex items-center gap-2 py-2 text-[12.5px]">
                        <Spinner size={14} /> Đang tính nhu cầu theo định mức…
                      </div>
                    ) : state === 'error' ? (
                      <div className="flex items-center gap-3 py-2">
                        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--stop)]">
                          <AlertTriangle className="size-4" /> Không tính được nhu cầu.
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void toggle(l.id)}
                        >
                          Thử lại
                        </Button>
                      </div>
                    ) : state.length === 0 ? (
                      <p className="text-muted-foreground py-2 text-[12.5px]">
                        Lệnh chưa có định mức / bảng chi tiết — chưa tính được nhu cầu.
                        Kho vẫn xuất được bằng phiếu tự chọn vật tư.
                      </p>
                    ) : (
                      <NeedsTable needs={state} />
                    )}
                    {canEdit && (
                      <div className="mt-2.5 flex items-center justify-end gap-3">
                        {/* "Lệnh này có những đơn NCC nào?" — sang trang Đơn NCC
                            lọc sẵn theo mã lệnh (đơn mua chung cũng hiện). */}
                        <Link
                          href={`/warehouse/don-ncc?lsx=${encodeURIComponent(l.code)}`}
                          className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
                        >
                          Đơn NCC của lệnh này →
                        </Link>
                        <Button size="sm" asChild>
                          <Link href={`/warehouse/docs?new=issue&lsx=${l.id}`}>
                            <ArrowUpFromLine /> Tạo phiếu xuất cho lệnh này
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function NeedsTable({ needs }: { needs: Need[] }) {
  const remaining = needs.filter((n) => n.qty_remaining > 0)
  const done = needs.length - remaining.length
  return (
    <div className="flex flex-col gap-2">
      <div className="text-muted-foreground flex flex-wrap gap-x-3 text-[11.5px]">
        <span>
          {remaining.length > 0
            ? `${remaining.length} vật tư còn phải cấp`
            : 'Đã cấp đủ theo định mức'}
        </span>
        {done > 0 && <span>· {done} vật tư đã đủ</span>}
        {needs.some((n) => n.incomplete) && (
          <span className="inline-flex items-center gap-1 text-[var(--warn)]">
            <AlertTriangle className="size-3.5" /> có dòng thiếu định mức
          </span>
        )}
      </div>
      <div className="bg-card overflow-x-auto rounded-lg border">
        <table className="w-full text-left text-[12.5px]">
          <thead className="t-label text-muted-foreground bg-muted/50 border-b">
            <tr>
              <th className="px-3 py-2 font-medium">Vật tư</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Cần</th>
              <th className="w-24 px-3 py-2 text-right font-medium">Đã cấp</th>
              <th className="w-28 px-3 py-2 text-right font-medium">Còn thiếu</th>
            </tr>
          </thead>
          <tbody className="divide-border/60 divide-y">
            {[...remaining, ...needs.filter((n) => n.qty_remaining <= 0)]
              .slice(0, 40)
              .map((n) => (
                <tr key={n.material_id}>
                  <td className="px-3 py-1.5">
                    <span className="t-data text-muted-foreground text-[11px]">
                      {n.material_code}
                    </span>{' '}
                    {n.material_name}
                  </td>
                  <td className="t-data px-3 py-1.5 text-right">{num(n.qty_needed)}</td>
                  <td className="t-data px-3 py-1.5 text-right">{num(n.qty_issued)}</td>
                  <td className="t-data px-3 py-1.5 text-right">
                    {n.qty_remaining > 0 ? (
                      <span className="font-semibold text-[var(--warn)]">
                        {num(n.qty_remaining)}{' '}
                        <span className="text-muted-foreground font-normal">
                          {n.unit}
                        </span>
                      </span>
                    ) : (
                      <span className="font-medium text-[var(--done)]">Đủ</span>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {needs.length > 40 && (
          <p className="text-muted-foreground border-t px-3 py-2 text-[11.5px]">
            Còn {needs.length - 40} vật tư nữa — xem đủ trong form phiếu xuất.
          </p>
        )}
      </div>
    </div>
  )
}
