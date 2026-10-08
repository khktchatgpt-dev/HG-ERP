'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Btn,
  Cell,
  Chip,
  Empty,
  FilterBar,
  Num,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  TFoot,
  THead,
  Table,
  Tag,
  TextLink,
} from '@/components/kit'
import { normalizeSearch } from '@/lib/search-text'
import type { BangKeLsxRow } from '@/modules/dept/supply/lsx-bang-ke-list.service'

const COLS = 6

const dmy = (iso: string | null) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

type Loc = 'tinh_duoc' | 'chua_ma' | null

/**
 * DANH SÁCH LỆNH ĐỂ MỞ BẢNG KÊ (khuôn C). Một lệnh "tính được" khi có ít nhất
 * một dòng định mức gắn mã; lệnh chưa có mã nào thì bảng kê trống và tag nói
 * thẳng việc phải làm (gắn mã ở hồ sơ SP, việc của Kỹ thuật).
 *
 * Sáu cột, không cuộn ngang trên laptop (08/10/2026): bỏ chú thích chân bảng và
 * gộp "Kỹ thuật đã kiểm" vào ô định mức.
 */
export function BangKeDanhSachScreen({
  rows,
  today,
}: {
  rows: BangKeLsxRow[]
  today: string
}) {
  const router = useRouter()
  const [loc, setLoc] = useState<Loc>(null)
  const [q, setQ] = useState('')
  const tinhDuoc = rows.filter((r) => r.coded_lines > 0)
  const chuaMa = rows.filter((r) => r.coded_lines === 0)

  const hien = useMemo(() => {
    const tk = normalizeSearch(q).split(/\s+/).filter(Boolean)
    const goc = loc === 'tinh_duoc' ? tinhDuoc : loc === 'chua_ma' ? chuaMa : rows
    return (
      [...goc]
        .filter((r) =>
          tk.every((t) =>
            normalizeSearch(
              `${r.code} ${r.customer_name} ${r.order_codes.join(' ')}`,
            ).includes(t),
          ),
        )
        // Lệnh tính được lên trước; trong cùng nhóm thì xuất sớm lên trước.
        .sort(
          (a, b) =>
            Number(b.coded_lines > 0) - Number(a.coded_lines > 0) ||
            (a.ship_date ?? '9999').localeCompare(b.ship_date ?? '9999'),
        )
    )
  }, [rows, tinhDuoc, chuaMa, loc, q])

  return (
    <ScreenFrame tableMin={720}>
      <ScreenHeader
        compact
        eyebrow="Mua hàng"
        title="Bảng kê vật tư"
        facts={[
          { label: 'Lệnh đang chạy', value: `${rows.length}` },
          { label: 'Tính được bảng kê', value: `${tinhDuoc.length}`, onClick: () => setLoc(loc === 'tinh_duoc' ? null : 'tinh_duoc'), on: loc === 'tinh_duoc' }, // prettier-ignore
          { label: 'Chưa gắn mã định mức', value: `${chuaMa.length}`, tone: chuaMa.length > 0 ? 'warn' : undefined, onClick: () => setLoc(loc === 'chua_ma' ? null : 'chua_ma'), on: loc === 'chua_ma' }, // prettier-ignore
        ]}
      />
      <FilterBar dense label="Tìm và lọc lệnh">
        <Chip on={loc === null} count={rows.length} onClick={() => setLoc(null)}>
          Tất cả
        </Chip>
        <Chip
          on={loc === 'tinh_duoc'}
          count={tinhDuoc.length}
          onClick={() => setLoc(loc === 'tinh_duoc' ? null : 'tinh_duoc')}
        >
          Tính được
        </Chip>
        <Chip
          on={loc === 'chua_ma'}
          count={chuaMa.length}
          onClick={() => setLoc(loc === 'chua_ma' ? null : 'chua_ma')}
        >
          Chưa gắn mã
        </Chip>
        <div className="ml-auto">
          <SearchInput
            value={q}
            onChange={setQ}
            placeholder="Tìm lệnh, khách, đơn hàng…"
            width={240}
          />
        </div>
      </FilterBar>
      {hien.length === 0 ? (
        <Empty
          headline={
            rows.length === 0
              ? 'Không có lệnh nào đang chạy'
              : 'Không lệnh nào khớp bộ lọc'
          }
          reason={
            rows.length === 0
              ? 'Bảng kê chỉ tính cho lệnh đã duyệt hoặc đang sản xuất.'
              : `Có ${rows.length} lệnh đang chạy — bộ lọc hiện tại không để lại dòng nào.`
          }
          next={
            <Btn
              icon="boLoc"
              onClick={() => {
                setLoc(null)
                setQ('')
              }}
            >
              Bỏ lọc
            </Btn>
          }
        />
      ) : (
        <Table label="Lệnh sản xuất để mở bảng kê">
          <THead pinFirst>
            <th>Lệnh</th>
            <th>Khách · đơn hàng</th>
            <th>Xuất</th>
            <th>Mốc vật tư</th>
            <th style={{ textAlign: 'right' }}>SP</th>
            <th>Bảng kê</th>
          </THead>
          <tbody>
            {hien.map((r) => {
              const tinh = r.coded_lines > 0
              const treMoc = !!r.materials_due_at && r.materials_due_at < today
              const dinhMuc =
                r.bom_lines > 0
                  ? `${r.coded_lines}/${r.bom_lines} dòng có mã · Kỹ thuật kiểm ${r.confirmed_products}/${r.products} SP`
                  : 'chưa có dòng định mức'
              return (
                <Row key={r.id} onClick={() => router.push(`/mua-hang/bang-ke/${r.id}`)}>
                  <Cell pin>
                    <TextLink href={`/mua-hang/bang-ke/${r.id}`} strong>
                      {r.code}
                    </TextLink>
                  </Cell>
                  <Cell grow className="min-w-[200px]">
                    <span className="block truncate" title={r.customer_name}>
                      {r.customer_name}
                    </span>
                    {r.order_codes.length > 0 && (
                      <span
                        className="text-k-label block truncate text-[var(--ink-3)]"
                        title={r.order_codes.join(', ')}
                      >
                        {r.order_codes.join(', ')}
                      </span>
                    )}
                  </Cell>
                  <Cell num>{dmy(r.ship_date)}</Cell>
                  <Cell num className={treMoc ? 'text-[var(--stop)]' : undefined}>
                    {dmy(r.materials_due_at)}
                  </Cell>
                  <Cell num>
                    <Num value={String(r.products)} />
                  </Cell>
                  <Cell className="min-w-[200px]">
                    {tinh ? (
                      <Tag tone="done">Tính được</Tag>
                    ) : r.bom_lines > 0 ? (
                      <Tag tone="warn">Định mức chưa gắn mã</Tag>
                    ) : (
                      <Tag tone="neutral">Chưa có định mức</Tag>
                    )}
                    <span
                      className="text-k-label block truncate text-[var(--ink-3)]"
                      title={dinhMuc}
                    >
                      {dinhMuc}
                    </span>
                  </Cell>
                </Row>
              )
            })}
          </tbody>
          <TFoot label={<td colSpan={COLS}>Cộng {hien.length} lệnh</td>} cells={null} />
        </Table>
      )}
    </ScreenFrame>
  )
}
