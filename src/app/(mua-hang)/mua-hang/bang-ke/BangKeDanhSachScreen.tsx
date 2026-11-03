'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { normalizeSearch } from '@/lib/search-text'
import type { BangKeLsxRow } from '@/modules/dept/supply/lsx-bang-ke-list.service'
import { ChipLoc, DauTrang, HangLoc, NUM, Nhan, Nut, TD, TF, TH, Trang } from '../_erp/ui' // prettier-ignore

const COLS = 6
const LINK = 'text-[var(--act-text)] font-semibold underline-offset-2 hover:underline'

type Loc = 'tinh_duoc' | 'chua_ma' | null

const dmy = (iso: string | null) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}

/**
 * DANH SÁCH LỆNH CỦA KẾ HOẠCH MUA — KHÔNG KIT (02/11/2026, B2 bản vẽ
 * https://claude.ai/artifact/RL9ToGvjouLFkhNVeruAbS). Câu màn trả lời: lệnh nào
 * tính được bảng kê "còn phải mua gì". Bỏ dải ô số đầu trang của bản kit — cùng
 * con số từng nói hai lần (ô số + chip).
 *
 * Chuyện "lệnh nào đổi từ lần soát" đã dời sang trang riêng `/mua-hang/soat`
 * (T1) — màn này chỉ còn chọn lệnh để lên kế hoạch mua.
 */
export function BangKeDanhSachScreen({
  rows,
  today,
}: {
  rows: BangKeLsxRow[]
  today: string
}) {
  const router = useRouter()
  const tinhDuoc = useMemo(() => rows.filter((r) => r.coded_lines > 0), [rows])
  const chuaMa = useMemo(() => rows.filter((r) => r.coded_lines === 0), [rows])
  const [loc, setLoc] = useState<Loc>(null)
  const [q, setQ] = useState('')

  const hien = useMemo(() => {
    const tk = normalizeSearch(q).split(/\s+/).filter(Boolean)
    const goc = loc === 'tinh_duoc' ? tinhDuoc : loc === 'chua_ma' ? chuaMa : rows
    return (
      goc
        .filter((r) =>
          tk.every(
            (t) =>
            normalizeSearch(`${r.code} ${r.customer_name} ${r.order_codes.join(' ')}`).includes(t), // prettier-ignore
          ),
        )
        // Lệnh tính được lên trước; trong mỗi nhóm, xuất sớm trước.
        .sort(
          (a, b) =>
            Number(b.coded_lines > 0) - Number(a.coded_lines > 0) ||
            (a.ship_date ?? '9999').localeCompare(b.ship_date ?? '9999'),
        )
    )
  }, [rows, tinhDuoc, chuaMa, loc, q])

  const chip = (k: Exclude<Loc, null>, n: number, nhan: string) => (
    <ChipLoc on={loc === k} count={n} onClick={() => setLoc(loc === k ? null : k)}>
      {nhan}
    </ChipLoc>
  )

  return (
    <Trang>
      <DauTrang eyebrow="Mua hàng" title="Kế hoạch mua" />
      <HangLoc>
        <ChipLoc on={loc === null} count={rows.length} onClick={() => setLoc(null)}>
          Tất cả
        </ChipLoc>
        {chip('tinh_duoc', tinhDuoc.length, 'Tính được')}
        {chip('chua_ma', chuaMa.length, 'Chưa gắn mã')}
        <input
          type="search"
          aria-label="Tìm lệnh, khách, đơn hàng"
          placeholder="Tìm lệnh, khách, đơn hàng…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="ml-auto w-[240px] rounded-[3px] border border-[var(--line)] bg-[var(--surface-card)] px-2 py-[4px] text-[12.5px] outline-none focus:border-[var(--act)]"
        />
      </HangLoc>
      <div className="min-h-0 flex-1 overflow-auto bg-[var(--surface-card)]">
        <table className="w-full min-w-[960px] table-fixed border-collapse">
          <thead>
            <tr>
              <th className={`${TH} w-[148px]`}>Lệnh</th>
              <th className={`${TH} w-[176px]`}>Khách</th>
              <th className={`${TH} w-[104px]`}>Xuất</th>
              <th className={`${TH} w-[104px]`}>Mốc vật tư</th>
              <th className={`${TH} w-[100px] text-right`}>SP · cái</th>
              <th className={TH}>Bảng kê</th>
            </tr>
          </thead>
          <tbody>
            {hien.length === 0 ? (
              <tr>
                <td colSpan={COLS} className="px-4 py-6">
                  <Rong
                    tong={rows.length}
                    boLoc={() => {
                      setLoc(null)
                      setQ('')
                    }}
                  />
                </td>
              </tr>
            ) : (
              hien.map((r) => (
                <DongLenh
                  key={r.id}
                  r={r}
                  today={today}
                  onOpen={() => router.push(`/mua-hang/bang-ke/${r.id}`)}
                />
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={COLS} className={TF}>
                Cộng {hien.length} lệnh
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </Trang>
  )
}

function DongLenh({
  r,
  today,
  onOpen,
}: {
  r: BangKeLsxRow
  today: string
  onOpen: () => void
}) {
  const treMoc = !!r.materials_due_at && r.materials_due_at < today
  const dinhMuc =
    r.bom_lines > 0
      ? `${r.coded_lines}/${r.bom_lines} dòng có mã · KT kiểm ${r.confirmed_products}/${r.products}`
      : 'chưa có dòng định mức'
  return (
    <tr className="cursor-pointer hover:bg-[var(--surface-hover)]" onClick={onOpen}>
      <td className={TD}>
        <Link
          href={`/mua-hang/bang-ke/${r.id}`}
          className={`font-mono text-[12.5px] ${LINK}`}
          onClick={(e) => e.stopPropagation()}
        >
          {r.code}
        </Link>
      </td>
      <td className={`${TD} max-w-0`}>
        <span className="block truncate" title={r.customer_name}>
          {r.customer_name}
        </span>
        {r.order_codes.length > 0 && (
          <span
            className="block truncate text-[11.5px] text-[var(--ink-3)]"
            title={r.order_codes.join(', ')}
          >
            {r.order_codes.join(', ')}
          </span>
        )}
      </td>
      <td className={`${TD} font-mono whitespace-nowrap tabular-nums`}>
        {dmy(r.ship_date)}
      </td>
      <td
        className={`${TD} font-mono whitespace-nowrap tabular-nums ${treMoc ? 'text-[var(--stop)]' : r.materials_due_at ? '' : 'text-[var(--ink-3)]'}`}
      >
        {dmy(r.materials_due_at)}
      </td>
      <td className={`${TD} ${NUM}`}>
        {r.products} · {r.product_qty.toLocaleString('vi-VN')}
      </td>
      <td className={`${TD} max-w-0`}>
        {r.coded_lines > 0 ? (
          <Nhan tone="done">Tính được</Nhan>
        ) : r.bom_lines > 0 ? (
          <Nhan tone="warn">Định mức chưa gắn mã</Nhan>
        ) : (
          <Nhan>Chưa có định mức</Nhan>
        )}
        <span
          className="block truncate text-[11.5px] text-[var(--ink-3)]"
          title={dinhMuc}
        >
          {dinhMuc}
        </span>
      </td>
    </tr>
  )
}

function Rong({ tong, boLoc }: { tong: number; boLoc: () => void }) {
  if (tong === 0)
    return (
      <div className="grid justify-items-start gap-1.5">
        <b>Không có lệnh nào đang chạy</b>
        <span className="text-[var(--ink-2)]">
          Kế hoạch mua chỉ tính cho lệnh đã duyệt hoặc đang sản xuất.
        </span>
      </div>
    )
  return (
    <div className="grid justify-items-start gap-1.5">
      <b>Không lệnh nào khớp bộ lọc</b>
      <span className="text-[var(--ink-2)]">
        Có {tong} lệnh đang chạy — bộ lọc hiện tại không để lại dòng nào.
      </span>
      <Nut onClick={boLoc}>Bỏ lọc</Nut>
    </div>
  )
}
