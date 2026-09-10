'use client'

import { useEffect, useState } from 'react'
import { ArrowLeft, Download, Search } from 'lucide-react'
import { Modal } from '@/components/Modal'
import { Button } from '@/components/shadcn/button'
import { Checkbox } from '@/components/shadcn/checkbox'
import { Input } from '@/components/shadcn/input'
import { Spinner } from '@/components/erp/Spinner'
import { ToolbarSelect } from '@/components/erp/Toolbar'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/shadcn/table'
import { useToast } from '@/components/ui/Toast'
import { api, apiErrorText } from '@/lib/api'
import { searchProducts, type ProductPick } from '@/components/sales/ProductPicker'
import { fmtMm } from '@/lib/cut-plan/format'
import type { BomToCutResult } from '@/lib/cut-plan/from-bom'
import { NO_SPEC_LABEL, specKey, type CutLine } from '@/lib/cut-plan/types'
import type { PasteMode } from './CutPasteDialog'
import { useVnNumber } from './vn-number'

type FromProduct = {
  product: { id: string; code: string; name: string }
} & BomToCutResult

/**
 * NẠP TỪ HỒ SƠ SP — chọn sản phẩm (tìm theo mã / tên), nhập số lượng đợt, máy
 * nhân định mức lên và gom theo quy cách. Bày bảng quy cách cho người dùng
 * soát (bỏ tick nhóm không cần cắt) rồi mới đổ vào lưới. Cây tiêu chuẩn BOM
 * ghi sẵn (`bar_length_m`) được đề xuất cho quy cách chưa có cây riêng.
 */
export function CutBomDialog({
  open,
  hasData,
  onClose,
  onConfirm,
}: {
  open: boolean
  hasData: boolean
  onClose: () => void
  onConfirm: (
    rows: Omit<CutLine, 'key'>[],
    mode: PasteMode,
    meta: { item: string; title: string; stockBySpec: Record<string, number> },
  ) => void
}) {
  const toast = useToast()
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<ProductPick[]>([])
  const [searching, setSearching] = useState(false)
  const [picked, setPicked] = useState<ProductPick | null>(null)
  const [qty, setQty] = useState<number | ''>(1)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<FromProduct | null>(null)
  const [excluded, setExcluded] = useState<Set<string>>(() => new Set())
  const [mode, setMode] = useState<PasteMode>(hasData ? 'append' : 'replace')
  const qtyBind = useVnNumber({ value: qty, onValueChange: (v) => setQty(v), col: 'qty' })

  useEffect(() => {
    if (!open) return
    let alive = true
    // Gõ xong 250 ms mới gọi server; bật "Đang tìm…" trong cùng nhịp đó.
    const t = setTimeout(() => {
      setSearching(true)
      searchProducts(null, q.trim())
        .then((r) => alive && setRows(r.rows))
        .catch(() => alive && setRows([]))
        .finally(() => alive && setSearching(false))
    }, 250)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [q, open])

  function reset() {
    setQ('')
    setPicked(null)
    setQty(1)
    setData(null)
    setExcluded(new Set())
  }
  function close() {
    reset()
    onClose()
  }

  async function load() {
    if (!picked || !(typeof qty === 'number' && qty > 0)) return
    setLoading(true)
    try {
      const d = await api<FromProduct>(
        `/api/dept/production/cut-plan/from-product?product_id=${picked.id}&qty=${qty}`,
      )
      if (d.lines.length === 0) {
        toast.error(
          'Hồ sơ này chưa có dòng nào cắt phôi',
          d.dropped > 0
            ? `${d.dropped} dòng định mức không có chiều dài cắt (nệm, ốc vít, bao bì…).`
            : 'Định mức của sản phẩm còn trống.',
        )
        return
      }
      setData(d)
      setExcluded(new Set())
      setMode(hasData ? 'append' : 'replace')
    } catch (e) {
      toast.error('Không nạp được định mức', apiErrorText(e))
    } finally {
      setLoading(false)
    }
  }

  function confirm() {
    if (!data) return
    const keep = data.specs.filter((s) => !excluded.has(s.key))
    const keys = new Set(keep.map((s) => s.key))
    const lines = data.lines.filter((l) => keys.has(specKey(l.spec)))
    const stockBySpec: Record<string, number> = {}
    for (const s of keep) if (s.stock_length_mm) stockBySpec[s.key] = s.stock_length_mm
    onConfirm(lines, mode, {
      item: data.product.code,
      title: `${data.product.name} × ${qty}`,
      stockBySpec,
    })
    close()
  }

  if (!open) return null
  const keptLines = data
    ? data.lines.filter((l) => !excluded.has(specKey(l.spec))).length
    : 0
  return (
    <Modal
      open={open}
      onClose={close}
      title="Nạp từ hồ sơ sản phẩm — định mức × số lượng đợt"
      maxWidth="sm:max-w-3xl"
    >
      {data == null ? (
        <div className="flex flex-col gap-3">
          <p className="text-muted-foreground text-xs">
            Chọn sản phẩm rồi nhập số lượng của đợt. Máy lấy các dòng định mức có{' '}
            <b>chiều dài cắt</b> (khung nhôm / sắt / inox, thanh gỗ…), nhân số lượng và tự
            gom theo quy cách vật liệu.
          </p>
          <div className="relative">
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Tìm theo mã hoặc tên sản phẩm…"
              className="pl-8"
            />
          </div>
          <div className="max-h-[38vh] overflow-auto rounded-lg border">
            <Table className="text-xs">
              <TableBody>
                {rows.map((p) => (
                  <TableRow
                    key={p.id}
                    data-state={picked?.id === p.id ? 'selected' : undefined}
                    className="cursor-pointer"
                    onClick={() => setPicked(p)}
                  >
                    <TableCell className="t-data w-36">{p.code}</TableCell>
                    <TableCell className="whitespace-normal">{p.name}</TableCell>
                    <TableCell className="text-muted-foreground w-24 text-right">
                      {p.bom_status === 'done'
                        ? 'BOM đã vẽ'
                        : p.bom_status === 'drawing'
                          ? 'đang vẽ'
                          : 'chưa có BOM'}
                    </TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow>
                    <TableCell className="text-muted-foreground" colSpan={3}>
                      {searching ? 'Đang tìm…' : 'Không có sản phẩm khớp.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <label className="mr-auto flex items-center gap-2 text-sm">
              <span className="t-label">Số lượng SP</span>
              <Input
                {...qtyBind}
                className="t-data w-24 text-right"
                aria-label="Số lượng sản phẩm"
              />
            </label>
            <Button type="button" variant="outline" onClick={close}>
              Huỷ
            </Button>
            <Button
              type="button"
              disabled={!picked || !(typeof qty === 'number' && qty > 0) || loading}
              onClick={() => void load()}
            >
              {loading ? <Spinner size={14} /> : <Download aria-hidden />} Đọc định mức
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs">
            <b className="t-data">{data.product.code}</b> {data.product.name} ×{' '}
            <b className="t-data">{qty}</b> ·{' '}
            <b className="text-[var(--done)]">{data.lines.length} dòng cắt phôi</b>
            {data.dropped > 0 && (
              <span className="text-muted-foreground">
                {' '}
                · {data.dropped} dòng định mức không có dài cắt, bỏ qua
              </span>
            )}
          </p>
          <div className="max-h-[45vh] overflow-auto rounded-lg border">
            <Table className="text-xs">
              <TableHeader className="bg-muted/50 sticky top-0">
                <TableRow>
                  <TableHead className="w-10">Cắt</TableHead>
                  <TableHead>Quy cách</TableHead>
                  <TableHead className="text-right">Dòng</TableHead>
                  <TableHead className="text-right">Chi tiết</TableHead>
                  <TableHead className="text-right">Cây BOM ghi (mm)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.specs.map((s) => (
                  <TableRow key={s.key || '__none'}>
                    <TableCell className="text-center">
                      <Checkbox
                        checked={!excluded.has(s.key)}
                        onCheckedChange={(v) =>
                          setExcluded((prev) => {
                            const next = new Set(prev)
                            if (v) next.delete(s.key)
                            else next.add(s.key)
                            return next
                          })
                        }
                        aria-label={`Cắt ${s.spec || NO_SPEC_LABEL}`}
                      />
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      {s.spec || NO_SPEC_LABEL}
                    </TableCell>
                    <TableCell className="t-data text-right">{s.lines}</TableCell>
                    <TableCell className="t-data text-right">{s.pieces}</TableCell>
                    <TableCell className="t-data text-muted-foreground text-right">
                      {s.stock_length_mm ? fmtMm(s.stock_length_mm) : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setData(null)}
              className="mr-auto gap-1.5"
            >
              <ArrowLeft aria-hidden /> Chọn lại
            </Button>
            <ToolbarSelect
              value={mode}
              onChange={(v) => setMode(v)}
              aria-label="Cách đưa vào lưới"
              options={[
                { value: 'append', label: 'Thêm vào cuối lưới' },
                { value: 'replace', label: 'Thay toàn bộ lưới' },
              ]}
            />
            <Button type="button" variant="outline" onClick={close}>
              Huỷ
            </Button>
            <Button type="button" disabled={keptLines === 0} onClick={confirm}>
              <Download aria-hidden />
              {mode === 'replace'
                ? `Thay bằng ${keptLines} dòng`
                : `Thêm ${keptLines} dòng`}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
