'use client'

import { todayVn } from '@/lib/date-vn'
import { useMemo, useState } from 'react'
import type { PriceBookRow } from '@/modules/dept/supply/pos.repo'
import {
  Btn,
  Cell,
  Chip,
  Code,
  Empty,
  FilterBar,
  Num,
  Row,
  ScreenFrame,
  ScreenHeader,
  SearchInput,
  StatusBar,
  TFoot,
  THead,
  Table,
  Tag,
  showMoney,
} from '@/components/kit'

const ngay = (iso: string) => iso.slice(0, 10).split('-').reverse().join('/')

/** Bao nhiêu ngày kể từ lần mua gần nhất — giá cũ quá thì đừng đem đi chào. */
const CU_NGAY = 180

function tuoi(at: string, today: string): number {
  const t = (s: string) => Date.parse(s.slice(0, 10) + 'T00:00:00Z')
  return Math.round((t(today) - t(at)) / 86_400_000)
}

export function BangGiaScreen({
  rows,
  canEdit,
}: {
  rows: PriceBookRow[]
  canEdit: boolean
}) {
  const [q, setQ] = useState('')
  const [chip, setChip] = useState('all')
  const [today] = useState(() => todayVn())

  /*
    MÃ MUA CỦA NHIỀU NCC là thứ đáng xem nhất trên màn này: chỉ khi đó mới có
    cái để SO. Một mã một NCC thì "bảng giá" chỉ là ghi lại lần mua trước.
  */
  const nhieuNcc = useMemo(() => {
    const c = new Map<string, number>()
    for (const r of rows) c.set(r.material_id, (c.get(r.material_id) ?? 0) + 1)
    return new Set([...c.entries()].filter(([, n]) => n > 1).map(([id]) => id))
  }, [rows])

  const CHIPS: { id: string; label: string; test: (r: PriceBookRow) => boolean }[] = [
    { id: 'all', label: 'Tất cả', test: () => true },
    { id: 'multi', label: 'Mua của nhiều NCC', test: (r) => nhieuNcc.has(r.material_id) },
    { id: 'up', label: 'Giá đã tăng', test: (r) => r.prev != null && r.price > r.prev },
    {
      id: 'old',
      label: `Cũ hơn ${CU_NGAY} ngày`,
      test: (r) => tuoi(r.at, today) > CU_NGAY,
    },
  ]

  const kept = useMemo(() => {
    const test = CHIPS.find((c) => c.id === chip)?.test ?? (() => true)
    const needle = q.trim().toLowerCase()
    return rows
      .filter(
        (r) =>
          test(r) &&
          (!needle ||
            [r.code, r.name, r.supplier_name, r.group_name]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(needle))),
      )
      .sort((a, b) =>
        a.code === b.code ? (a.at < b.at ? 1 : -1) : a.code < b.code ? -1 : 1,
      )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, chip, nhieuNcc, today])

  const soMa = new Set(kept.map((r) => r.material_id)).size
  const soNcc = new Set(kept.map((r) => r.supplier_id)).size

  return (
    <ScreenFrame>
      <ScreenHeader
        compact
        eyebrow="Mua hàng"
        title="Bảng giá"
        facts={[
          { label: 'Cặp mã × NCC', value: String(rows.length) },
          {
            label: 'Mã vật tư',
            value: String(new Set(rows.map((r) => r.material_id)).size),
          },
          {
            label: 'So được giá',
            value: String(nhieuNcc.size),
            tone: nhieuNcc.size > 0 ? 'done' : 'neutral',
          },
        ]}
        actions={
          canEdit ? (
            <Btn primary icon="them" href="/mua-hang/don/moi">
              Soạn đơn mua
            </Btn>
          ) : undefined
        }
      />

      <FilterBar>
        <SearchInput
          value={q}
          onChange={setQ}
          placeholder="Tìm mã, tên vật tư hoặc nhà cung cấp…"
          width={320}
        />
        {CHIPS.map((c) => (
          <Chip
            key={c.id}
            on={chip === c.id}
            count={rows.filter(c.test).length}
            onClick={() => setChip(c.id)}
          >
            {c.label}
          </Chip>
        ))}
      </FilterBar>

      {kept.length === 0 ? (
        <Empty
          headline="Chưa có giá nào để bày"
          reason={
            rows.length === 0
              ? 'Bảng này gom giá từ ĐƠN ĐÃ GỬI nhà cung cấp — đơn còn nháp hay chờ duyệt thì giá chưa phải giá chốt nên không tính. Gửi đơn đầu tiên đi thì giá hiện ở đây.'
              : `Trong ${rows.length} cặp mã × NCC, không cặp nào khớp bộ lọc hiện tại${q.trim() ? ` và từ khoá “${q.trim()}”` : ''}.`
          }
          next={
            <Btn
              primary
              onClick={() => {
                setQ('')
                setChip('all')
              }}
            >
              {rows.length === 0 ? 'Mở danh sách đơn mua' : `Xem cả ${rows.length} dòng`}
            </Btn>
          }
        />
      ) : (
        <Table>
          <THead pinFirst>
            <th>Mã vật tư</th>
            <th>Tên</th>
            <th>Nhà cung cấp</th>
            <th style={{ textAlign: 'right' }}>Giá gần nhất</th>
            <th style={{ textAlign: 'right' }}>Lần trước</th>
            <th>Mua lần cuối</th>
            <th style={{ textAlign: 'right' }}>Số lần</th>
          </THead>
          <tbody>
            {kept.map((r) => {
              const cu = tuoi(r.at, today)
              const tang = r.prev != null && r.price > r.prev
              const giam = r.prev != null && r.price < r.prev
              return (
                <Row key={`${r.material_id}|${r.supplier_id}`}>
                  <Cell pin>
                    <span className="flex items-center gap-2">
                      <Code
                        as="a"
                        href={`/mua-hang/vat-tu?q=${encodeURIComponent(r.code)}`}
                      >
                        {r.code}
                      </Code>
                      {nhieuNcc.has(r.material_id) && <Tag tone="done">so được</Tag>}
                    </span>
                  </Cell>
                  <Cell grow>
                    <span className="truncate" title={r.name}>
                      {r.name}
                    </span>
                  </Cell>
                  {/*
                    NCC cũng `grow`: tên nhà cung cấp là chuỗi dài nhất bảng
                    ("KIMPACK PACKAGING JOINT STOCK COMPANY"), không giới hạn
                    thì nó ăn hết chỗ và cột Tên vật tư còn đúng một chữ cái.
                    Hai cột cùng co giãn thì chia nhau phần thừa.
                  */}
                  <Cell grow muted>
                    <span className="truncate" title={r.supplier_name}>
                      {r.supplier_name}
                    </span>
                  </Cell>
                  <Cell num>
                    <span className="flex items-baseline justify-end gap-1">
                      <Num
                        value={showMoney(r.price, {
                          digits: r.currency === 'VND' ? 0 : 2,
                        })}
                        strong
                      />
                      <span className="text-[10.5px] text-[var(--ink-3)]">
                        {r.currency === 'VND' ? '₫' : r.currency}
                        {r.price_unit ? `/${r.price_unit}` : `/${r.unit}`}
                      </span>
                    </span>
                  </Cell>
                  <Cell num>
                    {/*
                      Mũi tên CHỈ khi có lần trước để so. Không có thì để trống —
                      vẽ "0%" cho lần mua đầu là bịa ra một so sánh không tồn tại.
                    */}
                    {r.prev != null ? (
                      <span
                        className={
                          tang
                            ? 'text-[var(--stop)]'
                            : giam
                              ? 'text-[var(--done)]'
                              : 'text-[var(--ink-3)]'
                        }
                      >
                        {showMoney(r.prev, { digits: r.currency === 'VND' ? 0 : 2 })}
                        {tang ? ' ↑' : giam ? ' ↓' : ''}
                      </span>
                    ) : (
                      <Num value="" />
                    )}
                  </Cell>
                  <Cell muted>
                    <span className="flex items-baseline gap-2">
                      <span className="num">{ngay(r.at)}</span>
                      {cu > CU_NGAY && (
                        <span className="text-[var(--warn)]">{cu} ngày</span>
                      )}
                    </span>
                  </Cell>
                  <Cell num>
                    <Num value={String(r.times)} />
                  </Cell>
                </Row>
              )
            })}
          </tbody>
          <TFoot
            label={
              <td colSpan={5}>
                Cộng {kept.length} cặp · {soMa} mã vật tư · {soNcc} nhà cung cấp
              </td>
            }
            cells={null}
            caveat={`Giá lấy từ ĐƠN ĐÃ GỬI NCC trở đi — đơn nháp và chờ duyệt không tính. Giá cũ hơn ${CU_NGAY} ngày được đánh dấu: đừng đem đi chào lại mà chưa hỏi.`}
          />
        </Table>
      )}

      <StatusBar
        left={[
          chip === 'all' && !q.trim() ? 'Khung nhìn: tất cả' : 'Khung nhìn: đang lọc',
          'Nguồn: lịch sử đơn mua, không phải bảng giá khai tay',
        ]}
        right={`${kept.length} / ${rows.length} dòng`}
      />
    </ScreenFrame>
  )
}
