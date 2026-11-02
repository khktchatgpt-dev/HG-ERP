'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ngayGioVn } from '@/lib/date-vn'
import { normalizeSearch } from '@/lib/search-text'
import type { BangKeLsxRow } from '@/modules/dept/supply/lsx-bang-ke-list.service'
import type { TrangThaiLenhDoi } from '@/modules/dept/supply/lenh-doi.service'
import { ChipLoc, DauTrang, HangLoc, NUM, Nhan, Nut, TD, TF, TH, ThanhDuoi, Trang } from '../_erp/ui' // prettier-ignore

const COLS = 7
const LINK = 'text-[var(--act-text)] font-semibold underline-offset-2 hover:underline'

type Loc = 'cho_soat' | 'tinh_duoc' | 'chua_ma' | null

const dmy = (iso: string | null) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
/** "dd/mm" theo giờ VN của một mốc giờ. */
const ngay = (at: string | null) => (at ? ngayGioVn(at).slice(0, 5) : '')

/**
 * DANH SÁCH LỆNH CỦA KẾ HOẠCH MUA — dựng lại KHÔNG KIT (02/11/2026, B2 bản vẽ
 * https://claude.ai/artifact/RL9ToGvjouLFkhNVeruAbS). Câu màn trả lời: LỆNH
 * NÀO ĐỔI TỪ LẦN TÔI SOÁT, và lệnh nào tính được bảng kê.
 *
 * Lệnh chờ soát lên đầu (vạch cam), chip "Chờ soát" mở sẵn khi có. Số trên
 * chip = số trên menu: cùng `trangThaiChoSoat`. Bỏ dải ô số đầu trang của bản
 * kit — cùng con số từng nói hai lần (ô số + chip).
 */
export function BangKeDanhSachScreen({
  rows,
  trangThai,
  loiTrangThai,
  today,
}: {
  rows: BangKeLsxRow[]
  trangThai: Record<string, TrangThaiLenhDoi>
  loiTrangThai: string | null
  today: string
}) {
  const router = useRouter()
  const choSoat = useMemo(
    () => rows.filter((r) => trangThai[r.id]?.choSoat),
    [rows, trangThai],
  )
  const tinhDuoc = useMemo(() => rows.filter((r) => r.coded_lines > 0), [rows])
  const chuaMa = useMemo(() => rows.filter((r) => r.coded_lines === 0), [rows])
  const [loc, setLoc] = useState<Loc>(choSoat.length > 0 ? 'cho_soat' : null)
  const [q, setQ] = useState('')

  const hien = useMemo(() => {
    const tk = normalizeSearch(q).split(/\s+/).filter(Boolean)
    const goc =
      loc === 'cho_soat'
        ? choSoat
        : loc === 'tinh_duoc'
          ? tinhDuoc
          : loc === 'chua_ma'
            ? chuaMa
            : rows
    const moiNhat = (r: BangKeLsxRow) => trangThai[r.id]?.suaSau?.lanCuoi ?? ''
    return (
      goc
        .filter((r) =>
          tk.every(
            (t) =>
            normalizeSearch(`${r.code} ${r.customer_name} ${r.order_codes.join(' ')}`).includes(t), // prettier-ignore
          ),
        )
        // Chờ soát lên đầu, lệnh sửa gần nhất trước; còn lại xuất sớm trước.
        .sort(
          (a, b) =>
            Number(!!trangThai[b.id]?.choSoat) - Number(!!trangThai[a.id]?.choSoat) ||
            moiNhat(b).localeCompare(moiNhat(a)) ||
            (a.ship_date ?? '9999').localeCompare(b.ship_date ?? '9999'),
        )
    )
  }, [rows, choSoat, tinhDuoc, chuaMa, loc, q, trangThai])

  const chip = (k: Exclude<Loc, null>, n: number, nhan: string) => (
    <ChipLoc on={loc === k} count={n} onClick={() => setLoc(loc === k ? null : k)}>
      {nhan}
    </ChipLoc>
  )

  return (
    <Trang>
      <DauTrang eyebrow="Mua hàng" title="Kế hoạch mua" />
      <HangLoc>
        {chip('cho_soat', choSoat.length, 'Chờ soát')}
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
              <th className={TH}>Thay đổi từ lần soát</th>
              <th className={`${TH} w-[200px]`}>Bảng kê</th>
            </tr>
          </thead>
          <tbody>
            {hien.length === 0 ? (
              <tr>
                <td colSpan={COLS} className="px-4 py-6">
                  <Rong
                    loc={loc}
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
                  t={trangThai[r.id]}
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
                {loc === 'cho_soat' && rows.length > hien.length && (
                  <span className="font-normal text-[var(--ink-3)]">
                    {' '}
                    · {rows.length - hien.length} lệnh còn lại không đổi
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      {loiTrangThai && (
        <ThanhDuoi
          left={
            <span className="text-[var(--stop)]">
              Chưa tính được lệnh nào đổi: {loiTrangThai}
            </span>
          }
        />
      )}
    </Trang>
  )
}

function DongLenh({
  r,
  t,
  today,
  onOpen,
}: {
  r: BangKeLsxRow
  t: TrangThaiLenhDoi | undefined
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
      <td className={`${TD} ${t?.choSoat ? 'shadow-[inset_3px_0_0_var(--warn)]' : ''}`}>
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
        <ThayDoiO t={t} />
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

/** Ô "Thay đổi từ lần soát": nhãn việc + một dòng nói so với mốc nào, ai sửa. */
function ThayDoiO({ t }: { t: TrangThaiLenhDoi | undefined }) {
  if (!t) return null
  if (!t.choSoat)
    return t.moc.k === 'soat' ? (
      <span className="text-[12px] text-[var(--ink-3)]">
        soát {ngay(t.moc.luc)}
        {t.moc.boi && ` · ${t.moc.boi}`}
      </span>
    ) : null
  const s = t.suaSau
  // Đủ họ tên: cột này rộng, và tên cuối dễ trùng / vô nghĩa ("Điền Hg" → "Hg").
  const ai = s
    ? [...s.nguoi, ...(s.khongTen ? [`${s.khongTen} dòng nạp không ghi người`] : [])].join(', ') // prettier-ignore
    : ''
  const sau =
    t.moc.k === 'duyet' && !t.moc.laDuyet ? 'Sửa sau phát lệnh' : 'Sửa sau duyệt'
  const phu =
    t.moc.k === 'soat'
      ? `so với lần soát ${ngay(t.moc.luc)}${t.moc.boi ? ` · ${t.moc.boi}` : ''}`
      : t.soMa > 0
        ? `so với lúc ${t.moc.laDuyet ? 'duyệt' : 'phát lệnh'} ${ngay(t.moc.luc)}${s ? ` · ${ai} sửa tới ${ngay(s.lanCuoi)}` : ''}` // prettier-ignore
        : `${s?.dongDinhMuc ?? 0} dòng sửa tới ${ngay(s?.lanCuoi ?? null)}${ai ? ` · ${ai}` : ''} · chưa có số cũ` // prettier-ignore
  return (
    <>
      <span className="flex flex-wrap gap-1">
        {t.soMa > 0 && <Nhan tone="warn">{t.soMa} mã đổi</Nhan>}
        {t.soThongTin > 0 && <Nhan tone="warn">{t.soThongTin} thông tin lệnh đổi</Nhan>}
        {t.soMa === 0 && t.soThongTin === 0 && <Nhan tone="warn">{sau}</Nhan>}
      </span>
      <span className="block truncate text-[11.5px] text-[var(--ink-3)]" title={phu}>
        {phu}
      </span>
    </>
  )
}

function Rong({ loc, tong, boLoc }: { loc: Loc; tong: number; boLoc: () => void }) {
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
      <b>
        {loc === 'cho_soat'
          ? 'Không lệnh nào đổi từ lần soát cuối'
          : 'Không lệnh nào khớp bộ lọc'}
      </b>
      <span className="text-[var(--ink-2)]">
        {loc === 'cho_soat'
          ? `Định mức và lệnh của ${tong} lệnh đang chạy khớp với mốc đã soát.`
          : `Có ${tong} lệnh đang chạy — bộ lọc hiện tại không để lại dòng nào.`}
      </span>
      <Nut onClick={boLoc}>
        {loc === 'cho_soat' ? `Xem tất cả ${tong} lệnh` : 'Bỏ lọc'}
      </Nut>
    </div>
  )
}
