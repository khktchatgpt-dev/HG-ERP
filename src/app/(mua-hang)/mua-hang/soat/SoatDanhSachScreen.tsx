'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouterBao } from '@/lib/tai-trang'
import { ngayGioVn } from '@/lib/date-vn'
import { normalizeSearch } from '@/lib/search-text'
import type { BangKeLsxRow } from '@/modules/dept/supply/lsx-bang-ke-list.service'
import type { TrangThaiLenhDoi } from '@/modules/dept/supply/lenh-doi.service'
import { ChipLoc, DauTrang, HangLoc, Nhan, Nut, TD, TF, TH, ThanhDuoi, Trang } from '../_erp/ui' // prettier-ignore

const COLS = 8
const LINK = 'text-[var(--act-text)] font-semibold underline-offset-2 hover:underline'
const NGAY = 'font-mono tabular-nums whitespace-nowrap'
/** "Đã soát gần đây" = soát trong 14 ngày (Q4 bản vẽ). */
const GAN_DAY_MS = 14 * 86_400_000

type Loc = 'cho_soat' | 'dinh_muc' | 'lenh' | 'don' | 'da_soat' | null

const dmy = (iso: string | null) => {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  return `${d}/${m}/${y}`
}
const ngay = (at: string | null) => (at ? ngayGioVn(at).slice(0, 5) : '')

const coDinhMuc = (t: TrangThaiLenhDoi | undefined) => !!t?.choSoat && (t.soMa > 0 || t.soDongDm > 0 || !!t.suaSau) // prettier-ignore
/** Lần sửa gần nhất: nhật ký định mức / lệnh (từ 02/11) hoặc cột "sửa lần cuối" (trước đó). */
const suaCuoi = (t: TrangThaiLenhDoi | undefined): { luc: string; ai: string } | null => {
  if (!t?.choSoat) return null
  const s = t.suaSau
  const truoc = s?.lanCuoi
    ? { luc: s.lanCuoi, ai: [...s.nguoi, ...(s.khongTen ? [`${s.khongTen} dòng không ghi người`] : [])].join(', ') } // prettier-ignore
    : null
  const dm = t.nkCuoi
    ? { luc: t.nkCuoi.luc, ai: t.nkCuoi.boi ?? 'không ghi người' }
    : null
  return !truoc ? dm : !dm ? truoc : dm.luc >= truoc.luc ? dm : truoc
}
const coLenh = (t: TrangThaiLenhDoi | undefined) => !!t?.choSoat && t.soThongTin > 0
/** Đơn hàng đổi sau mốc, HOẶC dòng đơn mà lệnh chưa sửa theo (trạng thái bây giờ). */
const coDon = (t: TrangThaiLenhDoi | undefined) =>
  (!!t?.choSoat && t.soDon > 0) || (t?.lechDon ?? 0) > 0

/**
 * DANH SÁCH LỆNH CỦA TRANG SOÁT THAY ĐỔI — KHÔNG KIT. Câu màn trả lời: LỆNH NÀO
 * ĐỔI TỪ LẦN TÔI SOÁT, ĐỔI Ở NGUỒN NÀO, AI SỬA. Mỗi lệnh một dòng, mỗi nguồn một
 * cột (đơn hàng Sale thêm ở T4). Chip "Chờ soát" = số trên menu: cùng
 * `trangThaiChoSoat`. Bấm dòng mở trang chi tiết soát của lệnh.
 */
export function SoatDanhSachScreen({
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
  const router = useRouterBao()
  const nhom = useMemo(() => {
    const moc = Date.parse(`${today}T00:00:00+07:00`) - GAN_DAY_MS
    return {
      cho_soat: rows.filter((r) => trangThai[r.id]?.choSoat),
      dinh_muc: rows.filter((r) => coDinhMuc(trangThai[r.id])),
      lenh: rows.filter((r) => coLenh(trangThai[r.id])),
      don: rows.filter((r) => coDon(trangThai[r.id])),
      da_soat: rows.filter((r) => {
        const m = trangThai[r.id]?.moc
        return m?.k === 'soat' && Date.parse(m.luc) >= moc
      }),
    }
  }, [rows, trangThai, today])
  const [loc, setLoc] = useState<Loc>(nhom.cho_soat.length > 0 ? 'cho_soat' : null)
  const [q, setQ] = useState('')

  const hien = useMemo(() => {
    const tk = normalizeSearch(q).split(/\s+/).filter(Boolean)
    const goc = loc ? nhom[loc] : rows
    const moiNhat = (r: BangKeLsxRow) => suaCuoi(trangThai[r.id])?.luc ?? ''
    return goc
      .filter((r) =>
        tk.every(
          (t) =>
          normalizeSearch(`${r.code} ${r.customer_name} ${r.order_codes.join(' ')}`).includes(t), // prettier-ignore
        ),
      )
      .sort(
        (a, b) =>
          Number(!!trangThai[b.id]?.choSoat) - Number(!!trangThai[a.id]?.choSoat) ||
          moiNhat(b).localeCompare(moiNhat(a)) ||
          (a.ship_date ?? '9999').localeCompare(b.ship_date ?? '9999'),
      )
  }, [rows, nhom, loc, q, trangThai])

  const chip = (k: Exclude<Loc, null>, nhan: string) => (
    <ChipLoc
      on={loc === k}
      count={nhom[k].length}
      onClick={() => setLoc(loc === k ? null : k)}
    >
      {nhan}
    </ChipLoc>
  )
  const khongDoi = rows.length - nhom.cho_soat.length

  return (
    <Trang>
      <DauTrang eyebrow="Mua hàng" title="Soát thay đổi" />
      <HangLoc>
        {chip('cho_soat', 'Chờ soát')}
        {chip('dinh_muc', 'Định mức')}
        {chip('lenh', 'Lệnh SX')}
        {chip('don', 'Đơn hàng')}
        {chip('da_soat', 'Đã soát 14 ngày')}
        <ChipLoc on={loc === null} count={rows.length} onClick={() => setLoc(null)}>
          Tất cả lệnh
        </ChipLoc>
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
        <table className="w-full min-w-[1100px] table-fixed border-collapse">
          <thead>
            <tr>
              <th className={`${TH} w-[148px]`}>Lệnh</th>
              <th className={`${TH} w-[170px]`}>Khách</th>
              <th className={`${TH} w-[104px]`}>Xuất</th>
              <th className={`${TH} w-[170px]`}>Định mức</th>
              <th className={`${TH} w-[130px]`}>Lệnh SX</th>
              <th className={`${TH} w-[170px]`}>Đơn hàng</th>
              <th className={TH}>Sửa gần nhất</th>
              <th className={`${TH} w-[170px]`}>So với</th>
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
                  onOpen={() => router.push(`/mua-hang/soat/${r.id}`)}
                />
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={COLS} className={TF}>
                Cộng {hien.length} lệnh
                {loc === 'cho_soat' && khongDoi > 0 && (
                  <span className="font-normal text-[var(--ink-3)]">
                    {' '}
                    · {khongDoi} lệnh không đổi
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
  onOpen,
}: {
  r: BangKeLsxRow
  t: TrangThaiLenhDoi | undefined
  onOpen: () => void
}) {
  const s = t?.choSoat ? t.suaSau : null
  const dm = t?.choSoat ? t.soDongDm : 0
  const cuoi = suaCuoi(t)
  const chinh =
    t?.choSoat && t.soMa > 0
      ? `${t.soMa} mã vật tư đổi`
      : dm > 0
        ? `${dm} dòng định mức đổi`
        : s
          ? `${s.dongDinhMuc} dòng sửa`
          : null
  const phu = [
    t?.choSoat && t.soMa > 0 && dm > 0 && `${dm} dòng định mức đổi`,
    s && (chinh === `${s.dongDinhMuc} dòng sửa` ? 'chưa có số cũ' : `${s.dongDinhMuc} dòng sửa chưa có số cũ`), // prettier-ignore
  ]
    .filter(Boolean)
    .join(' · ')
  return (
    <tr className="cursor-pointer hover:bg-[var(--surface-hover)]" onClick={onOpen}>
      <td className={`${TD} ${t?.choSoat ? 'shadow-[inset_3px_0_0_var(--warn)]' : ''}`}>
        <Link
          href={`/mua-hang/soat/${r.id}`}
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
      </td>
      <td className={`${TD} ${NGAY}`}>{dmy(r.ship_date)}</td>
      <td className={`${TD} max-w-0`}>
        {chinh ? (
          <>
            <Nhan tone="warn">{chinh}</Nhan>
            {phu && (
              <span
                className="block truncate text-[11.5px] text-[var(--ink-3)]"
                title={phu}
              >
                {phu}
              </span>
            )}
          </>
        ) : (
          <span className="text-[var(--ink-3)]">—</span>
        )}
      </td>
      <td className={TD}>
        {t?.choSoat && t.soThongTin > 0 ? (
          <Nhan tone="warn">{t.soThongTin} thay đổi</Nhan>
        ) : (
          <span className="text-[var(--ink-3)]">—</span>
        )}
      </td>
      <td className={`${TD} max-w-0`}>
        <ODonHang t={t} />
      </td>
      <td className={`${TD} max-w-0`}>
        {cuoi ? (
          <>
            <span className="block truncate" title={cuoi.ai}>
              {cuoi.ai || '—'}
            </span>
            <span className="block text-[11.5px] text-[var(--ink-3)]">
              {ngay(cuoi.luc)}
            </span>
          </>
        ) : (
          <span className="text-[var(--ink-3)]">—</span>
        )}
      </td>
      <td className={`${TD} max-w-0 text-[12px] text-[var(--ink-3)]`}>
        {t?.moc.k === 'soat' ? (
          <span className="block truncate">
            lần soát {ngay(t.moc.luc)}
            {t.moc.boi && ` · ${t.moc.boi}`}
          </span>
        ) : t ? (
          <span className="block truncate">
            lúc {t.moc.laDuyet ? 'duyệt' : 'phát lệnh'} {ngay(t.moc.luc)}
          </span>
        ) : null}
      </td>
    </tr>
  )
}

/** Ô "Đơn hàng": đơn đổi sau mốc (mã đơn) · lệnh chưa theo đơn · không nối dòng đơn. */
function ODonHang({ t }: { t: TrangThaiLenhDoi | undefined }) {
  if (!t) return null
  const doi = t.choSoat && t.soDon > 0
  if (!doi && t.lechDon === 0)
    return t.noiDon.tong > 0 && t.noiDon.noi === 0 ? (
      <span className="text-[12px] text-[var(--ink-3)]">không nối dòng đơn</span>
    ) : (
      <span className="text-[var(--ink-3)]">—</span>
    )
  return (
    <>
      {doi && <Nhan tone="warn">{t.soDon} thay đổi</Nhan>}
      {t.lechDon > 0 && <Nhan tone="stop">{t.lechDon} dòng lệnh chưa theo</Nhan>}
      {doi && (
        <span
          className="block truncate text-[11.5px] text-[var(--ink-3)]"
          title={t.donDoi.join(', ')}
        >
          {t.donDoi.join(', ')}
        </span>
      )}
    </>
  )
}

function Rong({ loc, tong, boLoc }: { loc: Loc; tong: number; boLoc: () => void }) {
  if (tong === 0)
    return (
      <div className="grid justify-items-start gap-1.5">
        <b>Không có lệnh nào đang chạy</b>
        <span className="text-[var(--ink-2)]">
          Chỉ soát thay đổi cho lệnh đã duyệt hoặc đang sản xuất.
        </span>
      </div>
    )
  const cau: Record<string, [string, string]> = {
    cho_soat: ['Không lệnh nào đổi từ lần soát cuối', `Định mức và lệnh của ${tong} lệnh đang chạy khớp với mốc đã soát.`], // prettier-ignore
    dinh_muc: ['Không lệnh nào đổi định mức', 'Định mức của các lệnh đang chạy khớp với mốc đã soát.'], // prettier-ignore
    lenh: ['Không lệnh nào đổi ngày xuất hay SL sản phẩm', 'Thông tin các lệnh khớp với mốc đã soát.'], // prettier-ignore
    don: ['Không đơn hàng nào đổi, không lệnh nào lệch đơn', 'Sale không sửa dòng SP / hạn giao / huỷ đơn nào của các lệnh đang chạy sau mốc soát.'], // prettier-ignore
    da_soat: [
      'Chưa ai soát lệnh nào trong 14 ngày',
      'Mốc so của các lệnh vẫn là lúc duyệt.',
    ],
  }
  const [b, l] = loc
    ? cau[loc]
    : [
        'Không lệnh nào khớp ô tìm',
        `Có ${tong} lệnh đang chạy — ô tìm không để lại dòng nào.`,
      ]
  return (
    <div className="grid justify-items-start gap-1.5">
      <b>{b}</b>
      <span className="text-[var(--ink-2)]">{l}</span>
      <Nut onClick={boLoc}>{`Xem tất cả ${tong} lệnh`}</Nut>
    </div>
  )
}
