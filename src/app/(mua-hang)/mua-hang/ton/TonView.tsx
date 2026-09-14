'use client'

import { useEffect, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type {
  SupplyStockCounts,
  SupplyStockFilter,
  SupplyStockRow,
} from '@/modules/dept/supply/supply-stock.service'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  Num,
  Pick,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  TFoot,
  THead,
  Table,
  showMoney,
  showNum,
} from '@/components/kit'
import { PAGE_SIZE } from './ton-const'

/** Mỗi chip là một CÂU HỎI của người mua, không phải một giá trị enum. */
const CHIPS: { id: SupplyStockFilter; label: string; dem: keyof SupplyStockCounts }[] = [
  { id: 'incoming', label: 'Đang về', dem: 'incoming' },
  { id: 'short', label: 'Thiếu cho lệnh', dem: 'short' },
  { id: 'low', label: 'Dưới ngưỡng', dem: 'low' },
  { id: 'in_stock', label: 'Còn tồn', dem: 'in_stock' },
  { id: 'all', label: 'Tất cả', dem: 'materials' },
]

const ngay = (iso: string | null) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('/') : ''

export function TonView({
  rows,
  total,
  counts,
  page,
  groups,
  filters,
}: {
  rows: SupplyStockRow[]
  total: number
  counts: SupplyStockCounts
  page: number
  groups: string[]
  filters: { q: string; nhom: string; loc: SupplyStockFilter }
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [dangChay, batDau] = useTransition()

  // Ô tìm gõ ở client, truy vấn ở server — cùng luật với màn Vật tư.
  const [nhap, setNhap] = useState(filters.q)
  const [qTruoc, setQTruoc] = useState(filters.q)
  if (filters.q !== qTruoc) {
    setQTruoc(filters.q)
    setNhap(filters.q)
  }
  useEffect(() => {
    if (nhap === filters.q) return
    const t = setTimeout(() => doiLoc({ q: nhap, trang: '1' }), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nhap])

  function doiLoc(patch: Record<string, string>) {
    const p = new URLSearchParams(params.toString())
    for (const [k, v] of Object.entries(patch)) {
      if (!v) p.delete(k)
      else p.set(k, v)
    }
    batDau(() => router.push(`${pathname}?${p.toString()}`, { scroll: false }))
  }

  const soTrang = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const tu = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const den = Math.min(page * PAGE_SIZE, total)
  const chip = CHIPS.find((c) => c.id === filters.loc)
  /*
    ĐƠN CHỜ DUYỆT KHÔNG CỘNG VÀO VỊ THẾ (luật của service). Nhưng nếu trang im
    lặng về điều đó thì người mua nhìn "vị thế" tưởng đã gồm mọi đơn đang chạy
    và quyết định thiếu. Đếm ở đây để chân bảng nói ra.
  */
  const coChoDuyet = rows.filter((r) => r.pending > 0).length

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Mua hàng"
        title="Tồn & cân đối"
        facts={[
          { label: 'Mã đang hiện', value: total.toLocaleString('vi-VN') },
          {
            label: 'Thiếu cho lệnh',
            value: String(counts.short),
            tone: counts.short > 0 ? 'stop' : 'neutral',
          },
          { label: 'Đang về', value: String(counts.incoming) },
          ...(counts.ordered_value != null
            ? [{ label: 'Tiền đang đặt', value: showMoney(counts.ordered_value) + ' ₫' }]
            : []),
        ]}
        actions={<Btn href="/mua-hang/don/moi">+ Soạn đơn mua</Btn>}
      />

      <FilterBar>
        <SearchInput
          value={nhap}
          onChange={setNhap}
          placeholder="Tìm mã hoặc tên vật tư…"
          width={300}
        />
        <Pick
          label="Nhóm vật tư"
          value={filters.nhom}
          onChange={(v) => doiLoc({ nhom: v, trang: '1' })}
          options={[
            { value: '', label: 'Mọi nhóm' },
            ...groups.map((g) => ({ value: g, label: g })),
          ]}
          width={230}
        />
        {CHIPS.map((c) => (
          <Chip
            key={c.id}
            on={filters.loc === c.id}
            count={counts[c.dem] as number}
            onClick={() => doiLoc({ loc: c.id, trang: '1' })}
          >
            {c.label}
          </Chip>
        ))}
      </FilterBar>

      {rows.length === 0 ? (
        <Empty
          headline={`Không có mã nào ở khung nhìn “${chip?.label ?? ''}”`}
          reason={
            filters.loc === 'low'
              ? 'Ngưỡng bù tồn gần như chưa ai khai (5/13.226 mã), nên khung nhìn này gần như luôn trống — đó là chuyện khai dữ liệu, không phải kho đang ổn.'
              : `Bộ lọc hiện tại không còn dòng nào${filters.q.trim() ? ` khớp từ khoá “${filters.q.trim()}”` : ''}.`
          }
          next={
            <Btn
              primary
              onClick={() => doiLoc({ loc: 'all', q: '', nhom: '', trang: '1' })}
            >
              Xem tất cả vật tư
            </Btn>
          }
        />
      ) : (
        <Table>
          <THead pinFirst>
            <th>Mã</th>
            <th>Tên vật tư</th>
            <th style={{ textAlign: 'right' }}>Tồn</th>
            <th style={{ textAlign: 'right' }}>Khả dụng</th>
            <th style={{ textAlign: 'right' }}>Đã đặt</th>
            <th style={{ textAlign: 'right' }}>Vị thế</th>
            <th>Về</th>
            <th>Lần trước mua</th>
          </THead>
          <tbody>
            {rows.map((r) => (
              <Row key={r.material_id}>
                <Cell pin>
                  <Code as="a" href={`/mua-hang/vat-tu?q=${encodeURIComponent(r.code)}`}>
                    {r.code}
                  </Code>
                </Cell>
                <Cell grow>
                  <span className="flex items-baseline gap-2">
                    <span className="truncate" title={r.name}>
                      {r.name}
                    </span>
                    <span className="shrink-0 text-[10.5px] text-[var(--ink-3)]">
                      {r.unit}
                    </span>
                  </span>
                </Cell>
                <Cell num>
                  <Num value={showNum(r.on_hand)} zero="zero" />
                </Cell>
                <Cell num>
                  {/*
                    KHẢ DỤNG ÂM = đã hứa cho lệnh nhiều hơn số đang có. Đây là
                    thứ duy nhất trên dòng đáng tô đỏ: nó nói "lệnh đang chạy sẽ
                    đứng nếu không mua", khác hẳn "tồn bằng 0" vốn bình thường
                    với 13.110 mã chưa từng nhập kho.
                  */}
                  <span className={r.available < 0 ? 'text-[var(--stop)]' : undefined}>
                    <Num value={showNum(r.available)} zero="zero" />
                  </span>
                </Cell>
                <Cell num>
                  <Num value={showNum(r.ordered)} />
                </Cell>
                <Cell num>
                  {/* Con số người mua mang đi quyết định → đúng một số đậm trên dòng. */}
                  <Num value={showNum(r.position)} strong zero="zero" />
                </Cell>
                <Cell muted>
                  {r.eta || r.po_code ? (
                    <span className="flex items-baseline gap-2">
                      <span className="num">{ngay(r.eta) || 'chưa hẹn'}</span>
                      {r.po_id && r.po_code && (
                        <Code as="a" href={`/mua-hang/don/${r.po_id}`}>
                          {r.po_code}
                        </Code>
                      )}
                      {r.po_count > 1 && (
                        <span className="text-[var(--ink-3)]">+{r.po_count - 1}</span>
                      )}
                    </span>
                  ) : (
                    ''
                  )}
                </Cell>
                <Cell muted>
                  {r.last_purchase_price ? (
                    <span className="flex items-baseline gap-2">
                      <span className="num">{showMoney(r.last_purchase_price)}</span>
                      <span className="truncate text-[var(--ink-3)]">
                        {r.supplier_name ?? ''}
                      </span>
                    </span>
                  ) : (
                    ''
                  )}
                </Cell>
              </Row>
            ))}
          </tbody>
          <TFoot
            label={
              <td colSpan={6}>
                Trang {page}/{soTrang} · {tu}–{den} trong {total.toLocaleString('vi-VN')}{' '}
                mã
              </td>
            }
            cells={null}
            caveat={
              coChoDuyet > 0
                ? `Vị thế = khả dụng + đã đặt. KHÔNG gồm đơn chờ Giám đốc duyệt — ${coChoDuyet} mã trên trang này đang có đơn như vậy.`
                : 'Vị thế = khả dụng + đã đặt. KHÔNG gồm đơn còn chờ Giám đốc duyệt.'
            }
          />
        </Table>
      )}

      <StatusBar
        left={[
          <span key="p" className="flex items-center gap-2">
            <Btn
              disabled={page <= 1 || dangChay}
              onClick={() => doiLoc({ trang: String(page - 1) })}
            >
              ‹ Trước
            </Btn>
            <Btn
              disabled={page >= soTrang || dangChay}
              onClick={() => doiLoc({ trang: String(page + 1) })}
            >
              Sau ›
            </Btn>
          </span>,
          dangChay ? 'Đang tải…' : `Khung nhìn: ${chip?.label ?? ''}`,
        ]}
        right={`${tu}–${den} / ${total.toLocaleString('vi-VN')}`}
      />
    </ScreenFrame>
  )
}
