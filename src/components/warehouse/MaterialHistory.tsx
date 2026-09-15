'use client'

import { useEffect, useState } from 'react'
import { History, ReceiptText } from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { Spinner } from '@/components/erp/Spinner'
import { EmptyState } from '@/components/erp/EmptyState'
import { DocChip } from '@/components/erp/DocChip'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/shadcn/tabs'
import { MATERIAL_FIELD_LABELS } from '@/lib/material-group-fields'
import { poStatusLabel } from '@/lib/po-status'

/**
 * LỊCH SỬ MỘT VẬT TƯ — hai câu hỏi khác nhau, hai tab:
 *
 *   · GIÁ MUA: "con số 125 này ở đâu ra?" — mọi lần đã gửi NCC, đọc THẲNG từ
 *     dòng đơn đặt. Cột `last_purchase_price` của danh mục chỉ là bản chụp lần
 *     gần nhất, bị đè mỗi lần mua; tab này mới là chuỗi giá thật.
 *   · THAY ĐỔI Ô (0177): "ai sửa ô này, vì chứng từ nào?" — danh mục sửa được
 *     từ ba đường (màn Kho, hộp xác nhận sau khi lưu đơn, event giá).
 */

type Change = {
  id: string
  field: string
  before_value: string | null
  after_value: string | null
  actor_name: string | null
  source: string
  source_ref: string | null
  created_at: string
}

type PricePoint = {
  po_id: string
  po_code: string
  supplier_name: string
  currency: string
  unit_price: number | null
  price_unit: string | null
  qty_ordered: number
  status: string
  at: string
}

/** Nhãn cho những trường MATERIAL_FIELD_LABELS chưa kể tới. */
const EXTRA_LABELS: Record<string, string> = {
  code: 'Mã vật tư',
  name: 'Tên vật tư',
  unit: 'ĐVT',
  barcode: 'Mã vạch',
  group_name: 'Nhóm',
  note: 'Ghi chú',
  price_unit: 'ĐV tính giá',
  vat_rate: 'VAT (%)',
  last_purchase_price: 'Giá mua gần nhất',
  default_supplier_id: 'NCC mặc định',
  po_template: 'Mẫu đơn',
  min_stock: 'Tồn tối thiểu',
  max_stock: 'Tồn tối đa',
  reorder_point: 'Điểm đặt lại',
  reorder_qty: 'SL đặt lại',
  over_tolerance_pct: 'Dung sai nhận vượt (%)',
  shelf_location: 'Vị trí kệ',
  is_active: 'Đang dùng',
  needs_review: 'Cờ cần rà',
  needs_review_fields: 'Trường cần rà',
}

const fieldLabel = (f: string) => MATERIAL_FIELD_LABELS[f] ?? EXTRA_LABELS[f] ?? f

/** Đường ghi — nói bằng tiếng người, vì `po_enrich` không ai đoán ra. */
const SOURCE_LABELS: Record<string, string> = {
  manual: 'Sửa tay',
  po_enrich: 'Hộp xác nhận sau khi lưu đơn',
  po_price: 'Giá chốt khi gửi NCC',
  import: 'Nạp từ file',
  system: 'Hệ thống',
}

const stamp = (s: string) => new Date(s).toLocaleString('vi-VN')
const day = (s: string) => new Date(s).toLocaleDateString('vi-VN')
const num = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 2 })

export function MaterialHistory({
  materialId,
  materialUnit,
}: {
  materialId: string
  /** ĐVT của vật tư — để dòng giá đọc được "18.500 VND/Cây" thay vì số trần. */
  materialUnit?: string
}) {
  const [prices, setPrices] = useState<PricePoint[] | null>(null)
  const [rows, setRows] = useState<Change[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Không reset state ở đầu effect: hộp được mount MỚI cho mỗi vật tư (parent
  // truyền `key`), nên state đầu vào đã sạch — reset ở đây chỉ đẻ thêm một
  // lượt render thừa và vướng luật set-state-in-effect.
  useEffect(() => {
    let alive = true
    Promise.all([
      api<{ prices: PricePoint[] }>(
        `/api/dept/supply/materials/${materialId}/price-history`,
      ),
      api<{ changes: Change[] }>(`/api/dept/warehouse/materials/${materialId}/changes`),
    ])
      .then(([p, c]) => {
        if (!alive) return
        setPrices(p.prices)
        setRows(c.changes)
      })
      .catch(
        (e) =>
          alive && setError(e instanceof ApiError ? e.message : 'Không đọc được lịch sử'),
      )
    return () => {
      alive = false
    }
  }, [materialId])

  if (error) {
    return <p className="t-body py-6 text-center text-[var(--stop)]">{error}</p>
  }
  if (!prices || !rows) {
    return (
      <div className="text-muted-foreground flex items-center justify-center gap-2 py-8">
        <Spinner /> <span className="t-body">Đang đọc lịch sử…</span>
      </div>
    )
  }

  return (
    <Tabs defaultValue="gia">
      <TabsList>
        <TabsTrigger value="gia">Giá mua ({prices.length})</TabsTrigger>
        <TabsTrigger value="thay-doi">Thay đổi ô ({rows.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="gia" className="mt-4">
        {prices.length === 0 ? (
          <EmptyState
            icon={<ReceiptText className="size-5" aria-hidden />}
            title="Chưa mua lần nào"
            description="Chỉ tính đơn đã gửi NCC trở đi — đơn nháp và đơn chờ duyệt chưa phải giá chốt."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {prices.map((p, i) => (
              <div
                key={`${p.po_id}-${i}`}
                className="bg-card rounded-lg border px-3 py-2.5"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="t-data text-[15px] font-medium">
                    {p.unit_price == null ? '—' : num(p.unit_price)}{' '}
                    <span className="text-muted-foreground text-[12px]">
                      {p.currency}/{p.price_unit ?? materialUnit ?? 'ĐVT'}
                    </span>
                  </span>
                  <span className="t-data text-muted-foreground text-[12px]">
                    {num(p.qty_ordered)} {materialUnit ?? ''}
                  </span>
                </div>
                <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                  <span className="t-data">{day(p.at)}</span>
                  <span>·</span>
                  <span>{p.supplier_name}</span>
                  <span>·</span>
                  <span>{poStatusLabel(p.status)}</span>
                  <DocChip>{p.po_code}</DocChip>
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="thay-doi" className="mt-4">
        {rows.length === 0 ? (
          <EmptyState
            icon={<History className="size-5" aria-hidden />}
            title="Chưa có thay đổi nào được ghi vết"
            description="Sổ vết bắt đầu chạy từ 28/08/2026 — thay đổi trước đó không có ở đây."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((c) => (
              <div key={c.id} className="bg-card rounded-lg border px-3 py-2.5">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="t-body font-medium">{fieldLabel(c.field)}</span>
                  <span className="t-data text-muted-foreground line-through">
                    {c.before_value ?? 'trống'}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="t-data text-[var(--primary)]">
                    {c.after_value ?? 'trống'}
                  </span>
                </div>
                <div className="text-muted-foreground mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                  <span className="t-data">{stamp(c.created_at)}</span>
                  <span>·</span>
                  <span>{c.actor_name ?? 'hệ thống'}</span>
                  <span>·</span>
                  <span>{SOURCE_LABELS[c.source] ?? c.source}</span>
                  {c.source_ref && <DocChip>{c.source_ref}</DocChip>}
                </div>
              </div>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  )
}
