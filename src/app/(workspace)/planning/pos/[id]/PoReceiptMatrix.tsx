'use client'

import { PackageCheck } from 'lucide-react'
import { DocChip } from '@/components/erp/DocChip'
import { Badge } from '@/components/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shadcn/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { cn } from '@/lib/utils'
import type { ReceiptBatch } from '@/modules/dept/supply/po-receipts.service'

const fmt = (n: number) =>
  n === 0 ? '0' : n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })
const dmy = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`

/**
 * NHẬN THEO ĐỢT — ma trận DÒNG × PHIẾU NHẬP (B3, 05/09/2026), đúng khuôn sheet
 * "Thao_Visa" của Cung ứng: mỗi đợt một cột (ngày · số phiếu · số phiếu NCC),
 * cuối hàng là tổng đã nhận, còn thiếu và kết luận Đủ / Thiếu / Dư / Chốt thiếu.
 *
 * Khác thẻ "Đợt giao" ở trên: thẻ đó là LỊCH NCC hẹn (đợt giao 0152), còn đây
 * là SỔ THỰC NHẬN của Kho — cùng một đơn nhưng hai câu hỏi.
 */
export function PoReceiptMatrix({
  batches,
  lines,
  status,
}: {
  batches: ReceiptBatch[]
  lines: {
    id: string
    material_code: string
    material_name: string
    unit: string
    qty_ordered: number
  }[]
  status: {
    id: string
    qty_received: number
    qty_missing: number
    closed_short_at: string | null
  }[]
}) {
  const statusById = new Map(status.map((s) => [s.id, s]))
  // Chỉ dòng có vật tư kho mới có phiếu; dòng tự do (0134) không nằm ở đây.
  const rows = lines.filter((l) => batches.some((b) => b.by_line[l.id]) || statusById.has(l.id))

  return (
    <Card>
      <CardHeader className="bg-muted/20 border-b py-3.5">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <PackageCheck className="text-primary size-4" />
          Nhận theo đợt ({batches.length} phiếu nhập)
        </CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[200px]">Vật tư</TableHead>
              <TableHead className="text-right">Đặt</TableHead>
              {batches.map((b, i) => (
                <TableHead key={b.doc_id ?? `day:${b.date}`} className="text-right whitespace-nowrap">
                  <div>Đợt {i + 1} · {dmy(b.date)}</div>
                  <div className="text-muted-foreground text-[10px] font-normal normal-case">
                    {b.doc_code ?? 'không phiếu'}
                    {b.supplier_doc_no ? ` · NCC ${b.supplier_doc_no}` : ''}
                  </div>
                </TableHead>
              ))}
              <TableHead className="text-right">Tổng nhận</TableHead>
              <TableHead className="text-right">Còn thiếu</TableHead>
              <TableHead>Kết luận</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((l) => {
              const s = statusById.get(l.id)
              const received = s?.qty_received ?? 0
              const missing = s?.qty_missing ?? l.qty_ordered - received
              const verdict =
                s?.closed_short_at != null
                  ? { label: `Chốt thiếu ${fmt(missing)}`, tone: 'gray' as const }
                  : missing > 0
                    ? received > 0
                      ? { label: `Thiếu ${fmt(missing)}`, tone: 'amber' as const }
                      : { label: 'Chưa về', tone: 'red' as const }
                    : missing < 0
                      ? { label: `Dư ${fmt(-missing)}`, tone: 'blue' as const }
                      : { label: 'Đủ', tone: 'green' as const }
              return (
                <TableRow key={l.id}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {l.material_code && <DocChip>{l.material_code}</DocChip>}
                      <span className="line-clamp-2">{l.material_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="t-data text-right whitespace-nowrap">
                    {fmt(l.qty_ordered)} {l.unit}
                  </TableCell>
                  {batches.map((b) => {
                    const c = b.by_line[l.id]
                    return (
                      <TableCell
                        key={b.doc_id ?? `day:${b.date}`}
                        className={cn('t-data text-right', !c && 'text-muted-foreground')}
                      >
                        {c ? fmt(c.qty) : '—'}
                        {c && c.rejected > 0 && (
                          <span className="block text-[11px] text-[var(--stop)]">
                            loại {fmt(c.rejected)}
                          </span>
                        )}
                      </TableCell>
                    )
                  })}
                  <TableCell className="t-data text-right font-semibold">{fmt(received)}</TableCell>
                  <TableCell
                    className={cn(
                      't-data text-right',
                      missing > 0 ? 'text-[var(--stop)]' : 'text-muted-foreground',
                    )}
                  >
                    {fmt(Math.max(missing, 0))}
                  </TableCell>
                  <TableCell>
                    <Badge tone={verdict.tone}>{verdict.label}</Badge>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
