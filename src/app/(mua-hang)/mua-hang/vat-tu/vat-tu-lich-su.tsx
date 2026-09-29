'use client'

import { Cell, FastTab, Hint, Num, Row, THead, Table, showMoney } from '@/components/kit'
import { MATERIAL_FIELD_LABELS } from '@/lib/material-group-fields'

export type GiaMua = {
  po_id: string
  po_code: string
  supplier_name: string | null
  currency: string
  unit_price: number
  qty_ordered: number
  at: string
}
export type ThayDoi = {
  id: string
  field: string
  before_value: string | null
  after_value: string | null
  source: string
  created_at: string
  actor_name?: string | null
}

const NHAN: Record<string, string> = {
  ...MATERIAL_FIELD_LABELS,
  name: 'Tên',
  unit: 'ĐVT',
  code: 'Mã',
  group_name: 'Nhóm',
  note: 'Ghi chú',
  price_unit: 'Tính giá theo',
  last_purchase_price: 'Giá tham chiếu',
  default_supplier_id: 'NCC mặc định',
  over_tolerance_pct: 'Nhận vượt tối đa',
  po_template: 'Mẫu đơn',
  shelf_location: 'Kệ',
  min_stock: 'Ngưỡng tồn',
  needs_review: 'Chờ Kho rà',
  is_active: 'Đang dùng',
}
const NGUON: Record<string, string> = {
  manual: 'sửa tay',
  po_enrich: 'từ đơn mua',
  import: 'script nạp',
  system: 'máy',
}
const ngay = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/**
 * LỊCH SỬ VẬT TƯ — gập, cuối panel Sửa. Hai câu người mua hỏi trước khi sửa:
 * "lần trước mua giá bao nhiêu, của ai" và "ai đã đổi mã này, đổi gì".
 * Giá lấy từ DÒNG ĐƠN (price-history), vết từ `warehouse_material_changes` (0177).
 */
export function VatTuLichSu({
  gia,
  doi,
}: {
  gia: GiaMua[] | null
  doi: ThayDoi[] | null
}) {
  const tay = doi?.filter((c) => c.source !== 'import').length ?? 0
  return (
    <FastTab
      title="Lịch sử"
      summary={[
        ['Giá mua', gia ? `${gia.length} lần` : '…'],
        ['Sửa danh mục', doi ? `${tay} lần (trừ script nạp)` : '…'],
      ]}
    >
      <div className="k-sec">Giá mua trên đơn</div>
      {gia && gia.length === 0 ? (
        <Hint size="sm">Chưa đơn nào trong hệ thống mua mã này.</Hint>
      ) : (
        <Table>
          <THead>
            <th>Đơn</th>
            <th>NCC</th>
            <th>Ngày</th>
            <th style={{ textAlign: 'right' }}>SL</th>
            <th style={{ textAlign: 'right' }}>Đơn giá</th>
          </THead>
          <tbody>
            {(gia ?? []).slice(0, 10).map((g, i) => (
              <Row key={`${g.po_id}-${i}`}>
                <Cell>
                  <a
                    className="num text-[var(--act)] hover:underline"
                    href={`/mua-hang/don/${g.po_id}`}
                  >
                    {g.po_code}
                  </a>
                </Cell>
                <Cell muted>{g.supplier_name ?? '—'}</Cell>
                <Cell muted>{ngay(g.at)}</Cell>
                <Cell num>
                  <Num value={showMoney(g.qty_ordered, { digits: 2 })} />
                </Cell>
                <Cell num>
                  <Num
                    value={showMoney(g.unit_price, {
                      digits: g.currency === 'VND' ? 0 : 2,
                    })}
                    strong
                  />
                  {g.currency !== 'VND' && (
                    <span className="text-k-label ml-1">{g.currency}</span>
                  )}
                </Cell>
              </Row>
            ))}
          </tbody>
        </Table>
      )}

      <div className="k-sec">Thay đổi danh mục</div>
      {doi && doi.length === 0 ? (
        <Hint size="sm">Chưa ai sửa mã này.</Hint>
      ) : (
        <Table>
          <THead>
            <th>Ngày</th>
            <th>Ô</th>
            <th>Trước → sau</th>
            <th>Ai / nguồn</th>
          </THead>
          <tbody>
            {(doi ?? []).slice(0, 20).map((c) => (
              <Row key={c.id}>
                <Cell muted>{ngay(c.created_at)}</Cell>
                <Cell>{NHAN[c.field] ?? c.field}</Cell>
                <Cell grow>
                  <span className="text-[var(--ink-3)]">{c.before_value ?? '—'}</span> →{' '}
                  {c.after_value ?? '—'}
                </Cell>
                <Cell muted>
                  {c.actor_name ?? ''}
                  {c.actor_name ? ' · ' : ''}
                  {NGUON[c.source] ?? c.source}
                </Cell>
              </Row>
            ))}
          </tbody>
        </Table>
      )}
    </FastTab>
  )
}
