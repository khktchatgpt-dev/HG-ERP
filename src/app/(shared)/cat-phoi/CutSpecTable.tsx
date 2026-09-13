'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shadcn/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { GridCellInput } from '@/components/erp/GridCell'
import { fmtMm } from '@/lib/cut-plan/format'
import {
  NO_SPEC_LABEL,
  lineHasData,
  specKey,
  stockFor,
  type CutLine,
  type CutPlanDoc,
} from '@/lib/cut-plan/types'
import { useVnNumber } from './vn-number'

/**
 * BẢNG QUY CÁCH — mỗi quy cách đang có trong lưới một dòng: số dòng, số chi
 * tiết và ô CÂY TIÊU CHUẨN riêng. Bỏ trống ô là dùng cây mặc định ở đầu phiếu.
 * Sinh từ lưới nên gõ quy cách mới ở lưới là bảng có ngay dòng mới.
 */
export type SpecRow = { key: string; spec: string; lines: number; pieces: number }

export function specRows(lines: CutLine[]): SpecRow[] {
  const map = new Map<string, SpecRow>()
  for (const l of lines) {
    if (!lineHasData(l)) continue
    const key = specKey(l.spec)
    let r = map.get(key)
    if (!r) {
      r = { key, spec: l.spec.trim().replace(/\s+/g, ' '), lines: 0, pieces: 0 }
      map.set(key, r)
    }
    r.lines += 1
    if (typeof l.qty === 'number') r.pieces += l.qty
  }
  return [...map.values()]
}

export function CutSpecTable({
  doc,
  onStock,
}: {
  doc: CutPlanDoc
  /** Đặt cây tiêu chuẩn riêng cho một quy cách; '' = về mặc định. */
  onStock: (key: string, v: number | '') => void
}) {
  const rows = useMemo(() => specRows(doc.lines), [doc.lines])
  if (rows.length === 0) return null
  return (
    <Card>
      <CardHeader>
        <CardTitle className="t-title">
          Quy cách &amp; cây tiêu chuẩn{' '}
          <span className="text-muted-foreground text-sm font-normal">
            — {rows.length} loại cây, mỗi loại một sơ đồ riêng; ô trống dùng cây mặc định{' '}
            <b className="t-data">{fmtMm(doc.stock_length_mm)}</b> mm
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto rounded-lg border">
          <Table className="text-[13px]">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Quy cách</TableHead>
                <TableHead className="w-20 text-right">Dòng</TableHead>
                <TableHead className="w-24 text-right">Chi tiết</TableHead>
                <TableHead className="w-44 text-right">Cây tiêu chuẩn (mm)</TableHead>
                <TableHead className="w-28 text-right">Áp dụng</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <SpecRowView
                  key={r.key || '__none'}
                  row={r}
                  doc={doc}
                  onStock={onStock}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}

function SpecRowView({
  row,
  doc,
  onStock,
}: {
  row: SpecRow
  doc: CutPlanDoc
  onStock: (key: string, v: number | '') => void
}) {
  const own = doc.stock_by_spec[row.key]
  const bind = useVnNumber({
    value: typeof own === 'number' && own > 0 ? own : '',
    onValueChange: (v) => onStock(row.key, v),
    col: 'length_mm',
  })
  return (
    <TableRow className="[&>td]:py-1">
      <TableCell className="whitespace-normal">
        {row.spec || <span className="text-muted-foreground">{NO_SPEC_LABEL}</span>}
      </TableCell>
      <TableCell className="t-data text-right">{row.lines}</TableCell>
      <TableCell className="t-data text-right">
        {row.pieces.toLocaleString('vi-VN')}
      </TableCell>
      <TableCell className="p-0">
        <GridCellInput
          {...bind}
          placeholder={fmtMm(doc.stock_length_mm)}
          aria-label={`Cây tiêu chuẩn cho ${row.spec || NO_SPEC_LABEL}`}
          className="t-data text-right"
        />
      </TableCell>
      <TableCell className="t-data text-muted-foreground text-right">
        {fmtMm(stockFor(doc, row.key))}
      </TableCell>
    </TableRow>
  )
}
