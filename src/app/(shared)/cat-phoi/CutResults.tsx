'use client'

import { AlertTriangle, Layers, Ruler, Scissors } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/shadcn/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { StatTile, StatTiles } from '@/components/erp/StatTile'
import { fmtM, fmtMm, patternText } from '@/lib/cut-plan/format'
import type { CutLine, CutPattern, CutPlanDoc, CutPlanResult } from '@/lib/cut-plan/types'
import { cn } from '@/lib/utils'

/**
 * KẾT QUẢ QUY CẮT — đúng ba con số của bản gốc (Used / Diminish / số chi tiết)
 * và bảng sơ đồ cắt trên từng cây kèm hình vạch tỉ lệ (bản gốc vẽ cây bằng ảnh).
 */
export function CutResults({
  doc,
  plan,
  stale,
}: {
  doc: CutPlanDoc
  plan: CutPlanResult
  /** Số liệu nhập đã đổi sau lần tính gần nhất — bảng dưới là số cũ. */
  stale: boolean
}) {
  const byKey = new Map(doc.lines.map((l) => [l.key, l]))
  const r = plan.result
  const rowOf = (key: number) => doc.lines.findIndex((l) => l.key === key) + 1
  // Số thứ tự cây của từng sơ đồ (1–12, 13–20…) tính trước một lượt.
  const ranges: [number, number][] = []
  let acc = 0
  for (const p of r.patterns) {
    ranges.push([acc + 1, acc + p.bars])
    acc += p.bars
  }

  return (
    <div className={cn('flex flex-col gap-4', stale && 'opacity-60')}>
      {stale && (
        <p className="flex items-center gap-1.5 text-sm text-[var(--warn)]">
          <AlertTriangle className="size-4" aria-hidden /> Số liệu nhập đã đổi — bấm{' '}
          <b>Tính quy cắt</b> để cập nhật kết quả.
        </p>
      )}

      <StatTiles>
        <StatTile
          label="Số cây cần"
          value={r.bars}
          hint={`cây ${fmtMm(r.stock_length_mm)} mm · tổng ${fmtM(r.material_mm)}`}
          tone="primary"
          icon={Layers}
        />
        <StatTile
          label="Hao hụt"
          value={`${r.waste_pct.toLocaleString('vi-VN')}%`}
          hint={`dư ${fmtM(r.scrap_mm)} trên ${fmtM(r.material_mm)} cây`}
          tone={r.waste_pct > 10 ? 'warn' : 'default'}
          icon={Scissors}
        />
        <StatTile
          label="Chi tiết bố trí"
          value={r.pieces_total}
          hint={
            r.errors.length > 0
              ? `${r.errors.length} dòng không xếp được`
              : 'đủ mọi chi tiết đã nhập'
          }
          tone={r.errors.length > 0 ? 'stop' : 'default'}
          icon={Ruler}
        />
      </StatTiles>

      {(plan.skipped.length > 0 || r.errors.length > 0) && (
        <div className="bg-card rounded-lg border border-l-4 border-l-[var(--warn)] p-3 text-sm">
          {plan.skipped.length > 0 && (
            <p>
              <b>{plan.skipped.length} dòng chưa tính</b> vì thiếu số liệu:{' '}
              {plan.skipped.map((s, i) => (
                <span key={s.key}>
                  {i > 0 && ' · '}
                  dòng {rowOf(s.key)} ({s.reason.toLowerCase()})
                </span>
              ))}
            </p>
          )}
          {r.errors.map((e) => (
            <p key={e} className="flex items-start gap-1.5 text-[var(--stop)]">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> {e}
            </p>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="t-title">
            Sơ đồ cắt{doc.spec ? ` — ${doc.spec}` : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-lg border">
            <Table className="text-[13px]">
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="w-20 text-right">Cây số</TableHead>
                  <TableHead>Sơ đồ cắt trên một cây</TableHead>
                  <TableHead className="w-16 text-right">Khúc</TableHead>
                  <TableHead className="w-24 text-right">Dùng (mm)</TableHead>
                  <TableHead className="w-20 text-right">Dư (mm)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {r.patterns.map((p, i) => {
                  const [from, to] = ranges[i]
                  return (
                    <TableRow key={i}>
                      <TableCell className="t-data text-right align-top">
                        {p.bars === 1 ? from : `${from}–${to}`}
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <div className="font-medium">
                          {p.bars > 1 && (
                            <span className="text-[var(--primary)]">{p.bars} cây × </span>
                          )}
                          {patternText(p.pieces, byKey)}
                        </div>
                        <PatternBar pattern={p} byKey={byKey} stock={r.stock_length_mm} />
                      </TableCell>
                      <TableCell className="t-data text-right align-top">
                        {p.pieces.reduce((a, b) => a + b.count, 0)}
                      </TableCell>
                      <TableCell className="t-data text-right align-top">
                        {fmtMm(p.used_mm)}
                      </TableCell>
                      <TableCell className="t-data text-right align-top">
                        {fmtMm(p.remnant_mm)}
                      </TableCell>
                    </TableRow>
                  )
                })}
                {r.patterns.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-muted-foreground whitespace-normal"
                    >
                      Chưa có sơ đồ nào — kiểm tra lại chiều dài cây và các dòng bị bỏ ở
                      trên.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/** Vạch tỉ lệ một cây: mỗi khúc một ô, đoạn dư ở cuối — thợ nhìn là biết cắt chỗ nào. */
function PatternBar({
  pattern,
  byKey,
  stock,
}: {
  pattern: CutPattern
  byKey: Map<number, CutLine>
  stock: number
}) {
  const segs: { w: number; label: string }[] = []
  for (const p of pattern.pieces) {
    const l = byKey.get(p.id)
    const len = l && typeof l.length_mm === 'number' ? l.length_mm : 0
    for (let i = 0; i < p.count; i++) {
      segs.push({ w: (len / stock) * 100, label: `${fmtMm(len)} ${l?.part_name ?? ''}` })
    }
  }
  return (
    <div className="mt-1.5 flex h-4 w-full overflow-hidden rounded-sm border" aria-hidden>
      {segs.map((s, i) => (
        <div
          key={i}
          style={{ width: `${s.w}%` }}
          className="border-r bg-[var(--accent)] last:border-r-0"
          title={s.label}
        />
      ))}
      {pattern.remnant_mm > 0 && (
        <div
          style={{ width: `${(pattern.remnant_mm / stock) * 100}%` }}
          className="bg-muted min-w-[2px]"
          title={`dư ${fmtMm(pattern.remnant_mm)} mm`}
        />
      )}
    </div>
  )
}
